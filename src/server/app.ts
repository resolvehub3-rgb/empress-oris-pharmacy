import express from "express";
import cors from "cors";
import multer from "multer";
import { authRouter } from "./routes/auth";
import { productsRouter } from "./routes/products";
import { stockRouter } from "./routes/stock";
import { posRouter } from "./routes/pos";
import { salesRouter } from "./routes/sales";
import { shiftsRouter } from "./routes/shifts";
import { suppliersRouter } from "./routes/suppliers";
import { categoriesRouter } from "./routes/categories";
import { purchasesRouter } from "./routes/purchases";
import { expensesRouter } from "./routes/expenses";
import { employeesRouter } from "./routes/employees";
import { reportsRouter } from "./routes/reports";
import { settingsRouter } from "./routes/settings";
import { notificationsRouter } from "./routes/notifications";
import { auditRouter } from "./routes/audit";
import { getDb } from "../db";

export function createExpressApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Health Check
  app.get("/api/health", async (req, res) => {
    const db = getDb();
    res.json({
      status: "ok",
      database: db ? "connected" : "not_configured",
      supabase: process.env.SUPABASE_URL ? "configured" : "not_configured",
      time: new Date().toISOString(),
      country: "Ghana",
      currency: "GHS (GH₵)",
      timezone: "Africa/Accra",
    });
  });

  // Mount API modules
  app.use("/api/auth", authRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/stock", stockRouter);
  app.use("/api/pos", posRouter);
  app.use("/api/sales", salesRouter);
  app.use("/api/shifts", shiftsRouter);
  app.use("/api/suppliers", suppliersRouter);
  app.use("/api/categories", categoriesRouter);
  app.use("/api/purchases", purchasesRouter);
  app.use("/api/expenses", expensesRouter);
  app.use("/api/employees", employeesRouter);
  app.use("/api/reports", reportsRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/audit", auditRouter);

  // Global error handler for multer and other errors
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "File is too large. Maximum size is 5MB." });
      }
      return res.status(400).json({ error: err.message || "File upload error." });
    }
    if (err.message && err.message.includes("Only JPEG")) {
      return res.status(400).json({ error: err.message });
    }
    console.error("[App] Unhandled error:", err);
    return res.status(500).json({ error: "Internal server error." });
  });

  return app;
}
