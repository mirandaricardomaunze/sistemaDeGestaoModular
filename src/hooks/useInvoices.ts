import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
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
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export function useInvoices(params?: UseInvoicesParams) {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [pagination, setPagination] = useState<PaginationMeta | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [availableSources, setAvailableSources] = useState<any[]>([]);
    const { calculateInvoiceIVA } = useInvoiceTaxes();

    const fetchAvailableSources = useCallback(async () => {
        try {
            const sources = await invoicesAPI.getAvailableSources();
            setAvailableSources(sources);
        } catch (err) {
            console.error('Error fetching available sources:', err);
        }
    }, []);

    const fetchInvoices = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await invoicesAPI.getAll(params);

            let invoicesData: Invoice[] = [];
            if (response.data && response.pagination) {
                invoicesData = response.data;
                setPagination(response.pagination);
            } else {
                invoicesData = Array.isArray(response) ? response : (response.data || []);
                setPagination({
                    page: params?.page || 1,
                    limit: params?.limit || invoicesData.length,
                    total: invoicesData.length,
                    totalPages: 1,
                    hasMore: false
                });
            }

            setInvoices(invoicesData);
        } catch (err) {
            setError('Erro ao carregar facturas');
            console.error('Error fetching invoices:', err);
        } finally {
            setIsLoading(false);
        }
    }, [
        params?.status,
        params?.customerId,
        params?.search,
        params?.startDate,
        params?.endDate,
        params?.page,
        params?.limit,
        params?.sortBy,
        params?.sortOrder
    ]);

    useEffect(() => {
        fetchInvoices();
    }, [fetchInvoices]);

    const createInvoice = async (data: Parameters<typeof invoicesAPI.create>[0]) => {
        try {
            const newInvoice = await invoicesAPI.create(data);

            // 📊 Auto-register IVA in Fiscal module
            calculateInvoiceIVA(
                newInvoice.total - (newInvoice.tax || 0), // Base amount (approx)
                newInvoice.customerId || 'anonymous',
                newInvoice.customerName,
                newInvoice.customerDocument || '',
                newInvoice.invoiceNumber,
                newInvoice.issueDate || new Date().toISOString().split('T')[0],
                getCurrentFiscalPeriod(),
                true // createRetention
            );

            setInvoices((prev) => [newInvoice, ...prev]);
            toast.success('Factura criada e IVA registado na Gestão Fiscal!');
            return newInvoice;
        } catch (err) {
            console.error('Error creating invoice:', err);
            throw err;
        }
    };

    const updateInvoice = async (id: string, data: Parameters<typeof invoicesAPI.update>[1]) => {
        try {
            const updated = await invoicesAPI.update(id, data);
            setInvoices((prev) => prev.map((i) => (i.id === id ? updated : i)));
            toast.success('Factura actualizada com sucesso!');
            return updated;
        } catch (err) {
            console.error('Error updating invoice:', err);
            throw err;
        }
    };

    const addPayment = async (
        invoiceId: string,
        data: Parameters<typeof invoicesAPI.addPayment>[1]
    ) => {
        try {
            const updated = await invoicesAPI.addPayment(invoiceId, data);
            setInvoices((prev) => prev.map((i) => (i.id === invoiceId ? updated : i)));
            toast.success('Pagamento registado com sucesso!');
            return updated;
        } catch (err) {
            console.error('Error adding payment:', err);
            throw err;
        }
    };

    const cancelInvoice = async (id: string) => {
        try {
            const updated = await invoicesAPI.cancel(id);
            setInvoices((prev) => prev.map((i) => (i.id === id ? updated : i)));
            toast.success('Factura cancelada com sucesso!');
            return updated;
        } catch (err) {
            console.error('Error canceling invoice:', err);
            throw err;
        }
    };

    return {
        invoices,
        pagination,
        isLoading,
        error,
        availableSources,
        refetch: fetchInvoices,
        fetchAvailableSources,
        createInvoice,
        updateInvoice,
        addPayment,
        cancelInvoice,
    };
}
