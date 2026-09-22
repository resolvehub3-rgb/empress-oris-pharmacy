import { Router, Request, Response } from "express";
import { getDb, getRawSql, schema } from "../../db";
import { eq, desc } from "drizzle-orm";
import { requireAuthentication } from "../middleware/auth";
import { broadcastRealtimeEvent } from "../../services/supabase";

export const posRouter = Router();

// Fast product search for POS terminal (supports Camera QR codes, Barcodes, SKU, text)
posRouter.get("/search", requireAuthentication, async (req: Request, res: Response) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });

  const { query, barcode, categoryId } = req.query;

  try {
    let cleanCode = (barcode ? String(barcode) : "").trim();
    // Support QR codes that might encode JSON (e.g. { sku: "...", barcode: "..." })
    if (cleanCode.startsWith("{") && cleanCode.endsWith("}")) {
      try {
        const parsed = JSON.parse(cleanCode);
        cleanCode = String(parsed.barcode || parsed.sku || parsed.id || cleanCode).trim();
      } catch {}
    }

    if (cleanCode) {
      const products = await rawSql`
        SELECT 
          p.id,
          p.name,
          p.generic_name AS "genericName",
          p.brand_name AS "brandName",
          p.sku,
          p.barcode,
          p.dosage_form AS "dosageForm",
          p.strength,
          p.unit,
          p.pack_size AS "packSize",
          p.prescription_required AS "prescriptionRequired",
          p.image_url AS "imageUrl",
          p.selling_price AS "sellingPrice",
          p.reorder_level AS "reorderLevel",
          c.name AS "categoryName",
          COALESCE(SUM(CASE WHEN b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE THEN b.current_quantity ELSE 0 END), 0)::integer AS "totalStock",
          COALESCE(
            json_agg(
              json_build_object(
                'id', b.id,
                'batchNumber', b.batch_number,
                'currentQuantity', b.current_quantity,
                'expiryDate', b.expiry_date,
                'sellingPrice', b.selling_price
              ) ORDER BY b.expiry_date ASC
            ) FILTER (WHERE b.id IS NOT NULL AND b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE),
            '[]'::json
          ) AS "availableBatches"
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN batches b ON p.id = b.product_id
        WHERE p.is_active = true
        AND (
          p.barcode = ${cleanCode} 
          OR p.sku = ${cleanCode} 
          OR p.id::text = ${cleanCode}
          OR p.barcode ILIKE ${'%' + cleanCode + '%'}
          OR p.sku ILIKE ${'%' + cleanCode + '%'}
        )
        GROUP BY p.id, c.name
        ORDER BY (CASE WHEN p.barcode = ${cleanCode} OR p.sku = ${cleanCode} OR p.id::text = ${cleanCode} THEN 0 ELSE 1 END), p.name ASC
        LIMIT 10
      `;
      return res.json({ products });
    }

    const qStr = query ? `%${String(query).trim()}%` : null;
    const cat = categoryId ? String(categoryId) : null;

    const products = await rawSql`
      SELECT 
        p.id,
        p.name,
        p.generic_name AS "genericName",
        p.brand_name AS "brandName",
        p.sku,
        p.barcode,
        p.dosage_form AS "dosageForm",
        p.strength,
        p.unit,
        p.pack_size AS "packSize",
        p.prescription_required AS "prescriptionRequired",
        p.image_url AS "imageUrl",
        p.selling_price AS "sellingPrice",
        p.reorder_level AS "reorderLevel",
        c.name AS "categoryName",
        COALESCE(SUM(CASE WHEN b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE THEN b.current_quantity ELSE 0 END), 0)::integer AS "totalStock",
        COALESCE(
          json_agg(
            json_build_object(
              'id', b.id,
              'batchNumber', b.batch_number,
              'currentQuantity', b.current_quantity,
              'expiryDate', b.expiry_date,
              'sellingPrice', b.selling_price
            ) ORDER BY b.expiry_date ASC
          ) FILTER (WHERE b.id IS NOT NULL AND b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE),
          '[]'::json
        ) AS "availableBatches"
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN batches b ON p.id = b.product_id
      WHERE p.is_active = true
      ${qStr ? rawSql`AND (
        p.name ILIKE ${qStr} OR 
        p.generic_name ILIKE ${qStr} OR 
        p.brand_name ILIKE ${qStr} OR 
        p.sku ILIKE ${qStr} OR 
        p.barcode ILIKE ${qStr}
      )` : rawSql``}
      ${cat ? rawSql`AND p.category_id = ${cat}` : rawSql``}
      GROUP BY p.id, c.name
      ORDER BY p.name ASC
      LIMIT 30
    `;

    return res.json({ products });
  } catch (err: any) {
    console.error("[POS Search] Error:", err);
    return res.status(500).json({ error: err.message || "Failed to search products" });
  }
});

// FEFO Sale Checkout Transaction
posRouter.post("/checkout", requireAuthentication, async (req: Request, res: Response) => {
  const rawSql = getRawSql();
  const db = getDb();
  if (!rawSql || !db) return res.status(503).json({ error: "Database not connected." });

  const {
    items, // array of { productId, quantity, unitPrice, discount }
    customerName,
    customerPhone,
    paymentMethod, // 'CASH' | 'MTN_MOMO' | 'TELECEL_CASH' | 'AIRTELTIGO_MONEY' | 'CARD' | 'BANK_TRANSFER' | 'OTHER'
    amountReceived,
    transactionReference,
    discount = 0,
    notes,
  } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Cart is empty. At least one item is required." });
  }

  if (!paymentMethod) {
    return res.status(400).json({ error: "Payment method is required." });
  }

  try {
    // 1. Verify Cashier has an OPEN Shift
    const [activeShift] = await rawSql.unsafe(`
      SELECT * FROM cashier_shifts 
      WHERE cashier_id = '${req.user?.id}' AND status = 'OPEN'
      ORDER BY start_time DESC
      LIMIT 1
    `);

    if (!activeShift) {
      return res.status(400).json({
        error: "You do not have an active open cashier shift. Please open a shift before completing sales.",
        requiresShiftOpen: true,
      });
    }

    // 2. Fetch Pharmacy Settings for Receipt
    const [pharmacy] = await db.select().from(schema.pharmacySettings).limit(1);

    // 3. Execute Sale Transaction with Row Locks
    const receiptNumber = `GH-REC-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    const result = await rawSql.begin(async (tx) => {
      let subtotal = 0;
      let totalCostOfGoodsSold = 0;
      const processedItems: any[] = [];

      // Process each cart item with FEFO allocation
      for (const item of items) {
        const reqQty = parseInt(item.quantity);
        if (!reqQty || reqQty <= 0) {
          throw new Error(`Invalid quantity for product ${item.productId}`);
        }

        // Fetch product
        const [prod] = await tx`
          SELECT * FROM products WHERE id = ${item.productId} AND is_active = true
        `;
        if (!prod) {
          throw new Error(`Product not found or inactive.`);
        }

        const unitPrice = item.unitPrice ? parseFloat(item.unitPrice) : parseFloat(prod.selling_price);
        const itemDiscount = item.discount ? parseFloat(item.discount) : 0;
        const lineTotal = (unitPrice * reqQty) - itemDiscount;
        subtotal += lineTotal;

        // Fetch available non-expired batches for this product ordered by expiry_date ASC (FEFO) with row lock
        const availableBatches = await tx`
          SELECT * FROM batches 
          WHERE product_id = ${item.productId} 
            AND current_quantity > 0 
            AND expiry_date >= CURRENT_DATE
          ORDER BY expiry_date ASC
          FOR UPDATE
        `;

        const totalAvailable = availableBatches.reduce((acc: number, b: any) => acc + b.current_quantity, 0);

        if (totalAvailable < reqQty) {
          throw new Error(
            `Insufficient non-expired stock for "${prod.name}". Required: ${reqQty}, Available: ${totalAvailable}.`
          );
        }

        // Allocate across batches (FEFO)
        let remainingToAllocate = reqQty;
        const batchAllocations: any[] = [];
        let itemTotalCost = 0;

        for (const b of availableBatches) {
          if (remainingToAllocate <= 0) break;

          const qtyFromThisBatch = Math.min(remainingToAllocate, b.current_quantity);
          const newBatchQty = b.current_quantity - qtyFromThisBatch;

          // Deduct from batch
          await tx`
            UPDATE batches 
            SET current_quantity = ${newBatchQty}, updated_at = NOW()
            WHERE id = ${b.id}
          `;

          const unitCost = parseFloat(b.cost_price || "0.0");
          const batchCost = unitCost * qtyFromThisBatch;
          itemTotalCost += batchCost;
          totalCostOfGoodsSold += batchCost;

          console.log(`[POS COGS] Batch ${b.batch_number}: cost_price=GH₵${unitCost}, qty=${qtyFromThisBatch}, batchCost=GH₵${batchCost}`);

          batchAllocations.push({
            batchId: b.id,
            batchNumber: b.batch_number,
            expiryDate: b.expiry_date,
            quantity: qtyFromThisBatch,
            unitCost,
            previousQty: b.current_quantity,
            newQty: newBatchQty,
          });

          remainingToAllocate -= qtyFromThisBatch;
        }

        processedItems.push({
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          quantity: reqQty,
          unitPrice,
          discount: itemDiscount,
          totalPrice: lineTotal,
          totalCost: itemTotalCost,
          batchAllocations,
        });
      }

      // Calculate totals
      const overallDiscount = discount ? parseFloat(discount) : 0;
      const totalAmount = Math.max(0, subtotal - overallDiscount);
      const amtRec = amountReceived ? parseFloat(amountReceived) : totalAmount;
      const changeGiven = paymentMethod === "CASH" ? Math.max(0, amtRec - totalAmount) : 0;

      // Create Sale Record
      const [sale] = await tx`
        INSERT INTO sales (
          receipt_number, cashier_id, shift_id, customer_name, customer_phone,
          subtotal, discount, tax, total_amount, total_cost, status
        ) VALUES (
          ${receiptNumber}, ${req.user?.id || null}, ${activeShift.id},
          ${customerName || null}, ${customerPhone || null},
          ${subtotal}, ${overallDiscount}, 0.00,
          ${totalAmount}, ${totalCostOfGoodsSold}, 'COMPLETED'
        )
        RETURNING *
      `;

      // Create Sale Items and Batch Links
      for (const item of processedItems) {
        const [saleItem] = await tx`
          INSERT INTO sale_items (
            sale_id, product_id, quantity, unit_price, discount, total_price,
            unit_cost, total_cost
          ) VALUES (
            ${sale.id}, ${item.productId}, ${item.quantity}, ${item.unitPrice},
            ${item.discount}, ${item.totalPrice}, ${item.totalCost / item.quantity}, ${item.totalCost}
          )
          RETURNING *
        `;

        for (const alloc of item.batchAllocations) {
          // Sale Batches record
          await tx`
            INSERT INTO sale_batches (sale_item_id, batch_id, quantity, unit_cost)
            VALUES (${saleItem.id}, ${alloc.batchId}, ${alloc.quantity}, ${alloc.unitCost})
          `;

          // Stock Movement record for each allocated batch
          await tx`
            INSERT INTO stock_movements (
              product_id, batch_id, movement_type, quantity_change, previous_quantity,
              new_quantity, reference_id, reason, user_id
            ) VALUES (
              ${item.productId}, ${alloc.batchId}, 'SALE', ${-alloc.quantity},
              ${alloc.previousQty}, ${alloc.newQty}, ${receiptNumber},
              ${'POS Sale'}, ${req.user?.id || null}
            )
          `;
        }
      }

      // Create Payment Record
      const [payment] = await tx`
        INSERT INTO payments (
          sale_id, payment_method, amount, amount_received, change_given,
          transaction_reference, notes
        ) VALUES (
          ${sale.id}, ${paymentMethod}, ${totalAmount}, ${amtRec}, ${changeGiven},
          ${transactionReference || null}, ${notes || null}
        )
        RETURNING *
      `;

      // Audit Log
      await tx`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
        VALUES (
          ${req.user?.id || null}, 'SALE_COMPLETED', 'SALE', ${sale.id},
          ${JSON.stringify({
            receiptNumber,
            totalAmount,
            paymentMethod,
            itemsCount: processedItems.length,
          })},
          ${req.ip || null}
        )
      `;

      return {
        sale,
        payment,
        items: processedItems,
        pharmacy,
      };
    });

    // Supabase Realtime Broadcast
    await broadcastRealtimeEvent("SALE_COMPLETED", {
      saleId: result.sale.id,
      receiptNumber: result.sale.receipt_number,
      totalAmount: result.sale.total_amount,
      cashierId: req.user?.id,
    });

    return res.status(201).json({
      success: true,
      message: "Sale completed successfully.",
      receipt: {
        pharmacyName: result.pharmacy?.name || "Empress Oris Herbal & Mart",
        pharmacyAddress: result.pharmacy?.address || "Accra, Ghana",
        pharmacyPhone: result.pharmacy?.phone || "",
        logoUrl: result.pharmacy?.logoUrl || null,
        receiptFooter: result.pharmacy?.receiptFooter || "Thank you for your patronage!",
        receiptNumber: result.sale.receipt_number,
        date: result.sale.created_at,
        cashierName: req.user?.fullName,
        customerName: result.sale.customer_name,
        customerPhone: result.sale.customer_phone,
        items: result.items,
        subtotal: result.sale.subtotal,
        discount: result.sale.discount,
        totalAmount: result.sale.total_amount,
        paymentMethod: result.payment.payment_method,
        amountReceived: result.payment.amount_received,
        changeGiven: result.payment.change_given,
        transactionReference: result.payment.transaction_reference,
      },
    });
  } catch (err: any) {
    console.error("[POS Checkout] Error:", err);
    return res.status(400).json({ error: err.message || "Failed to process sale." });
  }
});
