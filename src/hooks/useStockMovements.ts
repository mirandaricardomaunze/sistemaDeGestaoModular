import { useState, useEffect, useCallback } from 'react';
import { productsAPI } from '../services/api';
import type { StockMovement } from '../types';

interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
}

export function useStockMovements(productId: string | null, params?: { page?: number; limit?: number }) {
    const [movements, setMovements] = useState<StockMovement[]>([]);
    const [pagination, setPagination] = useState<PaginationMeta | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchMovements = useCallback(async () => {
        if (!productId) return;

        setIsLoading(true);
        setError(null);
        try {
            const response = await productsAPI.getMovements(productId, params);
            if (response.data && response.pagination) {
                setMovements(response.data);
                setPagination(response.pagination);
            } else {
                setMovements(Array.isArray(response) ? response : []);
            }
        } catch (err) {
            setError('Erro ao carregar histórico de stock');
            console.error('Error fetching movements:', err);
        } finally {
            setIsLoading(false);
        }
    }, [productId, params?.page, params?.limit]);

    useEffect(() => {
        if (productId) {
            fetchMovements();
        }
    }, [fetchMovements]);

    return {
        movements,
        pagination,
        isLoading,
        error,
        refetch: fetchMovements,
    };
}
