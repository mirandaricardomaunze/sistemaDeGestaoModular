import api from './client';

export interface AuditLog {
    id: string;
    userId?: string;
    userName?: string;
    action: string;
    entity: string;
    entityId?: string;
    oldData?: any;
    newData?: any;
    ipAddress?: string;
    userAgent?: string;
    createdAt: string;
    companyId: string;
    user?: {
        name: string;
        email: string;
    };
}

export interface AuditLogsResponse {
    data: AuditLog[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

export const auditAPI = {
    getAll: async (params?: {
        page?: number;
        limit?: number;
        action?: string;
        entity?: string;
    }): Promise<AuditLogsResponse> => {
        const response = await api.get('/audit', { params });
        return response.data;
    },

    create: async (data: Partial<AuditLog>) => {
        const response = await api.post('/audit', data);
        return response.data;
    }
};
