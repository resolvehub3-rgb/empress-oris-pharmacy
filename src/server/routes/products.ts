import { Router, Request, Response } from "express";
import multer from "multer";
import { getDb, getRawSql, schema } from "../../db";
import { eq, sql, desc, and, or, ilike } from "drizzle-orm";
import { requireAuthentication, requireRole } from "../middleware/auth";
import { uploadImageToStorage, broadcastRealtimeEvent } from "../../services/supabase";

export const productsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and WEBP image files are allowed."));
    }
  },
});

// Upload Product Image to Supabase Storage
productsRouter.post(
  "/upload-image",
  requireAuthentication,
  requireRole(["OWNER", "ADMIN"]),
  upload.single("image"),
  async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided." });
    }

    try {
      const ext = req.file.mimetype.split("/")[1] || "webp";
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`;
      const storagePath = `products/${fileName}`;

      const publicUrl = await uploadImageToStorage(
        "product-images",
        storagePath,
        req.file.buffer,
        req.file.mimetype
      );

      if (!publicUrl) {
        return res.status(500).json({ error: "Failed to upload image to Supabase Storage." });
      }

      return res.json({
        success: true,
        url: publicUrl,
        storagePath,
      });
    } catch (err: any) {
      console.error("[Image Upload] Error:", err);
      return res.status(500).json({ error: err.message || "Failed to upload image." });
    }
  }
);

// Get all products with batch breakdown and live stock calculations
productsRouter.get("/", requireAuthentication, async (req: Request, res: Response) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: "Database not connected." });

  try {
    const { search, categoryId, lowStock, activeOnly = "true" } = req.query;

    const rawSql = getRawSql();
    if (!rawSql) {
      return res.status(503).json({ error: "PostgreSQL client not ready." });
    }

    // Direct join query to accurately calculate non-expired current stock and batch summary
    const query = `
      SELECT 
        p.*,
        c.name as category_name,
        COALESCE(SUM(CASE WHEN b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE THEN b.current_quantity ELSE 0 END), 0)::integer as total_stock,
        COALESCE(SUM(CASE WHEN b.current_quantity > 0 AND b.expiry_date < CURRENT_DATE THEN b.current_quantity ELSE 0 END), 0)::integer as expired_stock,
        COUNT(b.id)::integer as batch_count,
        COALESCE(
          json_agg(
            json_build_object(
              'id', b.id,
              'batch_number', b.batch_number,
              'current_quantity', b.current_quantity,
              'initial_quantity', b.initial_quantity,
              'cost_price', b.cost_price,
              'selling_price', b.selling_price,
              'expiry_date', b.expiry_date,
              'status', b.status,
              'is_expired', (b.expiry_date < CURRENT_DATE)
            ) ORDER BY b.expiry_date ASC
          ) FILTER (WHERE b.id IS NOT NULL),
          '[]'::json
        ) as batches
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN batches b ON p.id = b.product_id
      WHERE 1=1
      ${activeOnly === "true" ? "AND p.is_active = true" : ""}
      ${categoryId ? `AND p.category_id = '${categoryId}'` : ""}
      ${
        search
          ? `AND (
              p.name ILIKE '%${search}%' OR 
              p.generic_name ILIKE '%${search}%' OR 
              p.brand_name ILIKE '%${search}%' OR 
              p.sku ILIKE '%${search}%' OR 
              p.barcode ILIKE '%${search}%'
            )`
          : ""
      }
      GROUP BY p.id, c.name
      ${lowStock === "true" ? "HAVING COALESCE(SUM(CASE WHEN b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE THEN b.current_quantity ELSE 0 END), 0) <= p.reorder_level" : ""}
      ORDER BY p.created_at DESC
    `;

    const result = await rawSql.unsafe(query);
    return res.json({ products: result });
  } catch (err: any) {
    console.error("[Get Products] Error:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch products" });
  }
});

// Get single product details
productsRouter.get("/:id", requireAuthentication, async (req: Request, res: Response) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: "Database not connected." });

  try {
    const rawSql = getRawSql();
    if (!rawSql) return res.status(503).json({ error: "PostgreSQL client not ready." });

    const [product] = await rawSql.unsafe(`
      SELECT 
        p.*,
        c.name as category_name,
        COALESCE(SUM(CASE WHEN b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE THEN b.current_quantity ELSE 0 END), 0)::integer as total_stock,
        COALESCE(SUM(CASE WHEN b.current_quantity > 0 AND b.expiry_date < CURRENT_DATE THEN b.current_quantity ELSE 0 END), 0)::integer as expired_stock
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN batches b ON p.id = b.product_id
      WHERE p.id = '${req.params.id}'
      GROUP BY p.id, c.name
    `);

    if (!product) {
      return res.status(404).json({ error: "Product not found." });
    }

    const batches = await rawSql.unsafe(`
      SELECT b.*, s.name as supplier_name
      FROM batches b
      LEFT JOIN suppliers s ON b.supplier_id = s.id
      WHERE b.product_id = '${req.params.id}'
      ORDER BY b.expiry_date ASC
    `);

    const movements = await rawSql.unsafe(`
      SELECT sm.*, b.batch_number, u.full_name as user_name
      FROM stock_movements sm
      LEFT JOIN batches b ON sm.batch_id = b.id
      LEFT JOIN users u ON sm.user_id = u.id
      WHERE sm.product_id = '${req.params.id}'
      ORDER BY sm.created_at DESC
      LIMIT 50
    `);

    return res.json({
      product,
      batches,
      movements,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch product details" });
  }
});

// CRITICAL WORKFLOW: Add Product + Optional Initial Stock in ONE Atomic Transaction
productsRouter.post(
  "/",
  requireAuthentication,
  requireRole(["OWNER", "ADMIN"]),
  async (req: Request, res: Response) => {
    const db = getDb();
    const rawSql = getRawSql();
    if (!db || !rawSql) {
      return res.status(503).json({ error: "Database not connected." });
    }

    const {
      name,
      genericName,
      brandName,
      sku,
      barcode,
      categoryId,
      dosageForm,
      strength,
      unit,
      packSize,
      manufacturer,
      description,
      prescriptionRequired,
      imageUrl,
      reorderLevel,
      sellingPrice,
      wholesalePrice,
      // Initial Stock Section
      hasInitialStock,
      initialQuantity,
      batchNumber,
      costPrice,
      batchSellingPrice,
      expiryDate,
      supplierId,
      manufacturingDate,
      purchaseReference,
      stockNotes,
    } = req.body;

    if (!name || !sku) {
      return res.status(400).json({ error: "Product Name and SKU are required." });
    }

    if (hasInitialStock) {
      if (!initialQuantity || initialQuantity <= 0) {
        return res.status(400).json({ error: "Initial quantity must be greater than 0 when adding initial stock." });
      }
      if (!batchNumber) {
        return res.status(400).json({ error: "Batch number is required for initial stock." });
      }
      if (!expiryDate) {
        return res.status(400).json({ error: "Expiry date is required for initial stock." });
      }
    }

    try {
      // Check for duplicate SKU or Barcode
      const [existingSku] = await db
        .select()
        .from(schema.products)
        .where(eq(schema.products.sku, sku))
        .limit(1);

      if (existingSku) {
        return res.status(400).json({ error: `A product with SKU '${sku}' already exists.` });
      }

      if (barcode) {
        const [existingBarcode] = await db
          .select()
          .from(schema.products)
          .where(eq(schema.products.barcode, barcode))
          .limit(1);

        if (existingBarcode) {
          return res.status(400).json({ error: `A product with Barcode '${barcode}' already exists.` });
        }
      }

      // Execute Transaction
      const result = await rawSql.begin(async (tx) => {
        // 1. Create Product
        const [createdProduct] = await tx`
          INSERT INTO products (
            name, generic_name, brand_name, sku, barcode, category_id,
            dosage_form, strength, unit, pack_size, manufacturer, description,
            prescription_required, image_url, reorder_level, selling_price, wholesale_price
          ) VALUES (
            ${name}, ${genericName || null}, ${brandName || null}, ${sku}, ${barcode || null},
            ${categoryId || null}, ${dosageForm || null}, ${strength || null}, ${unit || "Pack"},
            ${packSize ? parseInt(packSize) : 1}, ${manufacturer || null}, ${description || null},
            ${prescriptionRequired ? true : false}, ${imageUrl || null},
            ${reorderLevel ? parseInt(reorderLevel) : 10},
            ${sellingPrice ? parseFloat(sellingPrice) : 0.0},
            ${wholesalePrice ? parseFloat(wholesalePrice) : null}
          )
          RETURNING *
        `;

        // 2. If Image URL provided, add to product_images
        if (imageUrl) {
          await tx`
            INSERT INTO product_images (product_id, storage_path, url, is_primary)
            VALUES (${createdProduct.id}, ${imageUrl}, ${imageUrl}, true)
          `;
        }

        let createdBatch = null;
        let createdMovement = null;

        // 3. If Initial Stock provided, create Batch and Stock Movement
        if (hasInitialStock && initialQuantity > 0) {
          const qty = parseInt(initialQuantity);
          const cost = costPrice ? parseFloat(costPrice) : 0.0;
          const sell = batchSellingPrice ? parseFloat(batchSellingPrice) : parseFloat(sellingPrice || "0.0");

          const [batch] = await tx`
            INSERT INTO batches (
              product_id, batch_number, supplier_id, initial_quantity, current_quantity,
              cost_price, selling_price, manufacturing_date, expiry_date, status, notes
            ) VALUES (
              ${createdProduct.id}, ${batchNumber}, ${supplierId || null}, ${qty}, ${qty},
              ${cost}, ${sell}, ${manufacturingDate || null}, ${expiryDate}, 'ACTIVE', ${stockNotes || "Opening stock"}
            )
            RETURNING *
          `;
          createdBatch = batch;

          // 4. Create Stock Movement
          const [movement] = await tx`
            INSERT INTO stock_movements (
              product_id, batch_id, movement_type, quantity_change, previous_quantity,
              new_quantity, reference_id, reason, user_id
            ) VALUES (
              ${createdProduct.id}, ${batch.id}, 'INITIAL_STOCK', ${qty}, 0,
              ${qty}, ${purchaseReference || `INIT-${batchNumber}`}, 'Initial opening stock upon product creation', ${req.user?.id || null}
            )
            RETURNING *
          `;
          createdMovement = movement;

          // 5. Audit Log for Stock Addition
          await tx`
            INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
            VALUES (
              ${req.user?.id || null}, 'INITIAL_STOCK_ADDED', 'BATCH', ${batch.id},
              ${JSON.stringify({
                productId: createdProduct.id,
                productName: name,
                batchNumber,
                quantity: qty,
                costPrice: cost,
                sellingPrice: sell,
                expiryDate,
              })},
              ${req.ip || null}
            )
          `;
        }

        // 6. Audit Log for Product Creation
        await tx`
          INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
          VALUES (
            ${req.user?.id || null}, 'PRODUCT_CREATED', 'PRODUCT', ${createdProduct.id},
            ${JSON.stringify({
              name,
              sku,
              barcode,
              hasInitialStock: !!hasInitialStock,
              initialQuantity: hasInitialStock ? initialQuantity : 0,
            })},
            ${req.ip || null}
          )
        `;

        return {
          product: createdProduct,
          batch: createdBatch,
          movement: createdMovement,
        };
      });

      // 7. Supabase Realtime Broadcast
      await broadcastRealtimeEvent("PRODUCT_CREATED", {
        product: result.product,
        batch: result.batch,
      });

      return res.status(201).json({
        success: true,
        message: result.batch
          ? `Product '${name}' created successfully with initial stock of ${result.batch.current_quantity} units (Batch: ${result.batch.batch_number}).`
          : `Product '${name}' created with 0 available stock.`,
        data: result,
      });
    } catch (err: any) {
      console.error("[Create Product] Error:", err);
      return res.status(500).json({ error: err.message || "Failed to create product." });
    }
  }
);

// Update Product details
productsRouter.put(
  "/:id",
  requireAuthentication,
  requireRole(["OWNER", "ADMIN"]),
  async (req: Request, res: Response) => {
    const db = getDb();
    if (!db) return res.status(503).json({ error: "Database not connected." });

    const {
      name,
      genericName,
      brandName,
      sku,
      barcode,
      categoryId,
      dosageForm,
      strength,
      unit,
      packSize,
      manufacturer,
      description,
      prescriptionRequired,
      imageUrl,
      reorderLevel,
      sellingPrice,
      wholesalePrice,
      isActive,
    } = req.body;

    try {
      const [updated] = await db
        .update(schema.products)
        .set({
          name,
          genericName,
          brandName,
          sku,
          barcode,
          categoryId: categoryId || null,
          dosageForm,
          strength,
          unit,
          packSize: packSize ? parseInt(packSize) : 1,
          manufacturer,
          description,
          prescriptionRequired: !!prescriptionRequired,
          imageUrl,
          reorderLevel: reorderLevel ? parseInt(reorderLevel) : 10,
          sellingPrice: sellingPrice ? parseFloat(sellingPrice).toFixed(2) : "0.00",
          wholesalePrice: wholesalePrice ? parseFloat(wholesalePrice).toFixed(2) : null,
          isActive: isActive !== undefined ? !!isActive : true,
          updatedAt: new Date(),
        })
        .where(eq(schema.products.id, req.params.id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Product not found." });
      }

      // Audit Log
      await db.insert(schema.auditLogs).values({
        userId: req.user?.id,
        action: "PRODUCT_UPDATED",
        entityType: "PRODUCT",
        entityId: updated.id,
        details: { name: updated.name, sku: updated.sku },
        ipAddress: req.ip,
      });

      // Broadcast Realtime Event
      await broadcastRealtimeEvent("PRODUCT_UPDATED", { product: updated });

      return res.json({ success: true, product: updated });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to update product." });
    }
  }
);
