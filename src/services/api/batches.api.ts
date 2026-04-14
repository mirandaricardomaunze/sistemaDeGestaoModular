import client from './client';

export interface ProductBatch {
    id: string;
    batchNumber: string;
    productId: string;
    companyId: string;
    supplierId?: string;
    warehouseId?: string;
    initialQuantity: number;
    quantity: number;
    costPrice: number;
    manufactureDate?: string;
    receivedDate: string;
    expiryDate?: string;
    status: 'active' | 'expiring_soon' | 'expired' | 'depleted' | 'quarantine';
    notes?: string;
    createdAt: string;
    updatedAt: string;
    daysToExpiry?: number | null;
    isExpired?: boolean;
    product?: { id: string; name: string; code: string; unit: string; category: string };
    supplier?: { id: string; name: string };
    warehouse?: { id: string; name: string; code: string };
}

export interface CreateBatchDto {
    batchNumber: string;
    productId: string;
    supplierId?: string;
    warehouseId?: string;
    quantity: number;
    costPrice?: number;
    manufactureDate?: string;
    receivedDate?: string;
    expiryDate?: string;
    notes?: string;
}

export const batchesAPI = {
    getDashboard: async () => {
        const res = await client.get('/batches/dashboard');
        return res.data;
    },
    getExpiring: async (params?: { days?: number; page?: number; limit?: number }) => {
        const res = await client.get('/batches/expiring', { params });
        return res.data;
    },
    list: async (params?: { productId?: string; status?: string; warehouseId?: string; search?: string; page?: number; limit?: number }) => {
        const res = await client.get('/batches', { params });
        return res.data;
    },
    getById: async (id: string) => {
        const res = await client.get(`/batches/${id}`);
        return res.data as ProductBatch;
    },
    create: async (data: CreateBatchDto) => {
        const res = await client.post('/batches', data);
        return res.data as ProductBatch;
    },
    update: async (id: string, data: Partial<CreateBatchDto> & { status?: string }) => {
        const res = await client.put(`/batches/${id}`, data);
        return res.data as ProductBatch;
    },
    delete: async (id: string) => {
        const res = await client.delete(`/batches/${id}`);
        return res.data;
    },
};
