import { getRawSql } from "./index";

export const INIT_SCHEMA_SQL = `
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
  currency_symbol TEXT DEFAULT 'GH₵',
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

-- Migration: add unique constraint on reference_id if missing
DO $$ BEGIN
  ALTER TABLE notifications ADD CONSTRAINT notifications_reference_id_unique UNIQUE (reference_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
`;

export async function runSchemaInit() {
  const sql = getRawSql();
  if (!sql) {
    console.log("[DB Init] No raw SQL client available (DATABASE_URL not configured yet).");
    return false;
  }
  try {
    await sql.unsafe(INIT_SCHEMA_SQL);
    // Ensure any legacy default name is updated to Empress Oris Herbal & Mart
    await sql.unsafe(`
      UPDATE pharmacy_settings 
      SET name = 'Empress Oris Herbal & Mart' 
      WHERE name = 'HealthFirst Pharmacy' OR name = 'RxDispense Ghana' OR name ILIKE '%HealthFirst%';
    `).catch(() => {});
    console.log("[DB Init] Successfully verified and initialized all 22 database tables!");
    return true;
  } catch (err) {
    console.error("[DB Init] Error running schema initialization:", err);
    return false;
  }
}
