import React, { useState } from "react";
import {
  Monitor,
  Download,
  X,
  CheckCircle2,
  Apple,
  Smartphone,
  ShieldCheck,
  Zap,
  Printer,
  Sparkles,
  ExternalLink,
  Laptop,
  Check,
} from "lucide-react";
import { usePWAInstall, DesktopOS } from "../hooks/usePWAInstall";
import { useAuth } from "../context/AuthContext";

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InstallAppModal({ isOpen, onClose }: InstallAppModalProps) {
  const { isInstallable, isInstalled, os, install, hasPrompt } = usePWAInstall();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"windows" | "mac" | "linux" | "mobile">(
    os === "mac" ? "mac" : os === "linux" ? "linux" : os === "android" || os === "ios" ? "mobile" : "windows"
  );
  const [installing, setInstalling] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (hasPrompt) {
      setInstalling(true);
      const success = await install();
      setInstalling(false);
      if (success) {
        setInstalledSuccess(true);
        setTimeout(() => {
          onClose();
        }, 2500);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white w-full max-w-2xl rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header with Brand Gradient */}
        <div className="bg-gradient-to-br from-teal-900 via-teal-800 to-emerald-900 text-white p-5 sm:p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-teal-200 hover:text-white hover:bg-white/10 rounded-full transition"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-start sm:items-center space-x-3 sm:space-x-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white p-1.5 shadow-md shrink-0 flex items-center justify-center">
              <img src="/logo.png" alt="Empress Oris Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-400/20 text-teal-200 border border-teal-300/30 uppercase tracking-wider">
                  Desktop Native App
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-200 border border-amber-300/30 uppercase">
                  Employee &amp; Admin
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-white mt-1">
                Install Empress Oris as a Desktop App
              </h2>
              <p className="text-xs text-teal-200/90 font-medium">
                Run in a dedicated, distraction-free desktop window with taskbar launch &amp; high-speed POS.
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Status / 1-Click Action Banner */}
          {isInstalled ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center space-x-3 text-emerald-900">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs sm:text-sm font-bold">Empress Oris Desktop App Is Already Installed!</p>
                <p className="text-xs text-emerald-700">
                  You are either running inside the standalone desktop app or have already added it to your applications.
                </p>
              </div>
            </div>
          ) : installedSuccess ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center space-x-3 text-emerald-900 animate-fadeIn">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs sm:text-sm font-bold">Successfully Installed to Your System!</p>
                <p className="text-xs text-emerald-700">
                  You can now launch Empress Oris directly from your Desktop, Start Menu, or Applications dock.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 sm:p-5 bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-1.5 text-teal-900 font-extrabold text-sm">
                  <Sparkles className="w-4 h-4 text-teal-600" />
                  <span>One-Click Desktop Installation</span>
                </div>
                <p className="text-xs text-slate-600">
                  {hasPrompt
                    ? "Your browser is ready to install the application directly to your computer."
                    : "Install using your browser's desktop application feature in 2 seconds."}
                </p>
              </div>

              {hasPrompt ? (
                <button
                  onClick={handleInstallClick}
                  disabled={installing}
                  className="w-full sm:w-auto px-5 py-2.5 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center space-x-2 shrink-0 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{installing ? "Installing..." : "Install Desktop App Now"}</span>
                </button>
              ) : (
                <span className="text-[11px] font-bold text-teal-800 bg-white px-3 py-1.5 rounded-lg border border-teal-200 shadow-2xs">
                  Follow steps below for your OS
                </span>
              )}
            </div>
          )}

          {/* Role Advantages: Tailored for Both Employee & Admin */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-black text-xs">
                  EP
                </div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                  For Employees &amp; Cashiers
                </h4>
              </div>
              <ul className="text-[11px] text-slate-600 space-y-1">
                <li className="flex items-center space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span>Zero browser tab clutter &amp; prevents accidental closing</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span>Instant USB / Bluetooth barcode scanner response</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span>Fast 80mm thermal receipt printing workflow</span>
                </li>
              </ul>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs">
                  AD
                </div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                  For Owners &amp; Admins
                </h4>
              </div>
              <ul className="text-[11px] text-slate-600 space-y-1">
                <li className="flex items-center space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Desktop taskbar / dock icon with instant 1-second launch</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Real-time Supabase stock &amp; low stock monitoring</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Multi-window support for POS + Inventory side-by-side</span>
                </li>
              </ul>
            </div>
          </div>

          {/* OS-Specific Step-by-Step Instructions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Installation Instructions by Operating System
              </h3>
              <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                Detected: {os.toUpperCase()}
              </span>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200">
              <button
                onClick={() => setActiveTab("windows")}
                className={`flex-1 py-2 text-xs font-bold border-b-2 flex items-center justify-center space-x-1.5 transition ${
                  activeTab === "windows"
                    ? "border-teal-600 text-teal-800 bg-teal-50/50"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Windows 10 / 11</span>
              </button>
              <button
                onClick={() => setActiveTab("mac")}
                className={`flex-1 py-2 text-xs font-bold border-b-2 flex items-center justify-center space-x-1.5 transition ${
                  activeTab === "mac"
                    ? "border-teal-600 text-teal-800 bg-teal-50/50"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Apple className="w-3.5 h-3.5" />
                <span>macOS</span>
              </button>
              <button
                onClick={() => setActiveTab("linux")}
                className={`flex-1 py-2 text-xs font-bold border-b-2 flex items-center justify-center space-x-1.5 transition ${
                  activeTab === "linux"
                    ? "border-teal-600 text-teal-800 bg-teal-50/50"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                <span>Linux</span>
              </button>
              <button
                onClick={() => setActiveTab("mobile")}
                className={`flex-1 py-2 text-xs font-bold border-b-2 flex items-center justify-center space-x-1.5 transition ${
                  activeTab === "mobile"
                    ? "border-teal-600 text-teal-800 bg-teal-50/50"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Mobile &amp; Tablet</span>
              </button>
            </div>

            {/* Tab Contents */}
            <div className="pt-2 text-xs text-slate-700 leading-relaxed">
              {activeTab === "windows" && (
                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <p className="font-bold text-slate-900">
                    Windows Desktop Installation (Google Chrome, Microsoft Edge, Brave):
                  </p>
                  <ol className="list-decimal list-inside space-y-2 text-slate-600">
                    <li>
                      <strong className="text-slate-800">Method 1 (Fastest):</strong> Look at the right side of your browser’s URL / address bar. Click the{" "}
                      <span className="inline-flex items-center px-1.5 py-0.5 bg-slate-200 text-slate-800 font-bold rounded text-[10px]">
                        Install App ⤓
                      </span>{" "}
                      icon.
                    </li>
                    <li>
                      <strong className="text-slate-800">Method 2 (Menu):</strong> Click the 3 dots (⋮) in the top-right corner of Chrome/Edge ➔ select{" "}
                      <span className="font-semibold text-slate-800">"Save and share"</span> (or "Apps") ➔{" "}
                      <span className="font-semibold text-slate-800">"Install Empress Oris Herbal &amp; Mart as an app"</span>.
                    </li>
                    <li>
                      Click <strong className="text-slate-800">"Install"</strong>. The app will launch in its own native desktop window. Check{" "}
                      <em>"Pin to taskbar"</em> and <em>"Create Desktop shortcut"</em> so cashiers can open it with 1 click!
                    </li>
                  </ol>
                </div>
              )}

              {activeTab === "mac" && (
                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <p className="font-bold text-slate-900">
                    macOS Native App Installation (Apple Silicon &amp; Intel):
                  </p>
                  <div className="space-y-2 text-slate-600">
                    <div>
                      <span className="font-bold text-slate-800">Option A: Using Google Chrome or Microsoft Edge</span>
                      <p className="text-[11px] text-slate-500">
                        Click the Install icon in the address bar, or click Chrome Menu (⋮) ➔ <strong>"Save and share"</strong> ➔ <strong>"Install Empress Oris Herbal &amp; Mart"</strong>. The app is placed in your macOS <code>/Applications</code> folder and Dock!
                      </p>
                    </div>
                    <div>
                      <span className="font-bold text-slate-800">Option B: Using Apple Safari (macOS Sonoma &amp; newer)</span>
                      <p className="text-[11px] text-slate-500">
                        In Safari, click the top system menu: <strong>File</strong> ➔ <strong>"Add to Dock..."</strong> ➔ Click <strong>"Add"</strong>. Empress Oris will behave like an official macOS app with its own dock icon.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "linux" && (
                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <p className="font-bold text-slate-900">
                    Linux Installation (Ubuntu, Debian, Fedora, Arch):
                  </p>
                  <ol className="list-decimal list-inside space-y-2 text-slate-600">
                    <li>Open this system in Chrome, Chromium, or Brave on Linux.</li>
                    <li>Click the Install icon in the address bar or Menu ➔ <strong>"Install Empress Oris Herbal &amp; Mart"</strong>.</li>
                    <li>The desktop environment (GNOME, KDE, XFCE) will automatically create a desktop launcher entry in your application launcher.</li>
                  </ol>
                </div>
              )}

              {activeTab === "mobile" && (
                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <p className="font-bold text-slate-900">
                    Mobile POS &amp; Tablet Installation (Android / iPad / iPhone):
                  </p>
                  <ul className="space-y-2 text-slate-600">
                    <li>
                      <strong className="text-slate-800">Android (Chrome):</strong> Tap the 3 dots menu ➔ tap{" "}
                      <span className="font-semibold text-slate-800">"Install app"</span> or "Add to Home screen".
                    </li>
                    <li>
                      <strong className="text-slate-800">iPhone / iPad (Safari):</strong> Tap the{" "}
                      <span className="font-semibold text-slate-800">Share icon (square with arrow)</span> at the bottom ➔ scroll down and tap{" "}
                      <span className="font-semibold text-slate-800">"Add to Home Screen"</span>.
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Secure PWA Native Architecture • SamTeck Digital Team</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
