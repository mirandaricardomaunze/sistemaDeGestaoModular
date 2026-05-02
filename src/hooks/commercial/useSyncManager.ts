import { useState, useEffect, useCallback, useRef } from 'react';
import { offlineDB } from '../../services/offline/offlineDB';
import { productsAPI } from '../../services/api/products.api';
import { customersAPI } from '../../services/api/customers.api';
import { salesAPI } from '../../services/api/sales.api';
import { toast } from 'react-hot-toast';
import { logger } from '../../utils/logger';

const SYNC_DEBOUNCE_MS = 1500;
const MAX_ATTEMPTS = 5;

export const useSyncManager = (companyId?: string) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Track in-flight sync to avoid concurrent runs even if state hasn't propagated yet.
  const syncingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Notify the user about cache refresh failures only once per online session.
  const cacheErrorWarnedRef = useRef(false);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update pending count
  useEffect(() => {
    const updateCount = async () => {
      const count = await offlineDB.syncQueue.where('status').equals('pending').count();
      setPendingCount(count);
    };

    updateCount();
    const interval = setInterval(updateCount, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch and cache products/customers
  const refreshCache = useCallback(async () => {
    if (!isOnline || !companyId) return;

    try {
      // Products (limit to 1000 for cache)
      const productsData = await productsAPI.getAll({ limit: 1000 });
      if (productsData?.data) {
        await offlineDB.products.clear();
        await offlineDB.products.bulkAdd(productsData.data.map((p: any) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          price: Number(p.price),
          currentStock: p.currentStock,
          category: p.category,
          unit: p.unit || 'un',
        })));
      }

      // Customers
      const customersData = await customersAPI.getAll();
      const customersList = Array.isArray(customersData) ? customersData : customersData?.data;
      if (Array.isArray(customersList)) {
        await offlineDB.customers.clear();
        await offlineDB.customers.bulkAdd(customersList.map((c: any) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          code: c.code,
        })));
      }

      cacheErrorWarnedRef.current = false;
    } catch (error) {
      logger.error('Failed to refresh offline cache', { error });
      if (!cacheErrorWarnedRef.current) {
        cacheErrorWarnedRef.current = true;
        toast.error('Falha ao actualizar dados offline. Trabalhando com a cache anterior.', {
          duration: 5000,
        });
      }
    }
  }, [isOnline, companyId]);

  // Sync pending items
  const syncQueue = useCallback(async () => {
    if (!isOnline || syncingRef.current) return;

    const pendingItems = await offlineDB.syncQueue
      .where('status')
      .equals('pending')
      .toArray();

    if (pendingItems.length === 0) return;

    syncingRef.current = true;
    setIsSyncing(true);
    const toastId = toast.loading(`Sincronizando ${pendingItems.length} itens...`);

    let failures = 0;
    try {
      for (const item of pendingItems) {
        await offlineDB.syncQueue.update(item.id!, { status: 'syncing' });

        try {
          if (item.type === 'SALE') {
            await salesAPI.create(item.data);
          }
          // Add other types if needed (e.g., CUSTOMER creation offline)

          await offlineDB.syncQueue.delete(item.id!);
        } catch (error) {
          failures++;
          logger.error(`Failed to sync item ${item.id}`, { error });
          const nextAttempt = item.attempts + 1;
          const newStatus = nextAttempt >= MAX_ATTEMPTS ? 'failed' : 'pending';

          await offlineDB.syncQueue.update(item.id!, {
            status: newStatus,
            attempts: nextAttempt,
            error: String(error),
          });
        }
      }
      if (failures === 0) {
        toast.success('Sincronização concluída', { id: toastId });
      } else if (failures < pendingItems.length) {
        toast.error(`Sincronização parcial: ${failures} de ${pendingItems.length} itens falharam`, {
          id: toastId,
          duration: 6000,
        });
      } else {
        toast.error('Sincronização falhou. Tentaremos novamente.', { id: toastId });
      }
    } catch (error) {
      logger.error('Unexpected error in syncQueue', { error });
      toast.error('Erro na sincronização', { id: toastId });
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [isOnline]);

  // Debounced trigger to coalesce online flapping / rapid effect re-runs.
  const scheduleSync = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void syncQueue();
    }, SYNC_DEBOUNCE_MS);
  }, [syncQueue]);

  // Periodic refresh and automatic sync when online
  useEffect(() => {
    if (!isOnline) return;
    scheduleSync();
    void refreshCache();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [isOnline, scheduleSync, refreshCache]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    syncQueue,
    refreshCache,
  };
};
