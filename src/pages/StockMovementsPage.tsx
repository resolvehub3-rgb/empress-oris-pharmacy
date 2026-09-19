import React, { useState, useEffect } from "react";
import { History, ArrowDownLeft, ArrowUpRight, Filter, Search } from "lucide-react";
import { StockMovement } from "../types";
import { apiRequest } from "../lib/api";

export function StockMovementsPage() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState("");

  const fetchMovements = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ movements: any[] }>(
        `/api/stock/movements${selectedType ? `?movementType=${selectedType}` : ""}`
      );
      setMovements(res.movements || []);
    } catch (err) {
      console.warn("[Movements] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, [selectedType]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Stock Movements & Audit History
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete immutable ledger of all stock additions, POS sales deductions, and adjustments.
          </p>
        </div>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800"
        >
          <option value="">All Movement Types</option>
          <option value="INITIAL_STOCK">INITIAL_STOCK (Opening)</option>
          <option value="PURCHASE">PURCHASE (Restock)</option>
          <option value="SALE">SALE (POS Outflow)</option>
          <option value="ADJUSTMENT">ADJUSTMENT</option>
          <option value="REFUND">REFUND</option>
          <option value="DAMAGE">DAMAGE</option>
          <option value="EXPIRY">EXPIRY</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-xs font-bold">Querying stock ledger...</span>
          </div>
        ) : movements.length === 0 ? (
          <div className="p-16 text-center text-slate-400 space-y-2">
            <History className="w-12 h-12 mx-auto text-slate-300" />
            <h3 className="text-sm font-bold text-slate-700">No stock movements recorded</h3>
            <p className="text-xs text-slate-400">Add opening stock or make sales to populate the ledger.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3">Product Name</th>
                  <th className="px-5 py-3">Batch</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3 text-center">Qty Change</th>
                  <th className="px-5 py-3 text-center">Prev &rarr; New</th>
                  <th className="px-5 py-3">Reference / Reason</th>
                  <th className="px-5 py-3">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {movements.map((m: any) => {
                  const isPositive = m.quantity_change > 0;
                  return (
                    <tr key={m.id} className="hover:bg-slate-50 transition">
                      <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                        {new Date(m.created_at).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-5 py-3.5 font-bold text-slate-900">{m.product_name}</td>
                      <td className="px-5 py-3.5 font-mono text-slate-700">{m.batch_number}</td>
                      <td className="px-5 py-3.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                          {m.movement_type}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center font-black">
                        <span
                          className={`inline-flex items-center space-x-1 ${
                            isPositive ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {isPositive ? (
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {isPositive ? `+${m.quantity_change}` : m.quantity_change}
                          </span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center text-slate-500 font-mono">
                        {m.previous_quantity} &rarr;{" "}
                        <strong className="text-slate-900">{m.new_quantity}</strong>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 max-w-xs truncate">
                        {m.reference_id && <span className="font-mono text-[11px] mr-1">[{m.reference_id}]</span>}
                        {m.reason || "System operation"}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-800">{m.user_name || "System"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
