import React, { useState, useEffect } from "react";
import { Receipt, Search, Printer, RotateCcw, AlertCircle, CheckCircle2, Calendar } from "lucide-react";
import { Sale } from "../types";
import { apiRequest } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { ReceiptModal } from "../components/ReceiptModal";

export function SalesPage() {
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [receiptSearch, setReceiptSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");

  // Receipt Modal State
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  // Refund Modal State
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundSale, setRefundSale] = useState<any | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundLoading, setRefundLoading] = useState(false);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const url = `/api/sales?receiptNumber=${encodeURIComponent(receiptSearch)}${
        paymentFilter ? `&paymentMethod=${paymentFilter}` : ""
      }`;
      const res = await apiRequest<{ sales: any[] }>(url);
      setSales(res.sales || []);
    } catch (err) {
      console.warn("[SalesPage] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, [paymentFilter]);

  const handleReprintReceipt = async (saleId: string) => {
    try {
      const res = await apiRequest<{ sale: any; items: any[]; pharmacy: any }>(`/api/sales/${saleId}`);
      if (res.sale) {
        setSelectedReceipt({
          pharmacyName: res.pharmacy?.name,
          pharmacyAddress: res.pharmacy?.address,
          pharmacyPhone: res.pharmacy?.phone,
          receiptFooter: res.pharmacy?.receiptFooter,
          receiptNumber: res.sale.receipt_number,
          date: res.sale.created_at,
          cashierName: res.sale.cashier_name,
          customerName: res.sale.customer_name,
          customerPhone: res.sale.customer_phone,
          items: res.items.map((i) => ({
            productName: i.product_name,
            quantity: i.quantity,
            unitPrice: i.unit_price,
            totalPrice: i.total_price,
          })),
          subtotal: res.sale.subtotal,
          discount: res.sale.discount,
          totalAmount: res.sale.total_amount,
          paymentMethod: res.sale.payment_method,
          amountReceived: res.sale.amount_received,
          changeGiven: res.sale.change_given,
          transactionReference: res.sale.transaction_reference,
        });
        setShowReceipt(true);
      }
    } catch (err: any) {
      alert("Failed to load receipt: " + err.message);
    }
  };

  const handleOpenRefund = async (sale: Sale) => {
    try {
      const res = await apiRequest<{ sale: any; items: any[] }>(`/api/sales/${sale.id}`);
      setRefundSale(res);
      setRefundReason("");
      setShowRefundModal(true);
    } catch (err: any) {
      alert("Error preparing refund: " + err.message);
    }
  };

  const handleConfirmRefund = async () => {
    if (!refundSale || !refundReason.trim()) {
      alert("Refund reason is required.");
      return;
    }

    setRefundLoading(true);
    try {
      const itemsToRefund = refundSale.items.map((item: any) => ({
        saleItemId: item.id,
        productId: item.product_id,
        batchId: item.batch_details?.[0]?.batch_id || null,
        quantity: item.quantity,
        refundAmount: item.total_price,
        restock: true,
      }));

      await apiRequest("/api/sales/refund", {
        method: "POST",
        body: JSON.stringify({
          saleId: refundSale.sale.id,
          items: itemsToRefund,
          reason: refundReason.trim(),
        }),
      });

      alert("Refund processed successfully and inventory restored.");
      setShowRefundModal(false);
      fetchSales();
    } catch (err: any) {
      alert("Refund failed: " + err.message);
    } finally {
      setRefundLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Sales & Receipts Register
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete transaction history with thermal receipt reprints and authorized returns.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchSales();
          }}
          className="flex-1 w-full relative"
        >
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by receipt number (e.g. GH-REC-)..."
            value={receiptSearch}
            onChange={(e) => setReceiptSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </form>

        <div className="flex items-center space-x-2">
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800"
          >
            <option value="">All Payment Modes</option>
            <option value="CASH">Cash</option>
            <option value="MTN_MOMO">MTN Mobile Money</option>
            <option value="TELECEL_CASH">Telecel Cash</option>
            <option value="AIRTELTIGO_MONEY">AirtelTigo Money</option>
            <option value="CARD">Card / POS</option>
          </select>

          <button
            onClick={() => fetchSales()}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-2xs"
          >
            Filter
          </button>
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-xs font-bold">Querying sales from Supabase...</span>
          </div>
        ) : sales.length === 0 ? (
          <div className="p-16 text-center text-slate-400 space-y-2">
            <Receipt className="w-12 h-12 mx-auto text-slate-300" />
            <h3 className="text-sm font-bold text-slate-700">No sales records found</h3>
            <p className="text-xs text-slate-400">Processed POS sales will be logged here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3">Receipt No</th>
                  <th className="px-5 py-3">Date / Time</th>
                  <th className="px-5 py-3">Cashier</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Payment</th>
                  <th className="px-5 py-3 text-right">Amount (GH₵)</th>
                  <th className="px-5 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {sales.map((sale: any) => (
                  <tr key={sale.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-900">
                      {sale.receipt_number || sale.receiptNumber}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                      {new Date(sale.created_at || sale.createdAt).toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-800">
                      {sale.cashier_name || sale.cashierName}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {sale.customer_name || "Walk-in Patient"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                        {(sale.payment_method || sale.paymentMethod || "CASH").replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-black font-mono text-slate-900">
                      GH₵ {parseFloat(sale.total_amount || sale.totalAmount || "0").toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          sale.status === "COMPLETED"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {sale.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-2">
                      <button
                        onClick={() => handleReprintReceipt(sale.id)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs inline-flex items-center space-x-1"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print</span>
                      </button>

                      {user?.role === "OWNER" && sale.status === "COMPLETED" && (
                        <button
                          onClick={() => handleOpenRefund(sale)}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-xs inline-flex items-center space-x-1"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Refund</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Printable Receipt Modal */}
      {showReceipt && selectedReceipt && (
        <ReceiptModal
          isOpen={showReceipt}
          onClose={() => setShowReceipt(false)}
          receiptData={selectedReceipt}
        />
      )}

      {/* Refund Modal */}
      {showRefundModal && refundSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Authorize Refund & Restock</h3>
              <button
                onClick={() => setShowRefundModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="bg-rose-50 p-3 rounded-xl border border-rose-200 text-xs text-rose-900 space-y-1">
              <p>
                <strong>Receipt:</strong> {refundSale.sale.receipt_number}
              </p>
              <p>
                <strong>Total Refund:</strong> GH₵{" "}
                {parseFloat(refundSale.sale.total_amount).toFixed(2)}
              </p>
              <p className="text-[11px] text-rose-700">
                This will mark the sale as REFUNDED and automatically restore the inventory to its original batches.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Reason for Return / Refund *
              </label>
              <textarea
                rows={2}
                required
                placeholder="e.g. Patient returned unopened wrong prescription"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowRefundModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRefund}
                disabled={refundLoading}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs disabled:opacity-50"
              >
                {refundLoading ? "Processing Refund..." : "Confirm Refund & Restock"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
