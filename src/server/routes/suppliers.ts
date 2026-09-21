import { Router, Request, Response } from "express";
import { getDb, schema } from "../../db";
import { eq, desc } from "drizzle-orm";
import { requireAuthentication, requireRole } from "../middleware/auth";
import { broadcastRealtimeEvent } from "../../services/supabase";

export const suppliersRouter = Router();

suppliersRouter.get("/", requireAuthentication, async (req: Request, res: Response) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: "Database not connected." });

  try {
    const list = await db.select().from(schema.suppliers).orderBy(desc(schema.suppliers.createdAt));
    return res.json({ suppliers: list });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch suppliers" });
  }
});

suppliersRouter.post("/", requireAuthentication, requireRole(["OWNER", "ADMIN"]), async (req: Request, res: Response) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: "Database not connected." });

  const { name, contactPerson, phone, email, address, city, region, paymentTerms, notes } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: "Supplier name and phone are required." });
  }

  try {
    const [supplier] = await db
      .insert(schema.suppliers)
      .values({
        name,
        contactPerson: contactPerson || null,
        phone,
        email: email || null,
        address: address || null,
        city: city || "Accra",
        region: region || "Greater Accra",
        paymentTerms: paymentTerms || "Net 30",
        notes: notes || null,
        status: "ACTIVE",
      })
      .returning();

    // Audit log
    await db.insert(schema.auditLogs).values({
      userId: req.user?.id,
      action: "SUPPLIER_CREATED",
      entityType: "SUPPLIER",
      entityId: supplier.id,
      details: { name: supplier.name },
      ipAddress: req.ip,
    });

    await broadcastRealtimeEvent("SUPPLIER_CREATED", { supplierId: supplier.id, createdBy: req.user?.id });

    return res.status(201).json({ success: true, supplier });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to create supplier" });
  }
});

// Delete a supplier (Owner / Admin only)
suppliersRouter.delete("/:id", requireAuthentication, requireRole(["OWNER", "ADMIN"]), async (req: Request, res: Response) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: "Database not connected." });

  const { id } = req.params;

  try {
    const [existing] = await db.select().from(schema.suppliers).where(eq(schema.suppliers.id, id)).limit(1);
    if (!existing) {
      return res.status(404).json({ error: "Supplier not found." });
    }

    const purchases = await db.select({ id: schema.purchases.id }).from(schema.purchases).where(eq(schema.purchases.supplierId, id)).limit(1);
    if (purchases.length > 0) {
      return res.status(400).json({ error: "Cannot delete supplier with existing purchase orders. Remove related purchases first." });
    }

    await db.delete(schema.suppliers).where(eq(schema.suppliers.id, id));

    await db.insert(schema.auditLogs).values({
      userId: req.user?.id,
      action: "SUPPLIER_DELETED",
      entityType: "SUPPLIER",
      entityId: id,
      details: { name: existing.name },
      ipAddress: req.ip,
    });

    await broadcastRealtimeEvent("SUPPLIER_DELETED", { supplierId: id, deletedBy: req.user?.id });

    return res.json({ success: true, supplier: existing });
  } catch (err: any) {
    console.error("[Delete Supplier] Error:", err);
    return res.status(500).json({ error: err.message || "Failed to delete supplier" });
  }
});
