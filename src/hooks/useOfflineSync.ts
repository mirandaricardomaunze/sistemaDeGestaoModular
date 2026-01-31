import { useEffect, useState, useCallback, useRef } from 'react';
import { db } from '../db/offlineDB';
import { salesAPI, api } from '../services/api';
import toast from 'react-hot-toast';

export function useOfflineSync() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isSyncing, setIsSyncing] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);

    // Use ref to avoid recreating functions on every render
    const isSyncingRef = useRef(false);

    const updatePendingCount = useCallback(async () => {
        const salesCount = await db.pendingSales.where('synced').equals(0).count();
        const opsCount = await db.pendingOperations.where('synced').equals(0).count();
        setPendingCount(salesCount + opsCount);
    }, []);

    const syncSales = async () => {
        const pending = await db.pendingSales.where('synced').equals(0).toArray();
        if (pending.length === 0) return 0;

        let successCount = 0;
        for (const sale of pending) {
            try {
                await salesAPI.create(sale.data);
                await db.pendingSales.update(sale.id!, { synced: true as any });
                successCount++;
            } catch (error) {
                console.error('Failed to sync sale:', sale.id, error);
                await db.pendingSales.update(sale.id!, { error: String(error) });
            }
        }
        return successCount;
    };

    const syncOperations = async () => {
        const pending = await db.pendingOperations.where('synced').equals(0).toArray();
        if (pending.length === 0) return 0;

        let successCount = 0;
        for (const op of pending) {
            try {
                // Execute the generic operation based on endpoint and method
                // We use the basic api instance since the endpoint is already module-prefixed
                await api({
                    url: op.endpoint,
                    method: op.method,
                    data: op.data
                });
                await db.pendingOperations.update(op.id!, { synced: true as any });
                successCount++;
            } catch (error) {
                console.error(`Failed to sync ${op.module} operation:`, op.id, error);
                await db.pendingOperations.update(op.id!, { error: String(error) });
            }
        }
        return successCount;
    };

    const syncAll = useCallback(async () => {
        if (!navigator.onLine || isSyncingRef.current) return;

        isSyncingRef.current = true;
        setIsSyncing(true);

        try {
            const salesSuccess = await syncSales();
            const opsSuccess = await syncOperations();
            const totalSuccess = salesSuccess + opsSuccess;

            if (totalSuccess > 0) {
                toast.success(`${totalSuccess} operações sincronizadas com sucesso!`, { icon: '🔄' });
                // Cleanup synced records
                await db.pendingSales.where('synced').equals(1).delete();
                await db.pendingOperations.where('synced').equals(1).delete();
            }
        } finally {
            isSyncingRef.current = false;
            setIsSyncing(false);
            await updatePendingCount();
        }
    }, [updatePendingCount]);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            syncAll();
        };
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        updatePendingCount();

        if (navigator.onLine) {
            syncAll();
        }

        const interval = setInterval(() => {
            if (navigator.onLine) {
                syncAll();
            }
        }, 30000);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(interval);
        };
    }, [syncAll, updatePendingCount]);

    return { isOnline, isSyncing, pendingCount, syncAll };
}
