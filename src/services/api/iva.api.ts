import client from './client';

export interface IvaRate {
    id: string;
    code: string;
    name: string;
    description?: string;
    rate: number;
    isDefault: boolean;
    applicableCategories: string[];
    isActive: boolean;
    effectiveFrom: string;
    effectiveTo?: string;
    companyId: string;
    createdAt: string;
    updatedAt: string;
    _count?: { products: number; invoiceItems: number };
}

export interface CreateIvaRateDto {
    code: string;
    name: string;
    description?: string;
    rate: number;
    isDefault?: boolean;
    applicableCategories?: string[];
    isActive?: boolean;
    effectiveFrom?: string;
    effectiveTo?: string;
}

export const ivaAPI = {
    getDashboard: async () => {
        const res = await client.get('/fiscal/iva-rates/dashboard');
        return res.data;
    },
    getActive: async () => {
        const res = await client.get('/fiscal/iva-rates/active');
        return res.data as IvaRate[];
    },
    list: async (params?: { isActive?: boolean; page?: number; limit?: number }) => {
        const res = await client.get('/fiscal/iva-rates', { params });
        return res.data;
    },
    getById: async (id: string) => {
        const res = await client.get(`/fiscal/iva-rates/${id}`);
        return res.data as IvaRate;
    },
    create: async (data: CreateIvaRateDto) => {
        const res = await client.post('/fiscal/iva-rates', data);
        return res.data as IvaRate;
    },
    update: async (id: string, data: Partial<CreateIvaRateDto>) => {
        const res = await client.put(`/fiscal/iva-rates/${id}`, data);
        return res.data as IvaRate;
    },
    delete: async (id: string) => {
        const res = await client.delete(`/fiscal/iva-rates/${id}`);
        return res.data;
    },
};
