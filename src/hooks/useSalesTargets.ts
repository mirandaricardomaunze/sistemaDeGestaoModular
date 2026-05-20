import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
    salesTargetsAPI,
    type SalesTarget,
    type SalesTargetListFilters,
} from '../services/api';

export function useSalesTargets(filters: SalesTargetListFilters = {}) {
    const queryClient = useQueryClient();
    const { employeeId, warehouseId } = filters;

    const query = useQuery({
        queryKey: ['commercial', 'targets', { employeeId: employeeId ?? null, warehouseId: warehouseId ?? null }],
        queryFn: () => salesTargetsAPI.list({ employeeId, warehouseId }),
    });

    const createMutation = useMutation({
        mutationFn: (data: Partial<SalesTarget>) => salesTargetsAPI.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['commercial', 'targets'] });
            toast.success('Meta criada com sucesso!');
        },
        onError: () => toast.error('Erro ao criar meta')
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string, data: Partial<SalesTarget> }) => salesTargetsAPI.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['commercial', 'targets'] });
            toast.success('Meta actualizada!');
        },
        onError: () => toast.error('Erro ao actualizar meta')
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => salesTargetsAPI.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['commercial', 'targets'] });
            toast.success('Meta removida');
        },
        onError: () => toast.error('Erro ao remover meta')
    });

    return {
        targets: query.data || [],
        isLoading: query.isLoading,
        refetch: query.refetch,
        createTarget: createMutation.mutateAsync,
        updateTarget: updateMutation.mutateAsync,
        deleteTarget: deleteMutation.mutateAsync,
        isSaving: createMutation.isPending || updateMutation.isPending,
        isDeleting: deleteMutation.isPending
    };
}

export function useSalesTargetsSummary() {
    return useQuery({
        queryKey: ['commercial', 'targets', 'summary'],
        queryFn: () => salesTargetsAPI.summary(),
        staleTime: 60_000,
    });
}
