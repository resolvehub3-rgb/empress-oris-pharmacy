import { Router, Request, Response } from "express";
import { getDb, getRawSql, schema } from "../../db";
import { requireAuthentication, requireRole } from "../middleware/auth";
import { broadcastRealtimeEvent } from "../../services/supabase";

export const salesRouter = Router();

// List Sales
salesRouter.get("/", requireAuthentication, async (req: Request, res: Response) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });

  try {
    const { startDate, endDate, cashierId, paymentMethod, receiptNumber } = req.query;

    const isOwner = req.user?.role === "OWNER";
    const employeeFilter = isOwner ? "" : `AND s.cashier_id = '${req.user?.id}'`;

    const query = `
      SELECT 
        s.*,
        u.full_name as cashier_name,
        p.payment_method,
        p.amount_received,
        p.change_given,
        p.transaction_reference,
        COUNT(si.id)::integer as item_count
      FROM sales s
      JOIN users u ON s.cashier_id = u.id
      LEFT JOIN payments p ON s.id = p.sale_id
      LEFT JOIN sale_items si ON s.id = si.sale_id
      WHERE 1=1
      ${employeeFilter}
      ${cashierId && isOwner ? `AND s.cashier_id = '${cashierId}'` : ""}
      ${receiptNumber ? `AND s.receipt_number ILIKE '%${receiptNumber}%'` : ""}
      ${paymentMethod ? `AND p.payment_method = '${paymentMethod}'` : ""}
      ${startDate ? `AND s.created_at >= '${startDate}'::timestamptz` : ""}
      ${endDate ? `AND s.created_at <= '${endDate} 23:59:59'::timestamptz` : ""}
      GROUP BY s.id, u.full_name, p.payment_method, p.amount_received, p.change_given, p.transaction_reference
      ORDER BY s.created_at DESC
      LIMIT 100
    `;

    const sales = await rawSql.unsafe(query);
    return res.json({ sales });
  } catch (err: any) {
    console.error("[Get Sales] Error:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch sales" });
  }
});

// Get single sale details & items for receipt reprint
salesRouter.get("/:id", requireAuthentication, async (req: Request, res: Response) => {
  const rawSql = getRawSql();
  const db = getDb();
  if (!rawSql || !db) return res.status(503).json({ error: "Database not connected." });

  try {
    const [sale] = await rawSql.unsafe(`
      SELECT 
        s.*,
        u.full_name as cashier_name,
        p.payment_method,
        p.amount_received,
        p.change_given,
        p.transaction_reference
      FROM sales s
      JOIN users u ON s.cashier_id = u.id
      LEFT JOIN payments p ON s.id = p.sale_id
      WHERE s.id = '${req.params.id}'
    `);

    if (!sale) return res.status(404).json({ error: "Sale not found." });

    const items = await rawSql.unsafe(`
      SELECT 
        si.*,
        p.name as product_name,
        p.sku as product_sku,
        p.dosage_form,
        p.strength,
        COALESCE(
          json_agg(
            json_build_object(
              'batch_id', sb.batch_id,
              'quantity', sb.quantity,
              'batch_number', b.batch_number,
              'expiry_date', b.expiry_date
            )
          ) FILTER (WHERE sb.batch_id IS NOT NULL),
          '[]'::json
        ) as batch_details
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      LEFT JOIN sale_batches sb ON si.id = sb.sale_item_id
      LEFT JOIN batches b ON sb.batch_id = b.id
      WHERE si.sale_id = '${req.params.id}'
      GROUP BY si.id, p.name, p.sku, p.dosage_form, p.strength
    `);

    const [pharmacy] = await db.select().from(schema.pharmacySettings).limit(1);

    return res.json({
      sale,
      items,
      pharmacy: pharmacy || {
        name: "Empress Oris Herbal & Mart",
        address: "Accra, Ghana",
        currency: "GHS",
        currencySymbol: "GH₵",
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch sale details" });
  }
});

// Process Refund (Owner only)
salesRouter.post(
  "/refund",
  requireAuthentication,
  requireRole(["OWNER"]),
  async (req: Request, res: Response) => {
    const rawSql = getRawSql();
    if (!rawSql) return res.status(503).json({ error: "Database not connected." });

    const { saleId, items, reason } = req.body;
    // items: array of { saleItemId, productId, batchId, quantity, refundAmount, restock }

    if (!saleId || !items || !Array.isArray(items) || items.length === 0 || !reason) {
      return res.status(400).json({ error: "Sale ID, items, and reason are required." });
    }

    try {
      const refundNumber = `REF-${Date.now().toString().slice(-6)}`;

      const result = await rawSql.begin(async (tx) => {
        let totalRefund = 0;
        for (const it of items) {
          totalRefund += parseFloat(it.refundAmount);
        }

        // Create Refund Record
        const [refund] = await tx`
          INSERT INTO refunds (sale_id, refund_number, processed_by, total_refund_amount, reason)
          VALUES (${saleId}, ${refundNumber}, ${req.user?.id || null}, ${totalRefund}, ${reason})
          RETURNING *
        `;

        // Update items and restore stock if requested
        for (const item of items) {
          const [refItem] = await tx`
            INSERT INTO refund_items (
              refund_id, sale_item_id, product_id, batch_id, quantity, refund_amount, restock
            ) VALUES (
              ${refund.id}, ${item.saleItemId}, ${item.productId}, ${item.batchId || null},
              ${item.quantity}, ${item.refundAmount}, ${item.restock !== false}
            )
            RETURNING *
          `;

          if (item.restock !== false && item.batchId) {
            // Restore batch quantity
            const [batch] = await tx`
              SELECT * FROM batches WHERE id = ${item.batchId} FOR UPDATE
            `;
            if (batch) {
              const prev = batch.current_quantity;
              const next = prev + parseInt(item.quantity);
              await tx`
                UPDATE batches SET current_quantity = ${next}, updated_at = NOW() WHERE id = ${batch.id}
              `;

              // Record stock movement
              await tx`
                INSERT INTO stock_movements (
                  product_id, batch_id, movement_type, quantity_change, previous_quantity,
                  new_quantity, reference_id, reason, user_id
                ) VALUES (
                  ${item.productId}, ${batch.id}, 'REFUND', ${parseInt(item.quantity)},
                  ${prev}, ${next}, ${refundNumber}, ${reason}, ${req.user?.id || null}
                )
              `;
            }
          }
        }

        // Update sale status
        await tx`
          UPDATE sales SET status = 'REFUNDED' WHERE id = ${saleId}
        `;

        // Audit Log
        await tx`
          INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
          VALUES (
            ${req.user?.id || null}, 'REFUND_CREATED', 'REFUND', ${refund.id},
            ${JSON.stringify({ saleId, refundNumber, totalRefund, reason })},
            ${req.ip || null}
          )
        `;

        return refund;
      });

      await broadcastRealtimeEvent("REFUND_PROCESSED", {
        refundId: result.id,
        saleId,
      });

      return res.status(201).json({ success: true, refund: result });
    } catch (err: any) {
      console.error("[Refund] Error:", err);
      return res.status(500).json({ error: err.message || "Failed to process refund." });
    }
  }
);
