import { Request, Response, NextFunction } from "express";
import { getDb, schema } from "../../db";
import { eq } from "drizzle-orm";
import { getSupabase } from "../../services/supabase";

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: "OWNER" | "ADMIN" | "EMPLOYEE";
  status: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function requireAuthentication(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required. Missing Bearer token." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const supabase = getSupabase();
    if (supabase) {
      const { data: { user: sbUser }, error } = await supabase.auth.getUser(token);
      if (!error && sbUser) {
        const db = getDb();
        if (db) {
          const [found] = await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.email, sbUser.email || ""))
            .limit(1);

          if (found) {
            req.user = {
              id: found.id,
              email: found.email,
              fullName: found.fullName,
              role: found.role as "OWNER" | "ADMIN" | "EMPLOYEE",
              status: found.status,
            };
            return next();
          }
        }
      }
    }

    // Direct token check if token is user UUID or session key (for internal verified requests)
    const db = getDb();
    if (db && token) {
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, token))
        .limit(1);

      if (user && user.status === "ACTIVE") {
        req.user = {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role as "OWNER" | "ADMIN" | "EMPLOYEE",
          status: user.status,
        };
        return next();
      }
    }

    return res.status(401).json({ error: "Invalid or expired authentication token." });
  } catch (err) {
    console.error("[Auth Middleware] Error verifying token:", err);
    return res.status(401).json({ error: "Authentication failed." });
  }
}

export function requireRole(allowedRoles: Array<"OWNER" | "ADMIN" | "EMPLOYEE">) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required." });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: "403 Forbidden: You do not have permission to perform this action.",
      });
    }

    next();
  };
}
