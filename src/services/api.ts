import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';

// ============================================================================
// API Configuration
// ============================================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Create axios instance with default config
const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// ============================================================================
// Request Interceptor - Add auth token to requests
// ============================================================================

api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('auth_token');
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// ============================================================================
// Response Interceptor - Handle errors globally
// ============================================================================

api.interceptors.response.use(
    (response) => response,
    (error: AxiosError<{ error?: string; message?: string }>) => {
        // Check if this request should skip automatic error toasts
        const skipErrorToast = (error.config as any)?.skipErrorToast;

        // Handle specific error codes
        if (error.response?.status === 401) {
            // valid login attempts also return 401, don't reload page for them
            if (error.config?.url?.includes('/auth/login')) {
                return Promise.reject(error);
            }

            // Token expired or invalid
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_user');
            // Only redirect if we are not already on the login page
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
                if (!skipErrorToast) {
                    toast.error('Sessão expirada. Faça login novamente.');
                }
            }
        } else if (error.response?.status === 403) {
            // Don't show toast for 403 if skipErrorToast is true
            if (!skipErrorToast) {
                toast.error('Sem permissão para esta acção.');
            }
        } else if (error.response?.status === 404) {
            // Let the calling code handle 404s
        } else if (error.response?.status === 500) {
            if (!skipErrorToast) {
                toast.error('Erro interno do servidor. Tente novamente.');
            }
        } else if (!error.response) {
            if (!skipErrorToast) {
                toast.error('Erro de conexão. Verifique sua internet.');
            }
        }

        return Promise.reject(error);
    }
);

// ============================================================================
// Auth API
// ============================================================================

export const authAPI = {
    login: async (email: string, password: string) => {
        const response = await api.post('/auth/login', { email, password });
        return response.data;
    },

    register: async (userData: {
        email: string;
        password: string;
        name: string;
        role?: string;
        phone?: string;
        companyName: string;
        companyTradeName?: string;
        companyNuit: string;
        companyPhone?: string;
        companyEmail?: string;
        companyAddress?: string;
        moduleCode: string;
    }) => {
        const response = await api.post('/auth/register', userData);
        return response.data;
    },


    getMe: async () => {
        const response = await api.get('/auth/me');
        return response.data;
    },

    updateProfile: async (data: {
        name: string;
        email: string;
        phone?: string;
    }) => {
        const response = await api.put('/auth/profile', data);
        return response.data;
    },

    changePassword: async (currentPassword: string, newPassword: string) => {
        const response = await api.put('/auth/change-password', {
            currentPassword,
            newPassword,
        });
        return response.data;
    },

    getUsers: async () => {
        const response = await api.get('/auth/users');
        return response.data;
    },

    updateUserData: async (id: string, data: { name: string; email: string; role: string; phone?: string }) => {
        const response = await api.put(`/auth/users/${id}`, data);
        return response.data;
    },

    toggleUserStatus: async (id: string, isActive: boolean) => {
        const response = await api.patch(`/auth/users/${id}/status`, { isActive });
        return response.data;
    },

    deleteUser: async (id: string) => {
        const response = await api.delete(`/auth/users/${id}`);
        return response.data;
    },

    forgotPassword: async (email: string) => {
        const response = await api.post('/auth/forgot-password', { email });
        return response.data;
    },

    verifyOTP: async (email: string, otp: string) => {
        const response = await api.post('/auth/verify-otp', { email, otp });
        return response.data;
    },

    resetPassword: async (data: { email: string; otp: string; newPassword: string }) => {
        const response = await api.post('/auth/reset-password', data);
        return response.data;
    },
};

// ============================================================================
// Modules API
// ============================================================================

export interface BusinessModule {
    id: string;
    code: string;
    name: string;
    description: string;
}

export const modulesAPI = {
    getAll: async (): Promise<BusinessModule[]> => {
        const response = await api.get('/modules');
        return response.data;
    },
};

// ============================================================================
// Admin API (Super Admin Only)
// ============================================================================

export const adminAPI = {
    getStats: async () => {
        const response = await api.get('/admin/stats', { skipErrorToast: true } as any);
        return response.data;
    },

    getCompanies: async () => {
        const response = await api.get('/admin/companies', { skipErrorToast: true } as any);
        return response.data;
    },

    getCompanyById: async (id: string) => {
        const response = await api.get(`/admin/companies/${id}`, { skipErrorToast: true } as any);
        return response.data;
    },

    toggleCompanyStatus: async (id: string, status: 'active' | 'inactive' | 'suspended') => {
        const response = await api.patch(`/admin/companies/${id}/status`, { status });
        return response.data;
    },

    getAllUsers: async () => {
        const response = await api.get('/admin/users', { skipErrorToast: true } as any);
        return response.data;
    },

    getActivity: async (limit?: number) => {
        const response = await api.get('/admin/activity', {
            params: { limit },
            skipErrorToast: true
        } as any);
        return response.data;
    },
};

// ============================================================================
// Products API
// ============================================================================

export const productsAPI = {
    getAll: async (params?: {
        search?: string;
        category?: string;
        status?: string;
        minPrice?: number;
        maxPrice?: number;
        supplierId?: string;
    }) => {
        const response = await api.get('/products', { params });
        return response.data;
    },

    getById: async (id: string) => {
        const response = await api.get(`/products/${id}`);
        return response.data;
    },

    create: async (data: {
        code: string;
        name: string;
        description?: string;
        category?: string;
        price: number;
        costPrice?: number;
        currentStock?: number;
        minStock?: number;
        maxStock?: number;
        unit?: string;
        barcode?: string;
        expiryDate?: string;
        batchNumber?: string;
        location?: string;
        supplierId?: string;
        imageUrl?: string;
    }) => {
        const response = await api.post('/products', data);
        return response.data;
    },

    update: async (id: string, data: Partial<{
        name: string;
        description: string;
        category: string;
        price: number;
        costPrice: number;
        currentStock: number;
        minStock: number;
        maxStock: number;
        unit: string;
        barcode: string;
        expiryDate: string;
        batchNumber: string;
        location: string;
        supplierId: string;
        imageUrl: string;
    }>) => {
        const response = await api.put(`/products/${id}`, data);
        return response.data;
    },

    delete: async (id: string) => {
        const response = await api.delete(`/products/${id}`);
        return response.data;
    },

    updateStock: async (
        id: string,
        data: {
            quantity: number;
            operation: 'add' | 'subtract' | 'set';
            warehouseId?: string;
            reason?: string;
        }
    ) => {
        const response = await api.patch(`/products/${id}/stock`, data);
        return response.data;
    },

    getLowStock: async () => {
        const response = await api.get('/products/alerts/low-stock');
        return response.data;
    },
    getExpiring: async (days?: number) => {
        const response = await api.get('/products/alerts/expiring', { params: { days } });
        return response.data;
    },
};

// ============================================================================
// Customers API
// ============================================================================

export const customersAPI = {
    getAll: async (params?: { search?: string; type?: string }) => {
        const response = await api.get('/customers', { params });
        return response.data;
    },

    getById: async (id: string) => {
        const response = await api.get(`/customers/${id}`);
        return response.data;
    },

    create: async (data: {
        code?: string;
        name: string;
        type?: 'individual' | 'company';
        email?: string;
        phone: string;
        document?: string;
        address?: string;
        city?: string;
        province?: string;
        notes?: string;
        creditLimit?: number;
    }) => {
        const response = await api.post('/customers', data);
        return response.data;
    },

    update: async (id: string, data: Partial<{
        name: string;
        type: 'individual' | 'company';
        email: string;
        phone: string;
        document: string;
        address: string;
        city: string;
        province: string;
        notes: string;
        creditLimit: number;
    }>) => {
        const response = await api.put(`/customers/${id}`, data);
        return response.data;
    },

    delete: async (id: string) => {
        const response = await api.delete(`/customers/${id}`);
        return response.data;
    },
};

// ============================================================================
// Suppliers API
// ============================================================================

export const suppliersAPI = {
    getAll: async (params?: { search?: string }) => {
        const response = await api.get('/suppliers', { params });
        return response.data;
    },

    getById: async (id: string) => {
        const response = await api.get(`/suppliers/${id}`);
        return response.data;
    },

    create: async (data: {
        code?: string;
        name: string;
        tradeName?: string;
        nuit?: string;
        email?: string;
        phone: string;
        phone2?: string;
        address?: string;
        city?: string;
        province?: string;
        contactPerson?: string;
        paymentTerms?: string;
        notes?: string;
    }) => {
        const response = await api.post('/suppliers', data);
        return response.data;
    },

    update: async (id: string, data: Partial<{
        name: string;
        tradeName: string;
        nuit: string;
        email: string;
        phone: string;
        phone2: string;
        address: string;
        city: string;
        province: string;
        contactPerson: string;
        paymentTerms: string;
        notes: string;
    }>) => {
        const response = await api.put(`/suppliers/${id}`, data);
        return response.data;
    },

    delete: async (id: string) => {
        const response = await api.delete(`/suppliers/${id}`);
        return response.data;
    },

    // Purchase Orders
    getPurchaseOrders: async (supplierId: string) => {
        const response = await api.get(`/suppliers/${supplierId}/orders`);
        return response.data;
    },

    createPurchaseOrder: async (supplierId: string, data: {
        items: Array<{ productId: string; quantity: number; unitCost: number }>;
        expectedDeliveryDate?: string;
        notes?: string;
    }) => {
        const response = await api.post(`/suppliers/${supplierId}/orders`, data);
        return response.data;
    },

    receivePurchaseOrder: async (orderId: string, items: Array<{ itemId: string; receivedQty: number }>) => {
        const response = await api.post(`/suppliers/orders/${orderId}/receive`, { items });
        return response.data;
    },
};

// ============================================================================
// Sales API
// ============================================================================

export const salesAPI = {
    getAll: async (params?: {
        startDate?: string;
        endDate?: string;
        customerId?: string;
        paymentMethod?: string;
    }) => {
        const response = await api.get('/sales', { params });
        return response.data;
    },

    getById: async (id: string) => {
        const response = await api.get(`/sales/${id}`);
        return response.data;
    },

    create: async (data: {
        customerId?: string;
        items: Array<{
            productId: string;
            quantity: number;
            unitPrice: number;
            discount?: number;
            total: number;
        }>;
        subtotal: number;
        discount?: number;
        tax?: number;
        total: number;
        paymentMethod: string;
        amountPaid: number;
        change?: number;
        notes?: string;
    }) => {
        const response = await api.post('/sales', data);
        return response.data;
    },

    getStats: async (period?: string) => {
        const response = await api.get('/sales/stats', { params: { period } });
        return response.data;
    },
};

// ============================================================================
// Invoices API
// ============================================================================

export const invoicesAPI = {
    getAll: async (params?: {
        status?: string;
        customerId?: string;
        startDate?: string;
        endDate?: string;
    }) => {
        const response = await api.get('/invoices', { params });
        return response.data;
    },

    getById: async (id: string) => {
        const response = await api.get(`/invoices/${id}`);
        return response.data;
    },

    create: async (data: {
        customerId?: string;
        customerName: string;
        customerEmail?: string;
        customerPhone?: string;
        customerAddress?: string;
        customerDocument?: string;
        items: Array<{
            productId?: string;
            description: string;
            quantity: number;
            unitPrice: number;
            discount?: number;
        }>;
        discount?: number;
        tax?: number;
        dueDate: string;
        notes?: string;
        terms?: string;
        orderId?: string;
        orderNumber?: string;
    }) => {
        const response = await api.post('/invoices', data);
        return response.data;
    },

    update: async (id: string, data: Partial<{
        status: string;
        dueDate: string;
        notes: string;
        terms: string;
    }>) => {
        const response = await api.put(`/invoices/${id}`, data);
        return response.data;
    },

    addPayment: async (
        id: string,
        data: {
            amount: number;
            method: string;
            reference?: string;
            notes?: string;
        }
    ) => {
        const response = await api.post(`/invoices/${id}/payments`, data);
        return response.data;
    },

    cancel: async (id: string) => {
        const response = await api.put(`/invoices/${id}/cancel`);
        return response.data;
    },

    createCreditNote: async (data: {
        originalInvoiceId: string;
        customerId?: string;
        customerName: string;
        items: Array<{
            productId?: string;
            description: string;
            quantity: number;
            unitPrice: number;
            originalInvoiceItemId?: string;
        }>;
        reason: string;
        notes?: string;
    }) => {
        const response = await api.post('/invoices/credit-notes', data);
        return response.data;
    },

    getCreditNotes: async (params?: { invoiceId?: string }) => {
        const response = await api.get('/invoices/credit-notes', { params });
        return response.data;
    },
};

// ============================================================================
// Employees API
// ============================================================================

export const employeesAPI = {
    getAll: async (params?: { search?: string; department?: string; role?: string }) => {
        const response = await api.get('/employees', { params });
        return response.data;
    },

    getById: async (id: string) => {
        const response = await api.get(`/employees/${id}`);
        return response.data;
    },

    create: async (data: {
        code: string;
        name: string;
        email: string;
        phone: string;
        role?: string;
        department?: string;
        hireDate: string;
        baseSalary: number;
        subsidyTransport?: number;
        subsidyFood?: number;
        address?: string;
        documentNumber?: string;
        socialSecurityNumber?: string;
        nuit?: string;
        bankName?: string;
        bankAccountNumber?: string;
        bankNib?: string;
        birthDate?: string;
        contractType?: string;
        contractExpiry?: string;
    }) => {
        const response = await api.post('/employees', data);
        return response.data;
    },

    update: async (id: string, data: Partial<{
        name: string;
        email: string;
        phone: string;
        role: string;
        department: string;
        baseSalary: number;
        subsidyTransport: number;
        subsidyFood: number;
        address: string;
        documentNumber: string;
        socialSecurityNumber: string;
        nuit: string;
        bankName: string;
        bankAccountNumber: string;
        bankNib: string;
        isActive: boolean;
        hireDate: string;
        birthDate: string;
        contractType: string;
        contractExpiry: string;
    }>) => {
        const response = await api.put(`/employees/${id}`, data);
        return response.data;
    },

    delete: async (id: string) => {
        const response = await api.delete(`/employees/${id}`);
        return response.data;
    },

    // Attendance
    getAttendance: async (params?: {
        employeeId?: string;
        startDate?: string;
        endDate?: string;
    }) => {
        const response = await api.get('/employees/attendance', { params });
        return response.data;
    },

    recordAttendance: async (data: {
        employeeId: string;
        date: string;
        checkIn?: string;
        checkOut?: string;
        status?: string;
        notes?: string;
    }) => {
        const response = await api.post('/employees/attendance', data);
        return response.data;
    },

    // Payroll
    getPayroll: async (params?: {
        employeeId?: string;
        month?: number;
        year?: number;
        status?: string;
    }) => {
        const response = await api.get('/employees/payroll', { params });
        return response.data;
    },

    createPayroll: async (data: {
        employeeId: string;
        month: number;
        year: number;
        baseSalary: number;
        otHours?: number;
        otAmount?: number;
        bonus?: number;
        allowances?: number;
        inssDeduction?: number;
        irtDeduction?: number;
        advances?: number;
    }) => {
        const response = await api.post('/employees/payroll', data);
        return response.data;
    },

    updatePayroll: async (id: string, data: Partial<{
        status: string;
        otHours: number;
        otAmount: number;
        bonus: number;
        allowances: number;
        advances: number;
    }>) => {
        const response = await api.put(`/employees/payroll/${id}`, data);
        return response.data;
    },

    processPayroll: async (id: string) => {
        const response = await api.post(`/employees/payroll/${id}/process`);
        return response.data;
    },

    // Vacations
    getVacations: async (params?: {
        employeeId?: string;
        status?: string;
    }) => {
        const response = await api.get('/employees/vacations', { params });
        return response.data;
    },

    requestVacation: async (data: {
        employeeId: string;
        startDate: string;
        endDate: string;
        notes?: string;
    }) => {
        const response = await api.post('/employees/vacations', data);
        return response.data;
    },

    updateVacation: async (
        id: string,
        data: { status: 'approved' | 'rejected'; approvedBy?: string; notes?: string }
    ) => {
        const response = await api.put(`/employees/vacations/${id}`, data);
        return response.data;
    },
};

// ============================================================================
// Warehouses API
// ============================================================================

export const warehousesAPI = {
    getAll: async () => {
        const response = await api.get('/warehouses');
        return response.data;
    },

    getById: async (id: string) => {
        const response = await api.get(`/warehouses/${id}`);
        return response.data;
    },

    create: async (data: {
        code: string;
        name: string;
        location?: string;
        responsible?: string;
        isDefault?: boolean;
    }) => {
        const response = await api.post('/warehouses', data);
        return response.data;
    },

    update: async (id: string, data: Partial<{
        name: string;
        location: string;
        responsible: string;
        isDefault: boolean;
        isActive: boolean;
    }>) => {
        const response = await api.put(`/warehouses/${id}`, data);
        return response.data;
    },

    delete: async (id: string) => {
        const response = await api.delete(`/warehouses/${id}`);
        return response.data;
    },

    getStock: async (warehouseId: string) => {
        const response = await api.get(`/warehouses/${warehouseId}/stock`);
        return response.data;
    },

    // Stock Transfers
    getTransfers: async (params?: {
        sourceWarehouseId?: string;
        targetWarehouseId?: string;
        status?: string;
    }) => {
        const response = await api.get('/warehouses/transfers/all', { params });
        return response.data;
    },

    createTransfer: async (data: {
        sourceWarehouseId: string;
        targetWarehouseId: string;
        items: Array<{ productId: string; quantity: number }>;
        responsible: string;
        reason?: string;
    }) => {
        const response = await api.post('/warehouses/transfers', data);
        return response.data;
    },

    completeTransfer: async (id: string) => {
        const response = await api.post(`/warehouses/transfers/${id}/complete`);
        return response.data;
    },

    cancelTransfer: async (id: string) => {
        const response = await api.post(`/warehouses/transfers/${id}/cancel`);
        return response.data;
    },
};

// ============================================================================
// Dashboard API
// ============================================================================

export const dashboardAPI = {
    getStats: async () => {
        const response = await api.get('/dashboard/metrics');
        return response.data;
    },

    getSalesChart: async (params?: { period?: string }) => {
        const response = await api.get('/dashboard/charts/sales', { params });
        return response.data;
    },

    getTopProducts: async (params?: { limit?: number; period?: number }) => {
        const response = await api.get('/dashboard/charts/top-products', { params });
        return response.data;
    },

    getRecentSales: async (params?: { limit?: number }) => {
        const response = await api.get('/dashboard/recent-activity', { params });
        return response.data;
    },

    getCategoryStats: async (params?: { period?: number }) => {
        const response = await api.get('/dashboard/charts/categories', { params });
        return response.data;
    },

    getPaymentMethodsBreakdown: async (params?: { period?: number }) => {
        const response = await api.get('/dashboard/charts/payment-methods', { params });
        return response.data;
    },
};

// ============================================================================
// Settings API
// ============================================================================

export const settingsAPI = {
    getCompany: async () => {
        const response = await api.get('/settings/company');
        return response.data;
    },

    updateCompany: async (data: Partial<{
        companyName: string;
        tradeName: string;
        nuit: string;
        phone: string;
        email: string;
        address: string;
        city: string;
        province: string;
        country: string;
        logo: string;
        ivaRate: number;
        currency: string;
        printerType: string;
        thermalPaperWidth: string;
        autoPrintReceipt: boolean;
        businessType: string;
    }>) => {
        const response = await api.put('/settings/company', data);
        return response.data;
    },

    getCategories: async () => {
        const response = await api.get('/settings/categories');
        return response.data;
    },

    createCategory: async (data: {
        code?: string;
        name: string;
        description?: string;
        color?: string;
        parentId?: string;
    }) => {
        const response = await api.post('/settings/categories', data);
        return response.data;
    },

    updateCategory: async (id: string, data: Partial<{
        name: string;
        description: string;
        color: string;
        isActive: boolean;
    }>) => {
        const response = await api.put(`/settings/categories/${id}`, data);
        return response.data;
    },

    deleteCategory: async (id: string) => {
        const response = await api.delete(`/settings/categories/${id}`);
        return response.data;
    },

    // Alert Configuration
    getAlertConfig: async () => {
        const response = await api.get('/settings/alert-config');
        return response.data;
    },

    updateAlertConfig: async (config: {
        lowStockThreshold?: number;
        expiryWarningDays?: number;
        paymentDueDays?: number;
        enableEmailAlerts?: boolean;
        enablePushNotifications?: boolean;
    }) => {
        const response = await api.put('/settings/alert-config', config);
        return response.data;
    },
};

// ============================================================================
// Campaigns API
// ============================================================================

export const campaignsAPI = {
    getAll: async (params?: { status?: string }) => {
        const response = await api.get('/campaigns', { params });
        return response.data;
    },

    getById: async (id: string) => {
        const response = await api.get(`/campaigns/${id}`);
        return response.data;
    },

    create: async (data: {
        name: string;
        description?: string;
        code?: string;
        startDate: string;
        endDate: string;
        discountType: 'percentage' | 'fixed' | 'free_shipping' | 'buy_x_get_y';
        discountValue: number;
        minPurchaseAmount?: number;
        maxDiscountAmount?: number;
        maxTotalUses?: number;
    }) => {
        const response = await api.post('/campaigns', data);
        return response.data;
    },

    update: async (id: string, data: Partial<{
        name: string;
        description: string;
        status: string;
        startDate: string;
        endDate: string;
        discountType: string;
        discountValue: number;
        minPurchaseAmount: number;
        maxDiscountAmount: number;
        maxTotalUses: number;
    }>) => {
        const response = await api.put(`/campaigns/${id}`, data);
        return response.data;
    },

    delete: async (id: string) => {
        const response = await api.delete(`/campaigns/${id}`);
        return response.data;
    },

    validateCode: async (code: string, purchaseAmount?: number) => {
        const response = await api.post('/campaigns/validate', { code, purchaseAmount });
        return response.data;
    },

    recordUsage: async (data: {
        campaignId: string;
        customerId?: string;
        customerName?: string;
        orderId?: string;
        discount: number;
    }) => {
        const response = await api.post('/campaigns/usage', data);
        return response.data;
    },
};

// ============================================================================
// Alerts API
// ============================================================================

export const alertsAPI = {
    getAll: async (params?: {
        type?: string;
        priority?: string;
        isRead?: boolean;
        isResolved?: boolean;
    }) => {
        const response = await api.get('/alerts', { params });
        return response.data;
    },

    markAsRead: async (id: string) => {
        const response = await api.patch(`/alerts/${id}/read`);
        return response.data;
    },

    markAsResolved: async (id: string) => {
        const response = await api.patch(`/alerts/${id}/resolve`);
        return response.data;
    },

    delete: async (id: string) => {
        const response = await api.delete(`/alerts/${id}`);
        return response.data;
    },

    markAllAsRead: async () => {
        const response = await api.patch('/alerts/read-all');
        return response.data;
    },

    generate: async () => {
        const response = await api.post('/alerts/generate');
        return response.data;
    },
};

// ============================================================================
// Customer Orders API
// ============================================================================

export const ordersAPI = {
    getAll: async (params?: {
        status?: string;
        priority?: string;
    }) => {
        const response = await api.get('/orders', { params });
        return response.data;
    },

    getById: async (id: string) => {
        const response = await api.get(`/orders/${id}`);
        return response.data;
    },

    create: async (data: {
        customerName: string;
        customerPhone: string;
        customerEmail?: string;
        customerAddress?: string;
        items: Array<{
            productId: string;
            productName: string;
            quantity: number;
            price: number;
        }>;
        total: number;
        priority?: string;
        paymentMethod?: string;
        deliveryDate?: string;
        notes?: string;
    }) => {
        const response = await api.post('/orders', data);
        return response.data;
    },

    update: async (id: string, data: {
        customerName?: string;
        customerPhone?: string;
        customerEmail?: string;
        customerAddress?: string;
        priority?: string;
        paymentMethod?: string;
        deliveryDate?: string;
        notes?: string;
    }) => {
        const response = await api.put(`/orders/${id}`, data);
        return response.data;
    },

    updateStatus: async (id: string, data: {
        status: string;
        responsibleName?: string;
        notes?: string;
    }) => {
        const response = await api.patch(`/orders/${id}/status`, data);
        return response.data;
    },

    delete: async (id: string) => {
        const response = await api.delete(`/orders/${id}`);
        return response.data;
    },
};

// ============================================================================
// Audit API
// ============================================================================

export const auditAPI = {
    /**
     * Get all audit logs with optional filtering
     */
    getAll: async (params?: {
        startDate?: string;
        endDate?: string;
        userId?: string;
        action?: string;
        entity?: string;
        limit?: number;
        page?: number;
    }) => {
        const response = await api.get('/audit', { params });
        return response.data;
    },

    /**
     * Create a new audit log entry
     */
    create: async (data: {
        userId?: string;
        userName?: string;
        action: string;
        entity: string;
        entityId?: string;
        oldData?: Record<string, any>;
        newData?: Record<string, any>;
        ipAddress?: string;
    }) => {
        try {
            const response = await api.post('/audit', data);
            return response.data;
        } catch (error) {
            // Fail silently for audit logs - don't disrupt user experience
            console.error('Failed to create audit log:', error);
            return null;
        }
    },

    /**
     * Batch create multiple audit logs
     */
    createBatch: async (logs: Array<{
        userId?: string;
        userName?: string;
        action: string;
        entity: string;
        entityId?: string;
        oldData?: Record<string, any>;
        newData?: Record<string, any>;
    }>) => {
        try {
            // Create logs one by one (backend doesn't have batch endpoint yet)
            const promises = logs.map(log => auditAPI.create(log));
            await Promise.allSettled(promises);
        } catch (error) {
            console.error('Failed to create batch audit logs:', error);
        }
    },
};


// ============================================================================
// CRM API
// ============================================================================

export const crmAPI = {
    // Funnel Stages
    getStages: async () => {
        const response = await api.get('/crm/stages');
        return response.data;
    },

    createStage: async (data: any) => {
        const response = await api.post('/crm/stages', data);
        return response.data;
    },

    updateStage: async (id: string, data: any) => {
        const response = await api.put(`/crm/stages/${id}`, data);
        return response.data;
    },

    deleteStage: async (id: string) => {
        const response = await api.delete(`/crm/stages/${id}`);
        return response.data;
    },

    // Opportunities
    getOpportunities: async (params?: { stageId?: string; customerId?: string }) => {
        const response = await api.get('/crm/opportunities', { params });
        return response.data;
    },

    getOpportunity: async (id: string) => {
        const response = await api.get(`/crm/opportunities/${id}`);
        return response.data;
    },

    createOpportunity: async (data: any) => {
        const response = await api.post('/crm/opportunities', data);
        return response.data;
    },

    updateOpportunity: async (id: string, data: any) => {
        const response = await api.put(`/crm/opportunities/${id}`, data);
        return response.data;
    },

    deleteOpportunity: async (id: string) => {
        const response = await api.delete(`/crm/opportunities/${id}`);
        return response.data;
    },

    moveOpportunity: async (id: string, newStageId: string, reason?: string) => {
        const response = await api.post(`/crm/opportunities/${id}/move`, { newStageId, reason });
        return response.data;
    },

    // Interactions
    addInteraction: async (opportunityId: string, data: any) => {
        const response = await api.post(`/crm/opportunities/${opportunityId}/interactions`, data);
        return response.data;
    },

    getInteractions: async (opportunityId: string) => {
        const response = await api.get(`/crm/opportunities/${opportunityId}/interactions`);
        return response.data;
    },
};

// ============================================================================
// Fiscal API
// ============================================================================

export const fiscalAPI = {
    // Tax Configs
    getTaxConfigs: async () => {
        const response = await api.get('/fiscal/tax-configs');
        return response.data;
    },

    createTaxConfig: async (data: any) => {
        const response = await api.post('/fiscal/tax-configs', data);
        return response.data;
    },

    updateTaxConfig: async (id: string, data: any) => {
        const response = await api.put(`/fiscal/tax-configs/${id}`, data);
        return response.data;
    },

    // IRPS Brackets
    getIRPSBrackets: async (year?: number) => {
        const response = await api.get('/fiscal/irps-brackets', { params: { year } });
        return response.data;
    },

    createIRPSBracket: async (data: any) => {
        const response = await api.post('/fiscal/irps-brackets', data);
        return response.data;
    },

    // Retentions
    getRetentions: async (params?: { period?: string; type?: string }) => {
        const response = await api.get('/fiscal/retentions', { params });
        return response.data;
    },

    createRetention: async (data: any) => {
        const response = await api.post('/fiscal/retentions', data);
        return response.data;
    },

    updateRetention: async (id: string, data: any) => {
        const response = await api.put(`/fiscal/retentions/${id}`, data);
        return response.data;
    },

    // Reports
    getReports: async () => {
        const response = await api.get('/fiscal/reports');
        return response.data;
    },

    createReport: async (data: any) => {
        const response = await api.post('/fiscal/reports', data);
        return response.data;
    },

    updateReport: async (id: string, data: any) => {
        const response = await api.put(`/fiscal/reports/${id}`, data);
        return response.data;
    },

    // Deadlines
    getDeadlines: async () => {
        const response = await api.get('/fiscal/deadlines');
        return response.data;
    },

    createDeadline: async (data: any) => {
        const response = await api.post('/fiscal/deadlines', data);
        return response.data;
    },

    updateDeadline: async (id: string, data: any) => {
        const response = await api.put(`/fiscal/deadlines/${id}`, data);
        return response.data;
    },

    completeDeadline: async (id: string) => {
        const response = await api.post(`/fiscal/deadlines/${id}/complete`);
        return response.data;
    },
};

// Export the axios instance for custom requests
export default api;
// ============================================================================
// Hospitality API
// ============================================================================

export const hospitalityAPI = {
    getRooms: async (params?: { status?: string; type?: string; search?: string }) => {
        const response = await api.get('/hospitality/rooms', { params });
        return response.data;
    },
    createRoom: async (data: any) => {
        const response = await api.post('/hospitality/rooms', data);
        return response.data;
    },
    updateRoom: async (id: string, data: any) => {
        const response = await api.put(`/hospitality/rooms/${id}`, data);
        return response.data;
    },
    deleteRoom: async (id: string) => {
        const response = await api.delete(`/hospitality/rooms/${id}`);
        return response.data;
    },
    getBookings: async (params?: { page?: number; limit?: number; status?: string }) => {
        const response = await api.get('/hospitality/bookings', { params });
        return response.data;
    },
    createBooking: async (data: any) => {
        const response = await api.post('/hospitality/bookings', data);
        return response.data;
    },
    checkout: async (id: string) => {
        const response = await api.put(`/hospitality/bookings/${id}/checkout`);
        return response.data;
    },
    seedRooms: async () => {
        const response = await api.post('/hospitality/rooms/seed');
        return response.data;
    },
    addConsumption: async (bookingId: string, data: { productId: string; quantity: number }) => {
        const response = await api.post(`/hospitality/bookings/${bookingId}/consumptions`, data);
        return response.data;
    },

    // ============================================================================
    // NEW ENDPOINTS
    // ============================================================================

    // Today's Checkouts (for notifications)
    getTodayCheckouts: async () => {
        const response = await api.get('/hospitality/bookings/today-checkouts');
        return response.data;
    },

    // Extend Stay
    extendStay: async (bookingId: string, data: { newCheckoutDate: string; adjustPrice?: number }) => {
        const response = await api.put(`/hospitality/bookings/${bookingId}/extend`, data);
        return response.data;
    },

    // Detailed Booking Info (Guest Profile)
    getBookingDetails: async (bookingId: string) => {
        const response = await api.get(`/hospitality/bookings/${bookingId}/details`);
        return response.data;
    },

    // Housekeeping Tasks
    getHousekeepingTasks: async (params?: { status?: string; date?: string }) => {
        const response = await api.get('/hospitality/housekeeping', { params });
        return response.data;
    },
    createHousekeepingTask: async (data: {
        roomId: string;
        type?: string;
        priority?: number;
        assignedTo?: string;
        notes?: string;
        scheduledAt?: string;
    }) => {
        const response = await api.post('/hospitality/housekeeping', data);
        return response.data;
    },
    updateHousekeepingTask: async (id: string, data: {
        status?: string;
        assignedTo?: string;
        notes?: string;
        priority?: number;
    }) => {
        const response = await api.put(`/hospitality/housekeeping/${id}`, data);
        return response.data;
    },
    deleteHousekeepingTask: async (id: string) => {
        const response = await api.delete(`/hospitality/housekeeping/${id}`);
        return response.data;
    },

    // Calendar View
    getCalendarData: async (params?: { startDate?: string; endDate?: string }) => {
        const response = await api.get('/hospitality/calendar', { params });
        return response.data;
    },

    // Future Reservations
    createReservation: async (data: {
        roomId: string;
        customerName: string;
        guestCount: number;
        guestDocumentType?: string;
        guestDocumentNumber?: string;
        guestNationality?: string;
        guestPhone?: string;
        checkIn: string;
        expectedCheckout: string;
        mealPlan?: string;
        notes?: string;
    }) => {
        const response = await api.post('/hospitality/reservations', data);
        return response.data;
    },

    // Dashboard
    getDashboardSummary: async () => {
        const response = await api.get('/hospitality/dashboard/summary');
        return response.data;
    },

    getRecentBookings: async (limit?: number) => {
        const response = await api.get('/hospitality/dashboard/recent-bookings', {
            params: { limit }
        });
        return response.data;
    },

    // Financial Management
    getFinanceDashboard: async (period?: string) => {
        const response = await api.get('/hospitality/finance/dashboard', { params: { period } });
        return response.data;
    },

    getRevenues: async (params?: any) => {
        const response = await api.get('/hospitality/finance/revenues', { params });
        return response.data;
    },

    getExpenses: async (params?: any) => {
        const response = await api.get('/hospitality/finance/expenses', { params });
        return response.data;
    },

    createExpense: async (data: any) => {
        const response = await api.post('/hospitality/finance/expenses', data);
        return response.data;
    },

    updateExpense: async (id: string, data: any) => {
        const response = await api.put(`/hospitality/finance/expenses/${id}`, data);
        return response.data;
    },

    deleteExpense: async (id: string) => {
        const response = await api.delete(`/hospitality/finance/expenses/${id}`);
        return response.data;
    },

    getProfitLossReport: async (startDate: string, endDate: string) => {
        const response = await api.get('/hospitality/finance/reports/profit-loss', {
            params: { startDate, endDate }
        });
        return response.data;
    },

    getByRoomReport: async (startDate?: string, endDate?: string) => {
        const response = await api.get('/hospitality/finance/reports/by-room', {
            params: { startDate, endDate }
        });
        return response.data;
    },
};

// =============================================================================
// PHARMACY API
// =============================================================================

export const pharmacyAPI = {
    // Medications
    getMedications: async (params?: { search?: string; requiresPrescription?: boolean; isControlled?: boolean; lowStock?: boolean; expiringDays?: number }) => {
        const response = await api.get('/pharmacy/medications', { params });
        return response.data;
    },

    createMedication: async (data: any) => {
        const response = await api.post('/pharmacy/medications', data);
        return response.data;
    },

    updateMedication: async (id: string, data: any) => {
        const response = await api.put(`/pharmacy/medications/${id}`, data);
        return response.data;
    },
    deleteMedication: async (id: string) => {
        const response = await api.delete(`/pharmacy/medications/${id}`);
        return response.data;
    },

    // Batches
    getBatches: async (params?: { status?: string; expiringDays?: number; medicationId?: string }) => {
        const response = await api.get('/pharmacy/batches', { params });
        return response.data;
    },

    createBatch: async (data: any) => {
        const response = await api.post('/pharmacy/batches', data);
        return response.data;
    },

    // Sales (POS)
    getSales: async (params?: { page?: number; limit?: number; startDate?: string; endDate?: string; status?: string; customerId?: string }) => {
        const response = await api.get('/pharmacy/sales', { params });
        return response.data;
    },

    createSale: async (data: any) => {
        const response = await api.post('/pharmacy/sales', data);
        return response.data;
    },

    refundSale: async (id: string, data: { reason: string }) => {
        const response = await api.post(`/pharmacy/sales/${id}/refund`, data);
        return response.data;
    },

    // Prescriptions
    getPrescriptions: async (params?: { status?: string; search?: string; page?: number; limit?: number }) => {
        const response = await api.get('/pharmacy/prescriptions', { params });
        return response.data;
    },

    createPrescription: async (data: any) => {
        const response = await api.post('/pharmacy/prescriptions', data);
        return response.data;
    },

    // Dashboard
    getDashboardSummary: async () => {
        const response = await api.get('/pharmacy/dashboard/summary');
        return response.data;
    },

    getSalesChart: async (period: '7days' | '30days' | '90days' | '180days' | '365days') => {
        const response = await api.get('/pharmacy/dashboard/sales-chart', { params: { period } });
        return response.data;
    },

    getTopProducts: async (limit?: number) => {
        const response = await api.get('/pharmacy/dashboard/top-products', { params: { limit } });
        return response.data;
    },

    // Reports
    getExpiringReport: async (days?: number) => {
        const response = await api.get('/pharmacy/reports/expiring', { params: { days } });
        return response.data;
    },

    getStockReport: async () => {
        const response = await api.get('/pharmacy/reports/stock');
        return response.data;
    },

    getStockMovements: async (params?: { batchId?: string; movementType?: string; startDate?: string; endDate?: string }) => {
        const response = await api.get('/pharmacy/stock-movements', { params });
        return response.data;
    }
};

// ============================================================================
// Backups API
// ============================================================================

export const backupsAPI = {
    getList: async () => {
        const response = await api.get('/backups/list');
        return response.data;
    },

    getStats: async () => {
        const response = await api.get('/backups/stats');
        return response.data;
    },

    create: async () => {
        const response = await api.post('/backups/create');
        return response.data;
    },

    download: async (filename: string) => {
        const response = await api.get(`/backups/download/${filename}`, {
            responseType: 'blob',
        });
        return response.data;
    },

    delete: async (filename: string) => {
        const response = await api.delete(`/backups/${filename}`);
        return response.data;
    },

    restore: async (filename: string) => {
        const response = await api.post(`/backups/restore/${filename}`);
        return response.data;
    },
};

// ============================================================================
// Google Drive API
// ============================================================================

export const gdriveAPI = {
    getStatus: async () => {
        const response = await api.get('/gdrive/status');
        return response.data;
    },

    getAuthUrl: async () => {
        const response = await api.get('/gdrive/auth-url');
        return response.data;
    },

    getBackups: async () => {
        const response = await api.get('/gdrive/backups');
        return response.data;
    },

    upload: async (filename: string) => {
        const response = await api.post(`/gdrive/upload/${filename}`);
        return response.data;
    },

    delete: async (fileId: string) => {
        const response = await api.delete(`/gdrive/${fileId}`);
        return response.data;
    },
};

export { api };
