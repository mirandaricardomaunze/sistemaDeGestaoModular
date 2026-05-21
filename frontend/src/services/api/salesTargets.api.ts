import { api } from './client';
export interface Result<T> {
    success: boolean;
    data: T;
    message?: string;
}

export interface SalesTarget {
    id: string;
    employeeId?: string | null;
    employee?: { id: string; name: string; userId?: string | null } | null;
    warehouseId?: string | null;
    warehouse?: { id: string; name: string; code: string } | null;
    type: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    value: number;
    startDate: string;
    endDate: string;
    isActive: boolean;
    current?: number;
    progress?: number;
    remaining?: number;
    salesCount?: number;
}

export interface SalesTargetListFilters {
    employeeId?: string;
    warehouseId?: string;
}

export interface SalesTargetSummary {
    totals: { target: number; actual: number; progress: number; count: number };
    byType: Array<{ type: 'DAILY' | 'WEEKLY' | 'MONTHLY'; target: number; actual: number; progress: number; count: number }>;
    byWarehouse: Array<{ warehouseId: string | null; warehouseName: string; target: number; actual: number; progress: number; count: number }>;
    byOperator: Array<{ employeeId: string | null; employeeName: string; target: number; actual: number; progress: number; count: number }>;
}

export const salesTargetsAPI = {
    list: async (filters: SalesTargetListFilters = {}) => {
        const response = await api.get<SalesTarget[]>('/commercial/targets', {
            params: filters
        });
        return response.data;
    },
    summary: async () => {
        const response = await api.get<SalesTargetSummary>('/commercial/targets/summary');
        return response.data;
    },
    create: async (data: Partial<SalesTarget>) => {
        const response = await api.post<SalesTarget>('/commercial/targets', data);
        return response.data;
    },
    update: async (id: string, data: Partial<SalesTarget>) => {
        const response = await api.patch<SalesTarget>(`/commercial/targets/${id}`, data);
        return response.data;
    },
    delete: async (id: string) => {
        const response = await api.delete<{ message: string }>(`/commercial/targets/${id}`);
        return response.data;
    }
};
