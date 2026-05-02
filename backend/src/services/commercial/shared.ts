import { cacheService } from '../cacheService';

export const UNCATEGORISED = 'Sem Categoria';
export const DEFAULT_IVA_RATE = 0.16;

export function round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function calcMargin(revenue: number, cogs: number): number {
    return revenue > 0 ? round2(((revenue - cogs) / revenue) * 100) : 0;
}

export function daysAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}

export function monthStart(offset = 0): Date {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth() + offset, 1);
}

export function monthEnd(offset = 0): Date {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth() + offset + 1, 0);
}

// Invalidate every cache key tied to the commercial module for a company.
// Called whenever stock, POs, quotations or invoices change.
export function invalidateCommercialCache(companyId: string): void {
    cacheService.invalidatePattern(`commercial:analytics:${companyId}`);
    cacheService.invalidatePattern(`commercial:margins:${companyId}`);
    cacheService.invalidatePattern(`commercial:stock-aging:${companyId}`);
    cacheService.invalidatePattern(`commercial:inventory-turnover:${companyId}`);
    cacheService.invalidatePattern(`commercial:sales-report:${companyId}`);
    cacheService.invalidatePattern(`commercial:supplier-performance:${companyId}`);
    cacheService.invalidatePattern(`commercial:warehouse-distribution:${companyId}`);
}

// Retry an operation when a sequence-like unique key collides under concurrency
// (e.g. two transactions generating the same orderNumber/invoiceNumber).
export async function withSequenceRetry<T>(op: () => Promise<T>, maxAttempts = 5): Promise<T> {
    let lastErr: unknown;
    for (let i = 0; i < maxAttempts; i++) {
        try {
            return await op();
        } catch (err: any) {
            const isUniqueViolation = err?.code === 'P2002';
            if (!isUniqueViolation) throw err;
            lastErr = err;
            // Small jittered backoff to spread out colliders
            await new Promise(r => setTimeout(r, 10 + Math.random() * 30));
        }
    }
    throw lastErr;
}
