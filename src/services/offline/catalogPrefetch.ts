import { db } from '../../db/offlineDB';
import { productsAPI } from '../api/products.api';
import { customersAPI } from '../api/customers.api';
import { pharmacyAPI } from '../api/pharmacy.api';
import { hospitalityAPI } from '../api/hospitality.api';
import { restaurantAPI } from '../api/restaurant.api';
import { logger } from '../../utils/logger';
import type { Product, Customer } from '../../types';

type ApiListResponse<T> = T[] | { data?: T[]; products?: T[]; customers?: T[] };

const STALE_AFTER_MS = 30 * 60 * 1000; // 30 minutes

function extractList<T>(response: unknown): T[] {
    if (Array.isArray(response)) return response as T[];
    const obj = response as { data?: T[] } | null | undefined;
    return obj?.data ?? [];
}

async function isFresh(key: string, force: boolean): Promise<boolean> {
    if (force) return false;
    const meta = await db.catalogMeta.get(key);
    return !!meta && Date.now() - meta.lastSyncedAt < STALE_AFTER_MS;
}

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
        const response = await productsAPI.getAll({ limit: 2000 }) as ApiListResponse<Product>;
        const products: Product[] = Array.isArray(response)
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
        const response = await customersAPI.getAll({ limit: 2000 }) as ApiListResponse<Customer>;
        const customers: Customer[] = Array.isArray(response)
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

export async function getCachedProducts(): Promise<Product[]> {
    return db.products.toArray();
}

export async function getCachedCustomers(): Promise<Customer[]> {
    return db.customers.toArray();
}

// ── Per-module prefetch helpers ──────────────────────────────────────────────
// Each module page may opt-in to warm its own cache lazily on mount. We do
// NOT call these from boot because they cost ~1 round-trip per module and
// most tenants don't enable every module.

export async function prefetchPharmacy(force = false): Promise<void> {
    if (!navigator.onLine || await isFresh('medications', force)) return;
    try {
        const response = await pharmacyAPI.getMedications({ limit: 2000 });
        const rows = extractList<Record<string, unknown>>(response);
        if (!rows.length) return;
        await db.transaction('rw', db.medications, db.catalogMeta, async () => {
            await db.medications.clear();
            await db.medications.bulkPut(rows);
            await db.catalogMeta.put({ key: 'medications', lastSyncedAt: Date.now(), count: rows.length });
        });
        logger.info(`[offline] cached ${rows.length} medications`);
    } catch (e) {
        logger.warn('[offline] medications prefetch failed', e);
    }
}

export async function prefetchHospitality(force = false): Promise<void> {
    if (!navigator.onLine || await isFresh('rooms', force)) return;
    try {
        const response = await hospitalityAPI.getRooms();
        const rows = extractList<Record<string, unknown>>(response);
        if (!rows.length) return;
        await db.transaction('rw', db.rooms, db.catalogMeta, async () => {
            await db.rooms.clear();
            await db.rooms.bulkPut(rows);
            await db.catalogMeta.put({ key: 'rooms', lastSyncedAt: Date.now(), count: rows.length });
        });
        logger.info(`[offline] cached ${rows.length} rooms`);
    } catch (e) {
        logger.warn('[offline] rooms prefetch failed', e);
    }
}

export async function prefetchRestaurantMenu(force = false): Promise<void> {
    if (!navigator.onLine || await isFresh('menuItems', force)) return;
    try {
        const response = await restaurantAPI.getMenuItems({ limit: 2000 });
        const rows = extractList<Record<string, unknown>>(response);
        if (!rows.length) return;
        await db.transaction('rw', db.menuItems, db.catalogMeta, async () => {
            await db.menuItems.clear();
            await db.menuItems.bulkPut(rows);
            await db.catalogMeta.put({ key: 'menuItems', lastSyncedAt: Date.now(), count: rows.length });
        });
        logger.info(`[offline] cached ${rows.length} menu items`);
    } catch (e) {
        logger.warn('[offline] menu items prefetch failed', e);
    }
}

export async function getCachedMedications(): Promise<Record<string, unknown>[]> {
    return db.medications.toArray();
}

export async function getCachedRooms(): Promise<Record<string, unknown>[]> {
    return db.rooms.toArray();
}

export async function getCachedMenuItems(): Promise<Record<string, unknown>[]> {
    return db.menuItems.toArray();
}
