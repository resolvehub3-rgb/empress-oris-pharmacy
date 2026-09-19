import { Router, Request, Response } from "express";
import { getRawSql } from "../../db";
import { requireAuthentication, requireRole } from "../middleware/auth";
import { broadcastRealtimeEvent } from "../../services/supabase";

export const purchasesRouter = Router();

purchasesRouter.get("/", requireAuthentication, requireRole(["OWNER"]), async (req: Request, res: Response) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });

  try {
    const purchases = await rawSql.unsafe(`
      SELECT 
        p.*,
        s.name as supplier_name,
        COUNT(pi.id)::integer as item_count
      FROM purchases p
      JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN purchase_items pi ON p.id = pi.purchase_id
      GROUP BY p.id, s.name
      ORDER BY p.purchase_date DESC
      LIMIT 100
    `);

    return res.json({ purchases });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch purchases" });
  }
});

purchasesRouter.post("/", requireAuthentication, requireRole(["OWNER"]), async (req: Request, res: Response) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });

  const { supplierId, invoiceNumber, items, notes } = req.body;
  // items: array of { productId, batchNumber, quantity, costPrice, sellingPrice, expiryDate }

  if (!supplierId || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Supplier and purchase items are required." });
  }

  try {
    const result = await rawSql.begin(async (tx) => {
      let totalAmount = 0;
      for (const item of items) {
        totalAmount += (parseFloat(item.costPrice) * parseInt(item.quantity));
      }

      // Create Purchase
      const [purchase] = await tx`
        INSERT INTO purchases (supplier_id, invoice_number, total_amount, status, notes, created_by)
        VALUES (${supplierId}, ${invoiceNumber || null}, ${totalAmount}, 'RECEIVED', ${notes || null}, ${req.user?.id || null})
        RETURNING *
      `;

      for (const it of items) {
        const qty = parseInt(it.quantity);
        const cost = parseFloat(it.costPrice);
        const sell = parseFloat(it.sellingPrice);
        const lineTotal = cost * qty;

        // Check if batch exists or create new
        const [existingBatch] = await tx`
          SELECT * FROM batches WHERE product_id = ${it.productId} AND batch_number = ${it.batchNumber}
        `;

        let batchId = existingBatch?.id;
        if (existingBatch) {
          const prev = existingBatch.current_quantity;
          const next = prev + qty;
          await tx`
            UPDATE batches 
            SET current_quantity = ${next}, cost_price = ${cost}, selling_price = ${sell}, updated_at = NOW()
            WHERE id = ${existingBatch.id}
          `;

          await tx`
            INSERT INTO stock_movements (
              product_id, batch_id, movement_type, quantity_change, previous_quantity,
              new_quantity, reference_id, reason, user_id
            ) VALUES (
              ${it.productId}, ${existingBatch.id}, 'PURCHASE', ${qty},
              ${prev}, ${next}, ${invoiceNumber || purchase.id}, 'Supplier Purchase Order', ${req.user?.id || null}
            )
          `;
        } else {
          const [newBatch] = await tx`
            INSERT INTO batches (
              product_id, batch_number, supplier_id, initial_quantity, current_quantity,
              cost_price, selling_price, expiry_date, status
            ) VALUES (
              ${it.productId}, ${it.batchNumber}, ${supplierId}, ${qty}, ${qty},
              ${cost}, ${sell}, ${it.expiryDate}, 'ACTIVE'
            )
            RETURNING *
          `;
          batchId = newBatch.id;

          await tx`
            INSERT INTO stock_movements (
              product_id, batch_id, movement_type, quantity_change, previous_quantity,
              new_quantity, reference_id, reason, user_id
            ) VALUES (
              ${it.productId}, ${newBatch.id}, 'PURCHASE', ${qty},
              0, ${qty}, ${invoiceNumber || purchase.id}, 'Supplier Purchase Order', ${req.user?.id || null}
            )
          `;
        }

        await tx`
          INSERT INTO purchase_items (
            purchase_id, product_id, batch_id, quantity, cost_price, selling_price, total_cost, expiry_date
          ) VALUES (
            ${purchase.id}, ${it.productId}, ${batchId}, ${qty}, ${cost}, ${sell}, ${lineTotal}, ${it.expiryDate}
          )
        `;
      }

      await tx`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
        VALUES (
          ${req.user?.id || null}, 'PURCHASE_CREATED', 'PURCHASE', ${purchase.id},
          ${JSON.stringify({ supplierId, totalAmount, itemsCount: items.length })}::jsonb
        )
      `;

      return purchase;
    });

    await broadcastRealtimeEvent("STOCK_UPDATED", { action: "PURCHASE_RECEIVED" });

    return res.status(201).json({ success: true, purchase: result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to record purchase" });
  }
});
