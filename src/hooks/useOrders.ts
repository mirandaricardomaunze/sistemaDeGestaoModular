import { logger } from '../utils/logger';
import toast from 'react-hot-toast';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ordersAPI } from '../services/api';

interface CustomerOrderItem {
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    total: number;
}

interface OrderTransition {
    id: string;
    status: string;
    responsibleName?: string;
    notes?: string;
    timestamp: string;
}

export interface CustomerOrder {
    id: string;
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    customerAddress?: string;
    total: number;
    status: 'created' | 'printed' | 'separated' | 'completed' | 'cancelled';
    priority: 'low' | 'normal' | 'high' | 'urgent';
    paymentMethod?: string;
    deliveryDate?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
    items: CustomerOrderItem[];
    transitions: OrderTransition[];
}

interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
}

interface UseOrdersParams {
    status?: string;
    priority?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    originModule?: string;
    fields?: string;
}

const QK = ['orders'] as const;

export function useOrders(params?: UseOrdersParams) {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: [...QK, params ?? {}],
        queryFn: async () => {
            const response = await ordersAPI.getAll(params as any);
            let ordersData: CustomerOrder[];
            let pagination: PaginationMeta;
            if (response?.data && response?.pagination) {
                ordersData = response.data;
                pagination = {
                    ...response.pagination,
                    hasMore: response.pagination.hasMore ?? response.pagination.hasNext ?? false,
                };
            } else {
                ordersData = (response && response.data && Array.isArray(response.data))
                    ? response.data
                    : (Array.isArray(response) ? response : []);
                pagination = {
                    page: params?.page || 1,
                    limit: params?.limit || ordersData.length,
                    total: ordersData.length,
                    totalPages: 1,
                    hasMore: false,
                };
            }
            return { orders: ordersData, pagination };
        },
        placeholderData: keepPreviousData,
    });

    const addMutation = useMutation({
        mutationFn: (data: Parameters<typeof ordersAPI.create>[0]) => ordersAPI.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QK });
            toast.success('Encomenda criada com sucesso!');
        },
        onError: (err) => logger.error('Error creating order:', err),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Parameters<typeof ordersAPI.update>[1] }) =>
            ordersAPI.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QK });
            toast.success('Encomenda actualizada com sucesso!');
        },
        onError: (err) => logger.error('Error updating order:', err),
    });

    const statusMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Parameters<typeof ordersAPI.updateStatus>[1] }) =>
            ordersAPI.updateStatus(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QK });
            toast.success('Status actualizado com sucesso!');
        },
        onError: (err) => logger.error('Error updating order status:', err),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => ordersAPI.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QK });
            toast.success('Encomenda eliminada com sucesso!');
        },
        onError: (err) => logger.error('Error deleting order:', err),
    });

    return {
        orders: query.data?.orders ?? [],
        pagination: query.data?.pagination ?? null,
        isLoading: query.isLoading || query.isFetching,
        isPlaceholderData: query.isPlaceholderData,
        error: query.error ? 'Erro ao carregar encomendas' : null,
        refetch: query.refetch,
        addOrder: addMutation.mutateAsync,
        updateOrder: (id: string, data: any) => updateMutation.mutateAsync({ id, data }),
        updateOrderStatus: (id: string, data: any) => statusMutation.mutateAsync({ id, data }),
        deleteOrder: deleteMutation.mutateAsync,
    };
}
