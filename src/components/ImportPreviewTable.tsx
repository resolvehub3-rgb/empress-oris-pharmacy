import React from "react";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { ImportPreviewRow, ImportRowStatus } from "../types";

const STATUS_STYLES: Record<ImportRowStatus, { label: string; className: string }> = {
  READY: { label: "Ready", className: "bg-emerald-100 text-emerald-800" },
  DUPLICATE: { label: "Duplicate", className: "bg-amber-100 text-amber-800" },
  INVALID: { label: "Invalid", className: "bg-rose-100 text-rose-800" },
};

interface ImportPreviewTableProps {
  rows: ImportPreviewRow[];
  maxRows?: number;
}

/** Filterable preview grid: every row's status and exact issues before import. */
export function ImportPreviewTable({ rows, maxRows = 500 }: ImportPreviewTableProps) {
  const visible = rows.slice(0, maxRows);

  if (rows.length === 0) {
    return (
      <p className="p-6 text-center text-xs text-slate-400 italic">
        No rows match this filter.
      </p>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-100">
            <tr>
              <th className="px-4 py-3 w-14">Row</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">SKU / Barcode</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-center">Initial Stock</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3">Issues & Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {visible.map((row) => {
              const style = STATUS_STYLES[row.status];
              return (
                <tr key={row.rowNumber} className="hover:bg-slate-50 align-top">
                  <td className="px-4 py-3 font-mono font-bold text-slate-500">{row.rowNumber}</td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-slate-900">{row.name || "-"}</span>
                    {row.categoryName && (
                      <span className="block text-[11px] text-slate-500">{row.categoryName}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px]">
                    <div className="font-bold text-slate-800">{row.sku || "-"}</div>
                    {row.barcode && <div className="text-slate-500">{row.barcode}</div>}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900 whitespace-nowrap">
                    {row.sellingPrice !== null ? `GH\u20B5 ${row.sellingPrice.toFixed(2)}` : "-"}
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    {row.hasStock ? (
                      <div>
                        <span className="font-bold text-slate-900">{row.initialQuantity}</span> units
                        {row.batchNumber && (
                          <span className="block text-[11px] text-slate-500 font-mono">
                            {row.batchNumber}
                            {row.expiryDate ? ` \u00B7 exp ${row.expiryDate}` : ""}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400">No stock</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black whitespace-nowrap ${style.className}`}
                    >
                      {style.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 space-y-1 min-w-[240px]">
                    {row.errors.map((error, index) => (
                      <div key={`e-${index}`} className="flex items-start space-x-1.5 text-[11px] text-rose-700">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </div>
                    ))}
                    {row.warnings.map((warning, index) => (
                      <div key={`w-${index}`} className="flex items-start space-x-1.5 text-[11px] text-amber-700">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{warning}</span>
                      </div>
                    ))}
                    {row.notes.map((note, index) => (
                      <div key={`n-${index}`} className="flex items-start space-x-1.5 text-[11px] text-slate-500">
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{note}</span>
                      </div>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length > visible.length && (
        <p className="px-4 py-3 text-[11px] text-slate-500 bg-slate-50 border-t border-slate-100">
          Showing the first {visible.length} of {rows.length} rows (all {rows.length} rows were validated -
          the counts above and the import include every row).
        </p>
      )}
    </div>
  );
}
