import { logger } from '../utils/logger';
import { useCallback } from 'react';
import toast from 'react-hot-toast';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoicesAPI } from '../services/api';
import { useInvoiceTaxes, getCurrentFiscalPeriod } from '../utils/fiscalIntegration';
import type { Invoice } from '../types';

interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
}

interface UseInvoicesParams {
    status?: string;
    customerId?: string;
    search?: string;
    warehouseId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    originModule?: string;
    fields?: string;
}

const QK = ['invoices'] as const;
const SOURCES_QK = ['invoices', 'available-sources'] as const;

export function useInvoices(params?: UseInvoicesParams) {
    const queryClient = useQueryClient();
    const { calculateInvoiceIVA } = useInvoiceTaxes();

    const query = useQuery({
        queryKey: [...QK, params ?? {}],
        queryFn: async () => {
            const response = await invoicesAPI.getAll(params);
            let invoicesData: Invoice[];
            let pagination: PaginationMeta;
            let summary: { total: number; paid: number; pending: number; overdue: number } | null = null;
            if (response?.data && response?.pagination) {
                invoicesData = response.data;
                pagination = {
                    ...response.pagination,
                    hasMore: response.pagination.hasMore ?? response.pagination.hasNext ?? false,
                };
                if (response.summary) summary = response.summary;
            } else {
                invoicesData = Array.isArray(response) ? response : (response.data || []);
                pagination = {
                    page: params?.page || 1,
                    limit: params?.limit || invoicesData.length,
                    total: invoicesData.length,
                    totalPages: 1,
                    hasMore: false,
                };
            }
            return { invoices: invoicesData, pagination, summary };
        },
        placeholderData: keepPreviousData,
    });

    const sourcesQuery = useQuery({
        queryKey: SOURCES_QK,
        queryFn: () => invoicesAPI.getAvailableSources(),
        enabled: false, // user calls fetchAvailableSources to opt in
    });

    const createMutation = useMutation({
        mutationFn: async (data: Parameters<typeof invoicesAPI.create>[0]) => {
            const newInvoice = await invoicesAPI.create(data);
            calculateInvoiceIVA(
                newInvoice.total - (newInvoice.tax || 0),
                newInvoice.customerId || 'anonymous',
                newInvoice.customerName,
                newInvoice.customerDocument || '',
                newInvoice.invoiceNumber,
                newInvoice.issueDate || new Date().toISOString().split('T')[0],
                getCurrentFiscalPeriod(),
                true,
            );
            return newInvoice;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QK });
            toast.success('Factura criada e IVA registado na Gestão Fiscal!');
        },
        onError: (err) => logger.error('Error creating invoice:', err),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Parameters<typeof invoicesAPI.update>[1] }) =>
            invoicesAPI.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QK });
            toast.success('Factura actualizada com sucesso!');
        },
        onError: (err) => logger.error('Error updating invoice:', err),
    });

    const paymentMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Parameters<typeof invoicesAPI.addPayment>[1] }) =>
            invoicesAPI.addPayment(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QK });
            toast.success('Pagamento registado com sucesso!');
        },
        onError: (err) => logger.error('Error adding payment:', err),
    });

    const cancelMutation = useMutation({
        mutationFn: (id: string) => invoicesAPI.cancel(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QK });
            toast.success('Factura cancelada com sucesso!');
        },
        onError: (err) => logger.error('Error canceling invoice:', err),
    });

    const getInvoiceById = useCallback(async (id: string) => {
        try {
            return await invoicesAPI.getById(id);
        } catch (err) {
            logger.error('Error fetching invoice details:', err);
            toast.error('Erro ao carregar detalhes da factura');
            return null;
        }
    }, []);

    return {
        invoices: query.data?.invoices ?? [],
        pagination: query.data?.pagination ?? null,
        summary: query.data?.summary ?? null,
        isLoading: query.isLoading || query.isFetching,
        isPlaceholderData: query.isPlaceholderData,
        error: query.error ? 'Erro ao carregar facturas' : null,
        availableSources: sourcesQuery.data ?? [],
        refetch: query.refetch,
        fetchAvailableSources: () => sourcesQuery.refetch(),
        createInvoice: createMutation.mutateAsync,
        updateInvoice: (id: string, data: Parameters<typeof invoicesAPI.update>[1]) => updateMutation.mutateAsync({ id, data }),
        addPayment: (invoiceId: string, data: Parameters<typeof invoicesAPI.addPayment>[1]) => paymentMutation.mutateAsync({ id: invoiceId, data }),
        cancelInvoice: cancelMutation.mutateAsync,
        getInvoiceById,
    };
}
