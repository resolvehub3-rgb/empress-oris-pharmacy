import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Barcode,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  CreditCard,
  Phone,
  Tag,
  Package,
  Camera,
  QrCode,
} from "lucide-react";
import { Product, CartItem, Category } from "../types";
import { apiRequest } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { ReceiptModal } from "../components/ReceiptModal";
import { CameraScannerModal } from "../components/CameraScannerModal";

interface PosPageProps {
  onOpenShiftClick: () => void;
  hasOpenShift: boolean;
}

export function PosPage({ onOpenShiftClick, hasOpenShift }: PosPageProps) {
  const { user } = useAuth();

  // Search & Products
  const [searchQuery, setSearchQuery] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [overallDiscount, setOverallDiscount] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [amountReceived, setAmountReceived] = useState("");
  const [transactionRef, setTransactionRef] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Completed Receipt Modal State
  const [receiptData, setReceiptData] = useState<any | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Camera QR & Barcode Scanner State
  const [showCameraScanner, setShowCameraScanner] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Load initial products and categories
  const fetchProducts = async (q = "", cat = "") => {
    setLoading(true);
    try {
      const res = await apiRequest<{ products: Product[] }>(
        `/api/pos/search?query=${encodeURIComponent(q)}${cat ? `&categoryId=${cat}` : ""}`
      );
      setProducts(res.products || []);
    } catch (err) {
      console.warn("[POS Search] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await apiRequest<{ categories: Category[] }>("/api/categories");
      setCategories(res.categories || []);
    } catch (err) {
      // ignore
    }
  };

  useEffect(() => {
    fetchProducts(searchQuery, selectedCategory);
    fetchCategories();
  }, [selectedCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts(searchQuery, selectedCategory);
  };

  // Barcode scanner handler
  const handleBarcodeKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && barcodeInput.trim()) {
      e.preventDefault();
      try {
        const res = await apiRequest<{ products: Product[] }>(
          `/api/pos/search?barcode=${encodeURIComponent(barcodeInput.trim())}`
        );
        if (res.products && res.products.length > 0) {
          addToCart(res.products[0]);
          setBarcodeInput("");
        } else {
          // search regular query
          fetchProducts(barcodeInput.trim());
        }
      } catch (err) {
        console.warn(err);
      }
    }
  };

  // Cart Operations
  const addToCart = (product: Product) => {
    const existingIndex = cart.findIndex((item) => item.product.id === product.id);
    const availableStock = product.totalStock || 0;

    if (availableStock <= 0) {
      alert(`"${product.name}" is out of stock!`);
      return;
    }

    if (existingIndex > -1) {
      const currentQty = cart[existingIndex].quantity;
      if (currentQty + 1 > availableStock) {
        alert(`Cannot exceed available non-expired stock of ${availableStock} units.`);
        return;
      }
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      updated[existingIndex].totalPrice =
        (updated[existingIndex].quantity * updated[existingIndex].unitPrice) -
        updated[existingIndex].discount;
      setCart(updated);
    } else {
      const unitPrice = parseFloat(product.sellingPrice || "0");
      setCart([
        ...cart,
        {
          product,
          quantity: 1,
          unitPrice,
          discount: 0,
          totalPrice: unitPrice,
        },
      ]);
    }
  };

  const updateQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }

    const item = cart.find((i) => i.product.id === productId);
    if (!item) return;

    if (newQty > item.product.totalStock) {
      alert(`Cannot exceed available stock of ${item.product.totalStock} units.`);
      return;
    }

    setCart(
      cart.map((i) => {
        if (i.product.id === productId) {
          return {
            ...i,
            quantity: newQty,
            totalPrice: (newQty * i.unitPrice) - i.discount,
          };
        }
        return i;
      })
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setOverallDiscount("");
    setCustomerName("");
    setCustomerPhone("");
  };

  // Calculations
  const subtotal = cart.reduce((acc, item) => acc + item.totalPrice, 0);
  const discountAmount = parseFloat(overallDiscount) || 0;
  const grandTotal = Math.max(0, subtotal - discountAmount);

  // Cash preset buttons
  const setQuickCash = (amt: number) => {
    setAmountReceived(amt.toString());
  };

  const amtReceivedNum = parseFloat(amountReceived) || 0;
  const changeGiven = paymentMethod === "CASH" ? Math.max(0, amtReceivedNum - grandTotal) : 0;

  // Checkout submission
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError(null);

    if (paymentMethod === "CASH" && amtReceivedNum < grandTotal) {
      setCheckoutError(
        `Amount received (GH₵ ${amtReceivedNum.toFixed(2)}) is less than total payable (GH₵ ${grandTotal.toFixed(2)}).`
      );
      return;
    }

    setCheckoutLoading(true);
    try {
      const payload = {
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
        })),
        customerName: customerName.trim() || null,
        customerPhone: customerPhone.trim() || null,
        paymentMethod,
        amountReceived: paymentMethod === "CASH" ? amtReceivedNum : grandTotal,
        transactionReference: transactionRef.trim() || null,
        discount: discountAmount,
      };

      const res = await apiRequest<{ success: boolean; receipt: any }>("/api/pos/checkout", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.receipt) {
        setReceiptData(res.receipt);
        setShowReceiptModal(true);
        setShowPaymentModal(false);
        clearCart();
        // Refresh product stock
        fetchProducts(searchQuery, selectedCategory);
      }
    } catch (err: any) {
      setCheckoutError(err.message || "Checkout failed.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] overflow-hidden bg-slate-100">
      {/* Shift Warning Banner if not open */}
      {!hasOpenShift && (
        <div className="absolute top-16 left-0 right-0 z-20 bg-amber-500 text-slate-900 px-4 py-2.5 flex items-center justify-between text-xs font-bold shadow-md">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4" />
            <span>You must open a cashier shift before completing sales.</span>
          </div>
          <button
            onClick={onOpenShiftClick}
            className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-900 rounded-lg text-xs font-black shadow-xs"
          >
            Open Shift Now
          </button>
        </div>
      )}

      {/* LEFT COLUMN: Product Catalog & Search (65% width on desktop) */}
      <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-4">
        {/* Search & Barcode Bar */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row gap-2.5 items-center">
          {/* Text Search */}
          <form onSubmit={handleSearchSubmit} className="flex-1 w-full relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by drug name, generic name, or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-900"
            />
          </form>

          {/* Barcode Scanner Input */}
          <div className="w-full sm:w-56 relative">
            <Barcode className="w-4 h-4 absolute left-3.5 top-3 text-teal-600" />
            <input
              ref={barcodeInputRef}
              type="text"
              placeholder="Scan Barcode & [Enter]"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={handleBarcodeKeyDown}
              className="w-full pl-10 pr-3.5 py-2 text-xs bg-teal-50/50 border border-teal-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-900 font-mono"
            />
          </div>

          {/* Camera QR & Barcode Scanner Button */}
          <button
            type="button"
            onClick={() => setShowCameraScanner(true)}
            className="w-full sm:w-auto px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-teal-300 font-bold text-xs rounded-xl shadow-2xs transition flex items-center justify-center space-x-1.5 shrink-0 border border-slate-700"
            title="Open camera to scan QR codes and barcodes directly"
          >
            <Camera className="w-4 h-4 text-teal-400" />
            <span>Camera Scanner</span>
          </button>

          <button
            onClick={() => fetchProducts(searchQuery, selectedCategory)}
            className="w-full sm:w-auto px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-2xs transition shrink-0"
          >
            Search
          </button>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs select-none">
          <button
            onClick={() => setSelectedCategory("")}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition ${
              selectedCategory === ""
                ? "bg-slate-900 text-white shadow-2xs"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            All Medicines
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition ${
                selectedCategory === c.id
                  ? "bg-teal-600 text-white shadow-2xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Product Cards Grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-2">
                <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-400 font-semibold">Querying live inventory from Supabase...</p>
              </div>
            </div>
          ) : products.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center p-8 bg-white rounded-2xl border border-slate-200 max-w-sm">
                <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">No products found</p>
                <p className="text-xs text-slate-400 mt-1">
                  Add medicines with opening stock from the dashboard or check your search keywords.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {products.map((product) => {
                const isOutOfStock = product.totalStock <= 0;
                return (
                  <div
                    key={product.id}
                    onClick={() => !isOutOfStock && addToCart(product)}
                    className={`bg-white rounded-2xl p-3.5 border transition-all flex flex-col justify-between select-none ${
                      isOutOfStock
                        ? "opacity-50 border-slate-200 cursor-not-allowed bg-slate-50"
                        : "border-slate-200 hover:border-teal-400 hover:shadow-md cursor-pointer active:scale-98"
                    }`}
                  >
                    <div>
                      {/* Product Badges */}
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 truncate max-w-[90px]">
                          {product.categoryName || product.dosageForm || "Medicine"}
                        </span>
                        {product.prescriptionRequired && (
                          <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-amber-100 text-amber-800 shrink-0">
                            Rx Only
                          </span>
                        )}
                      </div>

                      {/* Product Name & SKU */}
                      <h4 className="text-xs font-bold text-slate-900 line-clamp-2 leading-tight">
                        {product.name}
                      </h4>
                      {product.genericName && (
                        <p className="text-[10px] text-slate-500 italic truncate mt-0.5">
                          {product.genericName}
                        </p>
                      )}
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                        SKU: {product.sku}
                      </p>
                    </div>

                    {/* Pricing and Stock Level */}
                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-end justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">Retail Price</span>
                        <span className="text-sm font-black text-slate-900">
                          GH₵ {parseFloat(product.sellingPrice).toFixed(2)}
                        </span>
                      </div>

                      <div className="text-right">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full block ${
                            isOutOfStock
                              ? "bg-rose-100 text-rose-800"
                              : product.totalStock <= product.reorderLevel
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {isOutOfStock ? "Out of Stock" : `${product.totalStock} in stock`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Interactive Cart & Checkout (35% width on desktop) */}
      <div className="w-full lg:w-96 bg-white border-l border-slate-200 flex flex-col justify-between shadow-lg">
        {/* Cart Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <ShoppingCart className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-900">Active Order</h3>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
              {cart.reduce((a, b) => a + b.quantity, 0)} items
            </span>
          </div>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center space-x-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-slate-100">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <ShoppingCart className="w-10 h-10 text-slate-300 mb-2" />
              <p className="text-xs font-bold text-slate-600">Cart is empty</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Scan barcode or click items from the left catalog to add to sale.
              </p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="pt-2 first:pt-0 space-y-1.5">
                <div className="flex justify-between items-start">
                  <div className="pr-2">
                    <h5 className="text-xs font-bold text-slate-900 line-clamp-1">{item.product.name}</h5>
                    <p className="text-[11px] text-slate-500 font-mono">
                      GH₵ {item.unitPrice.toFixed(2)} / unit
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-black text-slate-900">
                      GH₵ {item.totalPrice.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  {/* Quantity Stepper */}
                  <div className="flex items-center space-x-1 bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      className="w-6 h-6 rounded bg-white text-slate-700 hover:bg-slate-200 flex items-center justify-center font-bold text-xs"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={item.product.totalStock}
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item.product.id, parseInt(e.target.value) || 1)}
                      className="w-10 text-center text-xs font-bold bg-transparent focus:outline-none"
                    />
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      className="w-6 h-6 rounded bg-white text-slate-700 hover:bg-slate-200 flex items-center justify-center font-bold text-xs"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="text-slate-400 hover:text-rose-600 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Customer & Discount Controls */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/70 space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <input
                type="text"
                placeholder="Customer Name (Opt)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <input
                type="text"
                placeholder="Phone (Ghana)"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-600">Discount (GH₵):</span>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={overallDiscount}
              onChange={(e) => setOverallDiscount(e.target.value)}
              className="w-24 px-2 py-1 text-right text-xs bg-white border border-slate-300 rounded-lg font-bold"
            />
          </div>

          <div className="pt-2 border-t border-slate-200 space-y-1">
            <div className="flex justify-between text-slate-600 text-xs">
              <span>Subtotal:</span>
              <span className="font-semibold text-slate-900">GH₵ {subtotal.toFixed(2)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-emerald-700 text-xs font-semibold">
                <span>Discount Applied:</span>
                <span>- GH₵ {discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-black text-slate-900 pt-1">
              <span>Total Payable:</span>
              <span className="text-teal-700 font-mono">GH₵ {grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Proceed to Payment Button */}
          <button
            onClick={() => {
              if (cart.length === 0) return;
              if (!hasOpenShift) {
                onOpenShiftClick();
                return;
              }
              setAmountReceived(grandTotal.toFixed(2));
              setShowPaymentModal(true);
            }}
            disabled={cart.length === 0}
            className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-black text-sm rounded-xl shadow-md transition flex items-center justify-center space-x-2"
          >
            <CreditCard className="w-4 h-4" />
            <span>Charge GH₵ {grandTotal.toFixed(2)}</span>
          </button>
        </div>
      </div>

      {/* PAYMENT & CASH RECONCILIATION MODAL */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
              <div>
                <h3 className="text-base font-bold text-slate-900">Select Payment Method</h3>
                <p className="text-xs text-slate-500">Ghanaian Cash & Mobile Money Checkout</p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCheckoutSubmit} className="p-6 space-y-4">
              {checkoutError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{checkoutError}</span>
                </div>
              )}

              {/* Total Banner */}
              <div className="p-4 bg-teal-50 rounded-xl border border-teal-200 text-center">
                <span className="text-xs font-bold text-teal-800 uppercase tracking-wider">Amount Due</span>
                <div className="text-3xl font-black text-teal-900 font-mono mt-0.5">
                  GH₵ {grandTotal.toFixed(2)}
                </div>
              </div>

              {/* Payment Methods Grid */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "CASH", label: "Cash" },
                  { id: "MTN_MOMO", label: "MTN MoMo" },
                  { id: "TELECEL_CASH", label: "Telecel Cash" },
                  { id: "AIRTELTIGO_MONEY", label: "AirtelTigo" },
                  { id: "CARD", label: "Card / POS" },
                  { id: "BANK_TRANSFER", label: "Transfer" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id)}
                    className={`py-2 px-1 text-center rounded-xl text-xs font-bold border transition ${
                      paymentMethod === m.id
                        ? "bg-teal-600 text-white border-teal-600 shadow-2xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Cash Controls: Amount Received & Change Given */}
              {paymentMethod === "CASH" ? (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Cash Received from Customer (GH₵) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2 text-sm font-bold text-teal-700">GH₵</span>
                      <input
                        type="number"
                        step="0.01"
                        min={grandTotal}
                        required
                        value={amountReceived}
                        onChange={(e) => setAmountReceived(e.target.value)}
                        className="w-full pl-14 pr-3.5 py-2 text-lg font-black bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900"
                      />
                    </div>
                  </div>

                  {/* Ghana Cedis Quick Notes */}
                  <div className="flex flex-wrap gap-1.5">
                    {[grandTotal, 10, 20, 50, 100, 200].map((amt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setQuickCash(amt)}
                        className="px-2.5 py-1 text-xs font-bold bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700"
                      >
                        {idx === 0 ? "Exact" : `GH₵ ${amt}`}
                      </button>
                    ))}
                  </div>

                  {/* Calculated Change */}
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex justify-between items-center text-emerald-950 font-bold text-sm">
                    <span>Change Due to Customer:</span>
                    <span className="text-base font-black font-mono">
                      GH₵ {changeGiven.toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="pt-2 space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Transaction ID / Reference Number
                  </label>
                  <input
                    type="text"
                    placeholder="Enter MoMo TxID or Approval Code"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900"
                  />
                </div>
              )}

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={checkoutLoading}
                  className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center space-x-2 disabled:opacity-50"
                >
                  {checkoutLoading ? (
                    <span>Allocating Batches (FEFO)...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Complete Sale & Print Receipt</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      {showReceiptModal && receiptData && (
        <ReceiptModal
          isOpen={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
          receiptData={receiptData}
        />
      )}

      {/* Camera QR & Barcode Scanner Modal */}
      {showCameraScanner && (
        <CameraScannerModal
          isOpen={showCameraScanner}
          onClose={() => setShowCameraScanner(false)}
          onProductScanned={(product) => addToCart(product)}
        />
      )}
    </div>
  );
}
