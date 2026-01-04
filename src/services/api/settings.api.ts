import api from './client';

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
