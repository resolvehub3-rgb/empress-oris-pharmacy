/**
 * Product Excel import service.
 *
 * previewImport  - parse + validate a workbook against a live snapshot of the
 *                  catalog (categories, suppliers, SKUs, barcodes) without writing.
 * confirmImport  - re-parse and re-validate the same workbook on the server and
 *                  persist products + batches + stock movements + audit logs in a
 *                  single Drizzle transaction (all-or-nothing), then broadcast
 *                  Supabase Realtime events so connected screens refresh.
 * getImportHistory - read the real import history records.
 *
 * The client is never trusted: confirm re-reads the uploaded file itself and
 * repeats every validation performed during preview.
 */
import { randomUUID } from "crypto";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "../../db";
import { AuthenticatedUser } from "../middleware/auth";
import { broadcastRealtimeEvent } from "../../services/supabase";
import { ImportError, parseProductWorkbook, UploadedExcelFile, MAX_FILE_BYTES, MAX_ROWS } from "./excel";
import { ReferenceData, validateWorkbookRows, ValidatedRow } from "./validation";

export type ImportMode = "ADD_NEW";

export interface ImportPreviewRow {
  rowNumber: number;
  status: ValidatedRow["status"];
  name: string | null;
  sku: string | null;
  barcode: string | null;
  categoryName: string | null;
  sellingPrice: number | null;
  costPrice: number | null;
  initialQuantity: number;
  hasStock: boolean;
  batchNumber: string | null;
  expiryDate: string | null;
  supplierName: string | null;
  errors: string[];
  warnings: string[];
  notes: string[];
}

export interface ImportPreviewResponse {
  fileName: string;
  sheetName: string;
  headerRowNumber: number;
  mode: ImportMode;
  fileSizeBytes: number;
  maxRows: number;
  maxFileBytes: number;
  skippedBlankRows: number;
  unmappedColumns: string[];
  summary: {
    totalRows: number;
    readyCount: number;
    duplicateCount: number;
    invalidCount: number;
    withStockCount: number;
    withoutStockCount: number;
    skuGeneratedCount: number;
    expiredBatchCount: number;
    newCategories: string[];
  };
  rows: ImportPreviewRow[];
}

export interface ImportConfirmResponse {
  importId: string;
  fileName: string;
  mode: ImportMode;
  totalRows: number;
  imported: number;
  duplicates: number;
  invalid: number;
  productsCreated: number;
  batchesCreated: number;
  movementsCreated: number;
  categoriesCreated: number;
  withStock: number;
  withoutStock: number;
  completedAt: string;
}

export interface ImportHistoryItem {
  id: string;
  fileName: string;
  mode: string;
  uploadedBy: string | null;
  uploadedByName: string | null;
  totalRows: number;
  importedRows: number;
  duplicateRows: number;
  failedRows: number;
  stockRows: number;
  batchesCreated: number;
  movementsCreated: number;
  categoriesCreated: number;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

const INSERT_CHUNK_SIZE = 400; // keeps each multi-row statement well under the 65k parameter limit

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function toPreviewRow(row: ValidatedRow): ImportPreviewRow {
  return {
    rowNumber: row.rowNumber,
    status: row.status,
    name: row.name,
    sku: row.sku,
    barcode: row.barcode,
    categoryName: row.categoryName,
    sellingPrice: row.sellingPrice,
    costPrice: row.costPrice,
    initialQuantity: row.initialQuantity,
    hasStock: row.hasStock,
    batchNumber: row.batchNumber,
    expiryDate: row.expiryDate,
    supplierName: row.supplierName,
    errors: row.errors,
    warnings: row.warnings,
    notes: row.notes,
  };
}

/** Snapshot the reference data needed for validation (one query per table). */
async function loadReferenceData(): Promise<ReferenceData> {
  const db = getDb();
  if (!db) throw new ImportError("Database not connected.", "INVALID_FILE");

  const [categories, suppliers, products] = await Promise.all([
    db.select({ id: schema.categories.id, name: schema.categories.name }).from(schema.categories),
    db.select({ id: schema.suppliers.id, name: schema.suppliers.name }).from(schema.suppliers),
    db.select({ sku: schema.products.sku, barcode: schema.products.barcode }).from(schema.products),
  ]);

  const reference: ReferenceData = {
    categories: new Map(categories.map((c) => [c.name.trim().toLowerCase(), c])),
    suppliers: new Map(suppliers.map((s) => [s.name.trim().toLowerCase(), s])),
    existingSkus: new Map(),
    existingBarcodes: new Map(),
  };

  for (const product of products) {
    if (product.sku) reference.existingSkus.set(product.sku.trim().toLowerCase(), product.sku.trim());
    if (product.barcode) reference.existingBarcodes.set(product.barcode.trim().toLowerCase(), product.barcode.trim());
  }

  return reference;
}

/** Parse + validate without touching the database. */
async function buildPreview(file: UploadedExcelFile) {
  const workbook = parseProductWorkbook(file);
  const reference = await loadReferenceData();
  const validation = validateWorkbookRows(workbook, reference);
  return { workbook, validation };
}

export async function previewImport(
  file: UploadedExcelFile,
  _user: AuthenticatedUser
): Promise<ImportPreviewResponse> {
  const { workbook, validation } = await buildPreview(file);

  return {
    fileName: workbook.fileName,
    sheetName: workbook.sheetName,
    headerRowNumber: workbook.headerRowNumber,
    mode: "ADD_NEW",
    fileSizeBytes: file.buffer.length,
    maxRows: MAX_ROWS,
    maxFileBytes: MAX_FILE_BYTES,
    skippedBlankRows: workbook.skippedBlankRows,
    unmappedColumns: validation.unmappedColumns,
    summary: validation.summary,
    rows: validation.rows.map(toPreviewRow),
  };
}

function isUniqueViolation(err: any): boolean {
  return err?.code === "23505" || String(err?.message || "").toLowerCase().includes("duplicate key");
}

function friendlyDbError(err: any): string {
  if (isUniqueViolation(err)) {
    return "A product with this SKU or barcode already exists (it may have been created while this import was running). Nothing was imported - please refresh and try again.";
  }
  // Drizzle embeds the full failing statement + bind parameters in err.message.
  // Never leak SQL or data values to the client; the raw error is logged server-side.
  const pgMessage: string = err?.cause?.message || err?.original?.message || "";
  const isSafePostgresMessage =
    typeof pgMessage === "string" &&
    pgMessage.length > 0 &&
    !/insert into|update\s|delete from|values\s*\(/i.test(pgMessage);
  if (isSafePostgresMessage) {
    return `The import was rejected by the database: ${pgMessage}. No changes were saved.`;
  }
  return "The import failed while writing to the database. No changes were saved. Please check the file and try again.";
}

/**
 * Validate the uploaded workbook again and persist everything in ONE
 * transaction: products -> batches -> stock movements -> audit logs ->
 * import history. Any failure rolls the whole import back.
 */
export async function confirmImport(
  file: UploadedExcelFile,
  user: AuthenticatedUser,
  mode: string = "ADD_NEW",
  ipAddress?: string
): Promise<ImportConfirmResponse> {
  const normalizedMode = String(mode || "ADD_NEW").toUpperCase();
  if (normalizedMode !== "ADD_NEW") {
    throw new ImportError(
      "Only the 'Add New Products' import mode is currently enabled. Existing products are never overwritten by an import.",
      "INVALID_FILE"
    );
  }

  const db = getDb();
  if (!db) throw new ImportError("Database not connected.", "INVALID_FILE");

  const { workbook, validation } = await buildPreview(file);
  const readyRows = validation.rows.filter((row) => row.status === "READY");
  const { summary } = validation;

  if (readyRows.length === 0) {
    throw new ImportError(
      `No valid rows to import: ${summary.duplicateCount} duplicate row(s) and ${summary.invalidCount} invalid row(s) were found. Fix the file and try again.`,
      "NO_ROWS"
    );
  }

  const fileName = workbook.fileName;
  const stockRows = readyRows.filter((row) => row.hasStock);

  // Pre-generate primary keys so bulk inserts never depend on RETURNING order.
  const productIds = new Map<number, string>(readyRows.map((row) => [row.rowNumber, randomUUID()]));
  const batchIds = new Map<number, string>(stockRows.map((row) => [row.rowNumber, randomUUID()]));

  let categoriesCreated = 0;

  try {
    const result = await db.transaction(async (tx) => {
      // ---------------------------------------------------------------
      // 1. Categories: resolve existing, create missing (never duplicated)
      // ---------------------------------------------------------------
      let categoryMap = new Map(
        (await tx.select({ id: schema.categories.id, name: schema.categories.name }).from(schema.categories)).map(
          (c) => [c.name.trim().toLowerCase(), c] as const
        )
      );

      const missingCategoryNames = [
        ...new Set(
          readyRows
            .map((row) => row.categoryName)
            .filter((name): name is string => !!name && !categoryMap.has(name.trim().toLowerCase()))
        ),
      ];

      if (missingCategoryNames.length > 0) {
        await tx
          .insert(schema.categories)
          .values(missingCategoryNames.map((name) => ({ name })))
          .onConflictDoNothing();
        categoriesCreated = missingCategoryNames.length;
        categoryMap = new Map(
          (await tx.select({ id: schema.categories.id, name: schema.categories.name }).from(schema.categories)).map(
            (c) => [c.name.trim().toLowerCase(), c] as const
          )
        );
      }

      const categoryIdFor = (row: ValidatedRow): string | null => {
        if (row.categoryId) return row.categoryId;
        if (!row.categoryName) return null;
        return categoryMap.get(row.categoryName.trim().toLowerCase())?.id ?? null;
      };

      // ---------------------------------------------------------------
      // 2. Products (bulk, explicit ids)
      // ---------------------------------------------------------------
      const productValues = readyRows.map((row) => ({
        id: productIds.get(row.rowNumber)!,
        name: row.name!,
        genericName: row.genericName,
        brandName: row.brandName,
        sku: row.sku!,
        barcode: row.barcode,
        categoryId: categoryIdFor(row),
        dosageForm: row.dosageForm,
        strength: row.strength,
        unit: row.unit,
        packSize: row.packSize,
        manufacturer: row.manufacturer,
        description: row.description,
        prescriptionRequired: row.prescriptionRequired,
        reorderLevel: row.reorderLevel,
        sellingPrice: (row.sellingPrice ?? 0).toFixed(2),
        wholesalePrice: row.wholesalePrice === null ? null : row.wholesalePrice.toFixed(2),
        isActive: true,
      }));

      for (const part of chunk(productValues, INSERT_CHUNK_SIZE)) {
        await tx.insert(schema.products).values(part);
      }

      // ---------------------------------------------------------------
      // 3. Batches - identical shape to the manual Add Product workflow
      // ---------------------------------------------------------------
      const batchValues = stockRows.map((row) => ({
        id: batchIds.get(row.rowNumber)!,
        productId: productIds.get(row.rowNumber)!,
        batchNumber: row.batchNumber!,
        supplierId: row.supplierId,
        initialQuantity: row.initialQuantity,
        currentQuantity: row.initialQuantity,
        costPrice: (row.costPrice ?? 0).toFixed(2),
        sellingPrice: (row.sellingPrice ?? 0).toFixed(2),
        manufacturingDate: row.manufacturingDate,
        expiryDate: row.expiryDate!,
        status: "ACTIVE",
        notes: row.stockNotes || "Opening stock imported from Excel",
      }));

      for (const part of chunk(batchValues, INSERT_CHUNK_SIZE)) {
        await tx.insert(schema.batches).values(part);
      }

      // ---------------------------------------------------------------
      // 4. Stock movements (INITIAL_STOCK) - feeds reports and the ledger
      // ---------------------------------------------------------------
      const movementValues = stockRows.map((row) => ({
        id: randomUUID(),
        productId: productIds.get(row.rowNumber)!,
        batchId: batchIds.get(row.rowNumber)!,
        movementType: "INITIAL_STOCK",
        quantityChange: row.initialQuantity,
        previousQuantity: 0,
        newQuantity: row.initialQuantity,
        referenceId: row.purchaseReference || `IMPORT-${row.batchNumber}`,
        reason: "Initial opening stock from Excel product import",
        userId: user.id,
      }));

      for (const part of chunk(movementValues, INSERT_CHUNK_SIZE)) {
        await tx.insert(schema.stockMovements).values(part);
      }

      // ---------------------------------------------------------------
      // 5. Audit logs (mirrors the manual workflow + one import summary)
      // ---------------------------------------------------------------
      const auditValues: Array<{
        userId: string | null;
        action: string;
        entityType: string;
        entityId: string | null;
        details: Record<string, unknown>;
        ipAddress: string | null;
      }> = [];

      for (const row of readyRows) {
        auditValues.push({
          userId: user.id,
          action: "PRODUCT_CREATED",
          entityType: "PRODUCT",
          entityId: productIds.get(row.rowNumber)!,
          details: { name: row.name, sku: row.sku, barcode: row.barcode, source: "EXCEL_IMPORT" },
          ipAddress: ipAddress ?? null,
        });
      }
      for (const row of stockRows) {
        auditValues.push({
          userId: user.id,
          action: "INITIAL_STOCK_ADDED",
          entityType: "BATCH",
          entityId: batchIds.get(row.rowNumber)!,
          details: {
            productId: productIds.get(row.rowNumber)!,
            productName: row.name,
            batchNumber: row.batchNumber,
            quantity: row.initialQuantity,
            costPrice: row.costPrice ?? 0,
            sellingPrice: row.sellingPrice ?? 0,
            expiryDate: row.expiryDate,
            source: "EXCEL_IMPORT",
          },
          ipAddress: ipAddress ?? null,
        });
      }
      auditValues.push({
        userId: user.id,
        action: "PRODUCT_EXCEL_IMPORT",
        entityType: "PRODUCT_IMPORT",
        entityId: null,
        details: {
          fileName,
          sheet: workbook.sheetName,
          rows: summary.totalRows,
          imported: readyRows.length,
          duplicates: summary.duplicateCount,
          invalid: summary.invalidCount,
          productsCreated: readyRows.length,
          batchesCreated: stockRows.length,
          movementsCreated: stockRows.length,
        },
        ipAddress: ipAddress ?? null,
      });

      for (const part of chunk(auditValues, INSERT_CHUNK_SIZE)) {
        await tx.insert(schema.auditLogs).values(part);
      }

      // ---------------------------------------------------------------
      // 6. Import history record (real DB rows - powers Import History)
      // ---------------------------------------------------------------
      const [historyRow] = await tx
        .insert(schema.productImports)
        .values({
          fileName,
          uploadedBy: user.id,
          mode: "ADD_NEW",
          totalRows: summary.totalRows,
          importedRows: readyRows.length,
          duplicateRows: summary.duplicateCount,
          failedRows: summary.invalidCount,
          stockRows: stockRows.length,
          batchesCreated: stockRows.length,
          movementsCreated: stockRows.length,
          categoriesCreated,
          status: "COMPLETED",
          errorMessage: null,
          completedAt: new Date(),
        })
        .returning();

      return { historyRow };
    });

    // ---------------------------------------------------------------
    // Realtime: connected dashboards refresh without any page reload
    // ---------------------------------------------------------------
    await broadcastRealtimeEvent("PRODUCT_CREATED", {
      source: "EXCEL_IMPORT",
      importId: result.historyRow.id,
      count: readyRows.length,
      fileName,
      createdBy: user.id,
    });
    await broadcastRealtimeEvent("STOCK_UPDATED", {
      source: "EXCEL_IMPORT",
      importId: result.historyRow.id,
      batches: stockRows.length,
      action: "EXCEL_IMPORT",
    });

    return {
      importId: result.historyRow.id,
      fileName,
      mode: "ADD_NEW",
      totalRows: summary.totalRows,
      imported: readyRows.length,
      duplicates: summary.duplicateCount,
      invalid: summary.invalidCount,
      productsCreated: readyRows.length,
      batchesCreated: stockRows.length,
      movementsCreated: stockRows.length,
      categoriesCreated,
      withStock: stockRows.length,
      withoutStock: readyRows.length - stockRows.length,
      completedAt: result.historyRow.completedAt
        ? new Date(result.historyRow.completedAt).toISOString()
        : new Date().toISOString(),
    };
  } catch (err: any) {
    // The transaction rolled back - record the failed attempt for the history log.
    const message = friendlyDbError(err);
    try {
      await db.insert(schema.productImports).values({
        fileName,
        uploadedBy: user.id,
        mode: "ADD_NEW",
        totalRows: summary.totalRows,
        importedRows: 0,
        duplicateRows: summary.duplicateCount,
        failedRows: summary.invalidCount,
        stockRows: 0,
        batchesCreated: 0,
        movementsCreated: 0,
        categoriesCreated: 0,
        status: "FAILED",
        errorMessage: message.slice(0, 1000),
        completedAt: new Date(),
      });
    } catch (historyErr) {
      console.error("[Product Import] Could not record failed import:", historyErr);
    }

    console.error("[Product Import] Transaction rolled back:", err);
    if (err instanceof ImportError) throw err;
    throw new ImportError(message, isUniqueViolation(err) ? "DB_CONFLICT" : "INVALID_FILE");
  }
}

/** Real import history rows (no hardcoded data). */
export async function getImportHistory(limit = 25): Promise<ImportHistoryItem[]> {
  const db = getDb();
  if (!db) throw new ImportError("Database not connected.", "INVALID_FILE");

  const list = await db
    .select({
      id: schema.productImports.id,
      fileName: schema.productImports.fileName,
      mode: schema.productImports.mode,
      uploadedBy: schema.productImports.uploadedBy,
      uploadedByName: schema.users.fullName,
      totalRows: schema.productImports.totalRows,
      importedRows: schema.productImports.importedRows,
      duplicateRows: schema.productImports.duplicateRows,
      failedRows: schema.productImports.failedRows,
      stockRows: schema.productImports.stockRows,
      batchesCreated: schema.productImports.batchesCreated,
      movementsCreated: schema.productImports.movementsCreated,
      categoriesCreated: schema.productImports.categoriesCreated,
      status: schema.productImports.status,
      errorMessage: schema.productImports.errorMessage,
      createdAt: schema.productImports.createdAt,
      completedAt: schema.productImports.completedAt,
    })
    .from(schema.productImports)
    .leftJoin(schema.users, eq(schema.productImports.uploadedBy, schema.users.id))
    .orderBy(desc(schema.productImports.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100));

  return list.map((item) => ({
    ...item,
    createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : String(item.createdAt),
    completedAt: item.completedAt
      ? item.completedAt instanceof Date
        ? item.completedAt.toISOString()
        : String(item.completedAt)
      : null,
  }));
}
