import { useState, useEffect, useCallback } from 'react';
import { pharmacyAPI } from '../services/api';

interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
}

interface UsePharmacySalesParams {
    startDate?: string;
    endDate?: string;
    status?: string;
    customerId?: string;
    page?: number;
    limit?: number;
}

export function usePharmacySales(params?: UsePharmacySalesParams) {
    const [sales, setSales] = useState<any[]>([]);
    const [pagination, setPagination] = useState<PaginationMeta | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSales = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await pharmacyAPI.getSales(params);

            if (response.data && response.pagination) {
                setSales(response.data);
                setPagination(response.pagination);
            } else {
                const data = Array.isArray(response) ? response : (response.data || []);
                setSales(data);
                setPagination({
                    page: params?.page || 1,
                    limit: params?.limit || data.length,
                    total: data.length,
                    totalPages: 1,
                    hasMore: false
                });
            }
        } catch (err: unknown) {
            setError(err.message || 'Erro ao carregar vendas');
            console.error('Error fetching pharmacy sales:', err);
        } finally {
            setIsLoading(false);
        }
    }, [
        params?.startDate,
        params?.endDate,
        params?.status,
        params?.customerId,
        params?.page,
        params?.limit
    ]);

    useEffect(() => {
        fetchSales();
    }, [fetchSales]);

    return {
        sales,
        pagination,
        isLoading,
        error,
        refetch: fetchSales
    };
}
