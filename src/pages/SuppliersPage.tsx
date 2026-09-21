import React, { useState, useEffect } from "react";
import { Truck, Plus, Phone, Mail, MapPin, Trash2 } from "lucide-react";
import { Supplier } from "../types";
import { apiRequest } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { subscribeToPharmacyRealtime } from "../lib/supabaseClient";

export function SuppliersPage() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // New Supplier Form
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ suppliers: Supplier[] }>("/api/suppliers");
      setSuppliers(res.suppliers || []);
    } catch (err) {
      console.warn(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();

    const unsubscribe = subscribeToPharmacyRealtime((event) => {
      if (event === "SUPPLIER_CREATED" || event === "SUPPLIER_DELETED") {
        fetchSuppliers();
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      await apiRequest("/api/suppliers", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          contactPerson: contactPerson.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          address: address.trim() || null,
        }),
      });
      setShowAddModal(false);
      setName("");
      setContactPerson("");
      setPhone("");
      setEmail("");
      setAddress("");
      fetchSuppliers();
    } catch (err: any) {
      alert("Failed to create supplier: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSupplier = async (supplier: Supplier) => {
    if (!confirm(`Delete "${supplier.name}"? This cannot be undone.`)) return;

    setDeletingId(supplier.id);
    try {
      await apiRequest(`/api/suppliers/${supplier.id}`, { method: "DELETE" });
      fetchSuppliers();
    } catch (err: any) {
      alert("Failed to delete supplier: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Pharmaceutical Suppliers & Distributors
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage pharmaceutical wholesalers and manufacturers in Ghana.
          </p>
        </div>

        {(user?.role === "OWNER" || user?.role === "ADMIN") && (
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Supplier</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-12 text-center text-slate-400">
            <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-xs font-bold">Querying suppliers...</span>
          </div>
        ) : suppliers.length === 0 ? (
          <div className="col-span-full p-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 space-y-2">
            <Truck className="w-12 h-12 mx-auto text-slate-300" />
            <h3 className="text-sm font-bold text-slate-700">No suppliers registered</h3>
            <p className="text-xs text-slate-400">Add distributors to track medicine purchase orders and batches.</p>
          </div>
        ) : (
          suppliers.map((s) => (
            <div key={s.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{s.name}</h3>
                  {s.contactPerson && (
                    <p className="text-xs text-slate-500">Contact: {s.contactPerson}</p>
                  )}
                </div>
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                {s.phone && (
                  <div className="flex items-center space-x-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{s.phone}</span>
                  </div>
                )}
                {s.email && (
                  <div className="flex items-center space-x-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{s.email}</span>
                  </div>
                )}
                {s.address && (
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{s.address}</span>
                  </div>
                )}
              </div>

              {(user?.role === "OWNER" || user?.role === "ADMIN") && (
                <div className="pt-2 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => handleDeleteSupplier(s)}
                    disabled={deletingId === s.id}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-lg transition flex items-center space-x-1 disabled:opacity-50"
                  >
                    {deletingId === s.id ? (
                      <div className="w-3.5 h-3.5 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    <span>{deletingId === s.id ? "Deleting..." : "Delete"}</span>
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Add Pharmacy Supplier</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSupplier} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Supplier / Wholesaler Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kinapharma Ltd, Tobinco Pharmaceuticals"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    placeholder="Representative"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="024 000 0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="orders@supplier.gh"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Office / Warehouse Address</label>
                <input
                  type="text"
                  placeholder="Industrial Area, North Kaneshie, Accra"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
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
                  {submitting ? "Saving..." : "Save Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
