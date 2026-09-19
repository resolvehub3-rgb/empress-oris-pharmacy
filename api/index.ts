import "dotenv/config";
import express from "express";
import cors from "cors";
import { authRouter } from "../src/server/routes/auth";
import { productsRouter } from "../src/server/routes/products";
import { stockRouter } from "../src/server/routes/stock";
import { posRouter } from "../src/server/routes/pos";
import { salesRouter } from "../src/server/routes/sales";
import { shiftsRouter } from "../src/server/routes/shifts";
import { suppliersRouter } from "../src/server/routes/suppliers";
import { categoriesRouter } from "../src/server/routes/categories";
import { purchasesRouter } from "../src/server/routes/purchases";
import { expensesRouter } from "../src/server/routes/expenses";
import { employeesRouter } from "../src/server/routes/employees";
import { reportsRouter } from "../src/server/routes/reports";
import { settingsRouter } from "../src/server/routes/settings";
import { notificationsRouter } from "../src/server/routes/notifications";
import { auditRouter } from "../src/server/routes/audit";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

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

export default app;
