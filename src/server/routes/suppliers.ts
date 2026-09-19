import { Router, Request, Response } from "express";
import { getDb, schema } from "../../db";
import { eq, desc } from "drizzle-orm";
import { requireAuthentication, requireRole } from "../middleware/auth";

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

suppliersRouter.post("/", requireAuthentication, requireRole(["OWNER"]), async (req: Request, res: Response) => {
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

    return res.status(201).json({ success: true, supplier });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to create supplier" });
  }
});
