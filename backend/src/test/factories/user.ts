import { Prisma } from '@prisma/client';
import { basePrisma } from '../../lib/prismaBase';
import type { TxClient } from '../helpers/withTestTx';

let seq = 0;

export type UserOverrides = Partial<Prisma.UserUncheckedCreateInput>;

export function buildUser(
    companyId: string,
    overrides: UserOverrides = {},
): Prisma.UserUncheckedCreateInput {
    const i = ++seq;
    return {
        email: `test-user-${Date.now()}-${i}@example.com`,
        password: 'hashed-test-password',
        name: `Test User ${i}`,
        role: 'admin',
        companyId,
        ...overrides,
    };
}

export async function createUser(
    companyId: string,
    overrides: UserOverrides = {},
    client: TxClient | typeof basePrisma = basePrisma,
) {
    return client.user.create({ data: buildUser(companyId, overrides) });
}
