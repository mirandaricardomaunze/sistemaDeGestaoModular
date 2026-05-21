import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { productsAPI } from '../services/api';
import type { StockMovement } from '../types';

interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
}

export function useStockMovements(
    productId: string | null,
    params?: { page?: number; limit?: number; fields?: string }
) {
    const query = useQuery({
        queryKey: ['stock-movements', productId, params ?? {}],
        queryFn: async () => {
            const response = await productsAPI.getMovements(productId!, params);
            let movements: StockMovement[];
            let pagination: PaginationMeta | null = null;
            if (response?.data && response?.pagination) {
                movements = response.data;
                pagination = {
                    ...response.pagination,
                    hasMore: response.pagination.hasMore ?? response.pagination.hasNext ?? false,
                };
            } else {
                movements = Array.isArray(response) ? response : [];
            }
            return { movements, pagination };
        },
        enabled: !!productId,
        placeholderData: keepPreviousData,
    });

    return {
        movements: query.data?.movements ?? [],
        pagination: query.data?.pagination ?? null,
        isLoading: query.isLoading || query.isFetching,
        isPlaceholderData: query.isPlaceholderData,
        error: query.error ? 'Erro ao carregar histórico de stock' : null,
        refetch: query.refetch,
    };
}
