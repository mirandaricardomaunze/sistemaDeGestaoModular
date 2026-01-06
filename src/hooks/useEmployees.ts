import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { employeesAPI } from '../services/api';
import type { Employee } from '../types';

interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
}

interface UseEmployeesParams {
    search?: string;
    department?: string;
    role?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export function useEmployees(params?: UseEmployeesParams) {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [pagination, setPagination] = useState<PaginationMeta | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchEmployees = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await employeesAPI.getAll(params);

            let employeesData: Employee[] = [];
            if (response.data && response.pagination) {
                employeesData = response.data;
                setPagination(response.pagination);
            } else {
                employeesData = Array.isArray(response) ? response : (response.data || []);
                setPagination({
                    page: params?.page || 1,
                    limit: params?.limit || employeesData.length,
                    total: employeesData.length,
                    totalPages: 1,
                    hasMore: false
                });
            }

            setEmployees(employeesData);
        } catch (err) {
            setError('Erro ao carregar funcionários');
            console.error('Error fetching employees:', err);
        } finally {
            setIsLoading(false);
        }
    }, [
        params?.search,
        params?.department,
        params?.role,
        params?.isActive,
        params?.page,
        params?.limit,
        params?.sortBy,
        params?.sortOrder
    ]);

    useEffect(() => {
        fetchEmployees();
    }, [fetchEmployees]);

    const addEmployee = async (data: Parameters<typeof employeesAPI.create>[0]) => {
        try {
            const newEmployee = await employeesAPI.create(data);
            setEmployees((prev) => [newEmployee, ...prev]);
            toast.success('Funcionário criado com sucesso!');
            return newEmployee;
        } catch (err) {
            console.error('Error creating employee:', err);
            throw err;
        }
    };

    const updateEmployee = async (id: string, data: Parameters<typeof employeesAPI.update>[1]) => {
        try {
            const updated = await employeesAPI.update(id, data);
            setEmployees((prev) => prev.map((e) => (e.id === id ? updated : e)));
            toast.success('Funcionário actualizado com sucesso!');
            return updated;
        } catch (err) {
            console.error('Error updating employee:', err);
            throw err;
        }
    };

    const deleteEmployee = async (id: string) => {
        try {
            await employeesAPI.delete(id);
            setEmployees((prev) => prev.filter((e) => e.id !== id));
            toast.success('Funcionário removido com sucesso!');
        } catch (err) {
            console.error('Error deleting employee:', err);
            throw err;
        }
    };

    return {
        employees,
        pagination,
        isLoading,
        error,
        refetch: fetchEmployees,
        addEmployee,
        updateEmployee,
        deleteEmployee,
    };
}
