import api from './client';

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
        sessionId?: string;
        paymentMethod: string;
        amountPaid: number;
        change?: number;
        paymentRef?: string;
        notes?: string;
        warehouseId?: string;
        originModule?: string;
        redeemPoints?: number;
        tableId?: string;
    }) => {
        const response = await api.post('/sales', data);
        return response.data;
    },

    getStats: async (period?: string) => {
        const response = await api.get('/sales/stats', { params: { period } });
        return response.data;
    },

    voidSale: async (id: string, reason: string) => {
        const response = await api.post(`/sales/${id}/void`, { reason });
        return response.data;
    },
};
