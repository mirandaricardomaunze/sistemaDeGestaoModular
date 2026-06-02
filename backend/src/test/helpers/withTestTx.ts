import { PrismaClient } from '@prisma/client';
import { basePrisma } from '../../lib/prismaBase';
import { tenantContext, TenantContext } from '../../lib/context';

export type TxClient = Omit<
    PrismaClient,
    '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

const DEFAULT_TENANT: Required<TenantContext> = {
    companyId: 'test-company-id',
    userId: 'test-user-id',
    userName: 'Test User',
};

/**
 * Runs a test inside an interactive Prisma transaction and ALWAYS rolls back
 * at the end, so the database is left untouched.
 *
 * Uses `basePrisma` (no tenant extension) so the helper can seed cross-company
 * fixtures freely. The tenant context is still set via AsyncLocalStorage so
 * any code-under-test that goes through the extended `prisma` client (services,
 * routes) behaves as if it had a real authenticated request.
 *
 * NOTE: If the code-under-test opens its OWN interactive transaction via
 * `prisma.$transaction(...)`, that inner transaction is committed/rolled back
 * by the service itself — it is NOT nested in our test tx. For those tests,
 * use `withTestTenant` instead and clean up created rows explicitly, or rely
 * on a per-worker schema (see test-harness skill §10).
 */
export async function withTestTx<T>(
    fn: (tx: TxClient) => Promise<T>,
    tenant: Partial<TenantContext> = {},
): Promise<T> {
    const ctx = { ...DEFAULT_TENANT, ...tenant };
    const sentinel = Symbol('test-rollback');
    let value: T;

    try {
        await basePrisma.$transaction(async (tx) => {
            value = await tenantContext.run(ctx, () => fn(tx as TxClient));
            // Force rollback — Prisma rolls back when the callback throws.
            throw sentinel;
        }, { timeout: 30000, maxWait: 10000 });
    } catch (err) {
        if (err !== sentinel) throw err;
    }

    return value!;
}

/**
 * Runs a callback with a tenant context set, WITHOUT wrapping in a transaction.
 * Use for tests that exercise services which open their own internal
 * transactions (e.g. salesService.create). The caller is responsible for any
 * cleanup of rows created by the service.
 */
export function withTestTenant<T>(
    fn: () => Promise<T>,
    tenant: Partial<TenantContext> = {},
): Promise<T> {
    const ctx = { ...DEFAULT_TENANT, ...tenant };
    return tenantContext.run(ctx, fn);
}
