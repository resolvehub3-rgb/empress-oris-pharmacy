export type UserRole = "OWNER" | "ADMIN" | "EMPLOYEE";

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  role: UserRole;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
}

export interface PharmacySettings {
  id: string;
  name: string;
  legalName?: string | null;
  licenseNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city: string;
  region: string;
  country: string;
  currency: string;
  currencySymbol: string;
  taxRate?: string | null;
  logoUrl?: string | null;
  receiptFooter?: string | null;
}

export interface Category {
  id: string;
  name: string;
  description?: string | null;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string | null;
  phone: string;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  paymentTerms?: string | null;
  notes?: string | null;
  status: string;
  createdAt: string;
}

export interface Batch {
  id: string;
  productId?: string;
  batchNumber: string;
  supplierId?: string | null;
  supplierName?: string | null;
  initialQuantity: number;
  currentQuantity: number;
  costPrice: string;
  sellingPrice: string;
  manufacturingDate?: string | null;
  expiryDate: string;
  status: "ACTIVE" | "EXPIRED" | "DEPLETED" | "QUARANTINED";
  notes?: string | null;
  productName?: string;
  productSku?: string;
  dosageForm?: string;
  strength?: string;
  isExpired?: boolean;
  isExpiringSoon?: boolean;
  daysUntilExpiry?: number;
}

export interface Product {
  id: string;
  name: string;
  genericName?: string | null;
  generic_name?: string | null;
  brandName?: string | null;
  brand_name?: string | null;
  sku: string;
  barcode?: string | null;
  categoryId?: string | null;
  category_id?: string | null;
  categoryName?: string | null;
  category_name?: string | null;
  dosageForm?: string | null;
  dosage_form?: string | null;
  strength?: string | null;
  unit?: string;
  packSize?: number;
  pack_size?: number;
  manufacturer?: string | null;
  description?: string | null;
  prescriptionRequired?: boolean;
  prescription_required?: boolean;
  imageUrl?: string | null;
  image_url?: string | null;
  reorderLevel: number;
  reorder_level?: number;
  sellingPrice: string;
  selling_price?: string;
  wholesalePrice?: string | null;
  wholesale_price?: string | null;
  isActive?: boolean;
  is_active?: boolean;
  totalStock: number;
  total_stock?: number;
  expiredStock?: number;
  batchCount?: number;
  batches?: Batch[];
  createdAt?: string;
  created_at?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  discount: number;
  totalPrice: number;
}

export interface CashierShift {
  id: string;
  cashierId: string;
  cashierName?: string;
  cashierEmail?: string;
  startTime: string;
  endTime?: string | null;
  openingCash: string;
  expectedCash?: string | null;
  actualCash?: string | null;
  discrepancy?: string | null;
  status: "OPEN" | "CLOSED";
  notes?: string | null;
  salesCount?: number;
  totalRevenue?: string;
}

export interface Sale {
  id: string;
  receiptNumber: string;
  cashierId: string;
  cashierName?: string;
  shiftId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  subtotal: string;
  discount: string;
  tax: string;
  totalAmount: string;
  totalCost: string;
  status: "COMPLETED" | "REFUNDED" | "PARTIALLY_REFUNDED" | "VOID";
  paymentMethod?: string;
  amountReceived?: string;
  changeGiven?: string;
  transactionReference?: string;
  itemCount?: number;
  createdAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  batchId: string;
  batchNumber: string;
  expiryDate?: string;
  movementType: string;
  quantityChange: number;
  previousQuantity: number;
  newQuantity: number;
  referenceId?: string | null;
  reason?: string | null;
  userName?: string | null;
  createdAt: string;
}

export interface Expense {
  id: string;
  title: string;
  amount: string;
  categoryId?: string | null;
  categoryName?: string | null;
  expenseDate: string;
  receiptReference?: string | null;
  paidTo?: string | null;
  paymentMethod: string;
  recordedByName?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface LowStockProduct {
  id: string;
  name: string;
  generic_name?: string | null;
  sku: string;
  barcode?: string | null;
  category_name?: string | null;
  dosage_form?: string | null;
  strength?: string | null;
  reorder_level: number;
  selling_price?: string;
  prescription_required?: boolean;
  current_stock: number;
  stock_deficit: number;
  urgency: "OUT_OF_STOCK" | "CRITICAL" | "LOW";
}

export interface DashboardData {
  sales: {
    todaySales: string;
    todayTransactions: number;
    weekSales: string;
    monthSales: string;
    totalRevenue: string;
  };
  inventory: {
    totalProducts: number;
    totalUnits: number;
    inventoryValuation: string;
    lowStockCount: number;
    expiringSoonCount: number;
    expiredBatchesCount: number;
  };
  finance: {
    revenue: string;
    costOfGoodsSold: string;
    grossProfit: string;
    expenses: string;
    monthExpenses: string;
    netProfit: string;
    grossMarginPercent: string;
  };
  employees: {
    activeCount: number;
    openShifts: number;
  };
  recentTransactions: Sale[];
  lowStockProducts?: LowStockProduct[];
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  referenceId?: string | null;
  createdAt: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId?: string | null;
  supplierName?: string | null;
  status: string;
  totalAmount: string;
  invoiceNumber?: string | null;
  notes?: string | null;
  createdAt: string;
}

