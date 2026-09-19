import React from "react";
import {
  Bell,
  LogOut,
  Clock,
  Shield,
  User as UserIcon,
  Activity,
  Plus,
  Menu,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { InstallAppButton } from "./InstallAppButton";

interface NavbarProps {
  onOpenShiftClick: () => void;
  onCloseShiftClick: () => void;
  hasOpenShift: boolean;
  shiftData: any;
  notificationCount: number;
  onNotificationsClick: () => void;
  onAddProductClick: () => void;
  onToggleMobileMenu?: () => void;
}

export function Navbar({
  onOpenShiftClick,
  onCloseShiftClick,
  hasOpenShift,
  shiftData,
  notificationCount,
  onNotificationsClick,
  onAddProductClick,
  onToggleMobileMenu,
}: NavbarProps) {
  const { user, settings, logout } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between shrink-0 z-30 shadow-2xs">
      {/* Left: Mobile Menu Toggle & Pharmacy Brand */}
      <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="lg:hidden p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
            aria-label="Toggle navigation menu"
            title="Open Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {settings?.logoUrl ? (
          <img
            src={settings.logoUrl}
            alt="Logo"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-contain border border-slate-200 p-0.5 bg-white shrink-0"
          />
        ) : (
          <img src="/logo.png" alt="Empress Oris Logo" className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-contain shadow-xs shrink-0" />
        )}
        <div className="min-w-0">
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            <h1 className="text-xs sm:text-base font-extrabold text-slate-900 tracking-tight leading-none truncate">
              {settings?.name || "Empress Oris Herbal & Mart"}
            </h1>
            <span className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse"></span>
              LIVE SUPABASE
            </span>
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium leading-tight truncate">
            {settings?.city || "Accra"}, Ghana • {settings?.currencySymbol || "GH₵"}
          </p>
        </div>
      </div>

      {/* Right: Actions, Desktop App Download, Shift status, Notifications, User Profile */}
      <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
        {/* Desktop App Download Button (Both Employee & Admin) */}
        <InstallAppButton variant="navbar" />

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
          <div className="flex items-center space-x-1.5 sm:space-x-2 bg-emerald-50 border border-emerald-200 px-2 sm:px-2.5 py-1 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="text-[11px] font-bold text-emerald-800 hidden sm:inline">
              Shift Open
            </span>
            <button
              onClick={onCloseShiftClick}
              className="text-[10px] sm:text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline"
            >
              Close Shift
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenShiftClick}
            className="flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold hover:bg-amber-100 transition"
          >
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden xs:inline">Open Shift</span>
          </button>
        )}

        {/* Notifications Bell */}
        <button
          onClick={onNotificationsClick}
          className="relative p-1.5 sm:p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
          title="Stock & Expiry Alerts"
        >
          <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
          {notificationCount > 0 && (
            <span className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 px-1 sm:px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-bold bg-rose-600 text-white shadow-2xs">
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
          className="p-1.5 sm:p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
