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
        zipCode: string;
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
// Alerts API - Module-aware notifications system
// ============================================================================

export type AlertModule = 'pos' | 'hospitality' | 'pharmacy' | 'crm' | 'invoices' | 'inventory';
export type AlertPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Alert {
    id: string;
    type: string;
    priority: AlertPriority;
    title: string;
    message: string;
    module?: AlertModule;
    isRead: boolean;
    isResolved: boolean;
    relatedId?: string;
    relatedType?: string;
    actionUrl?: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
    resolvedAt?: string;
}

export interface AlertsSummary {
    total: number;
    unread: number;
    critical: number;
    high: number;
    recentAlerts: Alert[];
}

export interface UnreadCount {
    total: number;
    byPriority: Record<string, number>;
    byModule: Record<string, number>;
}

export const alertsAPI = {
    // Get all alerts with optional filtering
    getAll: async (params?: {
        type?: string;
        module?: AlertModule;
        priority?: AlertPriority;
        isRead?: boolean;
        isResolved?: boolean;
        limit?: number;
    }): Promise<Alert[]> => {
        const response = await api.get('/alerts', { params });
        return response.data;
    },

    // Get unread count with breakdown by priority and module
    getUnreadCount: async (module?: AlertModule): Promise<UnreadCount> => {
        const response = await api.get('/alerts/unread-count', { params: { module } });
        return response.data;
    },

    // Get summary for dashboard
    getSummary: async (): Promise<AlertsSummary> => {
        const response = await api.get('/alerts/summary');
        return response.data;
    },

    // Mark single alert as read
    markAsRead: async (id: string) => {
        const response = await api.patch(`/alerts/${id}/read`);
        return response.data;
    },

    // Mark all alerts as read (optionally by module)
    markAllAsRead: async (module?: AlertModule) => {
        const response = await api.patch('/alerts/read-all', { module });
        return response.data;
    },

    // Resolve alert
    markAsResolved: async (id: string) => {
        const response = await api.patch(`/alerts/${id}/resolve`);
        return response.data;
    },

    // Delete alert
    delete: async (id: string) => {
        const response = await api.delete(`/alerts/${id}`);
        return response.data;
    },

    // Clear all resolved alerts
    clearResolved: async () => {
        const response = await api.delete('/alerts/clear/resolved');
        return response.data;
    },

    // Generate all alerts
    generate: async () => {
        const response = await api.post('/alerts/generate');
        return response.data;
    },

    // Generate alerts for specific module
    generateForModule: async (module: AlertModule) => {
        const response = await api.post(`/alerts/generate/${module}`);
        return response.data;
    },

    // Create custom alert
    create: async (data: {
        type: string;
        priority?: AlertPriority;
        title: string;
        message: string;
        module?: AlertModule;
        relatedId?: string;
        relatedType?: string;
        actionUrl?: string;
        metadata?: Record<string, unknown>;
    }): Promise<Alert> => {
        const response = await api.post('/alerts', data);
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
