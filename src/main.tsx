import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './i18n'; // Initialize i18n
import './index.css';

// Layout
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { TenantProvider } from './contexts/TenantContext';
import { LoadingOverlay } from './components/ui/Loading';
import { useIdleLogout } from './hooks/useIdleLogout';

const AppContainer = ({ children }: { children: React.ReactNode }) => {
  useIdleLogout(15); // Auto-logout after 15 minutes of inactivity
  return <>{children}</>;
};

// Auth Pages (Lazy)
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));

// Protected Pages (Lazy)
const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Inventory = lazy(() => import('./pages/Inventory'));
const POS = lazy(() => import('./pages/POS'));
const Employees = lazy(() => import('./pages/Employees'));
const Financial = lazy(() => import('./pages/Financial'));
const Invoices = lazy(() => import('./pages/Invoices'));
const Orders = lazy(() => import('./pages/Orders'));
const Alerts = lazy(() => import('./pages/Alerts'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));
const Customers = lazy(() => import('./pages/Customers'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Categories = lazy(() => import('./pages/Categories'));
const Fiscal = lazy(() => import('./pages/Fiscal'));
const Audit = lazy(() => import('./pages/Audit'));
const CRM = lazy(() => import('./pages/CRM'));
const BackupManagement = lazy(() => import('./pages/BackupManagement'));
const Help = lazy(() => import('./pages/Help'));
const Pharmacy = lazy(() => import('./pages/Pharmacy'));
const PharmacyDashboard = lazy(() => import('./pages/pharmacy/PharmacyDashboard'));
const PharmacyPOS = lazy(() => import('./pages/pharmacy/PharmacyPOS'));
const PharmacyEmployees = lazy(() => import('./pages/pharmacy/PharmacyEmployees'));
const PharmacyCategories = lazy(() => import('./pages/pharmacy/PharmacyCategories'));
const PharmacySuppliers = lazy(() => import('./pages/pharmacy/PharmacySuppliers'));
const PharmacyReports = lazy(() => import('./pages/pharmacy/PharmacyReports'));
const LogisticsDashboard = lazy(() => import('./pages/logistics/LogisticsDashboard'));
// Commercial Module Pages (Lazy)
const CommercialDashboard = lazy(() => import('./pages/commercial/CommercialDashboard'));
const CommercialCategories = lazy(() => import('./pages/commercial/CommercialCategories'));
const CommercialSuppliers = lazy(() => import('./pages/commercial/CommercialSuppliers'));

const Hospitality = lazy(() => import('./pages/Hospitality'));
const BottleStoreDashboard = lazy(() => import('./pages/bottlestore/BottleStoreDashboard'));
const BottleStorePOS = lazy(() => import('./pages/bottlestore/BottleStorePOS'));
const BottleStoreInventory = lazy(() => import('./pages/bottlestore/BottleStoreInventory'));
const BottleStoreStock = lazy(() => import('./pages/bottlestore/BottleStoreStock'));
const BottleStoreReports = lazy(() => import('./pages/bottlestore/BottleStoreReports'));
const BottleReturns = lazy(() => import('./pages/bottlestore/BottleReturns'));
const CashRegister = lazy(() => import('./pages/bottlestore/CashRegister'));
const CreditSales = lazy(() => import('./pages/bottlestore/CreditSales'));
const SuperAdminDashboard = lazy(() => import('./pages/SuperAdmin/SuperAdminDashboard'));

// Hotel Module Pages (Lazy)
const HotelDashboard = lazy(() => import('./pages/hotel/HotelDashboard'));
const HotelRooms = lazy(() => import('./pages/hotel/HotelRooms'));
const HotelReservations = lazy(() => import('./pages/hotel/HotelReservations'));
const HotelEmployees = lazy(() => import('./pages/hotel/HotelEmployees'));
const HotelCustomers = lazy(() => import('./pages/hotel/HotelCustomers'));
const HotelSuppliers = lazy(() => import('./pages/hotel/HotelSuppliers'));
const HotelCategories = lazy(() => import('./pages/hotel/HotelCategories'));
const HotelReports = lazy(() => import('./pages/hotel/HotelReports'));
const HotelFinance = lazy(() => import('./pages/hotel/HotelFinance'));

// Logistics Module Pages (Lazy)
const VehiclesPage = lazy(() => import('./pages/logistics/VehiclesPage'));
const DriversPage = lazy(() => import('./pages/logistics/DriversPage'));
const RoutesPage = lazy(() => import('./pages/logistics/RoutesPage'));
const DeliveriesPage = lazy(() => import('./pages/logistics/DeliveriesPage'));
const ParcelsPage = lazy(() => import('./pages/logistics/ParcelsPage'));
const MaintenancePage = lazy(() => import('./pages/logistics/MaintenancePage'));
const LogisticsReportsPage = lazy(() => import('./pages/logistics/LogisticsReportsPage'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <TenantProvider>
        <AppContainer>
          <Suspense fallback={<LoadingOverlay fullScreen />}>
            <Routes>
              {/* Auth Routes (Public) */}
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
                <Route path="pharmacy/employees" element={<PharmacyEmployees />} />
                <Route path="pharmacy/categories" element={<PharmacyCategories />} />
                <Route path="pharmacy/suppliers" element={<PharmacySuppliers />} />
                <Route path="pharmacy/reports" element={<PharmacyReports />} />

                {/* Logistics Module */}
                <Route path="logistics" element={<Navigate to="/logistics/dashboard" replace />} />
                <Route path="logistics/dashboard" element={<LogisticsDashboard />} />
                <Route path="logistics/vehicles" element={<VehiclesPage />} />
                <Route path="logistics/drivers" element={<DriversPage />} />
                <Route path="logistics/routes" element={<RoutesPage />} />
                <Route path="logistics/deliveries" element={<DeliveriesPage />} />
                <Route path="logistics/parcels" element={<ParcelsPage />} />
                <Route path="logistics/maintenance" element={<MaintenancePage />} />
                <Route path="logistics/reports" element={<LogisticsReportsPage />} />

                {/* Commercial Module Routes */}
                <Route path="commercial" element={<Navigate to="/commercial/dashboard" replace />} />
                <Route path="commercial/dashboard" element={<CommercialDashboard />} />
                <Route path="commercial/categories" element={<CommercialCategories />} />
                <Route path="commercial/suppliers" element={<CommercialSuppliers />} />

                {/* Hospitality Module */}
                <Route path="hospitality" element={<Navigate to="/hospitality/dashboard" replace />} />
                <Route path="hospitality/dashboard" element={<HotelDashboard />} />
                <Route path="hospitality/ops" element={<Hospitality />} />
                <Route path="hospitality/finance" element={<HotelFinance />} />
                <Route path="hospitality/rooms" element={<HotelRooms />} />
                <Route path="hospitality/reservations" element={<HotelReservations />} />
                <Route path="hospitality/customers" element={<HotelCustomers />} />
                <Route path="hospitality/suppliers" element={<HotelSuppliers />} />
                <Route path="hospitality/categories" element={<HotelCategories />} />
                <Route path="hospitality/reports" element={<HotelReports />} />
                <Route path="hospitality/employees" element={<HotelEmployees />} />

                {/* Bottle Store Module */}
                <Route path="bottle-store" element={<Navigate to="/bottle-store/dashboard" replace />} />
                <Route path="bottle-store/dashboard" element={<BottleStoreDashboard />} />
                <Route path="bottle-store/pos" element={<BottleStorePOS />} />
                <Route path="bottle-store/inventory" element={<BottleStoreInventory />} />
                <Route path="bottle-store/stock" element={<BottleStoreStock />} />
                <Route path="bottle-store/reports" element={<BottleStoreReports />} />
                <Route path="bottle-store/returns" element={<BottleReturns />} />
                <Route path="bottle-store/cash" element={<CashRegister />} />
                <Route path="bottle-store/credit" element={<CreditSales />} />

                <Route path="super-admin" element={<SuperAdminDashboard />} />
                <Route path="help" element={<Help />} />
                <Route path="settings" element={<Settings />} />
              </Route>
            </Routes>
          </Suspense>
        </AppContainer>
      </TenantProvider>
    </BrowserRouter>
  </StrictMode>
);
