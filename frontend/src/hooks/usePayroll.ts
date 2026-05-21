import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { employeesAPI, payrollAPI } from '../services/api';
import type { PayrollRecord } from '../types';

interface UsePayrollParams {
    employeeId?: string;
    month?: number;
    year?: number;
    status?: string;
    originModule?: string;
    page?: number;
    limit?: number;
}

type PayrollListResponse = {
    success?: boolean;
    data?: { data?: PayrollRecord[] } | PayrollRecord[];
    records?: PayrollRecord[];
};

type PayrollRecordResponse = {
    success?: boolean;
    data?: PayrollRecord;
};

function parsePayrollList(result: unknown): PayrollRecord[] {
    const response = result as PayrollListResponse;
    if (response.success && response.data) {
        if (Array.isArray(response.data)) return response.data;
        return response.data.data || [];
    }
    if (Array.isArray(result)) return result as PayrollRecord[];
    return response.records || [];
}

function parsePayrollRecord(result: unknown): PayrollRecord {
    const response = result as PayrollRecordResponse;
    return response.success && response.data ? response.data : result as PayrollRecord;
}

export function usePayroll(params?: UsePayrollParams) {
    const queryClient = useQueryClient();
    const queryKey = ['payroll', params] as const;

    const payrollQuery = useQuery({
        queryKey,
        queryFn: async () => parsePayrollList(await payrollAPI.list(params)),
    });

    const invalidatePayroll = useCallback(async () => {
        await queryClient.invalidateQueries({ queryKey: ['payroll'] });
    }, [queryClient]);

    const createMutation = useMutation({
        mutationFn: payrollAPI.create,
        onSuccess: invalidatePayroll,
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Parameters<typeof payrollAPI.update>[1] }) =>
            payrollAPI.update(id, data),
        onSuccess: invalidatePayroll,
    });

    const processMutation = useMutation({
        mutationFn: payrollAPI.process,
        onSuccess: invalidatePayroll,
    });

    const markPaidMutation = useMutation({
        mutationFn: ({ id, approvalId }: { id: string; approvalId?: string }) =>
            payrollAPI.markPaid(id, { approvalId }),
        onSuccess: invalidatePayroll,
    });

    const createPayroll = async (data: Parameters<typeof payrollAPI.create>[0]) => {
        const record = parsePayrollRecord(await createMutation.mutateAsync(data));
        toast.success('Registro de salario criado com sucesso!');
        return record;
    };

    const updatePayroll = async (id: string, data: Parameters<typeof payrollAPI.update>[1]) => {
        const updated = parsePayrollRecord(await updateMutation.mutateAsync({ id, data }));
        toast.success('Folha salarial actualizada com sucesso!');
        return updated;
    };

    const processPayroll = async (id: string) => {
        const updated = parsePayrollRecord(await processMutation.mutateAsync(id));
        toast.success('Salario processado com sucesso!');
        return updated;
    };

    const addAuditLog = async (
        id: string,
        action: string,
        userId: string,
        userName: string,
        details?: string,
    ) => {
        try {
            await employeesAPI.addPayrollAudit(id, { action, userId, userName, details });
        } catch {
            // Audit is best-effort for compatibility with legacy payroll records.
        }
    };

    const markAsPaid = async (id: string, paidBy: string, notes?: string, approvalId?: string) => {
        const updated = parsePayrollRecord(await markPaidMutation.mutateAsync({ id, approvalId }));
        toast.success('Salario marcado como pago!');
        if (paidBy || notes) {
            await addAuditLog(id, 'paid', paidBy, paidBy, notes);
        }
        return updated;
    };

    const getEmployeeHistory = async (employeeId: string): Promise<PayrollRecord[]> => {
        try {
            const result = await employeesAPI.getPayrollHistory(employeeId);
            return parsePayrollList(result);
        } catch {
            return [];
        }
    };

    return {
        payroll: payrollQuery.data || [],
        isLoading: payrollQuery.isLoading,
        error: payrollQuery.error ? 'Erro ao carregar folha salarial' : null,
        refetch: payrollQuery.refetch,
        createPayroll,
        updatePayroll,
        processPayroll,
        markAsPaid,
        addAuditLog,
        getEmployeeHistory,
    };
}
