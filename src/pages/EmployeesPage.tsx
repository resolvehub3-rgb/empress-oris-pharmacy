import React, { useState, useEffect } from "react";
import { Users, Plus, Shield, Mail, Phone, Lock, CheckCircle2, UserCheck, Trash2 } from "lucide-react";
import { User } from "../types";
import { apiRequest } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { subscribeToPharmacyRealtime } from "../lib/supabaseClient";

export function EmployeesPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [role, setRole] = useState<"EMPLOYEE" | "ADMIN" | "OWNER">("EMPLOYEE");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ employees: User[] }>("/api/employees");
      setEmployees(res.employees || []);
    } catch (err) {
      console.warn(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();

    const unsubscribe = subscribeToPharmacyRealtime((event) => {
      if (event === "EMPLOYEE_DELETED" || event === "EMPLOYEE_CREATED" || event === "EMPLOYEE_STATUS_CHANGED") {
        fetchEmployees();
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !fullName) return;

    setSubmitting(true);
    try {
      await apiRequest("/api/employees", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          phone: phone.trim() || null,
          employeeCode: employeeCode.trim() || `EMP-${Date.now().toString(36).toUpperCase()}`,
          role,
        }),
      });
      setShowAddModal(false);
      setEmail("");
      setPassword("");
      setFullName("");
      setPhone("");
      setEmployeeCode("");
      fetchEmployees();
    } catch (err: any) {
      alert("Failed to create employee: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (emp: User) => {
    if (!confirm(`Delete "${emp.fullName}" (${emp.email})? This cannot be undone.`)) return;

    setDeletingId(emp.id);
    try {
      await apiRequest(`/api/employees/${emp.id}`, { method: "DELETE" });
      fetchEmployees();
    } catch (err: any) {
      alert("Failed to delete employee: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Pharmacy Staff & Cashiers (RBAC)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage user accounts, POS dispensing access, and permission levels.
          </p>
        </div>

        {(user?.role === "OWNER" || user?.role === "ADMIN") && (
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Cashier / Staff</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-12 text-center text-slate-400">
            <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-xs font-bold">Querying users from Supabase...</span>
          </div>
        ) : employees.length === 0 ? (
          <div className="col-span-full p-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
            <Users className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-700">No staff members found</p>
          </div>
        ) : (
          employees.map((emp) => (
            <div key={emp.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-sm">
                    {emp.fullName?.charAt(0) || "U"}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{emp.fullName}</h4>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        emp.role === "OWNER"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-teal-100 text-teal-800"
                      }`}
                    >
                      {emp.role}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1 text-xs text-slate-600 pt-2 border-t border-slate-100">
                <div className="flex items-center space-x-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate">{emp.email}</span>
                </div>
                {emp.phone && (
                  <div className="flex items-center space-x-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{emp.phone}</span>
                  </div>
                )}
              </div>

              {(user?.role === "OWNER" || user?.role === "ADMIN") && emp.id !== user?.id && (
                <div className="pt-2 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => handleDeleteEmployee(emp)}
                    disabled={deletingId === emp.id}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-lg transition flex items-center space-x-1 disabled:opacity-50"
                  >
                    {deletingId === emp.id ? (
                      <div className="w-3.5 h-3.5 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    <span>{deletingId === emp.id ? "Deleting..." : "Delete"}</span>
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
              <h3 className="text-base font-bold text-slate-900">Add Cashier / Staff Member</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ama Mensah"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="cashier@pharmacy.gh"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number (Ghana)</label>
                <input
                  type="tel"
                  placeholder="024 000 0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Employee Code *</label>
                <input
                  type="text"
                  placeholder="e.g. EMP-001 (auto-generated if empty)"
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">System Role *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold"
                >
                  <option value="EMPLOYEE">Cashier / Dispenser (POS & Sales only)</option>
                  <option value="ADMIN">Admin (Employee Management)</option>
                  <option value="OWNER">Owner / Pharmacist (Full Access)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  placeholder="Set initial login password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl"
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
                  {submitting ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
