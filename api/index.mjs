var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/services/sasuSync.ts
var sasuSync_exports = {};
__export(sasuSync_exports, {
  getSasuSyncEndpoint: () => getSasuSyncEndpoint,
  isSasuSyncConfigured: () => isSasuSyncConfigured,
  normalizeGhanaPhone: () => normalizeGhanaPhone,
  sendSms: () => sendSms,
  validateGhanaPhone: () => validateGhanaPhone
});
function getBaseUrl() {
  return (process.env.SASUSYNC_BASE_URL || "https://sms.sasusync.com").replace(/\/+$/, "");
}
function getMode() {
  return process.env.SASUSYNC_MODE === "live" ? "live" : "sandbox";
}
function getSasuSyncEndpoint() {
  const base = getBaseUrl();
  return getMode() === "live" ? `${base}/api/v1/send` : `${base}/smssandbox/v1/send`;
}
function isSasuSyncConfigured() {
  return !!process.env.SASUSYNC_API_KEY && !!process.env.SASUSYNC_SENDER_ID;
}
function normalizeGhanaPhone(input) {
  const raw = String(input || "").trim().replace(/\s+/g, "").replace(/^\+/, "");
  if (!raw) return "";
  if (raw.startsWith("233") && raw.length >= 12) return raw;
  if (raw.startsWith("0") && raw.length === 10) return `233${raw.slice(1)}`;
  if (raw.length === 9) return `233${raw}`;
  return raw;
}
function validateGhanaPhone(input) {
  const normalized = normalizeGhanaPhone(input);
  return /^233\d{9}$/.test(normalized);
}
async function sendSms(to, message, idempotencyKey) {
  const apiKey = process.env.SASUSYNC_API_KEY;
  const senderId = process.env.SASUSYNC_SENDER_ID || process.env.SASUSYNC_SENDER;
  if (!apiKey || !senderId) {
    return {
      success: false,
      error: "SasuSync is not configured (missing SASUSYNC_API_KEY or SASUSYNC_SENDER_ID)."
    };
  }
  const recipient = normalizeGhanaPhone(to);
  if (!validateGhanaPhone(recipient)) {
    return { success: false, error: "Invalid recipient phone number." };
  }
  const url = getSasuSyncEndpoint();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15e3);
  try {
    const headers = {
      "Content-Type": "application/json",
      "X-API-Key": apiKey
    };
    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        sender: senderId,
        recipients: [recipient],
        message
      }),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        success: false,
        error: data?.message || data?.error || `HTTP ${response.status}`
      };
    }
    const taskId = data?.task_id || data?.taskId || data?.id;
    const queued = data?.status === "queued" || data?.queued === true;
    return {
      success: true,
      taskId,
      providerMessageId: taskId,
      queued
    };
  } catch (err) {
    return {
      success: false,
      error: err?.name === "AbortError" ? "SMS request timed out." : err?.message || "Network error contacting SasuSync."
    };
  } finally {
    clearTimeout(timeout);
  }
}
var init_sasuSync = __esm({
  "src/services/sasuSync.ts"() {
  }
});

// src/server/app.ts
import express from "express";
import cors from "cors";
import multer4 from "multer";

// src/server/compress.ts
import zlib from "node:zlib";
var COMPRESSIBLE = /^(text\/|application\/(?:json|javascript|xml|manifest\+json|rss\+xml|atom\+xml|x-javascript)|image\/svg\+xml)/i;
function hasPayload(chunk2) {
  if (chunk2 === void 0 || chunk2 === null) return false;
  if (typeof chunk2 === "string") return chunk2.length > 0;
  if (Buffer.isBuffer(chunk2)) return chunk2.length > 0;
  if (chunk2 instanceof Uint8Array) return chunk2.length > 0;
  return true;
}
function gzipCompression() {
  return function compressionMiddleware(req, res, next) {
    const acceptEncoding = String(req.headers["accept-encoding"] || "");
    if (!/\bgzip\b/i.test(acceptEncoding)) {
      return next();
    }
    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);
    let stream = null;
    let decided = false;
    let wroteBody = false;
    let ended = false;
    let originalContentLength;
    const decide = () => {
      if (decided) return;
      decided = true;
      if (res.headersSent) return;
      const type = String(res.getHeader("Content-Type") || "");
      const alreadyEncoded = res.getHeader("Content-Encoding");
      if (alreadyEncoded || !COMPRESSIBLE.test(type)) return;
      const contentLength = res.getHeader("Content-Length");
      originalContentLength = typeof contentLength === "string" || typeof contentLength === "number" ? contentLength : void 0;
      res.setHeader("Content-Encoding", "gzip");
      const vary = res.getHeader("Vary");
      res.setHeader("Vary", vary ? `${vary}, Accept-Encoding` : "Accept-Encoding");
      res.removeHeader("Content-Length");
      const gz = zlib.createGzip({ level: zlib.constants.Z_DEFAULT_COMPRESSION });
      gz.on("data", (chunk2) => {
        originalWrite(chunk2);
      });
      gz.on("error", (err) => {
        console.error("[Compression] gzip stream error:", err?.message || err);
        try {
          originalEnd();
        } catch {
        }
      });
      stream = gz;
    };
    const bypassCompression = () => {
      if (stream) {
        stream.destroy();
        stream = null;
      }
      if (!res.headersSent) {
        res.removeHeader("Content-Encoding");
        if (originalContentLength !== void 0) {
          res.setHeader("Content-Length", originalContentLength);
        }
      }
    };
    res.write = function(chunk2, encoding, cb) {
      if (ended) return false;
      decide();
      if (!stream) return originalWrite(chunk2, encoding, cb);
      if (hasPayload(chunk2)) {
        wroteBody = true;
        stream.write(chunk2, encoding, cb);
      } else if (typeof cb === "function") {
        cb();
      }
      return true;
    };
    res.end = function(chunk2, encoding, cb) {
      if (typeof chunk2 === "function") {
        cb = chunk2;
        chunk2 = void 0;
        encoding = void 0;
      } else if (typeof encoding === "function") {
        cb = encoding;
        encoding = void 0;
      }
      if (ended) {
        if (typeof cb === "function") cb();
        return res;
      }
      ended = true;
      decide();
      const finish = () => {
        originalEnd();
        if (typeof cb === "function") cb();
      };
      const payload = hasPayload(chunk2);
      if (!stream || !wroteBody && !payload) {
        if (!wroteBody) bypassCompression();
        if (payload) originalWrite(chunk2, encoding);
        finish();
        return res;
      }
      stream.once("end", finish);
      if (payload) {
        const buf = Buffer.isBuffer(chunk2) ? chunk2 : Buffer.from(
          String(chunk2),
          typeof encoding === "string" ? encoding : "utf8"
        );
        if (buf.length > 0) {
          wroteBody = true;
          stream.write(buf);
        }
      }
      stream.end();
      return res;
    };
    next();
  };
}

// src/server/routes/auth.ts
import { Router } from "express";

// src/db/index.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  auditLogs: () => auditLogs,
  batches: () => batches,
  batchesRelations: () => batchesRelations,
  cashierShifts: () => cashierShifts,
  categories: () => categories,
  employeeProfiles: () => employeeProfiles,
  expenseCategories: () => expenseCategories,
  expenses: () => expenses,
  notifications: () => notifications,
  payments: () => payments,
  pharmacySettings: () => pharmacySettings,
  productImages: () => productImages,
  productImports: () => productImports,
  productImportsRelations: () => productImportsRelations,
  products: () => products,
  productsRelations: () => productsRelations,
  purchaseItems: () => purchaseItems,
  purchases: () => purchases,
  refundItems: () => refundItems,
  refunds: () => refunds,
  saleBatches: () => saleBatches,
  saleItems: () => saleItems,
  saleItemsRelations: () => saleItemsRelations,
  sales: () => sales,
  salesRelations: () => salesRelations,
  smsOutbox: () => smsOutbox,
  stockMovements: () => stockMovements,
  suppliers: () => suppliers,
  users: () => users
});
import {
  pgTable,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  date,
  uuid,
  jsonb
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
var users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  role: text("role").notNull().default("EMPLOYEE"),
  // 'OWNER' | 'EMPLOYEE'
  status: text("status").notNull().default("ACTIVE"),
  // 'ACTIVE' | 'INACTIVE'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var employeeProfiles = pgTable("employee_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull().unique(),
  employeeCode: text("employee_code").notNull().unique(),
  position: text("position").default("Cashier"),
  hireDate: date("hire_date"),
  permissions: jsonb("permissions").default(["pos", "view_inventory"]),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var pharmacySettings = pgTable("pharmacy_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().default("Empress Oris Herbal & Mart"),
  licenseNumber: text("license_number"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  city: text("city").default("Accra"),
  region: text("region").default("Greater Accra"),
  country: text("country").default("Ghana"),
  currency: text("currency").default("GHS"),
  currencySymbol: text("currency_symbol").default("GH\u20B5"),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).default("0.00"),
  logoUrl: text("logo_url"),
  receiptFooter: text("receipt_footer").default("Thank you for your patronage! Medicines sold are not returnable once opened."),
  smsNotificationsEnabled: boolean("sms_notifications_enabled").default(false).notNull(),
  smsRecipientPhone: text("sms_recipient_phone"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var suppliers = pgTable("suppliers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  phone: text("phone").notNull(),
  email: text("email"),
  address: text("address"),
  city: text("city"),
  region: text("region"),
  paymentTerms: text("payment_terms"),
  notes: text("notes"),
  status: text("status").default("ACTIVE"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  genericName: text("generic_name"),
  brandName: text("brand_name"),
  sku: text("sku").notNull().unique(),
  barcode: text("barcode").unique(),
  categoryId: uuid("category_id").references(() => categories.id),
  dosageForm: text("dosage_form"),
  // Tablet, Syrup, Injection, Capsule, etc.
  strength: text("strength"),
  // e.g. 500mg, 10ml
  unit: text("unit").default("Pack"),
  // Pack, Box, Bottle, Blister, Sachet
  packSize: integer("pack_size").default(1),
  manufacturer: text("manufacturer"),
  description: text("description"),
  prescriptionRequired: boolean("prescription_required").default(false).notNull(),
  imageUrl: text("image_url"),
  reorderLevel: integer("reorder_level").default(10).notNull(),
  sellingPrice: numeric("selling_price", { precision: 12, scale: 2 }).notNull().default("0.00"),
  wholesalePrice: numeric("wholesale_price", { precision: 12, scale: 2 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var productImages = pgTable("product_images", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  storagePath: text("storage_path").notNull(),
  url: text("url").notNull(),
  isPrimary: boolean("is_primary").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var batches = pgTable("batches", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  batchNumber: text("batch_number").notNull(),
  supplierId: uuid("supplier_id").references(() => suppliers.id),
  initialQuantity: integer("initial_quantity").notNull(),
  currentQuantity: integer("current_quantity").notNull(),
  costPrice: numeric("cost_price", { precision: 12, scale: 2 }).notNull().default("0.00"),
  sellingPrice: numeric("selling_price", { precision: 12, scale: 2 }).notNull().default("0.00"),
  manufacturingDate: date("manufacturing_date"),
  expiryDate: date("expiry_date").notNull(),
  status: text("status").notNull().default("ACTIVE"),
  // 'ACTIVE' | 'EXPIRED' | 'DEPLETED' | 'QUARANTINED'
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var stockMovements = pgTable("stock_movements", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  batchId: uuid("batch_id").references(() => batches.id).notNull(),
  movementType: text("movement_type").notNull(),
  // 'INITIAL_STOCK' | 'PURCHASE' | 'SALE' | 'REFUND' | 'ADJUSTMENT' | 'DAMAGE' | 'EXPIRY' | 'RETURN' | 'SUPPLIER_RETURN' | 'VOID'
  quantityChange: integer("quantity_change").notNull(),
  previousQuantity: integer("previous_quantity").notNull(),
  newQuantity: integer("new_quantity").notNull(),
  referenceId: text("reference_id"),
  reason: text("reason"),
  userId: uuid("user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var purchases = pgTable("purchases", {
  id: uuid("id").defaultRandom().primaryKey(),
  supplierId: uuid("supplier_id").references(() => suppliers.id).notNull(),
  invoiceNumber: text("invoice_number"),
  purchaseDate: timestamp("purchase_date").defaultNow().notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0.00"),
  status: text("status").default("RECEIVED").notNull(),
  notes: text("notes"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var purchaseItems = pgTable("purchase_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  purchaseId: uuid("purchase_id").references(() => purchases.id).notNull(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  batchId: uuid("batch_id").references(() => batches.id),
  quantity: integer("quantity").notNull(),
  costPrice: numeric("cost_price", { precision: 12, scale: 2 }).notNull(),
  sellingPrice: numeric("selling_price", { precision: 12, scale: 2 }).notNull(),
  totalCost: numeric("total_cost", { precision: 12, scale: 2 }).notNull(),
  expiryDate: date("expiry_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var cashierShifts = pgTable("cashier_shifts", {
  id: uuid("id").defaultRandom().primaryKey(),
  cashierId: uuid("cashier_id").references(() => users.id).notNull(),
  startTime: timestamp("start_time").defaultNow().notNull(),
  endTime: timestamp("end_time"),
  openingCash: numeric("opening_cash", { precision: 12, scale: 2 }).notNull().default("0.00"),
  expectedCash: numeric("expected_cash", { precision: 12, scale: 2 }).default("0.00"),
  actualCash: numeric("actual_cash", { precision: 12, scale: 2 }),
  discrepancy: numeric("discrepancy", { precision: 12, scale: 2 }).default("0.00"),
  status: text("status").default("OPEN").notNull(),
  // 'OPEN' | 'CLOSED'
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var sales = pgTable("sales", {
  id: uuid("id").defaultRandom().primaryKey(),
  receiptNumber: text("receipt_number").notNull().unique(),
  cashierId: uuid("cashier_id").references(() => users.id).notNull(),
  shiftId: uuid("shift_id").references(() => cashierShifts.id),
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 12, scale: 2 }).default("0.00").notNull(),
  tax: numeric("tax", { precision: 12, scale: 2 }).default("0.00").notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  totalCost: numeric("total_cost", { precision: 12, scale: 2 }).notNull().default("0.00"),
  // for exact gross profit
  status: text("status").default("COMPLETED").notNull(),
  // 'COMPLETED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'VOID'
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var saleItems = pgTable("sale_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  saleId: uuid("sale_id").references(() => sales.id).notNull(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 12, scale: 2 }).default("0.00").notNull(),
  totalPrice: numeric("total_price", { precision: 12, scale: 2 }).notNull(),
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull().default("0.00"),
  totalCost: numeric("total_cost", { precision: 12, scale: 2 }).notNull().default("0.00"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var saleBatches = pgTable("sale_batches", {
  id: uuid("id").defaultRandom().primaryKey(),
  saleItemId: uuid("sale_item_id").references(() => saleItems.id).notNull(),
  batchId: uuid("batch_id").references(() => batches.id).notNull(),
  quantity: integer("quantity").notNull(),
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  saleId: uuid("sale_id").references(() => sales.id).notNull(),
  paymentMethod: text("payment_method").notNull(),
  // 'CASH' | 'MTN_MOMO' | 'TELECEL_CASH' | 'AIRTELTIGO_MONEY' | 'CARD' | 'BANK_TRANSFER' | 'OTHER'
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  amountReceived: numeric("amount_received", { precision: 12, scale: 2 }),
  changeGiven: numeric("change_given", { precision: 12, scale: 2 }).default("0.00"),
  transactionReference: text("transaction_reference"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var refunds = pgTable("refunds", {
  id: uuid("id").defaultRandom().primaryKey(),
  saleId: uuid("sale_id").references(() => sales.id).notNull(),
  refundNumber: text("refund_number").notNull().unique(),
  processedBy: uuid("processed_by").references(() => users.id).notNull(),
  totalRefundAmount: numeric("total_refund_amount", { precision: 12, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var refundItems = pgTable("refund_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  refundId: uuid("refund_id").references(() => refunds.id).notNull(),
  saleItemId: uuid("sale_item_id").references(() => saleItems.id).notNull(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  batchId: uuid("batch_id").references(() => batches.id),
  quantity: integer("quantity").notNull(),
  refundAmount: numeric("refund_amount", { precision: 12, scale: 2 }).notNull(),
  restock: boolean("restock").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var expenseCategories = pgTable("expense_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var expenses = pgTable("expenses", {
  id: uuid("id").defaultRandom().primaryKey(),
  categoryId: uuid("category_id").references(() => expenseCategories.id),
  title: text("title").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  expenseDate: date("expense_date").defaultNow().notNull(),
  receiptReference: text("receipt_reference"),
  paidTo: text("paid_to"),
  paymentMethod: text("payment_method").default("CASH"),
  recordedBy: uuid("recorded_by").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(),
  // 'LOW_STOCK' | 'EXPIRING_SOON' | 'EXPIRED' | 'SHIFT_DISCREPANCY' | 'INVENTORY_ALERT'
  referenceId: text("reference_id").unique(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id"),
  action: text("action").notNull(),
  // 'LOGIN', 'PRODUCT_CREATED', 'INITIAL_STOCK_ADDED', 'STOCK_ADDED', 'SALE_COMPLETED', 'REFUND_CREATED', etc.
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var productImports = pgTable("product_imports", {
  id: uuid("id").defaultRandom().primaryKey(),
  fileName: text("file_name").notNull(),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
  mode: text("mode").notNull().default("ADD_NEW"),
  // 'ADD_NEW' (update modes are not enabled)
  totalRows: integer("total_rows").notNull().default(0),
  importedRows: integer("imported_rows").notNull().default(0),
  duplicateRows: integer("duplicate_rows").notNull().default(0),
  failedRows: integer("failed_rows").notNull().default(0),
  stockRows: integer("stock_rows").notNull().default(0),
  batchesCreated: integer("batches_created").notNull().default(0),
  movementsCreated: integer("movements_created").notNull().default(0),
  categoriesCreated: integer("categories_created").notNull().default(0),
  status: text("status").notNull().default("COMPLETED"),
  // 'COMPLETED' | 'FAILED'
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at")
});
var smsOutbox = pgTable("sms_outbox", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventType: text("event_type").notNull(),
  recipient: text("recipient").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("PENDING"),
  // PENDING | SENT | FAILED
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  referenceId: text("reference_id").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  sentAt: timestamp("sent_at")
});
var productImportsRelations = relations(productImports, ({ one }) => ({
  uploadedByUser: one(users, {
    fields: [productImports.uploadedBy],
    references: [users.id]
  })
}));
var productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id]
  }),
  batches: many(batches),
  images: many(productImages),
  stockMovements: many(stockMovements)
}));
var batchesRelations = relations(batches, ({ one, many }) => ({
  product: one(products, {
    fields: [batches.productId],
    references: [products.id]
  }),
  supplier: one(suppliers, {
    fields: [batches.supplierId],
    references: [suppliers.id]
  }),
  stockMovements: many(stockMovements)
}));
var salesRelations = relations(sales, ({ one, many }) => ({
  cashier: one(users, {
    fields: [sales.cashierId],
    references: [users.id]
  }),
  shift: one(cashierShifts, {
    fields: [sales.shiftId],
    references: [cashierShifts.id]
  }),
  items: many(saleItems),
  payments: many(payments),
  refunds: many(refunds)
}));
var saleItemsRelations = relations(saleItems, ({ one, many }) => ({
  sale: one(sales, {
    fields: [saleItems.saleId],
    references: [sales.id]
  }),
  product: one(products, {
    fields: [saleItems.productId],
    references: [products.id]
  }),
  batches: many(saleBatches)
}));

// src/db/index.ts
var connectionString = process.env.DATABASE_URL;
var client = null;
var dbInstance = null;
function getDb() {
  if (!dbInstance) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      return null;
    }
    try {
      client = postgres(url, { max: 10, idle_timeout: 20, connect_timeout: 10 });
      dbInstance = drizzle(client, { schema: schema_exports });
    } catch (err) {
      console.error("Failed to initialize PostgreSQL connection:", err);
      return null;
    }
  }
  return dbInstance;
}
function getRawSql() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) return null;
    client = postgres(url, { max: 10, idle_timeout: 20, connect_timeout: 10 });
  }
  return client;
}

// src/server/routes/auth.ts
import { eq as eq2 } from "drizzle-orm";

// src/services/supabase.ts
import { createClient } from "@supabase/supabase-js";
var supabaseClient = null;
function getSupabase() {
  if (!supabaseClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (url && key) {
      supabaseClient = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
    }
  }
  return supabaseClient;
}
async function uploadImageToStorage(bucket, path, buffer, mimeType) {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
      contentType: mimeType,
      upsert: true
    });
    if (error) {
      console.error("[Supabase Storage] Upload error:", error);
      return null;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.error("[Supabase Storage] Upload exception:", err);
    return null;
  }
}
async function broadcastRealtimeEvent(eventType, payload) {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const channel = supabase.channel("pharmacy-realtime");
    const message = {
      ...payload,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    try {
      await channel.httpSend(eventType, message);
    } catch (httpErr) {
      await channel.send({ type: "broadcast", event: eventType, payload: message });
    }
  } catch (err) {
    console.error("[Supabase Realtime] Broadcast warning:", err);
  }
}

// src/server/middleware/auth.ts
import { eq } from "drizzle-orm";
var AUTH_CACHE_TTL_MS = 6e4;
var AUTH_CACHE_MAX_ENTRIES = 500;
var authCache = /* @__PURE__ */ new Map();
function invalidateAuthCache(token) {
  if (token) authCache.delete(token);
  else authCache.clear();
}
function rememberVerifiedToken(token, user) {
  const now = Date.now();
  authCache.set(token, { user, expires: now + AUTH_CACHE_TTL_MS });
  for (const [key, entry] of authCache) {
    if (entry.expires <= now) authCache.delete(key);
  }
  while (authCache.size > AUTH_CACHE_MAX_ENTRIES) {
    const oldest = authCache.keys().next().value;
    if (oldest === void 0) break;
    authCache.delete(oldest);
  }
}
async function requireAuthentication(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required. Missing Bearer token." });
  }
  const token = authHeader.split(" ")[1];
  const cached = authCache.get(token);
  if (cached && cached.expires > Date.now()) {
    req.user = cached.user;
    return next();
  }
  try {
    const supabase = getSupabase();
    if (supabase) {
      const { data: { user: sbUser }, error } = await supabase.auth.getUser(token);
      if (!error && sbUser) {
        const db2 = getDb();
        if (db2) {
          const [found] = await db2.select().from(schema_exports.users).where(eq(schema_exports.users.email, sbUser.email || "")).limit(1);
          if (found) {
            req.user = {
              id: found.id,
              email: found.email,
              fullName: found.fullName,
              role: found.role,
              status: found.status
            };
            rememberVerifiedToken(token, req.user);
            return next();
          }
        }
      }
    }
    const db = getDb();
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (db && token && UUID_RE.test(token)) {
      const [user] = await db.select().from(schema_exports.users).where(eq(schema_exports.users.id, token)).limit(1);
      if (user && user.status === "ACTIVE") {
        req.user = {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          status: user.status
        };
        rememberVerifiedToken(token, req.user);
        return next();
      }
    }
    return res.status(401).json({ error: "Invalid or expired authentication token." });
  } catch (err) {
    console.error("[Auth Middleware] Error verifying token:", err);
    return res.status(401).json({ error: "Authentication failed." });
  }
}
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required." });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: "403 Forbidden: You do not have permission to perform this action."
      });
    }
    next();
  };
}

// src/server/routes/auth.ts
init_sasuSync();

// src/db/init.ts
var INIT_SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'EMPLOYEE',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Employee Profiles
CREATE TABLE IF NOT EXISTS employee_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  employee_code TEXT NOT NULL UNIQUE,
  position TEXT DEFAULT 'Cashier',
  hire_date DATE,
  permissions JSONB DEFAULT '["pos", "view_inventory"]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Pharmacy Settings
CREATE TABLE IF NOT EXISTS pharmacy_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Empress Oris Herbal & Mart',
  license_number TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT DEFAULT 'Accra',
  region TEXT DEFAULT 'Greater Accra',
  country TEXT DEFAULT 'Ghana',
  currency TEXT DEFAULT 'GHS',
  currency_symbol TEXT DEFAULT 'GH\u20B5',
  tax_rate NUMERIC(5, 2) DEFAULT 0.00,
  logo_url TEXT,
  receipt_footer TEXT DEFAULT 'Thank you for your patronage! Medicines sold are not returnable once opened.',
  sms_notifications_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  sms_recipient_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Categories
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  city TEXT,
  region TEXT,
  payment_terms TEXT,
  notes TEXT,
  status TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Products
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  generic_name TEXT,
  brand_name TEXT,
  sku TEXT NOT NULL UNIQUE,
  barcode TEXT UNIQUE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  dosage_form TEXT,
  strength TEXT,
  unit TEXT DEFAULT 'Pack',
  pack_size INTEGER DEFAULT 1,
  manufacturer TEXT,
  description TEXT,
  prescription_required BOOLEAN NOT NULL DEFAULT false,
  image_url TEXT,
  reorder_level INTEGER NOT NULL DEFAULT 10,
  selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  wholesale_price NUMERIC(12, 2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Product Images
CREATE TABLE IF NOT EXISTS product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Batches
CREATE TABLE IF NOT EXISTS batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  batch_number TEXT NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  initial_quantity INTEGER NOT NULL,
  current_quantity INTEGER NOT NULL CHECK (current_quantity >= 0),
  cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  manufacturing_date DATE,
  expiry_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Stock Movements
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL,
  quantity_change INTEGER NOT NULL,
  previous_quantity INTEGER NOT NULL,
  new_quantity INTEGER NOT NULL,
  reference_id TEXT,
  reason TEXT,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Purchases
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  invoice_number TEXT,
  purchase_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'RECEIVED',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Purchase Items
CREATE TABLE IF NOT EXISTS purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  cost_price NUMERIC(12, 2) NOT NULL,
  selling_price NUMERIC(12, 2) NOT NULL,
  total_cost NUMERIC(12, 2) NOT NULL,
  expiry_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Cashier Shifts
CREATE TABLE IF NOT EXISTS cashier_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  opening_cash NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  expected_cash NUMERIC(12, 2) DEFAULT 0.00,
  actual_cash NUMERIC(12, 2),
  discrepancy NUMERIC(12, 2) DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'OPEN',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Sales
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT NOT NULL UNIQUE,
  cashier_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  shift_id UUID REFERENCES cashier_shifts(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_phone TEXT,
  subtotal NUMERIC(12, 2) NOT NULL,
  discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  tax NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(12, 2) NOT NULL,
  total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. Sale Items
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(12, 2) NOT NULL,
  discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_price NUMERIC(12, 2) NOT NULL,
  unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. Sale Batches (FEFO allocation)
CREATE TABLE IF NOT EXISTS sale_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_item_id UUID NOT NULL REFERENCES sale_items(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  unit_cost NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. Payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  amount_received NUMERIC(12, 2),
  change_given NUMERIC(12, 2) DEFAULT 0.00,
  transaction_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. Refunds
CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  refund_number TEXT NOT NULL UNIQUE,
  processed_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  total_refund_amount NUMERIC(12, 2) NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 18. Refund Items
CREATE TABLE IF NOT EXISTS refund_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id UUID NOT NULL REFERENCES refunds(id) ON DELETE CASCADE,
  sale_item_id UUID NOT NULL REFERENCES sale_items(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  refund_amount NUMERIC(12, 2) NOT NULL,
  restock BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 19. Expense Categories
CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 20. Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_reference TEXT,
  paid_to TEXT,
  payment_method TEXT DEFAULT 'CASH',
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 21. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  reference_id TEXT UNIQUE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 22. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 23. Product Excel Imports (Import History)
CREATE TABLE IF NOT EXISTS product_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  mode TEXT NOT NULL DEFAULT 'ADD_NEW',
  total_rows INTEGER NOT NULL DEFAULT 0,
  imported_rows INTEGER NOT NULL DEFAULT 0,
  duplicate_rows INTEGER NOT NULL DEFAULT 0,
  failed_rows INTEGER NOT NULL DEFAULT 0,
  stock_rows INTEGER NOT NULL DEFAULT 0,
  batches_created INTEGER NOT NULL DEFAULT 0,
  movements_created INTEGER NOT NULL DEFAULT 0,
  categories_created INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_batches_product_expiry ON batches(product_id, expiry_date);
CREATE INDEX IF NOT EXISTS idx_batches_current_qty ON batches(current_quantity);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_receipt ON sales(receipt_number);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_product_imports_created_at ON product_imports(created_at DESC);

-- SMS notification outbox
CREATE TABLE IF NOT EXISTS sms_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  recipient TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  reference_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sms_outbox_status ON sms_outbox(status);

-- Migration: add unique constraint on reference_id if missing
-- Guard on pg_constraint first: re-running ALTER TABLE ... UNIQUE on an
-- already-constrained column makes Postgres try to re-create the backing
-- index and fail with 42P07 (relation already exists), which aborted the
-- whole schema init on every server start.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'notifications'::regclass
      AND conname = 'notifications_reference_id_unique'
  ) THEN
    ALTER TABLE notifications ADD CONSTRAINT notifications_reference_id_unique UNIQUE (reference_id);
  END IF;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
`;
async function runSchemaInit() {
  const sql2 = getRawSql();
  if (!sql2) {
    console.log("[DB Init] No raw SQL client available (DATABASE_URL not configured yet).");
    return false;
  }
  try {
    await sql2.unsafe(INIT_SCHEMA_SQL);
    await sql2.unsafe(`ALTER TABLE pharmacy_settings ADD COLUMN IF NOT EXISTS sms_notifications_enabled BOOLEAN NOT NULL DEFAULT FALSE;`).catch(() => {
    });
    await sql2.unsafe(`ALTER TABLE pharmacy_settings ADD COLUMN IF NOT EXISTS sms_recipient_phone TEXT;`).catch(() => {
    });
    await sql2.unsafe(`
      UPDATE pharmacy_settings 
      SET name = 'Empress Oris Herbal & Mart' 
      WHERE name = 'HealthFirst Pharmacy' OR name = 'RxDispense Ghana' OR name ILIKE '%HealthFirst%';
    `).catch(() => {
    });
    console.log("[DB Init] Successfully verified and initialized all 23 database tables!");
    return true;
  } catch (err) {
    console.error("[DB Init] Error running schema initialization:", err);
    return false;
  }
}

// src/server/routes/auth.ts
var authRouter = Router();
authRouter.get("/status", async (req, res) => {
  try {
    const db = getDb();
    if (!db) {
      return res.json({
        configured: false,
        message: "Database connection not established. Please provide DATABASE_URL and Supabase credentials.",
        hasOwner: false
      });
    }
    try {
      const existingUsers = await db.select().from(schema_exports.users);
      const hasOwner = existingUsers.some((u) => u.role === "OWNER");
      let settings = null;
      try {
        const [row] = await db.select().from(schema_exports.pharmacySettings).limit(1);
        settings = row || null;
      } catch (settingsErr) {
        console.warn("[Auth Status] Pharmacy settings read failed:", settingsErr?.message);
      }
      return res.json({
        configured: true,
        hasOwner,
        userCount: existingUsers.length,
        pharmacyName: settings?.name || null,
        currency: settings?.currency || "GHS",
        currencySymbol: settings?.currencySymbol || "GH\u20B5"
      });
    } catch (dbErr) {
      console.log("[Auth Status] Table check error, attempting runSchemaInit:", dbErr?.message);
      const inited = await runSchemaInit();
      return res.json({
        configured: true,
        schemaInitialized: inited,
        hasOwner: false,
        userCount: 0
      });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to check setup status" });
  }
});
authRouter.post("/configure", async (req, res) => {
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
      initialized: inited
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message || "Failed to connect to Supabase PostgreSQL with provided credentials."
    });
  }
});
authRouter.post("/setup-owner", async (req, res) => {
  const { email, password, fullName, phone, pharmacyName, pharmacyPhone, pharmacyAddress } = req.body;
  if (!email || !fullName) {
    return res.status(400).json({ error: "Email and Full Name are required." });
  }
  if (!phone || !validateGhanaPhone(phone)) {
    return res.status(400).json({ error: "A valid owner SMS notification number is required." });
  }
  const db = getDb();
  if (!db) {
    return res.status(503).json({ error: "Database not connected. Please check configuration." });
  }
  try {
    await runSchemaInit().catch(() => {
    });
    const existingUsers = await db.select().from(schema_exports.users);
    const existingOwner = existingUsers.find((u) => u.role === "OWNER");
    if (existingOwner) {
      return res.status(400).json({ error: "An owner account already exists. Please log in." });
    }
    let authUserId = null;
    const supabase = getSupabase();
    if (supabase && password) {
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: "OWNER"
          }
        }
      });
      if (signUpErr && !signUpErr.message.includes("already registered")) {
        console.warn("[Supabase Auth] Sign-up note:", signUpErr.message);
      }
      authUserId = signUpData?.user?.id || null;
    }
    const [newOwner] = await db.insert(schema_exports.users).values({
      email,
      fullName,
      phone: phone || null,
      role: "OWNER",
      status: "ACTIVE"
    }).returning();
    const normalizedOwnerPhone = normalizeGhanaPhone(phone);
    const existingSettings = await db.select().from(schema_exports.pharmacySettings).limit(1);
    if (existingSettings.length === 0) {
      await db.insert(schema_exports.pharmacySettings).values({
        name: pharmacyName || "Empress Oris Herbal & Mart",
        phone: pharmacyPhone || phone || null,
        email,
        address: pharmacyAddress || "Accra, Ghana",
        city: "Accra",
        region: "Greater Accra",
        country: "Ghana",
        currency: "GHS",
        currencySymbol: "GH\u20B5",
        smsNotificationsEnabled: true,
        smsRecipientPhone: normalizedOwnerPhone
      });
    } else if (pharmacyName) {
      await db.update(schema_exports.pharmacySettings).set({
        name: pharmacyName,
        phone: pharmacyPhone || phone,
        address: pharmacyAddress,
        smsNotificationsEnabled: true,
        smsRecipientPhone: normalizedOwnerPhone
      });
    }
    await db.insert(schema_exports.auditLogs).values({
      userId: newOwner.id,
      action: "OWNER_REGISTERED",
      entityType: "USER",
      entityId: newOwner.id,
      details: { email, fullName },
      ipAddress: req.ip
    });
    return res.status(201).json({
      success: true,
      message: "Owner account created successfully.",
      user: newOwner,
      token: newOwner.id
    });
  } catch (err) {
    console.error("[Setup Owner] Error:", err);
    return res.status(500).json({ error: err.message || "Failed to create owner account." });
  }
});
authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required." });
  }
  const db = getDb();
  if (!db) {
    return res.status(503).json({ error: "Database not connected." });
  }
  try {
    const [user] = await db.select().from(schema_exports.users).where(eq2(schema_exports.users.email, email)).limit(1);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials. User not found." });
    }
    if (user.status !== "ACTIVE") {
      return res.status(403).json({ error: "Account is disabled. Please contact the administrator." });
    }
    const supabase = getSupabase();
    let authToken = user.id;
    if (supabase && password) {
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (signInErr) {
        console.warn("[Login] Supabase auth note:", signInErr.message);
      }
      if (signInData?.session?.access_token) {
        authToken = signInData.session.access_token;
      }
    }
    await db.insert(schema_exports.auditLogs).values({
      userId: user.id,
      action: "LOGIN",
      entityType: "USER",
      entityId: user.id,
      details: { email: user.email, role: user.role },
      ipAddress: req.ip
    });
    return res.json({
      success: true,
      user,
      token: authToken
    });
  } catch (err) {
    console.error("[Login] Error:", err);
    return res.status(500).json({ error: err.message || "Login failed." });
  }
});
authRouter.get("/me", requireAuthentication, async (req, res) => {
  const db = getDb();
  if (!db || !req.user) {
    return res.status(404).json({ error: "User not found." });
  }
  try {
    const [user] = await db.select().from(schema_exports.users).where(eq2(schema_exports.users.id, req.user.id)).limit(1);
    const [settings] = await db.select().from(schema_exports.pharmacySettings).limit(1);
    return res.json({
      user,
      settings: settings || {
        name: "Empress Oris Herbal & Mart",
        currency: "GHS",
        currencySymbol: "GH\u20B5"
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch user profile" });
  }
});
authRouter.post("/logout", requireAuthentication, async (req, res) => {
  const authHeader = req.headers.authorization;
  invalidateAuthCache(authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null);
  const db = getDb();
  if (db && req.user) {
    await db.insert(schema_exports.auditLogs).values({
      userId: req.user.id,
      action: "LOGOUT",
      entityType: "USER",
      entityId: req.user.id,
      ipAddress: req.ip
    });
  }
  return res.json({ success: true, message: "Logged out successfully." });
});

// src/server/routes/import.ts
import { Router as Router2 } from "express";
import multer from "multer";
import { z as z2 } from "zod";

// src/server/import/excel.ts
import * as XLSX from "xlsx";

// src/server/import/columns.ts
var COLUMNS = [
  {
    key: "name",
    label: "Product Name",
    required: true,
    kind: "text",
    hint: "Required. Name of the product as it appears in the POS (e.g. Paracetamol 500mg).",
    aliases: ["name", "item", "itemname", "item name", "product", "productname", "product name", "drugname", "drug name", "producttitle", "medicine", "medicinename"]
  },
  {
    key: "genericName",
    label: "Generic Name",
    required: false,
    kind: "text",
    hint: "Chemical/generic name (e.g. Paracetamol, Amoxicillin).",
    aliases: ["generic", "genericname", "chemicalname", "genericdrugname", "inn"]
  },
  {
    key: "brandName",
    label: "Brand",
    required: false,
    kind: "text",
    hint: "Brand or trade name (e.g. Panadol, Emzor).",
    aliases: ["brand", "brandname", "tradename", "brandtradename"]
  },
  {
    key: "sku",
    label: "SKU",
    required: false,
    kind: "text",
    hint: "Stock keeping unit. Leave blank and a unique SKU is generated automatically. Must be unique.",
    aliases: ["sku", "skucode", "sku code", "itemcode", "item code", "productcode", "product code", "stockcode", "stock code", "reference"]
  },
  {
    key: "barcode",
    label: "Barcode",
    required: false,
    kind: "text",
    hint: "UPC/EAN barcode. Must be unique when supplied.",
    aliases: ["barcode", "barcodes", "barcode number", "upc", "ean", "gtin", "upccode", "eancode"]
  },
  {
    key: "category",
    label: "Category",
    required: false,
    kind: "text",
    hint: "Existing category name, or a new one - new categories are created automatically.",
    aliases: ["category", "categoryname", "category name", "productcategory", "product category", "drugcategory", "drug category", "therapeuticcategory"]
  },
  {
    key: "dosageForm",
    label: "Dosage Form",
    required: false,
    kind: "text",
    hint: "Tablet, Capsule, Syrup, Suspension, Injection, Ointment, Drops, Inhaler, etc.",
    aliases: ["dosageform", "form", "pharmaceuticalform", "dosageformtype", "formulation"]
  },
  {
    key: "strength",
    label: "Strength",
    required: false,
    kind: "text",
    hint: "e.g. 500mg, 10mg/5ml.",
    aliases: ["strength", "potency", "strengthvolume", "dosage"]
  },
  {
    key: "unit",
    label: "Unit",
    required: false,
    kind: "text",
    hint: "Unit of measure: Pack, Box, Bottle, Blister, Sachet (default Pack).",
    aliases: ["unit", "unitofmeasure", "uom", "baseunit", "unittype"]
  },
  {
    key: "packSize",
    label: "Pack Size",
    required: false,
    kind: "integer",
    hint: "Pieces per pack (whole number >= 1, default 1).",
    aliases: ["packsize", "packsizepcs", "packquantity", "piecesperpack", "packpcs"]
  },
  {
    key: "manufacturer",
    label: "Manufacturer",
    required: false,
    kind: "text",
    hint: "Manufacturer (e.g. Ernest Chemist, Tobinco, GSK).",
    aliases: ["manufacturer", "maker", "manufacturedby", "producer", "company"]
  },
  {
    key: "description",
    label: "Description",
    required: false,
    kind: "text",
    hint: "Free-text product description.",
    aliases: ["description", "productdescription", "details", "remarks"]
  },
  {
    key: "prescriptionRequired",
    label: "Prescription Required",
    required: false,
    kind: "boolean",
    hint: "Yes / No / TRUE / FALSE / 1 / 0 (default No).",
    aliases: ["prescriptionrequired", "rxrequired", "prescription", "rx", "prescriptionneeded", "pom"]
  },
  {
    key: "reorderLevel",
    label: "Reorder Level",
    required: false,
    kind: "integer",
    hint: "Low-stock alert threshold (whole number >= 0, default 10).",
    aliases: ["reorderlevel", "reorderpoint", "minimumstock", "minstock", "lowstocklevel", "reorderqty"]
  },
  {
    key: "sellingPrice",
    label: "Selling Price (GH\u20B5)",
    required: true,
    kind: "price",
    hint: "Required. Retail selling price in Ghana Cedis as a plain number (e.g. 10.50).",
    aliases: ["sellingprice", "selling price", "sellprice", "sell price", "price", "retailprice", "retail price", "saleprice", "sale price", "sellingpriceghs", "sellingpricegh", "unitretailprice", "unit price"]
  },
  {
    key: "wholesalePrice",
    label: "Wholesale Price (GH\u20B5)",
    required: false,
    kind: "price",
    hint: "Optional wholesale price in Ghana Cedis as a plain number.",
    aliases: ["wholesaleprice", "wholesale", "bulkprice", "priceswholesale"]
  },
  {
    key: "initialQuantity",
    label: "Initial Quantity",
    required: false,
    kind: "integer",
    hint: "Opening stock units (whole number >= 0). Blank or 0 = product imported without stock.",
    aliases: ["initialquantity", "initial quantity", "quantity", "qty", "stock", "openingstock", "opening stock", "initialstock", "initial stock", "stockquantity", "stock quantity", "stockqty", "units", "unit"]
  },
  {
    key: "batchNumber",
    label: "Batch Number",
    required: false,
    kind: "text",
    hint: "Required when Initial Quantity > 0 (pharmaceutical batch / lot).",
    aliases: ["batchnumber", "batch number", "batch", "batchno", "batch no", "lotnumber", "lot number", "lotno", "lot no", "lot"]
  },
  {
    key: "costPrice",
    label: "Cost Price (GH\u20B5)",
    required: false,
    kind: "price",
    hint: "Unit cost price in Ghana Cedis (used for COGS / profit reporting).",
    aliases: ["costprice", "cost price", "unitcost", "unit cost", "cost", "purchaseprice", "purchase price", "buyprice", "buy price", "buyingprice", "buying price", "pricecost"]
  },
  {
    key: "manufacturingDate",
    label: "Manufacturing Date",
    required: false,
    kind: "date",
    hint: "Date produced (DD/MM/YYYY or YYYY-MM-DD). Optional.",
    aliases: ["manufacturingdate", "manufactureddate", "mfgdate", "productiondate", "dateofmanufacture"]
  },
  {
    key: "expiryDate",
    label: "Expiry Date",
    required: false,
    kind: "date",
    hint: "Required when Initial Quantity > 0. Used for FEFO (DD/MM/YYYY or YYYY-MM-DD).",
    aliases: ["expirydate", "expiry date", "expiry", "expirationdate", "expiration date", "expdate", "exp date", "dateofexpiry", "expireson", "expiry_date"]
  },
  {
    key: "supplier",
    label: "Supplier",
    required: false,
    kind: "text",
    hint: "Existing supplier name. If not found the batch is imported without a supplier link.",
    aliases: ["supplier", "suppliername", "vendor", "distributor", "wholesaler"]
  },
  {
    key: "purchaseReference",
    label: "Purchase Reference",
    required: false,
    kind: "text",
    hint: "Invoice / PO reference recorded on the stock movement.",
    aliases: ["purchasereference", "purchaseref", "reference", "referenceno", "invoice", "invoiceno", "invoicenumber", "ponumber", "purchaseorder"]
  },
  {
    key: "stockNotes",
    label: "Stock Notes",
    required: false,
    kind: "text",
    hint: "Notes stored on the imported batch.",
    aliases: ["stocknotes", "batchnotes", "stocknote", "inventorynotes", "notes"]
  }
];
var REQUIRED_COLUMN_KEYS = COLUMNS.filter((c) => c.required).map((c) => c.key);
var HEADER_LOOKUP = (() => {
  const map = /* @__PURE__ */ new Map();
  for (const col of COLUMNS) {
    const keys = [col.label, ...col.aliases];
    for (const key of keys) {
      const normalized = normalizeHeader(key);
      if (normalized && !map.has(normalized)) map.set(normalized, col.key);
    }
  }
  return map;
})();
function normalizeHeader(raw) {
  return String(raw ?? "").trim().replace(/\(.*?\)|\[.*?\]/g, " ").replace(/^[\s*#:]+|[\s*#:]+$/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function resolveHeader(raw) {
  return HEADER_LOOKUP.get(normalizeHeader(raw)) ?? null;
}
function mapHeaderRow(cells) {
  const columnIndexToKey = /* @__PURE__ */ new Map();
  const unmappedLabels = [];
  const seenFields = /* @__PURE__ */ new Set();
  const duplicatedFields = [];
  cells.forEach((cell, index) => {
    const label = String(cell ?? "").trim();
    if (!label) return;
    const field = resolveHeader(label);
    if (!field) {
      unmappedLabels.push(label);
      return;
    }
    if (seenFields.has(field)) {
      if (!duplicatedFields.includes(field)) duplicatedFields.push(field);
      return;
    }
    seenFields.add(field);
    columnIndexToKey.set(index, field);
  });
  const missingRequired = REQUIRED_COLUMN_KEYS.filter((key) => !seenFields.has(key));
  return {
    columnIndexToKey,
    unmappedLabels,
    duplicatedFields,
    missingRequired,
    recognizedCount: seenFields.size
  };
}
function fieldLabel(key) {
  return COLUMNS.find((c) => c.key === key)?.label ?? key;
}

// src/server/import/excel.ts
var MAX_FILE_BYTES = 5 * 1024 * 1024;
var MAX_ROWS = 5e3;
var ALLOWED_EXTENSIONS = [".xlsx", ".xls"];
var ALLOWED_MIME_TYPES = /* @__PURE__ */ new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream",
  "application/binary",
  "application/x-ole-storage",
  "application/x-ole-object",
  ""
]);
var ImportError = class extends Error {
  constructor(message, code = "INVALID_FILE") {
    super(message);
    this.code = code;
    this.name = "ImportError";
  }
};
function validateUpload(file) {
  const originalName = String(file.originalName || "").split(/[\\/]/).pop() || "products.xlsx";
  const lower = originalName.toLowerCase();
  const extension = lower.slice(lower.lastIndexOf("."));
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    throw new ImportError(
      `Unsupported file type "${extension || "unknown"}". Only ${ALLOWED_EXTENSIONS.join(" and ")} files can be imported.`,
      "INVALID_FILE"
    );
  }
  if (typeof file.mimetype === "string" && !ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
    throw new ImportError(
      `Unsupported file content type "${file.mimetype}". Please upload a genuine Excel workbook.`,
      "INVALID_FILE"
    );
  }
  if (!file.buffer || file.buffer.length === 0) {
    throw new ImportError("The uploaded file is empty.", "INVALID_FILE");
  }
  if (file.buffer.length > MAX_FILE_BYTES) {
    throw new ImportError(
      `File is too large (${(file.buffer.length / (1024 * 1024)).toFixed(1)} MB). Maximum size is 5 MB.`,
      "INVALID_FILE"
    );
  }
  const isZip = file.buffer.length > 4 && file.buffer[0] === 80 && file.buffer[1] === 75;
  const isOle = file.buffer.length > 8 && file.buffer[0] === 208 && file.buffer[1] === 207 && file.buffer[2] === 17 && file.buffer[3] === 224;
  if (extension === ".xlsx" && !isZip) {
    throw new ImportError("The file is not a valid .xlsx workbook.", "INVALID_FILE");
  }
  if (extension === ".xls" && !isOle && !isZip) {
    throw new ImportError("The file is not a valid .xls workbook.", "INVALID_FILE");
  }
  return originalName.slice(0, 200);
}
var HEADER_SCAN_ROWS = 12;
function parseProductWorkbook(file) {
  const fileName = validateUpload(file);
  let workbook;
  try {
    workbook = XLSX.read(file.buffer, {
      type: "buffer",
      cellDates: true,
      // date-formatted cells come back as real JS dates
      cellFormula: false,
      // never parse/evaluate formulas - cached values only
      cellStyles: false,
      cellNF: false,
      cellHTML: false,
      sheetStubs: false,
      bookVBA: false,
      // macros are never loaded or executed
      bookFiles: false
    });
  } catch (err) {
    throw new ImportError(
      `The file could not be read as an Excel workbook: ${err?.message || "unknown format"}.`,
      "INVALID_WORKBOOK"
    );
  }
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new ImportError("The workbook does not contain any worksheets.", "INVALID_WORKBOOK");
  }
  const preferred = workbook.SheetNames.find((n) => {
    const normalized = n.toLowerCase().replace(/[^a-z0-9]/g, "");
    return normalized === "products" || normalized === "product" || normalized === "sheet1";
  }) ?? workbook.SheetNames[0];
  const worksheet = workbook.Sheets[preferred];
  if (!worksheet || !worksheet["!ref"]) {
    throw new ImportError(`Worksheet "${preferred}" is empty.`, "INVALID_WORKBOOK");
  }
  const grid = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: true,
    blankrows: true,
    defval: null
  });
  if (!grid.length) {
    throw new ImportError(
      `Worksheet "${preferred}" has no data.

Import cannot continue.

Missing required columns:
- Product Name
- Selling Price (GH\u20B5)`,
      "MISSING_COLUMNS"
    );
  }
  const range = XLSX.utils.decode_range(worksheet["!ref"]);
  const firstRowNumber = range.s.r + 1;
  let headerIndex = -1;
  let bestMapping = null;
  const scanLimit = Math.min(grid.length, HEADER_SCAN_ROWS);
  for (let i = 0; i < scanLimit; i++) {
    const mapping2 = mapHeaderRow(grid[i] || []);
    if (!bestMapping || mapping2.recognizedCount > bestMapping.recognizedCount) {
      bestMapping = mapping2;
      headerIndex = i;
    }
    if (mapping2.recognizedCount >= 3 && mapping2.missingRequired.length === 0) break;
  }
  if (!bestMapping || bestMapping.recognizedCount === 0) {
    throw new ImportError(
      "Import cannot continue.\n\nNo header row could be identified. The first row of the worksheet must contain column headers.\n\nMissing required columns:\n- Product Name\n- Selling Price (GH\u20B5)",
      "MISSING_COLUMNS"
    );
  }
  const mapping = bestMapping;
  const headerRowNumber = firstRowNumber + headerIndex;
  const headers = (grid[headerIndex] || []).map((cell) => String(cell ?? "").trim());
  if (mapping.missingRequired.length > 0) {
    const list = mapping.missingRequired.map((key) => `- ${fieldLabel(key)}`).join("\n");
    throw new ImportError(`Import cannot continue.

Missing required columns:
${list}`, "MISSING_COLUMNS");
  }
  const rows = [];
  let skippedBlankRows = 0;
  for (let i = headerIndex + 1; i < grid.length; i++) {
    const cells = grid[i] || [];
    const isEmpty = cells.every((cell) => cell === null || cell === void 0 || String(cell).trim() === "");
    if (isEmpty) {
      skippedBlankRows++;
      continue;
    }
    rows.push({ rowNumber: firstRowNumber + i, cells });
    if (rows.length > MAX_ROWS) {
      throw new ImportError(
        `The worksheet contains more than ${MAX_ROWS} data rows. Split the file into smaller batches of up to ${MAX_ROWS} rows.`,
        "TOO_MANY_ROWS"
      );
    }
  }
  if (rows.length === 0) {
    throw new ImportError(
      "The worksheet contains a header row but no product data rows. Add at least one product below the headers.",
      "NO_ROWS"
    );
  }
  return {
    fileName,
    sheetName: preferred,
    sheetNames: workbook.SheetNames,
    headerRowNumber,
    headers,
    mapping,
    rows,
    skippedBlankRows
  };
}
function extractFields(row, columnMap) {
  const out = {};
  for (const [index, field] of columnMap) {
    out[field] = row.cells[index];
  }
  return out;
}

// src/server/import/importService.ts
import { randomUUID } from "crypto";
import { desc, eq as eq3 } from "drizzle-orm";

// src/server/import/validation.ts
import { z } from "zod";

// src/server/import/values.ts
var TRUE_WORDS = /* @__PURE__ */ new Set(["true", "yes", "y", "t", "1", "required", "rx", "on"]);
var FALSE_WORDS = /* @__PURE__ */ new Set(["false", "no", "n", "f", "0", "", "notrequired", "not required", "off"]);
function toText(value) {
  if (value === null || value === void 0) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text2 = String(value).trim().replace(/\s+/g, " ");
  return text2 === "" ? null : text2;
}
function extractPriceUnit(text2) {
  const lower = String(text2 || "").toLowerCase();
  if (/pesewa/.test(lower)) return "pesewa";
  if (/tab(let)?s?/.test(lower)) return "tablet";
  if (/bottle(s)?/.test(lower)) return "bottle";
  if (/pack(s)?/.test(lower)) return "pack";
  if (/strip(s)?/.test(lower)) return "strip";
  if (/\/\s*1\b|\bper\s*1\b|\bper\s*one\b/.test(lower)) return "unit";
  return null;
}
function parsePrice(value, label) {
  if (value === null || value === void 0 || typeof value === "string" && value.trim() === "") {
    return { ok: true, value: null, unit: null, original: typeof value === "string" ? value.trim() : null };
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { ok: false, reason: `${label} must be a valid number.` };
    if (value < 0) return { ok: false, reason: `${label} must not be negative (received ${value}).` };
    if (value > 99999999999e-2) return { ok: false, reason: `${label} is out of range.` };
    return { ok: true, value: Math.round(value * 100) / 100, unit: null, original: String(value) };
  }
  const original = String(value).trim().replace(/\s+/g, " ");
  if (original === "") {
    return { ok: true, value: null, unit: null, original };
  }
  const unit = extractPriceUnit(original);
  const pesewaMatch = original.match(/(\d+(?:\.\d+)?)\s*pesewas?/i);
  if (pesewaMatch) {
    const parsed2 = Number(pesewaMatch[1]);
    if (!Number.isFinite(parsed2) || parsed2 < 0) {
      return { ok: false, reason: `${label} must not be negative (received "${original}").` };
    }
    const amount = parsed2 / 100;
    if (amount > 99999999999e-2) return { ok: false, reason: `${label} is out of range.` };
    return { ok: true, value: Math.round(amount * 100) / 100, unit: "pesewa", original };
  }
  let working = original;
  const currencyTokens = ["gh\u20B5", "\u20B5", "ghs", "gh", "\xA2", "cedi", "cedis", "ghc"];
  for (const token of currencyTokens.sort((a, b) => b.length - a.length)) {
    working = working.replace(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " ");
  }
  working = working.replace(/\s+/g, " ").trim();
  const numberMatch = working.match(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)/);
  if (!numberMatch) {
    return {
      ok: false,
      reason: `${label} must be a valid Ghana Cedi amount (received "${original}" - no numeric amount found).`
    };
  }
  const normalized = numberMatch[1].replace(/,/g, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { ok: false, reason: `${label} must not be negative (received "${original}").` };
  }
  if (parsed > 99999999999e-2) {
    return { ok: false, reason: `${label} is out of range.` };
  }
  const leftover = working.replace(numberMatch[1], " ").replace(/[\/.,\s]/g, "").replace(/[0-9]/g, "").replace(/per|tab(let)?s?|bottle(s)?|pack(s)?|strip(s)?|unit(s)?/gi, "");
  if (leftover.trim() !== "") {
    return {
      ok: false,
      reason: `${label} has an unrecognized format (received "${original}").`
    };
  }
  return { ok: true, value: Math.round(parsed * 100) / 100, unit, original };
}
function toPrice(value, label, options) {
  const result = parsePrice(value, label);
  if (!result.ok) return result;
  if (result.value === null) {
    if (options.required) return { ok: false, reason: `${label} is required.` };
    return { ok: true, value: null, unit: result.unit, original: result.original };
  }
  return { ok: true, value: result.value, unit: result.unit, original: result.original };
}
function toInteger(value, label, options) {
  if (value === null || value === void 0 || typeof value === "string" && value.trim() === "") {
    if (options.required) return { ok: false, reason: `${label} is required.` };
    return { ok: true, value: options.fallback ?? null };
  }
  let parsed;
  if (typeof value === "number") {
    parsed = value;
  } else {
    const text2 = String(value).trim().replace(/,/g, "");
    if (!/^[+-]?(\d+(?:\.\d+)?)$/.test(text2)) {
      return { ok: false, reason: `${label} must be a whole number (received "${String(value).trim()}").` };
    }
    parsed = Number(text2);
  }
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return { ok: false, reason: `${label} must be a whole number without decimals.` };
  }
  if (parsed < options.min) {
    return { ok: false, reason: `${label} must be ${options.min} or greater (received ${parsed}).` };
  }
  if (parsed > options.max) {
    return { ok: false, reason: `${label} must not exceed ${options.max}.` };
  }
  return { ok: true, value: parsed };
}
function toBoolean(value, label) {
  if (value === null || value === void 0) return { ok: true, value: false };
  if (typeof value === "boolean") return { ok: true, value };
  if (typeof value === "number") {
    if (value === 1) return { ok: true, value: true };
    if (value === 0) return { ok: true, value: false };
    return { ok: false, reason: `${label} must be Yes or No (received ${value}).` };
  }
  const text2 = String(value).trim().toLowerCase().replace(/\s+/g, "");
  if (TRUE_WORDS.has(text2)) return { ok: true, value: true };
  if (FALSE_WORDS.has(text2)) return { ok: true, value: false };
  return {
    ok: false,
    reason: `${label} must be one of: Yes, No, TRUE, FALSE, 1, 0 (received "${String(value).trim()}").`
  };
}
var MONTHS = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12
};
function dateToIso(year, month, day) {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function serialToIso(serial) {
  const ms = Math.round((serial - 25569) * 864e5);
  if (!Number.isFinite(ms)) return null;
  const date2 = new Date(ms);
  if (Number.isNaN(date2.getTime())) return null;
  return dateToIso(date2.getUTCFullYear(), date2.getUTCMonth() + 1, date2.getUTCDate());
}
function jsDateToIso(date2) {
  if (Number.isNaN(date2.getTime())) return null;
  return dateToIso(date2.getUTCFullYear(), date2.getUTCMonth() + 1, date2.getUTCDate());
}
function parseDateString(text2) {
  const value = text2.trim();
  if (!value) return null;
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(value);
  if (match) return dateToIso(Number(match[1]), Number(match[2]), Number(match[3]));
  match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(value);
  if (match) {
    let year = Number(match[3]);
    if (year < 100) year += 2e3;
    return dateToIso(year, Number(match[2]), Number(match[1]));
  }
  match = /^(\d{1,2})[\s-]([A-Za-z]{3,9})[\s-,]+(\d{4})$/.exec(value);
  if (match) {
    const month = MONTHS[match[2].slice(0, 3).toLowerCase()];
    if (month) return dateToIso(Number(match[3]), month, Number(match[1]));
  }
  match = /^([A-Za-z]{3,9})[\s-]+(\d{1,2})[\s-,]+(\d{4})$/.exec(value);
  if (match) {
    const month = MONTHS[match[1].slice(0, 3).toLowerCase()];
    if (month) return dateToIso(Number(match[3]), month, Number(match[2]));
  }
  const native = new Date(value);
  if (!Number.isNaN(native.getTime()) && /\d{4}/.test(value)) {
    return dateToIso(native.getUTCFullYear(), native.getUTCMonth() + 1, native.getUTCDate());
  }
  return null;
}
function toDate(value, label, options) {
  if (value === null || value === void 0 || typeof value === "string" && value.trim() === "") {
    if (options.required) return { ok: false, reason: `${label} is required.` };
    return { ok: true, value: null };
  }
  if (value instanceof Date) {
    const iso2 = jsDateToIso(value);
    if (iso2) return { ok: true, value: iso2 };
    return { ok: false, reason: `${label} is not a valid date.` };
  }
  if (typeof value === "number") {
    if (value >= 32874 && value <= 73415) {
      const iso2 = serialToIso(value);
      if (iso2) return { ok: true, value: iso2 };
    }
    return {
      ok: false,
      reason: `${label} is not a valid date (received ${value} - enter a real date such as 30/05/2028 or 2028-05-30).`
    };
  }
  const iso = parseDateString(String(value));
  if (iso) return { ok: true, value: iso };
  return {
    ok: false,
    reason: `${label} is not a valid date (received "${String(value).trim()}"). Use DD/MM/YYYY or YYYY-MM-DD.`
  };
}
function todayIso() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}

// src/server/import/validation.ts
function normalizeProductName(name) {
  return String(name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}
var coercedRowSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  barcode: z.string().min(1).nullable(),
  sellingPrice: z.number().min(0),
  wholesalePrice: z.number().min(0).nullable(),
  packSize: z.number().int().min(1),
  reorderLevel: z.number().int().min(0),
  initialQuantity: z.number().int().min(0),
  prescriptionRequired: z.boolean(),
  manufacturingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()
});
function generateSku(productName, taken) {
  const prefix = (productName || "PRD").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || "PRD";
  for (let i = 0; i < 500; i++) {
    const candidate = `${prefix}-${Math.floor(1e3 + Math.random() * 9e3)}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${prefix}-${Date.now().toString().slice(-8)}`;
}
function validateWorkbookRows(workbook, reference) {
  const columnMap = workbook.mapping.columnIndexToKey;
  const today = todayIso();
  const seenSkus = /* @__PURE__ */ new Set();
  const seenBarcodes = /* @__PURE__ */ new Set();
  const seenNames = /* @__PURE__ */ new Set();
  const seenSkuRows = /* @__PURE__ */ new Map();
  const seenBarcodeRows = /* @__PURE__ */ new Map();
  const seenNameRows = /* @__PURE__ */ new Map();
  const takenSkus = new Set(reference.existingSkus.keys());
  const newCategoryNames = /* @__PURE__ */ new Map();
  const rows = [];
  let readyCount = 0;
  let duplicateCount = 0;
  let invalidCount = 0;
  let withStockCount = 0;
  let skuGeneratedCount = 0;
  let expiredBatchCount = 0;
  for (const parsedRow of workbook.rows) {
    const raw = extractFields(parsedRow, columnMap);
    const errors = [];
    const warnings = [];
    const notes = [];
    const name = toText(raw.name);
    if (!name) errors.push("Product Name is required and must not be empty.");
    const genericName = toText(raw.genericName);
    const brandName = toText(raw.brandName);
    const dosageForm = toText(raw.dosageForm);
    const strength = toText(raw.strength);
    const manufacturer = toText(raw.manufacturer);
    const description = toText(raw.description);
    const categoryName = toText(raw.category);
    const purchaseReference = toText(raw.purchaseReference);
    const stockNotes = toText(raw.stockNotes);
    const unit = toText(raw.unit) || "Pack";
    let sku = toText(raw.sku);
    let barcode = toText(raw.barcode);
    if (barcode) {
      if (!/^[A-Za-z0-9\-+. ]{4,64}$/.test(barcode)) {
        errors.push(`Barcode "${barcode}" contains unsupported characters (use digits, letters, - . + or spaces).`);
      }
    }
    const sellingPriceMissing = raw.sellingPrice === null || raw.sellingPrice === void 0 || typeof raw.sellingPrice === "string" && raw.sellingPrice.trim() === "";
    const sellingPriceResult = toPrice(raw.sellingPrice, "Selling Price", { required: false });
    let sellingPrice = null;
    if (sellingPriceMissing) {
      sellingPrice = 0;
      warnings.push("Selling Price is missing - set to GH\u20B50.00. Update before selling.");
    } else if (!sellingPriceResult.ok) {
      errors.push(sellingPriceResult.reason);
      sellingPrice = null;
    } else {
      sellingPrice = sellingPriceResult.value ?? 0;
      if (sellingPriceResult.unit && sellingPriceResult.original && sellingPriceResult.original !== String(sellingPrice)) {
        notes.push(
          `Selling price interpreted as GH\u20B5${(sellingPrice ?? 0).toFixed(2)} per ${sellingPriceResult.unit} (original value: "${sellingPriceResult.original}").`
        );
      } else if (sellingPriceResult.original && !/^\d+(?:\.\d+)?$/.test(sellingPriceResult.original)) {
        notes.push(`Original selling price value preserved for audit: "${sellingPriceResult.original}".`);
      }
    }
    const wholesalePriceResult = toPrice(raw.wholesalePrice, "Wholesale Price", { required: false });
    if (!wholesalePriceResult.ok) errors.push(wholesalePriceResult.reason);
    const wholesalePrice = wholesalePriceResult.ok ? wholesalePriceResult.value : null;
    const costPriceResult = toPrice(raw.costPrice, "Cost Price", { required: false });
    if (!costPriceResult.ok) errors.push(costPriceResult.reason);
    const costPrice = costPriceResult.ok ? costPriceResult.value : null;
    if (costPriceResult.ok && costPriceResult.unit && costPriceResult.original && costPriceResult.original !== String(costPrice)) {
      notes.push(
        `Cost price interpreted as GH\u20B5${(costPrice ?? 0).toFixed(2)} per ${costPriceResult.unit} (original value: "${costPriceResult.original}").`
      );
    } else if (costPriceResult.ok && costPriceResult.original && !/^\d+(?:\.\d+)?$/.test(costPriceResult.original)) {
      notes.push(`Original cost price value preserved for audit: "${costPriceResult.original}".`);
    }
    const packSizeResult = toInteger(raw.packSize, "Pack Size", { required: false, min: 1, max: 1e5, fallback: 1 });
    if (!packSizeResult.ok) errors.push(packSizeResult.reason);
    const packSize = packSizeResult.ok ? packSizeResult.value ?? 1 : 1;
    const reorderResult = toInteger(raw.reorderLevel, "Reorder Level", { required: false, min: 0, max: 1e6, fallback: 10 });
    if (!reorderResult.ok) errors.push(reorderResult.reason);
    const reorderLevel = reorderResult.ok ? reorderResult.value ?? 10 : 10;
    const quantityMissing = raw.initialQuantity === null || raw.initialQuantity === void 0 || typeof raw.initialQuantity === "string" && raw.initialQuantity.trim() === "";
    const quantityResult = toInteger(raw.initialQuantity, "Initial Quantity", { required: false, min: 0, max: 1e8, fallback: 0 });
    if (!quantityResult.ok) errors.push(quantityResult.reason);
    const initialQuantity = quantityResult.ok ? quantityResult.value ?? 0 : 0;
    if (quantityMissing) {
      warnings.push("Initial Quantity is missing - product will be imported without opening stock.");
    }
    const rxResult = toBoolean(raw.prescriptionRequired, "Prescription Required");
    if (!rxResult.ok) errors.push(rxResult.reason);
    const prescriptionRequired = rxResult.ok ? rxResult.value : false;
    const mfgResult = toDate(raw.manufacturingDate, "Manufacturing Date", { required: false });
    if (!mfgResult.ok) errors.push(mfgResult.reason);
    const manufacturingDate = mfgResult.ok ? mfgResult.value : null;
    const expiryResult = toDate(raw.expiryDate, "Expiry Date", { required: false });
    if (!expiryResult.ok) errors.push(expiryResult.reason);
    const expiryDate = expiryResult.ok ? expiryResult.value : null;
    const batchNumber = toText(raw.batchNumber);
    const hasStock = initialQuantity > 0 && !!batchNumber && !!expiryDate;
    if (initialQuantity > 0 && (!batchNumber || !expiryDate)) {
      warnings.push(
        "Opening quantity recorded but stock not initialized because Batch Number/Expiry Date is missing. Product will be imported without stock; add stock later via Add Stock."
      );
    }
    if (hasStock) {
    } else if (batchNumber || expiryDate) {
      notes.push("Batch information ignored because Initial Quantity is 0 or blank.");
    }
    const costPriceMissing = raw.costPrice === null || raw.costPrice === void 0 || typeof raw.costPrice === "string" && raw.costPrice.trim() === "";
    if (costPrice === null && costPriceMissing) {
      warnings.push("Cost Price (Buying Price) is missing - the product will be imported without cost data.");
    }
    const supplierName = toText(raw.supplier);
    let supplierId = null;
    if (supplierName) {
      const supplier = reference.suppliers.get(supplierName.toLowerCase());
      if (supplier) {
        supplierId = supplier.id;
      } else {
        warnings.push(
          `Supplier "${supplierName}" was not found - the batch will be imported without a supplier link.`
        );
      }
    }
    let categoryId = null;
    let isNewCategory = false;
    if (categoryName) {
      const existing = reference.categories.get(categoryName.toLowerCase());
      if (existing) {
        categoryId = existing.id;
      } else {
        isNewCategory = true;
        newCategoryNames.set(categoryName.toLowerCase(), categoryName);
        notes.push(`New category "${categoryName}" will be created.`);
      }
    }
    if (!sku) {
      if (name) {
        sku = generateSku(name, takenSkus);
        takenSkus.add(sku.toLowerCase());
        notes.push(`SKU was not supplied - generated automatically: ${sku}.`);
        skuGeneratedCount++;
      }
    }
    if (expiryDate && expiryDate < today && hasStock) {
      warnings.push("Expiry Date is in the past - this stock cannot be sold through the POS (FEFO rules).");
    }
    if (costPrice !== null && sellingPrice !== null && costPrice >= sellingPrice && sellingPrice > 0) {
      warnings.push("Cost Price is not lower than Selling Price - this product will not generate a margin.");
    }
    let status = errors.length > 0 ? "INVALID" : "READY";
    const normalizedName = normalizeProductName(name);
    if (status === "READY" && normalizedName) {
      const dbName = reference.existingNames?.get(normalizedName);
      if (dbName) {
        status = "DUPLICATE";
        errors.push(`A product with this name already exists in the system ("${dbName}").`);
      } else if (seenNames.has(normalizedName)) {
        status = "DUPLICATE";
        errors.push(`Duplicate product name inside this spreadsheet (first used on row ${seenNameRows.get(normalizedName)}).`);
      }
    }
    if (status === "READY" && sku) {
      const skuKey = sku.toLowerCase();
      const dbMatch = reference.existingSkus.get(skuKey);
      if (dbMatch) {
        status = "DUPLICATE";
        errors.push(`SKU already exists in the system ("${dbMatch}").`);
      } else if (seenSkus.has(skuKey)) {
        status = "DUPLICATE";
        errors.push(`Duplicate SKU inside this spreadsheet (first used on row ${seenSkuRows.get(skuKey)}).`);
      }
      if (status === "READY" && barcode) {
        const barcodeKey = barcode.toLowerCase();
        const dbBarcode = reference.existingBarcodes.get(barcodeKey);
        if (dbBarcode) {
          status = "DUPLICATE";
          errors.push(`Barcode already exists in the system ("${dbBarcode}").`);
        } else if (seenBarcodes.has(barcodeKey)) {
          status = "DUPLICATE";
          errors.push(`Duplicate barcode inside this spreadsheet (first used on row ${seenBarcodeRows.get(barcodeKey)}).`);
        }
      }
    }
    if (status === "INVALID") {
      invalidCount++;
    } else if (status === "DUPLICATE") {
      duplicateCount++;
    } else {
      readyCount++;
      if (sku) seenSkus.add(sku.toLowerCase());
      if (sku) seenSkuRows.set(sku.toLowerCase(), parsedRow.rowNumber);
      if (barcode) {
        seenBarcodes.add(barcode.toLowerCase());
        seenBarcodeRows.set(barcode.toLowerCase(), parsedRow.rowNumber);
      }
      if (normalizedName) {
        seenNames.add(normalizedName);
        seenNameRows.set(normalizedName, parsedRow.rowNumber);
      }
      if (hasStock) {
        withStockCount++;
        if (expiryDate && expiryDate < today) expiredBatchCount++;
      }
    }
    rows.push({
      rowNumber: parsedRow.rowNumber,
      status,
      errors,
      warnings,
      notes,
      name,
      genericName,
      brandName,
      sku,
      barcode,
      categoryName,
      categoryId,
      isNewCategory,
      dosageForm,
      strength,
      unit,
      packSize,
      manufacturer,
      description,
      prescriptionRequired,
      reorderLevel,
      sellingPrice,
      wholesalePrice,
      initialQuantity,
      hasStock,
      batchNumber: hasStock ? batchNumber : null,
      costPrice,
      manufacturingDate: hasStock ? manufacturingDate : null,
      expiryDate: hasStock ? expiryDate : null,
      supplierName,
      supplierId,
      purchaseReference: hasStock ? purchaseReference : null,
      stockNotes: hasStock ? stockNotes : null
    });
  }
  for (const row of rows) {
    if (row.status !== "READY") continue;
    const result = coercedRowSchema.safeParse({
      name: row.name,
      sku: row.sku,
      barcode: row.barcode,
      sellingPrice: row.sellingPrice,
      wholesalePrice: row.wholesalePrice,
      packSize: row.packSize,
      reorderLevel: row.reorderLevel,
      initialQuantity: row.initialQuantity,
      prescriptionRequired: row.prescriptionRequired,
      manufacturingDate: row.manufacturingDate,
      expiryDate: row.expiryDate
    });
    if (!result.success) {
      row.status = "INVALID";
      for (const issue of result.error.issues) {
        row.errors.push(`${issue.path.join(".") || "row"}: ${issue.message}`);
      }
      readyCount--;
      invalidCount++;
      if (row.hasStock) withStockCount--;
      if (row.sku) seenSkus.delete(row.sku.toLowerCase());
      if (row.barcode) seenBarcodes.delete(row.barcode.toLowerCase());
      if (row.name) seenNames.delete(normalizeProductName(row.name));
    }
  }
  return {
    rows,
    summary: {
      totalRows: rows.length,
      readyCount,
      duplicateCount,
      invalidCount,
      withStockCount,
      withoutStockCount: readyCount - withStockCount,
      skuGeneratedCount,
      expiredBatchCount,
      newCategories: [...newCategoryNames.values()]
    },
    unmappedColumns: workbook.mapping.unmappedLabels
  };
}

// src/server/import/importService.ts
var INSERT_CHUNK_SIZE = 400;
function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}
function toPreviewRow(row) {
  return {
    rowNumber: row.rowNumber,
    status: row.status,
    name: row.name,
    sku: row.sku,
    barcode: row.barcode,
    categoryName: row.categoryName,
    sellingPrice: row.sellingPrice,
    costPrice: row.costPrice,
    initialQuantity: row.initialQuantity,
    hasStock: row.hasStock,
    batchNumber: row.batchNumber,
    expiryDate: row.expiryDate,
    supplierName: row.supplierName,
    errors: row.errors,
    warnings: row.warnings,
    notes: row.notes
  };
}
async function loadReferenceData() {
  const db = getDb();
  if (!db) throw new ImportError("Database not connected.", "INVALID_FILE");
  const [categories2, suppliers2, products2] = await Promise.all([
    db.select({ id: schema_exports.categories.id, name: schema_exports.categories.name }).from(schema_exports.categories),
    db.select({ id: schema_exports.suppliers.id, name: schema_exports.suppliers.name }).from(schema_exports.suppliers),
    db.select({ sku: schema_exports.products.sku, barcode: schema_exports.products.barcode, name: schema_exports.products.name }).from(schema_exports.products)
  ]);
  const reference = {
    categories: new Map(categories2.map((c) => [c.name.trim().toLowerCase(), c])),
    suppliers: new Map(suppliers2.map((s) => [s.name.trim().toLowerCase(), s])),
    existingSkus: /* @__PURE__ */ new Map(),
    existingBarcodes: /* @__PURE__ */ new Map(),
    existingNames: /* @__PURE__ */ new Map()
  };
  for (const product of products2) {
    if (product.sku) reference.existingSkus.set(product.sku.trim().toLowerCase(), product.sku.trim());
    if (product.barcode) reference.existingBarcodes.set(product.barcode.trim().toLowerCase(), product.barcode.trim());
    if (product.name) {
      const normalized = product.name.trim().toLowerCase().replace(/\s+/g, " ");
      if (!reference.existingNames) reference.existingNames = /* @__PURE__ */ new Map();
      if (!reference.existingNames.has(normalized)) reference.existingNames.set(normalized, product.name.trim());
    }
  }
  return reference;
}
async function buildPreview(file) {
  const workbook = parseProductWorkbook(file);
  const reference = await loadReferenceData();
  const validation = validateWorkbookRows(workbook, reference);
  return { workbook, validation };
}
async function previewImport(file, _user) {
  const { workbook, validation } = await buildPreview(file);
  return {
    fileName: workbook.fileName,
    sheetName: workbook.sheetName,
    headerRowNumber: workbook.headerRowNumber,
    headers: workbook.headers,
    columnMapping: workbook.headers.map((header, index) => ({
      index,
      header,
      field: workbook.mapping.columnIndexToKey.get(index) ?? null
    })),
    mode: "ADD_NEW",
    fileSizeBytes: file.buffer.length,
    maxRows: MAX_ROWS,
    maxFileBytes: MAX_FILE_BYTES,
    skippedBlankRows: workbook.skippedBlankRows,
    unmappedColumns: validation.unmappedColumns,
    summary: validation.summary,
    rows: validation.rows.map(toPreviewRow)
  };
}
function isUniqueViolation(err) {
  return err?.code === "23505" || String(err?.message || "").toLowerCase().includes("duplicate key");
}
function friendlyDbError(err) {
  if (isUniqueViolation(err)) {
    return "A product with this SKU or barcode already exists (it may have been created while this import was running). Nothing was imported - please refresh and try again.";
  }
  const pgMessage = err?.cause?.message || err?.original?.message || "";
  const isSafePostgresMessage = typeof pgMessage === "string" && pgMessage.length > 0 && !/insert into|update\s|delete from|values\s*\(/i.test(pgMessage);
  if (isSafePostgresMessage) {
    return `The import was rejected by the database: ${pgMessage}. No changes were saved.`;
  }
  return "The import failed while writing to the database. No changes were saved. Please check the file and try again.";
}
async function confirmImport(file, user, mode = "ADD_NEW", ipAddress) {
  const normalizedMode = String(mode || "ADD_NEW").toUpperCase();
  if (normalizedMode !== "ADD_NEW") {
    throw new ImportError(
      "Only the 'Add New Products' import mode is currently enabled. Existing products are never overwritten by an import.",
      "INVALID_FILE"
    );
  }
  const db = getDb();
  if (!db) throw new ImportError("Database not connected.", "INVALID_FILE");
  const { workbook, validation } = await buildPreview(file);
  const readyRows = validation.rows.filter((row) => row.status === "READY");
  const { summary } = validation;
  if (readyRows.length === 0) {
    throw new ImportError(
      `No valid rows to import: ${summary.duplicateCount} duplicate row(s) and ${summary.invalidCount} invalid row(s) were found. Fix the file and try again.`,
      "NO_ROWS"
    );
  }
  const fileName = workbook.fileName;
  const stockRows = readyRows.filter((row) => row.hasStock);
  const productIds = new Map(readyRows.map((row) => [row.rowNumber, randomUUID()]));
  const batchIds = new Map(stockRows.map((row) => [row.rowNumber, randomUUID()]));
  let categoriesCreated = 0;
  try {
    const result = await db.transaction(async (tx) => {
      let categoryMap = new Map(
        (await tx.select({ id: schema_exports.categories.id, name: schema_exports.categories.name }).from(schema_exports.categories)).map(
          (c) => [c.name.trim().toLowerCase(), c]
        )
      );
      const missingCategoryNames = [
        ...new Set(
          readyRows.map((row) => row.categoryName).filter((name) => !!name && !categoryMap.has(name.trim().toLowerCase()))
        )
      ];
      if (missingCategoryNames.length > 0) {
        await tx.insert(schema_exports.categories).values(missingCategoryNames.map((name) => ({ name }))).onConflictDoNothing();
        categoriesCreated = missingCategoryNames.length;
        categoryMap = new Map(
          (await tx.select({ id: schema_exports.categories.id, name: schema_exports.categories.name }).from(schema_exports.categories)).map(
            (c) => [c.name.trim().toLowerCase(), c]
          )
        );
      }
      const categoryIdFor = (row) => {
        if (row.categoryId) return row.categoryId;
        if (!row.categoryName) return null;
        return categoryMap.get(row.categoryName.trim().toLowerCase())?.id ?? null;
      };
      const productValues = readyRows.map((row) => ({
        id: productIds.get(row.rowNumber),
        name: row.name,
        genericName: row.genericName,
        brandName: row.brandName,
        sku: row.sku,
        barcode: row.barcode,
        categoryId: categoryIdFor(row),
        dosageForm: row.dosageForm,
        strength: row.strength,
        unit: row.unit,
        packSize: row.packSize,
        manufacturer: row.manufacturer,
        description: row.description,
        prescriptionRequired: row.prescriptionRequired,
        reorderLevel: row.reorderLevel,
        sellingPrice: (row.sellingPrice ?? 0).toFixed(2),
        wholesalePrice: row.wholesalePrice === null ? null : row.wholesalePrice.toFixed(2),
        isActive: true
      }));
      for (const part of chunk(productValues, INSERT_CHUNK_SIZE)) {
        await tx.insert(schema_exports.products).values(part);
      }
      const batchValues = stockRows.map((row) => ({
        id: batchIds.get(row.rowNumber),
        productId: productIds.get(row.rowNumber),
        batchNumber: row.batchNumber,
        supplierId: row.supplierId,
        initialQuantity: row.initialQuantity,
        currentQuantity: row.initialQuantity,
        costPrice: (row.costPrice ?? 0).toFixed(2),
        sellingPrice: (row.sellingPrice ?? 0).toFixed(2),
        manufacturingDate: row.manufacturingDate,
        expiryDate: row.expiryDate,
        status: "ACTIVE",
        notes: row.stockNotes || "Opening stock imported from Excel"
      }));
      for (const part of chunk(batchValues, INSERT_CHUNK_SIZE)) {
        await tx.insert(schema_exports.batches).values(part);
      }
      const movementValues = stockRows.map((row) => ({
        id: randomUUID(),
        productId: productIds.get(row.rowNumber),
        batchId: batchIds.get(row.rowNumber),
        movementType: "INITIAL_STOCK",
        quantityChange: row.initialQuantity,
        previousQuantity: 0,
        newQuantity: row.initialQuantity,
        referenceId: row.purchaseReference || `IMPORT-${row.batchNumber}`,
        reason: "Initial opening stock from Excel product import",
        userId: user.id
      }));
      for (const part of chunk(movementValues, INSERT_CHUNK_SIZE)) {
        await tx.insert(schema_exports.stockMovements).values(part);
      }
      const auditValues = [];
      for (const row of readyRows) {
        auditValues.push({
          userId: user.id,
          action: "PRODUCT_CREATED",
          entityType: "PRODUCT",
          entityId: productIds.get(row.rowNumber),
          details: { name: row.name, sku: row.sku, barcode: row.barcode, source: "EXCEL_IMPORT" },
          ipAddress: ipAddress ?? null
        });
      }
      for (const row of stockRows) {
        auditValues.push({
          userId: user.id,
          action: "INITIAL_STOCK_ADDED",
          entityType: "BATCH",
          entityId: batchIds.get(row.rowNumber),
          details: {
            productId: productIds.get(row.rowNumber),
            productName: row.name,
            batchNumber: row.batchNumber,
            quantity: row.initialQuantity,
            costPrice: row.costPrice ?? 0,
            sellingPrice: row.sellingPrice ?? 0,
            expiryDate: row.expiryDate,
            source: "EXCEL_IMPORT"
          },
          ipAddress: ipAddress ?? null
        });
      }
      auditValues.push({
        userId: user.id,
        action: "PRODUCT_EXCEL_IMPORT",
        entityType: "PRODUCT_IMPORT",
        entityId: null,
        details: {
          fileName,
          sheet: workbook.sheetName,
          rows: summary.totalRows,
          imported: readyRows.length,
          duplicates: summary.duplicateCount,
          invalid: summary.invalidCount,
          productsCreated: readyRows.length,
          batchesCreated: stockRows.length,
          movementsCreated: stockRows.length
        },
        ipAddress: ipAddress ?? null
      });
      for (const part of chunk(auditValues, INSERT_CHUNK_SIZE)) {
        await tx.insert(schema_exports.auditLogs).values(part);
      }
      const [historyRow] = await tx.insert(schema_exports.productImports).values({
        fileName,
        uploadedBy: user.id,
        mode: "ADD_NEW",
        totalRows: summary.totalRows,
        importedRows: readyRows.length,
        duplicateRows: summary.duplicateCount,
        failedRows: summary.invalidCount,
        stockRows: stockRows.length,
        batchesCreated: stockRows.length,
        movementsCreated: stockRows.length,
        categoriesCreated,
        status: "COMPLETED",
        errorMessage: null,
        completedAt: /* @__PURE__ */ new Date()
      }).returning();
      return { historyRow };
    });
    await broadcastRealtimeEvent("PRODUCT_CREATED", {
      source: "EXCEL_IMPORT",
      importId: result.historyRow.id,
      count: readyRows.length,
      fileName,
      createdBy: user.id
    });
    await broadcastRealtimeEvent("STOCK_UPDATED", {
      source: "EXCEL_IMPORT",
      importId: result.historyRow.id,
      batches: stockRows.length,
      action: "EXCEL_IMPORT"
    });
    return {
      importId: result.historyRow.id,
      fileName,
      mode: "ADD_NEW",
      totalRows: summary.totalRows,
      imported: readyRows.length,
      duplicates: summary.duplicateCount,
      invalid: summary.invalidCount,
      productsCreated: readyRows.length,
      batchesCreated: stockRows.length,
      movementsCreated: stockRows.length,
      categoriesCreated,
      withStock: stockRows.length,
      withoutStock: readyRows.length - stockRows.length,
      completedAt: result.historyRow.completedAt ? new Date(result.historyRow.completedAt).toISOString() : (/* @__PURE__ */ new Date()).toISOString()
    };
  } catch (err) {
    const message = friendlyDbError(err);
    try {
      await db.insert(schema_exports.productImports).values({
        fileName,
        uploadedBy: user.id,
        mode: "ADD_NEW",
        totalRows: summary.totalRows,
        importedRows: 0,
        duplicateRows: summary.duplicateCount,
        failedRows: summary.invalidCount,
        stockRows: 0,
        batchesCreated: 0,
        movementsCreated: 0,
        categoriesCreated: 0,
        status: "FAILED",
        errorMessage: message.slice(0, 1e3),
        completedAt: /* @__PURE__ */ new Date()
      });
    } catch (historyErr) {
      console.error("[Product Import] Could not record failed import:", historyErr);
    }
    console.error("[Product Import] Transaction rolled back:", err);
    if (err instanceof ImportError) throw err;
    throw new ImportError(message, isUniqueViolation(err) ? "DB_CONFLICT" : "INVALID_FILE");
  }
}
async function getImportHistory(limit = 25) {
  const db = getDb();
  if (!db) throw new ImportError("Database not connected.", "INVALID_FILE");
  const list = await db.select({
    id: schema_exports.productImports.id,
    fileName: schema_exports.productImports.fileName,
    mode: schema_exports.productImports.mode,
    uploadedBy: schema_exports.productImports.uploadedBy,
    uploadedByName: schema_exports.users.fullName,
    totalRows: schema_exports.productImports.totalRows,
    importedRows: schema_exports.productImports.importedRows,
    duplicateRows: schema_exports.productImports.duplicateRows,
    failedRows: schema_exports.productImports.failedRows,
    stockRows: schema_exports.productImports.stockRows,
    batchesCreated: schema_exports.productImports.batchesCreated,
    movementsCreated: schema_exports.productImports.movementsCreated,
    categoriesCreated: schema_exports.productImports.categoriesCreated,
    status: schema_exports.productImports.status,
    errorMessage: schema_exports.productImports.errorMessage,
    createdAt: schema_exports.productImports.createdAt,
    completedAt: schema_exports.productImports.completedAt
  }).from(schema_exports.productImports).leftJoin(schema_exports.users, eq3(schema_exports.productImports.uploadedBy, schema_exports.users.id)).orderBy(desc(schema_exports.productImports.createdAt)).limit(Math.min(Math.max(limit, 1), 100));
  return list.map((item) => ({
    ...item,
    createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : String(item.createdAt),
    completedAt: item.completedAt ? item.completedAt instanceof Date ? item.completedAt.toISOString() : String(item.completedAt) : null
  }));
}

// src/server/import/template.ts
import * as XLSX2 from "xlsx";
var TEMPLATE_FILE_NAME = "Empress-Oris-Product-Import-Template.xlsx";
var PRODUCT_HEADERS = COLUMNS.map((c) => c.label);
var INSTRUCTIONS = [
  ["Empress Oris Herbal & Mart - Excel Product Import", ""],
  ["", ""],
  ["HOW TO USE", ""],
  ["1.", "Enter your products on the 'Products' sheet, one product per row, starting directly under the header row."],
  ["2.", "Do not rename, reorder or remove the header cells - required headers must remain present."],
  ["3.", "Save the file and upload it with 'Import Products' in the Product Catalog."],
  ["4.", "Review the import preview carefully, then confirm. Nothing is saved before you confirm."],
  ["", ""],
  ["REQUIRED COLUMNS", ""],
  ...COLUMNS.filter((c) => c.required).map((c) => [c.label, c.hint]),
  ["", ""],
  ["OPTIONAL COLUMNS", ""],
  ...COLUMNS.filter((c) => !c.required).map((c) => [c.label, c.hint]),
  ["", ""],
  ["VALUE RULES", ""],
  ["Prices", "Plain numbers in Ghana Cedis (GH\u20B5). Example: 10.50 - NOT 'GHS 10.50', '10,50' or negative values."],
  ["Dates", "DD/MM/YYYY (Ghana convention) or YYYY-MM-DD. Excel date cells are also accepted."],
  ["Booleans", "Prescription Required accepts: Yes, No, TRUE, FALSE, 1, 0."],
  ["SKU", "Must be unique. Leave blank to have a unique SKU generated automatically."],
  ["Barcode", "Optional, but must be unique when supplied."],
  ["Initial Stock", "When Initial Quantity > 0 a Batch Number and Expiry Date are required (batch/FEFO tracking)."],
  ["Initial Quantity", "0 or blank = product imported without stock (add stock later via Add Stock)."],
  ["Category", "Enter an existing category name or a new one - new categories are created automatically."],
  ["Supplier", "Must match an existing supplier name to be linked; otherwise the batch imports without a supplier."],
  ["Images", "Product images are not imported from Excel - upload them afterwards (Supabase Storage)."],
  ["Limits", "Maximum 5 MB file, up to 5,000 product rows per import. .xlsx and .xls are supported."],
  ["Currency", "All prices are interpreted as Ghana Cedi (GH\u20B5 / GHS) amounts. No conversion is applied."]
];
function autosizeWidths(rows, min = 12, max = 60) {
  return rows[0].map((_, columnIndex) => {
    const width = rows.reduce((widest, row) => {
      const cell = row[columnIndex];
      const length = cell === null || cell === void 0 ? 0 : String(cell).length;
      return Math.max(widest, length);
    }, min);
    return { wch: Math.min(max, width + 2) };
  });
}
function buildTemplateBuffer() {
  const workbook = XLSX2.utils.book_new();
  const productsSheet = XLSX2.utils.aoa_to_sheet([PRODUCT_HEADERS]);
  productsSheet["!cols"] = autosizeWidths([PRODUCT_HEADERS], 16, 34);
  XLSX2.utils.book_append_sheet(workbook, productsSheet, "Products");
  const instructionsSheet = XLSX2.utils.aoa_to_sheet(INSTRUCTIONS);
  instructionsSheet["!cols"] = [{ wch: 44 }, { wch: 110 }];
  XLSX2.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");
  const example = [PRODUCT_HEADERS];
  example.push([
    "Paracetamol 500mg",
    // Product Name *
    "Paracetamol",
    // Generic Name
    "Panadol",
    // Brand
    "PARA500",
    // SKU
    "123456789012",
    // Barcode
    "Analgesics",
    // Category
    "Tablet",
    // Dosage Form
    "500mg",
    // Strength
    "Pack",
    // Unit
    12,
    // Pack Size
    "Ernest Chemist",
    // Manufacturer
    "Pain relief tablet",
    // Description
    "No",
    // Prescription Required
    10,
    // Reorder Level
    10,
    // Selling Price (GH\u20B5) *
    8.5,
    // Wholesale Price (GH\u20B5)
    100,
    // Initial Quantity
    "B001",
    // Batch Number
    7,
    // Cost Price (GH\u20B5)
    "01/05/2026",
    // Manufacturing Date
    "30/05/2028",
    // Expiry Date
    "Ernest Chemist Ltd",
    // Supplier
    "INV-2026-001",
    // Purchase Reference
    "Opening stock"
    // Stock Notes
  ]);
  const exampleSheet = XLSX2.utils.aoa_to_sheet(example);
  exampleSheet["!cols"] = autosizeWidths(example, 16, 30);
  XLSX2.utils.book_append_sheet(workbook, exampleSheet, "Example");
  return XLSX2.write(workbook, { type: "buffer", bookType: "xlsx" });
}
function templateFileName() {
  return TEMPLATE_FILE_NAME;
}
function buildErrorReportBuffer(entries) {
  const rows = [["Row", "Product Name", "Error Type", "Error Message"]];
  for (const entry of entries) {
    rows.push([
      entry.rowNumber,
      entry.productName ?? "",
      entry.errorType,
      entry.message
    ]);
  }
  const sheet = XLSX2.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [{ wch: 8 }, { wch: 40 }, { wch: 14 }, { wch: 110 }];
  const workbook = XLSX2.utils.book_new();
  XLSX2.utils.book_append_sheet(workbook, sheet, "Import Errors");
  return XLSX2.write(workbook, { type: "buffer", bookType: "xlsx" });
}
function errorReportFileName() {
  const stamp = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `Product-Import-Errors-${stamp}.xlsx`;
}

// src/server/routes/import.ts
var importRouter = Router2();
var ALLOWED_EXTENSIONS2 = [".xlsx", ".xls"];
var excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (req, file, cb) => {
    const name = String(file.originalname || "").toLowerCase();
    const extension = name.slice(name.lastIndexOf("."));
    const mimeOk = !file.mimetype || [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/octet-stream",
      "application/binary",
      "application/x-ole-storage",
      "application/x-ole-object"
    ].includes(file.mimetype.toLowerCase());
    cb(null, ALLOWED_EXTENSIONS2.includes(extension) && mimeOk);
  }
});
function toUploadedFile(file) {
  return {
    buffer: file.buffer,
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  };
}
function sendImportError(res, err, context) {
  if (err instanceof ImportError) {
    const status = err.code === "DB_CONFLICT" ? 409 : err.code === "TOO_MANY_ROWS" ? 413 : 400;
    return res.status(status).json({ error: err.message, code: err.code });
  }
  console.error(`[Product Import] ${context} failed:`, err);
  return res.status(500).json({
    error: "The import failed unexpectedly. No changes were saved. Please try again."
  });
}
function requireDatabase(res) {
  if (!getDb()) {
    res.status(503).json({ error: "Database not connected." });
    return false;
  }
  return true;
}
importRouter.get(
  "/template",
  requireAuthentication,
  requireRole(["OWNER", "ADMIN"]),
  (req, res) => {
    try {
      const buffer = buildTemplateBuffer();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${templateFileName()}"`);
      res.setHeader("Content-Length", buffer.length);
      return res.end(buffer);
    } catch (err) {
      return sendImportError(res, err, "Template generation");
    }
  }
);
importRouter.post(
  "/preview",
  requireAuthentication,
  requireRole(["OWNER", "ADMIN"]),
  excelUpload.single("file"),
  async (req, res) => {
    if (!requireDatabase(res)) return;
    if (!req.file) {
      return res.status(400).json({
        error: "A valid Excel file is required (.xlsx or .xls, maximum 5 MB)."
      });
    }
    try {
      const result = await previewImport(toUploadedFile(req.file), req.user);
      return res.json(result);
    } catch (err) {
      return sendImportError(res, err, "Preview");
    }
  }
);
importRouter.post(
  "/confirm",
  requireAuthentication,
  requireRole(["OWNER", "ADMIN"]),
  excelUpload.single("file"),
  async (req, res) => {
    if (!requireDatabase(res)) return;
    if (!req.file) {
      return res.status(400).json({
        error: "A valid Excel file is required (.xlsx or .xls, maximum 5 MB)."
      });
    }
    try {
      const result = await confirmImport(
        toUploadedFile(req.file),
        req.user,
        req.body?.mode || "ADD_NEW",
        req.ip
      );
      return res.status(201).json({ success: true, result });
    } catch (err) {
      return sendImportError(res, err, "Confirm");
    }
  }
);
var errorReportSchema = z2.object({
  entries: z2.array(
    z2.object({
      rowNumber: z2.number().int().min(1),
      productName: z2.string().max(300).nullable(),
      errorType: z2.string().max(60),
      message: z2.string().max(1e3)
    })
  ).min(1).max(6e3)
});
importRouter.post(
  "/error-report",
  requireAuthentication,
  requireRole(["OWNER", "ADMIN"]),
  (req, res) => {
    try {
      const parsed = errorReportSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid error report payload." });
      }
      const buffer = buildErrorReportBuffer(parsed.data.entries);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${errorReportFileName()}"`);
      res.setHeader("Content-Length", buffer.length);
      return res.end(buffer);
    } catch (err) {
      return sendImportError(res, err, "Error report");
    }
  }
);
importRouter.get(
  "/history",
  requireAuthentication,
  requireRole(["OWNER", "ADMIN"]),
  async (req, res) => {
    if (!requireDatabase(res)) return;
    try {
      const history = await getImportHistory();
      return res.json({ history });
    } catch (err) {
      return sendImportError(res, err, "History");
    }
  }
);

// src/server/routes/products.ts
import { Router as Router3 } from "express";
import multer2 from "multer";
import { eq as eq4 } from "drizzle-orm";
var productsRouter = Router3();
var upload = multer2({
  storage: multer2.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  // 5MB
  fileFilter: (req, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and WEBP image files are allowed."));
    }
  }
});
productsRouter.post(
  "/upload-image",
  requireAuthentication,
  requireRole(["OWNER", "ADMIN"]),
  upload.single("image"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided." });
    }
    try {
      const ext = req.file.mimetype.split("/")[1] || "webp";
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`;
      const storagePath = `products/${fileName}`;
      const publicUrl = await uploadImageToStorage(
        "product-images",
        storagePath,
        req.file.buffer,
        req.file.mimetype
      );
      if (!publicUrl) {
        return res.status(500).json({ error: "Failed to upload image to Supabase Storage." });
      }
      return res.json({
        success: true,
        url: publicUrl,
        storagePath
      });
    } catch (err) {
      console.error("[Image Upload] Error:", err);
      return res.status(500).json({ error: err.message || "Failed to upload image." });
    }
  }
);
productsRouter.get("/", requireAuthentication, async (req, res) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: "Database not connected." });
  try {
    const { search, categoryId, lowStock, activeOnly = "true" } = req.query;
    const rawSql = getRawSql();
    if (!rawSql) {
      return res.status(503).json({ error: "PostgreSQL client not ready." });
    }
    const query = `
      SELECT 
        p.*,
        c.name as category_name,
        COALESCE(SUM(CASE WHEN b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE THEN b.current_quantity ELSE 0 END), 0)::integer as total_stock,
        COALESCE(SUM(CASE WHEN b.current_quantity > 0 AND b.expiry_date < CURRENT_DATE THEN b.current_quantity ELSE 0 END), 0)::integer as expired_stock,
        COUNT(b.id)::integer as batch_count,
        COALESCE(
          json_agg(
            json_build_object(
              'id', b.id,
              'batch_number', b.batch_number,
              'current_quantity', b.current_quantity,
              'initial_quantity', b.initial_quantity,
              'cost_price', b.cost_price,
              'selling_price', b.selling_price,
              'expiry_date', b.expiry_date,
              'status', b.status,
              'is_expired', (b.expiry_date < CURRENT_DATE)
            ) ORDER BY b.expiry_date ASC
          ) FILTER (WHERE b.id IS NOT NULL),
          '[]'::json
        ) as batches
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN batches b ON p.id = b.product_id
      WHERE 1=1
      ${activeOnly === "true" ? "AND p.is_active = true" : ""}
      ${categoryId ? `AND p.category_id = '${categoryId}'` : ""}
      ${search ? `AND (
              p.name ILIKE '%${search}%' OR 
              p.generic_name ILIKE '%${search}%' OR 
              p.brand_name ILIKE '%${search}%' OR 
              p.sku ILIKE '%${search}%' OR 
              p.barcode ILIKE '%${search}%'
            )` : ""}
      GROUP BY p.id, c.name
      ${lowStock === "true" ? "HAVING COALESCE(SUM(CASE WHEN b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE THEN b.current_quantity ELSE 0 END), 0) <= p.reorder_level" : ""}
      ORDER BY ${search ? `CASE WHEN p.name ILIKE '${String(search).replace(/'/g, "''")}%' THEN 0 ELSE 1 END, p.name ASC` : "p.name ASC"}
    `;
    const result = await rawSql.unsafe(query);
    return res.json({ products: result });
  } catch (err) {
    console.error("[Get Products] Error:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch products" });
  }
});
productsRouter.get("/:id", requireAuthentication, async (req, res) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: "Database not connected." });
  try {
    const rawSql = getRawSql();
    if (!rawSql) return res.status(503).json({ error: "PostgreSQL client not ready." });
    const [product] = await rawSql.unsafe(`
      SELECT 
        p.*,
        c.name as category_name,
        COALESCE(SUM(CASE WHEN b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE THEN b.current_quantity ELSE 0 END), 0)::integer as total_stock,
        COALESCE(SUM(CASE WHEN b.current_quantity > 0 AND b.expiry_date < CURRENT_DATE THEN b.current_quantity ELSE 0 END), 0)::integer as expired_stock
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN batches b ON p.id = b.product_id
      WHERE p.id = '${req.params.id}'
      GROUP BY p.id, c.name
    `);
    if (!product) {
      return res.status(404).json({ error: "Product not found." });
    }
    const batches2 = await rawSql.unsafe(`
      SELECT b.*, s.name as supplier_name
      FROM batches b
      LEFT JOIN suppliers s ON b.supplier_id = s.id
      WHERE b.product_id = '${req.params.id}'
      ORDER BY b.expiry_date ASC
    `);
    const movements = await rawSql.unsafe(`
      SELECT sm.*, b.batch_number, u.full_name as user_name
      FROM stock_movements sm
      LEFT JOIN batches b ON sm.batch_id = b.id
      LEFT JOIN users u ON sm.user_id = u.id
      WHERE sm.product_id = '${req.params.id}'
      ORDER BY sm.created_at DESC
      LIMIT 50
    `);
    return res.json({
      product,
      batches: batches2,
      movements
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch product details" });
  }
});
productsRouter.post(
  "/",
  requireAuthentication,
  requireRole(["OWNER", "ADMIN"]),
  async (req, res) => {
    const db = getDb();
    const rawSql = getRawSql();
    if (!db || !rawSql) {
      return res.status(503).json({ error: "Database not connected." });
    }
    const {
      name,
      genericName,
      brandName,
      sku,
      barcode,
      categoryId,
      dosageForm,
      strength,
      unit,
      packSize,
      manufacturer,
      description,
      prescriptionRequired,
      imageUrl,
      reorderLevel,
      sellingPrice,
      wholesalePrice,
      // Initial Stock Section
      hasInitialStock,
      initialQuantity,
      batchNumber,
      costPrice,
      batchSellingPrice,
      expiryDate,
      supplierId,
      manufacturingDate,
      purchaseReference,
      stockNotes
    } = req.body;
    if (!name || !sku) {
      return res.status(400).json({ error: "Product Name and SKU are required." });
    }
    if (hasInitialStock) {
      if (!initialQuantity || initialQuantity <= 0) {
        return res.status(400).json({ error: "Initial quantity must be greater than 0 when adding initial stock." });
      }
      if (!batchNumber) {
        return res.status(400).json({ error: "Batch number is required for initial stock." });
      }
      if (!expiryDate) {
        return res.status(400).json({ error: "Expiry date is required for initial stock." });
      }
    }
    try {
      const [existingSku] = await db.select().from(schema_exports.products).where(eq4(schema_exports.products.sku, sku)).limit(1);
      if (existingSku) {
        return res.status(400).json({ error: `A product with SKU '${sku}' already exists.` });
      }
      if (barcode) {
        const [existingBarcode] = await db.select().from(schema_exports.products).where(eq4(schema_exports.products.barcode, barcode)).limit(1);
        if (existingBarcode) {
          return res.status(400).json({ error: `A product with Barcode '${barcode}' already exists.` });
        }
      }
      const result = await rawSql.begin(async (tx) => {
        const [createdProduct] = await tx`
          INSERT INTO products (
            name, generic_name, brand_name, sku, barcode, category_id,
            dosage_form, strength, unit, pack_size, manufacturer, description,
            prescription_required, image_url, reorder_level, selling_price, wholesale_price
          ) VALUES (
            ${name}, ${genericName || null}, ${brandName || null}, ${sku}, ${barcode || null},
            ${categoryId || null}, ${dosageForm || null}, ${strength || null}, ${unit || "Pack"},
            ${packSize ? parseInt(packSize) : 1}, ${manufacturer || null}, ${description || null},
            ${prescriptionRequired ? true : false}, ${imageUrl || null},
            ${reorderLevel ? parseInt(reorderLevel) : 10},
            ${sellingPrice ? parseFloat(sellingPrice) : 0},
            ${wholesalePrice ? parseFloat(wholesalePrice) : null}
          )
          RETURNING *
        `;
        if (imageUrl) {
          await tx`
            INSERT INTO product_images (product_id, storage_path, url, is_primary)
            VALUES (${createdProduct.id}, ${imageUrl}, ${imageUrl}, true)
          `;
        }
        let createdBatch = null;
        let createdMovement = null;
        if (hasInitialStock && initialQuantity > 0) {
          const qty = parseInt(initialQuantity);
          const cost = costPrice ? parseFloat(costPrice) : 0;
          const sell = batchSellingPrice ? parseFloat(batchSellingPrice) : parseFloat(sellingPrice || "0.0");
          const [batch] = await tx`
            INSERT INTO batches (
              product_id, batch_number, supplier_id, initial_quantity, current_quantity,
              cost_price, selling_price, manufacturing_date, expiry_date, status, notes
            ) VALUES (
              ${createdProduct.id}, ${batchNumber}, ${supplierId || null}, ${qty}, ${qty},
              ${cost}, ${sell}, ${manufacturingDate || null}, ${expiryDate}, 'ACTIVE', ${stockNotes || "Opening stock"}
            )
            RETURNING *
          `;
          createdBatch = batch;
          const [movement] = await tx`
            INSERT INTO stock_movements (
              product_id, batch_id, movement_type, quantity_change, previous_quantity,
              new_quantity, reference_id, reason, user_id
            ) VALUES (
              ${createdProduct.id}, ${batch.id}, 'INITIAL_STOCK', ${qty}, 0,
              ${qty}, ${purchaseReference || `INIT-${batchNumber}`}, 'Initial opening stock upon product creation', ${req.user?.id || null}
            )
            RETURNING *
          `;
          createdMovement = movement;
          await tx`
            INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
            VALUES (
              ${req.user?.id || null}, 'INITIAL_STOCK_ADDED', 'BATCH', ${batch.id},
              ${JSON.stringify({
            productId: createdProduct.id,
            productName: name,
            batchNumber,
            quantity: qty,
            costPrice: cost,
            sellingPrice: sell,
            expiryDate
          })},
              ${req.ip || null}
            )
          `;
        }
        await tx`
          INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
          VALUES (
            ${req.user?.id || null}, 'PRODUCT_CREATED', 'PRODUCT', ${createdProduct.id},
            ${JSON.stringify({
          name,
          sku,
          barcode,
          hasInitialStock: !!hasInitialStock,
          initialQuantity: hasInitialStock ? initialQuantity : 0
        })},
            ${req.ip || null}
          )
        `;
        return {
          product: createdProduct,
          batch: createdBatch,
          movement: createdMovement
        };
      });
      await broadcastRealtimeEvent("PRODUCT_CREATED", {
        product: result.product,
        batch: result.batch
      });
      return res.status(201).json({
        success: true,
        message: result.batch ? `Product '${name}' created successfully with initial stock of ${result.batch.current_quantity} units (Batch: ${result.batch.batch_number}).` : `Product '${name}' created with 0 available stock.`,
        data: result
      });
    } catch (err) {
      console.error("[Create Product] Error:", err);
      return res.status(500).json({ error: err.message || "Failed to create product." });
    }
  }
);
productsRouter.put(
  "/:id",
  requireAuthentication,
  requireRole(["OWNER", "ADMIN"]),
  async (req, res) => {
    const db = getDb();
    if (!db) return res.status(503).json({ error: "Database not connected." });
    const {
      name,
      genericName,
      brandName,
      sku,
      barcode,
      categoryId,
      dosageForm,
      strength,
      unit,
      packSize,
      manufacturer,
      description,
      prescriptionRequired,
      imageUrl,
      reorderLevel,
      sellingPrice,
      wholesalePrice,
      isActive
    } = req.body;
    try {
      if (barcode !== void 0 && barcode) {
        const [existingBarcode] = await db.select().from(schema_exports.products).where(eq4(schema_exports.products.barcode, String(barcode).trim())).limit(1);
        if (existingBarcode && existingBarcode.id !== req.params.id) {
          return res.status(400).json({ error: `A product with Barcode '${barcode}' already exists.` });
        }
      }
      const updateData = { updatedAt: /* @__PURE__ */ new Date() };
      if (name !== void 0) updateData.name = name;
      if (genericName !== void 0) updateData.genericName = genericName;
      if (brandName !== void 0) updateData.brandName = brandName;
      if (sku !== void 0) updateData.sku = sku;
      if (barcode !== void 0) updateData.barcode = barcode ? String(barcode).trim() : null;
      if (categoryId !== void 0) updateData.categoryId = categoryId || null;
      if (dosageForm !== void 0) updateData.dosageForm = dosageForm;
      if (strength !== void 0) updateData.strength = strength;
      if (unit !== void 0) updateData.unit = unit;
      if (packSize !== void 0) updateData.packSize = packSize ? parseInt(packSize) : 1;
      if (manufacturer !== void 0) updateData.manufacturer = manufacturer;
      if (description !== void 0) updateData.description = description;
      if (prescriptionRequired !== void 0) updateData.prescriptionRequired = !!prescriptionRequired;
      if (imageUrl !== void 0) updateData.imageUrl = imageUrl;
      if (reorderLevel !== void 0) updateData.reorderLevel = reorderLevel ? parseInt(reorderLevel) : 10;
      if (sellingPrice !== void 0) updateData.sellingPrice = sellingPrice ? parseFloat(sellingPrice).toFixed(2) : "0.00";
      if (wholesalePrice !== void 0) updateData.wholesalePrice = wholesalePrice ? parseFloat(wholesalePrice).toFixed(2) : null;
      if (isActive !== void 0) updateData.isActive = !!isActive;
      const [updated] = await db.update(schema_exports.products).set(updateData).where(eq4(schema_exports.products.id, req.params.id)).returning();
      if (!updated) {
        return res.status(404).json({ error: "Product not found." });
      }
      await db.insert(schema_exports.auditLogs).values({
        userId: req.user?.id,
        action: "PRODUCT_UPDATED",
        entityType: "PRODUCT",
        entityId: updated.id,
        details: { name: updated.name, sku: updated.sku },
        ipAddress: req.ip
      });
      await broadcastRealtimeEvent("PRODUCT_UPDATED", { product: updated });
      return res.json({ success: true, product: updated });
    } catch (err) {
      return res.status(500).json({ error: err.message || "Failed to update product." });
    }
  }
);
async function updateProductPrice(req, res) {
  const db = getDb();
  if (!db) return res.status(503).json({ error: "Database not connected." });
  const { sellingPrice, wholesalePrice } = req.body || {};
  try {
    const updateData = { updatedAt: /* @__PURE__ */ new Date() };
    if (sellingPrice !== void 0) {
      updateData.sellingPrice = sellingPrice === null || sellingPrice === "" ? "0.00" : parseFloat(sellingPrice).toFixed(2);
    }
    if (wholesalePrice !== void 0) {
      updateData.wholesalePrice = wholesalePrice === null || wholesalePrice === "" ? null : parseFloat(wholesalePrice).toFixed(2);
    }
    const [updated] = await db.update(schema_exports.products).set(updateData).where(eq4(schema_exports.products.id, req.params.id)).returning();
    if (!updated) {
      return res.status(404).json({ error: "Product not found." });
    }
    await db.insert(schema_exports.auditLogs).values({
      userId: req.user?.id,
      action: "PRODUCT_PRICE_UPDATED",
      entityType: "PRODUCT",
      entityId: updated.id,
      details: { sellingPrice: updated.sellingPrice, wholesalePrice: updated.wholesalePrice },
      ipAddress: req.ip
    });
    await broadcastRealtimeEvent("PRODUCT_UPDATED", { product: updated });
    return res.json({ success: true, product: updated });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to update product price." });
  }
}
productsRouter.put("/:id/price", requireAuthentication, requireRole(["OWNER", "ADMIN"]), updateProductPrice);
productsRouter.patch("/:id/price", requireAuthentication, requireRole(["OWNER", "ADMIN"]), updateProductPrice);
productsRouter.post("/:id/price", requireAuthentication, requireRole(["OWNER", "ADMIN"]), updateProductPrice);
productsRouter.put("/:id/update-price", requireAuthentication, requireRole(["OWNER", "ADMIN"]), updateProductPrice);

// src/server/routes/stock.ts
import { Router as Router4 } from "express";
var stockRouter = Router4();
stockRouter.post(
  "/add",
  requireAuthentication,
  requireRole(["OWNER"]),
  async (req, res) => {
    const rawSql = getRawSql();
    if (!rawSql) return res.status(503).json({ error: "Database not connected." });
    const {
      productId,
      supplierId,
      quantity,
      batchNumber,
      costPrice,
      sellingPrice,
      manufacturingDate,
      expiryDate,
      purchaseReference,
      notes,
      existingBatchId
    } = req.body;
    if (!productId || !quantity || quantity <= 0) {
      return res.status(400).json({ error: "Product and valid quantity (> 0) are required." });
    }
    try {
      const result = await rawSql.begin(async (tx) => {
        const [product] = await tx`SELECT * FROM products WHERE id = ${productId}`;
        if (!product) {
          throw new Error("Product not found.");
        }
        let targetBatch = null;
        let prevQty = 0;
        let newQty = 0;
        if (existingBatchId) {
          const [existingBatch] = await tx`SELECT * FROM batches WHERE id = ${existingBatchId} FOR UPDATE`;
          if (!existingBatch) {
            throw new Error("Specified batch not found.");
          }
          prevQty = existingBatch.current_quantity;
          newQty = prevQty + parseInt(quantity);
          if (newQty < 0) {
            throw new Error(`Insufficient batch stock. Current quantity is ${prevQty}, cannot reduce by ${Math.abs(parseInt(quantity))}.`);
          }
          const [updatedBatch] = await tx`
            UPDATE batches 
            SET 
              current_quantity = ${newQty},
              cost_price = ${costPrice ? parseFloat(costPrice) : existingBatch.cost_price},
              selling_price = ${sellingPrice ? parseFloat(sellingPrice) : existingBatch.selling_price},
              updated_at = NOW()
            WHERE id = ${existingBatchId}
            RETURNING *
          `;
          targetBatch = updatedBatch;
          if (sellingPrice) {
            await tx`
              UPDATE products SET selling_price = ${parseFloat(sellingPrice)}, updated_at = NOW()
              WHERE id = ${productId}
            `;
          }
        } else {
          if (!batchNumber) {
            throw new Error("Batch number is required for a new batch.");
          }
          if (!expiryDate) {
            throw new Error("Expiry date is required for a new batch.");
          }
          const [duplicateBatch] = await tx`
            SELECT * FROM batches 
            WHERE product_id = ${productId} AND batch_number = ${batchNumber}
          `;
          if (duplicateBatch) {
            prevQty = duplicateBatch.current_quantity;
            newQty = prevQty + parseInt(quantity);
            if (newQty < 0) {
              throw new Error(`Insufficient batch stock. Current quantity is ${prevQty}, cannot reduce by ${Math.abs(parseInt(quantity))}.`);
            }
            const [updatedBatch] = await tx`
              UPDATE batches 
              SET current_quantity = ${newQty},
                  cost_price = ${costPrice ? parseFloat(costPrice) : duplicateBatch.cost_price},
                  selling_price = ${sellingPrice ? parseFloat(sellingPrice) : duplicateBatch.selling_price},
                  updated_at = NOW()
              WHERE id = ${duplicateBatch.id}
              RETURNING *
            `;
            targetBatch = updatedBatch;
            if (sellingPrice) {
              await tx`
                 UPDATE products SET selling_price = ${parseFloat(sellingPrice)}, updated_at = NOW()
                 WHERE id = ${productId}
               `;
            }
          } else {
            prevQty = 0;
            newQty = parseInt(quantity);
            const [newBatch] = await tx`
              INSERT INTO batches (
                product_id, batch_number, supplier_id, initial_quantity, current_quantity,
                cost_price, selling_price, manufacturing_date, expiry_date, status, notes
              ) VALUES (
                ${productId}, ${batchNumber}, ${supplierId || null}, ${newQty}, ${newQty},
                ${costPrice ? parseFloat(costPrice) : 0},
                ${sellingPrice ? parseFloat(sellingPrice) : parseFloat(product.selling_price || "0.0")},
                ${manufacturingDate || null}, ${expiryDate}, 'ACTIVE', ${notes || null}
              )
              RETURNING *
            `;
            targetBatch = newBatch;
            if (sellingPrice) {
              await tx`
                 UPDATE products SET selling_price = ${parseFloat(sellingPrice)}, updated_at = NOW()
                 WHERE id = ${productId}
               `;
            }
          }
        }
        const [movement] = await tx`
          INSERT INTO stock_movements (
            product_id, batch_id, movement_type, quantity_change, previous_quantity,
            new_quantity, reference_id, reason, user_id
          ) VALUES (
            ${productId}, ${targetBatch.id}, 'PURCHASE', ${parseInt(quantity)},
            ${prevQty}, ${newQty}, ${purchaseReference || `PO-${Date.now()}`},
            ${notes || "Stock replenishment"}, ${req.user?.id || null}
          )
          RETURNING *
        `;
        await tx`
          INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
          VALUES (
            ${req.user?.id || null}, 'STOCK_ADDED', 'BATCH', ${targetBatch.id},
            ${JSON.stringify({
          productName: product.name,
          batchNumber: targetBatch.batch_number,
          quantityAdded: parseInt(quantity),
          newQuantity: newQty
        })},
            ${req.ip || null}
          )
        `;
        return { product, batch: targetBatch, movement };
      });
      await broadcastRealtimeEvent("STOCK_UPDATED", {
        productId: result.product.id,
        batch: result.batch,
        action: "STOCK_ADDED"
      });
      return res.status(200).json({
        success: true,
        message: `Successfully added ${quantity} units to batch ${result.batch.batch_number}.`,
        data: result
      });
    } catch (err) {
      console.error("[Add Stock] Error:", err);
      return res.status(500).json({ error: err.message || "Failed to add stock." });
    }
  }
);
stockRouter.post(
  "/adjust",
  requireAuthentication,
  requireRole(["OWNER"]),
  async (req, res) => {
    const rawSql = getRawSql();
    if (!rawSql) return res.status(503).json({ error: "Database not connected." });
    const { batchId, quantityChange, movementType, reason } = req.body;
    if (!batchId || quantityChange === void 0 || !reason) {
      return res.status(400).json({ error: "Batch ID, quantity change, and reason are required." });
    }
    try {
      const result = await rawSql.begin(async (tx) => {
        const [batch] = await tx`SELECT * FROM batches WHERE id = ${batchId} FOR UPDATE`;
        if (!batch) throw new Error("Batch not found.");
        const prevQty = batch.current_quantity;
        const change = parseInt(quantityChange);
        const newQty = prevQty + change;
        if (newQty < 0) {
          throw new Error(`Insufficient batch stock. Current quantity is ${prevQty}, cannot deduct ${Math.abs(change)}.`);
        }
        const [updatedBatch] = await tx`
          UPDATE batches
          SET current_quantity = ${newQty}, updated_at = NOW()
          WHERE id = ${batchId}
          RETURNING *
        `;
        const [movement] = await tx`
          INSERT INTO stock_movements (
            product_id, batch_id, movement_type, quantity_change, previous_quantity,
            new_quantity, reason, user_id
          ) VALUES (
            ${batch.product_id}, ${batch.id}, ${movementType || "ADJUSTMENT"},
            ${change}, ${prevQty}, ${newQty}, ${reason}, ${req.user?.id || null}
          )
          RETURNING *
        `;
        await tx`
          INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
          VALUES (
            ${req.user?.id || null}, 'STOCK_ADJUSTED', 'BATCH', ${batch.id},
            ${JSON.stringify({
          batchNumber: batch.batch_number,
          change,
          previous: prevQty,
          new: newQty,
          reason
        })},
            ${req.ip || null}
          )
        `;
        return { batch: updatedBatch, movement };
      });
      await broadcastRealtimeEvent("STOCK_UPDATED", {
        productId: result.batch.product_id,
        batch: result.batch,
        action: "STOCK_ADJUSTED"
      });
      return res.json({ success: true, message: "Stock adjustment saved successfully.", data: result });
    } catch (err) {
      return res.status(500).json({ error: err.message || "Failed to adjust stock." });
    }
  }
);
stockRouter.get("/batches", requireAuthentication, async (req, res) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });
  try {
    const { filter } = req.query;
    const query = `
      SELECT 
        b.*,
        p.name as product_name,
        p.sku as product_sku,
        p.dosage_form,
        p.strength,
        s.name as supplier_name,
        (b.expiry_date < CURRENT_DATE) as is_expired,
        (b.expiry_date >= CURRENT_DATE AND b.expiry_date <= CURRENT_DATE + INTERVAL '90 days') as is_expiring_soon,
        (b.expiry_date - CURRENT_DATE)::integer as days_until_expiry
      FROM batches b
      JOIN products p ON b.product_id = p.id
      LEFT JOIN suppliers s ON b.supplier_id = s.id
      WHERE 1=1
      ${filter === "expiring_soon" ? "AND b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE AND b.expiry_date <= CURRENT_DATE + INTERVAL '90 days'" : ""}
      ${filter === "expired" ? "AND b.expiry_date < CURRENT_DATE" : ""}
      ${filter === "active" ? "AND b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE" : ""}
      ORDER BY b.expiry_date ASC
    `;
    const batches2 = await rawSql.unsafe(query);
    return res.json({ batches: batches2 });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch batches" });
  }
});
stockRouter.get("/movements", requireAuthentication, async (req, res) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });
  try {
    const { productId, movementType, limit = 100 } = req.query;
    const query = `
      SELECT 
        sm.*,
        p.name as product_name,
        p.sku as product_sku,
        b.batch_number,
        b.expiry_date,
        u.full_name as user_name
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      JOIN batches b ON sm.batch_id = b.id
      LEFT JOIN users u ON sm.user_id = u.id
      WHERE 1=1
      ${productId ? `AND sm.product_id = '${productId}'` : ""}
      ${movementType ? `AND sm.movement_type = '${movementType}'` : ""}
      ORDER BY sm.created_at DESC
      LIMIT ${parseInt(limit) || 100}
    `;
    const movements = await rawSql.unsafe(query);
    return res.json({ movements });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch movements" });
  }
});

// src/server/routes/pos.ts
import { Router as Router5 } from "express";
var posRouter = Router5();
posRouter.get("/search", requireAuthentication, async (req, res) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });
  const { query, barcode, categoryId } = req.query;
  try {
    let cleanCode = (barcode ? String(barcode) : "").trim();
    if (cleanCode.startsWith("{") && cleanCode.endsWith("}")) {
      try {
        const parsed = JSON.parse(cleanCode);
        cleanCode = String(parsed.barcode || parsed.sku || parsed.id || cleanCode).trim();
      } catch {
      }
    }
    if (cleanCode) {
      const products3 = await rawSql`
        SELECT 
          p.id,
          p.name,
          p.generic_name AS "genericName",
          p.brand_name AS "brandName",
          p.sku,
          p.barcode,
          p.dosage_form AS "dosageForm",
          p.strength,
          p.unit,
          p.pack_size AS "packSize",
          p.prescription_required AS "prescriptionRequired",
          p.image_url AS "imageUrl",
          p.selling_price AS "sellingPrice",
          p.reorder_level AS "reorderLevel",
          c.name AS "categoryName",
          COALESCE(SUM(CASE WHEN b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE THEN b.current_quantity ELSE 0 END), 0)::integer AS "totalStock",
          COALESCE(
            json_agg(
              json_build_object(
                'id', b.id,
                'batchNumber', b.batch_number,
                'currentQuantity', b.current_quantity,
                'expiryDate', b.expiry_date,
                'sellingPrice', b.selling_price
              ) ORDER BY b.expiry_date ASC
            ) FILTER (WHERE b.id IS NOT NULL AND b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE),
            '[]'::json
          ) AS "availableBatches"
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN batches b ON p.id = b.product_id
        WHERE p.is_active = true
        AND (
          p.barcode = ${cleanCode} 
          OR p.sku = ${cleanCode} 
          OR p.id::text = ${cleanCode}
          OR p.barcode ILIKE ${"%" + cleanCode + "%"}
          OR p.sku ILIKE ${"%" + cleanCode + "%"}
        )
        GROUP BY p.id, c.name
        ORDER BY (CASE WHEN p.barcode = ${cleanCode} OR p.sku = ${cleanCode} OR p.id::text = ${cleanCode} THEN 0 ELSE 1 END), p.name ASC
        LIMIT 10
      `;
      return res.json({ products: products3 });
    }
    const qStr = query ? `%${String(query).trim()}%` : null;
    const cat = categoryId ? String(categoryId) : null;
    const products2 = await rawSql`
      SELECT 
        p.id,
        p.name,
        p.generic_name AS "genericName",
        p.brand_name AS "brandName",
        p.sku,
        p.barcode,
        p.dosage_form AS "dosageForm",
        p.strength,
        p.unit,
        p.pack_size AS "packSize",
        p.prescription_required AS "prescriptionRequired",
        p.image_url AS "imageUrl",
        p.selling_price AS "sellingPrice",
        p.reorder_level AS "reorderLevel",
        c.name AS "categoryName",
        COALESCE(SUM(CASE WHEN b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE THEN b.current_quantity ELSE 0 END), 0)::integer AS "totalStock",
        COALESCE(
          json_agg(
            json_build_object(
              'id', b.id,
              'batchNumber', b.batch_number,
              'currentQuantity', b.current_quantity,
              'expiryDate', b.expiry_date,
              'sellingPrice', b.selling_price
            ) ORDER BY b.expiry_date ASC
          ) FILTER (WHERE b.id IS NOT NULL AND b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE),
          '[]'::json
        ) AS "availableBatches"
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN batches b ON p.id = b.product_id
      WHERE p.is_active = true
      ${qStr ? rawSql`AND (
        p.name ILIKE ${qStr} OR 
        p.generic_name ILIKE ${qStr} OR 
        p.brand_name ILIKE ${qStr} OR 
        p.sku ILIKE ${qStr} OR 
        p.barcode ILIKE ${qStr}
      )` : rawSql``}
      ${cat ? rawSql`AND p.category_id = ${cat}` : rawSql``}
      GROUP BY p.id, c.name
      ORDER BY ${qStr ? rawSql`CASE WHEN p.name ILIKE ${String(query).trim() + "%"} THEN 0 ELSE 1 END, p.name ASC` : rawSql`p.name ASC`}
      LIMIT 30
    `;
    return res.json({ products: products2 });
  } catch (err) {
    console.error("[POS Search] Error:", err);
    return res.status(500).json({ error: err.message || "Failed to search products" });
  }
});
posRouter.post("/checkout", requireAuthentication, async (req, res) => {
  const rawSql = getRawSql();
  const db = getDb();
  if (!rawSql || !db) return res.status(503).json({ error: "Database not connected." });
  const {
    items,
    // array of { productId, quantity, unitPrice, discount }
    customerName,
    customerPhone,
    paymentMethod,
    // 'CASH' | 'MTN_MOMO' | 'TELECEL_CASH' | 'AIRTELTIGO_MONEY' | 'CARD' | 'BANK_TRANSFER' | 'OTHER'
    amountReceived,
    transactionReference,
    discount = 0,
    notes,
    offlineSaleId
    // optional client-generated id for idempotent offline sync
  } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Cart is empty. At least one item is required." });
  }
  if (!paymentMethod) {
    return res.status(400).json({ error: "Payment method is required." });
  }
  if (offlineSaleId && paymentMethod !== "CASH") {
    return res.status(400).json({ error: "Offline sales are cash-only." });
  }
  try {
    const [activeShift] = await rawSql.unsafe(`
      SELECT * FROM cashier_shifts 
      WHERE cashier_id = '${req.user?.id}' AND status = 'OPEN'
      ORDER BY start_time DESC
      LIMIT 1
    `);
    if (!activeShift) {
      return res.status(400).json({
        error: "You do not have an active open cashier shift. Please open a shift before completing sales.",
        requiresShiftOpen: true
      });
    }
    const [pharmacy] = await db.select().from(schema_exports.pharmacySettings).limit(1);
    if (offlineSaleId) {
      const [existing] = await rawSql.unsafe(`SELECT * FROM sales WHERE receipt_number = '${offlineSaleId}' LIMIT 1`);
      if (existing) {
        return res.json({ success: true, receipt: existing, alreadySynced: true });
      }
    }
    const receiptNumber = offlineSaleId ? String(offlineSaleId) : `GH-REC-${Date.now().toString().slice(-6)}-${Math.floor(1e3 + Math.random() * 9e3)}`;
    const result = await rawSql.begin(async (tx) => {
      let subtotal = 0;
      let totalCostOfGoodsSold = 0;
      const processedItems = [];
      for (const item of items) {
        const reqQty = parseInt(item.quantity);
        if (!reqQty || reqQty <= 0) {
          throw new Error(`Invalid quantity for product ${item.productId}`);
        }
        const [prod] = await tx`
          SELECT * FROM products WHERE id = ${item.productId} AND is_active = true
        `;
        if (!prod) {
          throw new Error(`Product not found or inactive.`);
        }
        const unitPrice = item.unitPrice ? parseFloat(item.unitPrice) : parseFloat(prod.selling_price);
        const itemDiscount = item.discount ? parseFloat(item.discount) : 0;
        const lineTotal = unitPrice * reqQty - itemDiscount;
        subtotal += lineTotal;
        const availableBatches = await tx`
          SELECT * FROM batches 
          WHERE product_id = ${item.productId} 
            AND current_quantity > 0 
            AND expiry_date >= CURRENT_DATE
          ORDER BY expiry_date ASC
          FOR UPDATE
        `;
        const totalAvailable = availableBatches.reduce((acc, b) => acc + b.current_quantity, 0);
        if (totalAvailable < reqQty) {
          throw new Error(
            `Insufficient non-expired stock for "${prod.name}". Required: ${reqQty}, Available: ${totalAvailable}.`
          );
        }
        let remainingToAllocate = reqQty;
        const batchAllocations = [];
        let itemTotalCost = 0;
        for (const b of availableBatches) {
          if (remainingToAllocate <= 0) break;
          const qtyFromThisBatch = Math.min(remainingToAllocate, b.current_quantity);
          const newBatchQty = b.current_quantity - qtyFromThisBatch;
          await tx`
            UPDATE batches 
            SET current_quantity = ${newBatchQty}, updated_at = NOW()
            WHERE id = ${b.id}
          `;
          const unitCost = parseFloat(b.cost_price || "0.0");
          const batchCost = unitCost * qtyFromThisBatch;
          itemTotalCost += batchCost;
          totalCostOfGoodsSold += batchCost;
          console.log(`[POS COGS] Batch ${b.batch_number}: cost_price=GH\u20B5${unitCost}, qty=${qtyFromThisBatch}, batchCost=GH\u20B5${batchCost}`);
          batchAllocations.push({
            batchId: b.id,
            batchNumber: b.batch_number,
            expiryDate: b.expiry_date,
            quantity: qtyFromThisBatch,
            unitCost,
            previousQty: b.current_quantity,
            newQty: newBatchQty
          });
          remainingToAllocate -= qtyFromThisBatch;
        }
        processedItems.push({
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          quantity: reqQty,
          unitPrice,
          discount: itemDiscount,
          totalPrice: lineTotal,
          totalCost: itemTotalCost,
          batchAllocations
        });
      }
      const overallDiscount = discount ? parseFloat(discount) : 0;
      const totalAmount = Math.max(0, subtotal - overallDiscount);
      const amtRec = amountReceived ? parseFloat(amountReceived) : totalAmount;
      const changeGiven = paymentMethod === "CASH" ? Math.max(0, amtRec - totalAmount) : 0;
      const [sale] = await tx`
        INSERT INTO sales (
          receipt_number, cashier_id, shift_id, customer_name, customer_phone,
          subtotal, discount, tax, total_amount, total_cost, status
        ) VALUES (
          ${receiptNumber}, ${req.user?.id || null}, ${activeShift.id},
          ${customerName || null}, ${customerPhone || null},
          ${subtotal}, ${overallDiscount}, 0.00,
          ${totalAmount}, ${totalCostOfGoodsSold}, 'COMPLETED'
        )
        RETURNING *
      `;
      for (const item of processedItems) {
        const [saleItem] = await tx`
          INSERT INTO sale_items (
            sale_id, product_id, quantity, unit_price, discount, total_price,
            unit_cost, total_cost
          ) VALUES (
            ${sale.id}, ${item.productId}, ${item.quantity}, ${item.unitPrice},
            ${item.discount}, ${item.totalPrice}, ${item.totalCost / item.quantity}, ${item.totalCost}
          )
          RETURNING *
        `;
        for (const alloc of item.batchAllocations) {
          await tx`
            INSERT INTO sale_batches (sale_item_id, batch_id, quantity, unit_cost)
            VALUES (${saleItem.id}, ${alloc.batchId}, ${alloc.quantity}, ${alloc.unitCost})
          `;
          await tx`
            INSERT INTO stock_movements (
              product_id, batch_id, movement_type, quantity_change, previous_quantity,
              new_quantity, reference_id, reason, user_id
            ) VALUES (
              ${item.productId}, ${alloc.batchId}, 'SALE', ${-alloc.quantity},
              ${alloc.previousQty}, ${alloc.newQty}, ${receiptNumber},
              ${"POS Sale"}, ${req.user?.id || null}
            )
          `;
        }
      }
      const [payment] = await tx`
        INSERT INTO payments (
          sale_id, payment_method, amount, amount_received, change_given,
          transaction_reference, notes
        ) VALUES (
          ${sale.id}, ${paymentMethod}, ${totalAmount}, ${amtRec}, ${changeGiven},
          ${transactionReference || null}, ${notes || null}
        )
        RETURNING *
      `;
      await tx`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
        VALUES (
          ${req.user?.id || null}, 'SALE_COMPLETED', 'SALE', ${sale.id},
          ${JSON.stringify({
        receiptNumber,
        totalAmount,
        paymentMethod,
        itemsCount: processedItems.length
      })},
          ${req.ip || null}
        )
      `;
      return {
        sale,
        payment,
        items: processedItems,
        pharmacy
      };
    });
    void broadcastRealtimeEvent("SALE_COMPLETED", {
      saleId: result.sale.id,
      receiptNumber: result.sale.receipt_number,
      totalAmount: result.sale.total_amount,
      cashierId: req.user?.id
    }).catch(() => {
    });
    return res.status(201).json({
      success: true,
      message: "Sale completed successfully.",
      receipt: {
        pharmacyName: result.pharmacy?.name || "Empress Oris Herbal & Mart",
        pharmacyAddress: result.pharmacy?.address || "Accra, Ghana",
        pharmacyPhone: result.pharmacy?.phone || "",
        logoUrl: result.pharmacy?.logoUrl || null,
        receiptFooter: result.pharmacy?.receiptFooter || "Thank you for your patronage!",
        receiptNumber: result.sale.receipt_number,
        date: result.sale.created_at,
        cashierName: req.user?.fullName,
        customerName: result.sale.customer_name,
        customerPhone: result.sale.customer_phone,
        items: result.items,
        subtotal: result.sale.subtotal,
        discount: result.sale.discount,
        totalAmount: result.sale.total_amount,
        paymentMethod: result.payment.payment_method,
        amountReceived: result.payment.amount_received,
        changeGiven: result.payment.change_given,
        transactionReference: result.payment.transaction_reference
      }
    });
  } catch (err) {
    console.error("[POS Checkout] Error:", err);
    return res.status(400).json({ error: err.message || "Failed to process sale." });
  }
});

// src/server/routes/sales.ts
import { Router as Router6 } from "express";
var salesRouter = Router6();
salesRouter.get("/", requireAuthentication, async (req, res) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });
  try {
    const { startDate, endDate, cashierId, paymentMethod, receiptNumber } = req.query;
    const isOwner = req.user?.role === "OWNER";
    const employeeFilter = isOwner ? "" : `AND s.cashier_id = '${req.user?.id}'`;
    const query = `
      SELECT 
        s.*,
        u.full_name as cashier_name,
        p.payment_method,
        p.amount_received,
        p.change_given,
        p.transaction_reference,
        COUNT(si.id)::integer as item_count
      FROM sales s
      JOIN users u ON s.cashier_id = u.id
      LEFT JOIN payments p ON s.id = p.sale_id
      LEFT JOIN sale_items si ON s.id = si.sale_id
      WHERE 1=1
      ${employeeFilter}
      ${cashierId && isOwner ? `AND s.cashier_id = '${cashierId}'` : ""}
      ${receiptNumber ? `AND s.receipt_number ILIKE '%${receiptNumber}%'` : ""}
      ${paymentMethod ? `AND p.payment_method = '${paymentMethod}'` : ""}
      ${startDate ? `AND s.created_at >= '${startDate}'::timestamptz` : ""}
      ${endDate ? `AND s.created_at <= '${endDate} 23:59:59'::timestamptz` : ""}
      GROUP BY s.id, u.full_name, p.payment_method, p.amount_received, p.change_given, p.transaction_reference
      ORDER BY s.created_at DESC
      LIMIT 100
    `;
    const sales2 = await rawSql.unsafe(query);
    return res.json({ sales: sales2 });
  } catch (err) {
    console.error("[Get Sales] Error:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch sales" });
  }
});
salesRouter.get("/:id", requireAuthentication, async (req, res) => {
  const rawSql = getRawSql();
  const db = getDb();
  if (!rawSql || !db) return res.status(503).json({ error: "Database not connected." });
  try {
    const [sale] = await rawSql.unsafe(`
      SELECT 
        s.*,
        u.full_name as cashier_name,
        p.payment_method,
        p.amount_received,
        p.change_given,
        p.transaction_reference
      FROM sales s
      JOIN users u ON s.cashier_id = u.id
      LEFT JOIN payments p ON s.id = p.sale_id
      WHERE s.id = '${req.params.id}'
    `);
    if (!sale) return res.status(404).json({ error: "Sale not found." });
    const items = await rawSql.unsafe(`
      SELECT 
        si.*,
        p.name as product_name,
        p.sku as product_sku,
        p.dosage_form,
        p.strength,
        COALESCE(
          json_agg(
            json_build_object(
              'batch_id', sb.batch_id,
              'quantity', sb.quantity,
              'batch_number', b.batch_number,
              'expiry_date', b.expiry_date
            )
          ) FILTER (WHERE sb.batch_id IS NOT NULL),
          '[]'::json
        ) as batch_details
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      LEFT JOIN sale_batches sb ON si.id = sb.sale_item_id
      LEFT JOIN batches b ON sb.batch_id = b.id
      WHERE si.sale_id = '${req.params.id}'
      GROUP BY si.id, p.name, p.sku, p.dosage_form, p.strength
    `);
    const [pharmacy] = await db.select().from(schema_exports.pharmacySettings).limit(1);
    return res.json({
      sale,
      items,
      pharmacy: pharmacy || {
        name: "Empress Oris Herbal & Mart",
        address: "Accra, Ghana",
        currency: "GHS",
        currencySymbol: "GH\u20B5"
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch sale details" });
  }
});
salesRouter.post(
  "/refund",
  requireAuthentication,
  requireRole(["OWNER"]),
  async (req, res) => {
    const rawSql = getRawSql();
    if (!rawSql) return res.status(503).json({ error: "Database not connected." });
    const { saleId, items, reason } = req.body;
    if (!saleId || !items || !Array.isArray(items) || items.length === 0 || !reason) {
      return res.status(400).json({ error: "Sale ID, items, and reason are required." });
    }
    try {
      const refundNumber = `REF-${Date.now().toString().slice(-6)}`;
      const result = await rawSql.begin(async (tx) => {
        let totalRefund = 0;
        for (const it of items) {
          totalRefund += parseFloat(it.refundAmount);
        }
        const [refund] = await tx`
          INSERT INTO refunds (sale_id, refund_number, processed_by, total_refund_amount, reason)
          VALUES (${saleId}, ${refundNumber}, ${req.user?.id || null}, ${totalRefund}, ${reason})
          RETURNING *
        `;
        for (const item of items) {
          const [refItem] = await tx`
            INSERT INTO refund_items (
              refund_id, sale_item_id, product_id, batch_id, quantity, refund_amount, restock
            ) VALUES (
              ${refund.id}, ${item.saleItemId}, ${item.productId}, ${item.batchId || null},
              ${item.quantity}, ${item.refundAmount}, ${item.restock !== false}
            )
            RETURNING *
          `;
          if (item.restock !== false && item.batchId) {
            const [batch] = await tx`
              SELECT * FROM batches WHERE id = ${item.batchId} FOR UPDATE
            `;
            if (batch) {
              const prev = batch.current_quantity;
              const next = prev + parseInt(item.quantity);
              await tx`
                UPDATE batches SET current_quantity = ${next}, updated_at = NOW() WHERE id = ${batch.id}
              `;
              await tx`
                INSERT INTO stock_movements (
                  product_id, batch_id, movement_type, quantity_change, previous_quantity,
                  new_quantity, reference_id, reason, user_id
                ) VALUES (
                  ${item.productId}, ${batch.id}, 'REFUND', ${parseInt(item.quantity)},
                  ${prev}, ${next}, ${refundNumber}, ${reason}, ${req.user?.id || null}
                )
              `;
            }
          }
        }
        await tx`
          UPDATE sales SET status = 'REFUNDED' WHERE id = ${saleId}
        `;
        await tx`
          INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
          VALUES (
            ${req.user?.id || null}, 'REFUND_CREATED', 'REFUND', ${refund.id},
            ${JSON.stringify({ saleId, refundNumber, totalRefund, reason })},
            ${req.ip || null}
          )
        `;
        return refund;
      });
      await broadcastRealtimeEvent("REFUND_PROCESSED", {
        refundId: result.id,
        saleId
      });
      return res.status(201).json({ success: true, refund: result });
    } catch (err) {
      console.error("[Refund] Error:", err);
      return res.status(500).json({ error: err.message || "Failed to process refund." });
    }
  }
);
async function clearAllSales(req, res) {
  const rawSql = getRawSql();
  const db = getDb();
  if (!rawSql || !db) return res.status(503).json({ error: "Database not connected." });
  try {
    await rawSql.begin(async (tx) => {
      await tx`DELETE FROM sale_batches WHERE sale_item_id IN (SELECT id FROM sale_items)`;
      await tx`DELETE FROM refund_items WHERE refund_id IN (SELECT id FROM refunds)`;
      await tx`DELETE FROM refunds`;
      await tx`DELETE FROM payments WHERE sale_id IN (SELECT id FROM sales)`;
      await tx`DELETE FROM sale_items`;
      await tx`DELETE FROM sales`;
      await tx`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
        VALUES (
          ${req.user?.id || null}, 'SALES_CLEARED', 'SALE', NULL,
          ${JSON.stringify({ clearedBy: req.user?.id || null, clearedAt: (/* @__PURE__ */ new Date()).toISOString() })},
          ${req.ip || null}
        )
      `;
    });
    await broadcastRealtimeEvent("SALES_CLEARED", { clearedBy: req.user?.id || null });
    return res.json({ success: true, message: "All sales records cleared successfully." });
  } catch (err) {
    console.error("[Clear Sales] Error:", err);
    return res.status(500).json({ error: err.message || "Failed to clear sales." });
  }
}
salesRouter.delete("/", requireAuthentication, requireRole(["OWNER"]), clearAllSales);
salesRouter.delete("/clear", requireAuthentication, requireRole(["OWNER"]), clearAllSales);
salesRouter.post("/clear", requireAuthentication, requireRole(["OWNER"]), clearAllSales);
salesRouter.delete("/all", requireAuthentication, requireRole(["OWNER"]), clearAllSales);
salesRouter.post("/clear-all", requireAuthentication, requireRole(["OWNER"]), clearAllSales);

// src/server/routes/shifts.ts
import { Router as Router7 } from "express";
var shiftsRouter = Router7();
shiftsRouter.get("/current", requireAuthentication, async (req, res) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });
  try {
    const [activeShift] = await rawSql.unsafe(`
      SELECT s.*, u.full_name as cashier_name
      FROM cashier_shifts s
      JOIN users u ON s.cashier_id = u.id
      WHERE s.cashier_id = '${req.user?.id}' AND s.status = 'OPEN'
      ORDER BY s.start_time DESC
      LIMIT 1
    `);
    if (!activeShift) {
      return res.json({ hasOpenShift: false, shift: null });
    }
    const [salesSummary] = await rawSql.unsafe(`
      SELECT 
        COUNT(s.id)::integer as total_sales_count,
        COALESCE(SUM(s.total_amount), 0)::numeric(12,2) as total_sales_amount,
        COALESCE(SUM(CASE WHEN p.payment_method = 'CASH' THEN p.amount ELSE 0 END), 0)::numeric(12,2) as cash_sales,
        COALESCE(SUM(CASE WHEN p.payment_method = 'MTN_MOMO' THEN p.amount ELSE 0 END), 0)::numeric(12,2) as mtn_momo_sales,
        COALESCE(SUM(CASE WHEN p.payment_method = 'TELECEL_CASH' THEN p.amount ELSE 0 END), 0)::numeric(12,2) as telecel_sales,
        COALESCE(SUM(CASE WHEN p.payment_method = 'AIRTELTIGO_MONEY' THEN p.amount ELSE 0 END), 0)::numeric(12,2) as airteltigo_sales,
        COALESCE(SUM(CASE WHEN p.payment_method = 'CARD' THEN p.amount ELSE 0 END), 0)::numeric(12,2) as card_sales,
        COALESCE(SUM(CASE WHEN p.payment_method = 'BANK_TRANSFER' THEN p.amount ELSE 0 END), 0)::numeric(12,2) as bank_sales
      FROM sales s
      LEFT JOIN payments p ON s.id = p.sale_id
      WHERE s.shift_id = '${activeShift.id}' AND s.status = 'COMPLETED'
    `);
    const openingCash = parseFloat(activeShift.opening_cash || "0");
    const cashSales = parseFloat(salesSummary?.cash_sales || "0");
    const expectedCash = (openingCash + cashSales).toFixed(2);
    return res.json({
      hasOpenShift: true,
      shift: activeShift,
      summary: {
        ...salesSummary,
        openingCash,
        expectedCash
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch shift." });
  }
});
shiftsRouter.post("/open", requireAuthentication, async (req, res) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });
  const { openingCash = 0, notes } = req.body;
  try {
    const [existing] = await rawSql.unsafe(`
      SELECT id FROM cashier_shifts 
      WHERE cashier_id = '${req.user?.id}' AND status = 'OPEN'
    `);
    if (existing) {
      return res.status(400).json({ error: "You already have an open shift. Please close it first." });
    }
    const [shift] = await rawSql.unsafe(`
      INSERT INTO cashier_shifts (cashier_id, opening_cash, status, notes)
      VALUES ('${req.user?.id}', ${parseFloat(openingCash) || 0}, 'OPEN', ${notes ? `'${notes}'` : "NULL"})
      RETURNING *
    `);
    await rawSql.unsafe(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (
        '${req.user?.id}', 'SHIFT_OPENED', 'SHIFT', '${shift.id}',
        '${JSON.stringify({ openingCash })}'::jsonb
      )
    `);
    await broadcastRealtimeEvent("SHIFT_UPDATED", { cashierId: req.user?.id, status: "OPEN" });
    try {
      const [settings] = await rawSql.unsafe(`SELECT name, sms_notifications_enabled, sms_recipient_phone, phone FROM pharmacy_settings LIMIT 1`);
      const [cashier] = await rawSql.unsafe(`SELECT full_name FROM users WHERE id = '${req.user?.id}' LIMIT 1`);
      const recipient = settings?.sms_recipient_phone || settings?.phone;
      const cashierName = cashier?.full_name || "Cashier";
      const openingAmount = parseFloat(openingCash) || 0;
      const message = [
        "EMPRESS ORIS POS - SHIFT OPENED",
        "",
        `Cashier: ${cashierName}`,
        `Opening Cash: GH\u20B5${openingAmount.toFixed(2)}`,
        `Date: ${(/* @__PURE__ */ new Date()).toLocaleDateString("en-GB")}`,
        `Time: ${(/* @__PURE__ */ new Date()).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`,
        "",
        "Your cashier has started a new shift."
      ].join("\\n");
      const refId = `shift-sms-open-${shift.id}`;
      const [existing2] = await rawSql.unsafe(`SELECT id FROM sms_outbox WHERE reference_id = '${refId}' LIMIT 1`);
      if (!existing2) {
        const [outboxRow] = await rawSql.unsafe(`
          INSERT INTO sms_outbox (event_type, recipient, message, status, reference_id)
          VALUES ('SHIFT_OPENED', ${recipient ? `'${recipient}'` : "NULL"}, '${message.replace(/'/g, "''")}', 'PENDING', '${refId}')
          RETURNING id
        `);
        if (outboxRow?.id) {
          (async () => {
            try {
              if (!settings?.sms_notifications_enabled) {
                await rawSql.unsafe(`UPDATE sms_outbox SET status = 'SKIPPED', last_error = 'SMS disabled by owner' WHERE id = '${outboxRow.id}'`);
                return;
              }
              if (!recipient) {
                await rawSql.unsafe(`UPDATE sms_outbox SET status = 'FAILED', last_error = 'No recipient phone configured' WHERE id = '${outboxRow.id}'`);
                return;
              }
              const { sendSms: sendSms2 } = await Promise.resolve().then(() => (init_sasuSync(), sasuSync_exports));
              const result = await sendSms2(recipient, message, `shift:${shift.id}:opened`);
              if (result.success) {
                await rawSql.unsafe(`UPDATE sms_outbox SET status = 'SENT', attempts = attempts + 1, sent_at = NOW() WHERE id = '${outboxRow.id}'`);
              } else {
                await rawSql.unsafe(`UPDATE sms_outbox SET status = 'FAILED', attempts = attempts + 1, last_error = '${(result.error || "Unknown error").replace(/'/g, "''")}' WHERE id = '${outboxRow.id}'`);
              }
            } catch (e) {
              await rawSql.unsafe(`UPDATE sms_outbox SET status = 'FAILED', attempts = attempts + 1, last_error = '${(e?.message || "Unknown error").replace(/'/g, "''")}' WHERE id = '${outboxRow.id}'`);
            }
          })();
        }
      }
    } catch (smsErr) {
      console.error("[Shift SMS] Failed to queue opening SMS:", smsErr);
    }
    return res.status(201).json({ success: true, shift });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to open shift." });
  }
});
shiftsRouter.post("/close", requireAuthentication, async (req, res) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });
  const { actualCash, notes, shiftId } = req.body;
  if (actualCash === void 0) {
    return res.status(400).json({ error: "Actual cash count is required to close shift." });
  }
  try {
    const isOwner = req.user?.role === "OWNER" || req.user?.role === "ADMIN";
    let activeShift;
    if (isOwner && shiftId) {
      [activeShift] = await rawSql.unsafe(`
        SELECT * FROM cashier_shifts 
        WHERE id = '${shiftId}' AND status = 'OPEN'
        LIMIT 1
      `);
    } else {
      [activeShift] = await rawSql.unsafe(`
        SELECT * FROM cashier_shifts 
        WHERE cashier_id = '${req.user?.id}' AND status = 'OPEN'
        LIMIT 1
      `);
    }
    if (!activeShift) {
      return res.status(400).json({ error: "No open shift found to close." });
    }
    const [cashData] = await rawSql.unsafe(`
      SELECT COALESCE(SUM(p.amount), 0)::numeric(12,2) as total_cash_sales
      FROM sales s
      JOIN payments p ON s.id = p.sale_id
      WHERE s.shift_id = '${activeShift.id}' AND s.status = 'COMPLETED' AND p.payment_method = 'CASH'
    `);
    const openingCash = parseFloat(activeShift.opening_cash);
    const cashSales = parseFloat(cashData?.total_cash_sales || "0");
    const expectedCash = openingCash + cashSales;
    const actualCashNum = parseFloat(actualCash);
    const discrepancy = actualCashNum - expectedCash;
    const [closedShift] = await rawSql.unsafe(`
      UPDATE cashier_shifts
      SET 
        end_time = NOW(),
        status = 'CLOSED',
        expected_cash = ${expectedCash},
        actual_cash = ${actualCashNum},
        discrepancy = ${discrepancy},
        notes = ${notes ? `'${notes}'` : "notes"}
      WHERE id = '${activeShift.id}'
      RETURNING *
    `);
    if (Math.abs(discrepancy) > 0.01) {
      await rawSql.unsafe(`
        INSERT INTO notifications (title, message, type, reference_id)
        VALUES (
          'Shift Cash Discrepancy',
          'Cashier shift ended with a discrepancy of GH\u20B5 ${discrepancy.toFixed(2)} (Expected: GH\u20B5 ${expectedCash.toFixed(2)}, Actual: GH\u20B5 ${actualCashNum.toFixed(2)})',
          'SHIFT_DISCREPANCY',
          '${activeShift.id}'
        )
      `);
    }
    await rawSql.unsafe(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (
        '${req.user?.id}', 'SHIFT_CLOSED', 'SHIFT', '${activeShift.id}',
        '${JSON.stringify({ expectedCash, actualCash: actualCashNum, discrepancy })}'::jsonb
      )
    `);
    try {
      const [settings] = await rawSql.unsafe(`SELECT name, sms_notifications_enabled, sms_recipient_phone, phone FROM pharmacy_settings LIMIT 1`);
      const [cashier] = await rawSql.unsafe(`SELECT full_name FROM users WHERE id = '${activeShift.cashier_id}' LIMIT 1`);
      const pharmacyName = settings?.name || "Empress Oris Pharmacy";
      const cashierName = cashier?.full_name || "Cashier";
      const recipient = settings?.sms_recipient_phone || settings?.phone;
      const productRows = await rawSql.unsafe(`
        SELECT p.name as product_name,
               COALESCE(SUM(si.quantity), 0)::integer as qty_sold,
               COALESCE(SUM(si.total_price), 0)::numeric(12,2) as sales_value,
               COALESCE(SUM(si.quantity * si.unit_cost), 0)::numeric(12,2) as cogs
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        JOIN products p ON p.id = si.product_id
        WHERE s.shift_id = '${activeShift.id}' AND s.status = 'COMPLETED'
        GROUP BY p.name
        ORDER BY sales_value DESC
      `);
      const [totals] = await rawSql.unsafe(`
        SELECT COUNT(s.id)::integer as txn_count,
               COALESCE(SUM(s.total_amount), 0)::numeric(12,2) as total_revenue,
               COALESCE(SUM(s.discount), 0)::numeric(12,2) as total_discount
        FROM sales s
        WHERE s.shift_id = '${activeShift.id}' AND s.status = 'COMPLETED'
      `);
      const payments2 = await rawSql.unsafe(`
        SELECT pmt.payment_method, COALESCE(SUM(pmt.amount), 0)::numeric(12,2) as amount
        FROM payments pmt
        JOIN sales s ON s.id = pmt.sale_id
        WHERE s.shift_id = '${activeShift.id}' AND s.status = 'COMPLETED'
        GROUP BY pmt.payment_method
      `);
      const totalRevenue = parseFloat(totals?.total_revenue || "0");
      const totalDiscount = parseFloat(totals?.total_discount || "0");
      const totalCogs = productRows.reduce((sum, r) => sum + parseFloat(r.cogs || "0"), 0);
      const grossProfit = totalRevenue - totalCogs;
      const momoSales = payments2.filter((p) => /MOMO|TELECEL|AIRTELTIGO/i.test(String(p.payment_method))).reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0);
      const cashVarianceText = Math.abs(discrepancy) < 0.01 ? "Cash drawer balanced." : discrepancy < 0 ? "Cash Shortage: GH\u20B5${Math.abs(discrepancy).toFixed(2)}" : "Cash Excess: GH\u20B5${discrepancy.toFixed(2)}";
      const report = [
        "EMPRESS ORIS POS - SHIFT CLOSED",
        "",
        "Cashier: " + cashierName,
        "Date: " + (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB"),
        "",
        "SALES:",
        "Total Sales: GH\u20B5" + totalRevenue.toFixed(2),
        "Cash Sales: GH\u20B5" + cashSales.toFixed(2),
        "MoMo Sales: GH\u20B5" + momoSales.toFixed(2),
        "",
        "FINANCIAL SUMMARY:",
        "COGS: GH\u20B5" + totalCogs.toFixed(2),
        "Gross Profit: GH\u20B5" + grossProfit.toFixed(2),
        "",
        "CASH RECONCILIATION:",
        "Opening Cash: GH\u20B5" + openingCash.toFixed(2),
        "Expected Cash: GH\u20B5" + expectedCash.toFixed(2),
        "Actual Cash: GH\u20B5" + actualCashNum.toFixed(2),
        cashVarianceText
      ].join("\n");
      const refId = `shift-sms-${activeShift.id}`;
      const [existing] = await rawSql.unsafe(`SELECT id FROM sms_outbox WHERE reference_id = '${refId}' LIMIT 1`);
      if (!existing) {
        const [outboxRow] = await rawSql.unsafe(`
          INSERT INTO sms_outbox (event_type, recipient, message, status, reference_id)
          VALUES ('SHIFT_CLOSED', ${recipient ? `'${recipient}'` : "NULL"}, '${report.replace(/'/g, "''")}', 'PENDING', '${refId}')
          RETURNING id
        `);
        if (outboxRow?.id) {
          (async () => {
            try {
              if (!settings?.sms_notifications_enabled) {
                await rawSql.unsafe(`UPDATE sms_outbox SET status = 'SKIPPED', last_error = 'SMS disabled by owner' WHERE id = '${outboxRow.id}'`);
                return;
              }
              if (!recipient) {
                await rawSql.unsafe(`UPDATE sms_outbox SET status = 'FAILED', last_error = 'No recipient phone configured' WHERE id = '${outboxRow.id}'`);
                return;
              }
              const { sendSms: sendSms2 } = await Promise.resolve().then(() => (init_sasuSync(), sasuSync_exports));
              const result = await sendSms2(recipient, report, `shift:${activeShift.id}:closed`);
              if (result.success) {
                await rawSql.unsafe(`UPDATE sms_outbox SET status = 'SENT', attempts = attempts + 1, sent_at = NOW() WHERE id = '${outboxRow.id}'`);
              } else {
                await rawSql.unsafe(`UPDATE sms_outbox SET status = 'FAILED', attempts = attempts + 1, last_error = '${(result.error || "Unknown error").replace(/'/g, "''")}' WHERE id = '${outboxRow.id}'`);
              }
            } catch (e) {
              await rawSql.unsafe(`UPDATE sms_outbox SET status = 'FAILED', attempts = attempts + 1, last_error = '${(e?.message || "Unknown error").replace(/'/g, "''")}' WHERE id = '${outboxRow.id}'`);
            }
          })();
        }
      }
    } catch (smsErr) {
      console.error("[Shift SMS] Failed to queue SMS:", smsErr);
    }
    await broadcastRealtimeEvent("SHIFT_UPDATED", { cashierId: activeShift.cashier_id, status: "CLOSED" });
    return res.json({
      success: true,
      message: "Shift closed successfully.",
      shift: closedShift,
      summary: {
        openingCash,
        cashSales,
        expectedCash,
        actualCash: actualCashNum,
        discrepancy
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to close shift." });
  }
});
shiftsRouter.get("/history", requireAuthentication, async (req, res) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });
  try {
    const isOwner = req.user?.role === "OWNER" || req.user?.role === "ADMIN";
    const userFilter = isOwner ? "" : `WHERE s.cashier_id = '${req.user?.id}'`;
    const query = `
      SELECT 
        s.*,
        u.full_name as cashier_name,
        u.email as cashier_email,
        COUNT(sa.id)::integer as sales_count,
        COALESCE(SUM(sa.total_amount), 0)::numeric(12,2) as total_revenue
      FROM cashier_shifts s
      JOIN users u ON s.cashier_id = u.id
      LEFT JOIN sales sa ON s.id = sa.shift_id
      ${userFilter}
      GROUP BY s.id, u.full_name, u.email
      ORDER BY s.start_time DESC
      LIMIT 50
    `;
    const shifts = await rawSql.unsafe(query);
    return res.json({ shifts });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch shifts history" });
  }
});

// src/server/routes/suppliers.ts
import { Router as Router8 } from "express";
import { eq as eq5, desc as desc3 } from "drizzle-orm";
var suppliersRouter = Router8();
suppliersRouter.get("/", requireAuthentication, async (req, res) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: "Database not connected." });
  try {
    const list = await db.select().from(schema_exports.suppliers).orderBy(desc3(schema_exports.suppliers.createdAt));
    return res.json({ suppliers: list });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch suppliers" });
  }
});
suppliersRouter.post("/", requireAuthentication, requireRole(["OWNER", "ADMIN"]), async (req, res) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: "Database not connected." });
  const { name, contactPerson, phone, email, address, city, region, paymentTerms, notes } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: "Supplier name and phone are required." });
  }
  try {
    const [supplier] = await db.insert(schema_exports.suppliers).values({
      name,
      contactPerson: contactPerson || null,
      phone,
      email: email || null,
      address: address || null,
      city: city || "Accra",
      region: region || "Greater Accra",
      paymentTerms: paymentTerms || "Net 30",
      notes: notes || null,
      status: "ACTIVE"
    }).returning();
    await db.insert(schema_exports.auditLogs).values({
      userId: req.user?.id,
      action: "SUPPLIER_CREATED",
      entityType: "SUPPLIER",
      entityId: supplier.id,
      details: { name: supplier.name },
      ipAddress: req.ip
    });
    await broadcastRealtimeEvent("SUPPLIER_CREATED", { supplierId: supplier.id, createdBy: req.user?.id });
    return res.status(201).json({ success: true, supplier });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to create supplier" });
  }
});
suppliersRouter.delete("/:id", requireAuthentication, requireRole(["OWNER", "ADMIN"]), async (req, res) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: "Database not connected." });
  const { id } = req.params;
  try {
    const [existing] = await db.select().from(schema_exports.suppliers).where(eq5(schema_exports.suppliers.id, id)).limit(1);
    if (!existing) {
      return res.status(404).json({ error: "Supplier not found." });
    }
    const purchases2 = await db.select({ id: schema_exports.purchases.id }).from(schema_exports.purchases).where(eq5(schema_exports.purchases.supplierId, id)).limit(1);
    if (purchases2.length > 0) {
      return res.status(400).json({ error: "Cannot delete supplier with existing purchase orders. Remove related purchases first." });
    }
    await db.delete(schema_exports.suppliers).where(eq5(schema_exports.suppliers.id, id));
    await db.insert(schema_exports.auditLogs).values({
      userId: req.user?.id,
      action: "SUPPLIER_DELETED",
      entityType: "SUPPLIER",
      entityId: id,
      details: { name: existing.name },
      ipAddress: req.ip
    });
    await broadcastRealtimeEvent("SUPPLIER_DELETED", { supplierId: id, deletedBy: req.user?.id });
    return res.json({ success: true, supplier: existing });
  } catch (err) {
    console.error("[Delete Supplier] Error:", err);
    return res.status(500).json({ error: err.message || "Failed to delete supplier" });
  }
});

// src/server/routes/categories.ts
import { Router as Router9 } from "express";
import { asc } from "drizzle-orm";
var categoriesRouter = Router9();
categoriesRouter.get("/", requireAuthentication, async (req, res) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: "Database not connected." });
  try {
    const list = await db.select().from(schema_exports.categories).orderBy(asc(schema_exports.categories.name));
    return res.json({ categories: list });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch categories" });
  }
});
categoriesRouter.post("/", requireAuthentication, requireRole(["OWNER"]), async (req, res) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: "Database not connected." });
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: "Category name is required." });
  try {
    const [category] = await db.insert(schema_exports.categories).values({ name: name.trim(), description: description || null }).returning();
    return res.status(201).json({ success: true, category });
  } catch (err) {
    return res.status(400).json({ error: err.message || "Failed to create category (name must be unique)." });
  }
});

// src/server/routes/purchases.ts
import { Router as Router10 } from "express";
var purchasesRouter = Router10();
purchasesRouter.get("/", requireAuthentication, requireRole(["OWNER"]), async (req, res) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });
  try {
    const purchases2 = await rawSql.unsafe(`
      SELECT 
        p.*,
        s.name as supplier_name,
        COUNT(pi.id)::integer as item_count
      FROM purchases p
      JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN purchase_items pi ON p.id = pi.purchase_id
      GROUP BY p.id, s.name
      ORDER BY p.purchase_date DESC
      LIMIT 100
    `);
    return res.json({ purchases: purchases2 });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch purchases" });
  }
});
purchasesRouter.post("/", requireAuthentication, requireRole(["OWNER"]), async (req, res) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });
  const { supplierId, invoiceNumber, items, notes } = req.body;
  if (!supplierId || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Supplier and purchase items are required." });
  }
  try {
    const result = await rawSql.begin(async (tx) => {
      let totalAmount = 0;
      for (const item of items) {
        totalAmount += parseFloat(item.costPrice) * parseInt(item.quantity);
      }
      const [purchase] = await tx`
        INSERT INTO purchases (supplier_id, invoice_number, total_amount, status, notes, created_by)
        VALUES (${supplierId}, ${invoiceNumber || null}, ${totalAmount}, 'RECEIVED', ${notes || null}, ${req.user?.id || null})
        RETURNING *
      `;
      for (const it of items) {
        const qty = parseInt(it.quantity);
        const cost = parseFloat(it.costPrice);
        const sell = parseFloat(it.sellingPrice);
        const lineTotal = cost * qty;
        const [existingBatch] = await tx`
          SELECT * FROM batches WHERE product_id = ${it.productId} AND batch_number = ${it.batchNumber}
        `;
        let batchId = existingBatch?.id;
        if (existingBatch) {
          const prev = existingBatch.current_quantity;
          const next = prev + qty;
          await tx`
            UPDATE batches 
            SET current_quantity = ${next}, cost_price = ${cost}, selling_price = ${sell}, updated_at = NOW()
            WHERE id = ${existingBatch.id}
          `;
          await tx`
            INSERT INTO stock_movements (
              product_id, batch_id, movement_type, quantity_change, previous_quantity,
              new_quantity, reference_id, reason, user_id
            ) VALUES (
              ${it.productId}, ${existingBatch.id}, 'PURCHASE', ${qty},
              ${prev}, ${next}, ${invoiceNumber || purchase.id}, 'Supplier Purchase Order', ${req.user?.id || null}
            )
          `;
        } else {
          const [newBatch] = await tx`
            INSERT INTO batches (
              product_id, batch_number, supplier_id, initial_quantity, current_quantity,
              cost_price, selling_price, expiry_date, status
            ) VALUES (
              ${it.productId}, ${it.batchNumber}, ${supplierId}, ${qty}, ${qty},
              ${cost}, ${sell}, ${it.expiryDate}, 'ACTIVE'
            )
            RETURNING *
          `;
          batchId = newBatch.id;
          await tx`
            INSERT INTO stock_movements (
              product_id, batch_id, movement_type, quantity_change, previous_quantity,
              new_quantity, reference_id, reason, user_id
            ) VALUES (
              ${it.productId}, ${newBatch.id}, 'PURCHASE', ${qty},
              0, ${qty}, ${invoiceNumber || purchase.id}, 'Supplier Purchase Order', ${req.user?.id || null}
            )
          `;
        }
        await tx`
          INSERT INTO purchase_items (
            purchase_id, product_id, batch_id, quantity, cost_price, selling_price, total_cost, expiry_date
          ) VALUES (
            ${purchase.id}, ${it.productId}, ${batchId}, ${qty}, ${cost}, ${sell}, ${lineTotal}, ${it.expiryDate}
          )
        `;
      }
      await tx`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
        VALUES (
          ${req.user?.id || null}, 'PURCHASE_CREATED', 'PURCHASE', ${purchase.id},
          ${JSON.stringify({ supplierId, totalAmount, itemsCount: items.length })}::jsonb
        )
      `;
      return purchase;
    });
    await broadcastRealtimeEvent("STOCK_UPDATED", { action: "PURCHASE_RECEIVED" });
    return res.status(201).json({ success: true, purchase: result });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to record purchase" });
  }
});

// src/server/routes/expenses.ts
import { Router as Router11 } from "express";
var expensesRouter = Router11();
expensesRouter.get("/", requireAuthentication, requireRole(["OWNER"]), async (req, res) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });
  try {
    const expenses2 = await rawSql.unsafe(`
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
    const categories2 = await rawSql.unsafe(`
      SELECT * FROM expense_categories ORDER BY name ASC
    `);
    return res.json({ expenses: expenses2, categories: categories2 });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch expenses" });
  }
});
expensesRouter.post("/", requireAuthentication, requireRole(["OWNER"]), async (req, res) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: "Database not connected." });
  const { title, amount, categoryId, expenseDate, receiptReference, paidTo, paymentMethod, notes } = req.body;
  if (!title || !amount) {
    return res.status(400).json({ error: "Title and amount are required." });
  }
  try {
    const [expense] = await db.insert(schema_exports.expenses).values({
      title,
      amount: parseFloat(amount).toFixed(2),
      categoryId: categoryId || null,
      expenseDate: expenseDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      receiptReference: receiptReference || null,
      paidTo: paidTo || null,
      paymentMethod: paymentMethod || "CASH",
      recordedBy: req.user?.id || null,
      notes: notes || null
    }).returning();
    await db.insert(schema_exports.auditLogs).values({
      userId: req.user?.id,
      action: "EXPENSE_CREATED",
      entityType: "EXPENSE",
      entityId: expense.id,
      details: { title, amount },
      ipAddress: req.ip
    });
    return res.status(201).json({ success: true, expense });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to record expense" });
  }
});
expensesRouter.post("/categories", requireAuthentication, requireRole(["OWNER"]), async (req, res) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: "Database not connected." });
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: "Category name is required." });
  try {
    const [cat] = await db.insert(schema_exports.expenseCategories).values({ name, description: description || null }).returning();
    return res.status(201).json({ success: true, category: cat });
  } catch (err) {
    return res.status(400).json({ error: err.message || "Failed to create expense category" });
  }
});

// src/server/routes/employees.ts
import { Router as Router12 } from "express";
var employeesRouter = Router12();
employeesRouter.get("/", requireAuthentication, requireRole(["OWNER", "ADMIN"]), async (req, res) => {
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
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch employees" });
  }
});
employeesRouter.post("/", requireAuthentication, requireRole(["OWNER", "ADMIN"]), async (req, res) => {
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
    let supabaseUserId = null;
    const supabase = getSupabase();
    if (supabase && password) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: "EMPLOYEE"
          }
        }
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
  } catch (err) {
    console.error("[Create Employee] Error:", err);
    return res.status(400).json({ error: err.message || "Failed to create employee." });
  }
});
employeesRouter.patch("/:id/status", requireAuthentication, requireRole(["OWNER", "ADMIN"]), async (req, res) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });
  const { status } = req.body;
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
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to update employee status" });
  }
});
employeesRouter.delete("/:id", requireAuthentication, requireRole(["OWNER", "ADMIN"]), async (req, res) => {
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
  } catch (err) {
    console.error("[Delete Employee] Error:", err);
    return res.status(400).json({ error: err.message || "Failed to delete employee." });
  }
});

// src/server/routes/reports.ts
import { Router as Router13 } from "express";
var reportsRouter = Router13();
reportsRouter.get("/dashboard", requireAuthentication, async (req, res) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });
  try {
    const [salesMetrics] = await rawSql.unsafe(`
      SELECT 
        COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE THEN total_amount ELSE 0 END), 0)::numeric(12,2) as today_sales,
        COALESCE(COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END), 0)::integer as today_transactions,
        COALESCE(SUM(CASE WHEN created_at >= DATE_TRUNC('week', CURRENT_DATE) THEN total_amount ELSE 0 END), 0)::numeric(12,2) as week_sales,
        COALESCE(SUM(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN total_amount ELSE 0 END), 0)::numeric(12,2) as month_sales,
        COALESCE(SUM(total_amount), 0)::numeric(12,2) as total_revenue,
        COALESCE(SUM(total_cost), 0)::numeric(12,2) as total_cogs
      FROM sales
      WHERE status = 'COMPLETED'
    `);
    const [inventoryMetrics] = await rawSql.unsafe(`
      SELECT 
        (SELECT COUNT(*)::integer FROM products WHERE is_active = true) as total_products,
        COALESCE(SUM(CASE WHEN b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE THEN b.current_quantity ELSE 0 END), 0)::integer as total_units,
        COALESCE(SUM(CASE WHEN b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE THEN b.current_quantity * b.cost_price ELSE 0 END), 0)::numeric(12,2) as inventory_valuation,
        COALESCE(COUNT(DISTINCT CASE WHEN b.expiry_date < CURRENT_DATE AND b.current_quantity > 0 THEN b.id END), 0)::integer as expired_batches_count,
        COALESCE(COUNT(DISTINCT CASE WHEN b.expiry_date >= CURRENT_DATE AND b.expiry_date <= CURRENT_DATE + INTERVAL '90 days' AND b.current_quantity > 0 THEN b.id END), 0)::integer as expiring_soon_count
      FROM batches b
    `);
    const [lowStockData] = await rawSql.unsafe(`
      SELECT COUNT(*)::integer as low_stock_count FROM (
        SELECT p.id, p.reorder_level,
          COALESCE(SUM(CASE WHEN b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE THEN b.current_quantity ELSE 0 END), 0) as stock
        FROM products p
        LEFT JOIN batches b ON p.id = b.product_id
        WHERE p.is_active = true
        GROUP BY p.id, p.reorder_level
        HAVING COALESCE(SUM(CASE WHEN b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE THEN b.current_quantity ELSE 0 END), 0) <= p.reorder_level
      ) sub
    `);
    const lowStockProducts = await rawSql.unsafe(`
      SELECT 
        p.id,
        p.name,
        p.generic_name,
        p.sku,
        p.barcode,
        c.name as category_name,
        p.dosage_form,
        p.strength,
        p.reorder_level,
        p.selling_price,
        p.prescription_required,
        COALESCE(SUM(CASE WHEN b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE THEN b.current_quantity ELSE 0 END), 0)::integer as current_stock,
        (p.reorder_level - COALESCE(SUM(CASE WHEN b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE THEN b.current_quantity ELSE 0 END), 0))::integer as stock_deficit,
        CASE 
          WHEN COALESCE(SUM(CASE WHEN b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE THEN b.current_quantity ELSE 0 END), 0) = 0 THEN 'OUT_OF_STOCK'
          WHEN COALESCE(SUM(CASE WHEN b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE THEN b.current_quantity ELSE 0 END), 0) <= (p.reorder_level * 0.5) THEN 'CRITICAL'
          ELSE 'LOW'
        END as urgency
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN batches b ON p.id = b.product_id
      WHERE p.is_active = true
      GROUP BY p.id, p.name, p.generic_name, p.sku, p.barcode, c.name, p.dosage_form, p.strength, p.reorder_level, p.selling_price, p.prescription_required
      HAVING COALESCE(SUM(CASE WHEN b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE THEN b.current_quantity ELSE 0 END), 0) <= p.reorder_level
      ORDER BY 
        CASE 
          WHEN COALESCE(SUM(CASE WHEN b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE THEN b.current_quantity ELSE 0 END), 0) = 0 THEN 1
          WHEN COALESCE(SUM(CASE WHEN b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE THEN b.current_quantity ELSE 0 END), 0) <= (p.reorder_level * 0.5) THEN 2
          ELSE 3
        END ASC,
        stock_deficit DESC
      LIMIT 50
    `);
    const [expensesData] = await rawSql.unsafe(`
      SELECT 
        COALESCE(SUM(amount), 0)::numeric(12,2) as total_expenses,
        COALESCE(SUM(CASE WHEN expense_date >= DATE_TRUNC('month', CURRENT_DATE) THEN amount ELSE 0 END), 0)::numeric(12,2) as month_expenses
      FROM expenses
    `);
    const [shiftsData] = await rawSql.unsafe(`
      SELECT 
        (SELECT COUNT(*)::integer FROM users WHERE role = 'EMPLOYEE' AND status = 'ACTIVE') as active_employees,
        (SELECT COUNT(*)::integer FROM cashier_shifts cs JOIN users u ON cs.cashier_id = u.id WHERE cs.status = 'OPEN' AND u.status = 'ACTIVE') as open_shifts
    `);
    const recentSales = await rawSql.unsafe(`
      SELECT 
        s.id,
        s.receipt_number,
        s.total_amount,
        s.created_at,
        s.status,
        u.full_name as cashier_name,
        p.payment_method
      FROM sales s
      JOIN users u ON s.cashier_id = u.id
      LEFT JOIN payments p ON s.id = p.sale_id
      ORDER BY s.created_at DESC
      LIMIT 8
    `);
    const revenue = parseFloat(salesMetrics?.total_revenue || "0");
    const cogs = parseFloat(salesMetrics?.total_cogs || "0");
    const grossProfit = Math.max(0, revenue - cogs);
    const expenses2 = parseFloat(expensesData?.total_expenses || "0");
    const netProfit = grossProfit - expenses2;
    const isOwnerOrAdmin = req.user?.role === "OWNER" || req.user?.role === "ADMIN";
    const finance = isOwnerOrAdmin ? {
      revenue: revenue.toFixed(2),
      costOfGoodsSold: cogs.toFixed(2),
      grossProfit: grossProfit.toFixed(2),
      expenses: expenses2.toFixed(2),
      monthExpenses: expensesData?.month_expenses || "0.00",
      netProfit: netProfit.toFixed(2),
      grossMarginPercent: revenue > 0 ? (grossProfit / revenue * 100).toFixed(1) : "0.0"
    } : { revenue: revenue.toFixed(2) };
    return res.json({
      sales: {
        todaySales: salesMetrics?.today_sales || "0.00",
        todayTransactions: salesMetrics?.today_transactions || 0,
        weekSales: salesMetrics?.week_sales || "0.00",
        monthSales: salesMetrics?.month_sales || "0.00",
        totalRevenue: revenue.toFixed(2)
      },
      inventory: {
        totalProducts: inventoryMetrics?.total_products || 0,
        totalUnits: inventoryMetrics?.total_units || 0,
        inventoryValuation: inventoryMetrics?.inventory_valuation || "0.00",
        lowStockCount: lowStockData?.low_stock_count || 0,
        expiringSoonCount: inventoryMetrics?.expiring_soon_count || 0,
        expiredBatchesCount: inventoryMetrics?.expired_batches_count || 0
      },
      finance,
      employees: {
        activeCount: shiftsData?.active_employees || 0,
        openShifts: shiftsData?.open_shifts || 0
      },
      recentTransactions: recentSales,
      lowStockProducts: isOwnerOrAdmin ? lowStockProducts || [] : []
    });
  } catch (err) {
    console.error("[Dashboard Reports] Error:", err);
    return res.status(500).json({ error: err.message || "Failed to generate dashboard reports" });
  }
});
reportsRouter.get("/sales", requireAuthentication, requireRole(["OWNER", "ADMIN"]), async (req, res) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });
  const { startDate, endDate } = req.query;
  try {
    const dateFilter = startDate && endDate ? `AND s.created_at >= '${startDate}'::timestamptz AND s.created_at <= '${endDate} 23:59:59'::timestamptz` : "";
    const paymentBreakdown = await rawSql.unsafe(`
      SELECT 
        p.payment_method,
        COUNT(s.id)::integer as transaction_count,
        COALESCE(SUM(s.total_amount), 0)::numeric(12,2) as total_amount
      FROM sales s
      JOIN payments p ON s.id = p.sale_id
      WHERE s.status = 'COMPLETED' ${dateFilter}
      GROUP BY p.payment_method
      ORDER BY total_amount DESC
    `);
    const topProducts = await rawSql.unsafe(`
      SELECT 
        p.id,
        p.name,
        p.sku,
        COALESCE(SUM(si.quantity), 0)::integer as total_qty,
        COALESCE(SUM(si.total_price), 0)::numeric(12,2) as total_sales,
        COALESCE(SUM(si.total_cost), 0)::numeric(12,2) as total_cost,
        (COALESCE(SUM(si.total_price), 0) - COALESCE(SUM(si.total_cost), 0))::numeric(12,2) as gross_profit
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.status = 'COMPLETED' ${dateFilter}
      GROUP BY p.id, p.name, p.sku
      ORDER BY total_qty DESC
      LIMIT 20
    `);
    return res.json({ paymentBreakdown, topProducts });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch sales report" });
  }
});
reportsRouter.get("/sales-summary", requireAuthentication, requireRole(["OWNER", "ADMIN"]), async (req, res) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });
  const { startDate, endDate } = req.query;
  try {
    const dateFilter = startDate && endDate ? `AND s.created_at >= '${startDate}'::timestamptz AND s.created_at <= '${endDate} 23:59:59'::timestamptz` : "";
    const [totals] = await rawSql.unsafe(`
      SELECT 
        COALESCE(SUM(s.total_amount), 0)::numeric(12,2) as revenue,
        COALESCE(SUM(s.total_cost), 0)::numeric(12,2) as cogs,
        (COALESCE(SUM(s.total_amount), 0) - COALESCE(SUM(s.total_cost), 0))::numeric(12,2) as gross_profit,
        COUNT(s.id)::integer as total_transactions
      FROM sales s
      WHERE s.status = 'COMPLETED' ${dateFilter}
    `);
    const paymentMethods = await rawSql.unsafe(`
      SELECT 
        COALESCE(p.payment_method, 'CASH') as payment_method,
        COUNT(s.id)::integer as count,
        COALESCE(SUM(s.total_amount), 0)::numeric(12,2) as total
      FROM sales s
      JOIN payments p ON s.id = p.sale_id
      WHERE s.status = 'COMPLETED' ${dateFilter}
      GROUP BY p.payment_method
      ORDER BY total DESC
    `);
    const topProducts = await rawSql.unsafe(`
      SELECT 
        p.id,
        p.name,
        p.sku,
        COALESCE(SUM(si.quantity), 0)::integer as total_qty,
        COALESCE(SUM(si.total_price), 0)::numeric(12,2) as total_sales,
        COALESCE(SUM(si.total_cost), 0)::numeric(12,2) as total_cost,
        (COALESCE(SUM(si.total_price), 0) - COALESCE(SUM(si.total_cost), 0))::numeric(12,2) as gross_profit
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.status = 'COMPLETED' ${dateFilter}
      GROUP BY p.id, p.name, p.sku
      ORDER BY total_qty DESC
      LIMIT 20
    `);
    return res.json({ totals, paymentMethods, topProducts });
  } catch (err) {
    console.error("[Sales Summary] Error:", err);
    return res.status(500).json({ error: err.message || "Failed to generate sales summary" });
  }
});

// src/server/routes/settings.ts
import { Router as Router14 } from "express";
import multer3 from "multer";
import { eq as eq6, isNotNull } from "drizzle-orm";
var settingsRouter = Router14();
var upload2 = multer3({
  storage: multer3.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and WEBP image files are allowed."));
    }
  }
});
settingsRouter.get("/", async (req, res) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: "Database not connected." });
  try {
    const [settings] = await db.select().from(schema_exports.pharmacySettings).limit(1);
    return res.json({
      settings: settings || {
        name: "Empress Oris Herbal & Mart",
        city: "Accra",
        region: "Greater Accra",
        country: "Ghana",
        currency: "GHS",
        currencySymbol: "GH\u20B5",
        receiptFooter: "Thank you for your patronage! Medicines sold are not returnable once opened."
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch settings" });
  }
});
settingsRouter.put("/", requireAuthentication, requireRole(["OWNER"]), async (req, res) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: "Database not connected." });
  const { name, licenseNumber, phone, email, address, city, region, currency, currencySymbol, taxRate, receiptFooter, logoUrl, smsNotificationsEnabled, smsRecipientPhone } = req.body;
  try {
    const existing = await db.select().from(schema_exports.pharmacySettings).limit(1);
    let updated;
    if (existing.length === 0) {
      [updated] = await db.insert(schema_exports.pharmacySettings).values({
        name: name || "Empress Oris Herbal & Mart",
        licenseNumber,
        phone,
        email,
        address,
        city: city || "Accra",
        region: region || "Greater Accra",
        country: "Ghana",
        currency: currency || "GHS",
        currencySymbol: currencySymbol || "GH\u20B5",
        taxRate: taxRate ? parseFloat(taxRate).toFixed(2) : "0.00",
        receiptFooter,
        logoUrl,
        smsNotificationsEnabled: smsNotificationsEnabled !== void 0 ? !!smsNotificationsEnabled : false,
        smsRecipientPhone: smsRecipientPhone !== void 0 ? smsRecipientPhone : null
      }).returning();
    } else {
      [updated] = await db.update(schema_exports.pharmacySettings).set({
        name,
        licenseNumber,
        phone,
        email,
        address,
        city,
        region,
        currency: currency || "GHS",
        currencySymbol: currencySymbol || "GH\u20B5",
        taxRate: taxRate !== void 0 ? parseFloat(taxRate).toFixed(2) : existing[0].taxRate,
        receiptFooter,
        logoUrl: logoUrl !== void 0 ? logoUrl : existing[0].logoUrl,
        smsNotificationsEnabled: smsNotificationsEnabled !== void 0 ? !!smsNotificationsEnabled : existing[0].smsNotificationsEnabled,
        smsRecipientPhone: smsRecipientPhone !== void 0 ? smsRecipientPhone : existing[0].smsRecipientPhone,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq6(schema_exports.pharmacySettings.id, existing[0].id)).returning();
    }
    await db.insert(schema_exports.auditLogs).values({
      userId: req.user?.id,
      action: "SETTINGS_UPDATED",
      entityType: "SETTINGS",
      entityId: updated.id,
      details: { name: updated.name },
      ipAddress: req.ip
    });
    await broadcastRealtimeEvent("SETTINGS_UPDATED", { settings: updated });
    return res.json({ success: true, settings: updated });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to update pharmacy settings" });
  }
});
settingsRouter.get(
  "/sms-history",
  requireAuthentication,
  requireRole(["OWNER"]),
  async (req, res) => {
    const rawSql = getRawSql();
    if (!rawSql) return res.status(503).json({ error: "Database not connected." });
    try {
      const rows = await rawSql.unsafe(`SELECT * FROM sms_outbox ORDER BY created_at DESC LIMIT 100`);
      return res.json({ history: rows });
    } catch (err) {
      return res.status(500).json({ error: err.message || "Failed to fetch SMS history" });
    }
  }
);
settingsRouter.post(
  "/sms-retry/:id",
  requireAuthentication,
  requireRole(["OWNER"]),
  async (req, res) => {
    const rawSql = getRawSql();
    if (!rawSql) return res.status(503).json({ error: "Database not connected." });
    const { id } = req.params;
    try {
      const [row] = await rawSql.unsafe(`SELECT * FROM sms_outbox WHERE id = '${id}' LIMIT 1`);
      if (!row) return res.status(404).json({ error: "SMS record not found." });
      if (row.status === "SENT") return res.json({ success: true, message: "Already sent." });
      const { sendSms: sendSms2 } = await Promise.resolve().then(() => (init_sasuSync(), sasuSync_exports));
      const result = await sendSms2(row.recipient, row.message);
      if (result.success) {
        await rawSql.unsafe(`UPDATE sms_outbox SET status = 'SENT', attempts = attempts + 1, sent_at = NOW(), last_error = NULL WHERE id = '${id}'`);
        return res.json({ success: true });
      } else {
        await rawSql.unsafe(`UPDATE sms_outbox SET status = 'FAILED', attempts = attempts + 1, last_error = '${(result.error || "Unknown").replace(/'/g, "''")}' WHERE id = '${id}'`);
        return res.status(502).json({ success: false, error: result.error });
      }
    } catch (err) {
      return res.status(500).json({ error: err.message || "Retry failed" });
    }
  }
);
settingsRouter.post(
  "/logo",
  requireAuthentication,
  requireRole(["OWNER"]),
  upload2.single("logo"),
  async (req, res) => {
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
        await db.update(schema_exports.pharmacySettings).set({ logoUrl: publicUrl, updatedAt: /* @__PURE__ */ new Date() }).where(isNotNull(schema_exports.pharmacySettings.id));
      }
      return res.json({ success: true, logoUrl: publicUrl });
    } catch (err) {
      return res.status(500).json({ error: err.message || "Failed to upload logo" });
    }
  }
);

// src/server/routes/notifications.ts
import { Router as Router15 } from "express";
var notificationsRouter = Router15();
notificationsRouter.get("/", requireAuthentication, async (req, res) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });
  try {
    try {
      const lowStockItems = await rawSql.unsafe(`
        SELECT p.id, p.name, p.sku, p.reorder_level,
          COALESCE(SUM(CASE WHEN b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE THEN b.current_quantity ELSE 0 END), 0)::integer as current_stock
        FROM products p
        LEFT JOIN batches b ON p.id = b.product_id
        WHERE p.is_active = true
        GROUP BY p.id, p.name, p.sku, p.reorder_level
        HAVING COALESCE(SUM(CASE WHEN b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE THEN b.current_quantity ELSE 0 END), 0) <= p.reorder_level
        ORDER BY current_stock ASC
        LIMIT 100
      `);
      for (const item of lowStockItems) {
        const refId = `low-${item.id}`;
        const title = item.current_stock === 0 ? `${item.name} is Out of Stock` : `${item.name} is Low on Stock`;
        const message = `Current stock: ${item.current_stock} units (reorder at ${item.reorder_level}). SKU: ${item.sku}`;
        const type = item.current_stock === 0 ? "OUT_OF_STOCK" : "LOW_STOCK";
        await rawSql.unsafe(`
          INSERT INTO notifications (title, message, type, reference_id, is_read)
          VALUES ($$${title}$$, $$${message}$$, $$${type}$$, $$${refId}$$, false)
          ON CONFLICT (reference_id) DO UPDATE SET title = $$${title}$$, message = $$${message}$$, is_read = notifications.is_read
        `);
      }
    } catch (err) {
      console.warn("[Notifications] Low stock upsert error:", err);
    }
    try {
      const expiringBatches = await rawSql.unsafe(`
        SELECT b.id, b.batch_number, b.current_quantity, b.expiry_date, p.name as product_name,
          (b.expiry_date - CURRENT_DATE)::integer as days_remaining
        FROM batches b
        JOIN products p ON b.product_id = p.id
        WHERE b.current_quantity > 0 
          AND b.expiry_date >= CURRENT_DATE 
          AND b.expiry_date <= CURRENT_DATE + INTERVAL '90 days'
        ORDER BY b.expiry_date ASC
        LIMIT 100
      `);
      for (const item of expiringBatches) {
        const refId = `exp-${item.id}`;
        const title = `${item.product_name} \u2014 Batch ${item.batch_number} Expiring`;
        const message = `Expires in ${item.days_remaining} days (${new Date(item.expiry_date).toLocaleDateString("en-GB")}). Qty: ${item.current_quantity}`;
        await rawSql.unsafe(`
          INSERT INTO notifications (title, message, type, reference_id, is_read)
          VALUES ($$${title}$$, $$${message}$$, 'EXPIRING_SOON', $$${refId}$$, false)
          ON CONFLICT (reference_id) DO UPDATE SET title = $$${title}$$, message = $$${message}$$, is_read = notifications.is_read
        `);
      }
    } catch (err) {
      console.warn("[Notifications] Expiring batch upsert error:", err);
    }
    try {
      const expiredBatches = await rawSql.unsafe(`
        SELECT b.id, b.batch_number, b.current_quantity, b.expiry_date, p.name as product_name
        FROM batches b
        JOIN products p ON b.product_id = p.id
        WHERE b.current_quantity > 0 AND b.expiry_date < CURRENT_DATE
        ORDER BY b.expiry_date DESC
        LIMIT 100
      `);
      for (const item of expiredBatches) {
        const refId = `expired-${item.id}`;
        const title = `${item.product_name} \u2014 Batch ${item.batch_number} Expired`;
        const message = `Expired on ${new Date(item.expiry_date).toLocaleDateString("en-GB")}. Qty: ${item.current_quantity} units still in stock.`;
        await rawSql.unsafe(`
          INSERT INTO notifications (title, message, type, reference_id, is_read)
          VALUES ($$${title}$$, $$${message}$$, 'EXPIRED', $$${refId}$$, false)
          ON CONFLICT (reference_id) DO UPDATE SET title = $$${title}$$, message = $$${message}$$, is_read = notifications.is_read
        `);
      }
    } catch (err) {
      console.warn("[Notifications] Expired batch upsert error:", err);
    }
    const allNotifications = await rawSql.unsafe(`
      SELECT * FROM notifications ORDER BY is_read ASC, created_at DESC LIMIT 200
    `);
    return res.json({ notifications: allNotifications });
  } catch (err) {
    console.error("[Notifications] Error:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch notifications" });
  }
});
notificationsRouter.get("/unread-count", requireAuthentication, async (req, res) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ count: 0 });
  try {
    const [result] = await rawSql.unsafe(`
      SELECT COUNT(*)::integer as count FROM notifications WHERE is_read = false
    `);
    return res.json({ count: result?.count || 0 });
  } catch (err) {
    return res.json({ count: 0 });
  }
});
notificationsRouter.put("/:id/read", requireAuthentication, async (req, res) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });
  const { id } = req.params;
  try {
    const [updated] = await rawSql`
      UPDATE notifications SET is_read = true WHERE id = ${id} RETURNING *
    `;
    if (!updated) {
      return res.status(404).json({ error: "Notification not found." });
    }
    await broadcastRealtimeEvent("NOTIFICATION_UPDATED", { notificationId: id });
    return res.json({ success: true, notification: updated });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to mark notification as read" });
  }
});
notificationsRouter.put("/read-all", requireAuthentication, async (req, res) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });
  try {
    await rawSql`UPDATE notifications SET is_read = true WHERE is_read = false`;
    await broadcastRealtimeEvent("NOTIFICATION_UPDATED", { action: "read_all" });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to mark all as read" });
  }
});

// src/server/routes/audit.ts
import { Router as Router16 } from "express";
var auditRouter = Router16();
auditRouter.get("/", requireAuthentication, requireRole(["OWNER", "ADMIN"]), async (req, res) => {
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
      LIMIT ${parseInt(limit) || 100}
    `;
    const logs = await rawSql.unsafe(query);
    return res.json({ logs });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch audit logs" });
  }
});

// src/server/routes/salesTrend.ts
import { Router as Router17 } from "express";
var salesTrendRouter = Router17();
function pad2(n) {
  return String(n).padStart(2, "0");
}
function hour12(h) {
  const r = h % 12;
  return r === 0 ? 12 : r;
}
function ampm(h) {
  return h >= 12 ? "PM" : "AM";
}
function formatHourLabel(h) {
  return `${pad2(h)}:00`;
}
function monthShort(y, m) {
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", {
    month: "short",
    timeZone: "Africa/Accra"
  });
}
function monthLong(y, m) {
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", {
    month: "long",
    timeZone: "Africa/Accra"
  });
}
salesTrendRouter.get(
  "/",
  requireAuthentication,
  requireRole(["OWNER"]),
  async (req, res) => {
    const rawSql = getRawSql();
    if (!rawSql) return res.status(503).json({ error: "Database not connected." });
    const period = String(req.query.period || "day");
    const dateParam = req.query.date ? String(req.query.date) : null;
    try {
      const now = /* @__PURE__ */ new Date();
      const ghanaDate = now.toLocaleDateString("en-CA", { timeZone: "Africa/Accra" });
      const ghanaYear = parseInt(
        now.toLocaleString("en-US", { timeZone: "Africa/Accra", year: "numeric" })
      );
      const ghanaMonth = parseInt(
        now.toLocaleString("en-US", { timeZone: "Africa/Accra", month: "2-digit" })
      );
      const ghanaDay = parseInt(
        now.toLocaleString("en-US", { timeZone: "Africa/Accra", day: "2-digit" })
      );
      const ghanaHour = parseInt(
        now.toLocaleString("en-US", { timeZone: "Africa/Accra", hour: "2-digit", hour12: false })
      );
      if (period === "day") {
        const d = dateParam || ghanaDate;
        const isFuture = d > ghanaDate;
        const isToday = d === ghanaDate;
        const buckets = [];
        if (!isFuture) {
          const endHour = isToday ? ghanaHour : 23;
          const rows = await rawSql`
            SELECT EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Africa/Accra'))::int AS hour,
                   COALESCE(SUM(total_amount), 0)::numeric(12,2) AS amount
            FROM sales
            WHERE status = 'COMPLETED'
              AND (created_at AT TIME ZONE 'Africa/Accra')::date = ${d}::date
            GROUP BY hour
          `;
          const map = new Map(
            rows.map((r) => [Number(r.hour), Number(r.amount)])
          );
          for (let h = 0; h <= endHour; h++) {
            const next = h === 23 ? 0 : h + 1;
            const nextDay = h === 23;
            const nextAmpm = nextDay ? "AM" : ampm(next);
            const nextHour = nextDay ? 12 : hour12(next);
            buckets.push({
              label: formatHourLabel(h),
              period: `${hour12(h)}:00 ${ampm(h)} \u2013 ${nextHour}:00 ${nextAmpm}`,
              value: map.get(h) || 0
            });
          }
        }
        return res.json({ period, date: d, buckets });
      }
      if (period === "month") {
        const d = dateParam || `${ghanaYear}-${pad2(ghanaMonth)}`;
        const [yStr, mStr] = d.split("-");
        const y = parseInt(yStr);
        const m = parseInt(mStr);
        const isFuture = y > ghanaYear || y === ghanaYear && m > ghanaMonth;
        const isCurrent = y === ghanaYear && m === ghanaMonth;
        const buckets = [];
        if (!isFuture) {
          const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
          const maxDay = isCurrent ? ghanaDay : lastDay;
          const rows = await rawSql`
            SELECT EXTRACT(DAY FROM (created_at AT TIME ZONE 'Africa/Accra'))::int AS day,
                   COALESCE(SUM(total_amount), 0)::numeric(12,2) AS amount
            FROM sales
            WHERE status = 'COMPLETED'
              AND EXTRACT(YEAR FROM (created_at AT TIME ZONE 'Africa/Accra')) = ${y}
              AND EXTRACT(MONTH FROM (created_at AT TIME ZONE 'Africa/Accra')) = ${m}
            GROUP BY day
          `;
          const map = new Map(
            rows.map((r) => [Number(r.day), Number(r.amount)])
          );
          for (let day = 1; day <= maxDay; day++) {
            const dateStr = new Date(Date.UTC(y, m - 1, day)).toLocaleDateString(
              "en-GB",
              { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Accra" }
            );
            buckets.push({
              label: String(day),
              period: dateStr,
              value: map.get(day) || 0
            });
          }
        }
        return res.json({ period, date: d, buckets });
      }
      if (period === "year") {
        const y = parseInt(dateParam || String(ghanaYear));
        const isFuture = y > ghanaYear;
        const isCurrent = y === ghanaYear;
        const buckets = [];
        if (!isFuture) {
          const maxMonth = isCurrent ? ghanaMonth : 12;
          const rows = await rawSql`
            SELECT EXTRACT(MONTH FROM (created_at AT TIME ZONE 'Africa/Accra'))::int AS month,
                   COALESCE(SUM(total_amount), 0)::numeric(12,2) AS amount
            FROM sales
            WHERE status = 'COMPLETED'
              AND EXTRACT(YEAR FROM (created_at AT TIME ZONE 'Africa/Accra')) = ${y}
            GROUP BY month
          `;
          const map = new Map(
            rows.map((r) => [Number(r.month), Number(r.amount)])
          );
          for (let mth = 1; mth <= maxMonth; mth++) {
            buckets.push({
              label: monthShort(y, mth),
              period: `${monthLong(y, mth)} ${y}`,
              value: map.get(mth) || 0
            });
          }
        }
        return res.json({ period, date: String(y), buckets });
      }
      return res.status(400).json({ error: "Invalid period. Use day, month, or year." });
    } catch (err) {
      console.error("[Sales Trend] Error:", err);
      return res.status(500).json({ error: err.message || "Failed to fetch sales trend" });
    }
  }
);

// src/server/app.ts
function createExpressApp() {
  const app2 = express();
  app2.use(cors());
  app2.use(gzipCompression());
  app2.use(express.json({ limit: "10mb" }));
  app2.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app2.get("/api/health", async (req, res) => {
    const db = getDb();
    res.json({
      status: "ok",
      database: db ? "connected" : "not_configured",
      supabase: process.env.SUPABASE_URL ? "configured" : "not_configured",
      time: (/* @__PURE__ */ new Date()).toISOString(),
      country: "Ghana",
      currency: "GHS (GH\u20B5)",
      timezone: "Africa/Accra"
    });
  });
  app2.use("/api/auth", authRouter);
  app2.use("/api/products/import", importRouter);
  app2.use("/api/products", productsRouter);
  app2.use("/api/stock", stockRouter);
  app2.use("/api/pos", posRouter);
  app2.use("/api/sales", salesRouter);
  app2.use("/api/shifts", shiftsRouter);
  app2.use("/api/suppliers", suppliersRouter);
  app2.use("/api/categories", categoriesRouter);
  app2.use("/api/purchases", purchasesRouter);
  app2.use("/api/expenses", expensesRouter);
  app2.use("/api/employees", employeesRouter);
  app2.use("/api/reports", reportsRouter);
  app2.use("/api/settings", settingsRouter);
  app2.use("/api/notifications", notificationsRouter);
  app2.use("/api/audit", auditRouter);
  app2.use("/api/sales-trend", salesTrendRouter);
  app2.use((err, req, res, next) => {
    if (err instanceof multer4.MulterError) {
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
  return app2;
}

// api-src/index.ts
var app = createExpressApp();
var index_default = app;
export {
  index_default as default
};
