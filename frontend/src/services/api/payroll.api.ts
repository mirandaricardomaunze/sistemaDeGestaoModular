import api from './client';
import type { PayrollRecord } from '../../types';

export interface PayrollPreviewInput {
    baseSalary: number;
    overtimeAmount?: number;
    bonus?: number;
    allowances?: Array<{ name: string; amount: number; taxable?: boolean }>;
    deductions?: Array<{ name: string; amount: number }>;
}

export interface PayrollPreviewResult {
    baseSalary: number;
    grossSalary: number;
    taxableIncome: number;
    inssEmployee: number;
    inssEmployer: number;
    irt: number;
    manualDeductions: number;
    totalDeductions: number;
    netSalary: number;
}

export const payrollAPI = {
    async list(params?: {
        employeeId?: string;
        month?: number;
        year?: number;
        status?: string;
        originModule?: string;
        page?: number;
        limit?: number;
    }) {
        const response = await api.get('/payroll', { params });
        return response.data;
    },

    async create(data: {
        employeeId: string;
        month: number;
        year: number;
        otHours?: number;
        advances?: number;
        bonus?: number;
        notes?: string;
        originModule?: string;
    }): Promise<PayrollRecord> {
        const response = await api.post('/payroll', data);
        return response.data;
    },

    async update(id: string, data: Partial<{
        status: string;
        otHours: number;
        otAmount: number;
        bonus: number;
        allowances: number;
        advances: number;
        notes: string;
        approvalId: string;
    }>) {
        const response = await api.put(`/payroll/${id}`, data);
        return response.data;
    },

    async process(id: string) {
        const response = await api.post(`/payroll/${id}/process`);
        return response.data;
    },

    async markPaid(id: string, data: { approvalId?: string }) {
        const response = await api.post(`/payroll/${id}/mark-paid`, data);
        return response.data;
    },

    async preview(input: PayrollPreviewInput): Promise<{ success?: boolean; data?: PayrollPreviewResult } | PayrollPreviewResult> {
        const response = await api.post('/payroll/preview', input);
        return response.data;
    },
};
