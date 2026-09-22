import { Router, Request, Response } from "express";
import { getRawSql } from "../../db";
import { requireAuthentication } from "../middleware/auth";
import { broadcastRealtimeEvent } from "../../services/supabase";

export const notificationsRouter = Router();

// Sync dynamic alerts into notifications table and return all
notificationsRouter.get("/", requireAuthentication, async (req: Request, res: Response) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });

  try {
    // 1. Low stock items
    try {
      const lowStockItems = await rawSql.unsafe(`
        SELECT p.id, p.name, p.sku, p.reorder_level,
          COALESCE(SUM(CASE WHEN b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE THEN b.current_quantity ELSE 0 END), 0)::integer as current_stock
        FROM products p
        LEFT JOIN batches b ON p.id = b.product_id
        WHERE p.is_active = true
        GROUP BY p.id, p.name, p.sku, p.reorder_level
        HAVING COALESCE(SUM(CASE WHEN b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE THEN b.current_quantity ELSE 0 END), 0) <= p.reorder_level
        ORDER BY current_stock ASC
        LIMIT 10
      `);

      for (const item of lowStockItems) {
        const refId = `low-${item.id}`;
        const title = item.current_stock === 0 ? `${item.name} is Out of Stock` : `${item.name} is Low on Stock`;
        const message = `Current stock: ${item.current_stock} units (reorder at ${item.reorder_level}). SKU: ${item.sku}`;
        const type = item.current_stock === 0 ? "OUT_OF_STOCK" : "LOW_STOCK";
        await rawSql.unsafe(`
          INSERT INTO notifications (title, message, type, reference_id, is_read)
          VALUES ($$${title}$$, $$${message}$$, $$${type}$$, $$${refId}$$, false)
          ON CONFLICT (reference_id) DO UPDATE SET title = $$${title}$$, message = $$${message}$$
        `);
      }
    } catch (err) {
      console.warn("[Notifications] Low stock upsert error:", err);
    }

    // 2. Expiring soon batches
    try {
      const expiringBatches = await rawSql.unsafe(`
        SELECT b.id, b.batch_number, b.current_quantity, b.expiry_date, p.name as product_name,
          (b.expiry_date - CURRENT_DATE)::integer as days_remaining
        FROM batches b
        JOIN products p ON b.product_id = p.id
        WHERE b.current_quantity > 0 
          AND b.expiry_date >= CURRENT_DATE 
          AND b.expiry_date <= CURRENT_DATE + INTERVAL '90 days'
        ORDER BY b.expiry_date ASC
        LIMIT 10
      `);

      for (const item of expiringBatches) {
        const refId = `exp-${item.id}`;
        const title = `${item.product_name} — Batch ${item.batch_number} Expiring`;
        const message = `Expires in ${item.days_remaining} days (${new Date(item.expiry_date).toLocaleDateString("en-GB")}). Qty: ${item.current_quantity}`;
        await rawSql.unsafe(`
          INSERT INTO notifications (title, message, type, reference_id, is_read)
          VALUES ($$${title}$$, $$${message}$$, 'EXPIRING_SOON', $$${refId}$$, false)
          ON CONFLICT (reference_id) DO UPDATE SET title = $$${title}$$, message = $$${message}$$
        `);
      }
    } catch (err) {
      console.warn("[Notifications] Expiring batch upsert error:", err);
    }

    // 3. Expired batches
    try {
      const expiredBatches = await rawSql.unsafe(`
        SELECT b.id, b.batch_number, b.current_quantity, b.expiry_date, p.name as product_name
        FROM batches b
        JOIN products p ON b.product_id = p.id
        WHERE b.current_quantity > 0 AND b.expiry_date < CURRENT_DATE
        ORDER BY b.expiry_date DESC
        LIMIT 10
      `);

      for (const item of expiredBatches) {
        const refId = `expired-${item.id}`;
        const title = `${item.product_name} — Batch ${item.batch_number} Expired`;
        const message = `Expired on ${new Date(item.expiry_date).toLocaleDateString("en-GB")}. Qty: ${item.current_quantity} units still in stock.`;
        await rawSql.unsafe(`
          INSERT INTO notifications (title, message, type, reference_id, is_read)
          VALUES ($$${title}$$, $$${message}$$, 'EXPIRED', $$${refId}$$, false)
          ON CONFLICT (reference_id) DO UPDATE SET title = $$${title}$$, message = $$${message}$$
        `);
      }
    } catch (err) {
      console.warn("[Notifications] Expired batch upsert error:", err);
    }

    // 4. Return all notifications from the table
    const allNotifications = await rawSql.unsafe(`
      SELECT * FROM notifications ORDER BY is_read ASC, created_at DESC LIMIT 50
    `);

    return res.json({ notifications: allNotifications });
  } catch (err: any) {
    console.error("[Notifications] Error:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch notifications" });
  }
});

// Get total unread alerts count
notificationsRouter.get("/unread-count", requireAuthentication, async (req: Request, res: Response) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ count: 0 });

  try {
    const [result] = await rawSql.unsafe(`
      SELECT COUNT(*)::integer as count FROM notifications WHERE is_read = false
    `);
    return res.json({ count: result?.count || 0 });
  } catch (err: any) {
    return res.json({ count: 0 });
  }
});

// Mark a single notification as read
notificationsRouter.put("/:id/read", requireAuthentication, async (req: Request, res: Response) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });

  const { id } = req.params;

  try {
    const [updated] = await rawSql`
      UPDATE notifications SET is_read = true WHERE id = ${id} RETURNING *
    `;
    if (!updated) {
      return res.status(404).json({ error: "Notification not found." });
    }
    await broadcastRealtimeEvent("NOTIFICATION_UPDATED", { notificationId: id });
    return res.json({ success: true, notification: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to mark notification as read" });
  }
});

// Mark all notifications as read
notificationsRouter.put("/read-all", requireAuthentication, async (req: Request, res: Response) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });

  try {
    await rawSql`UPDATE notifications SET is_read = true WHERE is_read = false`;
    await broadcastRealtimeEvent("NOTIFICATION_UPDATED", { action: "read_all" });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to mark all as read" });
  }
});
