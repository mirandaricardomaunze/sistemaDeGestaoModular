import { useEffect, useState, useCallback, useRef } from 'react';
import { db } from '../db/offlineDB';
import { salesAPI } from '../services/api';
import toast from 'react-hot-toast';

export function useOfflineSync() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isSyncing, setIsSyncing] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);

    // Use ref to avoid recreating functions on every render
    const isSyncingRef = useRef(false);

    const updatePendingCount = useCallback(async () => {
        const count = await db.pendingSales.where('synced').equals(0).count();
        setPendingCount(count);
    }, []);

    const syncSales = useCallback(async () => {
        if (!navigator.onLine || isSyncingRef.current) return;

        const pending = await db.pendingSales.where('synced').equals(0).toArray();
        if (pending.length === 0) return;

        isSyncingRef.current = true;
        setIsSyncing(true);
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

        if (successCount > 0) {
            toast.success(`${successCount} venda(s) sincronizada(s) com sucesso!`);
            // Optionally remove synced sales
            await db.pendingSales.where('synced').equals(1).delete();
        }

        isSyncingRef.current = false;
        setIsSyncing(false);
        await updatePendingCount();
    }, [updatePendingCount]);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            syncSales();
        };
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Initial count update
        updatePendingCount();

        // Initial sync if online
        if (navigator.onLine) {
            syncSales();
        }

        // Periodic check every 30 seconds
        const interval = setInterval(() => {
            if (navigator.onLine) {
                syncSales();
            }
        }, 30000);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(interval);
        };
    }, []); // Empty dependency array - setup only once

    return { isOnline, isSyncing, pendingCount, syncSales };
}
