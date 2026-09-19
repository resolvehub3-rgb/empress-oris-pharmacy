# Empress Oris Herbal & Mart - Enterprise Pharmacy Management & POS System

A production-ready Pharmacy Management and Point of Sale (POS) application tailored for Ghanaian retail and herbal pharmacies. Built with **React 18**, **Vite**, **Express**, **Tailwind CSS**, and **Supabase PostgreSQL** with real-time inventory monitoring, FEFO batch allocation, barcode printing, camera scanning, and cash drawer shift reconciliation.

---

## Table of Contents
1. [Core Features & Capabilities](#core-features--capabilities)
2. [System Architecture & Workflow](#system-architecture--workflow)
3. [Visual Low Stock Notification System](#visual-low-stock-notification-system)
4. [Prerequisites](#prerequisites)
5. [Supabase Backend Setup Guide](#supabase-backend-setup-guide)
   - [1. Create Supabase Project](#1-create-supabase-project)
   - [2. Execute Database Schema Migration](#2-execute-database-schema-migration)
   - [3. Configure Supabase Storage Buckets](#3-configure-supabase-storage-buckets)
   - [4. Enable Supabase Realtime Broadcasts](#4-enable-supabase-realtime-broadcasts)
6. [Project Setup & Local Installation](#project-setup--local-installation)
   - [1. Clone and Install](#1-clone-and-install)
   - [2. Environment Variables Configuration](#2-environment-variables-configuration)
   - [3. Run the Application](#3-run-the-application)
7. [Testing the Real-Time Notification Workflow](#testing-the-real-time-notification-workflow)
8. [Production Deployment](#production-deployment)

---

## Core Features & Capabilities

- **Ghana-Specific Pharmacy Compliance**:
  - Currency natively handled in Ghana Cedis (`GH₵` / `GHS`).
  - Mobile Money (MTN MoMo, Vodafone/Telecel Cash, AirtelTigo Money) & Cash receipt printing.
  - Prescription (`Rx`) drug flags and dosage/strength specifications.
- **Strict Real-Time Database**:
  - All business operations synchronize with **Supabase PostgreSQL**.
  - **Zero mock data, zero sample records, zero fake APIs** — operates flawlessly from an empty database up to high-volume pharmacy records.
- **FEFO Inventory & Batch Tracking**:
  - First-Expired, First-Out (FEFO) dispensing ensures older batches are sold first to prevent pharmaceutical expiration losses.
  - Granular batch tracking with manufacturing and expiry dates, supplier linkage, cost price, and selling price.
- **Camera QR & Barcode Scanner**:
  - Built-in camera viewfinder utilizing `html5-qrcode` to scan product QR codes and 1D retail barcodes (Code 128, EAN-13, UPC, Code 39) with continuous scanning mode, camera toggle, and torch control.
- **Barcode & Label Generator**:
  - Generate and print vector SVG barcodes via `jsbarcode` formatted for thermal label rolls (50mm × 30mm), A4 multi-label sticker sheets, or compact shelf-edge tags.
- **Cashier Shift & Till Management**:
  - Cash drawer opening float recording.
  - Physical closing cash count with automatic calculation of cash variance (overage/shortage) and audit trail.
- **Real-Time Visual Low Stock Notification System**:
  - Live Supabase-monitored dashboard alert panel tracking items at or below minimum safety levels (`reorder_level`).
  - Urgency categorization (`OUT OF STOCK`, `CRITICAL ≤ 50%`, `LOW STOCK`).
  - 1-Click "+ Restock Batch" pre-fill action to replenish inventory instantly.

---

## System Architecture & Workflow

### 1. Role-Based Access Control (RBAC)
- **Owner / Administrator**: Full access to financial metrics, gross profit, inventory valuation, stock receiving, supplier management, user management, and pharmacy settings.
- **Employee / Cashier**: Streamlined interface focusing on POS terminal checkout, camera scanning, customer sales, shift opening/closing, and receipt printing.

### 2. End-to-End Operational Workflow
```
[1. First-Time Setup]
       │
       ▼
Owner Registers Account ──► Configures Pharmacy Name, License, Logo & Rates
       │
       ▼
[2. Inventory Setup]
Add Categories & Suppliers ──► Add Medicine + Initial Batch (Qty, Expiry, Cost, Price, Reorder Level)
       │
       ▼
[3. Shift Management]
Cashier Opens Shift ──► Records Opening Cash Float in Drawer
       │
       ▼
[4. Point of Sale (POS)]
Scan Barcode (Camera / USB) or Search ──► FEFO Batch Auto-Allocation ──► Checkout (Cash/MoMo/Card)
       │                                                                         │
       ▼                                                                         ▼
Supabase Realtime Broadcasts Inventory Depletion                   Print Thermal Receipt
       │
       ▼
[5. Real-Time Alert Triggering]
Stock falls below `reorder_level` ──► Dashboard Visual Low Stock Alert Panel Updates Instantly
       │
       ▼
[6. Shift Closing & Audit]
Cashier Counts Drawer ──► System Calculates Expected vs Actual Cash ──► Shift Report Saved
```

---

## Visual Low Stock Notification System

The Low Stock Alert System monitors live batch quantities against defined minimum reorder thresholds:
1. **Dynamic Database Calculation**:
   - Evaluates active, non-expired quantities across all batches per product:
   ```sql
   COALESCE(SUM(CASE WHEN b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE THEN b.current_quantity ELSE 0 END), 0) <= p.reorder_level
   ```
2. **Urgency Classification**:
   - **`OUT OF STOCK`**: 0 units remaining.
   - **`CRITICAL`**: Stock is &le; 50% of the reorder threshold.
   - **`LOW STOCK`**: Stock is below the minimum threshold.
3. **Live Supabase Sync**:
   - Whenever a sale is completed or inventory is adjusted, Supabase broadcasts a notification over the `pharmacy-realtime` channel.
   - The dashboard updates its `lowStockCount` and product breakdown without requiring a page refresh.
4. **Direct Restock Action**:
   - Clicking **"+ Restock Batch"** on any alert card opens the stock intake modal with the exact medicine pre-selected for quick batch creation.

---

## Prerequisites

- **Node.js**: Version 18.x or higher
- **npm**: Version 9.x or higher
- **Supabase Account**: [https://supabase.com](https://supabase.com) (Free or Pro tier)

---

## Supabase Backend Setup Guide

### 1. Create Supabase Project
1. Log in to your [Supabase Dashboard](https://supabase.com/dashboard) and click **New Project**.
2. Set the project name (e.g., `empress-oris-pharmacy`).
3. Set a strong database password (keep this safe for your `DATABASE_URL`).
4. Select the region closest to your operations (e.g., `eu-west-1` or `eu-central-1`).
5. After creation, go to **Project Settings** > **API**:
   - Note your **Project URL** (`https://[PROJECT-REF].supabase.co`).
   - Copy the **`anon` `public` key**.
   - Copy the **`service_role` `secret` key**.
6. Go to **Project Settings** > **Database**:
   - Find your **Connection string** under URI (Node.js/Direct connection).

---

### 2. Execute Database Schema Migration

1. Open your Supabase Dashboard and navigate to the **SQL Editor**.
2. Click **New query**.
3. Paste and run the following migration script to create the complete schema:

```sql
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users & Authentication
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'EMPLOYEE',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  password_hash TEXT,
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
  city TEXT DEFAULT 'Accra',
  region TEXT DEFAULT 'Greater Accra',
  payment_terms TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Products
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  sku TEXT NOT NULL UNIQUE,
  barcode TEXT UNIQUE,
  name TEXT NOT NULL,
  generic_name TEXT,
  brand_name TEXT,
  dosage_form TEXT,
  strength TEXT,
  unit TEXT NOT NULL DEFAULT 'Pieces',
  pack_size INTEGER NOT NULL DEFAULT 1,
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

-- 7. Batches (FEFO Inventory)
CREATE TABLE IF NOT EXISTS batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  batch_number TEXT NOT NULL,
  initial_quantity INTEGER NOT NULL,
  current_quantity INTEGER NOT NULL,
  cost_price NUMERIC(12, 2) NOT NULL,
  selling_price NUMERIC(12, 2) NOT NULL,
  manufacturing_date DATE,
  expiry_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Cashier Shifts
CREATE TABLE IF NOT EXISTS cashier_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  opening_cash NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  expected_cash NUMERIC(12, 2),
  actual_cash NUMERIC(12, 2),
  cash_variance NUMERIC(12, 2),
  status TEXT NOT NULL DEFAULT 'OPEN',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Sales
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT NOT NULL UNIQUE,
  cashier_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  shift_id UUID REFERENCES cashier_shifts(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_phone TEXT,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  cost_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Sale Items
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(12, 2) NOT NULL,
  unit_cost NUMERIC(12, 2) NOT NULL,
  discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_price NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  transaction_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  category TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  description TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for high-performance POS queries
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_batches_fefo ON batches(product_id, expiry_date, current_quantity);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
```

4. Click **Run** to execute the query.

---

### 3. Configure Supabase Storage Buckets

1. In Supabase Dashboard, go to **Storage**.
2. Click **New bucket** and create:
   - **`product-images`**:
     - Make **Public bucket**: `ON`
     - File size limit: `5MB`
     - Allowed MIME types: `image/jpeg, image/png, image/webp`
   - **`pharmacy-assets`**:
     - Make **Public bucket**: `ON`
     - File size limit: `5MB`
     - Allowed MIME types: `image/jpeg, image/png, image/webp`
3. The server also automatically verifies and creates these buckets during startup via `ensureStorageBuckets()`.

---

### 4. Enable Supabase Realtime Broadcasts

1. In Supabase Dashboard, navigate to **Database** > **Replication**.
2. Under **Supabase Realtime**, enable replication for:
   - `products`
   - `batches`
   - `sales`
   - `cashier_shifts`
3. Broadcast messages are published over the `pharmacy-realtime` channel. Both server and client listen to this channel to synchronize stock changes, new products, and sales without page reloads.

---

## Project Setup & Local Installation

### 1. Clone and Install
```bash
# Clone the repository
git clone https://github.com/your-org/empress-oris-pharmacy.git
cd empress-oris-pharmacy

# Install required dependencies
pnpm install
```

### 2. Environment Variables Configuration
Copy the `.env.example` file to `.env`:
```bash
cp .env.example .env
```

Configure your `.env` file with your real Supabase credentials:
```env
# Server-side Supabase Credentials
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOi..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."

# Client-side Supabase Credentials (prefixed with VITE_ for Vite bundle)
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOi..."

# Direct PostgreSQL Connection for raw SQL queries & migrations
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# Application Port
PORT=3000
NODE_ENV="development"
```

### 3. Run the Application

```bash
# Start development server (serves Express + Vite on port 3000)
npm run dev

# Run TypeScript type check
npm run lint

# Build production bundle
npm run build

# Start production server
npm start
```

Access the application in your browser at `http://localhost:3000`.

---

## Testing the Real-Time Notification Workflow

Follow this procedure to test and verify the live visual low stock notification system:

1. **First-Time Owner Registration**:
   - Launch the application; since the database is empty, the first screen is the Owner Registration form.
   - Enter your name, email, phone number, and password to create the Owner account.
2. **Add a Product with Low Stock**:
   - In the Dashboard or Products Catalog, click **"Add Product + Initial Stock"**.
   - Enter product details:
     - Name: `Amoxicillin 500mg Capsules`
     - SKU: `AMX-500`
     - Reorder Level: `20` units
     - Initial Stock: `5` units (below reorder level of 20)
     - Batch Number: `BATCH-001`
     - Expiry Date: Future date (e.g., 1 year ahead)
     - Selling Price: `GH₵ 25.00`
   - Click **"Save Product & Opening Batch"**.
3. **Verify the Live Visual Alert in Dashboard**:
   - The Dashboard will immediately display the **Low Stock Alert Panel**:
     - Header: `1 Product Below Minimum Safety Level` with a live Supabase pinging indicator.
     - Product Card: Shows `Amoxicillin 500mg Capsules`, current stock `5 / 20 units`, `Deficit: -15 units`, status badge `CRITICAL ≤ 50%`.
4. **Test Real-Time POS Depletion**:
   - Open a cashier shift and open the **POS Terminal**.
   - Sell 5 units of `Amoxicillin 500mg Capsules` using Cash or MoMo.
   - Complete the sale.
   - Switch back to the **Dashboard** in another tab:
     - Notice that without refreshing the page, the card status automatically updates to **`OUT OF STOCK`** with 0 units remaining.
5. **Test 1-Click Restock**:
   - Click the **"+ Restock Batch"** button directly on the low stock card.
   - The Stock Intake modal opens with `Amoxicillin 500mg Capsules` automatically selected.
   - Enter a new batch of 50 units and submit.
   - The dashboard updates in real-time: the alert clears or re-evaluates, showing **"Inventory Stock Levels Optimal"**.

---

## Native Desktop App (PWA) for Employees & Administrators

The application is engineered as a **Progressive Web Application (PWA)**, allowing it to run as a native desktop or mobile application without needing third-party wrapper runtimes.

### Key Benefits
- **Dedicated Native Window**: Opens in a standalone, clean window without browser address bars, tabs, or navigation buttons.
- **Taskbar / Dock Integration**: Pin Empress Oris directly to the Windows Taskbar, macOS Dock, or Linux application launcher.
- **Role Support**: Both **Administrators** (for dashboard metrics, inventory valuation, stock receiving) and **Employees/Cashiers** (for full-screen POS terminal checkout and barcode scanning) can install and run the app natively.
- **Application Shortcuts**: Right-click the app icon on your desktop or dock to launch directly into **POS Terminal**, **Dashboard**, or **Products Catalog**.
- **Hardware Acceleration**: Full access to attached USB thermal receipt printers, USB laser barcode scanners, and webcams for barcode scanning.

### How to Install

#### Windows (Chrome / Edge / Brave):
1. Navigate to the application URL in Google Chrome or Microsoft Edge.
2. Click the **"Install App"** / **"Desktop App"** button located in the top navigation bar, sidebar, or dashboard banner.
3. Alternatively, click the install icon in the browser address bar (top right `⊕` or computer icon).
4. Click **"Install"** on the prompt. Empress Oris will launch in its own native desktop window with a desktop shortcut created automatically.

#### macOS (Chrome / Safari / Edge):
1. Open the application in Chrome, Edge, or Safari (macOS Sonoma 14+).
2. Click the **"Install App"** button or select **File > Add to Dock** in Safari.
3. Click **"Install"**. The app will be placed in your `Applications` folder and macOS Dock.

#### Mobile (Android & iOS):
- **Android (Chrome)**: Tap the "Download App" button or tap Chrome menu `⋮` > **"Add to Home screen"** / **"Install app"**.
- **iPhone / iPad (Safari)**: Tap the Share button `⎋` > **"Add to Home Screen"** > **"Add"**.

---

## Mobile Responsive Architecture

The Admin Dashboard and operational views are fully responsive across smartphones, tablets, and desktop workstations:
- **Off-Canvas Navigation Drawer**: On mobile viewports (`< 1024px`), navigation collapses into a smooth slide-out drawer accessible via the hamburger menu button in the top bar.
- **Mobile-Optimized KPI Metric Cards**: High-density 2-column mobile layout displaying sales, revenue, stock valuation, and gross margins without excessive vertical scrolling.
- **Touch-Friendly POS & Alerts**: 44px+ touch targets, responsive pill filters, and card-based transaction feeds replacing wide desktop tables on small screens.
- **Dynamic Viewport Padding**: Fluid spacing (`p-3.5` on mobile to `p-8` on desktop) ensuring maximum screen real estate for cashiers and pharmacists.

---

## Production Deployment

### Container / Cloud Run Deployment
The application is pre-configured with a self-contained production bundle:
1. `npm run build` compiles client assets into `/dist` and bundles the Express server into `dist/server.cjs` via `esbuild`.
2. The server binds to host `0.0.0.0` and port `3000`.
3. Set your production environment variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`) in your cloud container secrets manager.
4. Launch via `npm start`.

---

© Empress Oris Herbal & Mart. All rights reserved.
