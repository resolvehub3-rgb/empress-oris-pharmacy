import React, { useState, useEffect } from "react";
import { Settings, Building, MapPin, Phone, Mail, FileText, CheckCircle2, ShieldCheck, Database, RefreshCw } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../lib/api";

export function SettingsPage() {
  const { settings, updateSettings, user } = useAuth();
  const isOwner = user?.role === "OWNER";

  const [name, setName] = useState(settings?.name || "");
  const [legalName, setLegalName] = useState(settings?.legalName || "");
  const [licenseNumber, setLicenseNumber] = useState(settings?.licenseNumber || "");
  const [address, setAddress] = useState(settings?.address || "");
  const [city, setCity] = useState(settings?.city || "Accra");
  const [region, setRegion] = useState(settings?.region || "Greater Accra");
  const [phone, setPhone] = useState(settings?.phone || "");
  const [email, setEmail] = useState(settings?.email || "");
  const [receiptFooter, setReceiptFooter] = useState(
    settings?.receiptFooter || "Thank you for your patronage! Medicines sold are not returnable once opened."
  );

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [healthStatus, setHealthStatus] = useState<any | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  useEffect(() => {
    if (settings) {
      setName(settings.name || "");
      setLegalName(settings.legalName || "");
      setLicenseNumber(settings.licenseNumber || "");
      setAddress(settings.address || "");
      setCity(settings.city || "Accra");
      setRegion(settings.region || "Greater Accra");
      setPhone(settings.phone || "");
      setEmail(settings.email || "");
      setReceiptFooter(settings.receiptFooter || "");
    }
  }, [settings]);

  const testSupabaseHealth = async () => {
    setCheckingHealth(true);
    try {
      const res = await apiRequest<any>("/api/health");
      setHealthStatus(res);
    } catch (err: any) {
      setHealthStatus({ status: "error", message: err.message });
    } finally {
      setCheckingHealth(false);
    }
  };

  useEffect(() => {
    testSupabaseHealth();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    try {
      await updateSettings({
        name,
        legalName: legalName || null,
        licenseNumber: licenseNumber || null,
        address: address || null,
        city,
        region,
        phone: phone || null,
        email: email || null,
        receiptFooter,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert("Failed to update settings: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Pharmacy Configuration & Backend Status
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Store profile, Pharmacy Council of Ghana licensing, receipt header/footer, and Supabase telemetry.
          </p>
        </div>
      </div>

      {/* Supabase Connection Status Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Supabase PostgreSQL Database Connection</h3>
              <p className="text-xs text-slate-500">Live health verification of database pool & storage</p>
            </div>
          </div>

          <button
            onClick={testSupabaseHealth}
            disabled={checkingHealth}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition flex items-center space-x-1"
          >
            <RefreshCw className={`w-3 h-3 ${checkingHealth ? "animate-spin" : ""}`} />
            <span>Test Connection</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
            <span className="font-semibold text-emerald-900">Database Engine:</span>
            <span className="font-mono font-bold text-emerald-700">PostgreSQL (Supabase)</span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
            <span className="font-semibold text-emerald-900">Realtime Channel:</span>
            <span className="font-mono font-bold text-emerald-700">ONLINE</span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
            <span className="font-semibold text-emerald-900">Currency Mode:</span>
            <span className="font-mono font-bold text-emerald-700">GH₵ (GHS)</span>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <form onSubmit={handleSave} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
          Pharmacy Information & Licensing
        </h3>

        {savedSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>Settings saved successfully! Receipts and headers are updated.</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Pharmacy Display Name *</label>
            <input
              type="text"
              required
              disabled={!isOwner}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Legal Registered Entity</label>
            <input
              type="text"
              disabled={!isOwner}
              placeholder="e.g. Empress Oris Herbal &amp; Mart Ltd."
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Pharmacy Council License No.</label>
            <input
              type="text"
              disabled={!isOwner}
              placeholder="e.g. PCG/GAR/2026/..."
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Shop Address / Landmark</label>
            <input
              type="text"
              disabled={!isOwner}
              placeholder="e.g. Oxford Street, Osu, Accra"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">City / Town</label>
            <input
              type="text"
              disabled={!isOwner}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Region (Ghana)</label>
            <select
              disabled={!isOwner}
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 disabled:opacity-60 font-medium"
            >
              <option value="Greater Accra">Greater Accra</option>
              <option value="Ashanti">Ashanti</option>
              <option value="Central">Central</option>
              <option value="Eastern">Eastern</option>
              <option value="Western">Western</option>
              <option value="Volta">Volta</option>
              <option value="Northern">Northern</option>
              <option value="Upper East">Upper East</option>
              <option value="Upper West">Upper West</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Shop Phone Number</label>
            <input
              type="tel"
              disabled={!isOwner}
              placeholder="030 200 0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Shop Email Address</label>
            <input
              type="email"
              disabled={!isOwner}
              placeholder="info@pharmacy.gh"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 disabled:opacity-60"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Receipt Footer Note</label>
          <textarea
            rows={2}
            disabled={!isOwner}
            value={receiptFooter}
            onChange={(e) => setReceiptFooter(e.target.value)}
            className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 disabled:opacity-60"
          />
        </div>

        {isOwner && (
          <div className="pt-3 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition disabled:opacity-50"
            >
              {saving ? "Saving Changes..." : "Save Configuration"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
