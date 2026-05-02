import { db } from '../../db/offlineDB';
import { productsAPI } from '../api/products.api';
import { customersAPI } from '../api/customers.api';
import { logger } from '../../utils/logger';

const STALE_AFTER_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Warms the local IndexedDB cache so the POS can function during a power
 * or internet outage. Idempotent and safe to call on every app boot.
 */
export async function prefetchCatalog(force = false): Promise<void> {
    if (!navigator.onLine) return;

    await Promise.allSettled([
        prefetchProducts(force),
        prefetchCustomers(force),
    ]);
}

async function prefetchProducts(force: boolean): Promise<void> {
    const meta = await db.catalogMeta.get('products');
    if (!force && meta && Date.now() - meta.lastSyncedAt < STALE_AFTER_MS) {
        return;
    }
    try {
        const response: any = await productsAPI.getAll({ limit: 5000 });
        const products: any[] = Array.isArray(response)
            ? response
            : response?.products ?? response?.data ?? [];
        if (!products.length) return;
        await db.transaction('rw', db.products, db.catalogMeta, async () => {
            await db.products.clear();
            await db.products.bulkPut(products);
            await db.catalogMeta.put({
                key: 'products',
                lastSyncedAt: Date.now(),
                count: products.length,
            });
        });
        logger.info(`[offline] cached ${products.length} products`);
    } catch (e) {
        logger.warn('[offline] product prefetch failed', e);
    }
}

async function prefetchCustomers(force: boolean): Promise<void> {
    const meta = await db.catalogMeta.get('customers');
    if (!force && meta && Date.now() - meta.lastSyncedAt < STALE_AFTER_MS) {
        return;
    }
    try {
        const response: any = await customersAPI.getAll({ limit: 5000 } as any);
        const customers: any[] = Array.isArray(response)
            ? response
            : response?.customers ?? response?.data ?? [];
        if (!customers.length) return;
        await db.transaction('rw', db.customers, db.catalogMeta, async () => {
            await db.customers.clear();
            await db.customers.bulkPut(customers);
            await db.catalogMeta.put({
                key: 'customers',
                lastSyncedAt: Date.now(),
                count: customers.length,
            });
        });
        logger.info(`[offline] cached ${customers.length} customers`);
    } catch (e) {
        logger.warn('[offline] customer prefetch failed', e);
    }
}

export async function getCachedProducts(): Promise<any[]> {
    return db.products.toArray();
}

export async function getCachedCustomers(): Promise<any[]> {
    return db.customers.toArray();
}
