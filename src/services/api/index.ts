// ============================================================================
// API Services - Barrel Export
// ============================================================================
// 
// This file exports all modular API services from a single entry point.
// Import from this file instead of individual API files for convenience.
//
// Usage:
//   import { authAPI, productsAPI, salesAPI } from '@/services/api';
//
// ============================================================================

// Base axios client
export { default as api } from './client';

// Auth & Admin
export { authAPI } from './auth.api';
export { adminAPI, modulesAPI, type BusinessModule } from './admin.api';

// Core Business
export { productsAPI } from './products.api';
export { customersAPI } from './customers.api';
export { suppliersAPI } from './suppliers.api';
export { salesAPI } from './sales.api';
export { invoicesAPI } from './invoices.api';
export { employeesAPI } from './employees.api';

// Operations
export { warehousesAPI, dashboardAPI } from './warehouses.api';
export { settingsAPI, campaignsAPI, alertsAPI, ordersAPI } from './settings.api';

// Specialized Modules
export { auditAPI, crmAPI, fiscalAPI } from './crm.api';
export { hospitalityAPI, pharmacyAPI, backupsAPI, gdriveAPI } from './hospitality.api';
