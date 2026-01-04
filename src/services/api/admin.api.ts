import api from './client';

// ============================================================================
// Modules API
// ============================================================================

export interface BusinessModule {
    id: string;
    code: string;
    name: string;
    description: string;
}

export const modulesAPI = {
    getAll: async (): Promise<BusinessModule[]> => {
        const response = await api.get('/modules');
        return response.data;
    },
};

// ============================================================================
// Admin API (Super Admin Only)
// ============================================================================

export const adminAPI = {
    getStats: async () => {
        const response = await api.get('/admin/stats', { skipErrorToast: true } as any);
        return response.data;
    },

    getCompanies: async () => {
        const response = await api.get('/admin/companies', { skipErrorToast: true } as any);
        return response.data;
    },

    getCompanyById: async (id: string) => {
        const response = await api.get(`/admin/companies/${id}`, { skipErrorToast: true } as any);
        return response.data;
    },

    toggleCompanyStatus: async (id: string, status: 'active' | 'inactive' | 'suspended') => {
        const response = await api.patch(`/admin/companies/${id}/status`, { status });
        return response.data;
    },

    getAllUsers: async () => {
        const response = await api.get('/admin/users', { skipErrorToast: true } as any);
        return response.data;
    },

    getActivity: async (limit?: number) => {
        const response = await api.get('/admin/activity', {
            params: { limit },
            skipErrorToast: true
        } as any);
        return response.data;
    },
};
