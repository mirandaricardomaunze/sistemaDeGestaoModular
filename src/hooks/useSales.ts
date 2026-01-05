import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { salesAPI } from '../services/api';
import { db } from '../db/offlineDB';
import type { Sale } from '../types';

interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
}

interface UseSalesParams {
    startDate?: string;
    endDate?: string;
    customerId?: string;
    paymentMethod?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export function useSales(params?: UseSalesParams) {
    const [sales, setSales] = useState<Sale[]>([]);
    const [pagination, setPagination] = useState<PaginationMeta | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSales = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await salesAPI.getAll(params);

            let salesData: Sale[] = [];
            if (response.data && response.pagination) {
                salesData = response.data;
                setPagination(response.pagination);
            } else {
                salesData = Array.isArray(response) ? response : (response.data || []);
                setPagination({
                    page: params?.page || 1,
                    limit: params?.limit || salesData.length,
                    total: salesData.length,
                    totalPages: 1,
                    hasMore: false
                });
            }

            setSales(salesData);
        } catch (err) {
            setError('Erro ao carregar vendas');
            console.error('Error fetching sales:', err);
        } finally {
            setIsLoading(false);
        }
    }, [
        params?.startDate,
        params?.endDate,
        params?.customerId,
        params?.paymentMethod,
        params?.search,
        params?.page,
        params?.limit,
        params?.sortBy,
        params?.sortOrder
    ]);

    useEffect(() => {
        fetchSales();
    }, [fetchSales]);

    const createSale = async (data: Parameters<typeof salesAPI.create>[0]) => {
        try {
            if (!navigator.onLine) {
                const pendingSaleId = await db.pendingSales.add({
                    data,
                    timestamp: Date.now(),
                    synced: false as any
                });

                const mockSale: any = {
                    ...data,
                    id: `offline-${pendingSaleId}`,
                    createdAt: new Date().toISOString(),
                    receiptNumber: `OFFLINE-${pendingSaleId}`,
                    items: data.items
                };

                setSales((prev) => [mockSale, ...prev]);
                toast('Venda guardada localmente (Sem Internet)', { icon: '📴' });
                return mockSale;
            }

            const newSale = await salesAPI.create(data);
            setSales((prev) => [newSale, ...prev]);
            toast.success('Venda realizada com sucesso!');
            return newSale;
        } catch (err) {
            console.error('Error creating sale:', err);
            throw err;
        }
    };

    return {
        sales,
        pagination,
        isLoading,
        error,
        refetch: fetchSales,
        createSale,
    };
}
