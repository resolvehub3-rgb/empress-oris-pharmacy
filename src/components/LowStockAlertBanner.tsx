import React, { useState } from "react";
import {
  AlertTriangle,
  Boxes,
  ArrowRight,
  TrendingDown,
  RefreshCw,
  Sparkles,
  ExternalLink,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Volume2,
  VolumeX,
} from "lucide-react";
import { LowStockProduct, Product } from "../types";

interface LowStockAlertBannerProps {
  lowStockCount: number;
  lowStockProducts?: LowStockProduct[];
  onRestockClick: (product?: Product) => void;
  onNavigateToProducts: (searchQuery?: string) => void;
  lastUpdated?: Date;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function LowStockAlertBanner({
  lowStockCount,
  lowStockProducts = [],
  onRestockClick,
  onNavigateToProducts,
  lastUpdated,
  onRefresh,
  isRefreshing = false,
}: LowStockAlertBannerProps) {
  const [filter, setFilter] = useState<"ALL" | "OUT_OF_STOCK" | "CRITICAL">("ALL");
  const [isExpanded, setIsExpanded] = useState(true);

  if (lowStockCount === 0) {
    return (
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <Boxes className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-emerald-950">
                Inventory Stock Levels Optimal
              </span>
              <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Realtime Supabase Sync</span>
              </span>
            </div>
            <p className="text-[11px] text-emerald-700">
              All active pharmacy items meet or exceed their defined minimum safety thresholds.
            </p>
          </div>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="text-emerald-700 hover:text-emerald-900 p-1.5 rounded-lg hover:bg-emerald-100/60 transition"
            title="Refresh Live Stock"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>
    );
  }

  // Count subsets
  const outOfStockCount = lowStockProducts.filter((p) => p.current_stock === 0).length;
  const criticalCount = lowStockProducts.filter(
    (p) => p.current_stock > 0 && p.current_stock <= p.reorder_level * 0.5
  ).length;

  const filteredProducts = lowStockProducts.filter((p) => {
    if (filter === "OUT_OF_STOCK") return p.current_stock === 0;
    if (filter === "CRITICAL") return p.current_stock > 0 && p.current_stock <= p.reorder_level * 0.5;
    return true;
  });

  return (
    <div className="bg-amber-500/10 border-2 border-amber-300 rounded-2xl overflow-hidden shadow-xs">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-rose-700 text-white p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 shadow-xs border border-white/20">
            <ShieldAlert className="w-5 h-5 text-white animate-bounce" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center space-x-1.5">
                <span>{lowStockCount} {lowStockCount === 1 ? "Product" : "Products"} Below Minimum Safety Level</span>
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white border border-white/30 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>Supabase Realtime Monitored</span>
              </span>
            </div>
            <p className="text-xs text-amber-100 font-medium mt-0.5">
              Urgent stock replenishment required to maintain uninterrupted POS dispensing.
            </p>
          </div>
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center space-x-2 shrink-0 self-end md:self-auto">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold transition flex items-center space-x-1 text-white"
              title="Sync latest live inventory from Supabase"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Sync</span>
            </button>
          )}

          <button
            onClick={() => onNavigateToProducts()}
            className="px-3 py-1.5 rounded-lg bg-white text-amber-900 hover:bg-amber-50 text-xs font-black transition flex items-center space-x-1 shadow-xs"
          >
            <span>View All in Catalog</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
            title={isExpanded ? "Collapse Alert Panel" : "Expand Alert Panel"}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Content Area */}
      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-3.5 bg-amber-50/60">
          {/* Subheader Filters */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 pb-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-amber-950 uppercase tracking-wider mr-1">Filter:</span>
              <button
                onClick={() => setFilter("ALL")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  filter === "ALL"
                    ? "bg-amber-800 text-white shadow-2xs"
                    : "bg-white text-amber-900 border border-amber-300 hover:bg-amber-100"
                }`}
              >
                All Low Stock ({lowStockCount})
              </button>

              <button
                onClick={() => setFilter("OUT_OF_STOCK")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1 ${
                  filter === "OUT_OF_STOCK"
                    ? "bg-rose-700 text-white shadow-2xs"
                    : "bg-white text-rose-700 border border-rose-300 hover:bg-rose-50"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span>Out of Stock ({outOfStockCount})</span>
              </button>

              <button
                onClick={() => setFilter("CRITICAL")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1 ${
                  filter === "CRITICAL"
                    ? "bg-amber-600 text-white shadow-2xs"
                    : "bg-white text-amber-800 border border-amber-300 hover:bg-amber-100"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>Critical &le;50% ({criticalCount})</span>
              </button>
            </div>

            {lastUpdated && (
              <span className="text-[11px] text-amber-800/80 font-mono">
                Live Status: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>

          {/* Cards Grid of Specific Products */}
          {filteredProducts.length === 0 ? (
            <div className="p-6 text-center text-amber-800 text-xs font-semibold bg-white rounded-xl border border-amber-200">
              No products match the selected filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredProducts.map((prod) => {
                const stock = prod.current_stock || 0;
                const minThreshold = prod.reorder_level || 10;
                const percent = Math.min(100, Math.round((stock / minThreshold) * 100));
                const isZero = stock === 0;
                const isCritical = !isZero && stock <= minThreshold * 0.5;

                // Compatible Product object for opening Add Stock modal
                const productObj: Product = {
                  id: prod.id,
                  name: prod.name,
                  genericName: prod.generic_name || prod.name,
                  generic_name: prod.generic_name,
                  sku: prod.sku,
                  barcode: prod.barcode,
                  reorderLevel: prod.reorder_level || 10,
                  reorder_level: prod.reorder_level,
                  totalStock: prod.current_stock || 0,
                  dosage_form: prod.dosage_form,
                  strength: prod.strength,
                  sellingPrice: prod.selling_price || "0",
                  selling_price: prod.selling_price || "0",
                  prescriptionRequired: !!prod.prescription_required,
                  prescription_required: prod.prescription_required,
                };

                return (
                  <div
                    key={prod.id}
                    className={`bg-white rounded-xl p-4 border transition hover:shadow-xs flex flex-col justify-between space-y-3 ${
                      isZero
                        ? "border-rose-300 ring-1 ring-rose-200"
                        : isCritical
                        ? "border-amber-300"
                        : "border-slate-200"
                    }`}
                  >
                    <div>
                      {/* Card Header: Category & Urgency Status */}
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">
                          {prod.category_name || "General Pharmacy"}
                        </span>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${
                            isZero
                              ? "bg-rose-100 text-rose-800 border border-rose-300 animate-pulse"
                              : isCritical
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {isZero ? "OUT OF STOCK" : isCritical ? "CRITICAL" : "LOW STOCK"}
                        </span>
                      </div>

                      {/* Product Name & SKU */}
                      <h4 className="text-sm font-bold text-slate-900 leading-snug line-clamp-1">
                        {prod.name}
                      </h4>
                      {prod.generic_name && (
                        <p className="text-[11px] text-slate-500 italic line-clamp-1">
                          {prod.generic_name}
                        </p>
                      )}

                      <div className="flex items-center space-x-1.5 mt-1 font-mono text-[10px] text-slate-500">
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-bold">
                          {prod.sku}
                        </span>
                        {prod.strength && <span>• {prod.strength}</span>}
                        {prod.dosage_form && <span>• {prod.dosage_form}</span>}
                      </div>
                    </div>

                    {/* Stock Meter */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Current Stock:</span>
                        <span className="font-bold">
                          <span
                            className={
                              isZero
                                ? "text-rose-600 font-black"
                                : isCritical
                                ? "text-amber-700 font-black"
                                : "text-slate-900 font-black"
                            }
                          >
                            {stock}
                          </span>
                          <span className="text-slate-400 font-normal"> / {minThreshold} units min</span>
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isZero
                              ? "w-0 bg-rose-600"
                              : isCritical
                              ? "bg-amber-500"
                              : "bg-amber-400"
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span className="text-rose-600 font-bold">
                          Deficit: -{Math.max(0, minThreshold - stock)} units
                        </span>
                        <span>{percent}% of threshold</span>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        onClick={() => onRestockClick(productObj)}
                        className="flex-1 py-1.5 px-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-lg shadow-2xs transition flex items-center justify-center space-x-1"
                        title="Add fresh stock batch for this item in Supabase"
                      >
                        <Boxes className="w-3.5 h-3.5" />
                        <span>+ Restock Batch</span>
                      </button>

                      <button
                        onClick={() => onNavigateToProducts(prod.name)}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs transition"
                        title="Search in catalog"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
