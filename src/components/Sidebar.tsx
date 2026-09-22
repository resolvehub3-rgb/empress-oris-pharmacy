import React from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Boxes,
  Package,
  CalendarDays,
  History,
  Truck,
  FileSpreadsheet,
  Wallet,
  Users,
  BarChart3,
  Bell,
  ScrollText,
  Settings,
  Clock,
  ChevronRight,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

export type NavTab =
  | "dashboard"
  | "pos"
  | "sales"
  | "shifts"
  | "products"
  | "batches"
  | "movements"
  | "suppliers"
  | "purchases"
  | "expenses"
  | "employees"
  | "reports"
  | "notifications"
  | "audit"
  | "settings";

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  notificationCount?: number;
  lowStockCount?: number;
  expiringSoonCount?: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({
  currentTab,
  onSelectTab,
  notificationCount = 0,
  lowStockCount = 0,
  expiringSoonCount = 0,
  isMobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const { user, settings } = useAuth();
  const isOwner = user?.role === "OWNER";

  const ownerSections = [
    {
      title: "Core Operations",
      items: [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
        { id: "pos", label: "POS Terminal", icon: ShoppingCart, highlight: true },
        { id: "sales", label: "Sales & Receipts", icon: Receipt },
        { id: "shifts", label: "Cashier Shifts", icon: Clock },
      ],
    },
    {
      title: "Inventory & Batches",
      items: [
        {
          id: "products",
          label: "Products Catalog",
          icon: Package,
          badge: lowStockCount > 0 ? `${lowStockCount} Low` : undefined,
          badgeColor: "bg-amber-100 text-amber-800",
        },
        {
          id: "batches",
          label: "Batches & Expiry (FEFO)",
          icon: CalendarDays,
          badge: expiringSoonCount > 0 ? `${expiringSoonCount} Exp` : undefined,
          badgeColor: "bg-rose-100 text-rose-800",
        },
        { id: "movements", label: "Stock Movements", icon: History },
      ],
    },
    {
      title: "Purchasing & Finance",
      items: [
        { id: "suppliers", label: "Suppliers", icon: Truck },
        { id: "purchases", label: "Purchase Orders", icon: FileSpreadsheet },
        { id: "expenses", label: "Expenses", icon: Wallet },
        { id: "employees", label: "Employees / Cashiers", icon: Users },
      ],
    },
    {
      title: "Intelligence & Control",
      items: [
        { id: "reports", label: "Reports & COGS", icon: BarChart3 },
        {
          id: "notifications",
          label: "Stock Alerts",
          icon: Bell,
          badge: notificationCount > 0 ? `${notificationCount}` : undefined,
          badgeColor: "bg-rose-600 text-white",
        },
        { id: "audit", label: "Audit Logs", icon: ScrollText },
        { id: "settings", label: "Pharmacy Settings", icon: Settings },
      ],
    },
  ];

  const employeeSections = [
    {
      title: "Cashier Workstation",
      items: [
        { id: "pos", label: "POS Terminal", icon: ShoppingCart, highlight: true },
        { id: "dashboard", label: "Daily Summary", icon: LayoutDashboard },
        { id: "sales", label: "My Sales & Receipts", icon: Receipt },
        { id: "shifts", label: "My Shift Register", icon: Clock },
        { id: "products", label: "Check Stock & Prices", icon: Package },
        {
          id: "notifications",
          label: "Alerts",
          icon: Bell,
          badge: notificationCount > 0 ? `${notificationCount}` : undefined,
          badgeColor: "bg-rose-600 text-white",
        },
      ],
    },
  ];

  const sections = isOwner ? ownerSections : employeeSections;

  const handleItemClick = (id: NavTab) => {
    onSelectTab(id);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const navContent = (
    <div className="flex-1 flex flex-col justify-between overflow-hidden">
      <div className="p-4 flex-1 overflow-y-auto space-y-6">
        {sections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-1.5">
            <p className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item: any) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item.id as NavTab)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? "bg-teal-600 text-white shadow-xs font-bold"
                        : item.highlight
                        ? "text-teal-400 hover:bg-slate-800/80 hover:text-white"
                        : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive
                            ? "text-white"
                            : item.highlight
                            ? "text-teal-400"
                            : "text-slate-400"
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badge ? (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${item.badgeColor}`}
                      >
                        {item.badge}
                      </span>
                    ) : isActive ? (
                      <ChevronRight className="w-3.5 h-3.5 text-teal-200" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Pharmacy Info */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/60 text-[11px] text-slate-500 flex items-center justify-between">
        <div>
          <p className="font-semibold text-slate-300">SamTeck Digital OS</p>
          <p className="text-[10px] text-slate-500">v2.0 • Supabase Live</p>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="text-[10px] font-bold text-emerald-400">ONLINE</span>
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="System Online" />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex w-64 bg-slate-900 text-slate-300 flex-col shrink-0 h-full border-r border-slate-800 select-none">
        {navContent}
      </aside>

      {/* 2. Mobile Responsive Off-Canvas Drawer */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            onClick={onCloseMobile}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-fadeIn"
            aria-hidden="true"
          />

          {/* Slide-out Panel */}
          <aside className="relative z-50 w-72 max-w-[85vw] bg-slate-900 text-slate-300 flex flex-col h-full shadow-2xl border-r border-slate-800 animate-slideRight">
            {/* Drawer Header with Close Button */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center space-x-2.5">
                <img src="/logo.png" alt="Empress Oris Logo" className="w-8 h-8 rounded-xl object-contain" />
                <div>
                  <h3 className="text-xs font-black text-white truncate max-w-[140px]">
                    {settings?.name || "Empress Oris"}
                  </h3>
                  <span className="text-[10px] font-bold text-teal-400 uppercase">
                    {user?.role === "OWNER" ? "Administrator" : "Employee POS"}
                  </span>
                </div>
              </div>
              <button
                onClick={onCloseMobile}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                aria-label="Close navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Nav Content */}
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
