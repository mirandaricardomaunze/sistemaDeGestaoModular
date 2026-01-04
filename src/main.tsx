import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store';
import './i18n'; // Initialize i18n
import './index.css';

// Layout
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { TenantProvider } from './contexts/TenantContext';

// Auth Pages
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';

// Protected Pages
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';

import Inventory from './pages/Inventory';
import POS from './pages/POS';
import Employees from './pages/Employees';
import Financial from './pages/Financial';
import Invoices from './pages/Invoices';
import Orders from './pages/Orders';
import Alerts from './pages/Alerts';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Customers from './pages/Customers';
import Suppliers from './pages/Suppliers';
import Categories from './pages/Categories';
import Fiscal from './pages/Fiscal';
import Audit from './pages/Audit';
import CRM from './pages/CRM';
import BackupManagement from './pages/BackupManagement';
import Pharmacy from './pages/Pharmacy';
import PharmacyDashboard from './pages/pharmacy/PharmacyDashboard';
import PharmacyPOS from './pages/pharmacy/PharmacyPOS';
import PharmacyEmployees from './pages/pharmacy/PharmacyEmployees';
import PharmacyCategories from './pages/pharmacy/PharmacyCategories';
import PharmacySuppliers from './pages/pharmacy/PharmacySuppliers';
import LogisticsDashboard from './pages/LogisticsDashboard';
import Hospitality from './pages/Hospitality';
import BottleStore from './pages/BottleStore';
import SuperAdminDashboard from './pages/SuperAdmin/SuperAdminDashboard';

// Hotel Module Pages
import HotelDashboard from './pages/hotel/HotelDashboard';
import HotelRooms from './pages/hotel/HotelRooms';
import HotelReservations from './pages/hotel/HotelReservations';
import HotelEmployees from './pages/hotel/HotelEmployees';
import HotelCustomers from './pages/hotel/HotelCustomers';
import HotelSuppliers from './pages/hotel/HotelSuppliers';
import HotelCategories from './pages/hotel/HotelCategories';
import HotelReports from './pages/hotel/HotelReports';
import HotelFinance from './pages/hotel/HotelFinance';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <TenantProvider>
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
              <Route path="pharmacy" element={<Pharmacy />} />
              <Route path="pharmacy/dashboard" element={<PharmacyDashboard />} />
              <Route path="pharmacy/pos" element={<PharmacyPOS />} />
              <Route path="pharmacy/employees" element={<PharmacyEmployees />} />
              <Route path="pharmacy/categories" element={<PharmacyCategories />} />
              <Route path="pharmacy/suppliers" element={<PharmacySuppliers />} />
              <Route path="logistics" element={<LogisticsDashboard />} />
              <Route path="hospitality" element={<Hospitality />} />
              <Route path="bottle-store" element={<BottleStore />} />

              {/* Hotel Module Routes */}
              <Route path="hotel" element={<HotelDashboard />} />
              <Route path="hotel/finance" element={<HotelFinance />} />
              <Route path="hotel/rooms" element={<HotelRooms />} />
              <Route path="hotel/reservations" element={<HotelReservations />} />
              <Route path="hotel/employees" element={<HotelEmployees />} />
              <Route path="hotel/customers" element={<HotelCustomers />} />
              <Route path="hotel/suppliers" element={<HotelSuppliers />} />
              <Route path="hotel/categories" element={<HotelCategories />} />
              <Route path="hotel/reports" element={<HotelReports />} />

              <Route path="super-admin" element={<SuperAdminDashboard />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </TenantProvider>
      </BrowserRouter>
    </Provider>
  </StrictMode>
);
