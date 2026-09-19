import React, { useState, useEffect } from "react";
import {
  DollarSign,
  TrendingUp,
  Package,
  Boxes,
  AlertTriangle,
  CalendarDays,
  ShoppingCart,
  Users,
  Clock,
  ArrowUpRight,
  Plus,
  Receipt,
  FileSpreadsheet,
  CheckCircle2,
  Monitor,
  Download,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { DashboardData, Sale, Product } from "../types";
import { apiRequest } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { subscribeToPharmacyRealtime } from "../lib/supabaseClient";
import { LowStockAlertBanner } from "../components/LowStockAlertBanner";
import { InstallAppModal } from "../components/InstallAppModal";
import { usePWAInstall } from "../hooks/usePWAInstall";

interface DashboardPageProps {
  onNavigate: (tab: any) => void;
  onAddProductClick: () => void;
  onAddStockClick: (product?: Product) => void;
  onSelectSaleForReceipt?: (sale: Sale) => void;
  lowStockCount?: number;
}

export function DashboardPage({
  onNavigate,
  onAddProductClick,
  onAddStockClick,
  onSelectSaleForReceipt,
  lowStockCount: propLowStockCount,
}: DashboardPageProps) {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const { isInstalled, hasPrompt } = usePWAInstall();

  const fetchDashboard = async (silent = false) => {
    if (!silent) setLoading(true);
    else setIsRefreshing(true);
    try {
      const res = await apiRequest<DashboardData>("/api/reports/dashboard");
      setData(res);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.warn("[Dashboard] Error fetching stats:", err);
      setError(err.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();

    // Realtime Supabase event listener
    const unsubscribe = subscribeToPharmacyRealtime((event, payload) => {
      // Whenever inventory or sales events happen, silently refresh live dashboard numbers
      fetchDashboard(true);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="p-6 sm:p-12 flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="w-9 h-9 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Loading Real-Time Analytics from Supabase...
          </p>
        </div>
      </div>
    );
  }

  const isDatabaseEmpty = !data || data.inventory.totalProducts === 0;
  const effectiveLowStockCount =
    propLowStockCount !== undefined ? propLowStockCount : data?.inventory.lowStockCount || 0;

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-7xl mx-auto w-full">
      {/* Top Banner & Responsive Quick Actions */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
              Pharmacy Operations Dashboard
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 shrink-0">
              ACCRA, GHANA
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Real-time sales, FEFO inventory tracking, and gross profit analytics.
          </p>
        </div>

        {/* Action Buttons: Responsive grid on mobile, flex on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:flex md:flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => onNavigate("pos")}
            className="w-full md:w-auto px-4 py-2.5 bg-teal-600 hover:bg-teal-700 active:scale-98 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center space-x-2"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Open POS Terminal</span>
          </button>

          {user?.role === "OWNER" && (
            <>
              <button
                onClick={onAddProductClick}
                className="w-full md:w-auto px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center space-x-1.5"
              >
                <Plus className="w-4 h-4 text-teal-400" />
                <span>Add Product + Stock</span>
              </button>
              <button
                onClick={() => onAddStockClick()}
                className="w-full md:w-auto px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 transition flex items-center justify-center space-x-1.5"
              >
                <Boxes className="w-4 h-4 text-slate-600" />
                <span>Add Stock</span>
              </button>
            </>
          )}

          {/* Desktop App Download CTA */}
          {!isInstalled && (
            <button
              onClick={() => setIsInstallModalOpen(true)}
              className="w-full md:w-auto px-3 py-2.5 bg-teal-50 hover:bg-teal-100 active:scale-98 text-teal-800 font-bold text-xs rounded-xl border border-teal-200 transition flex items-center justify-center space-x-1.5"
              title="Download Empress Oris Desktop Application"
            >
              <Monitor className="w-4 h-4 text-teal-600" />
              <span>Download Desktop App</span>
            </button>
          )}
        </div>
      </div>

      {/* Visual Low Stock Notification System (Supabase Realtime Monitored) */}
      {!isDatabaseEmpty && (
        <LowStockAlertBanner
          lowStockCount={effectiveLowStockCount}
          lowStockProducts={data?.lowStockProducts}
          onRestockClick={(prod) => onAddStockClick(prod)}
          onNavigateToProducts={() => {
            onNavigate("products");
          }}
          lastUpdated={lastUpdated}
          onRefresh={() => fetchDashboard(true)}
          isRefreshing={isRefreshing}
        />
      )}

      {/* Empty Database Prompt if 0 products — Owner only */}
      {isDatabaseEmpty && user?.role === "OWNER" && (
        <div className="p-5 sm:p-8 rounded-2xl sm:rounded-3xl bg-teal-900 text-white border border-teal-700 shadow-lg relative overflow-hidden">
          <div className="max-w-2xl relative z-10 space-y-3">
            <span className="px-3 py-1 bg-teal-800 text-teal-200 text-xs font-bold rounded-full uppercase tracking-wider">
              Empty Database Ready
            </span>
            <h2 className="text-xl sm:text-3xl font-black tracking-tight">
              Ready to stock your Ghanaian Pharmacy
            </h2>
            <p className="text-xs sm:text-sm text-teal-200 leading-relaxed">
              No products have been added to your Supabase PostgreSQL database yet. Use our unified{" "}
              <strong>"Add Product + Initial Stock"</strong> workflow to simultaneously create your first medicine and
              enter its opening batch, quantity, cost price, and expiry date.
            </p>
            <div className="pt-2">
              <button
                onClick={onAddProductClick}
                className="w-full sm:w-auto px-6 py-3 bg-white text-teal-900 hover:bg-teal-50 font-black text-xs sm:text-sm rounded-xl shadow-md transition inline-flex items-center justify-center space-x-2"
              >
                <Plus className="w-5 h-5 text-teal-700" />
                <span>Add First Product with Initial Stock</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Primary KPI Grid: 2-column on mobile, 4-column on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Today's Sales */}
        <div className="bg-white p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200 shadow-2xs space-y-1.5 sm:space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
              Today's Sales
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
              <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-base sm:text-2xl font-black text-slate-900 tracking-tight truncate">
            GH₵ {parseFloat(data?.sales.todaySales || "0").toFixed(2)}
          </div>
          <div className="text-[10px] sm:text-xs text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
            <span>Count:</span>
            <span className="font-bold text-slate-700">{data?.sales.todayTransactions || 0}</span>
          </div>
        </div>

        {/* Total Revenue */}
        <div className="bg-white p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200 shadow-2xs space-y-1.5 sm:space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
              Total Revenue
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-base sm:text-2xl font-black text-slate-900 tracking-tight truncate">
            GH₵ {parseFloat(data?.finance.revenue || "0").toFixed(2)}
          </div>
          <div className="text-[10px] sm:text-xs text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
            <span>This Month:</span>
            <span className="font-bold text-slate-700 truncate ml-1">
              GH₵ {parseFloat(data?.sales.monthSales || "0").toFixed(0)}
            </span>
          </div>
        </div>

        {/* Inventory Stock Valuation */}
        <div className="bg-white p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200 shadow-2xs space-y-1.5 sm:space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
              Stock Value
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Boxes className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-base sm:text-2xl font-black text-slate-900 tracking-tight truncate">
            GH₵ {parseFloat(data?.inventory.inventoryValuation || "0").toFixed(2)}
          </div>
          <div className="text-[10px] sm:text-xs text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
            <span>Items:</span>
            <span className="font-bold text-slate-700">
              {data?.inventory.totalProducts || 0} ({data?.inventory.totalUnits || 0} u)
            </span>
          </div>
        </div>

        {/* Gross Profit (COGS-based) */}
        <div className="bg-white p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200 shadow-2xs space-y-1.5 sm:space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
              Gross Profit
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-base sm:text-2xl font-black text-indigo-950 tracking-tight truncate">
            GH₵ {parseFloat(data?.finance.grossProfit || "0").toFixed(2)}
          </div>
          <div className="text-[10px] sm:text-xs text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
            <span>Margin:</span>
            <span className="font-bold text-emerald-600">{data?.finance.grossMarginPercent || "0.0"}%</span>
          </div>
        </div>
      </div>

      {/* Stock Health & Alerts Overview: Responsive cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
        {/* Low Stock Alert Box */}
        <div
          onClick={() => onNavigate("products")}
          className={`p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border shadow-2xs cursor-pointer transition flex items-center justify-between active:scale-99 ${
            effectiveLowStockCount > 0
              ? "bg-amber-50/80 border-amber-300 hover:border-amber-400 ring-1 ring-amber-200"
              : "bg-white border-amber-200 hover:border-amber-300"
          }`}
        >
          <div className="space-y-0.5 sm:space-y-1">
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-bold text-amber-900 uppercase">Low Stock Products</span>
              {effectiveLowStockCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              )}
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-700">{effectiveLowStockCount}</div>
            <p className="text-[10px] sm:text-[11px] text-slate-500">At or below reorder threshold</p>
          </div>
          <div
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${
              effectiveLowStockCount > 0
                ? "bg-amber-500 text-white shadow-xs"
                : "bg-amber-50 text-amber-600"
            }`}
          >
            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        {/* Expiring Soon (Within 90 Days) */}
        <div
          onClick={() => onNavigate("batches")}
          className="bg-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-rose-200 hover:border-rose-300 shadow-2xs cursor-pointer transition flex items-center justify-between active:scale-99"
        >
          <div className="space-y-0.5 sm:space-y-1">
            <span className="text-xs font-bold text-rose-900 uppercase">Expiring Batches (&lt; 90d)</span>
            <div className="text-xl sm:text-2xl font-black text-rose-700">{data?.inventory.expiringSoonCount || 0}</div>
            <p className="text-[10px] sm:text-[11px] text-slate-500">FEFO priority dispensing required</p>
          </div>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <CalendarDays className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        {/* Active Cashier Shifts */}
        <div
          onClick={() => onNavigate("shifts")}
          className="bg-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-teal-200 hover:border-teal-300 shadow-2xs cursor-pointer transition flex items-center justify-between active:scale-99"
        >
          <div className="space-y-0.5 sm:space-y-1">
            <span className="text-xs font-bold text-teal-900 uppercase">Active Cashier Shifts</span>
            <div className="text-xl sm:text-2xl font-black text-teal-700">{data?.employees.openShifts || 0}</div>
            <p className="text-[10px] sm:text-[11px] text-slate-500">Active terminal registers open</p>
          </div>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
      </div>

      {/* Recent Transactions: Dual View (Mobile Card List + Desktop Data Table) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Recent Sales &amp; POS Transactions</h3>
            <p className="text-xs text-slate-500">Live transactions recorded in Supabase</p>
          </div>
          <button
            onClick={() => onNavigate("sales")}
            className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center space-x-1"
          >
            <span>View All</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {!data?.recentTransactions || data.recentTransactions.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-slate-400 space-y-2">
            <Receipt className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">No sales transactions recorded yet.</p>
            <p className="text-xs text-slate-400">Transactions processed at the POS terminal will appear here in real time.</p>
          </div>
        ) : (
          <>
            {/* 1. Mobile Cards View (Visible on screens < md) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {data.recentTransactions.map((sale: any) => (
                <div key={sale.id} className="p-3.5 space-y-2 hover:bg-slate-50 transition">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-slate-900">
                      {sale.receipt_number || sale.receiptNumber}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        sale.status === "COMPLETED"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {sale.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <div>
                      <span className="font-semibold text-slate-700">{sale.cashier_name || sale.cashierName || "Cashier"}</span>
                      <span className="mx-1.5">•</span>
                      <span>
                        {new Date(sale.created_at || sale.createdAt).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                    </div>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                      {(sale.payment_method || sale.paymentMethod || "CASH").replace("_", " ")}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-50">
                    <span className="text-[11px] text-slate-400">Total Paid:</span>
                    <span className="text-sm font-black text-slate-900">
                      GH₵ {parseFloat(sale.total_amount || sale.totalAmount || "0").toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* 2. Desktop Table View (Visible on screens >= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3">Receipt No</th>
                    <th className="px-5 py-3">Date &amp; Time</th>
                    <th className="px-5 py-3">Cashier</th>
                    <th className="px-5 py-3">Payment</th>
                    <th className="px-5 py-3 text-right">Amount (GH₵)</th>
                    <th className="px-5 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {data.recentTransactions.map((sale: any) => (
                    <tr key={sale.id} className="hover:bg-slate-50 transition">
                      <td className="px-5 py-3 font-mono font-bold text-slate-900">
                        {sale.receipt_number || sale.receiptNumber}
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        {new Date(sale.created_at || sale.createdAt).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "short",
                        })}
                      </td>
                      <td className="px-5 py-3 font-semibold">{sale.cashier_name || sale.cashierName || "Cashier"}</td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                          {(sale.payment_method || sale.paymentMethod || "CASH").replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-slate-900">
                        GH₵ {parseFloat(sale.total_amount || sale.totalAmount || "0").toFixed(2)}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            sale.status === "COMPLETED"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {sale.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Desktop App Installation Modal */}
      <InstallAppModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />
    </div>
  );
}
