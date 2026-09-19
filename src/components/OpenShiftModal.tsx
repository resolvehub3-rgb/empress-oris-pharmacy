import React, { useState } from "react";
import { X, Clock, DollarSign, AlertCircle, CheckCircle } from "lucide-react";
import { apiRequest } from "../lib/api";

interface OpenShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function OpenShiftModal({ isOpen, onClose, onSuccess }: OpenShiftModalProps) {
  const [openingCash, setOpeningCash] = useState("0.00");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await apiRequest("/api/shifts/open", {
        method: "POST",
        body: JSON.stringify({
          openingCash: parseFloat(openingCash) || 0,
          notes,
        }),
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to open cashier shift.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200">
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Open Cashier Shift</h2>
              <p className="text-xs text-slate-500 font-medium">Start session to process sales at POS</p>
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

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Opening Float / Drawer Cash (GH₵) *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2 text-sm font-bold text-teal-700">GH₵</span>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                className="w-full pl-14 pr-3.5 py-2 text-base font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900"
              />
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Physical cash starting in the drawer for change
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Shift Notes (Optional)</label>
            <textarea
              rows={2}
              placeholder="e.g. Morning shift, counter 1"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900"
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
              className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50"
            >
              {loading ? "Opening Shift..." : "Confirm & Start Shift"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
