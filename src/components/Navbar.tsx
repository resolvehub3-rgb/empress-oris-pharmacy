import React from "react";
import {
  Bell,
  LogOut,
  Clock,
  Shield,
  User as UserIcon,
  Activity,
  Plus,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface NavbarProps {
  onOpenShiftClick: () => void;
  onCloseShiftClick: () => void;
  hasOpenShift: boolean;
  shiftData: any;
  notificationCount: number;
  onNotificationsClick: () => void;
  onAddProductClick: () => void;
}

export function Navbar({
  onOpenShiftClick,
  onCloseShiftClick,
  hasOpenShift,
  shiftData,
  notificationCount,
  onNotificationsClick,
  onAddProductClick,
}: NavbarProps) {
  const { user, settings, logout } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
      {/* Left: Pharmacy Brand & Realtime Indicator */}
      <div className="flex items-center space-x-3">
        {settings?.logoUrl ? (
          <img
            src={settings.logoUrl}
            alt="Logo"
            className="w-9 h-9 rounded-xl object-contain border border-slate-200 p-0.5 bg-white"
          />
        ) : (
          <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
            EO
          </div>
        )}
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight leading-none">
              {settings?.name || "Empress Oris Herbal & Mart"}
            </h1>
            <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse"></span>
              LIVE SUPABASE
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium leading-tight">
            {settings?.city || "Accra"}, Ghana • {settings?.currencySymbol || "GH₵"}
          </p>
        </div>
      </div>

      {/* Right: Actions, Shift status, Notifications, User Profile */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Quick Add Product Button (Owner only) */}
        {user?.role === "OWNER" && (
          <button
            onClick={onAddProductClick}
            className="hidden md:inline-flex items-center space-x-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-2xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Product</span>
          </button>
        )}

        {/* Shift Status Pill */}
        {hasOpenShift ? (
          <div className="flex items-center space-x-2 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="text-[11px] font-bold text-emerald-800 hidden sm:inline">
              Shift Open
            </span>
            <button
              onClick={onCloseShiftClick}
              className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline"
            >
              Close Shift
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenShiftClick}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold hover:bg-amber-100 transition"
          >
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Open Shift</span>
          </button>
        )}

        {/* Notifications Bell */}
        <button
          onClick={onNotificationsClick}
          className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
          title="Stock & Expiry Alerts"
        >
          <Bell className="w-5 h-5" />
          {notificationCount > 0 && (
            <span className="absolute top-1 right-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-600 text-white shadow-2xs">
              {notificationCount}
            </span>
          )}
        </button>

        {/* User Badge */}
        <div className="hidden lg:flex items-center space-x-2 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
            {user?.fullName?.charAt(0) || "U"}
          </div>
          <div className="text-left leading-none">
            <p className="text-xs font-bold text-slate-900 truncate max-w-[120px]">
              {user?.fullName}
            </p>
            <span className="text-[10px] font-bold tracking-wider uppercase text-teal-700">
              {user?.role}
            </span>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={logout}
          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
