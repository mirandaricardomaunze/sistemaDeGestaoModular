import { Prisma } from '@prisma/client';
import { basePrisma } from '../../lib/prismaBase';
import type { TxClient } from '../helpers/withTestTx';

let seq = 0;
const nextSeq = () => ++seq;

export type CompanyOverrides = Partial<Prisma.CompanyUncheckedCreateInput>;

export function buildCompany(overrides: CompanyOverrides = {}): Prisma.CompanyUncheckedCreateInput {
    const i = nextSeq();
    return {
        name: `Test Co ${i}`,
        nuit: `TEST-NUIT-${Date.now()}-${i}`,
        ...overrides,
    };
}

export async function createCompany(
    overrides: CompanyOverrides = {},
    client: TxClient | typeof basePrisma = basePrisma,
) {
    return client.company.create({ data: buildCompany(overrides) });
}

export type CompanySettingsOverrides = Partial<Prisma.CompanySettingsUncheckedCreateInput>;

export function buildCompanySettings(
    companyId: string,
    overrides: CompanySettingsOverrides = {},
): Prisma.CompanySettingsUncheckedCreateInput {
    return {
        companyName: `Settings ${companyId.slice(0, 8)}`,
        ivaRate: new Prisma.Decimal(16),
        currency: 'MZN',
        companyId,
        ...overrides,
    };
}

export async function createCompanySettings(
    companyId: string,
    overrides: CompanySettingsOverrides = {},
    client: TxClient | typeof basePrisma = basePrisma,
) {
    return client.companySettings.create({ data: buildCompanySettings(companyId, overrides) });
}
