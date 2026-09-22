import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Navbar } from "./components/Navbar";
import { Sidebar, NavTab } from "./components/Sidebar";
import { AddProductModal } from "./components/AddProductModal";
import { AddStockModal } from "./components/AddStockModal";
import { OpenShiftModal } from "./components/OpenShiftModal";
import { CloseShiftModal } from "./components/CloseShiftModal";

// Pages
import { AuthPage } from "./pages/AuthPage";
import { DashboardPage } from "./pages/DashboardPage";
import { PosPage } from "./pages/PosPage";
import { ProductsPage } from "./pages/ProductsPage";
import { BatchesPage } from "./pages/BatchesPage";
import { StockMovementsPage } from "./pages/StockMovementsPage";
import { SalesPage } from "./pages/SalesPage";
import { ShiftsPage } from "./pages/ShiftsPage";
import { SuppliersPage } from "./pages/SuppliersPage";
import { PurchasesPage } from "./pages/PurchasesPage";
import { ExpensesPage } from "./pages/ExpensesPage";
import { EmployeesPage } from "./pages/EmployeesPage";
import { ReportsPage } from "./pages/ReportsPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { SettingsPage } from "./pages/SettingsPage";

import { apiRequest } from "./lib/api";
import { subscribeToPharmacyRealtime } from "./lib/supabaseClient";
import { Category, Supplier, Product } from "./types";

function MainApp() {
  const { user, status, loading: authLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>("dashboard");

  useEffect(() => {
    if (user?.role === "EMPLOYEE") {
      setCurrentTab("pos");
    }
  }, [user]);

  // Global state
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [activeShift, setActiveShift] = useState<any | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [expiringSoonCount, setExpiringSoonCount] = useState(0);

  // Modals state
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [selectedProductForStock, setSelectedProductForStock] = useState<Product | undefined>(undefined);
  const [isOpenShiftOpen, setIsOpenShiftOpen] = useState(false);
  const [isCloseShiftOpen, setIsCloseShiftOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Fetch reference data and active shift
  const fetchAuxData = async () => {
    if (!user) return;

    const [catsResult, suppsResult, shiftResult, notifResult, statsResult] = await Promise.allSettled([
      apiRequest<{ categories: Category[] }>("/api/categories"),
      apiRequest<{ suppliers: Supplier[] }>("/api/suppliers"),
      apiRequest<{ shift: any }>("/api/shifts/current"),
      apiRequest<{ count: number }>("/api/notifications/unread-count"),
      apiRequest<any>("/api/reports/dashboard"),
    ]);

    if (catsResult.status === "fulfilled") setCategories(catsResult.value.categories || []);
    if (suppsResult.status === "fulfilled") setSuppliers(suppsResult.value.suppliers || []);
    if (shiftResult.status === "fulfilled") setActiveShift(shiftResult.value.shift || null);
    if (notifResult.status === "fulfilled") setUnreadNotifications(notifResult.value.count || 0);
    if (statsResult.status === "fulfilled" && statsResult.value?.inventory) {
      setLowStockCount(statsResult.value.inventory.lowStockCount || 0);
      setExpiringSoonCount(statsResult.value.inventory.expiringSoonCount || 0);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAuxData();

      // Realtime subscription for pharmacy events
      const unsubscribe = subscribeToPharmacyRealtime((event, payload) => {
        // Refetch auxiliary counts on any realtime event
        fetchAuxData();
      });

      return () => {
        unsubscribe();
      };
    }
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <img src="/logo.png" alt="Empress Oris Logo" className="w-20 h-20 mx-auto rounded-2xl object-contain shadow-lg" />
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-300 tracking-wider uppercase">
            Connecting to SamTeck Digital System...
          </p>
        </div>
      </div>
    );
  }

  // If user is not logged in or first-time setup needed
  if (!user || status?.hasOwner === false) {
    return <AuthPage />;
  }

  const handleOpenAddStock = (prod?: Product) => {
    setSelectedProductForStock(prod);
    setIsAddStockOpen(true);
  };

  const handleAddProductSuccess = () => {
    fetchAuxData();
  };

  const handleAddStockSuccess = () => {
    fetchAuxData();
  };

  const handleShiftSuccess = () => {
    fetchAuxData();
  };

  return (
    <div className="h-screen flex flex-col bg-slate-100 text-slate-900 font-sans overflow-hidden">
      {/* Global Top Navigation Bar */}
      <Navbar
        onOpenShiftClick={() => setIsOpenShiftOpen(true)}
        onCloseShiftClick={() => setIsCloseShiftOpen(true)}
        hasOpenShift={!!activeShift}
        shiftData={activeShift}
        notificationCount={unreadNotifications}
        onNotificationsClick={() => setCurrentTab("notifications")}
        onAddProductClick={() => setIsAddProductOpen(true)}
        onToggleMobileMenu={() => setIsMobileNavOpen((prev) => !prev)}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={(tab) => {
            setCurrentTab(tab);
            setIsMobileNavOpen(false);
          }}
          notificationCount={unreadNotifications}
          lowStockCount={lowStockCount}
          expiringSoonCount={expiringSoonCount}
          isMobileOpen={isMobileNavOpen}
          onCloseMobile={() => setIsMobileNavOpen(false)}
        />

        {/* Content View Container */}
        <main className="flex-1 overflow-y-auto">
          {currentTab === "dashboard" && (
            <DashboardPage
              onNavigate={setCurrentTab}
              onAddProductClick={() => setIsAddProductOpen(true)}
              onAddStockClick={(prod) => handleOpenAddStock(prod)}
              lowStockCount={lowStockCount}
            />
          )}

          {currentTab === "pos" && (
            <PosPage
              onOpenShiftClick={() => setIsOpenShiftOpen(true)}
              hasOpenShift={!!activeShift}
            />
          )}

          {currentTab === "products" && (
            <ProductsPage
              onAddProductClick={() => setIsAddProductOpen(true)}
              onAddStockClick={handleOpenAddStock}
              categories={categories}
            />
          )}

          {currentTab === "batches" && <BatchesPage />}

          {currentTab === "movements" && <StockMovementsPage />}

          {currentTab === "sales" && <SalesPage />}

          {currentTab === "shifts" && (
            <ShiftsPage
              onOpenShiftClick={() => setIsOpenShiftOpen(true)}
              onCloseShiftClick={() => setIsCloseShiftOpen(true)}
              hasOpenShift={!!activeShift}
            />
          )}

          {currentTab === "suppliers" && <SuppliersPage />}

          {currentTab === "purchases" && <PurchasesPage />}

          {currentTab === "expenses" && <ExpensesPage />}

          {currentTab === "employees" && <EmployeesPage />}

          {currentTab === "reports" && <ReportsPage />}

          {currentTab === "notifications" && <NotificationsPage />}

          {currentTab === "audit" && <StockMovementsPage />}

          {currentTab === "settings" && <SettingsPage />}
        </main>
      </div>

      {/* Unified Add Product + Initial Stock Modal */}
      <AddProductModal
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
        onSuccess={handleAddProductSuccess}
        categories={categories}
        suppliers={suppliers}
      />

      {/* Add Stock / Replenishment Modal */}
      <AddStockModal
        isOpen={isAddStockOpen}
        onClose={() => setIsAddStockOpen(false)}
        onSuccess={handleAddStockSuccess}
        suppliers={suppliers}
        initialProduct={selectedProductForStock}
      />

      {/* Open Cashier Shift Modal */}
      <OpenShiftModal
        isOpen={isOpenShiftOpen}
        onClose={() => setIsOpenShiftOpen(false)}
        onSuccess={handleShiftSuccess}
      />

      {/* Close Cashier Shift & Reconciliation Modal */}
      <CloseShiftModal
        isOpen={isCloseShiftOpen}
        onClose={() => setIsCloseShiftOpen(false)}
        onSuccess={handleShiftSuccess}
        shiftData={activeShift}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
