/**
 * Canonical Excel column definitions for the Product Import feature.
 *
 * Uploaded workbook headers are normalized (trimmed, lower-cased, stripped of
 * punctuation/parentheticals) before matching, so "Product Name", "product name",
 * "PRODUCT NAME", "ProductName" and "Selling Price (GH\u20B5)" all resolve to the
 * same field. Completely unrelated columns are never silently mapped.
 */

export type FieldKey =
  | "name"
  | "genericName"
  | "brandName"
  | "sku"
  | "barcode"
  | "category"
  | "dosageForm"
  | "strength"
  | "unit"
  | "packSize"
  | "manufacturer"
  | "description"
  | "prescriptionRequired"
  | "reorderLevel"
  | "sellingPrice"
  | "wholesalePrice"
  | "initialQuantity"
  | "batchNumber"
  | "costPrice"
  | "manufacturingDate"
  | "expiryDate"
  | "supplier"
  | "purchaseReference"
  | "stockNotes";

export interface ColumnDef {
  key: FieldKey;
  /** Header written into the downloadable Excel template. */
  label: string;
  required: boolean;
  kind: "text" | "price" | "integer" | "boolean" | "date";
  /** Help text shown on the template Instructions sheet. */
  hint: string;
  /** Additional tolerated header spellings (normalized before lookup). */
  aliases: string[];
}

export const COLUMNS: ColumnDef[] = [
  {
    key: "name",
    label: "Product Name",
    required: true,
    kind: "text",
    hint: "Required. Name of the product as it appears in the POS (e.g. Paracetamol 500mg).",
    aliases: ["name", "itemname", "drugname", "product", "producttitle", "medicine", "medicinename"],
  },
  {
    key: "genericName",
    label: "Generic Name",
    required: false,
    kind: "text",
    hint: "Chemical/generic name (e.g. Paracetamol, Amoxicillin).",
    aliases: ["generic", "genericname", "chemicalname", "genericdrugname", "inn"],
  },
  {
    key: "brandName",
    label: "Brand",
    required: false,
    kind: "text",
    hint: "Brand or trade name (e.g. Panadol, Emzor).",
    aliases: ["brand", "brandname", "tradename", "brandtradename"],
  },
  {
    key: "sku",
    label: "SKU",
    required: false,
    kind: "text",
    hint: "Stock keeping unit. Leave blank and a unique SKU is generated automatically. Must be unique.",
    aliases: ["sku", "skucode", "itemcode", "productcode", "stockcode", "reference"],
  },
  {
    key: "barcode",
    label: "Barcode",
    required: false,
    kind: "text",
    hint: "UPC/EAN barcode. Must be unique when supplied.",
    aliases: ["barcode", "barcodes", "upc", "ean", "gtin", "upccode", "eancode"],
  },
  {
    key: "category",
    label: "Category",
    required: false,
    kind: "text",
    hint: "Existing category name, or a new one - new categories are created automatically.",
    aliases: ["category", "categoryname", "productcategory", "drugcategory", "therapeuticcategory"],
  },
  {
    key: "dosageForm",
    label: "Dosage Form",
    required: false,
    kind: "text",
    hint: "Tablet, Capsule, Syrup, Suspension, Injection, Ointment, Drops, Inhaler, etc.",
    aliases: ["dosageform", "form", "pharmaceuticalform", "dosageformtype", "formulation"],
  },
  {
    key: "strength",
    label: "Strength",
    required: false,
    kind: "text",
    hint: "e.g. 500mg, 10mg/5ml.",
    aliases: ["strength", "potency", "strengthvolume", "dosage"],
  },
  {
    key: "unit",
    label: "Unit",
    required: false,
    kind: "text",
    hint: "Unit of measure: Pack, Box, Bottle, Blister, Sachet (default Pack).",
    aliases: ["unit", "unitofmeasure", "uom", "baseunit", "unittype"],
  },
  {
    key: "packSize",
    label: "Pack Size",
    required: false,
    kind: "integer",
    hint: "Pieces per pack (whole number >= 1, default 1).",
    aliases: ["packsize", "packsizepcs", "packquantity", "piecesperpack", "packpcs"],
  },
  {
    key: "manufacturer",
    label: "Manufacturer",
    required: false,
    kind: "text",
    hint: "Manufacturer (e.g. Ernest Chemist, Tobinco, GSK).",
    aliases: ["manufacturer", "maker", "manufacturedby", "producer", "company"],
  },
  {
    key: "description",
    label: "Description",
    required: false,
    kind: "text",
    hint: "Free-text product description.",
    aliases: ["description", "productdescription", "details", "remarks"],
  },
  {
    key: "prescriptionRequired",
    label: "Prescription Required",
    required: false,
    kind: "boolean",
    hint: "Yes / No / TRUE / FALSE / 1 / 0 (default No).",
    aliases: ["prescriptionrequired", "rxrequired", "prescription", "rx", "prescriptionneeded", "pom"],
  },
  {
    key: "reorderLevel",
    label: "Reorder Level",
    required: false,
    kind: "integer",
    hint: "Low-stock alert threshold (whole number >= 0, default 10).",
    aliases: ["reorderlevel", "reorderpoint", "minimumstock", "minstock", "lowstocklevel", "reorderqty"],
  },
  {
    key: "sellingPrice",
    label: "Selling Price (GH\u20B5)",
    required: true,
    kind: "price",
    hint: "Required. Retail selling price in Ghana Cedis as a plain number (e.g. 10.50).",
    aliases: ["sellingprice", "price", "retailprice", "saleprice", "sellingpriceghs", "sellingpricegh", "unitretailprice"],
  },
  {
    key: "wholesalePrice",
    label: "Wholesale Price (GH\u20B5)",
    required: false,
    kind: "price",
    hint: "Optional wholesale price in Ghana Cedis as a plain number.",
    aliases: ["wholesaleprice", "wholesale", "bulkprice", "priceswholesale"],
  },
  {
    key: "initialQuantity",
    label: "Initial Quantity",
    required: false,
    kind: "integer",
    hint: "Opening stock units (whole number >= 0). Blank or 0 = product imported without stock.",
    aliases: ["initialquantity", "quantity", "qty", "openingstock", "initialstock", "stockquantity", "stockqty", "units"],
  },
  {
    key: "batchNumber",
    label: "Batch Number",
    required: false,
    kind: "text",
    hint: "Required when Initial Quantity > 0 (pharmaceutical batch / lot).",
    aliases: ["batchnumber", "batch", "batchno", "lotnumber", "lotno", "lot"],
  },
  {
    key: "costPrice",
    label: "Cost Price (GH\u20B5)",
    required: false,
    kind: "price",
    hint: "Unit cost price in Ghana Cedis (used for COGS / profit reporting).",
    aliases: ["costprice", "unitcost", "cost", "purchaseprice", "buyprice", "pricecost"],
  },
  {
    key: "manufacturingDate",
    label: "Manufacturing Date",
    required: false,
    kind: "date",
    hint: "Date produced (DD/MM/YYYY or YYYY-MM-DD). Optional.",
    aliases: ["manufacturingdate", "manufactureddate", "mfgdate", "productiondate", "dateofmanufacture"],
  },
  {
    key: "expiryDate",
    label: "Expiry Date",
    required: false,
    kind: "date",
    hint: "Required when Initial Quantity > 0. Used for FEFO (DD/MM/YYYY or YYYY-MM-DD).",
    aliases: ["expirydate", "expiry", "expirationdate", "expdate", "dateofexpiry", "expireson"],
  },
  {
    key: "supplier",
    label: "Supplier",
    required: false,
    kind: "text",
    hint: "Existing supplier name. If not found the batch is imported without a supplier link.",
    aliases: ["supplier", "suppliername", "vendor", "distributor", "wholesaler"],
  },
  {
    key: "purchaseReference",
    label: "Purchase Reference",
    required: false,
    kind: "text",
    hint: "Invoice / PO reference recorded on the stock movement.",
    aliases: ["purchasereference", "purchaseref", "reference", "referenceno", "invoice", "invoiceno", "invoicenumber", "ponumber", "purchaseorder"],
  },
  {
    key: "stockNotes",
    label: "Stock Notes",
    required: false,
    kind: "text",
    hint: "Notes stored on the imported batch.",
    aliases: ["stocknotes", "batchnotes", "stocknote", "inventorynotes", "notes"],
  },
];

export const REQUIRED_COLUMN_KEYS: FieldKey[] = COLUMNS.filter((c) => c.required).map((c) => c.key);

const HEADER_LOOKUP: Map<string, FieldKey> = (() => {
  const map = new Map<string, FieldKey>();
  for (const col of COLUMNS) {
    const keys = [col.label, ...col.aliases];
    for (const key of keys) {
      const normalized = normalizeHeader(key);
      if (normalized && !map.has(normalized)) map.set(normalized, col.key);
    }
  }
  return map;
})();

/**
 * Normalize a header label for matching:
 * - remove parenthetical/bracketed suffixes ("Selling Price (GH\u20B5)" -> "Selling Price")
 * - remove leading/trailing markers ("*" / "#" / ":")
 * - lower-case and strip every non-alphanumeric character ("ProductName" -> "productname")
 */
export function normalizeHeader(raw: unknown): string {
  return String(raw ?? "")
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(/^[\s*#:]+|[\s*#:]+$/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Resolve a single raw header cell to a canonical field, or null when unrelated. */
export function resolveHeader(raw: unknown): FieldKey | null {
  return HEADER_LOOKUP.get(normalizeHeader(raw)) ?? null;
}

export interface HeaderMappingResult {
  /** Column index (0-based within the row) -> canonical field. */
  columnIndexToKey: Map<number, FieldKey>;
  /** Original labels that did not match any known field (reported, never guessed). */
  unmappedLabels: string[];
  /** Canonical fields that appeared more than once (first occurrence wins). */
  duplicatedFields: string[];
  /** Required fields that were not present in the header row. */
  missingRequired: FieldKey[];
  /** Number of recognized, distinct fields (used for header-row detection). */
  recognizedCount: number;
}

/** Map a raw header row onto canonical fields. */
export function mapHeaderRow(cells: unknown[]): HeaderMappingResult {
  const columnIndexToKey = new Map<number, FieldKey>();
  const unmappedLabels: string[] = [];
  const seenFields = new Set<FieldKey>();
  const duplicatedFields: FieldKey[] = [];

  cells.forEach((cell, index) => {
    const label = String(cell ?? "").trim();
    if (!label) return;
    const field = resolveHeader(label);
    if (!field) {
      unmappedLabels.push(label);
      return;
    }
    if (seenFields.has(field)) {
      if (!duplicatedFields.includes(field)) duplicatedFields.push(field);
      return; // first occurrence wins
    }
    seenFields.add(field);
    columnIndexToKey.set(index, field);
  });

  const missingRequired = REQUIRED_COLUMN_KEYS.filter((key) => !seenFields.has(key));

  return {
    columnIndexToKey,
    unmappedLabels,
    duplicatedFields,
    missingRequired,
    recognizedCount: seenFields.size,
  };
}

/** Display label for a canonical field (used in error messages). */
export function fieldLabel(key: FieldKey): string {
  return COLUMNS.find((c) => c.key === key)?.label ?? key;
}
