import { Router, Request, Response } from "express";
import { getDb, getRawSql, schema } from "../../db";
import { requireAuthentication, requireRole } from "../middleware/auth";
import { getSupabase } from "../../services/supabase";

export const employeesRouter = Router();

// List all employees (Owner only)
employeesRouter.get("/", requireAuthentication, requireRole(["OWNER"]), async (req: Request, res: Response) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });

  try {
    const employees = await rawSql.unsafe(`
      SELECT 
        u.id,
        u.email,
        u.full_name,
        u.phone,
        u.role,
        u.status,
        u.created_at,
        ep.employee_code,
        ep.position,
        ep.hire_date,
        ep.permissions,
        ep.is_active as profile_active
      FROM users u
      LEFT JOIN employee_profiles ep ON u.id = ep.user_id
      ORDER BY u.created_at ASC
    `);

    return res.json({ employees });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch employees" });
  }
});

// Create an employee account (Owner only)
employeesRouter.post("/", requireAuthentication, requireRole(["OWNER"]), async (req: Request, res: Response) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });

  const { email, password, fullName, phone, employeeCode, position } = req.body;
  if (!email || !fullName || !employeeCode) {
    return res.status(400).json({ error: "Email, Full Name, and Employee Code are required." });
  }

  try {
    const supabase = getSupabase();
    if (supabase && password) {
      await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: "EMPLOYEE",
          },
        },
      });
    }

    const result = await rawSql.begin(async (tx) => {
      const [user] = await tx`
        INSERT INTO users (email, full_name, phone, role, status)
        VALUES (${email}, ${fullName}, ${phone || null}, 'EMPLOYEE', 'ACTIVE')
        RETURNING *
      `;

      const [profile] = await tx`
        INSERT INTO employee_profiles (user_id, employee_code, position, hire_date, is_active)
        VALUES (${user.id}, ${employeeCode}, ${position || "Cashier"}, CURRENT_DATE, true)
        RETURNING *
      `;

      await tx`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
        VALUES (
          ${req.user?.id || null}, 'EMPLOYEE_CREATED', 'USER', ${user.id},
          ${JSON.stringify({ email, fullName, employeeCode })}::jsonb
        )
      `;

      return { user, profile };
    });

    return res.status(201).json({ success: true, ...result });
  } catch (err: any) {
    console.error("[Create Employee] Error:", err);
    return res.status(400).json({ error: err.message || "Failed to create employee." });
  }
});

// Toggle employee status (Active / Inactive)
employeesRouter.patch("/:id/status", requireAuthentication, requireRole(["OWNER"]), async (req: Request, res: Response) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });

  const { status } = req.body; // 'ACTIVE' | 'INACTIVE'
  if (!["ACTIVE", "INACTIVE"].includes(status)) {
    return res.status(400).json({ error: "Invalid status. Must be ACTIVE or INACTIVE." });
  }

  try {
    const [updated] = await rawSql.unsafe(`
      UPDATE users SET status = '${status}', updated_at = NOW() WHERE id = '${req.params.id}' RETURNING *
    `);

    if (!updated) return res.status(404).json({ error: "Employee not found." });

    await rawSql.unsafe(`
      UPDATE employee_profiles SET is_active = ${status === "ACTIVE"} WHERE user_id = '${req.params.id}'
    `);

    await rawSql.unsafe(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (
        '${req.user?.id}', 'EMPLOYEE_STATUS_CHANGED', 'USER', '${req.params.id}',
        '${JSON.stringify({ newStatus: status })}'::jsonb
      )
    `);

    return res.json({ success: true, employee: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to update employee status" });
  }
});
