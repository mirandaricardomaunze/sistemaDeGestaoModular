import api from './client';

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
