import assert from "node:assert/strict";
import { toPrice, parsePrice, extractPriceUnit } from "../src/server/import/values";
import { resolveHeader, normalizeHeader, mapHeaderRow } from "../src/server/import/columns";

function price(input: any, expected: number | null) {
  const r = toPrice(input, "Price", { required: false }) as any;
  assert.equal(r.ok, true, `expected ok for ${JSON.stringify(input)}: ${r.reason}`);
  assert.equal(r.value, expected, `value mismatch for ${JSON.stringify(input)}`);
}

price("GH₵54.00", 54);
price("₵54.00", 54);
price("GHS 54.00", 54);
price("54.00", 54);
price("1,250.00", 1250);
price("  10.5  ", 10.5);
price("2.00 PerTab", 2);
price("14/1 bottle", 14);
price("10.00/pack", 10);
price("2.00/strip", 2);
price("10 PER 1", 10);
price("50PESEWAS", 0.5);
price(null, null);

const bad = toPrice("abc", "Price", { required: false }) as any;
assert.equal(bad.ok, false);
const req = toPrice("", "Price", { required: true }) as any;
assert.equal(req.ok, false);

// unit extraction
assert.equal(extractPriceUnit("2.00 PerTab"), "tablet");
assert.equal(extractPriceUnit("50PESEWAS"), "pesewa");

// headers
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

const mapping = mapHeaderRow(["ITEM NAME", "QUANTITY", "BUYING PRICE", "SELLING PRICE"]);
console.log("recognized:", mapping.recognizedCount, "missing:", mapping.missingRequired);
assert.equal(mapping.recognizedCount, 4);
assert.deepEqual(mapping.missingRequired, []);

import * as XLSX from "xlsx";
import { parseProductWorkbook } from "../src/server/import/excel";
import { validateWorkbookRows } from "../src/server/import/validation";

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([
  ["ITEM NAME", "QUANTITY", "BUYING PRICE", "SELLING PRICE"],
  ["Paracetamol 500mg", 100, "GH₵5.00", "GH₵10.00"],
  ["Amoxicillin", 50, "2.00 PerTab", "14/1 bottle"],
  ["NoPrice", 10, "1.00", ""],
  ["", 5, "1.00", "2.00"],
]);
XLSX.utils.book_append_sheet(wb, ws, "Products");
const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
const file = { buffer: Buffer.from(buf), originalName: "test.xlsx", mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: buf.length };
const parsed = parseProductWorkbook(file as any);
const ref = { categories: new Map(), suppliers: new Map(), existingSkus: new Map(), existingBarcodes: new Map(), existingNames: new Map() };
const result = validateWorkbookRows(parsed, ref as any);
console.log("total", result.summary.totalRows, "ready", result.summary.readyCount, "invalid", result.summary.invalidCount, "dup", result.summary.duplicateCount, "withStock", result.summary.withStockCount);
for (const r of result.rows) {
  console.log(r.rowNumber, r.status, r.name, "qty", r.initialQuantity, "cost", r.costPrice, "sell", r.sellingPrice, r.errors, r.warnings, r.notes);
}
assert.equal(result.summary.totalRows, 4);
assert.equal(result.rows[0].status, "INVALID"); // missing batch/expiry for stock
assert.equal(result.rows[0].initialQuantity, 100);
assert.equal(result.rows[1].costPrice, 2);
assert.equal(result.rows[1].sellingPrice, 14);

console.log("ALL TESTS PASSED");
