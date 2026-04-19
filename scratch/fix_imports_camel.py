import os
import re

# Mapping of old names to new names (filenames without extensions)
# Note: On Windows, file names in imports might be case-insensitive, 
# but we want to be explicit for professional consistency.

mapping = {
    # Pages
    'Alerts': 'alerts',
    'Audit': 'audit',
    'BackupManagement': 'backupManagement',
    'CRM': 'crm',
    'Categories': 'categories',
    'Customers': 'customers',
    'Dashboard': 'dashboard',
    'Employees': 'employees',
    'Financial': 'financial',
    'Fiscal': 'fiscal',
    'ForgotPassword': 'forgotPassword',
    'Help': 'help',
    'Home': 'home',
    'Hospitality': 'hospitality',
    'Inventory': 'inventory',
    'Invoices': 'invoices',
    'Login': 'login',
    'Orders': 'orders',
    'POS': 'pos',
    'Pharmacy': 'pharmacy',
    'PharmacyControl': 'pharmacyControl',
    'Register': 'register',
    'Reports': 'reports',
    'Settings': 'settings',
    'StockMovements': 'stockMovements',
    'Suppliers': 'suppliers',
    'TransfersPage': 'transfersPage',
    'WarehousesPage': 'warehousesPage',
    'SuperAdmin': 'superAdmin',
    
    # Backend Services (including kabob-to-camel conversions)
    'StockService': 'stockService',
    'alert.service': 'alertService',
    'attendance.service': 'attendanceService',
    'audit.service': 'auditService',
    'backup.service': 'backupService',
    'batches.service': 'batchesService',
    'bottle-returns.service': 'bottleReturnsService',
    'bottle-store-finance.service': 'bottleStoreFinanceService',
    'bottle-store.service': 'bottleStoreService',
    'cache.service': 'cacheService',
    'campaigns.service': 'campaignsService',
    'cash-session.service': 'cashSessionService',
    'commercial-finance.service': 'commercialFinanceService',
    'commercial.service': 'commercialService',
    'credit-sales.service': 'creditSalesService',
    'crm.service': 'crmService',
    'customers.service': 'customersService',
    'dashboard.service': 'dashboardService',
    'document.service': 'documentService',
    'email.service': 'emailService',
    'employees.service': 'employeesService',
    'fiscal.service': 'fiscalService',
    'hospitality-channels.service': 'hospitalityChannelsService',
    'hospitality-dashboard.service': 'hospitalityDashboardService',
    'hospitality-finance.service': 'hospitalityFinanceService',
    'hospitality.service': 'hospitalityService',
    'invoices.service': 'invoicesService',
    'iva.service': 'ivaService',
    'logistics-finance.service': 'logisticsFinanceService',
    'logistics.service': 'logisticsService',
    'mpesa.service': 'mpesaService',
    'orders.service': 'ordersService',
    'payroll.service': 'payrollService',
    'pharmacy-finance.service': 'pharmacyFinanceService',
    'pharmacy.service': 'pharmacyService',
    'predictive.service': 'predictiveService',
    'products.service': 'productsService',
    'public-reservation.service': 'publicReservationService',
    'restaurant-finance.service': 'restaurantFinanceService',
    'restaurant.service': 'restaurantService',
    'sales.service': 'salesService',
    'suppliers.service': 'suppliersService',
    'bottle-store-finance': 'bottleStoreFinance',
    'bottle-store': 'bottleStore',
    'commercial-finance': 'commercialFinance',
    'hospitality-channels': 'hospitalityChannels',
    'hospitality-dashboard': 'hospitalityDashboard',
    'hospitality-finance': 'hospitalityFinance',
    'logistics-finance': 'logisticsFinance',
    'pharmacy-finance': 'pharmacyFinance',
    'restaurant-finance': 'restaurantFinance',
}

def fix_imports(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(('.ts', '.tsx', '.mjs', '.js')):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                
                new_content = content
                for old, new in mapping.items():
                    # Regex to match imports: from '.../OldName' or from '.../OldName.ts'
                    # We look for the pattern in quotes/apostrophes
                    pattern = rf"(['\"])(.*/)?{re.escape(old)}(['\"])"
                    replacement = rf"\1\2{new}\3"
                    new_content = re.sub(pattern, replacement, new_content)

                if new_content != content:
                    print(f"Updating imports in: {path}")
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(new_content)

if __name__ == "__main__":
    # Fix frontend imports
    fix_imports('src')
    # Fix backend imports
    fix_imports('backend/src')
    print("Bulk import fix complete.")
