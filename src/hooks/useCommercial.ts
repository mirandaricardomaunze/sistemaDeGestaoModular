import { useState, useEffect, useCallback } from 'react';
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
} from '../services/api/commercial.api';
import { logger } from '../utils/logger';

// ── Commercial Analytics Hook ────────────────────────────────────────────────

export function useCommercialAnalytics() {
    const [data, setData] = useState<CommercialAnalytics | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            setData(await commercialAPI.getAnalytics());
        } catch (err) {
            logger.error('Error fetching commercial analytics:', err);
            setError('Erro ao carregar analytics comercial');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetch(); }, [fetch]);

    return { data, isLoading, error, refetch: fetch };
}

// ── Margin Analysis Hook ─────────────────────────────────────────────────────

export function useMarginAnalysis(period: number = 30) {
    const [data, setData] = useState<MarginAnalysis | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            setData(await commercialAPI.getMargins(period));
        } catch (err) {
            logger.error('Error fetching margin analysis:', err);
            setError('Erro ao carregar análise de margens');
        } finally {
            setIsLoading(false);
        }
    }, [period]);

    useEffect(() => { fetch(); }, [fetch]);

    return { data, isLoading, error, refetch: fetch };
}

// ── Stock Aging Hook ─────────────────────────────────────────────────────────

export function useStockAging() {
    const [data, setData] = useState<StockAgingReport | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            setData(await commercialAPI.getStockAging());
        } catch (err) {
            logger.error('Error fetching stock aging:', err);
            setError('Erro ao carregar envelhecimento de stock');
        } finally {
            setIsLoading(false);
        }
    }, []);

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

export function useInventoryTurnover(period: number = 90) {
    const [data, setData] = useState<InventoryTurnoverItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            setData(await commercialAPI.getInventoryTurnover(period));
        } catch (err) {
            logger.error('Error fetching inventory turnover:', err);
            setError('Erro ao carregar rotação de inventário');
        } finally {
            setIsLoading(false);
        }
    }, [period]);

    useEffect(() => { fetch(); }, [fetch]);

    return { data, isLoading, error, refetch: fetch };
}

// ── Sales Report Hook ────────────────────────────────────────────────────────

export function useSalesReport(period: number = 30) {
    const [data, setData] = useState<SalesReport | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            setData(await commercialAPI.getSalesReport(period));
        } catch (err) {
            logger.error('Error fetching sales report:', err);
            setError('Erro ao carregar relatório de vendas');
        } finally {
            setIsLoading(false);
        }
    }, [period]);

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
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [pagination, setPagination] = useState<{ page: number; limit: number; total: number; totalPages: number } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await commercialAPI.listPurchaseOrders(params);
            if (res.data && res.pagination) {
                setOrders(res.data);
                setPagination(res.pagination);
            } else {
                setOrders(Array.isArray(res) ? res : []);
            }
        } catch (err) {
            logger.error('Error fetching purchase orders:', err);
            setError('Erro ao carregar ordens de compra');
        } finally {
            setIsLoading(false);
        }
    }, [params?.status, params?.supplierId, params?.search, params?.page, params?.limit]);

    useEffect(() => { fetch(); }, [fetch]);

    const updateStatus = async (id: string, status: string) => {
        try {
            const updated = await commercialAPI.updatePurchaseOrderStatus(id, status);
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

// ── Quotations Hook ──────────────────────────────────────────────────────────

interface UseQuotationsParams {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
}

export function useQuotations(params?: UseQuotationsParams) {
    const [quotes, setQuotes] = useState<any[]>([]);
    const [pagination, setPagination] = useState<{ page: number; limit: number; total: number; totalPages: number } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await commercialAPI.listQuotations(params);
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
    }, [params?.status, params?.search, params?.page, params?.limit]);

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
    const [data, setData]     = useState<AccountsReceivableResult | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError]   = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            setData(await commercialAPI.getAccountsReceivable(params));
        } catch (err) {
            logger.error('Error fetching accounts receivable:', err);
            setError('Erro ao carregar contas a receber');
        } finally {
            setIsLoading(false);
        }
    }, [params?.filter, params?.search, params?.page, params?.limit]);

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
