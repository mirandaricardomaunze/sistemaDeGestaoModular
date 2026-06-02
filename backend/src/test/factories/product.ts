import { Prisma } from '@prisma/client';
import { basePrisma } from '../../lib/prismaBase';
import type { TxClient } from '../helpers/withTestTx';

let seq = 0;

export type ProductOverrides = Partial<Prisma.ProductUncheckedCreateInput>;

export function buildProduct(
    companyId: string,
    overrides: ProductOverrides = {},
): Prisma.ProductUncheckedCreateInput {
    const i = ++seq;
    return {
        name: `Test Product ${i}`,
        code: `P-${Date.now()}-${i}`,
        price: new Prisma.Decimal(100),
        costPrice: new Prisma.Decimal(60),
        currentStock: 0,
        packSize: 1,
        unit: 'un',
        originModule: 'commercial',
        category: 'other',
        companyId,
        ...overrides,
    };
}

export async function createProduct(
    companyId: string,
    overrides: ProductOverrides = {},
    client: TxClient | typeof basePrisma = basePrisma,
) {
    return client.product.create({ data: buildProduct(companyId, overrides) });
}
