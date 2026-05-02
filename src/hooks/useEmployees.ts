import { logger } from '../utils/logger';
import toast from 'react-hot-toast';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
    fields?: string;
}

const QK = ['employees'] as const;

function unwrap(result: any): { data: Employee[]; pagination: PaginationMeta | null } {
    let employeesData: Employee[] = [];
    let pagination: PaginationMeta | null = null;
    if (result?.success && result?.data) {
        const payload = result.data;
        if (payload.data && payload.meta) {
            employeesData = payload.data;
            pagination = payload.meta;
        } else if (Array.isArray(payload)) {
            employeesData = payload;
        } else if (payload.data) {
            employeesData = payload.data;
            if (payload.pagination) pagination = payload.pagination;
        }
    } else if (Array.isArray(result)) {
        employeesData = result;
    }
    return { data: employeesData, pagination };
}

export function useEmployees(params?: UseEmployeesParams) {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: [...QK, params ?? {}],
        queryFn: async () => {
            const result = await employeesAPI.getAll(params as any);
            const { data, pagination } = unwrap(result);
            return {
                employees: data,
                pagination: pagination ?? {
                    page: params?.page || 1,
                    limit: params?.limit || data.length,
                    total: data.length,
                    totalPages: 1,
                    hasMore: false,
                },
            };
        },
        placeholderData: keepPreviousData,
    });

    const addMutation = useMutation({
        mutationFn: (data: Parameters<typeof employeesAPI.create>[0]) => employeesAPI.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QK });
            toast.success('Funcionário criado com sucesso!');
        },
        onError: (err) => logger.error('Error creating employee:', err),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Parameters<typeof employeesAPI.update>[1] }) =>
            employeesAPI.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QK });
            toast.success('Funcionário actualizado com sucesso!');
        },
        onError: (err) => logger.error('Error updating employee:', err),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => employeesAPI.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QK });
            toast.success('Funcionário removido com sucesso!');
        },
        onError: (err) => logger.error('Error deleting employee:', err),
    });

    return {
        employees: query.data?.employees ?? [],
        pagination: query.data?.pagination ?? null,
        isLoading: query.isLoading || query.isFetching,
        isPlaceholderData: query.isPlaceholderData,
        error: query.error ? 'Erro ao carregar funcionários' : null,
        refetch: query.refetch,
        addEmployee: addMutation.mutateAsync,
        updateEmployee: (id: string, data: any) => updateMutation.mutateAsync({ id, data }),
        deleteEmployee: deleteMutation.mutateAsync,
    };
}
