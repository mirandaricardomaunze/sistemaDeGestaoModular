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

export function useBottleReturns(params?: any) {
    return useQuery<BottleReturn[]>({
        queryKey: ['bottlestore', 'returns', params],
        queryFn: () => bottleStoreAPI.getBottleReturns(params),
    });
}

export function useCreateBottleDeposit() {
    const qc = useQueryClient();
    return withIsLoading(useMutation({
        mutationFn: (data: any) => bottleStoreAPI.recordBottleDeposit(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['bottlestore', 'returns'] });
            toast.success('Depósito de vasilhame registrado');
        },
        onError: (err: any) => toast.error(err.message || 'Erro ao registrar depósito'),
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

export function useBottleStoreBatches(params?: any) {
    return useQuery<BottleStoreBatch[]>({
        queryKey: ['bottlestore', 'batches', params],
        queryFn: () => bottleStoreAPI.getBatches(params),
    });
}

export function useCreateBatch() {
    const qc = useQueryClient();
    return withIsLoading(useMutation({
        mutationFn: (data: any) => bottleStoreAPI.createBatch(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['bottlestore', 'batches'] });
            qc.invalidateQueries({ queryKey: ['bottlestore', 'dashboard'] });
            toast.success('Lote criado com sucesso');
        },
    }));
}
