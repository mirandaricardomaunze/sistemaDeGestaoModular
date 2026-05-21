import api from './client';
import type { AxiosRequestConfig } from 'axios';

// ============================================================================
// Modules API
// ============================================================================

import { type BusinessModule } from '../../constants/modules.constants';
export type { BusinessModule };

type ApiRequestConfig = AxiosRequestConfig & {
    skipErrorToast?: boolean;
    skipOfflineQueue?: boolean;
};

type PaginatedResponse<T> = {
    data: T[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
};

export type AdminCompanyStatus = 'active' | 'inactive' | 'suspended' | 'blocked' | 'cancelled' | 'trial';

export type AdminStats = {
    companies: { total: number; active: number; inactive: number; suspended: number };
    users: { total: number; active: number; inactive: number };
    sales: { total: number; revenue: number };
    modules: Array<{ moduleCode: string; moduleName: string; companiesUsing: number }>;
    recentActivity: { sales: number; newUsers: number };
    system: { dbSize: string };
};

export type AdminCompany = {
    id: string;
    name: string;
    tradeName: string | null;
    status: AdminCompanyStatus | string;
    createdAt: string;
    userCount: number;
    moduleCount: number;
    activeModules: Array<{ code: string; name: string }>;
};

export type AdminUser = {
    id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
    createdAt: string;
    lastLogin?: string | null;
    lastLoginAt: string | null;
    company: { id: string; name: string; status: string } | null;
};

export type AdminActivity = {
    id: string;
    action: string;
    entity: string;
    entityId: string | null;
    timestamp: string;
    ipAddress: string | null;
    user: { name: string; email: string; company: { name: string } | null } | null;
};

export type AdminSystemHealth = {
    status: string;
    timestamp: string;
    database: { size: string; version: string; topTables: Array<{ table: string; rows: number }> };
    process: { uptime: number; memoryMb: number; nodeVersion: string };
};

export type AdminRevenue = {
    days?: number;
    total?: number;
    revenue?: number;
    data?: Array<Record<string, unknown>>;
};

const silentConfig = (config: AxiosRequestConfig = {}): ApiRequestConfig => ({
    ...config,
    skipErrorToast: true,
});

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
    getStats: async (): Promise<AdminStats> => {
        const response = await api.get<AdminStats>('/admin/stats', silentConfig());
        return response.data;
    },

    getCompanies: async (params?: { page?: number; limit?: number; search?: string; status?: string }): Promise<PaginatedResponse<AdminCompany>> => {
        const response = await api.get<PaginatedResponse<AdminCompany>>('/admin/companies', silentConfig({ params }));
        return response.data;
    },

    getCompanyById: async (id: string): Promise<AdminCompany> => {
        const response = await api.get<AdminCompany>(`/admin/companies/${id}`, silentConfig());
        return response.data;
    },

    toggleCompanyStatus: async (id: string, status: AdminCompanyStatus): Promise<AdminCompany> => {
        const response = await api.patch<AdminCompany>(`/admin/companies/${id}/status`, { status });
        return response.data;
    },

    toggleCompanyModule: async (companyId: string, moduleCode: string, isActive: boolean): Promise<BusinessModule> => {
        const response = await api.patch<BusinessModule>(`/admin/companies/${companyId}/modules`, { moduleCode, isActive });
        return response.data;
    },

    getAllUsers: async (params?: { page?: number; limit?: number; search?: string; companyId?: string }): Promise<PaginatedResponse<AdminUser>> => {
        const response = await api.get<PaginatedResponse<AdminUser>>('/admin/users', silentConfig({ params }));
        return {
            ...response.data,
            data: response.data.data.map((user) => ({
                ...user,
                lastLoginAt: user.lastLoginAt ?? user.lastLogin ?? null,
            })),
        };
    },

    toggleUserStatus: async (id: string, isActive: boolean): Promise<AdminUser> => {
        const response = await api.patch<AdminUser>(`/admin/users/${id}/status`, { isActive });
        return response.data;
    },

    getActivity: async (params?: { page?: number; limit?: number; companyId?: string; action?: string; startDate?: string; endDate?: string }): Promise<PaginatedResponse<AdminActivity>> => {
        const response = await api.get<PaginatedResponse<AdminActivity>>('/admin/activity', silentConfig({ params }));
        return response.data;
    },

    getSystemHealth: async (): Promise<AdminSystemHealth> => {
        const response = await api.get<AdminSystemHealth>('/admin/system/health', silentConfig());
        return response.data;
    },

    getRevenue: async (days?: number): Promise<AdminRevenue> => {
        const response = await api.get<AdminRevenue>('/admin/revenue', silentConfig({ params: { days } }));
        return response.data;
    },
};
