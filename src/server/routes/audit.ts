import { Router, Request, Response } from "express";
import { getRawSql } from "../../db";
import { requireAuthentication, requireRole } from "../middleware/auth";

export const auditRouter = Router();

auditRouter.get("/", requireAuthentication, requireRole(["OWNER"]), async (req: Request, res: Response) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });

  const { action, limit = 100 } = req.query;

  try {
    const query = `
      SELECT 
        a.*,
        u.full_name as user_name,
        u.email as user_email
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1
      ${action ? `AND a.action = '${action}'` : ""}
      ORDER BY a.created_at DESC
      LIMIT ${parseInt(limit as string) || 100}
    `;

    const logs = await rawSql.unsafe(query);
    return res.json({ logs });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch audit logs" });
  }
});
