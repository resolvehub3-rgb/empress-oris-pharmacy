import React, { useState, useEffect } from "react";
import { Clock, CheckCircle2, AlertCircle, DollarSign, Calculator, XCircle } from "lucide-react";
import { apiRequest } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { subscribeToPharmacyRealtime } from "../lib/supabaseClient";

interface ShiftsPageProps {
  onOpenShiftClick: () => void;
  onCloseShiftClick: () => void;
  hasOpenShift: boolean;
}

export function ShiftsPage({ onOpenShiftClick, onCloseShiftClick, hasOpenShift }: ShiftsPageProps) {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchShifts = async () => {
    try {
      const res = await apiRequest<{ shifts: any[] }>("/api/shifts/history");
      setShifts(res.shifts || []);
    } catch (err) {
      console.warn("[ShiftsPage] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShifts();
    const unsubscribe = subscribeToPharmacyRealtime((event) => {
      if (event === "SHIFT_UPDATED" || event === "EMPLOYEE_DELETED") {
        fetchShifts();
      }
    });
    return () => { unsubscribe(); };
  }, []);

  const handleForceClose = async (shiftId: string) => {
    if (!confirm("Force close this shift? The cashier did not close it themselves.")) return;
    try {
      await apiRequest("/api/shifts/close", {
        method: "POST",
        body: JSON.stringify({ actualCash: 0, shiftId, notes: "Force closed by owner" }),
      });
      fetchShifts();
    } catch (err: any) {
      alert("Failed to close shift: " + err.message);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Cashier Shift & Drawer Registers
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track opening float, recorded POS sales, physical cash reconciliation, and overages/shortages.
          </p>
        </div>

        <div>
          {hasOpenShift ? (
            <button
              onClick={onCloseShiftClick}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-2"
            >
              <Clock className="w-4 h-4" />
              <span>Close Active Shift & Reconcile</span>
            </button>
          ) : (
            <button
              onClick={onOpenShiftClick}
              className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-2"
            >
              <Clock className="w-4 h-4" />
              <span>Open New Cashier Shift</span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-xs font-bold">Querying shifts from Supabase...</span>
          </div>
        ) : shifts.length === 0 ? (
          <div className="p-16 text-center text-slate-400 space-y-2">
            <Clock className="w-12 h-12 mx-auto text-slate-300" />
            <h3 className="text-sm font-bold text-slate-700">No shift records found</h3>
            <p className="text-xs text-slate-400">Open a shift when beginning cashier operations.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3">Cashier</th>
                  <th className="px-5 py-3">Start Time</th>
                  <th className="px-5 py-3">End Time</th>
                  <th className="px-5 py-3 text-right">Opening Float</th>
                  <th className="px-5 py-3 text-right">Cash Sales</th>
                  <th className="px-5 py-3 text-right">Expected Drawer</th>
                  <th className="px-5 py-3 text-right">Counted Cash</th>
                  <th className="px-5 py-3 text-center">Variance</th>
                  <th className="px-5 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {shifts.map((s: any) => {
                  const variance = s.discrepancy !== null ? parseFloat(s.discrepancy) : null;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50 transition">
                      <td className="px-5 py-3.5 font-bold text-slate-900">{s.user_name}</td>
                      <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                        {new Date(s.start_time).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                        {s.end_time
                          ? new Date(s.end_time).toLocaleString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "In Progress"}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono">
                        GH₵ {parseFloat(s.opening_cash || "0").toFixed(2)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono">
                        GH₵ {parseFloat(s.total_cash_sales || "0").toFixed(2)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-semibold text-slate-900">
                        GH₵ {parseFloat(s.expected_cash || s.opening_cash || "0").toFixed(2)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-900">
                        {s.actual_cash !== null ? `GH₵ ${parseFloat(s.actual_cash).toFixed(2)}` : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-center font-bold">
                        {variance !== null ? (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] ${
                              Math.abs(variance) < 0.01
                                ? "bg-emerald-100 text-emerald-800"
                                : variance > 0
                                ? "bg-blue-100 text-blue-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {variance === 0
                              ? "MATCH"
                              : variance > 0
                              ? `+GH₵ ${variance.toFixed(2)}`
                              : `-GH₵ ${Math.abs(variance).toFixed(2)}`}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            s.status === "OPEN"
                              ? "bg-emerald-100 text-emerald-800 animate-pulse"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {s.status}
                        </span>
                        {s.status === "OPEN" && (user?.role === "OWNER" || user?.role === "ADMIN") && (
                          <button
                            onClick={() => handleForceClose(s.id)}
                            className="ml-2 px-2 py-0.5 bg-rose-100 hover:bg-rose-200 text-rose-700 text-[10px] font-bold rounded transition inline-flex items-center space-x-0.5"
                            title="Force close this shift"
                          >
                            <XCircle className="w-3 h-3" />
                            <span>Close</span>
                          </button>
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
