import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { batchesAPI, type CreateBatchDto } from '../services/api';

const bus = new EventTarget();
const inv = (keys: string[]) => keys.forEach(k => bus.dispatchEvent(new CustomEvent('inv', { detail: k })));

function useQ<T>(fn: () => Promise<T>, key: string, deps: any[] = [], enabled = true) {
    const [data, setData] = useState<T | null>(null);
    const [isLoading, setIsLoading] = useState(enabled);
    const [error, setError] = useState<any>(null);

    const fetch = useCallback(async () => {
        setIsLoading(true); setError(null);
        try { setData(await fn()); } catch (e) { setError(e); }
        finally { setIsLoading(false); }
    }, [key, ...deps]);

    useEffect(() => { if (enabled) fetch(); }, [enabled, key, ...deps]);
    useEffect(() => {
        const h = (e: any) => { if (e.detail === key) fetch(); };
        bus.addEventListener('inv', h);
        return () => bus.removeEventListener('inv', h);
    }, [key, fetch]);

    return { data, isLoading, error, refetch: fetch };
}

function useM<T, V>(fn: (v: V) => Promise<T>, opts?: { onSuccess?: (d: T) => void; onError?: (e: any) => void; invalidates?: string[] }) {
    const [isLoading, setIsLoading] = useState(false);
    const mutate = async (v: V) => {
        setIsLoading(true);
        try {
            const r = await fn(v);
            if (opts?.invalidates) inv(opts.invalidates);
            opts?.onSuccess?.(r);
            return r;
        } catch (e) { opts?.onError?.(e); throw e; }
        finally { setIsLoading(false); }
    };
    return { mutate, mutateAsync: mutate, isLoading };
}

// ============================================================================
// HOOKS
// ============================================================================

export function useBatchesDashboard() {
    return useQ(() => batchesAPI.getDashboard(), 'batches-dashboard');
}

export function useExpBatches(params?: { days?: number; page?: number; limit?: number }) {
    return useQ(() => batchesAPI.getExpiring(params), 'batches-expiring', [params?.days, params?.page]);
}

export function useBatches(params?: { productId?: string; status?: string; search?: string; page?: number; limit?: number }) {
    return useQ(
        () => batchesAPI.list(params),
        'batches-list',
        [params?.productId, params?.status, params?.search, params?.page]
    );
}

export function useBatch(id: string) {
    return useQ(() => batchesAPI.getById(id), 'batch', [id], !!id);
}

export function useCreateBatch() {
    return useM((data: CreateBatchDto) => batchesAPI.create(data), {
        invalidates: ['batches-list', 'batches-expiring', 'batches-dashboard'],
        onSuccess: () => toast.success('Lote registado com sucesso'),
        onError: (e: any) => toast.error(e?.response?.data?.message || e?.response?.data?.error || 'Erro ao registar lote'),
    });
}

export function useUpdateBatch() {
    return useM(({ id, data }: { id: string; data: Partial<CreateBatchDto> & { status?: string } }) => batchesAPI.update(id, data), {
        invalidates: ['batches-list', 'batches-expiring', 'batches-dashboard', 'batch'],
        onSuccess: () => toast.success('Lote actualizado'),
        onError: (e: any) => toast.error(e?.response?.data?.message || 'Erro ao actualizar lote'),
    });
}

export function useDeleteBatch() {
    return useM((id: string) => batchesAPI.delete(id), {
        invalidates: ['batches-list', 'batches-expiring', 'batches-dashboard'],
        onSuccess: () => toast.success('Lote eliminado'),
        onError: (e: any) => toast.error(e?.response?.data?.message || 'Erro ao eliminar lote'),
    });
}
