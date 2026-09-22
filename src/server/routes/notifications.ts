import { Router, Request, Response } from "express";
import { getRawSql } from "../../db";
import { requireAuthentication } from "../middleware/auth";
import { broadcastRealtimeEvent } from "../../services/supabase";

export const notificationsRouter = Router();

// Get real system notifications (Low stock, expiring soon batches, expired batches, shift discrepancies)
notificationsRouter.get("/", requireAuthentication, async (req: Request, res: Response) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });

  try {
    // Dynamic real alerts from the database
    // 1. Low stock items
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

    // 2. Expiring soon batches (within 90 days)
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

    // 3. Expired batches
    const expiredBatches = await rawSql.unsafe(`
      SELECT b.id, b.batch_number, b.current_quantity, b.expiry_date, p.name as product_name
      FROM batches b
      JOIN products p ON b.product_id = p.id
      WHERE b.current_quantity > 0 AND b.expiry_date < CURRENT_DATE
      ORDER BY b.expiry_date DESC
      LIMIT 10
    `);

    // 4. Stored notifications (e.g. shift discrepancies)
    const storedNotifications = await rawSql.unsafe(`
      SELECT * FROM notifications ORDER BY created_at DESC LIMIT 20
    `);

    return res.json({
      lowStock: lowStockItems,
      expiringSoon: expiringBatches,
      expired: expiredBatches,
      stored: storedNotifications,
      totalAlerts: lowStockItems.length + expiringBatches.length + expiredBatches.length,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch notifications" });
  }
});

// Get total unread alerts count (low stock + expiring soon + unread stored notifications)
notificationsRouter.get("/unread-count", requireAuthentication, async (req: Request, res: Response) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ count: 0 });

  try {
    const [counts] = await rawSql.unsafe(`
      SELECT 
        (
          SELECT COUNT(*)::integer FROM (
            SELECT p.id
            FROM products p
            LEFT JOIN batches b ON p.id = b.product_id
            WHERE p.is_active = true
            GROUP BY p.id, p.reorder_level
            HAVING COALESCE(SUM(CASE WHEN b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE THEN b.current_quantity ELSE 0 END), 0) <= p.reorder_level
          ) ls
        ) as low_stock_count,
        (
          SELECT COUNT(DISTINCT b.id)::integer
          FROM batches b
          WHERE b.current_quantity > 0 
            AND b.expiry_date >= CURRENT_DATE 
            AND b.expiry_date <= CURRENT_DATE + INTERVAL '90 days'
        ) as expiring_soon_count,
        (
          SELECT COUNT(*)::integer FROM notifications WHERE is_read = false
        ) as stored_unread_count
    `);

    const total = (counts?.low_stock_count || 0) + (counts?.expiring_soon_count || 0) + (counts?.stored_unread_count || 0);
    return res.json({ 
      count: total,
      lowStockCount: counts?.low_stock_count || 0,
      expiringSoonCount: counts?.expiring_soon_count || 0,
      storedUnreadCount: counts?.stored_unread_count || 0
    });
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
