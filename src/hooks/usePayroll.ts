import { logger } from '../utils/logger';
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { employeesAPI } from '../services/api';
import type { PayrollRecord } from '../types';

interface UsePayrollParams {
    employeeId?: string;
    month?: number;
    year?: number;
    status?: string;
}

export function usePayroll(params?: UsePayrollParams) {
    const [payroll, setPayroll] = useState<PayrollRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPayroll = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await employeesAPI.getPayroll(params);
            
            let payrollData: PayrollRecord[] = [];
            if (result.success && result.data) {
                const payload = result.data;
                payrollData = payload.data || (Array.isArray(payload) ? payload : []);
            } else {
                payrollData = Array.isArray(result) ? result : (result.records || []);
            }
            
            setPayroll(payrollData);
        } catch (err) {
            setError('Erro ao carregar folha salarial');
            logger.error('Error fetching payroll:', err);
        } finally {
            setIsLoading(false);
        }
    }, [params?.employeeId, params?.month, params?.year, params?.status]);

    useEffect(() => {
        fetchPayroll();
    }, [fetchPayroll]);

    const createPayroll = async (data: Parameters<typeof employeesAPI.createPayroll>[0]) => {
        try {
            const result = await employeesAPI.createPayroll(data);
            const record = result.success ? result.data : result;
            setPayroll((prev) => [...prev, record]);
            toast.success('Registro de salário criado com sucesso!');
            return record;
        } catch (err) {
            logger.error('Error creating payroll:', err);
            throw err;
        }
    };

    const updatePayroll = async (id: string, data: Parameters<typeof employeesAPI.updatePayroll>[1]) => {
        try {
            const result = await employeesAPI.updatePayroll(id, data);
            const updated = result.success ? result.data : result;
            setPayroll((prev) => prev.map((p) => (p.id === id ? updated : p)));
            toast.success('Folha salarial actualizada com sucesso!');
            return updated;
        } catch (err) {
            logger.error('Error updating payroll:', err);
            throw err;
        }
    };

    const processPayroll = async (id: string) => {
        try {
            const result = await employeesAPI.processPayroll(id);
            const updated = result.success ? result.data : result;
            setPayroll((prev) => prev.map((p) => (p.id === id ? updated : p)));
            toast.success('Salário processado com sucesso!');
            return updated;
        } catch (err) {
            logger.error('Error processing payroll:', err);
            throw err;
        }
    };

    const markAsPaid = async (id: string, paidBy: string, notes?: string) => {
        try {
            const result = await employeesAPI.markPayrollAsPaid(id, { paidBy, notes });
            const updated = result.success ? result.data : result;
            setPayroll((prev) => prev.map((p) => (p.id === id ? updated : p)));
            toast.success('Salário marcado como pago!');
            return updated;
        } catch (err) {
            logger.error('Error marking payroll as paid:', err);
            toast.error('Erro ao marcar como pago');
            throw err;
        }
    };

    const addAuditLog = async (id: string, action: string, userId: string, userName: string, details?: string) => {
        try {
            await employeesAPI.addPayrollAudit(id, { action, userId, userName, details });
        } catch (err) {
            logger.error('Error adding audit log:', err);
        }
    };

    const getEmployeeHistory = async (employeeId: string): Promise<PayrollRecord[]> => {
        try {
            const result = await employeesAPI.getPayrollHistory(employeeId);
            
            if (result.success && result.data) {
                const payload = result.data;
                return payload.data || (Array.isArray(payload) ? payload : []);
            }
            return Array.isArray(result) ? result : (result.records || []);
        } catch (err) {
            logger.error('Error fetching payroll history:', err);
            return [];
        }
    };

    return {
        payroll,
        isLoading,
        error,
        refetch: fetchPayroll,
        createPayroll,
        updatePayroll,
        processPayroll,
        markAsPaid,
        addAuditLog,
        getEmployeeHistory,
    };
}
