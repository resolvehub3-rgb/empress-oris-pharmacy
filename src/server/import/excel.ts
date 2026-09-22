/**
 * Excel upload validation and workbook parsing.
 *
 * Uploaded workbooks are never trusted: extension, size, MIME type, workbook
 * structure, worksheet existence and required columns are all verified on the
 * backend before any row is looked at. Formulas and macros are never executed -
 * only cached cell values produced by SheetJS are read.
 */
import * as XLSX from "xlsx";
import { FieldKey, mapHeaderRow, fieldLabel, HeaderMappingResult } from "./columns";

/** Maximum accepted upload size (kept in sync with the app-wide multer limit). */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
/** Maximum number of data rows accepted in a single import. */
export const MAX_ROWS = 5000;

export const ALLOWED_EXTENSIONS = [".xlsx", ".xls"] as const;

const ALLOWED_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream",
  "application/binary",
  "application/x-ole-storage",
  "application/x-ole-object",
  "",
]);

/** Structured, user-facing import failure. */
export class ImportError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INVALID_FILE"
      | "MISSING_COLUMNS"
      | "INVALID_WORKBOOK"
      | "NO_ROWS"
      | "TOO_MANY_ROWS"
      | "DB_CONFLICT" = "INVALID_FILE"
  ) {
    super(message);
    this.name = "ImportError";
  }
}

export interface UploadedExcelFile {
  buffer: Buffer;
  originalName: string;
  mimetype: string;
  size: number;
}

/**
 * Validate the upload metadata before parsing anything.
 * Returns the sanitized file name (basename only) used for audit/history records.
 */
export function validateUpload(file: UploadedExcelFile): string {
  const originalName = String(file.originalName || "").split(/[\\/]/).pop() || "products.xlsx";
  const lower = originalName.toLowerCase();
  const extension = lower.slice(lower.lastIndexOf("."));

  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(extension)) {
    throw new ImportError(
      `Unsupported file type "${extension || "unknown"}". Only ${ALLOWED_EXTENSIONS.join(" and ")} files can be imported.`,
      "INVALID_FILE"
    );
  }

  if (typeof file.mimetype === "string" && !ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
    throw new ImportError(
      `Unsupported file content type "${file.mimetype}". Please upload a genuine Excel workbook.`,
      "INVALID_FILE"
    );
  }

  if (!file.buffer || file.buffer.length === 0) {
    throw new ImportError("The uploaded file is empty.", "INVALID_FILE");
  }

  if (file.buffer.length > MAX_FILE_BYTES) {
    throw new ImportError(
      `File is too large (${(file.buffer.length / (1024 * 1024)).toFixed(1)} MB). Maximum size is 5 MB.`,
      "INVALID_FILE"
    );
  }

  // Basic container sniffing: .xlsx must be a ZIP (PK..), .xls must be an OLE2 compound file.
  const isZip = file.buffer.length > 4 && file.buffer[0] === 0x50 && file.buffer[1] === 0x4b;
  const isOle =
    file.buffer.length > 8 &&
    file.buffer[0] === 0xd0 &&
    file.buffer[1] === 0xcf &&
    file.buffer[2] === 0x11 &&
    file.buffer[3] === 0xe0;

  if (extension === ".xlsx" && !isZip) {
    throw new ImportError("The file is not a valid .xlsx workbook.", "INVALID_FILE");
  }
  if (extension === ".xls" && !isOle && !isZip) {
    throw new ImportError("The file is not a valid .xls workbook.", "INVALID_FILE");
  }

  return originalName.slice(0, 200);
}

export interface ParsedRow {
  /** Actual 1-based Excel row number (used in error reports). */
  rowNumber: number;
  cells: unknown[];
}

export interface ParsedWorkbook {
  fileName: string;
  sheetName: string;
  sheetNames: string[];
  headerRowNumber: number;
  mapping: HeaderMappingResult;
  rows: ParsedRow[];
  /** Data rows that were entirely blank and therefore ignored. */
  skippedBlankRows: number;
}

const HEADER_SCAN_ROWS = 12;

/** Parse and structurally validate an uploaded product workbook. */
export function parseProductWorkbook(file: UploadedExcelFile): ParsedWorkbook {
  const fileName = validateUpload(file);

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(file.buffer, {
      type: "buffer",
      cellDates: true, // date-formatted cells come back as real JS dates
      cellFormula: false, // never parse/evaluate formulas - cached values only
      cellStyles: false,
      cellNF: false,
      cellHTML: false,
      sheetStubs: false,
      bookVBA: false, // macros are never loaded or executed
      bookFiles: false,
    });
  } catch (err: any) {
    throw new ImportError(
      `The file could not be read as an Excel workbook: ${err?.message || "unknown format"}.`,
      "INVALID_WORKBOOK"
    );
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new ImportError("The workbook does not contain any worksheets.", "INVALID_WORKBOOK");
  }

  // Prefer a worksheet explicitly named like a product sheet, else the first sheet.
  const preferred =
    workbook.SheetNames.find((n) => {
      const normalized = n.toLowerCase().replace(/[^a-z0-9]/g, "");
      return normalized === "products" || normalized === "product" || normalized === "sheet1";
    }) ?? workbook.SheetNames[0];

  const worksheet = workbook.Sheets[preferred];
  if (!worksheet || !worksheet["!ref"]) {
    throw new ImportError(`Worksheet "${preferred}" is empty.`, "INVALID_WORKBOOK");
  }

  const grid = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    raw: true,
    blankrows: true,
    defval: null,
  });

  if (!grid.length) {
    throw new ImportError(
      `Worksheet "${preferred}" has no data.\n\nImport cannot continue.\n\nMissing required columns:\n- Product Name\n- Selling Price (GH\u20B5)`,
      "MISSING_COLUMNS"
    );
  }

  const range = XLSX.utils.decode_range(worksheet["!ref"]!);
  const firstRowNumber = range.s.r + 1; // sheet_to_json starts at the range origin

  // Locate the header row: the first row (within a small window) that
  // recognizes the most canonical fields.
  let headerIndex = -1;
  let bestMapping: HeaderMappingResult | null = null;
  const scanLimit = Math.min(grid.length, HEADER_SCAN_ROWS);
  for (let i = 0; i < scanLimit; i++) {
    const mapping = mapHeaderRow(grid[i] || []);
    if (!bestMapping || mapping.recognizedCount > bestMapping.recognizedCount) {
      bestMapping = mapping;
      headerIndex = i;
    }
    if (mapping.recognizedCount >= 3 && mapping.missingRequired.length === 0) break;
  }

  if (!bestMapping || bestMapping.recognizedCount === 0) {
    throw new ImportError(
      "Import cannot continue.\n\nNo header row could be identified. The first row of the worksheet must contain column headers.\n\nMissing required columns:\n- Product Name\n- Selling Price (GH\u20B5)",
      "MISSING_COLUMNS"
    );
  }

  const mapping = bestMapping;
  const headerRowNumber = firstRowNumber + headerIndex;

  if (mapping.missingRequired.length > 0) {
    const list = mapping.missingRequired.map((key) => `- ${fieldLabel(key)}`).join("\n");
    throw new ImportError(`Import cannot continue.\n\nMissing required columns:\n${list}`, "MISSING_COLUMNS");
  }

  // Collect data rows while preserving true Excel row numbers.
  const rows: ParsedRow[] = [];
  let skippedBlankRows = 0;
  for (let i = headerIndex + 1; i < grid.length; i++) {
    const cells = grid[i] || [];
    const isEmpty = cells.every((cell) => cell === null || cell === undefined || String(cell).trim() === "");
    if (isEmpty) {
      skippedBlankRows++;
      continue;
    }
    rows.push({ rowNumber: firstRowNumber + i, cells });
    if (rows.length > MAX_ROWS) {
      throw new ImportError(
        `The worksheet contains more than ${MAX_ROWS} data rows. Split the file into smaller batches of up to ${MAX_ROWS} rows.`,
        "TOO_MANY_ROWS"
      );
    }
  }

  if (rows.length === 0) {
    throw new ImportError(
      "The worksheet contains a header row but no product data rows. Add at least one product below the headers.",
      "NO_ROWS"
    );
  }

  return {
    fileName,
    sheetName: preferred,
    sheetNames: workbook.SheetNames,
    headerRowNumber,
    mapping,
    rows,
    skippedBlankRows,
  };
}

/** Build the lookup from a parsed workbook: column index -> canonical field. */
export function columnIndexMap(workbook: ParsedWorkbook): Map<number, FieldKey> {
  return workbook.mapping.columnIndexToKey;
}

/** Extract one row into a canonical field -> raw cell value record. */
export function extractFields(
  row: ParsedRow,
  columnMap: Map<number, FieldKey>
): Partial<Record<FieldKey, unknown>> {
  const out: Partial<Record<FieldKey, unknown>> = {};
  for (const [index, field] of columnMap) {
    out[field] = row.cells[index];
  }
  return out;
}
