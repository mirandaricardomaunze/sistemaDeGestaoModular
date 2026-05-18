import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { approvalsAPI } from '../services/api/approvals.api';
import type {
    ApprovalRequest,
    ApprovalListParams,
    CreateApprovalRequestInput,
    DecideApprovalRequestInput,
} from '../types/approvals';

const QUERY_KEY = 'approvals';

export function useApprovals(params?: ApprovalListParams) {
    const query = useQuery({
        queryKey: [QUERY_KEY, params ?? {}],
        queryFn: () => approvalsAPI.list(params),
        staleTime: 30_000,
    });

    const items = query.data?.data ?? [];
    return {
        items: items as ApprovalRequest[],
        pagination: query.data?.pagination,
        isLoading: query.isLoading,
        error: query.error,
        refetch: query.refetch,
    };
}

export function usePendingApprovalsCount() {
    const query = useQuery({
        queryKey: [QUERY_KEY, 'pending-count'],
        queryFn: () => approvalsAPI.list({ status: 'pending', limit: 1 }),
        staleTime: 15_000,
    });
    return {
        count: query.data?.pagination?.total ?? 0,
        isLoading: query.isLoading,
        refetch: query.refetch,
    };
}

export function useApprovalActions() {
    const qc = useQueryClient();

    const invalidate = () => {
        qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    };

    const create = useMutation({
        mutationFn: (payload: CreateApprovalRequestInput) => approvalsAPI.create(payload),
        onSuccess: () => {
            toast.success('Pedido enviado para aprovação');
            invalidate();
        },
        onError: () => toast.error('Erro ao enviar pedido'),
    });

    const approve = useMutation({
        mutationFn: ({ id, payload }: { id: string; payload?: DecideApprovalRequestInput }) =>
            approvalsAPI.approve(id, payload ?? {}),
        onSuccess: () => {
            toast.success('Pedido aprovado');
            invalidate();
        },
        onError: (err: { response?: { data?: { message?: string; error?: string } } }) => toast.error(err?.response?.data?.message ?? 'Erro ao aprovar'),
    });

    const reject = useMutation({
        mutationFn: ({ id, payload }: { id: string; payload?: DecideApprovalRequestInput }) =>
            approvalsAPI.reject(id, payload ?? {}),
        onSuccess: () => {
            toast.success('Pedido rejeitado');
            invalidate();
        },
        onError: (err: { response?: { data?: { message?: string; error?: string } } }) => toast.error(err?.response?.data?.message ?? 'Erro ao rejeitar'),
    });

    const cancel = useMutation({
        mutationFn: (id: string) => approvalsAPI.cancel(id),
        onSuccess: () => {
            toast.success('Pedido cancelado');
            invalidate();
        },
        onError: () => toast.error('Erro ao cancelar'),
    });

    return { create, approve, reject, cancel };
}
