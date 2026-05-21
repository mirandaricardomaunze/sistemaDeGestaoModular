import api from './client';
import type {
    ApprovalRequest,
    ApprovalListParams,
    CreateApprovalRequestInput,
    DecideApprovalRequestInput,
} from '../../types/approvals';

interface ApprovalListResponse {
    data: ApprovalRequest[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

interface ApprovalSingleResponse {
    id?: string;
    data?: ApprovalRequest;
    message?: string;
}

export const approvalsAPI = {
    list: async (params?: ApprovalListParams): Promise<ApprovalListResponse> => {
        const res = await api.get('/approvals', { params });
        return res.data;
    },

    getById: async (id: string): Promise<ApprovalSingleResponse> => {
        const res = await api.get(`/approvals/${id}`);
        return res.data;
    },

    create: async (payload: CreateApprovalRequestInput): Promise<ApprovalSingleResponse> => {
        const res = await api.post('/approvals', payload);
        return res.data;
    },

    approve: async (id: string, payload: DecideApprovalRequestInput = {}): Promise<ApprovalSingleResponse> => {
        const res = await api.post(`/approvals/${id}/approve`, payload);
        return res.data;
    },

    reject: async (id: string, payload: DecideApprovalRequestInput = {}): Promise<ApprovalSingleResponse> => {
        const res = await api.post(`/approvals/${id}/reject`, payload);
        return res.data;
    },

    cancel: async (id: string): Promise<ApprovalSingleResponse> => {
        const res = await api.post(`/approvals/${id}/cancel`);
        return res.data;
    },
};
