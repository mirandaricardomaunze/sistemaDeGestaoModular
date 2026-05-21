import { logger } from '../../utils/logger';
import api from './client';

type ApiPayload = object;

// ============================================================================
// Audit API
// ============================================================================

export const auditAPI = {
    /**
     * Get all audit logs with optional filtering
     */
    getAll: async (params?: {
        startDate?: string;
        endDate?: string;
        userId?: string;
        action?: string;
        entity?: string;
        searchTerm?: string;
        success?: boolean;
        limit?: number;
        page?: number;
    }) => {
        const response = await api.get('/audit', { params });
        return response.data;
    },

    /**
     * Get aggregated stats for audit logs
     */
    getStats: async (params?: {
        startDate?: string;
        endDate?: string;
        userId?: string;
        action?: string;
        entity?: string;
    }) => {
        const response = await api.get('/audit/stats', { params });
        return response.data;
    },

    /**
     * Create a new audit log entry
     */
    create: async (data: {
        userId?: string;
        userName?: string;
        action: string;
        entity: string;
        entityId?: string;
        oldData?: Record<string, unknown>;
        newData?: Record<string, unknown>;
        ipAddress?: string;
    }) => {
        try {
            const response = await api.post('/audit', data);
            return response.data;
        } catch (error) {
            // Fail silently for audit logs - don't disrupt user experience
            logger.error('Failed to create audit log:', error);
            return null;
        }
    },

    /**
     * Batch create multiple audit logs
     */
    createBatch: async (logs: Array<{
        userId?: string;
        userName?: string;
        action: string;
        entity: string;
        entityId?: string;
        oldData?: Record<string, unknown>;
        newData?: Record<string, unknown>;
    }>) => {
        try {
            // Create logs one by one (backend doesn't have batch endpoint yet)
            const promises = logs.map(log => auditAPI.create(log));
            await Promise.allSettled(promises);
        } catch (error) {
            logger.error('Failed to create batch audit logs:', error);
        }
    },
};

// ============================================================================
// CRM API
// ============================================================================

export const crmAPI = {
    // Funnel Stages
    getStages: async () => {
        const response = await api.get('/crm/stages');
        return response.data;
    },

    createStage: async (data: ApiPayload) => {
        const response = await api.post('/crm/stages', data);
        return response.data;
    },

    updateStage: async (id: string, data: ApiPayload) => {
        const response = await api.put(`/crm/stages/${id}`, data);
        return response.data;
    },

    deleteStage: async (id: string) => {
        const response = await api.delete(`/crm/stages/${id}`);
        return response.data;
    },

    // Opportunities
    getOpportunities: async (params?: { stageId?: string; customerId?: string; search?: string; limit?: number }) => {
        const response = await api.get('/crm/opportunities', { params });
        return response.data;
    },

    getOpportunity: async (id: string) => {
        const response = await api.get(`/crm/opportunities/${id}`);
        return response.data;
    },

    createOpportunity: async (data: ApiPayload) => {
        const response = await api.post('/crm/opportunities', data);
        return response.data;
    },

    updateOpportunity: async (id: string, data: ApiPayload) => {
        const response = await api.put(`/crm/opportunities/${id}`, data);
        return response.data;
    },

    deleteOpportunity: async (id: string) => {
        const response = await api.delete(`/crm/opportunities/${id}`);
        return response.data;
    },

    moveOpportunity: async (id: string, newStageId: string, reason?: string) => {
        const response = await api.post(`/crm/opportunities/${id}/move`, { newStageId, reason });
        return response.data;
    },

    // Interactions
    addInteraction: async (opportunityId: string, data: ApiPayload) => {
        const response = await api.post(`/crm/opportunities/${opportunityId}/interactions`, data);
        return response.data;
    },

    getInteractions: async (opportunityId: string) => {
        const response = await api.get(`/crm/opportunities/${opportunityId}/interactions`);
        return response.data;
    },
};

// ============================================================================
// Fiscal API
// ============================================================================

export const fiscalAPI = {
    // Tax Configs
    getTaxConfigs: async () => {
        const response = await api.get('/fiscal/tax-configs');
        return response.data;
    },

    createTaxConfig: async (data: ApiPayload) => {
        const response = await api.post('/fiscal/tax-configs', data);
        return response.data;
    },

    updateTaxConfig: async (id: string, data: ApiPayload) => {
        const response = await api.put(`/fiscal/tax-configs/${id}`, data);
        return response.data;
    },

    // IRPS Brackets
    getIRPSBrackets: async (year?: number) => {
        const response = await api.get('/fiscal/irps-brackets', { params: { year } });
        return response.data;
    },

    createIRPSBracket: async (data: ApiPayload) => {
        const response = await api.post('/fiscal/irps-brackets', data);
        return response.data;
    },

    // Retentions
    getRetentions: async (params?: { period?: string; type?: string }) => {
        const response = await api.get('/fiscal/retentions', { params });
        return response.data;
    },

    getCommercialSummary: async (params?: { period?: string }) => {
        const response = await api.get('/fiscal/commercial-summary', { params });
        return response.data;
    },

    getPeriodStatus: async (period: string) => {
        const response = await api.get(`/fiscal/periods/${period}/status`);
        return response.data;
    },

    closePeriod: async (period: string) => {
        const response = await api.post(`/fiscal/periods/${period}/close`);
        return response.data;
    },

    createRetention: async (data: ApiPayload) => {
        const response = await api.post('/fiscal/retentions', data);
        return response.data;
    },

    updateRetention: async (id: string, data: ApiPayload) => {
        const response = await api.put(`/fiscal/retentions/${id}`, data);
        return response.data;
    },

    // Reports
    getReports: async () => {
        const response = await api.get('/fiscal/reports');
        return response.data;
    },

    createReport: async (data: ApiPayload) => {
        const response = await api.post('/fiscal/reports', data);
        return response.data;
    },

    updateReport: async (id: string, data: ApiPayload) => {
        const response = await api.put(`/fiscal/reports/${id}`, data);
        return response.data;
    },

    // Deadlines
    getDeadlines: async () => {
        const response = await api.get('/fiscal/deadlines');
        return response.data;
    },

    createDeadline: async (data: ApiPayload) => {
        const response = await api.post('/fiscal/deadlines', data);
        return response.data;
    },

    updateDeadline: async (id: string, data: ApiPayload) => {
        const response = await api.put(`/fiscal/deadlines/${id}`, data);
        return response.data;
    },

    completeDeadline: async (id: string) => {
        const response = await api.post(`/fiscal/deadlines/${id}/complete`);
        return response.data;
    },

    getLogisticsMetrics: async () => {
        const response = await api.get('/fiscal/metrics/logistics');
        return response.data;
    },
};
