import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { warehousesAPI } from '../services/api';
import toast from 'react-hot-toast';

export interface Warehouse {
    id: string;
    code: string;
    name: string;
    location?: string;
    responsible?: string;
    isActive: boolean;
    isDefault: boolean;
    latitude?: number | string;
    longitude?: number | string;
    totalItems?: number;
}

export function useWarehouses() {
    const queryClient = useQueryClient();

    const query = useQuery<Warehouse[]>({
        queryKey: ['warehouses'],
        queryFn: () => warehousesAPI.getAll(),
    });

    const addMutation = useMutation({
        mutationFn: (data: Parameters<typeof warehousesAPI.create>[0]) => warehousesAPI.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['warehouses'] });
            toast.success('Armazém criado com sucesso!');
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Parameters<typeof warehousesAPI.update>[1] }) => 
            warehousesAPI.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['warehouses'] });
            toast.success('Armazém actualizado com sucesso!');
        },
    });

    return {
        warehouses: query.data ?? [],
        isLoading: query.isLoading,
        error: query.error ? 'Erro ao carregar armazéns' : null,
        refetch: query.refetch,
        addWarehouse: addMutation.mutateAsync,
        updateWarehouse: updateMutation.mutateAsync,
    };
}
