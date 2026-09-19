import { Router, Request, Response } from "express";
import { getDb, schema } from "../../db";
import { eq } from "drizzle-orm";
import { getSupabase } from "../../services/supabase";
import { requireAuthentication } from "../middleware/auth";
import { runSchemaInit } from "../../db/init";

export const authRouter = Router();

// Check system setup status
authRouter.get("/status", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    if (!db) {
      return res.json({
        configured: false,
        message: "Database connection not established. Please provide DATABASE_URL and Supabase credentials.",
        hasOwner: false,
      });
    }

    // Try counting users to see if schema exists and if owner exists
    try {
      const existingUsers = await db.select().from(schema.users);
      const hasOwner = existingUsers.some((u) => u.role === "OWNER");
      const [settings] = await db.select().from(schema.pharmacySettings).limit(1);

      return res.json({
        configured: true,
        hasOwner,
        userCount: existingUsers.length,
        pharmacyName: settings?.name || null,
        currency: settings?.currency || "GHS",
        currencySymbol: settings?.currencySymbol || "GH₵",
      });
    } catch (dbErr: any) {
      // Schema may need initialization
      console.log("[Auth Status] Table check error, attempting runSchemaInit:", dbErr?.message);
      const inited = await runSchemaInit();
      return res.json({
        configured: true,
        schemaInitialized: inited,
        hasOwner: false,
        userCount: 0,
      });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to check setup status" });
  }
});

// Configure or update Supabase / Database credentials dynamically
authRouter.post("/configure", async (req: Request, res: Response) => {
  const { databaseUrl, supabaseUrl, supabaseAnonKey, supabaseServiceKey } = req.body;

  if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
  if (supabaseUrl) process.env.SUPABASE_URL = supabaseUrl;
  if (supabaseAnonKey) process.env.SUPABASE_ANON_KEY = supabaseAnonKey;
  if (supabaseServiceKey) process.env.SUPABASE_SERVICE_ROLE_KEY = supabaseServiceKey;

  try {
    const inited = await runSchemaInit();
    return res.json({
      success: true,
      message: "Database credentials configured and schema initialized successfully.",
      initialized: inited,
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: err.message || "Failed to connect to Supabase PostgreSQL with provided credentials.",
    });
  }
});

// First-time Owner Setup / Registration
authRouter.post("/setup-owner", async (req: Request, res: Response) => {
  const { email, password, fullName, phone, pharmacyName, pharmacyPhone, pharmacyAddress } = req.body;

  if (!email || !fullName) {
    return res.status(400).json({ error: "Email and Full Name are required." });
  }

  const db = getDb();
  if (!db) {
    return res.status(503).json({ error: "Database not connected. Please check configuration." });
  }

  try {
    // Check if an owner already exists
    const existingUsers = await db.select().from(schema.users);
    const existingOwner = existingUsers.find((u) => u.role === "OWNER");
    if (existingOwner) {
      return res.status(400).json({ error: "An owner account already exists. Please log in." });
    }

    let authUserId: string | null = null;
    const supabase = getSupabase();

    if (supabase && password) {
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: "OWNER",
          },
        },
      });
      if (signUpErr && !signUpErr.message.includes("already registered")) {
        console.warn("[Supabase Auth] Sign-up note:", signUpErr.message);
      }
      authUserId = signUpData?.user?.id || null;
    }

    // Insert owner into database
    const [newOwner] = await db
      .insert(schema.users)
      .values({
        email,
        fullName,
        phone: phone || null,
        role: "OWNER",
        status: "ACTIVE",
      })
      .returning();

    // Check / update or insert pharmacy settings
    const existingSettings = await db.select().from(schema.pharmacySettings).limit(1);
    if (existingSettings.length === 0) {
      await db.insert(schema.pharmacySettings).values({
        name: pharmacyName || "Empress Oris Herbal & Mart",
        phone: pharmacyPhone || phone || null,
        email: email,
        address: pharmacyAddress || "Accra, Ghana",
        city: "Accra",
        region: "Greater Accra",
        country: "Ghana",
        currency: "GHS",
        currencySymbol: "GH₵",
      });
    } else if (pharmacyName) {
      await db.update(schema.pharmacySettings).set({
        name: pharmacyName,
        phone: pharmacyPhone || phone,
        address: pharmacyAddress,
      });
    }

    // Log Audit
    await db.insert(schema.auditLogs).values({
      userId: newOwner.id,
      action: "OWNER_REGISTERED",
      entityType: "USER",
      entityId: newOwner.id,
      details: { email, fullName },
      ipAddress: req.ip,
    });

    return res.status(201).json({
      success: true,
      message: "Owner account created successfully.",
      user: newOwner,
      token: newOwner.id,
    });
  } catch (err: any) {
    console.error("[Setup Owner] Error:", err);
    return res.status(500).json({ error: err.message || "Failed to create owner account." });
  }
});

// Login
authRouter.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required." });
  }

  const db = getDb();
  if (!db) {
    return res.status(503).json({ error: "Database not connected." });
  }

  try {
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials. User not found." });
    }

    if (user.status !== "ACTIVE") {
      return res.status(403).json({ error: "Account is disabled. Please contact the administrator." });
    }

    // Authenticate with Supabase Auth if password provided and supabase available
    const supabase = getSupabase();
    let authToken = user.id;

    if (supabase && password) {
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInErr) {
        // Log but don't block — fall back to local DB auth
        console.warn("[Login] Supabase auth note:", signInErr.message);
      }
      if (signInData?.session?.access_token) {
        authToken = signInData.session.access_token;
      }
    }

    // Record audit log
    await db.insert(schema.auditLogs).values({
      userId: user.id,
      action: "LOGIN",
      entityType: "USER",
      entityId: user.id,
      details: { email: user.email, role: user.role },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      user,
      token: authToken,
    });
  } catch (err: any) {
    console.error("[Login] Error:", err);
    return res.status(500).json({ error: err.message || "Login failed." });
  }
});

// Current user profile
authRouter.get("/me", requireAuthentication, async (req: Request, res: Response) => {
  const db = getDb();
  if (!db || !req.user) {
    return res.status(404).json({ error: "User not found." });
  }

  try {
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, req.user.id))
      .limit(1);

    const [settings] = await db.select().from(schema.pharmacySettings).limit(1);

    return res.json({
      user,
      settings: settings || {
        name: "Empress Oris Herbal & Mart",
        currency: "GHS",
        currencySymbol: "GH₵",
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch user profile" });
  }
});

// Logout
authRouter.post("/logout", requireAuthentication, async (req: Request, res: Response) => {
  const db = getDb();
  if (db && req.user) {
    await db.insert(schema.auditLogs).values({
      userId: req.user.id,
      action: "LOGOUT",
      entityType: "USER",
      entityId: req.user.id,
      ipAddress: req.ip,
    });
  }
  return res.json({ success: true, message: "Logged out successfully." });
});
