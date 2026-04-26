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
export { settingsAPI, campaignsAPI, alertsAPI, ordersAPI, type Alert, type AlertModule, type AlertPriority, type AlertsSummary, type UnreadCount } from './settings.api';

// Specialized Modules
export { auditAPI, crmAPI, fiscalAPI } from './crm.api';
export { hospitalityAPI, backupsAPI, gdriveAPI } from './hospitality.api';
export { pharmacyAPI } from './pharmacy.api';
export { bottleStoreAPI } from './bottle-store.api';
export { exportAPI } from './export.api';

// Payments
export { paymentsAPI, type PaymentModule, type MpesaStatus, type MpesaTransaction, type InitiatePaymentParams } from './payments.api';

// Validities
export { validitiesAPI, type ProductValidity } from './validities.api';

// Restaurant Module
export { restaurantAPI, type RestaurantTable, type RestaurantMenuItem, type RestaurantOrder, type RestaurantReservation, type OrderStatus, type ReservationStatus, type RestaurantOrderItem } from './restaurant.api';

// Logistics Module
export { logisticsAPI } from './logistics.api';


// IVA & Batches
export { ivaAPI, type IvaRate, type CreateIvaRateDto } from './iva.api';
export { batchesAPI, type ProductBatch, type CreateBatchDto } from './batches.api';

// Commercial Module Analytics
export { commercialAPI, shiftAPI, type CommercialAnalytics, type MarginAnalysis, type MarginByCategory, type MarginByProduct, type StockAgingReport, type StockAgingProduct, type SupplierPerformance, type PurchaseOrder, type InventoryTurnoverItem, type SalesReport, type ShiftSession, type ShiftSummary, type InventoryForecast } from './commercial.api';

// Calendar Module
export { calendarAPI, type CalendarEvent, type CalendarAttendee, type CreateCalendarEventDto, type UpdateCalendarEventDto } from './calendar.api';
