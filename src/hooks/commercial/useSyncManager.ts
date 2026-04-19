import { useState, useEffect, useCallback } from 'react';
import { offlineDB } from '../../services/offline/offlineDB';
import { productsAPI } from '../../services/api/products.api';
import { customersAPI } from '../../services/api/customers.api';
import { salesAPI } from '../../services/api/sales.api';
import { toast } from 'react-hot-toast';

export const useSyncManager = (companyId?: string) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

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
      if (customersData) {
        await offlineDB.customers.clear();
        await offlineDB.customers.bulkAdd(customersData.map((c: any) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          code: c.code,
        })));
      }
      
      console.log('Offline cache refreshed successfully');
    } catch (error) {
      console.error('Failed to refresh offline cache:', error);
    }
  }, [isOnline, companyId]);

  // Sync pending items
  const syncQueue = useCallback(async () => {
    if (!isOnline || isSyncing) return;

    const pendingItems = await offlineDB.syncQueue
      .where('status')
      .equals('pending')
      .toArray();

    if (pendingItems.length === 0) return;

    setIsSyncing(true);
    const toastId = toast.loading(`Sincronizando ${pendingItems.length} itens...`);

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
          console.error(`Failed to sync item ${item.id}:`, error);
          await offlineDB.syncQueue.update(item.id!, { 
            status: 'pending', // retry later
            attempts: item.attempts + 1,
            error: String(error)
          });
        }
      }
      toast.success('Sincronização concluída', { id: toastId });
    } catch (error) {
      toast.error('Erro na sincronização', { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing]);

  // Periodic refresh and automatic sync when online
  useEffect(() => {
    if (isOnline) {
      syncQueue();
      refreshCache();
    }
  }, [isOnline, syncQueue, refreshCache]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    syncQueue,
    refreshCache
  };
};
