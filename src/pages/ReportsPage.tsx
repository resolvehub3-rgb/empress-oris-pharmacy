import React, { useState, useEffect } from "react";
import { BarChart3, TrendingUp, DollarSign, Printer, Calendar, Package, ArrowUpRight } from "lucide-react";
import { apiRequest } from "../lib/api";

export function ReportsPage() {
  const [report, setReport] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("30");

  const fetchReports = async () => {
    setLoading(true);
    try {
      const endDate = new Date().toISOString().split("T")[0];
      const startDate = new Date(Date.now() - parseInt(dateRange) * 86400000).toISOString().split("T")[0];
      const res = await apiRequest<any>(`/api/reports/sales-summary?startDate=${startDate}&endDate=${endDate}`);
      setReport(res);
    } catch (err) {
      console.warn("[Reports] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [dateRange]);

  const handlePrint = () => {
    window.print();
  };

  const revenue = parseFloat(report?.totals?.revenue || 0);
  const cogs = parseFloat(report?.totals?.cogs || 0);
  const grossProfit = parseFloat(report?.totals?.gross_profit || revenue - cogs);
  const margin = revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : "0.0";

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto print:p-0 print:m-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs print:border-none print:shadow-none">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Financial & Profitability Reports
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time COGS accounting, gross margins, and payment method audit in Ghana Cedis.
          </p>
        </div>

        <div className="flex items-center space-x-2 print:hidden">
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-2"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Financial Report</span>
          </button>
        </div>
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Gross Revenue</span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            GH₵ {revenue.toFixed(2)}
          </div>
          <span className="text-[11px] text-slate-400">Total recorded sales</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Cost of Goods Sold (COGS)</span>
          <div className="text-2xl font-black text-slate-700 mt-1">
            GH₵ {cogs.toFixed(2)}
          </div>
          <span className="text-[11px] text-slate-400">Acquisition cost of dispensed batches</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Gross Profit</span>
          <div className="text-2xl font-black text-teal-800 mt-1">
            GH₵ {grossProfit.toFixed(2)}
          </div>
          <span className="text-[11px] text-emerald-600 font-bold">Revenue minus COGS</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Profit Margin</span>
          <div className="text-2xl font-black text-indigo-900 mt-1">
            {margin}%
          </div>
          <span className="text-[11px] text-slate-400">Gross profit ratio</span>
        </div>
      </div>

      {/* Payment Methods Breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          Payment Method Breakdown
        </h3>

        {!report?.paymentMethods || report.paymentMethods.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No payment transactions recorded yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {report.paymentMethods.map((pm: any, idx: number) => (
              <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-xs font-bold text-slate-600 uppercase">
                  {(pm.payment_method || "CASH").replace("_", " ")}
                </span>
                <div className="text-lg font-black text-slate-900 font-mono">
                  GH₵ {parseFloat(pm.total || 0).toFixed(2)}
                </div>
                <p className="text-[11px] text-slate-400">{pm.count} transactions</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Fast-Moving Products */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Top Dispensed Medicines</h3>
          <p className="text-xs text-slate-500">Highest volume medicines sold at POS</p>
        </div>

        {!report?.topProducts || report.topProducts.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Package className="w-8 h-8 mx-auto text-slate-300 mb-1" />
            <p className="text-xs font-semibold">No product sales recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3">Medicine</th>
                  <th className="px-5 py-3 text-center">Units Dispensed</th>
                  <th className="px-5 py-3 text-right">Revenue Generated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {report.topProducts.map((p: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-5 py-3.5 font-bold text-slate-900">{p.name}</td>
                    <td className="px-5 py-3.5 text-center font-bold">{p.total_qty} units</td>
                    <td className="px-5 py-3.5 text-right font-black font-mono text-slate-900">
                      GH₵ {parseFloat(p.total_sales || 0).toFixed(2)}
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
