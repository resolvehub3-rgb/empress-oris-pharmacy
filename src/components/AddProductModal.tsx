import React, { useState, useEffect } from "react";
import {
  X,
  Package,
  Boxes,
  Plus,
  Calendar,
  AlertCircle,
  Upload,
  CheckCircle2,
  FileText,
  DollarSign,
  Tag,
  Building,
} from "lucide-react";
import { Category, Supplier } from "../types";
import { apiRequest } from "../lib/api";

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (productData: any) => void;
  categories: Category[];
  suppliers: Supplier[];
  onRefreshCategories?: () => void;
  onRefreshSuppliers?: () => void;
}

export function AddProductModal({
  isOpen,
  onClose,
  onSuccess,
  categories,
  suppliers,
  onRefreshCategories,
  onRefreshSuppliers,
}: AddProductModalProps) {
  // Product Details State
  const [name, setName] = useState("");
  const [genericName, setGenericName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [dosageForm, setDosageForm] = useState("Tablet");
  const [strength, setStrength] = useState("");
  const [unit, setUnit] = useState("Pack");
  const [packSize, setPackSize] = useState("1");
  const [manufacturer, setManufacturer] = useState("");
  const [description, setDescription] = useState("");
  const [prescriptionRequired, setPrescriptionRequired] = useState(false);
  const [reorderLevel, setReorderLevel] = useState("10");
  const [sellingPrice, setSellingPrice] = useState("");
  const [wholesalePrice, setWholesalePrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Initial Stock State (CRITICAL WORKFLOW)
  const [hasInitialStock, setHasInitialStock] = useState(true);
  const [initialQuantity, setInitialQuantity] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [batchSellingPrice, setBatchSellingPrice] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [manufacturingDate, setManufacturingDate] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [purchaseReference, setPurchaseReference] = useState("");
  const [stockNotes, setStockNotes] = useState("");

  // Quick category/supplier creation state
  const [showQuickCategory, setShowQuickCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showQuickSupplier, setShowQuickSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Auto-generate a sensible SKU if empty
  const handleGenerateSku = () => {
    const prefix = name ? name.substring(0, 3).toUpperCase() : "PRD";
    const rand = Math.floor(1000 + Math.random() * 9000);
    setSku(`${prefix}-${rand}`);
  };

  // Auto-generate batch number
  const handleGenerateBatch = () => {
    const year = new Date().getFullYear();
    const rand = Math.floor(100 + Math.random() * 900);
    setBatchNumber(`B-${year}-${rand}`);
  };

  const handleImageUpload = async (file: File) => {
    setImageFile(file);
    const formData = new FormData();
    formData.append("image", file);

    setUploadingImage(true);
    try {
      const res = await apiRequest<{ success: boolean; url: string }>("/api/products/upload-image", {
        method: "POST",
        body: formData,
      });
      if (res.url) {
        setImageUrl(res.url);
      }
    } catch (err: any) {
      setError("Image upload to Supabase Storage failed: " + err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const res = await apiRequest<{ success: boolean; category: Category }>("/api/categories", {
        method: "POST",
        body: JSON.stringify({ name: newCategoryName }),
      });
      if (res.category) {
        setCategoryId(res.category.id);
        setShowQuickCategory(false);
        setNewCategoryName("");
        if (onRefreshCategories) onRefreshCategories();
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateSupplier = async () => {
    if (!newSupplierName.trim() || !newSupplierPhone.trim()) {
      setError("Supplier name and phone are required.");
      return;
    }
    try {
      const res = await apiRequest<{ success: boolean; supplier: Supplier }>("/api/suppliers", {
        method: "POST",
        body: JSON.stringify({ name: newSupplierName, phone: newSupplierPhone }),
      });
      if (res.supplier) {
        setSupplierId(res.supplier.id);
        setShowQuickSupplier(false);
        setNewSupplierName("");
        setNewSupplierPhone("");
        if (onRefreshSuppliers) onRefreshSuppliers();
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Product Name is required.");
      return;
    }
    if (!sku.trim()) {
      setError("SKU is required. Click 'Generate' if you do not have one.");
      return;
    }
    if (!sellingPrice || parseFloat(sellingPrice) < 0) {
      setError("A valid Selling Price in GH₵ is required.");
      return;
    }

    if (hasInitialStock) {
      if (!initialQuantity || parseInt(initialQuantity) <= 0) {
        setError("Initial Stock Quantity must be greater than 0.");
        return;
      }
      if (!batchNumber.trim()) {
        setError("Batch Number is required for initial stock tracking (FEFO).");
        return;
      }
      if (!expiryDate) {
        setError("Expiry Date is mandatory for pharmaceutical stock.");
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        genericName: genericName.trim() || null,
        brandName: brandName.trim() || null,
        sku: sku.trim(),
        barcode: barcode.trim() || null,
        categoryId: categoryId || null,
        dosageForm,
        strength: strength.trim() || null,
        unit,
        packSize: parseInt(packSize) || 1,
        manufacturer: manufacturer.trim() || null,
        description: description.trim() || null,
        prescriptionRequired,
        imageUrl: imageUrl || null,
        reorderLevel: parseInt(reorderLevel) || 10,
        sellingPrice: parseFloat(sellingPrice),
        wholesalePrice: wholesalePrice ? parseFloat(wholesalePrice) : null,
        // Initial Stock Fields
        hasInitialStock,
        initialQuantity: hasInitialStock ? parseInt(initialQuantity) : 0,
        batchNumber: hasInitialStock ? batchNumber.trim() : null,
        costPrice: hasInitialStock && costPrice ? parseFloat(costPrice) : 0.0,
        batchSellingPrice: hasInitialStock && batchSellingPrice ? parseFloat(batchSellingPrice) : parseFloat(sellingPrice),
        expiryDate: hasInitialStock ? expiryDate : null,
        manufacturingDate: hasInitialStock && manufacturingDate ? manufacturingDate : null,
        supplierId: hasInitialStock && supplierId ? supplierId : null,
        purchaseReference: hasInitialStock && purchaseReference ? purchaseReference.trim() : null,
        stockNotes: hasInitialStock && stockNotes ? stockNotes.trim() : null,
      };

      const result = await apiRequest("/api/products", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      onSuccess(result);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create product and initial stock.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Add New Product & Initial Stock</h2>
              <p className="text-xs text-slate-500 font-medium">
                Create a catalog product and immediately enter opening stock, batch, and expiry date.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Validation Error</p>
                <p>{error}</p>
              </div>
            </div>
          )}

          {/* Section 1: Core Product Information */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                <Tag className="w-4 h-4 text-teal-600" />
                <span>1. Product Details</span>
              </h3>
              <span className="text-xs text-slate-400 font-medium">* Required fields</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Paracetamol 500mg, Amoxicillin Caps"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Generic / Chemical Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Acetaminophen"
                  value={genericName}
                  onChange={(e) => setGenericName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Brand / Trade Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Panadol, Emzor"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-900"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">SKU Code *</label>
                  <button
                    type="button"
                    onClick={handleGenerateSku}
                    className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                  >
                    Generate
                  </button>
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. MED-0041"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Barcode / UPC
                </label>
                <input
                  type="text"
                  placeholder="Scan or enter barcode"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-900 font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Category</label>
                  <button
                    type="button"
                    onClick={() => setShowQuickCategory(!showQuickCategory)}
                    className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                  >
                    + New
                  </button>
                </div>
                {showQuickCategory ? (
                  <div className="flex items-center space-x-1.5">
                    <input
                      type="text"
                      placeholder="Category name"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-teal-400 rounded-md focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCreateCategory}
                      className="px-2.5 py-1.5 text-xs bg-teal-600 text-white rounded-md hover:bg-teal-700 font-semibold"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowQuickCategory(false)}
                      className="px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-md"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-900"
                  >
                    <option value="">-- Select Category --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Dosage Form</label>
                <select
                  value={dosageForm}
                  onChange={(e) => setDosageForm(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-900"
                >
                  <option value="Tablet">Tablet</option>
                  <option value="Capsule">Capsule</option>
                  <option value="Syrup">Syrup</option>
                  <option value="Suspension">Suspension</option>
                  <option value="Injection">Injection</option>
                  <option value="Ointment">Ointment / Cream</option>
                  <option value="Drops">Eye/Ear Drops</option>
                  <option value="Inhaler">Inhaler</option>
                  <option value="Suppository">Suppository</option>
                  <option value="Consumable">Consumable / Device</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Strength</label>
                <input
                  type="text"
                  placeholder="e.g. 500mg, 10mg/5ml"
                  value={strength}
                  onChange={(e) => setStrength(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Unit of Measure</label>
                <input
                  type="text"
                  placeholder="Pack, Bottle, Strip, Box"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pack Size (Pcs per Pack)</label>
                <input
                  type="number"
                  min="1"
                  value={packSize}
                  onChange={(e) => setPackSize(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Manufacturer</label>
                <input
                  type="text"
                  placeholder="e.g. Ernest Chemist, Tobinco, GSK"
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reorder Level (Alert Threshold)
                </label>
                <input
                  type="number"
                  min="0"
                  value={reorderLevel}
                  onChange={(e) => setReorderLevel(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-900"
                />
              </div>
            </div>

            {/* Price & Prescription */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-100">
                <label className="block text-xs font-bold text-emerald-950 mb-1">
                  Retail Selling Price (GH₵) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-sm font-bold text-emerald-700">GH₵</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    className="w-full pl-12 pr-3 py-1.5 text-base font-bold bg-white border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Wholesale Price (GH₵) (Optional)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-sm font-semibold text-slate-500">GH₵</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={wholesalePrice}
                    onChange={(e) => setWholesalePrice(e.target.value)}
                    className="w-full pl-12 pr-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900"
                  />
                </div>
              </div>

              <div className="flex items-center p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <label className="flex items-center space-x-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={prescriptionRequired}
                    onChange={(e) => setPrescriptionRequired(e.target.checked)}
                    className="w-5 h-5 text-teal-600 rounded border-slate-300 focus:ring-teal-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Rx Prescription Required</span>
                    <span className="text-[11px] text-slate-500 block">Flag for POM medicines</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Product Image Upload */}
            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Product Image (Supabase Storage Bucket: product-images)
              </label>
              <div className="flex items-center space-x-4">
                <label className="cursor-pointer inline-flex items-center px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 shadow-2xs">
                  <Upload className="w-4 h-4 mr-2 text-slate-500" />
                  {uploadingImage ? "Uploading..." : "Choose Image"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleImageUpload(e.target.files[0]);
                      }
                    }}
                  />
                </label>
                {imageUrl && (
                  <div className="flex items-center space-x-2 text-xs text-emerald-700 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Uploaded successfully</span>
                    <img src={imageUrl} alt="preview" className="w-8 h-8 rounded object-cover border border-slate-200" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: CRITICAL INITIAL STOCK WORKFLOW */}
          <div className="rounded-2xl border-2 border-teal-200 bg-teal-50/30 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold shadow-2xs">
                  <Boxes className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    2. Initial Opening Stock & Batch Setup
                  </h3>
                  <p className="text-xs text-slate-600">
                    Immediately register batch number, quantity, cost price, and expiry date.
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasInitialStock}
                  onChange={(e) => setHasInitialStock(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                <span className="ml-3 text-xs font-bold text-slate-800">
                  {hasInitialStock ? "Add Opening Stock Now" : "Skip Initial Stock (0 Stock)"}
                </span>
              </label>
            </div>

            {hasInitialStock ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 border-t border-teal-100">
                <div className="bg-white p-3 rounded-xl border border-teal-200 shadow-2xs">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Opening Stock Quantity (Units) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required={hasInitialStock}
                    placeholder="e.g. 50"
                    value={initialQuantity}
                    onChange={(e) => setInitialQuantity(e.target.value)}
                    className="w-full px-3 py-1.5 text-base font-bold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-900"
                  />
                  <span className="text-[11px] text-slate-500 mt-0.5 block">Total physical units on hand</span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-teal-200 shadow-2xs">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-800">Batch Number *</label>
                    <button
                      type="button"
                      onClick={handleGenerateBatch}
                      className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                    >
                      Generate
                    </button>
                  </div>
                  <input
                    type="text"
                    required={hasInitialStock}
                    placeholder="e.g. BATCH-2026-01"
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-900 uppercase"
                  />
                  <span className="text-[11px] text-slate-500 mt-0.5 block">Identifies this specific lot</span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-teal-200 shadow-2xs">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Expiry Date (FEFO Mandatory) *
                  </label>
                  <input
                    type="date"
                    required={hasInitialStock}
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-900"
                  />
                  <span className="text-[11px] text-slate-500 mt-0.5 block">Used for First-Expired-First-Out</span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-teal-200 shadow-2xs">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Unit Cost Price (GH₵)
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-xs font-bold text-slate-500">GH₵</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                      className="w-full pl-11 pr-2 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-900"
                    />
                  </div>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">Used for Cost of Goods Sold (COGS)</span>
                  {costPrice && sellingPrice && parseFloat(costPrice) >= parseFloat(sellingPrice) && (
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-300 rounded-lg text-[11px] text-amber-800 font-bold flex items-center space-x-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Cost must be lower than selling price to generate profit.</span>
                    </div>
                  )}
                </div>

                <div className="bg-white p-3 rounded-xl border border-teal-200 shadow-2xs">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-800">Supplier</label>
                    <button
                      type="button"
                      onClick={() => setShowQuickSupplier(!showQuickSupplier)}
                      className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                    >
                      + New
                    </button>
                  </div>
                  {showQuickSupplier ? (
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        placeholder="Supplier name"
                        value={newSupplierName}
                        onChange={(e) => setNewSupplierName(e.target.value)}
                        className="w-full px-2.5 py-1 text-xs bg-white border border-teal-400 rounded-md"
                      />
                      <div className="flex items-center space-x-1">
                        <input
                          type="text"
                          placeholder="Phone number"
                          value={newSupplierPhone}
                          onChange={(e) => setNewSupplierPhone(e.target.value)}
                          className="w-full px-2.5 py-1 text-xs bg-white border border-teal-400 rounded-md"
                        />
                        <button
                          type="button"
                          onClick={handleCreateSupplier}
                          className="px-2 py-1 text-xs bg-teal-600 text-white rounded-md font-semibold"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowQuickSupplier(false)}
                          className="px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded-md"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <select
                      value={supplierId}
                      onChange={(e) => setSupplierId(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-900"
                    >
                      <option value="">-- Select Supplier --</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.phone})
                        </option>
                      ))}
                    </select>
                  )}
                  <span className="text-[11px] text-slate-500 mt-0.5 block">Distributor or wholesaler</span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-teal-200 shadow-2xs">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Manufacturing Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={manufacturingDate}
                    onChange={(e) => setManufacturingDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-900"
                  />
                  <span className="text-[11px] text-slate-500 mt-0.5 block">For quality compliance</span>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs flex items-center space-x-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <p>
                  <strong>No initial stock will be recorded.</strong> Product will be created with{" "}
                  <strong>Available Stock: 0</strong> (Out of Stock). You can add stock at any time using the "Add Stock"
                  workflow.
                </p>
              </div>
            )}
          </div>
        </form>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200/60 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2.5 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-xl shadow-sm transition flex items-center space-x-2"
          >
            {loading ? (
              <span>Saving to Supabase...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {hasInitialStock ? "Create Product & Add Opening Stock" : "Create Product (0 Stock)"}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
