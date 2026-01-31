import api from './client';

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
