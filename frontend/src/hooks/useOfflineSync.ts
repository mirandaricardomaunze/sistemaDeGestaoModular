import { logger } from '../utils/logger';
import { useEffect, useState, useCallback, useRef } from 'react';
import {
    db,
    computeNextRetry,
    MAX_SYNC_ATTEMPTS,
    type PendingOperation,
    type PendingSale,
} from '../db/offlineDB';
import { api } from '../services/api';
import { IDEMPOTENCY_HEADER, pendingCounts, purgeSynced, warningLevel, type QueueWarningLevel } from '../services/offline/offlineQueue';
import toast from 'react-hot-toast';

const TICK_INTERVAL_MS = 15_000;
const HEALTHCHECK_INTERVAL_MS = 30_000;
const PURGE_INTERVAL_MS = 5 * 60 * 1000;
const HEALTHCHECK_TIMEOUT_MS = 5_000;

async function pingBackend(): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), HEALTHCHECK_TIMEOUT_MS);
        const res = await api.get('/health', {
            signal: controller.signal,
            // @ts-expect-error custom axios property
            skipErrorToast: true,
            skipOfflineQueue: true,
        });
        clearTimeout(timeout);
        return res.status >= 200 && res.status < 300;
    } catch {
        return false;
    }
}

export function useOfflineSync() {
    const [networkOnline, setNetworkOnline] = useState(navigator.onLine);
    const [serverReachable, setServerReachable] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const [failedCount, setFailedCount] = useState(0);
    const [queueLevel, setQueueLevel] = useState<QueueWarningLevel>('ok');

    const isSyncingRef = useRef(false);
    const serverReachableRef = useRef(true);
    const isOnline = networkOnline && serverReachable;

    const refreshCounts = useCallback(async () => {
        const counts = await pendingCounts();
        setPendingCount(counts.pending);
        setFailedCount(counts.failed);
        setQueueLevel(warningLevel(counts.total));
    }, []);

    const markSynced = async (
        table: 'pendingSales' | 'pendingOperations',
        id: number
    ) => {
        await db[table].update(id, {
            status: 'done' as const,
            synced: true,
            lastError: undefined,
        });
    };

    const scheduleRetry = async (
        table: 'pendingSales' | 'pendingOperations',
        id: number,
        attempts: number,
        err: unknown
    ) => {
        const message = extractErrorMessage(err);
        const status: 'pending' | 'failed' =
            attempts >= MAX_SYNC_ATTEMPTS ? 'failed' : 'pending';
        await db[table].update(id, {
            status,
            attempts,
            nextRetryAt: computeNextRetry(attempts),
            lastError: message,
        });
    };

    const isPermanentFailure = (err: unknown): boolean => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (typeof status === 'number' && status >= 400 && status < 500) {
            // 408/425/429 are retryable transient client errors
            if (status === 408 || status === 425 || status === 429) return false;
            return true;
        }
        return false;
    };

    const syncSales = async (): Promise<number> => {
        const now = Date.now();
        const due: PendingSale[] = await db.pendingSales
            .where('status')
            .equals('pending')
            .filter((s) => (s.nextRetryAt ?? 0) <= now)
            .toArray();

        let success = 0;
        for (const sale of due) {
            const attempts = (sale.attempts ?? 0) + 1;
            try {
                await db.pendingSales.update(sale.id!, { status: 'syncing' as const });
                // Send clientId via header so the backend idempotency middleware
                // dedupes retries; salesAPI.create alone would let the interceptor
                // stamp a fresh UUID per attempt.
                await api.request({
                    url: '/sales',
                    method: 'POST',
                    data: sale.data,
                    headers: { [IDEMPOTENCY_HEADER]: sale.clientId },
                    // @ts-expect-error custom axios property
                    skipOfflineQueue: true,
                });
                await markSynced('pendingSales', sale.id!);
                success++;
            } catch (error) {
                logger.error('Failed to sync sale:', sale.id, error);
                if (isPermanentFailure(error)) {
                    await db.pendingSales.update(sale.id!, {
                        status: 'failed' as const,
                        attempts,
                        lastError: extractErrorMessage(error),
                    });
                } else {
                    await scheduleRetry('pendingSales', sale.id!, attempts, error);
                }
            }
        }
        return success;
    };

    const syncOperations = async (): Promise<number> => {
        const now = Date.now();
        const due: PendingOperation[] = await db.pendingOperations
            .where('status')
            .equals('pending')
            .filter((o) => (o.nextRetryAt ?? 0) <= now)
            .sortBy('priority');
        due.reverse(); // highest priority first

        let success = 0;
        for (const op of due) {
            const attempts = (op.attempts ?? 0) + 1;
            try {
                await db.pendingOperations.update(op.id!, { status: 'syncing' as const });
                await api.request({
                    url: op.endpoint,
                    method: op.method,
                    data: op.data,
                    headers: { [IDEMPOTENCY_HEADER]: op.clientId },
                    // @ts-expect-error custom axios property
                    skipOfflineQueue: true,
                });
                await markSynced('pendingOperations', op.id!);
                success++;
            } catch (error) {
                logger.error(`Failed to sync ${op.module} operation:`, op.id, error);
                if (isPermanentFailure(error)) {
                    await db.pendingOperations.update(op.id!, {
                        status: 'failed' as const,
                        attempts,
                        lastError: extractErrorMessage(error),
                    });
                } else {
                    await scheduleRetry('pendingOperations', op.id!, attempts, error);
                }
            }
        }
        return success;
    };

    const syncAll = useCallback(async () => {
        if (!navigator.onLine || !serverReachableRef.current || isSyncingRef.current) return;
        isSyncingRef.current = true;
        setIsSyncing(true);

        try {
            const salesSuccess = await syncSales();
            const opsSuccess = await syncOperations();
            const totalSuccess = salesSuccess + opsSuccess;

            if (totalSuccess > 0) {
                toast.success(
                    `${totalSuccess} ${totalSuccess === 1 ? 'operação sincronizada' : 'operações sincronizadas'}`,
                    { icon: '🔄' }
                );
                await db.pendingSales.where('status').equals('done').delete();
                await db.pendingOperations.where('status').equals('done').delete();

                // Server state may have shifted while we were offline; force a
                // catalog refresh so the next sale sees current prices/stock.
                await db.catalogMeta.delete('products');
                await db.catalogMeta.delete('customers');
                void import('../services/offline/catalogPrefetch')
                    .then(({ prefetchCatalog }) => prefetchCatalog(true))
                    .catch(() => {});
            }
        } finally {
            isSyncingRef.current = false;
            setIsSyncing(false);
            await refreshCounts();
        }
    }, [refreshCounts]);

    useEffect(() => {
        const handleOnline = () => setNetworkOnline(true);
        const handleOffline = () => setNetworkOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        refreshCounts();
        void purgeSynced();

        const tick = () => {
            if (navigator.onLine && serverReachableRef.current) syncAll();
            else refreshCounts();
        };
        const interval = setInterval(tick, TICK_INTERVAL_MS);

        const setReachable = (ok: boolean) => {
            const wasReachable = serverReachableRef.current;
            serverReachableRef.current = ok;
            setServerReachable(ok);
            if (!wasReachable && ok) void syncAll();
        };
        const healthTick = async () => {
            if (!navigator.onLine) { setReachable(false); return; }
            setReachable(await pingBackend());
        };
        void healthTick();
        const healthInterval = setInterval(() => { void healthTick(); }, HEALTHCHECK_INTERVAL_MS);

        const purgeInterval = setInterval(() => { void purgeSynced(); }, PURGE_INTERVAL_MS);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(interval);
            clearInterval(healthInterval);
            clearInterval(purgeInterval);
        };
    }, [syncAll, refreshCounts]);

    return {
        isOnline,
        networkOnline,
        serverReachable,
        isSyncing,
        pendingCount,
        failedCount,
        queueLevel,
        syncAll,
        refreshCounts,
    };
}

function extractErrorMessage(err: unknown): string {
    const anyErr = err as Error & { response?: { data?: { error?: string; message?: string } } };
    return (
        anyErr?.response?.data?.error ||
        anyErr?.response?.data?.message ||
        anyErr?.message ||
        String(err)
    );
}
