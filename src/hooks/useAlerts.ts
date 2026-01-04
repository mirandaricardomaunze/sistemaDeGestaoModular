import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { alertsAPI } from '../services/api';
import type { Alert } from '../types';

export function useAlerts(params?: {
    type?: string;
    priority?: string;
    isRead?: boolean;
    isResolved?: boolean;
}) {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const paramsRef = useRef(params);
    paramsRef.current = params;

    const fetchAlerts = useCallback(async (isSilent = false) => {
        if (!isSilent) setIsLoading(true);
        setError(null);
        try {
            await alertsAPI.generate();
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

        const interval = setInterval(() => {
            fetchAlerts(true);
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    const generateAlerts = async () => {
        try {
            await alertsAPI.generate();
            fetchAlerts();
        } catch (err) {
            console.error('Error generating alerts:', err);
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
            toast.success('Alerta resolvido com sucesso!');
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

    const markAllAsRead = async () => {
        try {
            await alertsAPI.markAllAsRead();
            setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
            toast.success('Todos os alertas marcados como lidos!');
        } catch (err) {
            console.error('Error marking all alerts as read:', err);
            throw err;
        }
    };

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
        unreadCount: alerts.filter((a) => !a.isRead).length,
    };
}
