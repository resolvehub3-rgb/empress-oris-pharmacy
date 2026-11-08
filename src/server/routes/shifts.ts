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

    // ---- SMS shift-closing notification (transactional outbox) ----
    // This must never delay or invalidate the successful shift closure.
    try {
      const [settings] = await rawSql.unsafe(`SELECT name, sms_notifications_enabled, sms_recipient_phone, phone FROM pharmacy_settings LIMIT 1`);
      const [cashier] = await rawSql.unsafe(`SELECT full_name FROM users WHERE id = '${activeShift.cashier_id}' LIMIT 1`);

      const pharmacyName = settings?.name || "Empress Oris Pharmacy";
      const cashierName = cashier?.full_name || "Cashier";
      const recipient = settings?.sms_recipient_phone || settings?.phone;

      // Product-level sales for this shift
      const productRows = await rawSql.unsafe(`
        SELECT p.name as product_name,
               COALESCE(SUM(si.quantity), 0)::integer as qty_sold,
               COALESCE(SUM(si.total_price), 0)::numeric(12,2) as sales_value,
               COALESCE(SUM(si.quantity * si.unit_cost), 0)::numeric(12,2) as cogs
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        JOIN products p ON p.id = si.product_id
        WHERE s.shift_id = '${activeShift.id}' AND s.status = 'COMPLETED'
        GROUP BY p.name
        ORDER BY sales_value DESC
      `);

      const [totals] = await rawSql.unsafe(`
        SELECT COUNT(s.id)::integer as txn_count,
               COALESCE(SUM(s.total_amount), 0)::numeric(12,2) as total_revenue,
               COALESCE(SUM(s.discount), 0)::numeric(12,2) as total_discount
        FROM sales s
        WHERE s.shift_id = '${activeShift.id}' AND s.status = 'COMPLETED'
      `);

      const payments = await rawSql.unsafe(`
        SELECT pmt.payment_method, COALESCE(SUM(pmt.amount), 0)::numeric(12,2) as amount
        FROM payments pmt
        JOIN sales s ON s.id = pmt.sale_id
        WHERE s.shift_id = '${activeShift.id}' AND s.status = 'COMPLETED'
        GROUP BY pmt.payment_method
      `);

      const totalRevenue = parseFloat(totals?.total_revenue || "0");
      const totalDiscount = parseFloat(totals?.total_discount || "0");
      const totalCogs = productRows.reduce((sum: number, r: any) => sum + parseFloat(r.cogs || "0"), 0);
      const grossProfit = totalRevenue - totalCogs;

      const paymentLines = payments.map((p: any) => `${p.payment_method}: GH₵${parseFloat(p.amount).toFixed(2)}`).join("\\n");

      const productLines = productRows.map((r: any) =>
        `${r.product_name} x${r.qty_sold} | Sales GH₵${parseFloat(r.sales_value).toFixed(2)} | COGS GH₵${parseFloat(r.cogs).toFixed(2)} | Profit GH₵${(parseFloat(r.sales_value) - parseFloat(r.cogs)).toFixed(2)}`
      ).join("\\n");

      const report = [
        "EMPRESS ORIS PHARMACY",
        "SHIFT CLOSING REPORT",
        "",
        `Pharmacy: ${pharmacyName}`,
        `Cashier: ${cashierName}`,
        `Date: ${new Date().toLocaleDateString("en-GB")}`,
        `Shift: ${activeShift.id}`,
        "",
        "PRODUCTS SOLD:",
        productLines || "No products sold",
        "",
        "FINANCIAL SUMMARY:",
        `Total Sales Revenue: GH₵${totalRevenue.toFixed(2)}`,
        `Total Discounts: GH₵${totalDiscount.toFixed(2)}`,
        `Cost of Goods Sold: GH₵${totalCogs.toFixed(2)}`,
        `Gross Profit: GH₵${grossProfit.toFixed(2)}`,
        `Total Transactions: ${totals?.txn_count || 0}`,
        paymentLines,
        "",
        "SHIFT STATUS: CLOSED",
      ].join("\\n");

      // Insert into outbox (idempotent via reference_id)
      const refId = `shift-sms-${activeShift.id}`;
      const [existing] = await rawSql.unsafe(`SELECT id FROM sms_outbox WHERE reference_id = '${refId}' LIMIT 1`);
      if (!existing) {
        const [outboxRow] = await rawSql.unsafe(`
          INSERT INTO sms_outbox (event_type, recipient, message, status, reference_id)
          VALUES ('SHIFT_CLOSED', ${recipient ? `'${recipient}'` : "NULL"}, '${report.replace(/'/g, "''")}', 'PENDING', '${refId}')
          RETURNING id
        `);

        // Asynchronous processing (fire-and-forget)
        if (outboxRow?.id) {
          (async () => {
            try {
              if (!settings?.sms_notifications_enabled) {
                await rawSql.unsafe(`UPDATE sms_outbox SET status = 'SKIPPED', last_error = 'SMS disabled by owner' WHERE id = '${outboxRow.id}'`);
                return;
              }
              if (!recipient) {
                await rawSql.unsafe(`UPDATE sms_outbox SET status = 'FAILED', last_error = 'No recipient phone configured' WHERE id = '${outboxRow.id}'`);
                return;
              }
              const { sendSms } = await import("../../services/sasuSync");
              const result = await sendSms(recipient, report);
              if (result.success) {
                await rawSql.unsafe(`UPDATE sms_outbox SET status = 'SENT', attempts = attempts + 1, sent_at = NOW() WHERE id = '${outboxRow.id}'`);
              } else {
                await rawSql.unsafe(`UPDATE sms_outbox SET status = 'FAILED', attempts = attempts + 1, last_error = '${(result.error || "Unknown error").replace(/'/g, "''")}' WHERE id = '${outboxRow.id}'`);
              }
            } catch (e: any) {
              await rawSql.unsafe(`UPDATE sms_outbox SET status = 'FAILED', attempts = attempts + 1, last_error = '${(e?.message || "Unknown error").replace(/'/g, "''")}' WHERE id = '${outboxRow.id}'`);
            }
          })();
        }
      }
    } catch (smsErr: any) {
      console.error("[Shift SMS] Failed to queue SMS:", smsErr);
    }

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
