import {
  pgTable,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  date,
  uuid,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// 1. Users
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  role: text("role").notNull().default("EMPLOYEE"), // 'OWNER' | 'EMPLOYEE'
  status: text("status").notNull().default("ACTIVE"), // 'ACTIVE' | 'INACTIVE'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 2. Employee Profiles
export const employeeProfiles = pgTable("employee_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull().unique(),
  employeeCode: text("employee_code").notNull().unique(),
  position: text("position").default("Cashier"),
  hireDate: date("hire_date"),
  permissions: jsonb("permissions").default(["pos", "view_inventory"]),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 3. Pharmacy Settings
export const pharmacySettings = pgTable("pharmacy_settings", {
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
  currencySymbol: text("currency_symbol").default("GH₵"),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).default("0.00"),
  logoUrl: text("logo_url"),
  receiptFooter: text("receipt_footer").default("Thank you for your patronage! Medicines sold are not returnable once opened."),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 4. Categories
export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 5. Suppliers
export const suppliers = pgTable("suppliers", {
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 6. Products
export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  genericName: text("generic_name"),
  brandName: text("brand_name"),
  sku: text("sku").notNull().unique(),
  barcode: text("barcode").unique(),
  categoryId: uuid("category_id").references(() => categories.id),
  dosageForm: text("dosage_form"), // Tablet, Syrup, Injection, Capsule, etc.
  strength: text("strength"), // e.g. 500mg, 10ml
  unit: text("unit").default("Pack"), // Pack, Box, Bottle, Blister, Sachet
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
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 7. Product Images
export const productImages = pgTable("product_images", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  storagePath: text("storage_path").notNull(),
  url: text("url").notNull(),
  isPrimary: boolean("is_primary").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 8. Batches
export const batches = pgTable("batches", {
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
  status: text("status").notNull().default("ACTIVE"), // 'ACTIVE' | 'EXPIRED' | 'DEPLETED' | 'QUARANTINED'
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 9. Stock Movements
export const stockMovements = pgTable("stock_movements", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  batchId: uuid("batch_id").references(() => batches.id).notNull(),
  movementType: text("movement_type").notNull(), // 'INITIAL_STOCK' | 'PURCHASE' | 'SALE' | 'REFUND' | 'ADJUSTMENT' | 'DAMAGE' | 'EXPIRY' | 'RETURN' | 'SUPPLIER_RETURN' | 'VOID'
  quantityChange: integer("quantity_change").notNull(),
  previousQuantity: integer("previous_quantity").notNull(),
  newQuantity: integer("new_quantity").notNull(),
  referenceId: text("reference_id"),
  reason: text("reason"),
  userId: uuid("user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 10. Purchases
export const purchases = pgTable("purchases", {
  id: uuid("id").defaultRandom().primaryKey(),
  supplierId: uuid("supplier_id").references(() => suppliers.id).notNull(),
  invoiceNumber: text("invoice_number"),
  purchaseDate: timestamp("purchase_date").defaultNow().notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0.00"),
  status: text("status").default("RECEIVED").notNull(),
  notes: text("notes"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 11. Purchase Items
export const purchaseItems = pgTable("purchase_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  purchaseId: uuid("purchase_id").references(() => purchases.id).notNull(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  batchId: uuid("batch_id").references(() => batches.id),
  quantity: integer("quantity").notNull(),
  costPrice: numeric("cost_price", { precision: 12, scale: 2 }).notNull(),
  sellingPrice: numeric("selling_price", { precision: 12, scale: 2 }).notNull(),
  totalCost: numeric("total_cost", { precision: 12, scale: 2 }).notNull(),
  expiryDate: date("expiry_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 12. Cashier Shifts
export const cashierShifts = pgTable("cashier_shifts", {
  id: uuid("id").defaultRandom().primaryKey(),
  cashierId: uuid("cashier_id").references(() => users.id).notNull(),
  startTime: timestamp("start_time").defaultNow().notNull(),
  endTime: timestamp("end_time"),
  openingCash: numeric("opening_cash", { precision: 12, scale: 2 }).notNull().default("0.00"),
  expectedCash: numeric("expected_cash", { precision: 12, scale: 2 }).default("0.00"),
  actualCash: numeric("actual_cash", { precision: 12, scale: 2 }),
  discrepancy: numeric("discrepancy", { precision: 12, scale: 2 }).default("0.00"),
  status: text("status").default("OPEN").notNull(), // 'OPEN' | 'CLOSED'
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 13. Sales
export const sales = pgTable("sales", {
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
  totalCost: numeric("total_cost", { precision: 12, scale: 2 }).notNull().default("0.00"), // for exact gross profit
  status: text("status").default("COMPLETED").notNull(), // 'COMPLETED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'VOID'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 14. Sale Items
export const saleItems = pgTable("sale_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  saleId: uuid("sale_id").references(() => sales.id).notNull(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 12, scale: 2 }).default("0.00").notNull(),
  totalPrice: numeric("total_price", { precision: 12, scale: 2 }).notNull(),
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull().default("0.00"),
  totalCost: numeric("total_cost", { precision: 12, scale: 2 }).notNull().default("0.00"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 15. Sale Batches (FEFO allocation audit)
export const saleBatches = pgTable("sale_batches", {
  id: uuid("id").defaultRandom().primaryKey(),
  saleItemId: uuid("sale_item_id").references(() => saleItems.id).notNull(),
  batchId: uuid("batch_id").references(() => batches.id).notNull(),
  quantity: integer("quantity").notNull(),
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 16. Payments
export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  saleId: uuid("sale_id").references(() => sales.id).notNull(),
  paymentMethod: text("payment_method").notNull(), // 'CASH' | 'MTN_MOMO' | 'TELECEL_CASH' | 'AIRTELTIGO_MONEY' | 'CARD' | 'BANK_TRANSFER' | 'OTHER'
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  amountReceived: numeric("amount_received", { precision: 12, scale: 2 }),
  changeGiven: numeric("change_given", { precision: 12, scale: 2 }).default("0.00"),
  transactionReference: text("transaction_reference"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 17. Refunds
export const refunds = pgTable("refunds", {
  id: uuid("id").defaultRandom().primaryKey(),
  saleId: uuid("sale_id").references(() => sales.id).notNull(),
  refundNumber: text("refund_number").notNull().unique(),
  processedBy: uuid("processed_by").references(() => users.id).notNull(),
  totalRefundAmount: numeric("total_refund_amount", { precision: 12, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 18. Refund Items
export const refundItems = pgTable("refund_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  refundId: uuid("refund_id").references(() => refunds.id).notNull(),
  saleItemId: uuid("sale_item_id").references(() => saleItems.id).notNull(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  batchId: uuid("batch_id").references(() => batches.id),
  quantity: integer("quantity").notNull(),
  refundAmount: numeric("refund_amount", { precision: 12, scale: 2 }).notNull(),
  restock: boolean("restock").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 19. Expense Categories
export const expenseCategories = pgTable("expense_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 20. Expenses
export const expenses = pgTable("expenses", {
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 21. Notifications
export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(), // 'LOW_STOCK' | 'EXPIRING_SOON' | 'EXPIRED' | 'SHIFT_DISCREPANCY' | 'INVENTORY_ALERT'
  referenceId: text("reference_id").unique(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 22. Audit Logs
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id"),
  action: text("action").notNull(), // 'LOGIN', 'PRODUCT_CREATED', 'INITIAL_STOCK_ADDED', 'STOCK_ADDED', 'SALE_COMPLETED', 'REFUND_CREATED', etc.
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 23. Product Excel Imports (Import History)
export const productImports = pgTable("product_imports", {
  id: uuid("id").defaultRandom().primaryKey(),
  fileName: text("file_name").notNull(),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
  mode: text("mode").notNull().default("ADD_NEW"), // 'ADD_NEW' (update modes are not enabled)
  totalRows: integer("total_rows").notNull().default(0),
  importedRows: integer("imported_rows").notNull().default(0),
  duplicateRows: integer("duplicate_rows").notNull().default(0),
  failedRows: integer("failed_rows").notNull().default(0),
  stockRows: integer("stock_rows").notNull().default(0),
  batchesCreated: integer("batches_created").notNull().default(0),
  movementsCreated: integer("movements_created").notNull().default(0),
  categoriesCreated: integer("categories_created").notNull().default(0),
  status: text("status").notNull().default("COMPLETED"), // 'COMPLETED' | 'FAILED'
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const productImportsRelations = relations(productImports, ({ one }) => ({
  uploadedByUser: one(users, {
    fields: [productImports.uploadedBy],
    references: [users.id],
  }),
}));

// Relations
export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  batches: many(batches),
  images: many(productImages),
  stockMovements: many(stockMovements),
}));

export const batchesRelations = relations(batches, ({ one, many }) => ({
  product: one(products, {
    fields: [batches.productId],
    references: [products.id],
  }),
  supplier: one(suppliers, {
    fields: [batches.supplierId],
    references: [suppliers.id],
  }),
  stockMovements: many(stockMovements),
}));

export const salesRelations = relations(sales, ({ one, many }) => ({
  cashier: one(users, {
    fields: [sales.cashierId],
    references: [users.id],
  }),
  shift: one(cashierShifts, {
    fields: [sales.shiftId],
    references: [cashierShifts.id],
  }),
  items: many(saleItems),
  payments: many(payments),
  refunds: many(refunds),
}));

export const saleItemsRelations = relations(saleItems, ({ one, many }) => ({
  sale: one(sales, {
    fields: [saleItems.saleId],
    references: [sales.id],
  }),
  product: one(products, {
    fields: [saleItems.productId],
    references: [products.id],
  }),
  batches: many(saleBatches),
}));
