import { Router, Request, Response } from "express";
import { getRawSql } from "../../db";
import { requireAuthentication, requireRole } from "../middleware/auth";

export const reportsRouter = Router();

// Owner Dashboard real statistics
reportsRouter.get("/dashboard", requireAuthentication, requireRole(["OWNER"]), async (req: Request, res: Response) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });

  try {
    // 1. Sales metrics (Today, Week, Month)
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

    // 2. Inventory metrics
    const [inventoryMetrics] = await rawSql.unsafe(`
      SELECT 
        (SELECT COUNT(*)::integer FROM products WHERE is_active = true) as total_products,
        COALESCE(SUM(CASE WHEN b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE THEN b.current_quantity ELSE 0 END), 0)::integer as total_units,
        COALESCE(SUM(CASE WHEN b.current_quantity > 0 AND b.expiry_date >= CURRENT_DATE THEN b.current_quantity * b.cost_price ELSE 0 END), 0)::numeric(12,2) as inventory_valuation,
        COALESCE(COUNT(DISTINCT CASE WHEN b.expiry_date < CURRENT_DATE AND b.current_quantity > 0 THEN b.id END), 0)::integer as expired_batches_count,
        COALESCE(COUNT(DISTINCT CASE WHEN b.expiry_date >= CURRENT_DATE AND b.expiry_date <= CURRENT_DATE + INTERVAL '90 days' AND b.current_quantity > 0 THEN b.id END), 0)::integer as expiring_soon_count
      FROM batches b
    `);

    // Low stock count (products where current stock <= reorder_level)
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

    // Specific products below minimum stock levels
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

    // 3. Expenses total
    const [expensesData] = await rawSql.unsafe(`
      SELECT 
        COALESCE(SUM(amount), 0)::numeric(12,2) as total_expenses,
        COALESCE(SUM(CASE WHEN expense_date >= DATE_TRUNC('month', CURRENT_DATE) THEN amount ELSE 0 END), 0)::numeric(12,2) as month_expenses
      FROM expenses
    `);

    // 4. Employees & Shifts
    const [shiftsData] = await rawSql.unsafe(`
      SELECT 
        (SELECT COUNT(*)::integer FROM users WHERE role = 'EMPLOYEE' AND status = 'ACTIVE') as active_employees,
        (SELECT COUNT(*)::integer FROM cashier_shifts WHERE status = 'OPEN') as open_shifts
    `);

    // 5. Recent Transactions
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

    // Calculate Gross Profit & Net Profit
    const revenue = parseFloat(salesMetrics?.total_revenue || "0");
    const cogs = parseFloat(salesMetrics?.total_cogs || "0");
    const grossProfit = Math.max(0, revenue - cogs);
    const expenses = parseFloat(expensesData?.total_expenses || "0");
    const netProfit = grossProfit - expenses;

    return res.json({
      sales: {
        todaySales: salesMetrics?.today_sales || "0.00",
        todayTransactions: salesMetrics?.today_transactions || 0,
        weekSales: salesMetrics?.week_sales || "0.00",
        monthSales: salesMetrics?.month_sales || "0.00",
        totalRevenue: revenue.toFixed(2),
      },
      inventory: {
        totalProducts: inventoryMetrics?.total_products || 0,
        totalUnits: inventoryMetrics?.total_units || 0,
        inventoryValuation: inventoryMetrics?.inventory_valuation || "0.00",
        lowStockCount: lowStockData?.low_stock_count || 0,
        expiringSoonCount: inventoryMetrics?.expiring_soon_count || 0,
        expiredBatchesCount: inventoryMetrics?.expired_batches_count || 0,
      },
      finance: {
        revenue: revenue.toFixed(2),
        costOfGoodsSold: cogs.toFixed(2),
        grossProfit: grossProfit.toFixed(2),
        expenses: expenses.toFixed(2),
        monthExpenses: expensesData?.month_expenses || "0.00",
        netProfit: netProfit.toFixed(2),
        grossMarginPercent: revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : "0.0",
      },
      employees: {
        activeCount: shiftsData?.active_employees || 0,
        openShifts: shiftsData?.open_shifts || 0,
      },
      recentTransactions: recentSales,
      lowStockProducts: lowStockProducts || [],
    });
  } catch (err: any) {
    console.error("[Dashboard Reports] Error:", err);
    return res.status(500).json({ error: err.message || "Failed to generate dashboard reports" });
  }
});

// Sales Report with breakdown by payment method and items
reportsRouter.get("/sales", requireAuthentication, requireRole(["OWNER"]), async (req: Request, res: Response) => {
  const rawSql = getRawSql();
  if (!rawSql) return res.status(503).json({ error: "Database not connected." });

  const { startDate, endDate } = req.query;

  try {
    const dateFilter = startDate && endDate
      ? `AND s.created_at >= '${startDate}'::timestamptz AND s.created_at <= '${endDate} 23:59:59'::timestamptz`
      : "";

    // Payment methods breakdown
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

    // Top selling products
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
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch sales report" });
  }
});
