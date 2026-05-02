import { logger } from '../utils/logger';
import toast from 'react-hot-toast';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customersAPI } from '../services/api';
import { db, cryptoRandomId } from '../db/offlineDB';
import type { Customer } from '../types';

interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
}

interface UseCustomersParams {
    search?: string;
    type?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    originModule?: string;
    /** Comma-separated field projection, e.g. 'id,name,phone'. */
    fields?: string;
}

const QK = ['customers'] as const;

export function useCustomers(params?: UseCustomersParams) {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: [...QK, params ?? {}],
        queryFn: async () => {
            if (!navigator.onLine) {
                const cached = await db.customers.toArray();
                toast('A usar lista de clientes offline', { icon: '👥' });
                return {
                    customers: cached,
                    pagination: {
                        page: 1, limit: cached.length, total: cached.length,
                        totalPages: 1, hasMore: false,
                    } as PaginationMeta,
                };
            }

            const response = await customersAPI.getAll(params as any);

            let customersData: Customer[];
            let pagination: PaginationMeta;
            if (response?.data && response?.pagination) {
                customersData = response.data;
                pagination = {
                    ...response.pagination,
                    hasMore: response.pagination.hasMore ?? response.pagination.hasNext ?? false,
                };
            } else {
                customersData = Array.isArray(response) ? response : (response.data || []);
                pagination = {
                    page: params?.page || 1,
                    limit: params?.limit || customersData.length,
                    total: customersData.length,
                    totalPages: 1,
                    hasMore: false,
                };
            }

            // Offline cache: only first-page-no-filter mirrors offline catalogue
            if ((!params?.page || params.page === 1) && !params?.search) {
                try {
                    await db.customers.clear();
                    if (customersData.length > 0) await db.customers.bulkPut(customersData);
                } catch (e) {
                    logger.error('Dexie error in useCustomers:', e);
                }
            }

            return { customers: customersData, pagination };
        },
        placeholderData: keepPreviousData,
    });

    const addMutation = useMutation({
        mutationFn: async (data: Parameters<typeof customersAPI.create>[0]) => {
            if (!navigator.onLine) {
                await db.pendingOperations.add({
                    clientId: cryptoRandomId(),
                    module: 'customers',
                    endpoint: '/customers',
                    method: 'POST',
                    data,
                    timestamp: Date.now(),
                    status: 'pending',
                    synced: false,
                    attempts: 0,
                    nextRetryAt: Date.now(),
                });
                toast('Cliente guardado localmente (Offline)', { icon: '💾' });
                return { ...data, id: `offline-${Date.now()}` } as any;
            }
            return customersAPI.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QK });
            toast.success('Cliente criado com sucesso!');
        },
        onError: (err) => {
            logger.error('Error creating customer:', err);
            toast.error('Erro ao criar cliente');
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Parameters<typeof customersAPI.update>[1] }) => {
            if (!navigator.onLine) {
                await db.pendingOperations.add({
                    clientId: cryptoRandomId(),
                    module: 'customers',
                    endpoint: `/customers/${id}`,
                    method: 'PUT',
                    data,
                    timestamp: Date.now(),
                    status: 'pending',
                    synced: false,
                    attempts: 0,
                    nextRetryAt: Date.now(),
                });
                toast('Actualização guardada localmente (Offline)', { icon: '💾' });
                return { ...data, id } as any;
            }
            return customersAPI.update(id, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QK });
            toast.success('Cliente actualizado com sucesso!');
        },
        onError: (err) => logger.error('Error updating customer:', err),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            if (!navigator.onLine) {
                await db.pendingOperations.add({
                    clientId: cryptoRandomId(),
                    module: 'customers',
                    endpoint: `/customers/${id}`,
                    method: 'DELETE',
                    data: null,
                    timestamp: Date.now(),
                    status: 'pending',
                    synced: false,
                    attempts: 0,
                    nextRetryAt: Date.now(),
                });
                toast('Remoção guardada localmente (Offline)', { icon: '💾' });
                return;
            }
            return customersAPI.delete(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QK });
            toast.success('Cliente removido com sucesso!');
        },
        onError: (err) => logger.error('Error deleting customer:', err),
    });

    return {
        customers: query.data?.customers ?? [],
        pagination: query.data?.pagination ?? null,
        isLoading: query.isLoading || query.isFetching,
        isPlaceholderData: query.isPlaceholderData,
        error: query.error ? 'Erro ao carregar clientes' : null,
        refetch: query.refetch,
        addCustomer: addMutation.mutateAsync,
        updateCustomer: (id: string, data: any) => updateMutation.mutateAsync({ id, data }),
        deleteCustomer: deleteMutation.mutateAsync,
    };
}
