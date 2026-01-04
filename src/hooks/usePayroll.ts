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
            const response = await employeesAPI.getPayroll(params);
            const payrollData = Array.isArray(response) ? response : (response.records || []);
            setPayroll(payrollData);
        } catch (err) {
            setError('Erro ao carregar folha salarial');
            console.error('Error fetching payroll:', err);
        } finally {
            setIsLoading(false);
        }
    }, [params?.employeeId, params?.month, params?.year, params?.status]);

    useEffect(() => {
        fetchPayroll();
    }, [fetchPayroll]);

    const createPayroll = async (data: Parameters<typeof employeesAPI.createPayroll>[0]) => {
        try {
            const record = await employeesAPI.createPayroll(data);
            setPayroll((prev) => [...prev, record]);
            toast.success('Registro de salário criado com sucesso!');
            return record;
        } catch (err) {
            console.error('Error creating payroll:', err);
            throw err;
        }
    };

    const updatePayroll = async (id: string, data: Parameters<typeof employeesAPI.updatePayroll>[1]) => {
        try {
            const updated = await employeesAPI.updatePayroll(id, data);
            setPayroll((prev) => prev.map((p) => (p.id === id ? updated : p)));
            toast.success('Folha salarial actualizada com sucesso!');
            return updated;
        } catch (err) {
            console.error('Error updating payroll:', err);
            throw err;
        }
    };

    const processPayroll = async (id: string) => {
        try {
            const updated = await employeesAPI.processPayroll(id);
            setPayroll((prev) => prev.map((p) => (p.id === id ? updated : p)));
            toast.success('Salário processado com sucesso!');
            return updated;
        } catch (err) {
            console.error('Error processing payroll:', err);
            throw err;
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
    };
}
