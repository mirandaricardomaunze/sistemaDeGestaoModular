import { PrismaClient } from '@prisma/client';

/**
 * Base Prisma client WITHOUT the tenant/audit extension.
 * Used exclusively by the audit worker to write audit logs
 * without triggering another audit log (infinite recursion prevention).
 */
export const basePrisma = new PrismaClient();
