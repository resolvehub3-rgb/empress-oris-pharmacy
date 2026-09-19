import React, { useState, useEffect } from "react";
import { FileSpreadsheet, Plus, CheckCircle, Clock, Truck } from "lucide-react";
import { PurchaseOrder } from "../types";
import { apiRequest } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export function PurchasesPage() {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ purchases: any[] }>("/api/purchases");
      setPurchases(res.purchases || []);
    } catch (err) {
      console.warn(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, []);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Purchase Orders & Stock Inflow
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Supplier procurement, invoice reconciliation, and batch inventory intake.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-xs font-bold">Querying purchase orders...</span>
          </div>
        ) : purchases.length === 0 ? (
          <div className="p-16 text-center text-slate-400 space-y-2">
            <FileSpreadsheet className="w-12 h-12 mx-auto text-slate-300" />
            <h3 className="text-sm font-bold text-slate-700">No purchase orders recorded</h3>
            <p className="text-xs text-slate-400">Restock inventory using the "Add Stock" workflow or create purchase invoices.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3">PO Number</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Supplier</th>
                  <th className="px-5 py-3">Invoice Ref</th>
                  <th className="px-5 py-3 text-right">Total Amount (GH₵)</th>
                  <th className="px-5 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {purchases.map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-900">{p.po_number || p.poNumber}</td>
                    <td className="px-5 py-3.5 text-slate-500">
                      {new Date(p.created_at || p.createdAt).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-800">{p.supplier_name}</td>
                    <td className="px-5 py-3.5 font-mono text-slate-600">{p.invoice_number || "—"}</td>
                    <td className="px-5 py-3.5 text-right font-black font-mono text-slate-900">
                      GH₵ {parseFloat(p.total_amount || p.totalAmount || "0").toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
