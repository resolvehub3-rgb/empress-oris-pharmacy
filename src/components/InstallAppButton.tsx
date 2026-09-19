import React, { useState } from "react";
import { Download, Monitor, CheckCircle2 } from "lucide-react";
import { usePWAInstall } from "../hooks/usePWAInstall";
import { InstallAppModal } from "./InstallAppModal";

interface InstallAppButtonProps {
  className?: string;
  variant?: "navbar" | "sidebar" | "banner";
}

export function InstallAppButton({ className = "", variant = "navbar" }: InstallAppButtonProps) {
  const { isInstalled, hasPrompt } = usePWAInstall();
  const [modalOpen, setModalOpen] = useState(false);

  if (isInstalled && variant === "banner") {
    return null;
  }

  return (
    <>
      {variant === "navbar" && (
        <button
          onClick={() => setModalOpen(true)}
          className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            hasPrompt
              ? "bg-teal-700 hover:bg-teal-800 text-white shadow-2xs ring-2 ring-teal-400/40"
              : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
          } ${className}`}
          title="Download & Install Native Desktop App (Windows, macOS, Linux)"
        >
          <Monitor className="w-3.5 h-3.5 text-teal-300" />
          <span className="hidden sm:inline">Desktop App</span>
          <Download className="w-3.5 h-3.5" />
        </button>
      )}

      {variant === "sidebar" && (
        <button
          onClick={() => setModalOpen(true)}
          className={`w-full p-3 rounded-xl bg-gradient-to-r from-teal-900/60 to-emerald-900/60 border border-teal-700/40 text-left hover:border-teal-500/60 transition group ${className}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center">
                <Monitor className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-black text-white group-hover:text-teal-200 transition">
                  {isInstalled ? "Desktop App Installed" : "Download Desktop App"}
                </p>
                <p className="text-[10px] text-teal-300/80">Windows • macOS • Linux</p>
              </div>
            </div>
            {isInstalled ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <Download className="w-4 h-4 text-teal-400 group-hover:translate-y-0.5 transition" />
            )}
          </div>
        </button>
      )}

      {/* Full Modal */}
      <InstallAppModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
