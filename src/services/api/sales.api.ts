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
        search?: string;
        warehouseId?: string;
        originModule?: string;
        page?: number;
        limit?: number;
    }) => {
        const normalizedParams = { ...params };
        if (normalizedParams.warehouseId === '') {
            delete normalizedParams.warehouseId;
        }
        const response = await api.get('/sales', { params: normalizedParams });
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

    // Step 1 -- any operator/cashier flags a sale for cancellation with a reason.
    // The sale is NOT deleted; it enters `pending_void` until a manager approves.
    requestVoid: async (id: string, reason: string) => {
        const response = await api.post(`/sales/${id}/void/request`, { reason });
        return response.data;
    },

    // Step 2a -- a manager (different from the requester) approves and the
    // backend restores stock + reverses customer stats / loyalty.
    approveVoid: async (id: string) => {
        const response = await api.post(`/sales/${id}/void/approve`);
        return response.data;
    },

    // Step 2b -- manager refuses; sale returns to `active`.
    rejectVoid: async (id: string, reason: string) => {
        const response = await api.post(`/sales/${id}/void/reject`, { reason });
        return response.data;
    },

    // Manager inbox -- all pending void requests for this company.
    listPendingVoids: async () => {
        const response = await api.get('/sales/voids/pending');
        return response.data;
    },

    /** @deprecated Use requestVoid + approveVoid (two-step). */
    voidSale: async (id: string, reason: string) => {
        const response = await api.post(`/sales/${id}/void/request`, { reason });
        return response.data;
    },
};
