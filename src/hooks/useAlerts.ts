import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { alertsAPI, type Alert, type AlertModule, type AlertsSummary, type UnreadCount } from '../services/api';

// ============================================================================
// useAlerts Hook - Module-aware alerts management
// ============================================================================

interface UseAlertsParams {
    module?: AlertModule;
    type?: string;
    priority?: string;
    isRead?: boolean;
    isResolved?: boolean;
    autoRefresh?: boolean;
    refreshInterval?: number;
}

export function useAlerts(params: UseAlertsParams = {}) {
    const {
        module,
        type,
        priority,
        isRead,
        isResolved,
        autoRefresh = true,
        refreshInterval = 60000 // 1 minute default
    } = params;

    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const paramsRef = useRef({ module, type, priority, isRead, isResolved });
    paramsRef.current = { module, type, priority, isRead, isResolved };

    const fetchAlerts = useCallback(async (isSilent = false) => {
        if (!isSilent) setIsLoading(true);
        setError(null);
        try {
            const result = await alertsAPI.getAll(paramsRef.current);
            setAlerts(result);
        } catch (err) {
            setError('Erro ao carregar alertas');
            console.error('Error fetching alerts:', err);
        } finally {
            if (!isSilent) setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAlerts();

        if (autoRefresh) {
            const interval = setInterval(() => {
                fetchAlerts(true);
            }, refreshInterval);

            return () => clearInterval(interval);
        }
    }, [fetchAlerts, autoRefresh, refreshInterval, module]);

    const generateAlerts = async (targetModule?: AlertModule) => {
        try {
            if (targetModule) {
                await alertsAPI.generateForModule(targetModule);
            } else {
                await alertsAPI.generate();
            }
            await fetchAlerts();
            toast.success('Alertas atualizados');
        } catch (err) {
            console.error('Error generating alerts:', err);
            toast.error('Erro ao gerar alertas');
            throw err;
        }
    };

    const markAsRead = async (id: string) => {
        try {
            await alertsAPI.markAsRead(id);
            setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: true } : a)));
        } catch (err) {
            console.error('Error marking alert as read:', err);
            throw err;
        }
    };

    const markAsResolved = async (id: string) => {
        try {
            await alertsAPI.markAsResolved(id);
            setAlerts((prev) =>
                prev.map((a) =>
                    a.id === id ? { ...a, isResolved: true, resolvedAt: new Date().toISOString() } : a
                )
            );
            toast.success('Alerta resolvido');
        } catch (err) {
            console.error('Error resolving alert:', err);
            throw err;
        }
    };

    const deleteAlert = async (id: string) => {
        try {
            await alertsAPI.delete(id);
            setAlerts((prev) => prev.filter((a) => a.id !== id));
        } catch (err) {
            console.error('Error deleting alert:', err);
            throw err;
        }
    };

    const markAllAsRead = async (targetModule?: AlertModule) => {
        try {
            await alertsAPI.markAllAsRead(targetModule);
            setAlerts((prev) =>
                prev.map((a) => (targetModule && a.module !== targetModule ? a : { ...a, isRead: true }))
            );
            toast.success('Alertas marcados como lidos');
        } catch (err) {
            console.error('Error marking all alerts as read:', err);
            throw err;
        }
    };

    const clearResolved = async () => {
        try {
            await alertsAPI.clearResolved();
            setAlerts((prev) => prev.filter((a) => !a.isResolved));
            toast.success('Alertas resolvidos limpos');
        } catch (err) {
            console.error('Error clearing resolved alerts:', err);
            throw err;
        }
    };

    // Computed values
    const unreadCount = alerts.filter((a) => !a.isRead && !a.isResolved).length;
    const criticalCount = alerts.filter((a) => a.priority === 'critical' && !a.isResolved).length;
    const highCount = alerts.filter((a) => a.priority === 'high' && !a.isResolved).length;

    const alertsByModule = alerts.reduce((acc, alert) => {
        const mod = alert.module || 'general';
        if (!acc[mod]) acc[mod] = [];
        acc[mod].push(alert);
        return acc;
    }, {} as Record<string, Alert[]>);

    return {
        alerts,
        isLoading,
        error,
        refetch: fetchAlerts,
        generateAlerts,
        markAsRead,
        markAsResolved,
        deleteAlert,
        markAllAsRead,
        clearResolved,
        unreadCount,
        criticalCount,
        highCount,
        alertsByModule,
    };
}

// ============================================================================
// useAlertsSummary Hook - Quick summary for dashboards
// ============================================================================

export function useAlertsSummary() {
    const [summary, setSummary] = useState<AlertsSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchSummary = useCallback(async () => {
        try {
            const data = await alertsAPI.getSummary();
            setSummary(data);
        } catch (err) {
            console.error('Error fetching alerts summary:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSummary();
        const interval = setInterval(fetchSummary, 60000);
        return () => clearInterval(interval);
    }, [fetchSummary]);

    return { summary, isLoading, refetch: fetchSummary };
}

// ============================================================================
// useUnreadCount Hook - Badge counts
// ============================================================================

export function useUnreadCount(module?: AlertModule) {
    const [counts, setCounts] = useState<UnreadCount | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchCounts = useCallback(async () => {
        try {
            const data = await alertsAPI.getUnreadCount(module);
            setCounts(data);
        } catch (err) {
            console.error('Error fetching unread counts:', err);
        } finally {
            setIsLoading(false);
        }
    }, [module]);

    useEffect(() => {
        fetchCounts();
        const interval = setInterval(fetchCounts, 30000);
        return () => clearInterval(interval);
    }, [fetchCounts]);

    return { counts, isLoading, refetch: fetchCounts };
}
