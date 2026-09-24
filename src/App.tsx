import React, { useState, useEffect, lazy, Suspense } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Navbar } from "./components/Navbar";
import { Sidebar, NavTab } from "./components/Sidebar";

// Pages are code-split so a cashier terminal only downloads the POS chunk on
// first paint instead of the whole application (dashboard, reports, Excel
// import, barcode printing, ...).
import { AuthPage } from "./pages/AuthPage";

const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage }))
);
const PosPage = lazy(() => import("./pages/PosPage").then((m) => ({ default: m.PosPage })));
const ProductsPage = lazy(() =>
  import("./pages/ProductsPage").then((m) => ({ default: m.ProductsPage }))
);
const BatchesPage = lazy(() =>
  import("./pages/BatchesPage").then((m) => ({ default: m.BatchesPage }))
);
const StockMovementsPage = lazy(() =>
  import("./pages/StockMovementsPage").then((m) => ({ default: m.StockMovementsPage }))
);
const SalesPage = lazy(() => import("./pages/SalesPage").then((m) => ({ default: m.SalesPage })));
const ShiftsPage = lazy(() => import("./pages/ShiftsPage").then((m) => ({ default: m.ShiftsPage })));
const SuppliersPage = lazy(() =>
  import("./pages/SuppliersPage").then((m) => ({ default: m.SuppliersPage }))
);
const PurchasesPage = lazy(() =>
  import("./pages/PurchasesPage").then((m) => ({ default: m.PurchasesPage }))
);
const ExpensesPage = lazy(() =>
  import("./pages/ExpensesPage").then((m) => ({ default: m.ExpensesPage }))
);
const EmployeesPage = lazy(() =>
  import("./pages/EmployeesPage").then((m) => ({ default: m.EmployeesPage }))
);
const ReportsPage = lazy(() =>
  import("./pages/ReportsPage").then((m) => ({ default: m.ReportsPage }))
);
const NotificationsPage = lazy(() =>
  import("./pages/NotificationsPage").then((m) => ({ default: m.NotificationsPage }))
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage }))
);

function PageLoader() {
  return (
    <div className="h-full min-h-[50vh] flex items-center justify-center p-8">
      <div className="w-7 h-7 border-[3px] border-teal-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// Dialogs are only fetched when someone actually opens them, keeping the
// cashier's initial POS download as small as possible.
const AddProductModal = lazy(() =>
  import("./components/AddProductModal").then((m) => ({ default: m.AddProductModal }))
);
const AddStockModal = lazy(() =>
  import("./components/AddStockModal").then((m) => ({ default: m.AddStockModal }))
);
const OpenShiftModal = lazy(() =>
  import("./components/OpenShiftModal").then((m) => ({ default: m.OpenShiftModal }))
);
const CloseShiftModal = lazy(() =>
  import("./components/CloseShiftModal").then((m) => ({ default: m.CloseShiftModal }))
);

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
      // The dashboard report runs ~8 aggregate queries. Cashiers never use its
      // results (low-stock/expiry badges are owner-only), so POS terminals
      // skip it entirely instead of competing with the product search query.
      user.role === "EMPLOYEE"
        ? Promise.resolve(null)
        : apiRequest<any>("/api/reports/dashboard"),
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

      // Realtime subscription for pharmacy events.
      // Coalesce bursts (imports/stock updates fire several events in a row)
      // into a single refetch instead of hammering the API.
      let refetchTimer: ReturnType<typeof setTimeout> | null = null;
      const scheduleAuxRefetch = () => {
        if (refetchTimer) return;
        refetchTimer = setTimeout(() => {
          refetchTimer = null;
          fetchAuxData();
        }, 500);
      };

      const unsubscribe = subscribeToPharmacyRealtime(scheduleAuxRefetch);

      return () => {
        if (refetchTimer) clearTimeout(refetchTimer);
        unsubscribe();
      };
    }
  }, [user]);

  // Status and profile load in parallel (AuthContext), so a logged-out first
  // paint waits for the setup status before choosing between the sign-in form
  // and the initial-setup form - no flash of the wrong screen.
  if (authLoading || (!user && !status)) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <img src="/logo.png" alt="Empress Oris Logo" className="w-40 h-40 mx-auto rounded-3xl object-contain shadow-2xl" />
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
          <Suspense fallback={<PageLoader />}>
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
                onDataChanged={fetchAuxData}
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
          </Suspense>
        </main>
      </div>

      {/* Unified Add Product + Initial Stock Modal */}
      {isAddProductOpen && (
        <Suspense fallback={null}>
          <AddProductModal
            isOpen={isAddProductOpen}
            onClose={() => setIsAddProductOpen(false)}
            onSuccess={handleAddProductSuccess}
            categories={categories}
            suppliers={suppliers}
          />
        </Suspense>
      )}

      {/* Add Stock / Replenishment Modal */}
      {isAddStockOpen && (
        <Suspense fallback={null}>
          <AddStockModal
            isOpen={isAddStockOpen}
            onClose={() => setIsAddStockOpen(false)}
            onSuccess={handleAddStockSuccess}
            suppliers={suppliers}
            initialProduct={selectedProductForStock}
          />
        </Suspense>
      )}

      {/* Open Cashier Shift Modal */}
      {isOpenShiftOpen && (
        <Suspense fallback={null}>
          <OpenShiftModal
            isOpen={isOpenShiftOpen}
            onClose={() => setIsOpenShiftOpen(false)}
            onSuccess={handleShiftSuccess}
          />
        </Suspense>
      )}

      {/* Close Cashier Shift & Reconciliation Modal */}
      {isCloseShiftOpen && (
        <Suspense fallback={null}>
          <CloseShiftModal
            isOpen={isCloseShiftOpen}
            onClose={() => setIsCloseShiftOpen(false)}
            onSuccess={handleShiftSuccess}
            shiftData={activeShift}
          />
        </Suspense>
      )}
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
