import Dexie from 'dexie';
import { db, cryptoRandomId, type PendingSale } from '../../db/offlineDB';
import { logger } from '../../utils/logger';

const FLAG_KEY = 'offline_legacy_migrated_v1';
const LEGACY_DB_NAME = 'MulticoreOfflineDB';

interface LegacyQueueRow {
    id?: number;
    type?: string;
    data?: Record<string, unknown>;
    timestamp?: number;
    status?: string;
    attempts?: number;
    error?: string;
}

/**
 * One-shot migration of any leftover offline sales from the deprecated
 * MulticoreOfflineDB (services/offline/offlineDB.ts) into the canonical
 * OfflineDB. Without this, users with offline sales pending when this
 * release ships would never see them sync.
 */
export async function migrateLegacyOfflineDB(): Promise<void> {
    if (localStorage.getItem(FLAG_KEY) === '1') return;

    try {
        const exists = await Dexie.exists(LEGACY_DB_NAME);
        if (!exists) {
            localStorage.setItem(FLAG_KEY, '1');
            return;
        }

        const legacy = new Dexie(LEGACY_DB_NAME);
        legacy.version(1).stores({
            products: 'id, code, name, category',
            customers: 'id, name, phone, code',
            syncQueue: '++id, type, status, timestamp',
        });
        await legacy.open();

        const rows = await legacy.table<LegacyQueueRow>('syncQueue')
            .where('status').notEqual('done').toArray();

        let migrated = 0;
        for (const row of rows) {
            if (row.type !== 'SALE' || !row.data) continue;
            const sale: PendingSale = {
                clientId: cryptoRandomId(),
                data: row.data,
                timestamp: row.timestamp ?? Date.now(),
                status: 'pending',
                synced: false,
                attempts: 0,
                nextRetryAt: Date.now(),
                lastError: row.error,
            };
            await db.pendingSales.add(sale);
            migrated++;
        }

        legacy.close();
        await Dexie.delete(LEGACY_DB_NAME);

        if (migrated > 0) {
            logger.info(`[offline] migrated ${migrated} legacy sales from MulticoreOfflineDB`);
        }
        localStorage.setItem(FLAG_KEY, '1');
    } catch (e) {
        logger.warn('[offline] legacy DB migration failed', e);
    }
}
