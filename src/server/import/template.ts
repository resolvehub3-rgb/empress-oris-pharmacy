/**
 * Excel template and error-report generation for the Product Import feature.
 *
 * The template mirrors the application's real product + inventory structure:
 * a clean "Products" sheet (headers only - no sample data is ever inserted),
 * an "Instructions" sheet describing required vs optional columns and the
 * accepted value formats, and an "Example" sheet showing one completed row.
 */
import * as XLSX from "xlsx";
import { COLUMNS } from "./columns";

const TEMPLATE_FILE_NAME = "Empress-Oris-Product-Import-Template.xlsx";

const PRODUCT_HEADERS = COLUMNS.map((c) => c.label);

const INSTRUCTIONS: Array<[string, string]> = [
  ["Empress Oris Herbal & Mart - Excel Product Import", ""],
  ["", ""],
  ["HOW TO USE", ""],
  ["1.", "Enter your products on the 'Products' sheet, one product per row, starting directly under the header row."],
  ["2.", "Do not rename, reorder or remove the header cells - required headers must remain present."],
  ["3.", "Save the file and upload it with 'Import Products' in the Product Catalog."],
  ["4.", "Review the import preview carefully, then confirm. Nothing is saved before you confirm."],
  ["", ""],
  ["REQUIRED COLUMNS", ""],
  ...COLUMNS.filter((c) => c.required).map((c) => [c.label, c.hint] as [string, string]),
  ["", ""],
  ["OPTIONAL COLUMNS", ""],
  ...COLUMNS.filter((c) => !c.required).map((c) => [c.label, c.hint] as [string, string]),
  ["", ""],
  ["VALUE RULES", ""],
  ["Prices", "Plain numbers in Ghana Cedis (GH\u20B5). Example: 10.50 - NOT 'GHS 10.50', '10,50' or negative values."],
  ["Dates", "DD/MM/YYYY (Ghana convention) or YYYY-MM-DD. Excel date cells are also accepted."],
  ["Booleans", "Prescription Required accepts: Yes, No, TRUE, FALSE, 1, 0."],
  ["SKU", "Must be unique. Leave blank to have a unique SKU generated automatically."],
  ["Barcode", "Optional, but must be unique when supplied."],
  ["Initial Stock", "When Initial Quantity > 0 a Batch Number and Expiry Date are required (batch/FEFO tracking)."],
  ["Initial Quantity", "0 or blank = product imported without stock (add stock later via Add Stock)."],
  ["Category", "Enter an existing category name or a new one - new categories are created automatically."],
  ["Supplier", "Must match an existing supplier name to be linked; otherwise the batch imports without a supplier."],
  ["Images", "Product images are not imported from Excel - upload them afterwards (Supabase Storage)."],
  ["Limits", "Maximum 5 MB file, up to 5,000 product rows per import. .xlsx and .xls are supported."],
  ["Currency", "All prices are interpreted as Ghana Cedi (GH\u20B5 / GHS) amounts. No conversion is applied."],
];

function autosizeWidths(rows: unknown[][], min = 12, max = 60): XLSX.ColInfo[] {
  return rows[0].map((_, columnIndex) => {
    const width = rows.reduce(( widest, row) => {
      const cell = row[columnIndex];
      const length = cell === null || cell === undefined ? 0 : String(cell).length;
      return Math.max(widest, length);
    }, min);
    return { wch: Math.min(max, width + 2) };
  });
}

/** Build the downloadable blank import template workbook. */
export function buildTemplateBuffer(): Buffer {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: the actual import sheet - headers only, so no sample rows can leak in.
  const productsSheet = XLSX.utils.aoa_to_sheet([PRODUCT_HEADERS]);
  productsSheet["!cols"] = autosizeWidths([PRODUCT_HEADERS], 16, 34);
  XLSX.utils.book_append_sheet(workbook, productsSheet, "Products");

  // Sheet 2: instructions (required vs optional columns + accepted formats).
  const instructionsSheet = XLSX.utils.aoa_to_sheet(INSTRUCTIONS);
  instructionsSheet["!cols"] = [{ wch: 44 }, { wch: 110 }];
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");

  // Sheet 3: one clearly-labelled example row (format only - never auto-imported).
  const example: unknown[][] = [PRODUCT_HEADERS];
  example.push([
    "Paracetamol 500mg", // Product Name *
    "Paracetamol", // Generic Name
    "Panadol", // Brand
    "PARA500", // SKU
    "123456789012", // Barcode
    "Analgesics", // Category
    "Tablet", // Dosage Form
    "500mg", // Strength
    "Pack", // Unit
    12, // Pack Size
    "Ernest Chemist", // Manufacturer
    "Pain relief tablet", // Description
    "No", // Prescription Required
    10, // Reorder Level
    10, // Selling Price (GH\u20B5) *
    8.5, // Wholesale Price (GH\u20B5)
    100, // Initial Quantity
    "B001", // Batch Number
    7, // Cost Price (GH\u20B5)
    "01/05/2026", // Manufacturing Date
    "30/05/2028", // Expiry Date
    "Ernest Chemist Ltd", // Supplier
    "INV-2026-001", // Purchase Reference
    "Opening stock", // Stock Notes
  ]);
  const exampleSheet = XLSX.utils.aoa_to_sheet(example);
  exampleSheet["!cols"] = autosizeWidths(example, 16, 30);
  XLSX.utils.book_append_sheet(workbook, exampleSheet, "Example");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function templateFileName(): string {
  return TEMPLATE_FILE_NAME;
}

export interface ErrorReportEntry {
  rowNumber: number;
  productName: string | null;
  errorType: string;
  message: string;
}

/** Build a downloadable .xlsx report of the rows that could not be imported. */
export function buildErrorReportBuffer(entries: ErrorReportEntry[]): Buffer {
  const rows: unknown[][] = [["Row", "Product Name", "Error Type", "Error Message"]];
  for (const entry of entries) {
    rows.push([
      entry.rowNumber,
      entry.productName ?? "",
      entry.errorType,
      entry.message,
    ]);
  }

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [{ wch: 8 }, { wch: 40 }, { wch: 14 }, { wch: 110 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Import Errors");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function errorReportFileName(): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `Product-Import-Errors-${stamp}.xlsx`;
}
