import { prisma } from '../../lib/prisma';
import type { ApprovalThresholds } from '../../validation/approvals';

const cache = new Map<string, { thresholds: ApprovalThresholds; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

export function invalidateThresholdsCache(companyId: string): void {
    cache.delete(companyId);
}

async function loadThresholds(companyId: string): Promise<ApprovalThresholds> {
    const cached = cache.get(companyId);
    const now = Date.now();
    if (cached && cached.expiresAt > now) return cached.thresholds;

    const settings = await prisma.companySettings.findUnique({
        where: { companyId },
        select: { approvalThresholds: true },
    });
    const thresholds = (settings?.approvalThresholds as ApprovalThresholds | null) ?? {};
    cache.set(companyId, { thresholds, expiresAt: now + CACHE_TTL_MS });
    return thresholds;
}

export async function getThresholds(companyId: string): Promise<ApprovalThresholds> {
    return loadThresholds(companyId);
}

// True when a configured threshold exists AND `value` exceeds it.
// Pure helper — does not throw, does not call DB. Must be called
// after `getThresholds` to avoid duplicate DB hits inside transactions.
export function isOverThreshold(
    thresholds: ApprovalThresholds,
    key: keyof ApprovalThresholds,
    value: number,
): boolean {
    const limit = thresholds[key];
    if (limit === undefined || limit === null) return false;
    return value > Number(limit);
}

export async function requiresApproval(
    companyId: string,
    key: keyof ApprovalThresholds,
    value: number,
): Promise<boolean> {
    const thresholds = await loadThresholds(companyId);
    return isOverThreshold(thresholds, key, value);
}
