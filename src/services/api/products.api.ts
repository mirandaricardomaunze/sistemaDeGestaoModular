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
        origin_module?: string;
        warehouseId?: string;
        page?: number;
        limit?: number;
    }) => {
        const response = await api.get('/products', { params });
        return response.data;
    },

    getById: async (id: string) => {
        const response = await api.get(`/products/${id}`);
        return response.data;
    },

    getByBarcode: async (barcode: string) => {
        const response = await api.get(`/products/barcode/${barcode}`);
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
        sku?: string;
        expiryDate?: string;
        batchNumber?: string;
        location?: string;
        supplierId?: string;
        imageUrl?: string;
        isActive?: boolean;
        isService?: boolean;
        requiresPrescription?: boolean;
        dosageForm?: string;
        strength?: string;
        manufacturer?: string;
        origin_module?: string;
        taxRate?: number;
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
        sku: string;
        expiryDate: string;
        batchNumber: string;
        location: string;
        supplierId: string;
        imageUrl: string;
        isActive: boolean;
        isService: boolean;
        requiresPrescription: boolean;
        dosageForm: string;
        strength: string;
        manufacturer: string;
        origin_module: string;
        taxRate: number;
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
            performedBy?: string;
        }
    ) => {
        const response = await api.patch(`/products/${id}/stock`, data);
        return response.data;
    },

    bulkUpdatePrices: async (data: {
        category?: string;
        adjustmentType: 'percentage' | 'fixed';
        adjustmentValue: number;
        operation: 'increase' | 'decrease';
        origin_module?: string;
    }) => {
        const response = await api.post('/products/bulk-price-adjustment', data);
        return response.data;
    },

    getMovements: async (id: string, params?: { page?: number; limit?: number }) => {
        const response = await api.get(`/products/${id}/movements`, { params });
        return response.data;
    },

    getStockMovements: async (params?: {
        page?: number;
        limit?: number;
        type?: string;
        warehouseId?: string;
        productId?: string;
        search?: string;
        startDate?: string;
        endDate?: string;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
        origin_module?: string;
    }) => {
        const response = await api.get('/products/stock-movements', { params });
        return response.data;
    },

    getLowStock: async (params?: { page?: number; limit?: number }) => {
        const response = await api.get('/products/alerts/low-stock', { params });
        return response.data;
    },

    getExpiring: async (days?: number, params?: { page?: number; limit?: number }) => {
        const response = await api.get('/products/alerts/expiring', { params: { ...params, days } });
        return response.data;
    },

    // ── Price Tiers (preços escalonados por volume) ──────────────────────────
    getPriceTiers: async (productId: string) => {
        const response = await api.get(`/products/${productId}/price-tiers`);
        return response.data as PriceTier[];
    },

    getPriceTiersBatch: async (productIds: string[]): Promise<Record<string, { minQty: number; price: number }[]>> => {
        if (productIds.length === 0) return {};
        const response = await api.get('/products/price-tiers/batch', { params: { ids: productIds.join(',') } });
        return response.data;
    },

    setPriceTiers: async (productId: string, tiers: Omit<PriceTier, 'id' | 'productId' | 'companyId' | 'createdAt'>[]) => {
        const response = await api.put(`/products/${productId}/price-tiers`, { tiers });
        return response.data as PriceTier[];
    },
};

export interface PriceTier {
    id: string;
    productId: string;
    companyId: string;
    minQty: number;
    price: number;
    label?: string;
    createdAt: string;
}
