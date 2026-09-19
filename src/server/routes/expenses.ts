import { Router, Request, Response } from "express";
import { getDb, getRawSql, schema } from "../../db";
import { requireAuthentication, requireRole } from "../middleware/auth";

export const expensesRouter = Router();

expensesRouter.get("/", requireAuthentication, requireRole(["OWNER"]), async (req: Request, res: Response) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });

  try {
    const expenses = await rawSql.unsafe(`
      SELECT 
        e.*,
        ec.name as category_name,
        u.full_name as recorded_by_name
      FROM expenses e
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      LEFT JOIN users u ON e.recorded_by = u.id
      ORDER BY e.expense_date DESC, e.created_at DESC
      LIMIT 100
    `);

    const categories = await rawSql.unsafe(`
      SELECT * FROM expense_categories ORDER BY name ASC
    `);

    return res.json({ expenses, categories });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch expenses" });
  }
});

expensesRouter.post("/", requireAuthentication, requireRole(["OWNER"]), async (req: Request, res: Response) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: "Database not connected." });

  const { title, amount, categoryId, expenseDate, receiptReference, paidTo, paymentMethod, notes } = req.body;
  if (!title || !amount) {
    return res.status(400).json({ error: "Title and amount are required." });
  }

  try {
    const [expense] = await db
      .insert(schema.expenses)
      .values({
        title,
        amount: parseFloat(amount).toFixed(2),
        categoryId: categoryId || null,
        expenseDate: expenseDate || new Date().toISOString().split("T")[0],
        receiptReference: receiptReference || null,
        paidTo: paidTo || null,
        paymentMethod: paymentMethod || "CASH",
        recordedBy: req.user?.id || null,
        notes: notes || null,
      })
      .returning();

    // Audit log
    await db.insert(schema.auditLogs).values({
      userId: req.user?.id,
      action: "EXPENSE_CREATED",
      entityType: "EXPENSE",
      entityId: expense.id,
      details: { title, amount },
      ipAddress: req.ip,
    });

    return res.status(201).json({ success: true, expense });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to record expense" });
  }
});

expensesRouter.post("/categories", requireAuthentication, requireRole(["OWNER"]), async (req: Request, res: Response) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: "Database not connected." });

  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: "Category name is required." });

  try {
    const [cat] = await db
      .insert(schema.expenseCategories)
      .values({ name, description: description || null })
      .returning();
    return res.status(201).json({ success: true, category: cat });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || "Failed to create expense category" });
  }
});
