import { logger } from '../utils/logger';
import { useState, useEffect, useCallback } from 'react';
import { pharmacyAPI, salesAPI } from '../services/api';
import type { PharmacySale } from '../types/pharmacy';
import type { PharmacySalesParams } from '../services/api/pharmacy.api';

interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
}

export function usePharmacySales(params?: PharmacySalesParams) {
    const [sales, setSales] = useState<PharmacySale[]>([]);
    const [pagination, setPagination] = useState<PaginationMeta | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSales = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await pharmacyAPI.getSales({
                startDate: params?.startDate,
                endDate: params?.endDate,
                status: params?.status,
                customerId: params?.customerId,
                search: params?.search,
                page: params?.page,
                limit: params?.limit,
            });

            if (response.data && response.pagination) {
                setSales(response.data);
                setPagination({
                    ...response.pagination,
                    hasMore: response.pagination.page < response.pagination.totalPages,
                });
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
        } catch (err) {
            const message = (err as Error).message || 'Erro ao carregar vendas';
            setError(message);
            logger.error('Error fetching pharmacy sales:', err);
        } finally {
            setIsLoading(false);
        }
    }, [
        params?.startDate,
        params?.endDate,
        params?.status,
        params?.customerId,
        params?.search,
        params?.page,
        params?.limit
    ]);

    useEffect(() => {
        fetchSales();
    }, [fetchSales]);

    const voidSale = async (id: string, reason: string) => {
        await salesAPI.voidSale(id, reason);
        setSales(prev => prev.map(s => s.id === id ? { ...s, status: 'voided' } : s));
    };

    return {
        sales,
        pagination,
        isLoading,
        error,
        refetch: fetchSales,
        voidSale,
    };
}
