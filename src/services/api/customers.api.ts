import api from './client';

// ============================================================================
// Customers API
// ============================================================================

export const customersAPI = {
    getAll: async (params?: { search?: string; type?: string }) => {
        const response = await api.get('/customers', { params });
        return response.data;
    },

    getById: async (id: string) => {
        const response = await api.get(`/customers/${id}`);
        return response.data;
    },

    create: async (data: {
        code?: string;
        name: string;
        type?: 'individual' | 'company';
        email?: string;
        phone: string;
        document?: string;
        address?: string;
        city?: string;
        province?: string;
        notes?: string;
        creditLimit?: number;
    }) => {
        const response = await api.post('/customers', data);
        return response.data;
    },

    update: async (id: string, data: Partial<{
        name: string;
        type: 'individual' | 'company';
        email: string;
        phone: string;
        document: string;
        address: string;
        city: string;
        province: string;
        notes: string;
        creditLimit: number;
    }>) => {
        const response = await api.put(`/customers/${id}`, data);
        return response.data;
    },

    delete: async (id: string) => {
        const response = await api.delete(`/customers/${id}`);
        return response.data;
    },
};
