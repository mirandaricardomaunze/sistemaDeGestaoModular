// Re-export all hooks for backwards compatibility
// Individual hooks can also be imported directly from their files

export { useProducts } from './useProducts';
export { useCustomers } from './useCustomers';
export { useSales } from './useSales';
export { useSuppliers } from './useSuppliers';
export { useInvoices } from './useInvoices';
export { useEmployees } from './useEmployees';
export { useAttendance } from './useAttendance';
export { usePayroll } from './usePayroll';
export { useVacations } from './useVacations';
export { useWarehouses } from './useWarehouses';
export { useStockTransfers } from './useStockTransfers';
export { useDashboard } from './useDashboard';
export { useCompanySettings, useCategories, useCampaigns } from './useSettings';
export { useAlerts } from './useAlerts';
export { useOrders } from './useOrders';
export { useKeyboardShortcuts, POS_SHORTCUTS } from './useKeyboardShortcuts';
export type { KeyboardShortcut } from './useKeyboardShortcuts';

// Re-export from legacy useData.ts for backwards compatibility
export * from './useData';
