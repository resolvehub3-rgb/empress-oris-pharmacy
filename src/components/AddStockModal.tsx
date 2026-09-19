import React, { useState, useEffect } from "react";
import { X, Boxes, Plus, AlertCircle, CheckCircle2 } from "lucide-react";
import { Product, Supplier } from "../types";
import { apiRequest } from "../lib/api";

interface AddStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  products?: Product[];
  suppliers: Supplier[];
  selectedProduct?: Product | null;
  initialProduct?: Product | null;
}

export function AddStockModal({
  isOpen,
  onClose,
  onSuccess,
  products = [],
  suppliers,
  selectedProduct,
  initialProduct,
}: AddStockModalProps) {
  const activeProduct = selectedProduct || initialProduct;
  const [localProducts, setLocalProducts] = useState<Product[]>(products);
  const [productId, setProductId] = useState(activeProduct?.id || "");
  const [mode, setMode] = useState<"NEW_BATCH" | "EXISTING_BATCH">("NEW_BATCH");
  const [existingBatchId, setExistingBatchId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [manufacturingDate, setManufacturingDate] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [purchaseReference, setPurchaseReference] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeProduct) {
      setProductId(activeProduct.id);
      setSellingPrice(activeProduct.sellingPrice);
    }
  }, [activeProduct]);

  useEffect(() => {
    if (isOpen && localProducts.length === 0) {
      apiRequest<{ products: Product[] }>("/api/products")
        .then((res) => {
          if (res.products) setLocalProducts(res.products);
        })
        .catch((err) => console.warn(err));
    }
  }, [isOpen, localProducts.length]);

  const currentProduct = localProducts.find((p) => p.id === productId) || activeProduct;

  const handleGenerateBatch = () => {
    const year = new Date().getFullYear();
    const rand = Math.floor(100 + Math.random() * 900);
    setBatchNumber(`B-${year}-${rand}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!productId) {
      setError("Please select a product.");
      return;
    }
    if (!quantity || parseInt(quantity) <= 0) {
      setError("Quantity must be greater than 0.");
      return;
    }

    if (mode === "NEW_BATCH") {
      if (!batchNumber.trim()) {
        setError("Batch Number is required for new stock.");
        return;
      }
      if (!expiryDate) {
        setError("Expiry Date is mandatory for pharmaceutical stock.");
        return;
      }
    } else {
      if (!existingBatchId) {
        setError("Please select the existing batch to replenish.");
        return;
      }
    }

    setLoading(true);
    try {
      await apiRequest("/api/stock/add", {
        method: "POST",
        body: JSON.stringify({
          productId,
          supplierId: supplierId || null,
          quantity: parseInt(quantity),
          batchNumber: mode === "NEW_BATCH" ? batchNumber.trim() : null,
          costPrice: costPrice ? parseFloat(costPrice) : 0,
          sellingPrice: sellingPrice ? parseFloat(sellingPrice) : 0,
          manufacturingDate: manufacturingDate || null,
          expiryDate: mode === "NEW_BATCH" ? expiryDate : null,
          purchaseReference: purchaseReference || null,
          notes: notes || null,
          existingBatchId: mode === "EXISTING_BATCH" ? existingBatchId : null,
        }),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to add stock.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-200">
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Add Stock (Replenishment)</h2>
              <p className="text-xs text-slate-500 font-medium">
                Add stock to an existing catalog product (New Batch or Existing Batch)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Product Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Select Product *</label>
            <select
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                const found = localProducts.find((p) => p.id === e.target.value);
                if (found) setSellingPrice(found.sellingPrice);
              }}
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">-- Choose Product --</option>
              {localProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (SKU: {p.sku}) — Available Stock: {p.totalStock}
                </option>
              ))}
            </select>
          </div>

          {currentProduct && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 flex justify-between items-center">
              <div>
                <span className="font-bold text-slate-900">{currentProduct.name}</span>
                <span className="text-slate-500 ml-2">SKU: {currentProduct.sku}</span>
              </div>
              <div className="font-semibold text-teal-700">
                Current Stock: {currentProduct.totalStock} units
              </div>
            </div>
          )}

          {/* Batch Mode Selection */}
          <div className="flex space-x-2 border-b border-slate-200 pb-3 pt-1">
            <button
              type="button"
              onClick={() => setMode("NEW_BATCH")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg border transition ${
                mode === "NEW_BATCH"
                  ? "bg-teal-600 text-white border-teal-600 shadow-2xs"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              + Create New Batch (Recommended)
            </button>
            <button
              type="button"
              onClick={() => setMode("EXISTING_BATCH")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg border transition ${
                mode === "EXISTING_BATCH"
                  ? "bg-teal-600 text-white border-teal-600 shadow-2xs"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              Add to Existing Batch
            </button>
          </div>

          {mode === "EXISTING_BATCH" ? (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Select Batch *</label>
              <select
                value={existingBatchId}
                onChange={(e) => setExistingBatchId(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none"
              >
                <option value="">-- Choose Existing Batch --</option>
                {currentProduct?.batches?.map((b) => (
                  <option key={b.id} value={b.id}>
                    Batch {b.batchNumber} (Expires: {b.expiryDate}) — Current: {b.currentQuantity} units
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-700">Batch Number *</label>
                  <button
                    type="button"
                    onClick={handleGenerateBatch}
                    className="text-xs text-teal-600 hover:underline"
                  >
                    Generate
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="e.g. B-2026-08"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Expiry Date (FEFO) *</label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          )}

          {/* Quantity & Pricing */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Quantity Received *</label>
              <input
                type="number"
                min="1"
                required
                placeholder="e.g. 100"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3.5 py-2 text-sm font-bold bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Cost Price (GH₵)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Selling Price (GH₵)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Supplier</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
              >
                <option value="">-- Choose Supplier --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.phone})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Invoice / PO Reference</label>
              <input
                type="text"
                placeholder="e.g. INV-2026-99"
                value={purchaseReference}
                onChange={(e) => setPurchaseReference(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
            <input
              type="text"
              placeholder="e.g. Received in good condition from Ernest Chemist"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
            />
          </div>
        </form>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs transition disabled:opacity-50"
          >
            {loading ? "Recording in Supabase..." : "Confirm & Add Stock"}
          </button>
        </div>
      </div>
    </div>
  );
}
