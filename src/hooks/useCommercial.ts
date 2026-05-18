import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { commercialAPI } from '../services/api/commercial.api';
import type {
    CommercialAnalytics,
    MarginAnalysis,
    StockAgingReport,
    SupplierPerformance,
    InventoryTurnoverItem,
    SalesReport,
    PurchaseOrder,
    AccountsReceivableResult,
    WarehouseDistribution,
    SupplierInvoice,
    SupplierInvoicesListParams,
    CreateSupplierInvoicePayload,
    AddSupplierInvoicePaymentPayload,
    Quotation,
} from '../services/api/commercial.api';
import { logger } from '../utils/logger';

// ── Commercial Analytics Hook ────────────────────────────────────────────────

export function useCommercialAnalytics(warehouseId?: string) {
    const query = useQuery<CommercialAnalytics>({
        queryKey: ['commercial', 'analytics', warehouseId ?? 'all'],
        queryFn: () => commercialAPI.getAnalytics(warehouseId),
        staleTime: 60_000,
    });

    return {
        data: query.data ?? null,
        isLoading: query.isLoading,
        error: query.error ? 'Erro ao carregar analytics comercial' : null,
        refetch: query.refetch,
    };
}

// ── Margin Analysis Hook ─────────────────────────────────────────────────────

export function useMarginAnalysis(period: number = 30, warehouseId?: string) {
    const [data, setData] = useState<MarginAnalysis | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            setData(await commercialAPI.getMargins(period, warehouseId));
        } catch (err) {
            logger.error('Error fetching margin analysis:', err);
            setError('Erro ao carregar análise de margens');
        } finally {
            setIsLoading(false);
        }
    }, [period, warehouseId]);

    useEffect(() => { fetch(); }, [fetch]);

    return { data, isLoading, error, refetch: fetch };
}

// ── Stock Aging Hook ─────────────────────────────────────────────────────────

export function useStockAging(warehouseId?: string) {
    const [data, setData] = useState<StockAgingReport | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            setData(await commercialAPI.getStockAging(warehouseId));
        } catch (err) {
            logger.error('Error fetching stock aging:', err);
            setError('Erro ao carregar envelhecimento de stock');
        } finally {
            setIsLoading(false);
        }
    }, [warehouseId]);

    useEffect(() => { fetch(); }, [fetch]);

    return { data, isLoading, error, refetch: fetch };
}

// ── Supplier Performance Hook ────────────────────────────────────────────────

export function useSupplierPerformance() {
    const [data, setData] = useState<SupplierPerformance[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            setData(await commercialAPI.getSupplierPerformance());
        } catch (err) {
            logger.error('Error fetching supplier performance:', err);
            setError('Erro ao carregar performance de fornecedores');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetch(); }, [fetch]);

    return { data, isLoading, error, refetch: fetch };
}

// ── Inventory Turnover Hook ──────────────────────────────────────────────────

export function useInventoryTurnover(period: number = 90, warehouseId?: string) {
    const [data, setData] = useState<InventoryTurnoverItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            setData(await commercialAPI.getInventoryTurnover(period, warehouseId));
        } catch (err) {
            logger.error('Error fetching inventory turnover:', err);
            setError('Erro ao carregar rotação de inventário');
        } finally {
            setIsLoading(false);
        }
    }, [period, warehouseId]);

    useEffect(() => { fetch(); }, [fetch]);

    return { data, isLoading, error, refetch: fetch };
}

// ── Sales Report Hook ────────────────────────────────────────────────────────

export function useSalesReport(period: number = 30, warehouseId?: string) {
    const [data, setData] = useState<SalesReport | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            setData(await commercialAPI.getSalesReport(period, warehouseId));
        } catch (err) {
            logger.error('Error fetching sales report:', err);
            setError('Erro ao carregar relatório de vendas');
        } finally {
            setIsLoading(false);
        }
    }, [period, warehouseId]);

    useEffect(() => { fetch(); }, [fetch]);

    return { data, isLoading, error, refetch: fetch };
}

// ── Purchase Orders Hook ─────────────────────────────────────────────────────

interface UsePurchaseOrdersParams {
    status?: string;
    supplierId?: string;
    search?: string;
    page?: number;
    limit?: number;
}

export function usePurchaseOrders(params?: UsePurchaseOrdersParams) {
    const { status, supplierId, search, page, limit } = params ?? {};
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [pagination, setPagination] = useState<{ page: number; limit: number; total: number; totalPages: number } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await commercialAPI.listPurchaseOrders({ status, supplierId, search, page, limit });
            setOrders(res.data);
            setPagination(res.pagination);
        } catch (err) {
            logger.error('Error fetching purchase orders:', err);
            setError('Erro ao carregar ordens de compra');
        } finally {
            setIsLoading(false);
        }
    }, [status, supplierId, search, page, limit]);

    useEffect(() => { fetch(); }, [fetch]);

    const updateStatus = async (id: string, status: string, options?: { warehouseId?: string; approvalId?: string }) => {
        try {
            const updated = await commercialAPI.updatePurchaseOrderStatus(id, status, options);
            setOrders(prev => prev.map(o => o.id === id ? updated : o));
            toast.success('Estado actualizado com sucesso!');
            return updated;
        } catch (err) {
            logger.error('Error updating PO status:', err);
            throw err;
        }
    };

    const deletePO = async (id: string) => {
        try {
            await commercialAPI.deletePurchaseOrder(id);
            setOrders(prev => prev.filter(o => o.id !== id));
            toast.success('Ordem de compra eliminada!');
        } catch (err) {
            logger.error('Error deleting PO:', err);
            throw err;
        }
    };

    return { orders, pagination, isLoading, error, refetch: fetch, updateStatus, deletePO };
}

// ── Supplier Invoices Hook ───────────────────────────────────────────────────

export function useSupplierInvoices(params?: SupplierInvoicesListParams) {
    const { purchaseOrderId, supplierId, status, period, page, limit } = params ?? {};
    const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
    const [pagination, setPagination] = useState<{ page: number; limit: number; total: number; totalPages: number } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await commercialAPI.listSupplierInvoices({ purchaseOrderId, supplierId, status, period, page, limit });
            setInvoices(res.data);
            setPagination(res.pagination);
        } catch (err) {
            logger.error('Error fetching supplier invoices:', err);
            setError('Erro ao carregar facturas de fornecedor');
        } finally {
            setIsLoading(false);
        }
    }, [purchaseOrderId, supplierId, status, period, page, limit]);

    useEffect(() => { fetch(); }, [fetch]);

    const create = async (purchaseOrderId: string, payload: CreateSupplierInvoicePayload) => {
        const created = await commercialAPI.createSupplierInvoice(purchaseOrderId, payload);
        setInvoices(prev => [created, ...prev]);
        toast.success('Factura de fornecedor registada!');
        return created;
    };

    const updateStatus = async (id: string, status: 'paid' | 'cancelled') => {
        const updated = await commercialAPI.updateSupplierInvoiceStatus(id, status);
        setInvoices(prev => prev.map(i => i.id === id ? updated : i));
        toast.success(status === 'paid' ? 'Factura marcada como paga' : 'Factura cancelada');
        return updated;
    };

    const addPayment = async (id: string, payload: AddSupplierInvoicePaymentPayload) => {
        const updated = await commercialAPI.addSupplierInvoicePayment(id, payload);
        setInvoices(prev => prev.map(i => i.id === id ? updated : i));
        toast.success(updated.status === 'paid' ? 'Factura totalmente paga!' : 'Pagamento registado');
        return updated;
    };

    const deletePayment = async (id: string, paymentId: string) => {
        const updated = await commercialAPI.deleteSupplierInvoicePayment(id, paymentId);
        setInvoices(prev => prev.map(i => i.id === id ? updated : i));
        toast.success('Pagamento removido');
        return updated;
    };

    return { invoices, pagination, isLoading, error, refetch: fetch, create, updateStatus, addPayment, deletePayment };
}

// ── Quotations Hook ──────────────────────────────────────────────────────────

interface UseQuotationsParams {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
}

export function useQuotations(params?: UseQuotationsParams) {
    const { status, search, page, limit } = params ?? {};
    const [quotes, setQuotes] = useState<Quotation[]>([]);
    const [pagination, setPagination] = useState<{ page: number; limit: number; total: number; totalPages: number } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await commercialAPI.listQuotations({ status, search, page, limit });
            if (res?.data && res?.pagination) {
                setQuotes(res.data);
                setPagination(res.pagination);
            } else {
                setQuotes(Array.isArray(res) ? res : []);
            }
        } catch (err) {
            logger.error('Error fetching quotations:', err);
            setError('Erro ao carregar Cotações');
        } finally {
            setIsLoading(false);
        }
    }, [status, search, page, limit]);

    useEffect(() => { fetch(); }, [fetch]);

    return { quotes, pagination, isLoading, error, refetch: fetch };
}

// ── Accounts Receivable Hook ─────────────────────────────────────────────────

interface UseAccountsReceivableParams {
    filter?: 'all' | 'overdue' | 'pending';
    search?: string;
    page?: number;
    limit?: number;
}

export function useAccountsReceivable(params?: UseAccountsReceivableParams) {
    const { filter, search, page, limit } = params ?? {};
    const [data, setData]     = useState<AccountsReceivableResult | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError]   = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            setData(await commercialAPI.getAccountsReceivable({ filter, search, page, limit }));
        } catch (err) {
            logger.error('Error fetching accounts receivable:', err);
            setError('Erro ao carregar contas a receber');
        } finally {
            setIsLoading(false);
        }
    }, [filter, search, page, limit]);

    useEffect(() => { fetch(); }, [fetch]);

    return { data, isLoading, error, refetch: fetch };
}

// ── Warehouse Distribution Hook ───────────────────────────────────────────

export function useWarehouseDistribution() {
    const [data, setData] = useState<WarehouseDistribution[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            setData(await commercialAPI.getWarehouseDistribution());
        } catch (err) {
            logger.error('Error fetching warehouse distribution:', err);
            setError('Erro ao carregar distribuição por armazém');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetch(); }, [fetch]);

    return { data, isLoading, error, refetch: fetch };
}
