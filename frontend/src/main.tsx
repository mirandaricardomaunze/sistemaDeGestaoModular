import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './i18n'; // Initialize i18n
import './index.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/react-query';

import { ErrorBoundary } from './components/ErrorBoundary';
import { TenantProvider } from './contexts/TenantContext';
import { SocketProvider } from './contexts/SocketContext';
import { LoadingOverlay } from './components/ui/Loading';
import { useIdleLogout } from './hooks/useIdleLogout';
import { useEffect } from 'react';

// Layout/auth shell is only needed after the user enters protected routes.
const Layout = lazy(() => import('./components/layout/Layout'));
const ProtectedRoute = lazy(() => import('./components/auth/ProtectedRoute'));

const AppRealtimeEffects = lazy(() => import('./components/app/AppRealtimeEffects'));

const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((module) => ({
        default: module.ReactQueryDevtools,
      }))
    )
  : null;

const AppContainer = ({ children }: { children: React.ReactNode }) => {
  useIdleLogout(15); // Auto-logout after 15 minutes of inactivity

  // Warm the offline cache once authenticated and whenever we come back online.
  // Deferred via requestIdleCallback (com fallback) para não bloquear o primeiro
  // paint nem a transição login → home — ver `performance-and-caching` §4.3.
  useEffect(() => {
    const isAuthed = () => Boolean(localStorage.getItem('auth_token'));
    const schedulePrefetch = () => {
      const run = async () => {
        await import('./services/offline/legacyDbMigration')
          .then(({ migrateLegacyOfflineDB }) => migrateLegacyOfflineDB())
          .catch(() => {});
        void import('./services/offline/catalogPrefetch')
          .then(({ prefetchCatalog }) => prefetchCatalog())
          .catch(() => {});
      };
      const idle = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
      if (typeof idle === 'function') idle(() => { void run(); }, { timeout: 5000 });
      else setTimeout(() => { void run(); }, 1500);
    };
    if (isAuthed()) schedulePrefetch();
    const onOnline = () => { if (isAuthed()) schedulePrefetch(); };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <AppRealtimeEffects />
      </Suspense>
      {children}
    </>
  );
};

// Auth Pages (Lazy)
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));

// Protected Pages (Lazy)
const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Inventory = lazy(() => import('./pages/Inventory'));
const PhysicalInventoryPage = lazy(() => import('./pages/PhysicalInventoryPage'));
const POS = lazy(() => import('./pages/POS'));
const Financial = lazy(() => import('./pages/Financial'));
const AccountingPage = lazy(() => import('./pages/AccountingPage'));
const Invoices = lazy(() => import('./pages/Invoices'));
const Orders = lazy(() => import('./pages/Orders'));
const Alerts = lazy(() => import('./pages/Alerts'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/UserSettings'));
const Customers = lazy(() => import('./pages/Customers'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Categories = lazy(() => import('./pages/Categories'));
const Fiscal = lazy(() => import('./pages/Fiscal'));
const Audit = lazy(() => import('./pages/Audit'));
const Approvals = lazy(() => import('./pages/Approvals'));
const CRM = lazy(() => import('./pages/CRM'));
const BackupManagement = lazy(() => import('./pages/BackupManagement'));
const Help = lazy(() => import('./pages/Help'));
const Pharmacy = lazy(() => import('./pages/Pharmacy'));
const PharmacyDashboard = lazy(() => import('./pages/pharmacy/PharmacyDashboard'));
const PharmacyPOS = lazy(() => import('./pages/pharmacy/PharmacyPOS'));
const PharmacyEmployees = lazy(() => import('./pages/pharmacy/PharmacyEmployees'));
const PharmacyReports = lazy(() => import('./pages/pharmacy/PharmacyReports'));
const PharmacyPatients = lazy(() => import('./pages/pharmacy/PharmacyPatients'));

const PharmacyCompliance = lazy(() => import('./pages/pharmacy/PharmacyCompliance'));
const PharmacyAlerts = lazy(() => import('./pages/pharmacy/PharmacyAlerts'));
const PharmacyHistory = lazy(() => import('./pages/pharmacy/PharmacyHistory'));
const PharmacyShiftHistory = lazy(() => import('./pages/pharmacy/PharmacyShiftHistory'));
// Logistics Dashboard
const CommercialInventory = lazy(() => import('./pages/commercial/CommercialInventory'));
const CommercialPurchaseOrders = lazy(() => import('./pages/commercial/PurchaseOrders'));
const CommercialSupplierInvoices = lazy(() => import('./pages/commercial/SupplierInvoices'));
const CommercialQuotes = lazy(() => import('./pages/commercial/CommercialQuotes'));
const CommercialFinanceHub = lazy(() => import('./pages/commercial/CommercialFinanceHub'));
const CommercialReturns = lazy(() => import('./pages/commercial/CommercialReturns'));
const CommercialPOS = lazy(() => import('./pages/commercial/CommercialPOS'));
const CommercialHistoryHub = lazy(() => import('./pages/commercial/CommercialHistoryHub'));
const CommercialInsightHub = lazy(() => import('./pages/commercial/CommercialInsightHub'));
const CommercialPendingVoids = lazy(() => import('./pages/commercial/CommercialPendingVoids'));

const Hospitality = lazy(() => import('./pages/Hospitality'));
const BottleStoreDashboard = lazy(() => import('./pages/bottlestore/BottleStoreDashboard'));
const BottleStorePOS = lazy(() => import('./pages/bottlestore/BottleStorePOS'));
const BottleStoreInventory = lazy(() => import('./pages/bottlestore/BottleStoreInventory'));
const BottleStoreStock = lazy(() => import('./pages/bottlestore/BottleStoreStock'));
const BottleStoreReports = lazy(() => import('./pages/bottlestore/BottleStoreReports'));
const BottleReturns = lazy(() => import('./pages/bottlestore/BottleReturns'));
const CashRegister = lazy(() => import('./pages/bottlestore/CashRegister'));
const CreditSales = lazy(() => import('./pages/bottlestore/CreditSales'));
const StockMovements = lazy(() => import('./pages/StockMovements'));
const WarehousesPage = lazy(() => import('./pages/WarehousesPage'));
const TransfersPage = lazy(() => import('./pages/TransfersPage'));
const SuperAdminDashboard = lazy(() => import('./pages/SuperAdmin/SuperAdminDashboard'));

// Hotel Module Pages (Lazy)
// Restaurant Module Pages (Lazy)
const RestaurantDashboard = lazy(() => import('./pages/restaurant/RestaurantDashboard'));
const RestaurantTables = lazy(() => import('./pages/restaurant/RestaurantTables'));
const RestaurantPOS = lazy(() => import('./pages/restaurant/RestaurantPOS'));
const RestaurantMenuPage = lazy(() => import('./pages/restaurant/RestaurantMenuPage'));
const RestaurantKitchenPage = lazy(() => import('./pages/restaurant/RestaurantKitchenPage'));
const RestaurantReservationsPage = lazy(() => import('./pages/restaurant/RestaurantReservationsPage'));
const RestaurantReports = lazy(() => import('./pages/restaurant/RestaurantReports'));
const RestaurantFinance = lazy(() => import('./pages/restaurant/RestaurantFinance'));

// Pharmacy additional pages
const PharmacyControl = lazy(() => import('./pages/PharmacyControl'));
const PharmacyPartners = lazy(() => import('./pages/pharmacy/PharmacyPartners'));
const PharmacyStockReconciliation = lazy(() => import('./pages/pharmacy/PharmacyStockReconciliation'));
const PharmacyFinance = lazy(() => import('./pages/pharmacy/PharmacyFinance'));

const HotelDashboard = lazy(() => import('./pages/hotel/HotelDashboard'));
const HotelRooms = lazy(() => import('./pages/hotel/HotelRooms'));
const HotelReservations = lazy(() => import('./pages/hotel/HotelReservations'));
const HotelEmployees = lazy(() => import('./pages/hotel/HotelEmployees'));
const HotelCustomers = lazy(() => import('./pages/hotel/HotelCustomers'));
const HotelSuppliers = lazy(() => import('./pages/hotel/HotelSuppliers'));
const HotelCategories = lazy(() => import('./pages/hotel/HotelCategories'));
const HotelReports = lazy(() => import('./pages/hotel/HotelReports'));
const HotelFinance = lazy(() => import('./pages/hotel/HotelFinance'));
const HotelHousekeeping = lazy(() => import('./pages/hotel/HotelHousekeeping'));

// Logistics Module Pages (Lazy)
const LogisticsDashboard = lazy(() => import('./pages/logistics/LogisticsDashboard'));
const VehiclesPage = lazy(() => import('./pages/logistics/VehiclesPage'));
const DriversPage = lazy(() => import('./pages/logistics/DriversPage'));
const RoutesPage = lazy(() => import('./pages/logistics/RoutesPage'));
const DeliveriesPage = lazy(() => import('./pages/logistics/DeliveriesPage'));
const ParcelsPage = lazy(() => import('./pages/logistics/ParcelsPage'));
const MaintenancePage = lazy(() => import('./pages/logistics/MaintenancePage'));
const FuelPage = lazy(() => import('./pages/logistics/FuelPage'));
const IncidentsPage = lazy(() => import('./pages/logistics/IncidentsPage'));
const LogisticsReportsPage = lazy(() => import('./pages/logistics/LogisticsReportsPage'));
const DriverPanelPage = lazy(() => import('./pages/logistics/DriverPanelPage'));
const LogisticsHRPage = lazy(() => import('./pages/logistics/LogisticsHRPage'));
const LogisticsFinance = lazy(() => import('./pages/logistics/LogisticsFinance'));
const BottleStoreFinance = lazy(() => import('./pages/bottlestore/BottleStoreFinance'));
const HRHub = lazy(() => import('./pages/hr/HRHub'));
const RestaurantEmployees = lazy(() => import('./pages/restaurant/RestaurantEmployees'));
const BottleStoreEmployees = lazy(() => import('./pages/bottlestore/BottleStoreEmployees'));
const CalendarPage = lazy(() => import('./pages/Calendar'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <SocketProvider>
          <TenantProvider>
            <AppContainer>
              <ErrorBoundary>
              <Suspense fallback={<LoadingOverlay fullScreen />}>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />

                  {/* Protected Routes */}
                  <Route path="/" element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }>
                    <Route index element={<Home />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="inventory" element={<Inventory />} />
                    <Route path="inventory/physical" element={<PhysicalInventoryPage />} />
                    <Route path="warehouses" element={<WarehousesPage />} />
                    <Route path="transfers" element={<TransfersPage />} />
                    <Route path="stock-movements" element={<StockMovements />} />
                    <Route path="pos" element={<POS />} />
                    <Route path="employees" element={<HRHub />} />
                    <Route path="hr" element={<HRHub />} />
                    <Route path="financial" element={<Financial />} />
                    <Route path="accounting" element={<AccountingPage />} />
                    <Route path="invoices" element={<Invoices />} />
                    <Route path="orders" element={<Orders />} />
                    <Route path="customers" element={<Customers />} />
                    <Route path="suppliers" element={<Suppliers />} />
                    <Route path="categories" element={<Categories />} />
                    <Route path="alerts" element={<Alerts />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="fiscal" element={<Fiscal />} />
                    <Route path="audit" element={<Audit />} />
                    <Route path="approvals" element={<Approvals />} />
                    <Route path="crm" element={<CRM />} />
                    <Route path="backups" element={<BackupManagement />} />

                    {/* Pharmacy Module */}
                    <Route path="pharmacy" element={<Navigate to="/pharmacy/dashboard" replace />} />
                    <Route path="pharmacy/dashboard" element={<PharmacyDashboard />} />
                    <Route path="pharmacy/manage" element={<Pharmacy />} />
                    <Route path="pharmacy/pos" element={<PharmacyPOS />} />
                    <Route path="pharmacy/patients" element={<PharmacyPatients />} />
                    <Route path="pharmacy/compliance" element={<PharmacyCompliance />} />
                    <Route path="pharmacy/partners" element={<PharmacyPartners />} />
                    <Route path="pharmacy/reports" element={<PharmacyReports />} />
                    <Route path="pharmacy/alerts" element={<PharmacyAlerts />} />
                    <Route path="pharmacy/reconciliation" element={<PharmacyStockReconciliation />} />
                    <Route path="pharmacy/history" element={<PharmacyHistory />} />
                    <Route path="pharmacy/shifts" element={<PharmacyShiftHistory />} />
                    <Route path="pharmacy/finance" element={<PharmacyFinance />} />
                    {/* Legacy routes kept for backwards compatibility */}
                    <Route path="pharmacy/employees" element={<PharmacyEmployees />} />
                    <Route path="pharmacy/categories" element={<Categories originModule="pharmacy" />} />
                    <Route path="pharmacy/suppliers" element={<Suppliers originModule="pharmacy" />} />
                    <Route path="pharmacy/control" element={<PharmacyControl />} />
                    <Route path="pharmacy/narcotics" element={<Navigate to="/pharmacy/compliance" replace />} />
                    <Route path="pharmacy/recalls" element={<Navigate to="/pharmacy/compliance" replace />} />
                    <Route path="pharmacy/billing" element={<Navigate to="/pharmacy/partners" replace />} />

                    {/* Logistics Module */}
                    <Route path="logistics" element={<Navigate to="/logistics/dashboard" replace />} />
                    <Route path="logistics/dashboard" element={<LogisticsDashboard />} />
                    <Route path="logistics/vehicles" element={<VehiclesPage />} />
                    <Route path="logistics/drivers" element={<DriversPage />} />
                    <Route path="logistics/hr" element={<LogisticsHRPage />} />
                    <Route path="logistics/routes" element={<RoutesPage />} />
                    <Route path="logistics/deliveries" element={<DeliveriesPage />} />
                    <Route path="logistics/parcels" element={<ParcelsPage />} />
                    <Route path="logistics/maintenance" element={<MaintenancePage />} />
                    <Route path="logistics/fuel" element={<FuelPage />} />
                    <Route path="logistics/incidents" element={<IncidentsPage />} />
                    <Route path="logistics/reports" element={<LogisticsReportsPage />} />
                    <Route path="logistics/finance" element={<LogisticsFinance />} />
                    <Route path="logistics/driver-panel" element={<DriverPanelPage />} />

                    {/* Commercial Module Routes */}
                    <Route path="commercial" element={<Navigate to="/commercial/dashboard" replace />} />
                    <Route path="commercial/dashboard" element={<CommercialInsightHub />} />
                    <Route path="commercial/reports" element={<CommercialInsightHub />} />
                    <Route path="commercial/margins" element={<CommercialInsightHub />} />
                    <Route path="commercial/insights" element={<CommercialInsightHub />} />
                    <Route path="commercial/pos" element={<CommercialPOS />} />
                    <Route path="commercial/history" element={<CommercialHistoryHub />} />
                    <Route path="commercial/stock" element={<CommercialHistoryHub />} />
                    <Route path="commercial/inventory" element={<CommercialInventory />} />
                    <Route path="commercial/invoices" element={<Invoices originModule="commercial" />} />
                    <Route path="commercial/orders" element={<Orders originModule="commercial" />} />
                    <Route path="commercial/customers" element={<Customers originModule="commercial" />} />
                    <Route path="commercial/categories" element={<Categories originModule="commercial" />} />
                    <Route path="commercial/suppliers" element={<Suppliers originModule="commercial" />} />
                    <Route path="commercial/purchase-orders" element={<CommercialPurchaseOrders />} />
                    <Route path="commercial/supplier-invoices" element={<CommercialSupplierInvoices />} />
                    <Route path="commercial/quotes" element={<CommercialQuotes />} />
                    <Route path="commercial/accounts-receivable" element={<CommercialFinanceHub />} />
                    <Route path="commercial/finance" element={<CommercialFinanceHub />} />
                    <Route path="commercial/returns" element={<CommercialReturns />} />
                    <Route path="commercial/pending-voids" element={<CommercialPendingVoids />} />
                    <Route path="commercial/employees" element={<HRHub />} />
                    <Route path="commercial/settings" element={<Navigate to="/settings" replace />} />
                    <Route path="commercial/audit" element={<CommercialHistoryHub />} />
                    <Route path="commercial/shifts" element={<CommercialHistoryHub />} />

                    {/* Restaurant Module */}
                    <Route path="restaurant" element={<Navigate to="/restaurant/dashboard" replace />} />
                    <Route path="restaurant/dashboard" element={<RestaurantDashboard />} />
                    <Route path="restaurant/tables" element={<RestaurantTables />} />
                    <Route path="restaurant/finance" element={<RestaurantFinance />} />
                    <Route path="restaurant/pos" element={<RestaurantPOS />} />
                    <Route path="restaurant/menu" element={<RestaurantMenuPage />} />
                    <Route path="restaurant/kitchen" element={<RestaurantKitchenPage />} />
                    <Route path="restaurant/reservations" element={<RestaurantReservationsPage />} />
                    <Route path="restaurant/reports" element={<RestaurantReports />} />
                    <Route path="restaurant/employees" element={<RestaurantEmployees />} />

                    {/* Hospitality Module */}
                    <Route path="hospitality" element={<Navigate to="/hospitality/dashboard" replace />} />
                    <Route path="hospitality/dashboard" element={<HotelDashboard />} />
                    <Route path="hotel" element={<Navigate to="/hospitality/dashboard" replace />} />
                    <Route path="hotel/*" element={<Navigate to="/hospitality/dashboard" replace />} />
                    <Route path="hospitality/ops" element={<Hospitality />} />
                    <Route path="hospitality/finance" element={<HotelFinance />} />
                    <Route path="hospitality/rooms" element={<HotelRooms />} />
                    <Route path="hospitality/reservations" element={<HotelReservations />} />
                    <Route path="hospitality/housekeeping" element={<HotelHousekeeping />} />
                    <Route path="hospitality/customers" element={<HotelCustomers />} />
                    <Route path="hospitality/suppliers" element={<HotelSuppliers />} />
                    <Route path="hospitality/categories" element={<HotelCategories />} />
                    <Route path="hospitality/reports" element={<HotelReports />} />
                    <Route path="hospitality/employees" element={<HotelEmployees />} />

                    {/* Bottle Store Module */}
                    <Route path="bottleStore" element={<Navigate to="/bottle-store/dashboard" replace />} />
                    <Route path="bottle-store/dashboard" element={<BottleStoreDashboard />} />
                    <Route path="bottle-store/pos" element={<BottleStorePOS />} />
                    <Route path="bottle-store/inventory" element={<BottleStoreInventory />} />
                    <Route path="bottle-store/stock" element={<BottleStoreStock />} />
                    <Route path="bottle-store/reports" element={<BottleStoreReports />} />
                    <Route path="bottle-store/finance" element={<BottleStoreFinance />} />
                    <Route path="bottle-store/employees" element={<BottleStoreEmployees />} />
                    <Route path="bottle-store/returns" element={<BottleReturns />} />
                    <Route path="bottle-store/cash" element={<CashRegister />} />
                    <Route path="bottle-store/credit" element={<CreditSales />} />

                    <Route path="calendar" element={<CalendarPage />} />
                    <Route path="super-admin" element={<SuperAdminDashboard />} />
                    <Route path="help" element={<Help />} />
                    <Route path="settings" element={<Settings />} />
                  </Route>
                </Routes>
              </Suspense>
              </ErrorBoundary>
            </AppContainer>
          </TenantProvider>
        </SocketProvider>
        {ReactQueryDevtools && (
          <Suspense fallback={null}>
            <ReactQueryDevtools initialIsOpen={false} />
          </Suspense>
        )}
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>
);

