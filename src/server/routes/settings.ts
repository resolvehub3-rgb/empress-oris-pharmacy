import { Router, Request, Response } from "express";
import multer from "multer";
import { eq, isNotNull } from "drizzle-orm";
import { getDb, schema } from "../../db";
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

  const { name, licenseNumber, phone, email, address, city, region, currency, currencySymbol, taxRate, receiptFooter, logoUrl } = req.body;

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
