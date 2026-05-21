import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { batchesAPI, type CreateBatchDto } from '../services/api';

// React Query already gives us caching, dedupe, invalidation and stale-while-revalidate.
// The previous custom event-bus implementation duplicated all of that with hand-rolled
// state, so we drop it in favour of the standard hooks (and let the global queryClient
// dedupe across components automatically).

const KEYS = {
    dashboard: ['batches', 'dashboard'] as const,
    expiring: (p?: Record<string, unknown>) => ['batches', 'expiring', p ?? {}] as const,
    list: (p?: Record<string, unknown>) => ['batches', 'list', p ?? {}] as const,
    one: (id: string) => ['batches', 'one', id] as const,
};

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
    qc.invalidateQueries({ queryKey: ['batches'] });
    qc.invalidateQueries({ queryKey: ['products'] });
    qc.invalidateQueries({ queryKey: ['inventory'] });
}

export function useBatchesDashboard() {
    const q = useQuery({ queryKey: KEYS.dashboard, queryFn: () => batchesAPI.getDashboard() });
    return { data: q.data ?? null, isLoading: q.isLoading, error: q.error, refetch: q.refetch };
}

export function useExpBatches(params?: { days?: number; page?: number; limit?: number; fields?: string }) {
    const q = useQuery({
        queryKey: KEYS.expiring(params),
        queryFn: () => batchesAPI.getExpiring(params),
        placeholderData: keepPreviousData,
    });
    return { data: q.data ?? null, isLoading: q.isLoading || q.isFetching, error: q.error, refetch: q.refetch };
}

export function useBatches(params?: {
    productId?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
    fields?: string;
}) {
    const q = useQuery({
        queryKey: KEYS.list(params),
        queryFn: () => batchesAPI.list(params),
        placeholderData: keepPreviousData,
    });
    return { data: q.data ?? null, isLoading: q.isLoading || q.isFetching, error: q.error, refetch: q.refetch };
}

export function useBatch(id: string) {
    const q = useQuery({
        queryKey: KEYS.one(id),
        queryFn: () => batchesAPI.getById(id),
        enabled: !!id,
    });
    return { data: q.data ?? null, isLoading: q.isLoading, error: q.error, refetch: q.refetch };
}

export function useCreateBatch() {
    const qc = useQueryClient();
    const m = useMutation({
        mutationFn: (data: CreateBatchDto) => batchesAPI.create(data),
        onSuccess: () => { invalidateAll(qc); toast.success('Lote registado com sucesso'); },
        onError: (e: { response?: { data?: { message?: string; error?: string } } }) => {
            const msg = e?.response?.data?.message || e?.response?.data?.error || 'Erro ao registar lote';
            toast.error(msg);
        },
    });
    return { mutate: m.mutate, mutateAsync: m.mutateAsync, isLoading: m.isPending };
}

export function useUpdateBatch() {
    const qc = useQueryClient();
    const m = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<CreateBatchDto> & { status?: string } }) =>
            batchesAPI.update(id, data),
        onSuccess: () => { invalidateAll(qc); toast.success('Lote actualizado'); },
        onError: (e: { response?: { data?: { message?: string; error?: string } } }) => toast.error(e?.response?.data?.message || 'Erro ao actualizar lote'),
    });
    return { mutate: m.mutate, mutateAsync: m.mutateAsync, isLoading: m.isPending };
}

export function useDeleteBatch() {
    const qc = useQueryClient();
    const m = useMutation({
        mutationFn: (id: string) => batchesAPI.delete(id),
        onSuccess: () => { invalidateAll(qc); toast.success('Lote eliminado'); },
        onError: (e: { response?: { data?: { message?: string; error?: string } } }) => toast.error(e?.response?.data?.message || 'Erro ao eliminar lote'),
    });
    return { mutate: m.mutate, mutateAsync: m.mutateAsync, isLoading: m.isPending };
}
