import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { toPrice, parsePrice, extractPriceUnit } from "../src/server/import/values";
import { resolveHeader, normalizeHeader, mapHeaderRow } from "../src/server/import/columns";
import { parseProductWorkbook } from "../src/server/import/excel";
import { validateWorkbookRows } from "../src/server/import/validation";

function price(input: any, expected: number | null) {
  const r = toPrice(input, "Price", { required: false }) as any;
  assert.equal(r.ok, true, `expected ok for ${JSON.stringify(input)}: ${r.reason}`);
  assert.equal(r.value, expected, `value mismatch for ${JSON.stringify(input)}`);
}

// Currency parsing
price("GH₵54.00", 54);
price("₵54.00", 54);
price("GHS 54.00", 54);
price("54.00", 54);
price("1,250.00", 1250);
price("  10.5  ", 10.5);
price("50PESEWAS", 0.5);
price(null, null);

// Unit-based price parsing
price("2.00 PerTab", 2);
price("14/1 bottle", 14);
price("10.00/pack", 10);
price("2.00/strip", 2);
price("10 PER 1", 10);
price("20.00/STRIP", 20);

const bad = toPrice("abc", "Price", { required: false }) as any;
assert.equal(bad.ok, false);
const req = toPrice("", "Price", { required: true }) as any;
assert.equal(req.ok, false);

// Unit extraction
assert.equal(extractPriceUnit("2.00 PerTab"), "tablet");
assert.equal(extractPriceUnit("50PESEWAS"), "pesewa");
assert.equal(extractPriceUnit("14/1 bottle"), "bottle");

// Header mapping
assert.equal(resolveHeader("ITEM NAME"), "name");
assert.equal(resolveHeader("QUANTITY"), "initialQuantity");
assert.equal(resolveHeader("BUYING PRICE"), "costPrice");
assert.equal(resolveHeader("SELLING PRICE"), "sellingPrice");
assert.equal(resolveHeader("OPENING STOCK"), "initialQuantity");
assert.equal(resolveHeader("COST PRICE"), "costPrice");
assert.equal(resolveHeader("SELL PRICE"), "sellingPrice");
assert.equal(resolveHeader("PRICE"), "sellingPrice");
assert.equal(resolveHeader("BATCH NO"), "batchNumber");
assert.equal(resolveHeader("EXPIRY DATE"), "expiryDate");
assert.equal(resolveHeader("CATEGORY"), "category");
assert.equal(resolveHeader("ITEM"), "name");
assert.equal(resolveHeader("PRODUCT"), "name");
assert.equal(resolveHeader("QTY"), "initialQuantity");
assert.equal(resolveHeader("STOCK"), "initialQuantity");
assert.equal(resolveHeader("PURCHASE PRICE"), "costPrice");
assert.equal(resolveHeader("RETAIL PRICE"), "sellingPrice");
assert.equal(resolveHeader("BAR CODE"), "barcode");
assert.equal(resolveHeader("PRODUCT CODE"), "sku");
assert.equal(resolveHeader("BATCH NUMBER"), "batchNumber");
assert.equal(resolveHeader("EXPIRATION DATE"), "expiryDate");
assert.equal(resolveHeader("PRODUCT CATEGORY"), "category");

const mapping = mapHeaderRow(["ITEM NAME", "QUANTITY", "BUYING PRICE", "SELLING PRICE"]);
assert.equal(mapping.recognizedCount, 4);
assert.deepEqual(mapping.missingRequired, []);

// Workbook parsing + validation with the real four-column structure
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([
  ["ITEM NAME", "QUANTITY", "BUYING PRICE", "SELLING PRICE"],
  ["ALPHA GARLIC CAPS", 3, "GH₵54.00", "GH₵65.00"],
  ["LIV CAPS", 1, "GH₵89.64", "GH₵110.00"],
  ["PILEX TABS", 2, "GH₵69.12", "GH₵85.00"],
  ["YAZZ LINER", "", "GH₵11.00", "GH₵15.00"],
  ["POLAR ICE", 5, "", "GH₵50.00"],
  ["MR Q.", 1, "GH₵90.00", "14/1 bottle"],
]);
XLSX.utils.book_append_sheet(wb, ws, "Products");
const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
const file = { buffer: Buffer.from(buf), originalName: "test.xlsx", mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: buf.length };
const parsed = parseProductWorkbook(file as any);
const ref = { categories: new Map(), suppliers: new Map(), existingSkus: new Map(), existingBarcodes: new Map(), existingNames: new Map() };
const result = validateWorkbookRows(parsed, ref as any);

assert.equal(result.summary.totalRows, 6);
// Missing quantity is flagged, not converted silently
const yazz = result.rows.find((r) => r.name === "YAZZ LINER")!;
assert.equal(yazz.initialQuantity, 0);
assert.ok(yazz.warnings.some((w) => /Initial Quantity is missing/i.test(w)));
// Missing cost price is allowed with a warning
const polar = result.rows.find((r) => r.name === "POLAR ICE")!;
assert.equal(polar.costPrice, null);
assert.ok(polar.warnings.some((w) => /Cost Price/i.test(w)));
// Unit price extraction
const mrq = result.rows.find((r) => r.name === "MR Q.")!;
assert.equal(mrq.sellingPrice, 14);
// Cost/selling prices parsed from currency
const alpha = result.rows.find((r) => r.name === "ALPHA GARLIC CAPS")!;
assert.equal(alpha.costPrice, 54);
assert.equal(alpha.sellingPrice, 65);
assert.equal(alpha.initialQuantity, 3);

console.log("ALL TESTS PASSED");
