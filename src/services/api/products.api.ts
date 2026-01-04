import api from './client';

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
