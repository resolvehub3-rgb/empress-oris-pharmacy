import React, { useState } from "react";
import { Shield, Building, Mail, Lock, User, Phone, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function AuthPage() {
  const { status, login, setupOwner } = useAuth();
  const isFirstTimeSetup = status?.hasOwner === false;

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Setup form state
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [pharmacyName, setPharmacyName] = useState("Empress Oris Herbal & Mart");
  const [pharmacyAddress, setPharmacyAddress] = useState("Accra, Ghana");
  const [pharmacyPhone, setPharmacyPhone] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(loginEmail.trim(), loginPassword);
    } catch (err: any) {
      setError(err.message || "Failed to log in.");
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!ownerEmail || !ownerName) {
      setError("Owner full name and email are required.");
      return;
    }

    setLoading(true);
    try {
      await setupOwner({
        email: ownerEmail.trim(),
        password: ownerPassword,
        fullName: ownerName.trim(),
        phone: ownerPhone.trim() || null,
        pharmacyName: pharmacyName.trim() || "Empress Oris Herbal & Mart",
        pharmacyAddress: pharmacyAddress.trim() || null,
        pharmacyPhone: pharmacyPhone.trim() || null,
      });
    } catch (err: any) {
      setError(err.message || "Failed to complete initial setup.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 grid grid-cols-1 lg:grid-cols-12 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Left Column: Brand & System Information */}
        <div className="lg:col-span-5 bg-slate-900 p-6 sm:p-8 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none" />

          <div className="relative z-10 space-y-6">
            <div className="flex items-center space-x-3">
              <img src="/logo.png" alt="Empress Oris Logo" className="w-12 h-12 rounded-2xl object-contain shadow-lg" />
              <div>
                <h2 className="text-lg font-black tracking-tight text-white">Empress Oris Herbal &amp; Mart</h2>
                <p className="text-xs text-teal-400 font-medium">Pharmacy POS &amp; FEFO Inventory</p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {isFirstTimeSetup ? "Initial Pharmacy Setup" : "Dispensing Portal Access"}
              </h1>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isFirstTimeSetup
                  ? "Welcome to your dispensary management system. Complete owner onboarding and store licensing setup."
                  : "Sign in with your verified credentials to access POS sales, batch inventory, and financial shifts."}
              </p>
            </div>

            {/* Feature Badges in Column Grid */}
            <div className="grid grid-cols-1 gap-2.5 pt-2">
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-start space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-slate-200">FEFO Batch Dispensing</h4>
                  <p className="text-[11px] text-slate-400">First-Expired First-Out automation with batch expiry countdown.</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-start space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Local Payment Tenders</h4>
                  <p className="text-[11px] text-slate-400">Cash, MTN MoMo, Telecel Cash & Bank transfers in GH₵.</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-start space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Shift Reconciliation</h4>
                  <p className="text-[11px] text-slate-400">Real-time drawer balance tracking with zero data simulation.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-6 mt-6 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Currency: <strong>GH₵ (Ghana Cedis)</strong></span>
            <span className="flex items-center space-x-1 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>SamTeck Digital Team</span>
            </span>
          </div>
        </div>

        {/* Right Column: Authentication & Setup Form in Grid */}
        <div className="lg:col-span-7 p-6 sm:p-8 bg-white flex flex-col justify-center">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">
              {isFirstTimeSetup ? "Configure Pharmacy & Owner" : "Account Sign In"}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isFirstTimeSetup
                ? "Fill in your credentials to provision the master administrator account."
                : "Enter your registered email address and password to continue."}
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {isFirstTimeSetup ? (
            /* Setup Form organized in a responsive 2-column grid */
            <form onSubmit={handleSetup} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 border-b border-slate-100 pb-1.5">
                <p className="text-xs font-bold uppercase tracking-wider text-teal-700">1. Owner Credentials</p>
              </div>

              <div className="sm:col-span-1">
                <label className="block text-xs font-bold text-slate-700 mb-1">Owner Full Name *</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Kwame Mensah"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-900 font-medium"
                  />
                </div>
              </div>

              <div className="sm:col-span-1">
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="owner@pharmacy.gh"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-900 font-medium"
                  />
                </div>
              </div>

              <div className="sm:col-span-1">
                <label className="block text-xs font-bold text-slate-700 mb-1">Phone (Ghana)</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="tel"
                    placeholder="024 123 4567"
                    value={ownerPhone}
                    onChange={(e) => setOwnerPhone(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-900 font-medium"
                  />
                </div>
              </div>

              <div className="sm:col-span-1">
                <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="password"
                    placeholder="Create a password"
                    value={ownerPassword}
                    onChange={(e) => setOwnerPassword(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-900 font-medium"
                  />
                </div>
              </div>

              <div className="sm:col-span-2 border-b border-slate-100 pb-1.5 pt-2">
                <p className="text-xs font-bold uppercase tracking-wider text-teal-700">2. Pharmacy Profile</p>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Pharmacy Business Name *</label>
                <div className="relative">
                  <Building className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={pharmacyName}
                    onChange={(e) => setPharmacyName(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-900 font-bold"
                  />
                </div>
              </div>

              <div className="sm:col-span-1">
                <label className="block text-xs font-bold text-slate-700 mb-1">Shop Address / Landmark</label>
                <input
                  type="text"
                  placeholder="e.g. Oxford Street, Osu, Accra"
                  value={pharmacyAddress}
                  onChange={(e) => setPharmacyAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-900"
                />
              </div>

              <div className="sm:col-span-1">
                <label className="block text-xs font-bold text-slate-700 mb-1">Contact Phone</label>
                <input
                  type="tel"
                  placeholder="030 200 0000"
                  value={pharmacyPhone}
                  onChange={(e) => setPharmacyPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-900"
                />
              </div>

              <div className="sm:col-span-2 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center space-x-2 text-xs uppercase tracking-wider disabled:opacity-50"
                >
                  <span>{loading ? "Setting Up System..." : "Complete Setup & Launch"}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          ) : (
            /* Login Form organized in a responsive 2-column grid */
            <form onSubmit={handleLogin} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-1">
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="e.g. cashier@pharmacy.gh"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-900 font-medium"
                  />
                </div>
              </div>

              <div className="sm:col-span-1">
                <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="password"
                    placeholder="Enter password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-900 font-medium"
                  />
                </div>
              </div>

              <div className="sm:col-span-2 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center space-x-2 text-xs uppercase tracking-wider disabled:opacity-50"
                >
                  <span>{loading ? "Authenticating..." : "Sign In to Dispensary"}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* System Footer Note */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-1">
            <span>Powered by SamTeck Digital Team</span>
            <span className="font-semibold text-slate-500">Empress Oris Herbal &amp; Mart POS</span>
          </div>
        </div>
      </div>
    </div>
  );
}
