import { Prisma } from '@prisma/client';
import { basePrisma } from '../../lib/prismaBase';
import type { TxClient } from '../helpers/withTestTx';

export type CashSessionOverrides = Partial<Prisma.CashSessionUncheckedCreateInput>;

export function buildCashSession(
    companyId: string,
    openedById: string,
    overrides: CashSessionOverrides = {},
): Prisma.CashSessionUncheckedCreateInput {
    return {
        openedById,
        openingBalance: new Prisma.Decimal(0),
        status: 'open',
        companyId,
        ...overrides,
    };
}

export async function createCashSession(
    companyId: string,
    openedById: string,
    overrides: CashSessionOverrides = {},
    client: TxClient | typeof basePrisma = basePrisma,
) {
    return client.cashSession.create({ data: buildCashSession(companyId, openedById, overrides) });
}
