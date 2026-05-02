import { logger } from '../utils/logger';
import toast from 'react-hot-toast';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { alertsAPI, type Alert, type AlertModule, type AlertsSummary, type UnreadCount } from '../services/api';

interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
}

interface UseAlertsParams {
    module?: AlertModule;
    type?: string;
    priority?: string;
    isRead?: boolean;
    isResolved?: boolean;
    autoRefresh?: boolean;
    refreshInterval?: number;
    page?: number;
    limit?: number;
    fields?: string;
}

const QK = ['alerts'] as const;

export function useAlerts(params: UseAlertsParams = {}) {
    const {
        autoRefresh = true,
        refreshInterval = 60000,
        ...filters
    } = params;
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: [...QK, filters],
        queryFn: async () => {
            const response = await alertsAPI.getAll(filters as any);
            let alerts: Alert[];
            let pagination: PaginationMeta;
            if (response?.data && response?.pagination) {
                alerts = response.data;
                pagination = {
                    ...response.pagination,
                    hasMore: response.pagination.hasMore ?? response.pagination.hasNext ?? false,
                };
            } else {
                alerts = Array.isArray(response) ? response : (response?.data || []);
                pagination = {
                    page: 1,
                    limit: alerts.length,
                    total: alerts.length,
                    totalPages: 1,
                    hasMore: false,
                };
            }
            return { alerts, pagination };
        },
        placeholderData: keepPreviousData,
        refetchInterval: autoRefresh ? refreshInterval : false,
    });

    const generateMutation = useMutation({
        mutationFn: async (targetModule?: AlertModule) => {
            if (targetModule) await alertsAPI.generateForModule(targetModule);
            else await alertsAPI.generate();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QK });
            toast.success('Alertas atualizados');
        },
        onError: (err) => {
            logger.error('Error generating alerts:', err);
            toast.error('Erro ao gerar alertas');
        },
    });

    const markReadMutation = useMutation({
        mutationFn: (id: string) => alertsAPI.markAsRead(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: QK }),
        onError: (err) => logger.error('Error marking alert as read:', err),
    });

    const markResolvedMutation = useMutation({
        mutationFn: (id: string) => alertsAPI.markAsResolved(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QK });
            toast.success('Alerta resolvido');
        },
        onError: (err) => logger.error('Error resolving alert:', err),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => alertsAPI.delete(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: QK }),
        onError: (err) => logger.error('Error deleting alert:', err),
    });

    const markAllReadMutation = useMutation({
        mutationFn: (targetModule?: AlertModule) => alertsAPI.markAllAsRead(targetModule),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QK });
            toast.success('Alertas marcados como lidos');
        },
        onError: (err) => logger.error('Error marking all alerts as read:', err),
    });

    const clearResolvedMutation = useMutation({
        mutationFn: () => alertsAPI.clearResolved(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QK });
            toast.success('Alertas resolvidos limpos');
        },
        onError: (err) => logger.error('Error clearing resolved alerts:', err),
    });

    const alerts = query.data?.alerts ?? [];
    const unreadCount = alerts.filter(a => !a.isRead && !a.isResolved).length;
    const criticalCount = alerts.filter(a => a.priority === 'critical' && !a.isResolved).length;
    const highCount = alerts.filter(a => a.priority === 'high' && !a.isResolved).length;
    const alertsByModule = alerts.reduce((acc, alert) => {
        const mod = alert.module || 'general';
        if (!acc[mod]) acc[mod] = [];
        acc[mod].push(alert);
        return acc;
    }, {} as Record<string, Alert[]>);

    return {
        alerts,
        isLoading: query.isLoading || query.isFetching,
        error: query.error ? 'Erro ao carregar alertas' : null,
        refetch: query.refetch,
        generateAlerts: (targetModule?: AlertModule) => generateMutation.mutateAsync(targetModule),
        markAsRead: markReadMutation.mutateAsync,
        markAsResolved: markResolvedMutation.mutateAsync,
        deleteAlert: deleteMutation.mutateAsync,
        markAllAsRead: (targetModule?: AlertModule) => markAllReadMutation.mutateAsync(targetModule),
        clearResolved: () => clearResolvedMutation.mutateAsync(),
        unreadCount,
        criticalCount,
        highCount,
        alertsByModule,
        pagination: query.data?.pagination ?? null,
    };
}

export function useAlertsSummary() {
    const q = useQuery<AlertsSummary>({
        queryKey: ['alerts', 'summary'],
        queryFn: () => alertsAPI.getSummary(),
        refetchInterval: 60000,
    });
    return { summary: q.data ?? null, isLoading: q.isLoading, refetch: q.refetch };
}

export function useUnreadCount(module?: AlertModule) {
    const q = useQuery<UnreadCount>({
        queryKey: ['alerts', 'unread-count', module],
        queryFn: () => alertsAPI.getUnreadCount(module),
        refetchInterval: 30000,
    });
    return { counts: q.data ?? null, isLoading: q.isLoading, refetch: q.refetch };
}
