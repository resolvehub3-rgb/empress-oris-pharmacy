import React, { useState, useEffect } from "react";
import { Wallet, Plus, Calendar, Tag, AlertCircle } from "lucide-react";
import { Expense } from "../types";
import { apiRequest } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export function ExpensesPage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // New Expense Form State
  const [category, setCategory] = useState("UTILITIES");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ expenses: any[] }>("/api/expenses");
      setExpenses(res.expenses || []);
    } catch (err) {
      console.warn(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amount) return;

    setSubmitting(true);
    try {
      await apiRequest("/api/expenses", {
        method: "POST",
        body: JSON.stringify({
          category,
          title: title.trim(),
          amount: parseFloat(amount),
          paymentMethod,
          notes: notes.trim() || null,
        }),
      });
      setShowAddModal(false);
      setTitle("");
      setAmount("");
      setNotes("");
      fetchExpenses();
    } catch (err: any) {
      alert("Failed to record expense: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const totalExpenses = expenses.reduce((acc, e: any) => acc + parseFloat(e.amount || 0), 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Operating Expenses & Overhead
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Log pharmacy overhead (ECG electricity, generator fuel, rent, salaries, packaging, licenses).
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-right pr-3 border-r border-slate-200 hidden sm:block">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Logged</span>
            <span className="text-base font-black text-slate-900 font-mono">
              GH₵ {totalExpenses.toFixed(2)}
            </span>
          </div>

          {user?.role === "OWNER" && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Record Expense</span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-xs font-bold">Querying expenses...</span>
          </div>
        ) : expenses.length === 0 ? (
          <div className="p-16 text-center text-slate-400 space-y-2">
            <Wallet className="w-12 h-12 mx-auto text-slate-300" />
            <h3 className="text-sm font-bold text-slate-700">No expenses recorded</h3>
            <p className="text-xs text-slate-400">Record overhead costs to calculate accurate net profit.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Expense Title</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Payment Mode</th>
                  <th className="px-5 py-3 text-right">Amount (GH₵)</th>
                  <th className="px-5 py-3">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {expenses.map((e: any) => (
                  <tr key={e.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                      {new Date(e.created_at || e.createdAt).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-slate-900">
                      {e.title}
                      {e.notes && <p className="text-[11px] text-slate-500 font-normal">{e.notes}</p>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                        {e.category}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 uppercase font-semibold">
                      {(e.payment_method || e.paymentMethod || "CASH").replace("_", " ")}
                    </td>
                    <td className="px-5 py-3.5 text-right font-black font-mono text-slate-900">
                      GH₵ {parseFloat(e.amount || "0").toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 font-semibold">{e.user_name || "Owner"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Record Operational Expense</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Expense Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold"
                >
                  <option value="UTILITIES">Utilities (ECG Power, Water, Internet)</option>
                  <option value="RENT">Shop Rent</option>
                  <option value="SALARIES">Staff Salaries / Allowances</option>
                  <option value="PACKAGING">Packaging & Dispensing Bags</option>
                  <option value="MAINTENANCE">Equipment & AC Maintenance</option>
                  <option value="REGULATORY">Pharmacy Council / FDA Licensing</option>
                  <option value="TRANSPORT">Transport & Delivery</option>
                  <option value="OTHER">Other Operational Expense</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Title / Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ECG Prepaid Electricity Recharge, AC Servicing"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Amount (GH₵) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-teal-700">GH₵</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full pl-12 pr-3 py-2 text-sm font-bold bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Paid Via</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                >
                  <option value="CASH">Cash Drawer</option>
                  <option value="MTN_MOMO">MTN MoMo</option>
                  <option value="TELECEL_CASH">Telecel Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Receipt Number</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Meter No: 1420..., receipt filed in cabinet"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
