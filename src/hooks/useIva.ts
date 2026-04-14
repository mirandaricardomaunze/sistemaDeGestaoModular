import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { ivaAPI, type IvaRate, type CreateIvaRateDto } from '../services/api';

// ---- shared primitives (same pattern as useLogistics.ts / useRestaurant.ts) ----
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

export function useIvaDashboard() {
    return useQ(() => ivaAPI.getDashboard(), 'iva-dashboard');
}

export function useIvaRates(params?: { isActive?: boolean; page?: number }) {
    return useQ(() => ivaAPI.list(params), 'iva-rates', [params?.isActive, params?.page]);
}

export function useActiveIvaRates() {
    return useQ(() => ivaAPI.getActive(), 'iva-rates-active');
}

export function useIvaRate(id: string) {
    return useQ(() => ivaAPI.getById(id), 'iva-rate', [id], !!id);
}

export function useCreateIvaRate() {
    return useM((data: CreateIvaRateDto) => ivaAPI.create(data), {
        invalidates: ['iva-rates', 'iva-rates-active', 'iva-dashboard'],
        onSuccess: () => toast.success('Taxa IVA criada com sucesso'),
        onError: (e: any) => toast.error(e?.response?.data?.message || 'Erro ao criar taxa'),
    });
}

export function useUpdateIvaRate() {
    return useM(({ id, data }: { id: string; data: Partial<CreateIvaRateDto> }) => ivaAPI.update(id, data), {
        invalidates: ['iva-rates', 'iva-rates-active', 'iva-dashboard', 'iva-rate'],
        onSuccess: () => toast.success('Taxa actualizada'),
        onError: (e: any) => toast.error(e?.response?.data?.message || 'Erro ao actualizar taxa'),
    });
}

export function useDeleteIvaRate() {
    return useM((id: string) => ivaAPI.delete(id), {
        invalidates: ['iva-rates', 'iva-rates-active', 'iva-dashboard'],
        onSuccess: () => toast.success('Taxa eliminada'),
        onError: (e: any) => toast.error(e?.response?.data?.message || 'Erro ao eliminar taxa'),
    });
}
