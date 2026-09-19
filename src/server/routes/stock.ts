import { Router, Request, Response } from "express";
import { getDb, getRawSql, schema } from "../../db";
import { requireAuthentication, requireRole } from "../middleware/auth";
import { broadcastRealtimeEvent } from "../../services/supabase";

export const stockRouter = Router();

// Add Stock to existing product (Supports new batch or updating existing batch)
stockRouter.post(
  "/add",
  requireAuthentication,
  requireRole(["OWNER"]),
  async (req: Request, res: Response) => {
    const rawSql = getRawSql();
    if (!rawSql) return res.status(503).json({ error: "Database not connected." });

    const {
      productId,
      supplierId,
      quantity,
      batchNumber,
      costPrice,
      sellingPrice,
      manufacturingDate,
      expiryDate,
      purchaseReference,
      notes,
      existingBatchId,
    } = req.body;

    if (!productId || !quantity || quantity <= 0) {
      return res.status(400).json({ error: "Product and valid quantity (> 0) are required." });
    }

    try {
      const result = await rawSql.begin(async (tx) => {
        // Verify product exists
        const [product] = await tx`SELECT * FROM products WHERE id = ${productId}`;
        if (!product) {
          throw new Error("Product not found.");
        }

        let targetBatch = null;
        let prevQty = 0;
        let newQty = 0;

        if (existingBatchId) {
          // Increase quantity of existing batch
          const [existingBatch] = await tx`SELECT * FROM batches WHERE id = ${existingBatchId} FOR UPDATE`;
          if (!existingBatch) {
            throw new Error("Specified batch not found.");
          }
          prevQty = existingBatch.current_quantity;
          newQty = prevQty + parseInt(quantity);

          const [updatedBatch] = await tx`
            UPDATE batches 
            SET 
              current_quantity = ${newQty},
              cost_price = ${costPrice ? parseFloat(costPrice) : existingBatch.cost_price},
              selling_price = ${sellingPrice ? parseFloat(sellingPrice) : existingBatch.selling_price},
              updated_at = NOW()
            WHERE id = ${existingBatchId}
            RETURNING *
          `;
          targetBatch = updatedBatch;
        } else {
          // Create New Batch
          if (!batchNumber) {
            throw new Error("Batch number is required for a new batch.");
          }
          if (!expiryDate) {
            throw new Error("Expiry date is required for a new batch.");
          }

          // Check if batch number already exists for this product
          const [duplicateBatch] = await tx`
            SELECT * FROM batches 
            WHERE product_id = ${productId} AND batch_number = ${batchNumber}
          `;

          if (duplicateBatch) {
            // Update existing batch instead of duplicating
            prevQty = duplicateBatch.current_quantity;
            newQty = prevQty + parseInt(quantity);
            const [updatedBatch] = await tx`
              UPDATE batches 
              SET current_quantity = ${newQty}, updated_at = NOW()
              WHERE id = ${duplicateBatch.id}
              RETURNING *
            `;
            targetBatch = updatedBatch;
          } else {
            prevQty = 0;
            newQty = parseInt(quantity);
            const [newBatch] = await tx`
              INSERT INTO batches (
                product_id, batch_number, supplier_id, initial_quantity, current_quantity,
                cost_price, selling_price, manufacturing_date, expiry_date, status, notes
              ) VALUES (
                ${productId}, ${batchNumber}, ${supplierId || null}, ${newQty}, ${newQty},
                ${costPrice ? parseFloat(costPrice) : 0.0},
                ${sellingPrice ? parseFloat(sellingPrice) : parseFloat(product.selling_price || "0.0")},
                ${manufacturingDate || null}, ${expiryDate}, 'ACTIVE', ${notes || null}
              )
              RETURNING *
            `;
            targetBatch = newBatch;
          }
        }

        // Create Stock Movement
        const [movement] = await tx`
          INSERT INTO stock_movements (
            product_id, batch_id, movement_type, quantity_change, previous_quantity,
            new_quantity, reference_id, reason, user_id
          ) VALUES (
            ${productId}, ${targetBatch.id}, 'PURCHASE', ${parseInt(quantity)},
            ${prevQty}, ${newQty}, ${purchaseReference || `PO-${Date.now()}`},
            ${notes || "Stock replenishment"}, ${req.user?.id || null}
          )
          RETURNING *
        `;

        // Audit Log
        await tx`
          INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
          VALUES (
            ${req.user?.id || null}, 'STOCK_ADDED', 'BATCH', ${targetBatch.id},
            ${JSON.stringify({
              productName: product.name,
              batchNumber: targetBatch.batch_number,
              quantityAdded: parseInt(quantity),
              newQuantity: newQty,
            })},
            ${req.ip || null}
          )
        `;

        return { product, batch: targetBatch, movement };
      });

      // Broadcast Realtime Event
      await broadcastRealtimeEvent("STOCK_UPDATED", {
        productId: result.product.id,
        batch: result.batch,
        action: "STOCK_ADDED",
      });

      return res.status(200).json({
        success: true,
        message: `Successfully added ${quantity} units to batch ${result.batch.batch_number}.`,
        data: result,
      });
    } catch (err: any) {
      console.error("[Add Stock] Error:", err);
      return res.status(500).json({ error: err.message || "Failed to add stock." });
    }
  }
);

// Stock Adjustment (Damaged, Expired, Audit Discrepancy)
stockRouter.post(
  "/adjust",
  requireAuthentication,
  requireRole(["OWNER"]),
  async (req: Request, res: Response) => {
    const rawSql = getRawSql();
    if (!rawSql) return res.status(503).json({ error: "Database not connected." });

    const { batchId, quantityChange, movementType, reason } = req.body;
    // movementType: 'DAMAGE' | 'EXPIRY' | 'ADJUSTMENT' | 'RETURN'

    if (!batchId || quantityChange === undefined || !reason) {
      return res.status(400).json({ error: "Batch ID, quantity change, and reason are required." });
    }

    try {
      const result = await rawSql.begin(async (tx) => {
        const [batch] = await tx`SELECT * FROM batches WHERE id = ${batchId} FOR UPDATE`;
        if (!batch) throw new Error("Batch not found.");

        const prevQty = batch.current_quantity;
        const change = parseInt(quantityChange);
        const newQty = prevQty + change;

        if (newQty < 0) {
          throw new Error(`Insufficient batch stock. Current quantity is ${prevQty}, cannot deduct ${Math.abs(change)}.`);
        }

        const [updatedBatch] = await tx`
          UPDATE batches
          SET current_quantity = ${newQty}, updated_at = NOW()
          WHERE id = ${batchId}
          RETURNING *
        `;

        const [movement] = await tx`
          INSERT INTO stock_movements (
            product_id, batch_id, movement_type, quantity_change, previous_quantity,
            new_quantity, reason, user_id
          ) VALUES (
            ${batch.product_id}, ${batch.id}, ${movementType || "ADJUSTMENT"},
            ${change}, ${prevQty}, ${newQty}, ${reason}, ${req.user?.id || null}
          )
          RETURNING *
        `;

        await tx`
          INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
          VALUES (
            ${req.user?.id || null}, 'STOCK_ADJUSTED', 'BATCH', ${batch.id},
            ${JSON.stringify({
              batchNumber: batch.batch_number,
              change,
              previous: prevQty,
              new: newQty,
              reason,
            })},
            ${req.ip || null}
          )
        `;

        return { batch: updatedBatch, movement };
      });

      await broadcastRealtimeEvent("STOCK_UPDATED", {
        productId: result.batch.product_id,
        batch: result.batch,
        action: "STOCK_ADJUSTED",
      });

      return res.json({ success: true, message: "Stock adjustment saved successfully.", data: result });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to adjust stock." });
    }
  }
);

// Get All Batches with real expiry calculations
stockRouter.get("/batches", requireAuthentication, async (req: Request, res: Response) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });

  try {
    const { filter } = req.query; // 'all' | 'expiring_soon' | 'expired' | 'low'

    const query = `
      SELECT 
        b.*,
        p.name as product_name,
        p.sku as product_sku,
        p.dosage_form,
        p.strength,
        s.name as supplier_name,
        (b.expiry_date < CURRENT_DATE) as is_expired,
        (b.expiry_date >= CURRENT_DATE AND b.expiry_date <= CURRENT_DATE + INTERVAL '90 days') as is_expiring_soon,
        (b.expiry_date - CURRENT_DATE)::integer as days_until_expiry
      FROM batches b
      JOIN products p ON b.product_id = p.id
      LEFT JOIN suppliers s ON b.supplier_id = s.id
      WHERE 1=1
      ${filter === "expiring_soon" ? "AND b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE AND b.expiry_date <= CURRENT_DATE + INTERVAL '90 days'" : ""}
      ${filter === "expired" ? "AND b.expiry_date < CURRENT_DATE" : ""}
      ${filter === "active" ? "AND b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE" : ""}
      ORDER BY b.expiry_date ASC
    `;

    const batches = await rawSql.unsafe(query);
    return res.json({ batches });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch batches" });
  }
});

// Stock Movements Audit History
stockRouter.get("/movements", requireAuthentication, async (req: Request, res: Response) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });

  try {
    const { productId, movementType, limit = 100 } = req.query;

    const query = `
      SELECT 
        sm.*,
        p.name as product_name,
        p.sku as product_sku,
        b.batch_number,
        b.expiry_date,
        u.full_name as user_name
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      JOIN batches b ON sm.batch_id = b.id
      LEFT JOIN users u ON sm.user_id = u.id
      WHERE 1=1
      ${productId ? `AND sm.product_id = '${productId}'` : ""}
      ${movementType ? `AND sm.movement_type = '${movementType}'` : ""}
      ORDER BY sm.created_at DESC
      LIMIT ${parseInt(limit as string) || 100}
    `;

    const movements = await rawSql.unsafe(query);
    return res.json({ movements });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch movements" });
  }
});
