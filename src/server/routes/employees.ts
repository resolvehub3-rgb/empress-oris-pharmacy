import { Router, Request, Response } from "express";
import { getDb, getRawSql, schema } from "../../db";
import { requireAuthentication, requireRole } from "../middleware/auth";
import { getSupabase, broadcastRealtimeEvent } from "../../services/supabase";

export const employeesRouter = Router();

// List all employees (Owner only)
employeesRouter.get("/", requireAuthentication, requireRole(["OWNER", "ADMIN"]), async (req: Request, res: Response) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });

  try {
    const employees = await rawSql.unsafe(`
      SELECT 
        u.id,
        u.email,
        u.full_name AS "fullName",
        u.phone,
        u.role,
        u.status,
        u.created_at AS "createdAt",
        ep.employee_code AS "employeeCode",
        ep.position,
        ep.hire_date AS "hireDate",
        ep.permissions,
        ep.is_active AS "profileActive"
      FROM users u
      LEFT JOIN employee_profiles ep ON u.id = ep.user_id
      WHERE u.status = 'ACTIVE'
      ORDER BY u.created_at ASC
    `);

    return res.json({ employees });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch employees" });
  }
});

// Create an employee account (Owner only)
employeesRouter.post("/", requireAuthentication, requireRole(["OWNER", "ADMIN"]), async (req: Request, res: Response) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });

  const { email, password, fullName, phone, employeeCode, position } = req.body;
  if (!email || !fullName || !employeeCode) {
    return res.status(400).json({ error: "Email, Full Name, and Employee Code are required." });
  }

  try {
    const [existing] = await rawSql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
    if (existing) {
      return res.status(400).json({ error: "An employee with this email already exists." });
    }

    let supabaseUserId: string | null = null;
    const supabase = getSupabase();
    if (supabase && password) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: "EMPLOYEE",
          },
        },
      });
      if (error) {
        return res.status(400).json({ error: error.message || "Failed to create auth account." });
      }
      supabaseUserId = data.user?.id || null;
    }

    const result = await rawSql.begin(async (tx) => {
      let user;
      if (supabaseUserId) {
        const [existingUser] = await tx`SELECT id FROM users WHERE id = ${supabaseUserId} LIMIT 1`;
        if (existingUser) {
          await tx`UPDATE users SET full_name = ${fullName}, phone = ${phone || null}, status = 'ACTIVE', updated_at = NOW() WHERE id = ${supabaseUserId}`;
          [user] = await tx`SELECT * FROM users WHERE id = ${supabaseUserId}`;
        } else {
          [user] = await tx`
            INSERT INTO users (id, email, full_name, phone, role, status)
            VALUES (${supabaseUserId}, ${email}, ${fullName}, ${phone || null}, 'EMPLOYEE', 'ACTIVE')
            RETURNING *
          `;
        }
      } else {
        [user] = await tx`
          INSERT INTO users (email, full_name, phone, role, status)
          VALUES (${email}, ${fullName}, ${phone || null}, 'EMPLOYEE', 'ACTIVE')
          RETURNING *
        `;
      }

      const [profile] = await tx`
        INSERT INTO employee_profiles (user_id, employee_code, position, hire_date, is_active)
        VALUES (${user.id}, ${employeeCode}, ${position || "Cashier"}, CURRENT_DATE, true)
        ON CONFLICT (user_id) DO UPDATE SET employee_code = ${employeeCode}, position = ${position || "Cashier"}, is_active = true
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
employeesRouter.patch("/:id/status", requireAuthentication, requireRole(["OWNER", "ADMIN"]), async (req: Request, res: Response) => {
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

// Delete an employee (Owner only) - soft-deletes by setting status to INACTIVE
employeesRouter.delete("/:id", requireAuthentication, requireRole(["OWNER", "ADMIN"]), async (req: Request, res: Response) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });

  const { id } = req.params;

  try {
    if (req.user?.id === id) {
      return res.status(400).json({ error: "You cannot delete your own account." });
    }

    const result = await rawSql.begin(async (tx) => {
      const [targetUser] = await tx`SELECT id, email, full_name, role FROM users WHERE id = ${id}`;
      if (!targetUser) throw new Error("Employee not found.");

      await tx`UPDATE cashier_shifts SET status = 'CLOSED', end_time = NOW() WHERE cashier_id = ${id} AND status = 'OPEN'`;
      await tx`UPDATE users SET status = 'INACTIVE', updated_at = NOW() WHERE id = ${id}`;
      await tx`UPDATE employee_profiles SET is_active = false WHERE user_id = ${id}`;

      await tx`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
        VALUES (
          ${req.user?.id || null}, 'EMPLOYEE_DELETED', 'USER', ${id},
          ${JSON.stringify({ email: targetUser.email, fullName: targetUser.full_name })}::jsonb
        )
      `;

      return targetUser;
    });

    await broadcastRealtimeEvent("EMPLOYEE_DELETED", { employeeId: id, deletedBy: req.user?.id });

    return res.json({ success: true, employee: result });
  } catch (err: any) {
    console.error("[Delete Employee] Error:", err);
    return res.status(400).json({ error: err.message || "Failed to delete employee." });
  }
});
