import fs from "node:fs";
import * as XLSX from "xlsx";
const buf = fs.readFileSync("D:/Product-Import-Errors-2026-11-07 (2).xlsx");
const wb = XLSX.read(buf, { type: "buffer" });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[];
console.log("rows:", rows.length);
for (let i = 1; i < rows.length; i++) console.log(JSON.stringify(rows[i]));
process.exit(0);
