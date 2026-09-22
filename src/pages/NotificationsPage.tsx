import React, { useState, useEffect } from "react";
import { Bell, AlertTriangle, CalendarDays, CheckCircle2, Trash2 } from "lucide-react";
import { Notification } from "../types";
import { apiRequest } from "../lib/api";
import { subscribeToPharmacyRealtime } from "../lib/supabaseClient";

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{
        lowStock: any[];
        expiringSoon: any[];
        expired: any[];
        stored: any[];
      }>("/api/notifications");

      const alerts: Notification[] = [];

      (res.lowStock || []).forEach((item) => {
        alerts.push({
          id: `low-${item.id}`,
          type: item.current_stock === 0 ? "OUT_OF_STOCK" : "LOW_STOCK",
          title: item.current_stock === 0 ? `${item.name} is Out of Stock` : `${item.name} is Low on Stock`,
          message: `Current stock: ${item.current_stock} units (reorder at ${item.reorder_level}). SKU: ${item.sku}`,
          isRead: false,
          createdAt: new Date().toISOString(),
        });
      });

      (res.expiringSoon || []).forEach((item) => {
        alerts.push({
          id: `exp-${item.id}`,
          type: "EXPIRING_SOON",
          title: `${item.product_name} — Batch ${item.batch_number} Expiring`,
          message: `Expires in ${item.days_remaining} days (${new Date(item.expiry_date).toLocaleDateString("en-GB")}). Qty: ${item.current_quantity}`,
          isRead: false,
          createdAt: new Date().toISOString(),
        });
      });

      (res.expired || []).forEach((item) => {
        alerts.push({
          id: `expired-${item.id}`,
          type: "EXPIRED",
          title: `${item.product_name} — Batch ${item.batch_number} Expired`,
          message: `Expired on ${new Date(item.expiry_date).toLocaleDateString("en-GB")}. Qty: ${item.current_quantity} units still in stock.`,
          isRead: false,
          createdAt: new Date().toISOString(),
        });
      });

      (res.stored || []).forEach((item) => {
        alerts.push({
          id: item.id,
          type: item.type || "SYSTEM",
          title: item.title,
          message: item.message,
          isRead: item.is_read,
          createdAt: item.created_at,
        });
      });

      setNotifications(alerts);
    } catch (err) {
      console.warn("[Notifications] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    const unsubscribe = subscribeToPharmacyRealtime((event) => {
      if (event === "NOTIFICATION_UPDATED" || event === "STOCK_UPDATED" || event === "SHIFT_UPDATED") {
        fetchNotifications();
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const markAsRead = async (id: string) => {
    setNotifications(notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    if (!id.startsWith("low-") && !id.startsWith("exp-") && !id.startsWith("expired-")) {
      try {
        await apiRequest(`/api/notifications/${id}/read`, { method: "PUT" });
      } catch (err) {
        console.warn(err);
      }
    }
  };

  const markAllRead = async () => {
    setNotifications(notifications.map((n) => ({ ...n, isRead: true })));
    try {
      await apiRequest("/api/notifications/read-all", { method: "PUT" });
    } catch (err) {
      console.warn(err);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Inventory Alerts & Expiry Warnings
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Automated alerts for low stock levels, FEFO expiring batches, and out-of-stock items.
          </p>
        </div>

        {notifications.some((n) => !n.isRead) && (
          <button
            onClick={markAllRead}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center space-x-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Mark All as Read</span>
          </button>
        )}
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
            <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-xs font-bold">Querying notifications...</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 space-y-2">
            <Bell className="w-12 h-12 mx-auto text-slate-300" />
            <h3 className="text-sm font-bold text-slate-700">No active alerts</h3>
            <p className="text-xs text-slate-400">Inventory levels and batch expirations are healthy.</p>
          </div>
        ) : (
          notifications.map((n) => {
            const isExpiry = n.type.includes("EXPIR");
            return (
              <div
                key={n.id}
                className={`p-4 rounded-2xl border transition-all flex items-start justify-between ${
                  n.isRead
                    ? "bg-white border-slate-200 opacity-70"
                    : "bg-amber-50/50 border-amber-200 shadow-2xs"
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isExpiry ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {isExpiry ? <CalendarDays className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="text-xs font-bold text-slate-900">{n.title}</h4>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                        {n.type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">{n.message}</p>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {new Date(n.createdAt).toLocaleString("en-GB")}
                    </span>
                  </div>
                </div>

                {!n.isRead && (
                  <button
                    onClick={() => markAsRead(n.id)}
                    className="text-xs text-teal-600 hover:text-teal-800 font-bold px-2 py-1 rounded-lg hover:bg-white"
                  >
                    Mark read
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
