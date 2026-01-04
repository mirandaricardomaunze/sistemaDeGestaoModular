import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { invoicesAPI } from '../services/api';
import type { Invoice } from '../types';

interface UseInvoicesParams {
    status?: string;
    customerId?: string;
    startDate?: string;
    endDate?: string;
}

export function useInvoices(params?: UseInvoicesParams) {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchInvoices = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await invoicesAPI.getAll(params);
            setInvoices(result);
        } catch (err) {
            setError('Erro ao carregar facturas');
            console.error('Error fetching invoices:', err);
        } finally {
            setIsLoading(false);
        }
    }, [params?.status, params?.customerId, params?.startDate, params?.endDate]);

    useEffect(() => {
        fetchInvoices();
    }, [fetchInvoices]);

    const createInvoice = async (data: Parameters<typeof invoicesAPI.create>[0]) => {
        try {
            const newInvoice = await invoicesAPI.create(data);
            setInvoices((prev) => [newInvoice, ...prev]);
            toast.success('Factura criada com sucesso!');
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
        isLoading,
        error,
        refetch: fetchInvoices,
        createInvoice,
        updateInvoice,
        addPayment,
        cancelInvoice,
    };
}
