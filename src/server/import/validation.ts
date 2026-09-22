/**
 * Row-level validation for Excel product imports.
 *
 * Every row is fully validated before anything is written to the database:
 * required fields, numeric formats, dates, boolean vocabulary, cross-field
 * inventory rules and duplicate detection (both against the live catalog and
 * within the same spreadsheet).
 */
import { z } from "zod";
import { extractFields, ParsedWorkbook } from "./excel";
import { toBoolean, toInteger, toPrice, toText, toDate, todayIso } from "./values";

export type RowStatus = "READY" | "DUPLICATE" | "INVALID";

export interface ValidatedRow {
  rowNumber: number;
  status: RowStatus;
  errors: string[];
  warnings: string[];
  notes: string[];

  // Product fields (normalized)
  name: string | null;
  genericName: string | null;
  brandName: string | null;
  sku: string | null;
  barcode: string | null;
  categoryName: string | null;
  categoryId: string | null;
  isNewCategory: boolean;
  dosageForm: string | null;
  strength: string | null;
  unit: string;
  packSize: number;
  manufacturer: string | null;
  description: string | null;
  prescriptionRequired: boolean;
  reorderLevel: number;
  sellingPrice: number | null;
  wholesalePrice: number | null;

  // Initial stock fields
  initialQuantity: number;
  hasStock: boolean;
  batchNumber: string | null;
  costPrice: number | null;
  manufacturingDate: string | null;
  expiryDate: string | null;
  supplierName: string | null;
  supplierId: string | null;
  purchaseReference: string | null;
  stockNotes: string | null;
}

export interface ReferenceData {
  /** lower-cased category name -> existing category */
  categories: Map<string, { id: string; name: string }>;
  /** lower-cased supplier name -> existing supplier */
  suppliers: Map<string, { id: string; name: string }>;
  /** lower-cased existing product SKUs -> stored SKU */
  existingSkus: Map<string, string>;
  /** lower-cased existing product barcodes -> stored barcode */
  existingBarcodes: Map<string, string>;
}

export interface ValidationSummary {
  totalRows: number;
  readyCount: number;
  duplicateCount: number;
  invalidCount: number;
  withStockCount: number;
  withoutStockCount: number;
  skuGeneratedCount: number;
  expiredBatchCount: number;
  newCategories: string[];
}

export interface ValidationResult {
  rows: ValidatedRow[];
  summary: ValidationSummary;
  unmappedColumns: string[];
}

/** Zod gate over the coerced row - a final structural safety net. */
const coercedRowSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  barcode: z.string().min(1).nullable(),
  sellingPrice: z.number().min(0),
  wholesalePrice: z.number().min(0).nullable(),
  packSize: z.number().int().min(1),
  reorderLevel: z.number().int().min(0),
  initialQuantity: z.number().int().min(0),
  prescriptionRequired: z.boolean(),
  manufacturingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

function generateSku(
  productName: string,
  taken: Set<string>
): string {
  const prefix =
    (productName || "PRD")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 4) || "PRD";

  for (let i = 0; i < 500; i++) {
    const candidate = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  // Deterministic fallback that is effectively guaranteed unique.
  return `${prefix}-${Date.now().toString().slice(-8)}`;
}

/**
 * Validate every parsed row against the application's business rules.
 * Pure function of (workbook + reference snapshot) - performs no writes.
 */
export function validateWorkbookRows(workbook: ParsedWorkbook, reference: ReferenceData): ValidationResult {
  const columnMap = workbook.mapping.columnIndexToKey;
  const today = todayIso();

  const seenSkus = new Set<string>(); // lower-cased SKUs already accepted in this file
  const seenBarcodes = new Set<string>();
  const seenSkuRows = new Map<string, number>();
  const seenBarcodeRows = new Map<string, number>();
  const takenSkus = new Set<string>(reference.existingSkus.keys());

  const newCategoryNames = new Map<string, string>(); // lower -> display name
  const rows: ValidatedRow[] = [];

  let readyCount = 0;
  let duplicateCount = 0;
  let invalidCount = 0;
  let withStockCount = 0;
  let skuGeneratedCount = 0;
  let expiredBatchCount = 0;

  for (const parsedRow of workbook.rows) {
    const raw = extractFields(parsedRow, columnMap);
    const errors: string[] = [];
    const warnings: string[] = [];
    const notes: string[] = [];

    // --- Core product text fields -------------------------------------
    const name = toText(raw.name);
    if (!name) errors.push("Product Name is required and must not be empty.");

    const genericName = toText(raw.genericName);
    const brandName = toText(raw.brandName);
    const dosageForm = toText(raw.dosageForm);
    const strength = toText(raw.strength);
    const manufacturer = toText(raw.manufacturer);
    const description = toText(raw.description);
    const categoryName = toText(raw.category);
    const purchaseReference = toText(raw.purchaseReference);
    const stockNotes = toText(raw.stockNotes);
    const unit = toText(raw.unit) || "Pack";

    // --- Identifiers ---------------------------------------------------
    let sku = toText(raw.sku);
    let barcode = toText(raw.barcode);
    if (barcode) {
      if (!/^[A-Za-z0-9\-+. ]{4,64}$/.test(barcode)) {
        errors.push(`Barcode "${barcode}" contains unsupported characters (use digits, letters, - . + or spaces).`);
      }
    }

    // --- Prices --------------------------------------------------------
    const sellingPriceResult = toPrice(raw.sellingPrice, "Selling Price", { required: true });
    if (!sellingPriceResult.ok) errors.push(sellingPriceResult.reason);
    const sellingPrice = sellingPriceResult.ok ? sellingPriceResult.value : null;

    const wholesalePriceResult = toPrice(raw.wholesalePrice, "Wholesale Price", { required: false });
    if (!wholesalePriceResult.ok) errors.push(wholesalePriceResult.reason);
    const wholesalePrice = wholesalePriceResult.ok ? wholesalePriceResult.value : null;

    const costPriceResult = toPrice(raw.costPrice, "Cost Price", { required: false });
    if (!costPriceResult.ok) errors.push(costPriceResult.reason);
    const costPrice = costPriceResult.ok ? costPriceResult.value : null;

    // --- Integers ------------------------------------------------------
    const packSizeResult = toInteger(raw.packSize, "Pack Size", { required: false, min: 1, max: 100000, fallback: 1 });
    if (!packSizeResult.ok) errors.push(packSizeResult.reason);
    const packSize = packSizeResult.ok ? (packSizeResult.value ?? 1) : 1;

    const reorderResult = toInteger(raw.reorderLevel, "Reorder Level", { required: false, min: 0, max: 1000000, fallback: 10 });
    if (!reorderResult.ok) errors.push(reorderResult.reason);
    const reorderLevel = reorderResult.ok ? (reorderResult.value ?? 10) : 10;

    const quantityResult = toInteger(raw.initialQuantity, "Initial Quantity", { required: false, min: 0, max: 100000000, fallback: 0 });
    if (!quantityResult.ok) errors.push(quantityResult.reason);
    const initialQuantity = quantityResult.ok ? (quantityResult.value ?? 0) : 0;

    // --- Boolean -------------------------------------------------------
    const rxResult = toBoolean(raw.prescriptionRequired, "Prescription Required");
    if (!rxResult.ok) errors.push(rxResult.reason);
    const prescriptionRequired = rxResult.ok ? rxResult.value : false;

    // --- Dates ---------------------------------------------------------
    const mfgResult = toDate(raw.manufacturingDate, "Manufacturing Date", { required: false });
    if (!mfgResult.ok) errors.push(mfgResult.reason);
    const manufacturingDate = mfgResult.ok ? mfgResult.value : null;

    const expiryResult = toDate(raw.expiryDate, "Expiry Date", { required: false });
    if (!expiryResult.ok) errors.push(expiryResult.reason);
    const expiryDate = expiryResult.ok ? expiryResult.value : null;

    // --- Cross-field inventory rules (mirror the Add Product workflow) --
    const batchNumber = toText(raw.batchNumber);
    const hasStock = initialQuantity > 0;
    if (hasStock) {
      if (!batchNumber) {
        errors.push("Batch Number is required when Initial Quantity is greater than 0 (pharmaceutical batch tracking / FEFO).");
      }
      if (!expiryDate) {
        errors.push("Expiry Date is required when Initial Quantity is greater than 0 (pharmaceutical stock).");
      }
    } else if (batchNumber || expiryDate) {
      notes.push("Batch information ignored because Initial Quantity is 0 or blank.");
    }

    const supplierName = toText(raw.supplier);
    let supplierId: string | null = null;
    if (supplierName) {
      const supplier = reference.suppliers.get(supplierName.toLowerCase());
      if (supplier) {
        supplierId = supplier.id;
      } else {
        warnings.push(
          `Supplier "${supplierName}" was not found - the batch will be imported without a supplier link.`
        );
      }
    }

    let categoryId: string | null = null;
    let isNewCategory = false;
    if (categoryName) {
      const existing = reference.categories.get(categoryName.toLowerCase());
      if (existing) {
        categoryId = existing.id;
      } else {
        isNewCategory = true;
        newCategoryNames.set(categoryName.toLowerCase(), categoryName);
        notes.push(`New category "${categoryName}" will be created.`);
      }
    }

    // --- SKU: generate when absent (same rule as the manual Add Product flow)
    if (!sku) {
      if (name) {
        sku = generateSku(name, takenSkus);
        takenSkus.add(sku.toLowerCase());
        notes.push(`SKU was not supplied - generated automatically: ${sku}.`);
        skuGeneratedCount++;
      }
    }

    // --- Expiry sanity warnings ---------------------------------------
    if (expiryDate && expiryDate < today && hasStock) {
      warnings.push("Expiry Date is in the past - this stock cannot be sold through the POS (FEFO rules).");
    }
    if (costPrice !== null && sellingPrice !== null && costPrice >= sellingPrice && sellingPrice > 0) {
      warnings.push("Cost Price is not lower than Selling Price - this product will not generate a margin.");
    }

    // --- Duplicate detection ------------------------------------------
    let status: RowStatus = errors.length > 0 ? "INVALID" : "READY";
    if (status === "READY" && sku) {
      const skuKey = sku.toLowerCase();
      const dbMatch = reference.existingSkus.get(skuKey);
      if (dbMatch) {
        status = "DUPLICATE";
        errors.push(`SKU already exists in the system ("${dbMatch}").`);
      } else if (seenSkus.has(skuKey)) {
        status = "DUPLICATE";
        errors.push(`Duplicate SKU inside this spreadsheet (first used on row ${seenSkuRows.get(skuKey)}).`);
      }
      if (status === "READY" && barcode) {
        const barcodeKey = barcode.toLowerCase();
        const dbBarcode = reference.existingBarcodes.get(barcodeKey);
        if (dbBarcode) {
          status = "DUPLICATE";
          errors.push(`Barcode already exists in the system ("${dbBarcode}").`);
        } else if (seenBarcodes.has(barcodeKey)) {
          status = "DUPLICATE";
          errors.push(`Duplicate barcode inside this spreadsheet (first used on row ${seenBarcodeRows.get(barcodeKey)}).`);
        }
      }
    }

    if (status === "INVALID") {
      invalidCount++;
    } else if (status === "DUPLICATE") {
      duplicateCount++;
    } else {
      readyCount++;
      if (sku) seenSkus.add(sku.toLowerCase());
      if (sku) seenSkuRows.set(sku.toLowerCase(), parsedRow.rowNumber);
      if (barcode) {
        seenBarcodes.add(barcode.toLowerCase());
        seenBarcodeRows.set(barcode.toLowerCase(), parsedRow.rowNumber);
      }
      if (hasStock) {
        withStockCount++;
        if (expiryDate && expiryDate < today) expiredBatchCount++;
      }
    }

    rows.push({
      rowNumber: parsedRow.rowNumber,
      status,
      errors,
      warnings,
      notes,
      name,
      genericName,
      brandName,
      sku,
      barcode,
      categoryName,
      categoryId,
      isNewCategory,
      dosageForm,
      strength,
      unit,
      packSize,
      manufacturer,
      description,
      prescriptionRequired,
      reorderLevel,
      sellingPrice,
      wholesalePrice,
      initialQuantity,
      hasStock,
      batchNumber: hasStock ? batchNumber : null,
      costPrice: hasStock ? costPrice : null,
      manufacturingDate: hasStock ? manufacturingDate : null,
      expiryDate: hasStock ? expiryDate : null,
      supplierName,
      supplierId,
      purchaseReference: hasStock ? purchaseReference : null,
      stockNotes: hasStock ? stockNotes : null,
    });
  }

  // Final Zod gate on READY rows (defensive - coerced values must be structurally sound).
  for (const row of rows) {
    if (row.status !== "READY") continue;
    const result = coercedRowSchema.safeParse({
      name: row.name,
      sku: row.sku,
      barcode: row.barcode,
      sellingPrice: row.sellingPrice,
      wholesalePrice: row.wholesalePrice,
      packSize: row.packSize,
      reorderLevel: row.reorderLevel,
      initialQuantity: row.initialQuantity,
      prescriptionRequired: row.prescriptionRequired,
      manufacturingDate: row.manufacturingDate,
      expiryDate: row.expiryDate,
    });
    if (!result.success) {
      row.status = "INVALID";
      for (const issue of result.error.issues) {
        row.errors.push(`${issue.path.join(".") || "row"}: ${issue.message}`);
      }
      readyCount--;
      invalidCount++;
      if (row.hasStock) withStockCount--;
      if (row.sku) seenSkus.delete(row.sku.toLowerCase());
      if (row.barcode) seenBarcodes.delete(row.barcode.toLowerCase());
    }
  }

  return {
    rows,
    summary: {
      totalRows: rows.length,
      readyCount,
      duplicateCount,
      invalidCount,
      withStockCount,
      withoutStockCount: readyCount - withStockCount,
      skuGeneratedCount,
      expiredBatchCount,
      newCategories: [...newCategoryNames.values()],
    },
    unmappedColumns: workbook.mapping.unmappedLabels,
  };
}
