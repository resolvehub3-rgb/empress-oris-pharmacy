import React, { useState, useEffect } from "react";
import { X, Clock, AlertCircle, CheckCircle2, DollarSign, Calculator } from "lucide-react";
import { apiRequest } from "../lib/api";

interface CloseShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  shiftData: any;
}

export function CloseShiftModal({ isOpen, onClose, onSuccess, shiftData }: CloseShiftModalProps) {
  const [actualCash, setActualCash] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !shiftData) return null;

  const openingCash = parseFloat(shiftData.summary?.openingCash || "0");
  const cashSales = parseFloat(shiftData.summary?.cash_sales || "0");
  const expectedCash = openingCash + cashSales;
  const counted = parseFloat(actualCash || "0");
  const discrepancy = actualCash !== "" ? counted - expectedCash : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (actualCash === "") {
      setError("Please count and enter the actual cash in the drawer.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await apiRequest("/api/shifts/close", {
        method: "POST",
        body: JSON.stringify({
          actualCash: parseFloat(actualCash),
          notes,
        }),
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to close shift.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200">
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Close Cashier Shift</h2>
              <p className="text-xs text-slate-500 font-medium">Reconcile drawer cash count with recorded sales</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* System Expected Breakdown */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Opening Drawer Cash:</span>
              <span className="font-semibold text-slate-900">GH₵ {openingCash.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Shift Cash Sales:</span>
              <span className="font-semibold text-slate-900">GH₵ {cashSales.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Mobile Money Sales (MTN/Telecel):</span>
              <span className="font-semibold text-slate-900">
                GH₵ {(parseFloat(shiftData.summary?.mtn_momo_sales || 0) + parseFloat(shiftData.summary?.telecel_sales || 0)).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm font-bold text-teal-800 pt-2 border-t border-slate-200">
              <span>Expected Cash in Drawer:</span>
              <span>GH₵ {expectedCash.toFixed(2)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Counted Physical Cash in Drawer (GH₵) *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2 text-sm font-bold text-slate-600">GH₵</span>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0.00"
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                className="w-full pl-14 pr-3.5 py-2 text-base font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900"
              />
            </div>
          </div>

          {/* Discrepancy Alert */}
          {discrepancy !== null && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                Math.abs(discrepancy) < 0.01
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : discrepancy > 0
                  ? "bg-blue-50 border-blue-200 text-blue-800"
                  : "bg-rose-50 border-rose-200 text-rose-800 font-bold"
              }`}
            >
              <span>Discrepancy:</span>
              <span>
                {discrepancy === 0
                  ? "Exact Match (No Discrepancy)"
                  : discrepancy > 0
                  ? `Over by +GH₵ ${discrepancy.toFixed(2)}`
                  : `Short by -GH₵ ${Math.abs(discrepancy).toFixed(2)}`}
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Closing Remarks</label>
            <textarea
              rows={2}
              placeholder="e.g. Balance verified with supervisor"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50"
            >
              {loading ? "Closing..." : "Close Shift & Save Report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
