import { db, cryptoRandomId, type PendingOperation, type PendingSale } from '../../db/offlineDB';

export const IDEMPOTENCY_HEADER = 'X-Client-Operation-Id';

export interface EnqueueOperationInput {
    module: string;
    endpoint: string;
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    data: Record<string, unknown> | null;
    priority?: number;
    clientId?: string;
}

export async function enqueueOperation(input: EnqueueOperationInput): Promise<PendingOperation> {
    const now = Date.now();
    const op: PendingOperation = {
        clientId: input.clientId ?? cryptoRandomId(),
        module: input.module,
        endpoint: input.endpoint,
        method: input.method,
        data: input.data,
        timestamp: now,
        status: 'pending',
        synced: false,
        attempts: 0,
        nextRetryAt: now,
        priority: input.priority ?? 0,
    };
    const id = await db.pendingOperations.add(op);
    return { ...op, id: id as number };
}

export async function enqueueSale(data: Record<string, unknown>, clientId?: string): Promise<PendingSale> {
    const now = Date.now();
    const sale: PendingSale = {
        clientId: clientId ?? cryptoRandomId(),
        data,
        timestamp: now,
        status: 'pending',
        synced: false,
        attempts: 0,
        nextRetryAt: now,
    };
    const id = await db.pendingSales.add(sale);
    return { ...sale, id: id as number };
}

export async function pendingCounts() {
    const [salesPending, opsPending, salesFailed, opsFailed] = await Promise.all([
        db.pendingSales.where('status').equals('pending').count(),
        db.pendingOperations.where('status').equals('pending').count(),
        db.pendingSales.where('status').equals('failed').count(),
        db.pendingOperations.where('status').equals('failed').count(),
    ]);
    return {
        pending: salesPending + opsPending,
        failed: salesFailed + opsFailed,
        total: salesPending + opsPending + salesFailed + opsFailed,
    };
}

export async function purgeSynced(): Promise<number> {
    const [a, b] = await Promise.all([
        db.pendingSales.where('status').equals('done').delete(),
        db.pendingOperations.where('status').equals('done').delete(),
    ]);
    return a + b;
}

export async function retryFailed(): Promise<number> {
    const now = Date.now();
    const [a, b] = await Promise.all([
        db.pendingSales
            .where('status')
            .equals('failed')
            .modify((row: PendingSale | PendingOperation) => {
                row.status = 'pending';
                row.attempts = 0;
                row.nextRetryAt = now;
                row.lastError = undefined;
            }),
        db.pendingOperations
            .where('status')
            .equals('failed')
            .modify((row: PendingSale | PendingOperation) => {
                row.status = 'pending';
                row.attempts = 0;
                row.nextRetryAt = now;
                row.lastError = undefined;
            }),
    ]);
    return a + b;
}

export async function discardFailed(): Promise<number> {
    const [a, b] = await Promise.all([
        db.pendingSales.where('status').equals('failed').delete(),
        db.pendingOperations.where('status').equals('failed').delete(),
    ]);
    return a + b;
}
