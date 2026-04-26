import api from './client';

// ============================================================================
// Modules API
// ============================================================================

import { type BusinessModule } from '../../constants/modules.constants';
export type { BusinessModule };

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

    getCompanies: async (params?: { page?: number; limit?: number; search?: string; status?: string }) => {
        const response = await api.get('/admin/companies', { params, skipErrorToast: true } as any);
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

    toggleCompanyModule: async (companyId: string, moduleCode: string, isActive: boolean) => {
        const response = await api.patch(`/admin/companies/${companyId}/modules`, { moduleCode, isActive });
        return response.data;
    },

    getAllUsers: async (params?: { page?: number; limit?: number; search?: string; companyId?: string }) => {
        const response = await api.get('/admin/users', { params, skipErrorToast: true } as any);
        return response.data;
    },

    toggleUserStatus: async (id: string, isActive: boolean) => {
        const response = await api.patch(`/admin/users/${id}/status`, { isActive });
        return response.data;
    },

    getActivity: async (params?: { page?: number; limit?: number; companyId?: string; action?: string; startDate?: string; endDate?: string }) => {
        const response = await api.get('/admin/activity', { params, skipErrorToast: true } as any);
        return response.data;
    },

    getSystemHealth: async () => {
        const response = await api.get('/admin/system/health', { skipErrorToast: true } as any);
        return response.data;
    },

    getRevenue: async (days?: number) => {
        const response = await api.get('/admin/revenue', { params: { days }, skipErrorToast: true } as any);
        return response.data;
    },
};
