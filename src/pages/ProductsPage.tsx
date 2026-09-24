import React, { useState, useEffect, lazy, Suspense } from "react";
import {
  Package,
  Plus,
  Boxes,
  Search,
  Filter,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  Tag,
  Barcode,
  Sparkles,
  Printer,
  FileSpreadsheet,
} from "lucide-react";
import { Product, Category, Supplier } from "../types";
import { apiRequest } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { ImportProductsModal } from "../components/ImportProductsModal";
import { subscribeToPharmacyRealtime } from "../lib/supabaseClient";

// JsBarcode is only needed when the label-printer dialog is actually opened,
// so keep it out of the initial products chunk.
const BarcodePrintModal = lazy(() =>
  import("../components/BarcodePrintModal").then((m) => ({ default: m.BarcodePrintModal }))
);

interface ProductsPageProps {
  onAddProductClick: () => void;
  onAddStockClick: (product?: Product) => void;
  categories: Category[];
  /** Refresh auxiliary data (categories/dashboard counts) after an import. */
  onDataChanged?: () => void;
}

export function ProductsPage({
  onAddProductClick,
  onAddStockClick,
  categories,
  onDataChanged,
}: ProductsPageProps) {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [selectedProductForBarcode, setSelectedProductForBarcode] = useState<Product | null>(null);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const url = `/api/products?search=${encodeURIComponent(search)}${
        selectedCategory ? `&categoryId=${selectedCategory}` : ""
      }${lowStockOnly ? "&lowStock=true" : ""}`;
      const res = await apiRequest<{ products: Product[] }>(url);
      setProducts(res.products || []);
    } catch (err) {
      console.warn("[ProductsPage] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();

    const unsubscribe = subscribeToPharmacyRealtime((event) => {
      if (event === "PRODUCT_CREATED" || event === "PRODUCT_UPDATED" || event === "STOCK_UPDATED") {
        fetchProducts();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [selectedCategory, lowStockOnly, refreshKey]);

  const handleImportSuccess = () => {
    // The importing session refreshes immediately (other sessions receive the
    // Supabase Realtime broadcast); either way no manual reload is needed.
    setRefreshKey((key) => key + 1);
    onDataChanged?.();
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts();
  };

  const toggleExpand = (id: string) => {
    setExpandedProductId(expandedProductId === id ? null : id);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Medicines & Product Catalog
            </h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {products.length} Products
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Batch-tracked pharmaceutical inventory with FEFO expiry monitoring.
          </p>
        </div>

        {(user?.role === "OWNER" || user?.role === "ADMIN") && (
          <div className="flex items-center space-x-2">
            <button
              onClick={onAddProductClick}
              className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-2xs transition flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product + Initial Stock</span>
            </button>
            <button
              onClick={() => onAddStockClick()}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 transition flex items-center space-x-1.5"
            >
              <Boxes className="w-4 h-4 text-slate-600" />
              <span>Add Stock</span>
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="px-3.5 py-2.5 bg-white hover:bg-teal-50 text-teal-700 font-bold text-xs rounded-xl border border-teal-300 transition flex items-center space-x-1.5"
              title="Import products from an Excel spreadsheet"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Import Products</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearch} className="flex-1 w-full relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by drug name, generic name, brand, SKU, or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-900"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 font-semibold"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setLowStockOnly(!lowStockOnly)}
            className={`px-3 py-2 text-xs font-bold rounded-xl border transition ${
              lowStockOnly
                ? "bg-amber-600 text-white border-amber-600"
                : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
            }`}
          >
            Low Stock Only
          </button>

          <button
            type="button"
            onClick={() => fetchProducts()}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-2xs"
          >
            Apply
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold">Querying products from Supabase...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="p-16 text-center text-slate-400 space-y-3">
            <Package className="w-12 h-12 mx-auto text-slate-300" />
            <h3 className="text-base font-bold text-slate-700">No products found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Your pharmacy catalog is currently empty. Click "Add Product + Initial Stock" to create your first item.
            </p>
            {(user?.role === "OWNER" || user?.role === "ADMIN") && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={onAddProductClick}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-sm transition inline-flex items-center space-x-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Product Now</span>
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 shadow-sm transition inline-flex items-center space-x-1.5"
                >
                  <FileSpreadsheet className="w-4 h-4 text-teal-600" />
                  <span>Import from Excel</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3 w-8"></th>
                  <th className="px-5 py-3">Product Name & Generic</th>
                  <th className="px-5 py-3">SKU / Barcode</th>
                  <th className="px-5 py-3">Category / Form</th>
                  <th className="px-5 py-3 text-right">Selling Price</th>
                  <th className="px-5 py-3 text-center">Available Stock</th>
                  <th className="px-5 py-3 text-center">Batches</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {products.map((p: any) => {
                  const isExpanded = expandedProductId === p.id;
                  const totalStock = p.total_stock !== undefined ? p.total_stock : p.totalStock || 0;
                  const reorder = p.reorder_level || p.reorderLevel || 10;
                  const isLow = totalStock <= reorder;
                  const isZero = totalStock <= 0;
                  const batchList = p.batches || [];

                  return (
                    <React.Fragment key={p.id}>
                      <tr className="hover:bg-slate-50 transition">
                        <td className="px-3 py-3 text-center">
                          <button
                            onClick={() => toggleExpand(p.id)}
                            className="p-1 hover:bg-slate-200 rounded text-slate-500"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                        <td className="px-5 py-3">
                          <div className="font-bold text-slate-900">{p.name}</div>
                          {p.generic_name && (
                            <div className="text-[11px] text-slate-500 italic">{p.generic_name}</div>
                          )}
                          {p.prescription_required && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                              Rx Prescription
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 font-mono">
                          <div className="font-bold text-slate-800">{p.sku}</div>
                          <div className="flex items-center space-x-1 mt-0.5">
                            {p.barcode ? (
                              <button
                                onClick={() => {
                                  setSelectedProductForBarcode(p);
                                  setShowBarcodeModal(true);
                                }}
                                className="text-[10px] text-slate-600 bg-slate-100 hover:bg-teal-50 hover:text-teal-700 px-1.5 py-0.5 rounded border border-slate-200 transition inline-flex items-center space-x-1"
                                title="Click to view and print barcode label"
                              >
                                <Barcode className="w-3 h-3 text-teal-600" />
                                <span>{p.barcode}</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setSelectedProductForBarcode(p);
                                  setShowBarcodeModal(true);
                                }}
                                className="text-[10px] text-teal-600 hover:text-teal-700 hover:underline font-bold inline-flex items-center space-x-0.5"
                                title="Assign and print barcode"
                              >
                                <Sparkles className="w-2.5 h-2.5" />
                                <span>+ Barcode</span>
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div>{p.category_name || "General"}</div>
                          <div className="text-[11px] text-slate-400">
                            {p.dosage_form} {p.strength ? `(${p.strength})` : ""}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right font-bold text-slate-900">
                          GH₵ {parseFloat(p.selling_price || "0").toFixed(2)}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-black ${
                              isZero
                                ? "bg-rose-100 text-rose-800"
                                : isLow
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {isZero ? "0 Units" : `${totalStock} Units`}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className="text-xs font-bold text-slate-600">
                            {batchList.length} {batchList.length === 1 ? "Batch" : "Batches"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => {
                              setSelectedProductForBarcode(p);
                              setShowBarcodeModal(true);
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg text-xs transition inline-flex items-center space-x-1"
                            title="Generate and print barcode label"
                          >
                            <Barcode className="w-3.5 h-3.5 text-teal-600" />
                            <span>Barcode</span>
                          </button>

                          {(user?.role === "OWNER" || user?.role === "ADMIN") && (
                            <button
                              onClick={() => onAddStockClick(p)}
                              className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold rounded-lg text-xs"
                            >
                              + Add Stock
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Expandable Batches Subtable */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80 border-b border-slate-200">
                          <td colSpan={8} className="p-4 pl-12">
                            <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
                              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                  Live Batches for {p.name} (FEFO Order)
                                </span>
                                {(user?.role === "OWNER" || user?.role === "ADMIN") && (
                                  <button
                                    onClick={() => onAddStockClick(p)}
                                    className="text-xs font-bold text-teal-600 hover:underline"
                                  >
                                    + Add New Batch
                                  </button>
                                )}
                              </div>

                              {batchList.length === 0 ? (
                                <p className="text-xs text-slate-400 italic py-2">
                                  No batches exist for this product. Available stock is 0.
                                </p>
                              ) : (
                                <table className="w-full text-left text-xs">
                                  <thead className="text-[10px] text-slate-400 uppercase font-bold border-b border-slate-100">
                                    <tr>
                                      <th className="py-1">Batch Number</th>
                                      <th className="py-1">Quantity Remaining</th>
                                      <th className="py-1">Cost Price</th>
                                      <th className="py-1">Selling Price</th>
                                      <th className="py-1">Expiry Date</th>
                                      <th className="py-1 text-center">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {batchList.map((b: any) => (
                                      <tr key={b.id} className="py-1.5">
                                        <td className="py-1.5 font-mono font-bold text-slate-900">
                                          {b.batch_number}
                                        </td>
                                        <td className="py-1.5 font-bold text-slate-800">
                                          {b.current_quantity} / {b.initial_quantity}
                                        </td>
                                        <td className="py-1.5">GH₵ {parseFloat(b.cost_price || 0).toFixed(2)}</td>
                                        <td className="py-1.5">GH₵ {parseFloat(b.selling_price || 0).toFixed(2)}</td>
                                        <td className="py-1.5 font-mono">
                                          {new Date(b.expiry_date).toLocaleDateString("en-GB")}
                                        </td>
                                        <td className="py-1.5 text-center">
                                          <span
                                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                              b.is_expired
                                                ? "bg-rose-100 text-rose-800"
                                                : "bg-emerald-100 text-emerald-800"
                                            }`}
                                          >
                                            {b.is_expired ? "EXPIRED" : "ACTIVE"}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Excel Product Import (Owner / Admin only) */}
      <ImportProductsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={handleImportSuccess}
      />

      {/* Barcode Generation & Print Modal (jsbarcode is loaded on demand) */}
      {showBarcodeModal && selectedProductForBarcode && (
        <Suspense fallback={null}>
          <BarcodePrintModal
            isOpen={showBarcodeModal}
            onClose={() => {
              setShowBarcodeModal(false);
              setSelectedProductForBarcode(null);
            }}
            product={selectedProductForBarcode}
            onProductUpdated={(updated) => {
              setProducts((prev) =>
                prev.map((p) => (p.id === updated.id ? { ...p, barcode: updated.barcode } : p))
              );
              setSelectedProductForBarcode(updated);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
