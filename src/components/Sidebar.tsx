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
}

export function Sidebar({
  currentTab,
  onSelectTab,
  notificationCount = 0,
  lowStockCount = 0,
  expiringSoonCount = 0,
}: SidebarProps) {
  const { user } = useAuth();
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
        { id: "products", label: "Products Catalog", icon: Package, badge: lowStockCount > 0 ? `${lowStockCount} Low` : undefined, badgeColor: "bg-amber-100 text-amber-800" },
        { id: "batches", label: "Batches & Expiry (FEFO)", icon: CalendarDays, badge: expiringSoonCount > 0 ? `${expiringSoonCount} Exp` : undefined, badgeColor: "bg-rose-100 text-rose-800" },
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
        { id: "notifications", label: "Stock Alerts", icon: Bell, badge: notificationCount > 0 ? `${notificationCount}` : undefined, badgeColor: "bg-rose-600 text-white" },
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
        { id: "notifications", label: "Alerts", icon: Bell, badge: notificationCount > 0 ? `${notificationCount}` : undefined, badgeColor: "bg-rose-600 text-white" },
      ],
    },
  ];

  const sections = isOwner ? ownerSections : employeeSections;

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 min-h-[calc(100vh-4rem)] border-r border-slate-800 select-none">
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
                    onClick={() => onSelectTab(item.id as NavTab)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
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
      <div className="p-4 border-t border-slate-800 bg-slate-950/40 text-[11px] text-slate-500 flex items-center justify-between">
        <div>
          <p className="font-semibold text-slate-400">Ghanaian Pharmacy OS</p>
          <p className="text-[10px] text-slate-600">v2.0 • FEFO Compliant</p>
        </div>
        <div className="w-2 h-2 rounded-full bg-emerald-500" title="System Online" />
      </div>
    </aside>
  );
}
