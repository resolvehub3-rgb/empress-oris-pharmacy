import React, { useState, useEffect } from "react";
import { CalendarDays, AlertTriangle, AlertCircle, Search, Filter, ShieldCheck } from "lucide-react";
import { Batch } from "../types";
import { apiRequest } from "../lib/api";

export function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "expiring_soon" | "expired">("all");

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ batches: any[] }>(`/api/stock/batches?filter=${filter}`);
      setBatches(res.batches || []);
    } catch (err) {
      console.warn("[BatchesPage] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, [filter]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Batches & Expiry Management (FEFO)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time batch tracking enforcing First-Expired-First-Out dispensing across all POS terminals.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          {[
            { id: "all", label: "All Batches" },
            { id: "active", label: "Active Non-Expired" },
            { id: "expiring_soon", label: "Expiring Soon (<90d)" },
            { id: "expired", label: "Expired" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id as any)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                filter === item.id
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Batches Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-xs font-bold">Querying Supabase batches...</span>
          </div>
        ) : batches.length === 0 ? (
          <div className="p-16 text-center text-slate-400 space-y-2">
            <CalendarDays className="w-12 h-12 mx-auto text-slate-300" />
            <h3 className="text-sm font-bold text-slate-700">No batches match this filter</h3>
            <p className="text-xs text-slate-400">Add products with opening stock to see batch records.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3">Batch Number</th>
                  <th className="px-5 py-3">Product Name</th>
                  <th className="px-5 py-3">Supplier</th>
                  <th className="px-5 py-3 text-center">Remaining / Initial</th>
                  <th className="px-5 py-3 text-right">Cost Price</th>
                  <th className="px-5 py-3 text-right">Selling Price</th>
                  <th className="px-5 py-3 font-mono">Expiry Date</th>
                  <th className="px-5 py-3 text-center">FEFO Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {batches.map((b: any) => {
                  const days = b.days_until_expiry;
                  const isExpired = b.is_expired;
                  const isExpSoon = b.is_expiring_soon;

                  return (
                    <tr key={b.id} className="hover:bg-slate-50 transition">
                      <td className="px-5 py-3.5 font-mono font-bold text-slate-900">
                        {b.batch_number}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-900">{b.product_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">SKU: {b.product_sku}</div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {b.supplier_name || "Direct / Opening Stock"}
                      </td>
                      <td className="px-5 py-3.5 text-center font-bold">
                        <span className="text-slate-900">{b.current_quantity}</span>
                        <span className="text-slate-400 font-normal"> / {b.initial_quantity}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono">
                        GH₵ {parseFloat(b.cost_price || "0").toFixed(2)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-900">
                        GH₵ {parseFloat(b.selling_price || "0").toFixed(2)}
                      </td>
                      <td className="px-5 py-3.5 font-mono">
                        {new Date(b.expiry_date).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {isExpired ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">
                            EXPIRED
                          </span>
                        ) : isExpSoon ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                            {days}d Remaining
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                            GOOD ({days}d)
                          </span>
                        )}
                      </td>
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
