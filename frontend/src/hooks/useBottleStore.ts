import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bottleStoreAPI } from '../services/api/bottle-store.api';
import type {
    BottleStoreDashboard,
    ExpiringBatchesResult,
    BottleReturn,
    CashSession,
    BottleStoreBatch,
} from '../types/bottlestore';
import toast from 'react-hot-toast';

interface BottleReturnsParams {
    customerId?: string;
    type?: 'deposit' | 'return';
    status?: string;
    page?: number;
    limit?: number;
}

interface BottleDepositPayload {
    customerId: string;
    productId: string;
    quantity: number;
    notes?: string;
}

interface BottleStoreBatchesParams {
    productId?: string;
    status?: string;
    page?: number;
    limit?: number;
}

interface CreateBatchPayload {
    productId: string;
    batchNumber: string;
    quantity: number;
    expiryDate?: string;
    manufactureDate?: string;
    receivedDate?: string;
    costPrice?: number;
    supplierId?: string;
    notes?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function withIsLoading<T extends object & { isPending: boolean }>(m: T) {
    return Object.assign(m, { isLoading: m.isPending });
}

// ============================================================================
// DASHBOARD
// ============================================================================

export function useBottleStoreDashboard(range: string = '1M') {
    return useQuery<BottleStoreDashboard>({
        queryKey: ['bottlestore', 'dashboard', range],
        queryFn: () => bottleStoreAPI.getDashboard(range),
    });
}

export function useExpiringBatches(days: number = 60) {
    return useQuery<ExpiringBatchesResult>({
        queryKey: ['bottlestore', 'batches', 'expiring', days],
        queryFn: () => bottleStoreAPI.getExpiringBatches(days),
    });
}

// ============================================================================
// BOTTLE RETURNS
// ============================================================================

export function useBottleReturns(params?: BottleReturnsParams) {
    return useQuery<BottleReturn[]>({
        queryKey: ['bottlestore', 'returns', params],
        queryFn: () => bottleStoreAPI.getBottleReturns((params || {}) as Record<string, unknown>),
    });
}

export function useCreateBottleDeposit() {
    const qc = useQueryClient();
    return withIsLoading(useMutation({
        mutationFn: (data: BottleDepositPayload) => bottleStoreAPI.recordBottleDeposit(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['bottlestore', 'returns'] });
            toast.success('Depósito de vasilhame registrado');
        },
        onError: (err: Error & { response?: { data?: { message?: string; error?: string } } }) => toast.error(err.message || 'Erro ao registrar depósito'),
    }));
}

// ============================================================================
// CASH SESSIONS
// ============================================================================

export function useCurrentCashSession() {
    return useQuery<CashSession>({
        queryKey: ['bottlestore', 'cash-session', 'current'],
        queryFn: () => bottleStoreAPI.getCurrentCashSession(),
    });
}

export function useOpenCashSession() {
    const qc = useQueryClient();
    return withIsLoading(useMutation({
        mutationFn: (openingBalance: number) => bottleStoreAPI.openCashSession(openingBalance),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['bottlestore', 'cash-session'] });
            toast.success('Caixa aberto com sucesso');
        },
    }));
}

export function useCloseCashSession() {
    const qc = useQueryClient();
    return withIsLoading(useMutation({
        mutationFn: (data: { actualBalance: number; notes?: string }) => bottleStoreAPI.closeCashSession(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['bottlestore', 'cash-session'] });
            toast.success('Caixa fechado com sucesso');
        },
    }));
}

// ============================================================================
// BATCHES
// ============================================================================

export function useBottleStoreBatches(params?: BottleStoreBatchesParams) {
    return useQuery<BottleStoreBatch[]>({
        queryKey: ['bottlestore', 'batches', params],
        queryFn: () => bottleStoreAPI.getBatches(params),
    });
}

export function useCreateBatch() {
    const qc = useQueryClient();
    return withIsLoading(useMutation({
        mutationFn: (data: CreateBatchPayload) => bottleStoreAPI.createBatch(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['bottlestore', 'batches'] });
            qc.invalidateQueries({ queryKey: ['bottlestore', 'dashboard'] });
            toast.success('Lote criado com sucesso');
        },
    }));
}
