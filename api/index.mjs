var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/server/app.ts
import express from "express";
import cors from "cors";

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
  referenceId: text("reference_id"),
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
    await channel.send({
      type: "broadcast",
      event: eventType,
      payload: {
        ...payload,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
  } catch (err) {
    console.error("[Supabase Realtime] Broadcast warning:", err);
  }
}

// src/server/middleware/auth.ts
import { eq } from "drizzle-orm";
async function requireAuthentication(req, res, next) {
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
            return next();
          }
        }
      }
    }
    const db = getDb();
    if (db && token) {
      const [user] = await db.select().from(schema_exports.users).where(eq(schema_exports.users.id, token)).limit(1);
      if (user && user.status === "ACTIVE") {
        req.user = {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          status: user.status
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
  reference_id TEXT,
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
`;
async function runSchemaInit() {
  const sql2 = getRawSql();
  if (!sql2) {
    console.log("[DB Init] No raw SQL client available (DATABASE_URL not configured yet).");
    return false;
  }
  try {
    await sql2.unsafe(INIT_SCHEMA_SQL);
    await sql2.unsafe(`
      UPDATE pharmacy_settings 
      SET name = 'Empress Oris Herbal & Mart' 
      WHERE name = 'HealthFirst Pharmacy' OR name = 'RxDispense Ghana' OR name ILIKE '%HealthFirst%';
    `).catch(() => {
    });
    console.log("[DB Init] Successfully verified and initialized all 22 database tables!");
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
      const [settings] = await db.select().from(schema_exports.pharmacySettings).limit(1);
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
        currencySymbol: "GH\u20B5"
      });
    } else if (pharmacyName) {
      await db.update(schema_exports.pharmacySettings).set({
        name: pharmacyName,
        phone: pharmacyPhone || phone,
        address: pharmacyAddress
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

// src/server/routes/products.ts
import { Router as Router2 } from "express";
import multer from "multer";
import { eq as eq3 } from "drizzle-orm";
var productsRouter = Router2();
var upload = multer({
  storage: multer.memoryStorage(),
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
  requireRole(["OWNER"]),
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
      ORDER BY p.created_at DESC
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
  requireRole(["OWNER"]),
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
      const [existingSku] = await db.select().from(schema_exports.products).where(eq3(schema_exports.products.sku, sku)).limit(1);
      if (existingSku) {
        return res.status(400).json({ error: `A product with SKU '${sku}' already exists.` });
      }
      if (barcode) {
        const [existingBarcode] = await db.select().from(schema_exports.products).where(eq3(schema_exports.products.barcode, barcode)).limit(1);
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
  requireRole(["OWNER"]),
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
      const [updated] = await db.update(schema_exports.products).set({
        name,
        genericName,
        brandName,
        sku,
        barcode,
        categoryId: categoryId || null,
        dosageForm,
        strength,
        unit,
        packSize: packSize ? parseInt(packSize) : 1,
        manufacturer,
        description,
        prescriptionRequired: !!prescriptionRequired,
        imageUrl,
        reorderLevel: reorderLevel ? parseInt(reorderLevel) : 10,
        sellingPrice: sellingPrice ? parseFloat(sellingPrice).toFixed(2) : "0.00",
        wholesalePrice: wholesalePrice ? parseFloat(wholesalePrice).toFixed(2) : null,
        isActive: isActive !== void 0 ? !!isActive : true,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq3(schema_exports.products.id, req.params.id)).returning();
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

// src/server/routes/stock.ts
import { Router as Router3 } from "express";
var stockRouter = Router3();
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
            const [updatedBatch] = await tx`
              UPDATE batches 
              SET current_quantity = ${newQty}, updated_at = NOW()
              WHERE id = ${duplicateBatch.id}
              RETURNING *
            `;
            targetBatch = updatedBatch;
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
import { Router as Router4 } from "express";
var posRouter = Router4();
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
          p.generic_name,
          p.brand_name,
          p.sku,
          p.barcode,
          p.dosage_form,
          p.strength,
          p.unit,
          p.pack_size,
          p.prescription_required,
          p.image_url,
          p.selling_price,
          p.reorder_level,
          c.name as category_name,
          COALESCE(SUM(CASE WHEN b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE THEN b.current_quantity ELSE 0 END), 0)::integer as total_stock,
          COALESCE(
            json_agg(
              json_build_object(
                'id', b.id,
                'batch_number', b.batch_number,
                'current_quantity', b.current_quantity,
                'expiry_date', b.expiry_date,
                'selling_price', b.selling_price
              ) ORDER BY b.expiry_date ASC
            ) FILTER (WHERE b.id IS NOT NULL AND b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE),
            '[]'::json
          ) as available_batches
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
        p.generic_name,
        p.brand_name,
        p.sku,
        p.barcode,
        p.dosage_form,
        p.strength,
        p.unit,
        p.pack_size,
        p.prescription_required,
        p.image_url,
        p.selling_price,
        p.reorder_level,
        c.name as category_name,
        COALESCE(SUM(CASE WHEN b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE THEN b.current_quantity ELSE 0 END), 0)::integer as total_stock,
        COALESCE(
          json_agg(
            json_build_object(
              'id', b.id,
              'batch_number', b.batch_number,
              'current_quantity', b.current_quantity,
              'expiry_date', b.expiry_date,
              'selling_price', b.selling_price
            ) ORDER BY b.expiry_date ASC
          ) FILTER (WHERE b.id IS NOT NULL AND b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE),
          '[]'::json
        ) as available_batches
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
      ORDER BY p.name ASC
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
    notes
  } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Cart is empty. At least one item is required." });
  }
  if (!paymentMethod) {
    return res.status(400).json({ error: "Payment method is required." });
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
    const receiptNumber = `GH-REC-${Date.now().toString().slice(-6)}-${Math.floor(1e3 + Math.random() * 9e3)}`;
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
    await broadcastRealtimeEvent("SALE_COMPLETED", {
      saleId: result.sale.id,
      receiptNumber: result.sale.receipt_number,
      totalAmount: result.sale.total_amount,
      cashierId: req.user?.id
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
import { Router as Router5 } from "express";
var salesRouter = Router5();
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

// src/server/routes/shifts.ts
import { Router as Router6 } from "express";
var shiftsRouter = Router6();
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
    const isOwner = req.user?.role === "OWNER";
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
    const isOwner = req.user?.role === "OWNER";
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
import { Router as Router7 } from "express";
import { desc as desc2 } from "drizzle-orm";
var suppliersRouter = Router7();
suppliersRouter.get("/", requireAuthentication, async (req, res) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: "Database not connected." });
  try {
    const list = await db.select().from(schema_exports.suppliers).orderBy(desc2(schema_exports.suppliers.createdAt));
    return res.json({ suppliers: list });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch suppliers" });
  }
});
suppliersRouter.post("/", requireAuthentication, requireRole(["OWNER"]), async (req, res) => {
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
    return res.status(201).json({ success: true, supplier });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to create supplier" });
  }
});

// src/server/routes/categories.ts
import { Router as Router8 } from "express";
import { asc } from "drizzle-orm";
var categoriesRouter = Router8();
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
import { Router as Router9 } from "express";
var purchasesRouter = Router9();
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
import { Router as Router10 } from "express";
var expensesRouter = Router10();
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
import { Router as Router11 } from "express";
var employeesRouter = Router11();
employeesRouter.get("/", requireAuthentication, requireRole(["OWNER"]), async (req, res) => {
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
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch employees" });
  }
});
employeesRouter.post("/", requireAuthentication, requireRole(["OWNER"]), async (req, res) => {
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
            role: "EMPLOYEE"
          }
        }
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
  } catch (err) {
    console.error("[Create Employee] Error:", err);
    return res.status(400).json({ error: err.message || "Failed to create employee." });
  }
});
employeesRouter.patch("/:id/status", requireAuthentication, requireRole(["OWNER"]), async (req, res) => {
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
employeesRouter.delete("/:id", requireAuthentication, requireRole(["OWNER"]), async (req, res) => {
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
      await tx`DELETE FROM employee_profiles WHERE user_id = ${id}`;
      await tx`DELETE FROM users WHERE id = ${id}`;
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
import { Router as Router12 } from "express";
var reportsRouter = Router12();
reportsRouter.get("/dashboard", requireAuthentication, requireRole(["OWNER"]), async (req, res) => {
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
        (SELECT COUNT(*)::integer FROM cashier_shifts WHERE status = 'OPEN') as open_shifts
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
      finance: {
        revenue: revenue.toFixed(2),
        costOfGoodsSold: cogs.toFixed(2),
        grossProfit: grossProfit.toFixed(2),
        expenses: expenses2.toFixed(2),
        monthExpenses: expensesData?.month_expenses || "0.00",
        netProfit: netProfit.toFixed(2),
        grossMarginPercent: revenue > 0 ? (grossProfit / revenue * 100).toFixed(1) : "0.0"
      },
      employees: {
        activeCount: shiftsData?.active_employees || 0,
        openShifts: shiftsData?.open_shifts || 0
      },
      recentTransactions: recentSales,
      lowStockProducts: lowStockProducts || []
    });
  } catch (err) {
    console.error("[Dashboard Reports] Error:", err);
    return res.status(500).json({ error: err.message || "Failed to generate dashboard reports" });
  }
});
reportsRouter.get("/sales", requireAuthentication, requireRole(["OWNER"]), async (req, res) => {
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
        COALESCE(SUM(si.quantity), 0)::integer as units_sold,
        COALESCE(SUM(si.total_price), 0)::numeric(12,2) as total_revenue,
        COALESCE(SUM(si.total_cost), 0)::numeric(12,2) as total_cost,
        (COALESCE(SUM(si.total_price), 0) - COALESCE(SUM(si.total_cost), 0))::numeric(12,2) as gross_profit
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.status = 'COMPLETED' ${dateFilter}
      GROUP BY p.id, p.name, p.sku
      ORDER BY units_sold DESC
      LIMIT 20
    `);
    return res.json({ paymentBreakdown, topProducts });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch sales report" });
  }
});

// src/server/routes/settings.ts
import { Router as Router13 } from "express";
import multer2 from "multer";
import { eq as eq5, isNotNull } from "drizzle-orm";
var settingsRouter = Router13();
var upload2 = multer2({
  storage: multer2.memoryStorage(),
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
  const { name, licenseNumber, phone, email, address, city, region, currency, currencySymbol, taxRate, receiptFooter, logoUrl } = req.body;
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
        logoUrl
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
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq5(schema_exports.pharmacySettings.id, existing[0].id)).returning();
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
import { Router as Router14 } from "express";
var notificationsRouter = Router14();
notificationsRouter.get("/", requireAuthentication, async (req, res) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });
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
      LIMIT 10
    `);
    const expiringBatches = await rawSql.unsafe(`
      SELECT b.id, b.batch_number, b.current_quantity, b.expiry_date, p.name as product_name,
        (b.expiry_date - CURRENT_DATE)::integer as days_remaining
      FROM batches b
      JOIN products p ON b.product_id = p.id
      WHERE b.current_quantity > 0 
        AND b.expiry_date >= CURRENT_DATE 
        AND b.expiry_date <= CURRENT_DATE + INTERVAL '90 days'
      ORDER BY b.expiry_date ASC
      LIMIT 10
    `);
    const expiredBatches = await rawSql.unsafe(`
      SELECT b.id, b.batch_number, b.current_quantity, b.expiry_date, p.name as product_name
      FROM batches b
      JOIN products p ON b.product_id = p.id
      WHERE b.current_quantity > 0 AND b.expiry_date < CURRENT_DATE
      ORDER BY b.expiry_date DESC
      LIMIT 10
    `);
    const storedNotifications = await rawSql.unsafe(`
      SELECT * FROM notifications ORDER BY created_at DESC LIMIT 20
    `);
    return res.json({
      lowStock: lowStockItems,
      expiringSoon: expiringBatches,
      expired: expiredBatches,
      stored: storedNotifications,
      totalAlerts: lowStockItems.length + expiringBatches.length + expiredBatches.length
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch notifications" });
  }
});
notificationsRouter.get("/unread-count", requireAuthentication, async (req, res) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ count: 0 });
  try {
    const [counts] = await rawSql.unsafe(`
      SELECT 
        (
          SELECT COUNT(*)::integer FROM (
            SELECT p.id
            FROM products p
            LEFT JOIN batches b ON p.id = b.product_id
            WHERE p.is_active = true
            GROUP BY p.id, p.reorder_level
            HAVING COALESCE(SUM(CASE WHEN b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE THEN b.current_quantity ELSE 0 END), 0) <= p.reorder_level
          ) ls
        ) as low_stock_count,
        (
          SELECT COUNT(DISTINCT b.id)::integer
          FROM batches b
          WHERE b.current_quantity > 0 
            AND b.expiry_date >= CURRENT_DATE 
            AND b.expiry_date <= CURRENT_DATE + INTERVAL '90 days'
        ) as expiring_soon_count,
        (
          SELECT COUNT(*)::integer FROM notifications WHERE is_read = false
        ) as stored_unread_count
    `);
    const total = (counts?.low_stock_count || 0) + (counts?.expiring_soon_count || 0) + (counts?.stored_unread_count || 0);
    return res.json({
      count: total,
      lowStockCount: counts?.low_stock_count || 0,
      expiringSoonCount: counts?.expiring_soon_count || 0,
      storedUnreadCount: counts?.stored_unread_count || 0
    });
  } catch (err) {
    return res.json({ count: 0 });
  }
});

// src/server/routes/audit.ts
import { Router as Router15 } from "express";
var auditRouter = Router15();
auditRouter.get("/", requireAuthentication, requireRole(["OWNER"]), async (req, res) => {
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

// src/server/app.ts
function createExpressApp() {
  const app2 = express();
  app2.use(cors());
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
  return app2;
}

// api-src/index.ts
var app = createExpressApp();
var index_default = app;
export {
  index_default as default
};
