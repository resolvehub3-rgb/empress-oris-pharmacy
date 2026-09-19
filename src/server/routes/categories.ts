import { Router, Request, Response } from "express";
import { getDb, schema } from "../../db";
import { asc } from "drizzle-orm";
import { requireAuthentication, requireRole } from "../middleware/auth";

export const categoriesRouter = Router();

categoriesRouter.get("/", requireAuthentication, async (req: Request, res: Response) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: "Database not connected." });

  try {
    const list = await db.select().from(schema.categories).orderBy(asc(schema.categories.name));
    return res.json({ categories: list });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch categories" });
  }
});

categoriesRouter.post("/", requireAuthentication, requireRole(["OWNER"]), async (req: Request, res: Response) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: "Database not connected." });

  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: "Category name is required." });

  try {
    const [category] = await db
      .insert(schema.categories)
      .values({ name: name.trim(), description: description || null })
      .returning();

    return res.status(201).json({ success: true, category });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || "Failed to create category (name must be unique)." });
  }
});
