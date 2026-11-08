import { Router, Request, Response } from "express";
import multer from "multer";
import { eq, isNotNull } from "drizzle-orm";
import { getDb, getRawSql, schema } from "../../db";
import { requireAuthentication, requireRole } from "../middleware/auth";
import { uploadImageToStorage, broadcastRealtimeEvent } from "../../services/supabase";

export const settingsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and WEBP image files are allowed."));
    }
  },
});

// Get Pharmacy Settings
settingsRouter.get("/", async (req: Request, res: Response) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: "Database not connected." });

  try {
    const [settings] = await db.select().from(schema.pharmacySettings).limit(1);
    return res.json({
      settings: settings || {
        name: "Empress Oris Herbal & Mart",
        city: "Accra",
        region: "Greater Accra",
        country: "Ghana",
        currency: "GHS",
        currencySymbol: "GH₵",
        receiptFooter: "Thank you for your patronage! Medicines sold are not returnable once opened.",
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch settings" });
  }
});

// Update Pharmacy Settings (Owner only)
settingsRouter.put("/", requireAuthentication, requireRole(["OWNER"]), async (req: Request, res: Response) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: "Database not connected." });

  const { name, licenseNumber, phone, email, address, city, region, currency, currencySymbol, taxRate, receiptFooter, logoUrl, smsNotificationsEnabled, smsRecipientPhone } = req.body;

  try {
    const existing = await db.select().from(schema.pharmacySettings).limit(1);

    let updated;
    if (existing.length === 0) {
      [updated] = await db
        .insert(schema.pharmacySettings)
        .values({
          name: name || "Empress Oris Herbal & Mart",
          licenseNumber,
          phone,
          email,
          address,
          city: city || "Accra",
          region: region || "Greater Accra",
          country: "Ghana",
          currency: currency || "GHS",
          currencySymbol: currencySymbol || "GH₵",
          taxRate: taxRate ? parseFloat(taxRate).toFixed(2) : "0.00",
          receiptFooter,
          logoUrl,
          smsNotificationsEnabled: smsNotificationsEnabled !== undefined ? !!smsNotificationsEnabled : false,
          smsRecipientPhone: smsRecipientPhone !== undefined ? smsRecipientPhone : null,
        })
        .returning();
    } else {
      [updated] = await db
        .update(schema.pharmacySettings)
        .set({
          name,
          licenseNumber,
          phone,
          email,
          address,
          city,
          region,
          currency: currency || "GHS",
          currencySymbol: currencySymbol || "GH₵",
          taxRate: taxRate !== undefined ? parseFloat(taxRate).toFixed(2) : existing[0].taxRate,
          receiptFooter,
          logoUrl: logoUrl !== undefined ? logoUrl : existing[0].logoUrl,
          smsNotificationsEnabled: smsNotificationsEnabled !== undefined ? !!smsNotificationsEnabled : existing[0].smsNotificationsEnabled,
          smsRecipientPhone: smsRecipientPhone !== undefined ? smsRecipientPhone : existing[0].smsRecipientPhone,
          updatedAt: new Date(),
        })
        .where(eq(schema.pharmacySettings.id, existing[0].id))
        .returning();
    }

    await db.insert(schema.auditLogs).values({
      userId: req.user?.id,
      action: "SETTINGS_UPDATED",
      entityType: "SETTINGS",
      entityId: updated.id,
      details: { name: updated.name },
      ipAddress: req.ip,
    });

    await broadcastRealtimeEvent("SETTINGS_UPDATED", { settings: updated });

    return res.json({ success: true, settings: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to update pharmacy settings" });
  }
});

// SMS delivery history (owner only)
settingsRouter.get(
  "/sms-history",
  requireAuthentication,
  requireRole(["OWNER"]),
  async (req: Request, res: Response) => {
    const rawSql = getRawSql();
    if (!rawSql) return res.status(503).json({ error: "Database not connected." });
    try {
      const rows = await rawSql.unsafe(`SELECT * FROM sms_outbox ORDER BY created_at DESC LIMIT 100`);
      return res.json({ history: rows });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to fetch SMS history" });
    }
  }
);

// Retry failed SMS (owner only)
settingsRouter.post(
  "/sms-retry/:id",
  requireAuthentication,
  requireRole(["OWNER"]),
  async (req: Request, res: Response) => {
    const rawSql = getRawSql();
    if (!rawSql) return res.status(503).json({ error: "Database not connected." });
    const { id } = req.params;
    try {
      const [row] = await rawSql.unsafe(`SELECT * FROM sms_outbox WHERE id = '${id}' LIMIT 1`);
      if (!row) return res.status(404).json({ error: "SMS record not found." });
      if (row.status === "SENT") return res.json({ success: true, message: "Already sent." });

      const { sendSms } = await import("../../services/sasuSync");
      const result = await sendSms(row.recipient, row.message);
      if (result.success) {
        await rawSql.unsafe(`UPDATE sms_outbox SET status = 'SENT', attempts = attempts + 1, sent_at = NOW(), last_error = NULL WHERE id = '${id}'`);
        return res.json({ success: true });
      } else {
        await rawSql.unsafe(`UPDATE sms_outbox SET status = 'FAILED', attempts = attempts + 1, last_error = '${(result.error || "Unknown").replace(/'/g, "''")}' WHERE id = '${id}'`);
        return res.status(502).json({ success: false, error: result.error });
      }
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Retry failed" });
    }
  }
);

// Upload Pharmacy Logo to Supabase Storage
settingsRouter.post(
  "/logo",
  requireAuthentication,
  requireRole(["OWNER"]),
  upload.single("logo"),
  async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ error: "No logo file provided." });

    try {
      const ext = req.file.mimetype.split("/")[1] || "png";
      const fileName = `logo-${Date.now()}.${ext}`;
      const storagePath = `branding/${fileName}`;

      const publicUrl = await uploadImageToStorage(
        "pharmacy-assets",
        storagePath,
        req.file.buffer,
        req.file.mimetype
      );

      if (!publicUrl) {
        return res.status(500).json({ error: "Failed to upload logo to Supabase Storage." });
      }

      const db = getDb();
      if (db) {
        await db
          .update(schema.pharmacySettings)
          .set({ logoUrl: publicUrl, updatedAt: new Date() })
          .where(isNotNull(schema.pharmacySettings.id));
      }

      return res.json({ success: true, logoUrl: publicUrl });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to upload logo" });
    }
  }
);
