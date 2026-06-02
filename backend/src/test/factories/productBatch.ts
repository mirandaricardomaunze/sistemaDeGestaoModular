import { Prisma } from '@prisma/client';
import { basePrisma } from '../../lib/prismaBase';
import type { TxClient } from '../helpers/withTestTx';

let seq = 0;

export type ProductBatchOverrides = Partial<Prisma.ProductBatchUncheckedCreateInput>;

export function buildProductBatch(
    companyId: string,
    productId: string,
    overrides: ProductBatchOverrides = {},
): Prisma.ProductBatchUncheckedCreateInput {
    const i = ++seq;
    const qty = overrides.quantity ?? 10;
    return {
        batchNumber: `LOTE-${Date.now()}-${i}`,
        productId,
        companyId,
        initialQuantity: qty,
        quantity: qty,
        costPrice: new Prisma.Decimal(50),
        receivedDate: new Date(),
        status: 'active',
        ...overrides,
    };
}

export async function createProductBatch(
    companyId: string,
    productId: string,
    overrides: ProductBatchOverrides = {},
    client: TxClient | typeof basePrisma = basePrisma,
) {
    return client.productBatch.create({ data: buildProductBatch(companyId, productId, overrides) });
}

/**
 * Creates a series of batches with staggered expiry dates, oldest first.
 * Useful for FEFO test scenarios.
 *
 * Example:
 *   createBatchSeries(companyId, productId, [
 *     { daysUntilExpiry: 10, quantity: 5 },
 *     { daysUntilExpiry: 60, quantity: 10 },
 *     { daysUntilExpiry: 120, quantity: 20 },
 *   ])
 */
export async function createBatchSeries(
    companyId: string,
    productId: string,
    specs: Array<{ daysUntilExpiry: number | null; quantity: number; batchNumber?: string }>,
    client: TxClient | typeof basePrisma = basePrisma,
) {
    const now = Date.now();
    return Promise.all(
        specs.map((spec, i) => {
            const expiryDate = spec.daysUntilExpiry === null
                ? null
                : new Date(now + spec.daysUntilExpiry * 24 * 60 * 60 * 1000);
            return createProductBatch(
                companyId,
                productId,
                {
                    batchNumber: spec.batchNumber ?? `LOTE-${now}-${i}`,
                    quantity: spec.quantity,
                    initialQuantity: spec.quantity,
                    expiryDate,
                },
                client,
            );
        }),
    );
}
