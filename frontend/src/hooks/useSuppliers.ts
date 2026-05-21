import { logger } from '../utils/logger';
import toast from 'react-hot-toast';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { suppliersAPI } from '../services/api';
import type { Supplier } from '../types';

interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
}

interface UseSuppliersParams {
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    fields?: string;
    originModule?: string;
}

const QK = ['suppliers'] as const;

export function useSuppliers(params?: UseSuppliersParams) {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: [...QK, params ?? {}],
        queryFn: async () => {
            const response = await suppliersAPI.getAll(params);

            let suppliersData: Supplier[];
            let pagination: PaginationMeta;
            if (response?.data && response?.pagination) {
                suppliersData = response.data;
                pagination = {
                    ...response.pagination,
                    hasMore: response.pagination.hasMore ?? response.pagination.hasNext ?? false,
                };
            } else {
                suppliersData = Array.isArray(response) ? response : (response.data || []);
                pagination = {
                    page: params?.page || 1,
                    limit: params?.limit || suppliersData.length,
                    total: suppliersData.length,
                    totalPages: 1,
                    hasMore: false,
                };
            }

            return { suppliers: suppliersData, pagination };
        },
        placeholderData: keepPreviousData,
    });

    const addMutation = useMutation({
        mutationFn: (data: Parameters<typeof suppliersAPI.create>[0]) => suppliersAPI.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QK });
            toast.success('Fornecedor criado com sucesso!');
        },
        onError: (err) => {
            logger.error('Error creating supplier:', err);
            toast.error('Erro ao criar fornecedor');
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Parameters<typeof suppliersAPI.update>[1] }) =>
            suppliersAPI.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QK });
            toast.success('Fornecedor actualizado com sucesso!');
        },
        onError: (err) => logger.error('Error updating supplier:', err),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => suppliersAPI.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QK });
            toast.success('Fornecedor removido com sucesso!');
        },
        onError: (err) => logger.error('Error deleting supplier:', err),
    });

    return {
        suppliers: query.data?.suppliers ?? [],
        pagination: query.data?.pagination ?? null,
        isLoading: query.isLoading || query.isFetching,
        isPlaceholderData: query.isPlaceholderData,
        error: query.error ? 'Erro ao carregar fornecedores' : null,
        refetch: query.refetch,
        addSupplier: addMutation.mutateAsync,
        updateSupplier: (id: string, data: Parameters<typeof suppliersAPI.update>[1]) => updateMutation.mutateAsync({ id, data }),
        deleteSupplier: deleteMutation.mutateAsync,
    };
}
