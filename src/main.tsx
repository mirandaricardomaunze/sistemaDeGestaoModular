import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './i18n'; // Initialize i18n
import './index.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Layout
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TenantProvider } from './contexts/TenantContext';
import { SocketProvider } from './contexts/SocketContext';
import { useNotifications } from './hooks/useNotifications';
import { LoadingOverlay } from './components/ui/Loading';
import { useIdleLogout } from './hooks/useIdleLogout';

const AppContainer = ({ children }: { children: React.ReactNode }) => {
  useIdleLogout(15); // Auto-logout after 15 minutes of inactivity
  useNotifications(); // Initialize real-time notification listeners
  return <>{children}</>;
};

// Auth Pages (Lazy)
const Login = lazy(() => import('./pages/login'));
const Register = lazy(() => import('./pages/register'));
const ForgotPassword = lazy(() => import('./pages/forgotPassword'));

// Protected Pages (Lazy)
const Home = lazy(() => import('./pages/home'));
const Dashboard = lazy(() => import('./pages/dashboard'));
const Inventory = lazy(() => import('./pages/inventory'));
const POS = lazy(() => import('./pages/pos'));
const Employees = lazy(() => import('./pages/employees'));
const Financial = lazy(() => import('./pages/financial'));
const Invoices = lazy(() => import('./pages/invoices'));
const Orders = lazy(() => import('./pages/orders'));
const Alerts = lazy(() => import('./pages/alerts'));
const Reports = lazy(() => import('./pages/reports'));
const Settings = lazy(() => import('./pages/settings'));
const Customers = lazy(() => import('./pages/customers'));
const Suppliers = lazy(() => import('./pages/suppliers'));
const Categories = lazy(() => import('./pages/categories'));
const Fiscal = lazy(() => import('./pages/fiscal'));
const Audit = lazy(() => import('./pages/audit'));
const CRM = lazy(() => import('./pages/crm'));
const BackupManagement = lazy(() => import('./pages/backupManagement'));
const Help = lazy(() => import('./pages/help'));
const Pharmacy = lazy(() => import('./pages/pharmacy'));
const PharmacyDashboard = lazy(() => import('./pages/pharmacy/PharmacyDashboard'));
const PharmacyPOS = lazy(() => import('./pages/pharmacy/PharmacyPOS'));
const PharmacyEmployees = lazy(() => import('./pages/pharmacy/PharmacyEmployees'));
const PharmacyCategories = lazy(() => import('./pages/pharmacy/PharmacyCategories'));
const PharmacySuppliers = lazy(() => import('./pages/pharmacy/PharmacySuppliers'));
const PharmacyReports = lazy(() => import('./pages/pharmacy/PharmacyReports'));
const PharmacyPatients = lazy(() => import('./pages/pharmacy/PharmacyPatients'));

const PharmacyCompliance = lazy(() => import('./pages/pharmacy/PharmacyCompliance'));
const PharmacyAlerts = lazy(() => import('./pages/pharmacy/PharmacyAlerts'));
const PharmacyHistory = lazy(() => import('./pages/pharmacy/PharmacyHistory'));
const PharmacyShiftHistory = lazy(() => import('./pages/pharmacy/PharmacyShiftHistory'));
// Logistics Dashboard
const CommercialDashboard = lazy(() => import('./pages/commercial/CommercialDashboard'));
const CommercialInventory = lazy(() => import('./pages/commercial/CommercialInventory'));
const CommercialCategories = lazy(() => import('./pages/commercial/CommercialCategories'));
const CommercialSuppliers = lazy(() => import('./pages/commercial/CommercialSuppliers'));
const CommercialReports = lazy(() => import('./pages/commercial/CommercialReports'));
const CommercialPurchaseOrders = lazy(() => import('./pages/commercial/PurchaseOrders'));
const CommercialMarginAnalysis = lazy(() => import('./pages/commercial/MarginAnalysis'));
const CommercialQuotes = lazy(() => import('./pages/commercial/CommercialQuotes'));
const AccountsReceivable = lazy(() => import('./pages/commercial/AccountsReceivable'));
const CommercialPOS = lazy(() => import('./pages/commercial/CommercialPOS'));
const CommercialHistory = lazy(() => import('./pages/commercial/CommercialHistory'));
const CommercialInvoices = lazy(() => import('./pages/commercial/CommercialInvoices'));
const CommercialStockMovements = lazy(() => import('./pages/commercial/CommercialStockMovements'));
const CommercialOrders = lazy(() => import('./pages/commercial/CommercialOrders'));
const CommercialCustomers = lazy(() => import('./pages/commercial/CommercialCustomers'));
const CommercialAuditLogs = lazy(() => import('./pages/commercial/CommercialAuditLogs'));
const CommercialShiftHistory = lazy(() => import('./pages/commercial/CommercialShiftHistory'));

const Hospitality = lazy(() => import('./pages/hospitality'));
const BottleStoreDashboard = lazy(() => import('./pages/bottlestore/BottleStoreDashboard'));
const BottleStorePOS = lazy(() => import('./pages/bottlestore/BottleStorePOS'));
const BottleStoreInventory = lazy(() => import('./pages/bottlestore/BottleStoreInventory'));
const BottleStoreStock = lazy(() => import('./pages/bottlestore/BottleStoreStock'));
const BottleStoreReports = lazy(() => import('./pages/bottlestore/BottleStoreReports'));
const BottleReturns = lazy(() => import('./pages/bottlestore/BottleReturns'));
const CashRegister = lazy(() => import('./pages/bottlestore/CashRegister'));
const CreditSales = lazy(() => import('./pages/bottlestore/CreditSales'));
const StockMovements = lazy(() => import('./pages/stockMovements'));
const WarehousesPage = lazy(() => import('./pages/warehousesPage'));
const TransfersPage = lazy(() => import('./pages/transfersPage'));
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

// Pharmacy additional pages
const PharmacyControl = lazy(() => import('./pages/pharmacyControl'));
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
const RestaurantFinance = lazy(() => import('./pages/restaurant/RestaurantFinance'));
const CommercialFinance = lazy(() => import('./pages/commercial/CommercialFinance'));
const CommercialEmployees = lazy(() => import('./pages/commercial/CommercialEmployees'));
const RestaurantEmployees = lazy(() => import('./pages/restaurant/RestaurantEmployees'));
const BottleStoreEmployees = lazy(() => import('./pages/bottlestore/BottleStoreEmployees'));

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
                    <Route path="warehouses" element={<WarehousesPage />} />
                    <Route path="transfers" element={<TransfersPage />} />
                    <Route path="stock-movements" element={<StockMovements />} />
                    <Route path="pos" element={<POS />} />
                    <Route path="employees" element={<Employees />} />
                    <Route path="financial" element={<Financial />} />
                    <Route path="invoices" element={<Invoices />} />
                    <Route path="orders" element={<Orders />} />
                    <Route path="customers" element={<Customers />} />
                    <Route path="suppliers" element={<Suppliers />} />
                    <Route path="categories" element={<Categories />} />
                    <Route path="alerts" element={<Alerts />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="fiscal" element={<Fiscal />} />
                    <Route path="audit" element={<Audit />} />
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
                    <Route path="pharmacy/categories" element={<PharmacyCategories />} />
                    <Route path="pharmacy/suppliers" element={<PharmacySuppliers />} />
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
                    <Route path="commercial/dashboard" element={<CommercialDashboard />} />
                    <Route path="commercial/pos" element={<CommercialPOS />} />
                    <Route path="commercial/history" element={<CommercialHistory />} />
                    <Route path="commercial/stock" element={<CommercialStockMovements />} />
                    <Route path="commercial/inventory" element={<CommercialInventory />} />
                    <Route path="commercial/invoices" element={<CommercialInvoices />} />
                    <Route path="commercial/orders" element={<CommercialOrders />} />
                    <Route path="commercial/customers" element={<CommercialCustomers />} />
                    <Route path="commercial/categories" element={<CommercialCategories />} />
                    <Route path="commercial/suppliers" element={<CommercialSuppliers />} />
                    <Route path="commercial/reports" element={<CommercialReports />} />
                    <Route path="commercial/purchase-orders" element={<CommercialPurchaseOrders />} />
                    <Route path="commercial/margins" element={<CommercialMarginAnalysis />} />
                    <Route path="commercial/quotes" element={<CommercialQuotes />} />
                    <Route path="commercial/accounts-receivable" element={<AccountsReceivable />} />
                    <Route path="commercial/finance" element={<CommercialFinance />} />
                    <Route path="commercial/employees" element={<CommercialEmployees />} />
                    <Route path="commercial/settings" element={<Navigate to="/settings" replace />} />
                    <Route path="commercial/audit" element={<CommercialAuditLogs />} />
                    <Route path="commercial/shifts" element={<CommercialShiftHistory />} />

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
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>
);

