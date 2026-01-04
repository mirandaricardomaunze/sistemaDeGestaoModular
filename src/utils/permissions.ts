import type { User, UserRole } from '../types';

export type Permission =
    | 'view_dashboard'
    | 'view_inventory'
    | 'manage_inventory'
    | 'view_pos'
    | 'manage_pos'
    | 'view_customers'
    | 'manage_customers'
    | 'view_employees'
    | 'manage_employees'
    | 'view_financial'
    | 'manage_financial'
    | 'view_reports'
    | 'view_audit'
    | 'manage_settings'
    | 'view_crm'
    | 'manage_crm'
    | 'view_fiscal'
    | 'manage_fiscal';

// Mapping from UI Permission strings to Backend Permission Codes
const PERMISSION_CODE_MAP: Record<Permission, string[]> = {
    view_dashboard: ['dashboard.view'],
    view_inventory: ['inventory.products.view', 'inventory.stock.view'],
    manage_inventory: ['inventory.products.create', 'inventory.products.edit', 'inventory.stock.adjust'],
    view_pos: ['sales.pos.view', 'sales.orders.view'],
    manage_pos: ['sales.pos.create', 'sales.orders.edit'],
    view_customers: ['crm.customers.view'],
    manage_customers: ['crm.customers.create', 'crm.customers.edit'],
    view_employees: ['hr.employees.view'],
    manage_employees: ['hr.employees.create', 'hr.employees.edit'],
    view_financial: ['fiscal.transactions.view'],
    manage_financial: ['fiscal.transactions.create'],
    view_reports: ['dashboard.reports.view'],
    view_audit: ['admin.audit.view'],
    manage_settings: ['admin.settings.manage'],
    view_crm: ['crm.customers.view'], // Reuse backend codes as needed
    manage_crm: ['crm.customers.create'],
    view_fiscal: ['fiscal.invoices.view'],
    manage_fiscal: ['fiscal.invoices.create'],
};

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
    super_admin: [
        'view_dashboard',
        'view_inventory',
        'manage_inventory',
        'view_pos',
        'manage_pos',
        'view_customers',
        'manage_customers',
        'view_employees',
        'manage_employees',
        'view_financial',
        'manage_financial',
        'view_reports',
        'view_audit',
        'manage_settings',
        'view_crm',
        'manage_crm',
        'view_fiscal',
        'manage_fiscal',
    ],
    admin: [
        'view_dashboard',
        'view_inventory',
        'manage_inventory',
        'view_pos',
        'manage_pos',
        'view_customers',
        'manage_customers',
        'view_employees',
        'manage_employees',
        'view_financial',
        'manage_financial',
        'view_reports',
        'view_audit',
        'manage_settings',
        'view_crm',
        'manage_crm',
        'view_fiscal',
        'manage_fiscal',
    ],
    manager: [
        'view_dashboard',
        'view_inventory',
        'manage_inventory',
        'view_pos',
        'manage_pos',
        'view_customers',
        'manage_customers',
        'view_employees',
        'view_financial',
        'view_reports',
        'view_crm',
        'manage_crm',
        'view_fiscal',
    ],
    operator: [
        'view_dashboard',
        'view_inventory',
        'view_pos',
        'manage_pos',
        'view_customers',
        'view_crm',
    ],
    cashier: [
        'view_dashboard',
        'view_pos',
        'manage_pos',
        'view_customers',
    ],
    stock_keeper: [
        'view_dashboard',
        'view_inventory',
        'manage_inventory',
    ],
};

export const hasPermission = (user: User | null | undefined, permission: Permission | string): boolean => {
    if (!user) return false;

    // 1. Super Admin bypass
    if (user.role === 'super_admin' || user.role === 'admin') return true;

    // 2. Check if it's a backend permission code directly
    if (typeof permission === 'string' && user.permissions?.includes(permission)) {
        return true;
    }

    // 3. Check if it's a UI permission string mapped to backend codes
    const mappedCodes = PERMISSION_CODE_MAP[permission as Permission];
    if (mappedCodes && user.permissions) {
        if (mappedCodes.some(code => user.permissions?.includes(code))) {
            return true;
        }
    }

    // 4. Fallback to Role-Based default permissions (for local/legacy support)
    return ROLE_PERMISSIONS[user.role]?.includes(permission as Permission) || false;
};

export const canViewPage = (user: User | null | undefined, path: string): boolean => {
    if (!user) return false;

    // Super Admin check - if we ever have a system-wide super admin, they bypass all.
    // For company admins, we still want to restrict modules.
    // Assuming 'admin' in this context is the Company Admin.

    const pathModuleMap: Record<string, string> = {
        '/pharmacy': 'PHARMACY',
        '/hospitality': 'HOTEL',
        '/bottle-store': 'BOTTLE_STORE',
        '/logistics': 'LOGISTICS',
        '/inventory': 'COMMERCIAL',
        '/pos': 'COMMERCIAL',
        '/customers': 'COMMERCIAL',
        '/crm': 'COMMERCIAL',
        '/suppliers': 'COMMERCIAL',
        '/employees': 'COMMERCIAL',
        '/financial': 'COMMERCIAL',
        '/fiscal': 'COMMERCIAL',
        '/invoices': 'COMMERCIAL',
        '/orders': 'COMMERCIAL',
        '/categories': 'COMMERCIAL',
    };

    const requiredModule = pathModuleMap[path];
    if (requiredModule && user.activeModules) {
        if (!user.activeModules.includes(requiredModule)) {
            return false;
        }
    }

    // Special restriction for Super Admin page - ONLY super_admin role
    if (path === '/super-admin' && user.role !== 'super_admin') return false;

    // After module check, if it's a super_admin or admin, they can see other pages (within active modules)
    if (user.role === 'super_admin' || user.role === 'admin') return true;

    const pathPermissionMap: Record<string, Permission> = {
        '/': 'view_dashboard',
        '/inventory': 'view_inventory',
        '/categories': 'view_inventory',
        '/pos': 'view_pos',
        '/customers': 'view_customers',
        '/crm': 'view_crm',
        '/suppliers': 'view_inventory',
        '/employees': 'view_employees',
        '/financial': 'view_financial',
        '/fiscal': 'view_fiscal',
        '/invoices': 'view_pos',
        '/orders': 'view_pos',
        '/alerts': 'view_dashboard',
        '/reports': 'view_reports',
        '/audit': 'view_audit',
        '/settings': 'manage_settings',
        '/pharmacy': 'view_inventory',
        '/hospitality': 'view_dashboard',
        '/bottle-store': 'view_inventory',
        '/logistics': 'view_dashboard',
    };

    const permission = pathPermissionMap[path];
    if (!permission) return true;

    return hasPermission(user, permission);
};
