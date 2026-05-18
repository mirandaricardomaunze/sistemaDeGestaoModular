import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { physicalInventoryAPI } from '../services/api/physicalInventory.api';

export function usePhysicalInventories(warehouseId?: string) {
    return useQuery({
        queryKey: ['physical-inventories', warehouseId],
        queryFn: () => physicalInventoryAPI.list(warehouseId),
    });
}

export function usePhysicalInventoryDetail(id?: string) {
    return useQuery({
        queryKey: ['physical-inventory', id],
        queryFn: () => physicalInventoryAPI.getDetail(id as string),
        enabled: Boolean(id),
    });
}

export function useCreatePhysicalInventory() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: physicalInventoryAPI.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['physical-inventories'] });
            toast.success('Inventario fisico criado.');
        },
    });
}

export function useSubmitPhysicalInventoryCounts(inventoryId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (lines: Array<{ lineId: string; countedQuantity: number; notes?: string | null }>) =>
            physicalInventoryAPI.submitCounts(inventoryId, lines),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['physical-inventory', inventoryId] });
            queryClient.invalidateQueries({ queryKey: ['physical-inventories'] });
            toast.success('Contagens registadas.');
        },
    });
}

export function useApprovePhysicalInventory() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: physicalInventoryAPI.approve,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['physical-inventories'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast.success('Inventario aprovado e stock ajustado.');
        },
    });
}
