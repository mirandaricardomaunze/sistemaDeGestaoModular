import type { Product, Employee, Alert, Supplier, Customer } from '../types';

/**
 * Mock Data - CLEANED UP
 * All mock data has been removed in favor of real backend data.
 * The files are kept mainly for type consistency during complete transitions.
 */

export const mockProducts: Product[] = [];
export const mockEmployees: Employee[] = [];
export const mockAlerts: Alert[] = [];
export const mockSuppliers: Supplier[] = [];
export const mockCustomers: Customer[] = [];

// Re-export labels from constants for legacy compatibility if needed
// but ideally all files should now import from utils/constants directly.
export {
    categoryLabels,
    roleLabels,
    paymentMethodLabels,
    alertTypeLabels,
    priorityLabels,
    statusLabels
} from '../utils/constants';
