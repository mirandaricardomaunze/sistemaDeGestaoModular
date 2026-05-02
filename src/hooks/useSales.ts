import { logger } from '../utils/logger';
import toast from 'react-hot-toast';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { salesAPI } from '../services/api';
import { useInvoiceTaxes, getCurrentFiscalPeriod } from '../utils/fiscalIntegration';
import { db, cryptoRandomId } from '../db/offlineDB';
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
    fields?: string;
}

const QK = ['sales'] as const;

export function useSales(params?: UseSalesParams) {
    const queryClient = useQueryClient();
    const { calculateInvoiceIVA } = useInvoiceTaxes();

    const query = useQuery({
        queryKey: [...QK, params ?? {}],
        queryFn: async () => {
            const response = await salesAPI.getAll(params as any);

            let salesData: Sale[];
            let pagination: PaginationMeta;
            if (response?.data && response?.pagination) {
                salesData = response.data;
                pagination = {
                    ...response.pagination,
                    hasMore: response.pagination.hasMore ?? response.pagination.hasNext ?? false,
                };
            } else {
                salesData = Array.isArray(response) ? response : (response.data || []);
                pagination = {
                    page: params?.page || 1,
                    limit: params?.limit || salesData.length,
                    total: salesData.length,
                    totalPages: 1,
                    hasMore: false,
                };
            }

            return { sales: salesData, pagination };
        },
        placeholderData: keepPreviousData,
    });

    const createMutation = useMutation({
        mutationFn: async (data: Parameters<typeof salesAPI.create>[0]) => {
            if (!navigator.onLine) {
                const pendingId = await db.pendingSales.add({
                    clientId: cryptoRandomId(),
                    data,
                    timestamp: Date.now(),
                    status: 'pending',
                    synced: false,
                    attempts: 0,
                    nextRetryAt: Date.now(),
                });
                const mockSale: any = {
                    ...data,
                    id: `offline-${pendingId}`,
                    createdAt: new Date().toISOString(),
                    receiptNumber: `OFFLINE-${pendingId}`,
                    items: data.items,
                };
                calculateInvoiceIVA(
                    mockSale.subtotal,
                    mockSale.customerId || 'anonymous',
                    mockSale.customer?.name || 'Consumidor Final',
                    mockSale.customer?.document || '',
                    mockSale.receiptNumber,
                    mockSale.createdAt.split('T')[0],
                    getCurrentFiscalPeriod(),
                    true,
                );
                toast('Venda guardada e IVA registado (Offline)', { icon: '💾' });
                return mockSale;
            }
            const newSale = await salesAPI.create(data);
            calculateInvoiceIVA(
                newSale.subtotal,
                newSale.customerId || 'anonymous',
                newSale.customer?.name || 'Consumidor Final',
                newSale.customer?.document || '',
                newSale.receiptNumber || `SALE-${newSale.id.slice(-6)}`,
                newSale.createdAt ? newSale.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
                getCurrentFiscalPeriod(),
                true,
            );
            return newSale;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QK });
            toast.success('Venda realizada e IVA registado na Gestão Fiscal!');
        },
        onError: (err) => logger.error('Error creating sale:', err),
    });

    const requestVoidMutation = useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) => salesAPI.requestVoid(id, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QK });
            queryClient.invalidateQueries({ queryKey: ['sales', 'pending-voids'] });
            toast.success('Pedido de anulação enviado. Aguarda aprovação de um gestor.');
        },
        onError: (err: any) => {
            logger.error('Error requesting void:', err);
            toast.error(err?.response?.data?.message || 'Erro ao solicitar anulação');
        },
    });

    const approveVoidMutation = useMutation({
        mutationFn: (id: string) => salesAPI.approveVoid(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QK });
            queryClient.invalidateQueries({ queryKey: ['sales', 'pending-voids'] });
            toast.success('Anulação aprovada. Stock revertido.');
        },
        onError: (err: any) => {
            logger.error('Error approving void:', err);
            toast.error(err?.response?.data?.message || 'Erro ao aprovar anulação');
        },
    });

    const rejectVoidMutation = useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) => salesAPI.rejectVoid(id, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QK });
            queryClient.invalidateQueries({ queryKey: ['sales', 'pending-voids'] });
            toast.success('Pedido de anulação rejeitado.');
        },
        onError: (err: any) => {
            logger.error('Error rejecting void:', err);
            toast.error(err?.response?.data?.message || 'Erro ao rejeitar anulação');
        },
    });

    return {
        sales: query.data?.sales ?? [],
        pagination: query.data?.pagination ?? null,
        isLoading: query.isLoading || query.isFetching,
        isPlaceholderData: query.isPlaceholderData,
        error: query.error ? 'Erro ao carregar vendas' : null,
        refetch: query.refetch,
        createSale: createMutation.mutateAsync,
        // New two-step API
        requestVoid: (id: string, reason: string) => requestVoidMutation.mutateAsync({ id, reason }),
        approveVoid: (id: string) => approveVoidMutation.mutateAsync(id),
        rejectVoid: (id: string, reason: string) => rejectVoidMutation.mutateAsync({ id, reason }),
        // Legacy alias -- now triggers a void *request* (step 1), not an immediate void.
        voidSale: (id: string, reason: string) => requestVoidMutation.mutateAsync({ id, reason }),
    };
}

export function usePendingVoids() {
    return useQuery({
        queryKey: ['sales', 'pending-voids'] as const,
        queryFn: async () => {
            const response = await salesAPI.listPendingVoids();
            const data = response?.data ?? response;
            return Array.isArray(data) ? data : [];
        },
        refetchInterval: 30000,
    });
}
