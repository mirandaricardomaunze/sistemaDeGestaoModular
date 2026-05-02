import Dexie, { type Table } from 'dexie';
import type { Product, Customer } from '../types/index';

export type SyncStatus = 'pending' | 'syncing' | 'failed' | 'done';

export interface PendingSale {
    id?: number;
    clientId: string;          // idempotency key
    data: any;                 // Sale creation data
    timestamp: number;
    status: SyncStatus;
    synced: boolean;           // legacy mirror of status === 'done'
    attempts: number;
    nextRetryAt: number;       // epoch ms; when to next try
    lastError?: string;
}

export interface PendingOperation {
    id?: number;
    clientId: string;          // idempotency key
    module: string;
    endpoint: string;
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    data: any;
    timestamp: number;
    status: SyncStatus;
    synced: boolean;           // legacy mirror of status === 'done'
    attempts: number;
    nextRetryAt: number;
    lastError?: string;
    priority?: number;
}

export interface CatalogMeta {
    key: string;               // 'products' | 'customers' | ...
    lastSyncedAt: number;
    count: number;
}

export class OfflineDB extends Dexie {
    pendingSales!: Table<PendingSale>;
    pendingOperations!: Table<PendingOperation>;
    products!: Table<Product>;
    customers!: Table<Customer>;
    medications!: Table<any>;
    rooms!: Table<any>;
    catalogMeta!: Table<CatalogMeta>;

    constructor() {
        super('OfflineDB');

        // v3 — legacy schema
        this.version(3).stores({
            pendingSales: '++id, timestamp, synced',
            pendingOperations: '++id, module, method, synced, timestamp',
            products: 'id, name, code, category',
            customers: 'id, name, phone, document',
            medications: 'id, name, registrationNumber',
            rooms: 'id, number, type',
        });

        // v4 — adds status/attempts/nextRetryAt/clientId + catalog meta
        this.version(4)
            .stores({
                pendingSales: '++id, clientId, status, timestamp, nextRetryAt, synced',
                pendingOperations: '++id, clientId, module, method, status, timestamp, nextRetryAt, synced',
                products: 'id, name, code, category',
                customers: 'id, name, phone, document',
                medications: 'id, name, registrationNumber',
                rooms: 'id, number, type',
                catalogMeta: 'key, lastSyncedAt',
            })
            .upgrade(async (tx) => {
                const now = Date.now();
                await tx.table('pendingSales').toCollection().modify((row: any) => {
                    row.clientId = row.clientId ?? cryptoRandomId();
                    row.status = row.synced ? 'done' : (row.error ? 'failed' : 'pending');
                    row.attempts = row.attempts ?? 0;
                    row.nextRetryAt = row.nextRetryAt ?? now;
                    if (row.error && !row.lastError) row.lastError = row.error;
                });
                await tx.table('pendingOperations').toCollection().modify((row: any) => {
                    row.clientId = row.clientId ?? cryptoRandomId();
                    row.status = row.synced ? 'done' : (row.error ? 'failed' : 'pending');
                    row.attempts = row.attempts ?? 0;
                    row.nextRetryAt = row.nextRetryAt ?? now;
                    if (row.error && !row.lastError) row.lastError = row.error;
                });
            });
    }
}

export const db = new OfflineDB();

export function cryptoRandomId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Exponential backoff with jitter. Caps at 5 minutes.
export function computeNextRetry(attempts: number): number {
    const baseMs = 1000;          // 1s
    const capMs = 5 * 60 * 1000;  // 5 min
    const exp = Math.min(capMs, baseMs * Math.pow(2, attempts));
    const jitter = Math.random() * 0.3 * exp;
    return Date.now() + exp + jitter;
}

export const MAX_SYNC_ATTEMPTS = 10;
