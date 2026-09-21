import { Router, Request, Response } from "express";
import { getDb, getRawSql, schema } from "../../db";
import { requireAuthentication } from "../middleware/auth";
import { broadcastRealtimeEvent } from "../../services/supabase";

export const shiftsRouter = Router();

// Get current open shift for logged-in cashier
shiftsRouter.get("/current", requireAuthentication, async (req: Request, res: Response) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });

  try {
    const [activeShift] = await rawSql.unsafe(`
      SELECT s.*, u.full_name as cashier_name
      FROM cashier_shifts s
      JOIN users u ON s.cashier_id = u.id
      WHERE s.cashier_id = '${req.user?.id}' AND s.status = 'OPEN'
      ORDER BY s.start_time DESC
      LIMIT 1
    `);

    if (!activeShift) {
      return res.json({ hasOpenShift: false, shift: null });
    }

    // Calculate real-time sales summary during this open shift
    const [salesSummary] = await rawSql.unsafe(`
      SELECT 
        COUNT(s.id)::integer as total_sales_count,
        COALESCE(SUM(s.total_amount), 0)::numeric(12,2) as total_sales_amount,
        COALESCE(SUM(CASE WHEN p.payment_method = 'CASH' THEN p.amount ELSE 0 END), 0)::numeric(12,2) as cash_sales,
        COALESCE(SUM(CASE WHEN p.payment_method = 'MTN_MOMO' THEN p.amount ELSE 0 END), 0)::numeric(12,2) as mtn_momo_sales,
        COALESCE(SUM(CASE WHEN p.payment_method = 'TELECEL_CASH' THEN p.amount ELSE 0 END), 0)::numeric(12,2) as telecel_sales,
        COALESCE(SUM(CASE WHEN p.payment_method = 'AIRTELTIGO_MONEY' THEN p.amount ELSE 0 END), 0)::numeric(12,2) as airteltigo_sales,
        COALESCE(SUM(CASE WHEN p.payment_method = 'CARD' THEN p.amount ELSE 0 END), 0)::numeric(12,2) as card_sales,
        COALESCE(SUM(CASE WHEN p.payment_method = 'BANK_TRANSFER' THEN p.amount ELSE 0 END), 0)::numeric(12,2) as bank_sales
      FROM sales s
      LEFT JOIN payments p ON s.id = p.sale_id
      WHERE s.shift_id = '${activeShift.id}' AND s.status = 'COMPLETED'
    `);

    const openingCash = parseFloat(activeShift.opening_cash || "0");
    const cashSales = parseFloat(salesSummary?.cash_sales || "0");
    const expectedCash = (openingCash + cashSales).toFixed(2);

    return res.json({
      hasOpenShift: true,
      shift: activeShift,
      summary: {
        ...salesSummary,
        openingCash,
        expectedCash,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch shift." });
  }
});

// Open Shift
shiftsRouter.post("/open", requireAuthentication, async (req: Request, res: Response) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });

  const { openingCash = 0, notes } = req.body;

  try {
    // Check if cashier already has an open shift
    const [existing] = await rawSql.unsafe(`
      SELECT id FROM cashier_shifts 
      WHERE cashier_id = '${req.user?.id}' AND status = 'OPEN'
    `);

    if (existing) {
      return res.status(400).json({ error: "You already have an open shift. Please close it first." });
    }

    const [shift] = await rawSql.unsafe(`
      INSERT INTO cashier_shifts (cashier_id, opening_cash, status, notes)
      VALUES ('${req.user?.id}', ${parseFloat(openingCash) || 0.0}, 'OPEN', ${notes ? `'${notes}'` : "NULL"})
      RETURNING *
    `);

    await rawSql.unsafe(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (
        '${req.user?.id}', 'SHIFT_OPENED', 'SHIFT', '${shift.id}',
        '${JSON.stringify({ openingCash })}'::jsonb
      )
    `);

    await broadcastRealtimeEvent("SHIFT_UPDATED", { cashierId: req.user?.id, status: "OPEN" });

    return res.status(201).json({ success: true, shift });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to open shift." });
  }
});

// Close Shift (employee closes own; owner can pass shiftId to close any)
shiftsRouter.post("/close", requireAuthentication, async (req: Request, res: Response) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });

  const { actualCash, notes, shiftId } = req.body;

  if (actualCash === undefined) {
    return res.status(400).json({ error: "Actual cash count is required to close shift." });
  }

  try {
    const isOwner = req.user?.role === "OWNER" || req.user?.role === "ADMIN";

    let activeShift;
    if (isOwner && shiftId) {
      // Owner can force-close any shift by ID
      [activeShift] = await rawSql.unsafe(`
        SELECT * FROM cashier_shifts 
        WHERE id = '${shiftId}' AND status = 'OPEN'
        LIMIT 1
      `);
    } else {
      [activeShift] = await rawSql.unsafe(`
        SELECT * FROM cashier_shifts 
        WHERE cashier_id = '${req.user?.id}' AND status = 'OPEN'
        LIMIT 1
      `);
    }

    if (!activeShift) {
      return res.status(400).json({ error: "No open shift found to close." });
    }

    // Calculate actual cash sales
    const [cashData] = await rawSql.unsafe(`
      SELECT COALESCE(SUM(p.amount), 0)::numeric(12,2) as total_cash_sales
      FROM sales s
      JOIN payments p ON s.id = p.sale_id
      WHERE s.shift_id = '${activeShift.id}' AND s.status = 'COMPLETED' AND p.payment_method = 'CASH'
    `);

    const openingCash = parseFloat(activeShift.opening_cash);
    const cashSales = parseFloat(cashData?.total_cash_sales || "0");
    const expectedCash = openingCash + cashSales;
    const actualCashNum = parseFloat(actualCash);
    const discrepancy = actualCashNum - expectedCash;

    const [closedShift] = await rawSql.unsafe(`
      UPDATE cashier_shifts
      SET 
        end_time = NOW(),
        status = 'CLOSED',
        expected_cash = ${expectedCash},
        actual_cash = ${actualCashNum},
        discrepancy = ${discrepancy},
        notes = ${notes ? `'${notes}'` : "notes"}
      WHERE id = '${activeShift.id}'
      RETURNING *
    `);

    // Log discrepancy notification if difference is non-zero
    if (Math.abs(discrepancy) > 0.01) {
      await rawSql.unsafe(`
        INSERT INTO notifications (title, message, type, reference_id)
        VALUES (
          'Shift Cash Discrepancy',
          'Cashier shift ended with a discrepancy of GH₵ ${discrepancy.toFixed(2)} (Expected: GH₵ ${expectedCash.toFixed(2)}, Actual: GH₵ ${actualCashNum.toFixed(2)})',
          'SHIFT_DISCREPANCY',
          '${activeShift.id}'
        )
      `);
    }

    await rawSql.unsafe(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (
        '${req.user?.id}', 'SHIFT_CLOSED', 'SHIFT', '${activeShift.id}',
        '${JSON.stringify({ expectedCash, actualCash: actualCashNum, discrepancy })}'::jsonb
      )
    `);

    await broadcastRealtimeEvent("SHIFT_UPDATED", { cashierId: activeShift.cashier_id, status: "CLOSED" });

    return res.json({
      success: true,
      message: "Shift closed successfully.",
      shift: closedShift,
      summary: {
        openingCash,
        cashSales,
        expectedCash,
        actualCash: actualCashNum,
        discrepancy,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to close shift." });
  }
});

// All shifts history
shiftsRouter.get("/history", requireAuthentication, async (req: Request, res: Response) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });

  try {
    const isOwner = req.user?.role === "OWNER" || req.user?.role === "ADMIN";
    const userFilter = isOwner ? "" : `WHERE s.cashier_id = '${req.user?.id}'`;

    const query = `
      SELECT 
        s.*,
        u.full_name as cashier_name,
        u.email as cashier_email,
        COUNT(sa.id)::integer as sales_count,
        COALESCE(SUM(sa.total_amount), 0)::numeric(12,2) as total_revenue
      FROM cashier_shifts s
      JOIN users u ON s.cashier_id = u.id
      LEFT JOIN sales sa ON s.id = sa.shift_id
      ${userFilter}
      GROUP BY s.id, u.full_name, u.email
      ORDER BY s.start_time DESC
      LIMIT 50
    `;

    const shifts = await rawSql.unsafe(query);
    return res.json({ shifts });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch shifts history" });
  }
});
