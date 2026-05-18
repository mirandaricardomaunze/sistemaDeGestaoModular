import { api } from './client';
export interface Result<T> {
    success: boolean;
    data: T;
    message?: string;
}

export interface SalesTarget {
    id: string;
    employeeId?: string;
    employee?: { name: string };
    type: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    value: number;
    startDate: string;
    endDate: string;
    isActive: boolean;
    current?: number;
    progress?: number;
}

export const salesTargetsAPI = {
    list: async (employeeId?: string) => {
        const response = await api.get<SalesTarget[]>('/commercial/targets', {
            params: { employeeId }
        });
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
