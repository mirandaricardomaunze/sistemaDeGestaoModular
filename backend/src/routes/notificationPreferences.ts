/**
 * Notification Preferences API
 *
 * Per-role config for what alert types go to the bell vs the email digest.
 * Admin-only writes; reads available to all authenticated users so the
 * Settings page can render the matrix even for non-admins (read-only view).
 *
 * See [[audit-alerts]] skill.
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/error.middleware';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

const router = Router();

const ROLES = ['super_admin', 'admin', 'manager', 'operator', 'cashier', 'stock_keeper'] as const;
const MODULES = ['audit', 'invoices', 'inventory', 'pharmacy', 'hospitality', 'crm', 'pos', 'general'] as const;
const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

const upsertSchema = z.array(z.object({
    role: z.enum(ROLES),
    module: z.enum(MODULES),
    alertType: z.string().nullable().optional(),
    inCenter: z.boolean(),
    inEmail: z.boolean(),
    minPriority: z.enum(PRIORITIES),
}));

// Default seeds — applied per company on first read if no rows exist.
// Audit alerts: admins/managers get the works; operators only see their own scope.
const DEFAULT_SEEDS: Array<{ role: string; module: string; alertType: string | null; inCenter: boolean; inEmail: boolean; minPriority: string }> = [
    // Audit module — full visibility for leadership
    { role: 'super_admin', module: 'audit', alertType: null, inCenter: true, inEmail: true, minPriority: 'medium' },
    { role: 'admin', module: 'audit', alertType: null, inCenter: true, inEmail: true, minPriority: 'medium' },
    { role: 'manager', module: 'audit', alertType: null, inCenter: true, inEmail: true, minPriority: 'high' },
    // Operators only see operational risks they can act on
    { role: 'operator', module: 'audit', alertType: null, inCenter: true, inEmail: false, minPriority: 'high' },
    { role: 'cashier', module: 'audit', alertType: null, inCenter: true, inEmail: false, minPriority: 'high' },
    { role: 'stock_keeper', module: 'audit', alertType: null, inCenter: true, inEmail: false, minPriority: 'medium' },
];

async function seedDefaultsIfEmpty(companyId: string): Promise<void> {
    const existing = await prisma.notificationPreference.count({ where: { companyId } });
    if (existing > 0) return;
    await prisma.notificationPreference.createMany({
        data: DEFAULT_SEEDS.map(s => ({ ...s, companyId })),
        skipDuplicates: true,
    });
    logger.info('notificationPreferences: seeded defaults', { companyId, count: DEFAULT_SEEDS.length });
}

function requireAdmin(req: AuthRequest): void {
    const role = (req.userRole || '').toLowerCase();
    if (role !== 'admin' && role !== 'super_admin') {
        throw ApiError.forbidden('Apenas administradores podem alterar preferências de notificação');
    }
}

router.get('/', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    await seedDefaultsIfEmpty(req.companyId);
    const prefs = await prisma.notificationPreference.findMany({
        where: { companyId: req.companyId },
        orderBy: [{ module: 'asc' }, { role: 'asc' }],
    });
    res.json({ data: prefs, roles: ROLES, modules: MODULES, priorities: PRIORITIES });
});

router.put('/', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    requireAdmin(req);

    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) {
        throw ApiError.badRequest(`Dados inválidos: ${parsed.error.issues.map(i => i.message).join(', ')}`);
    }

    const companyId = req.companyId;
    // Manual upsert via findFirst + update/create — Prisma's typed `upsert`
    // doesn't accept `null` in a compound unique constraint key, even when
    // the field is marked optional in the schema. We pay one extra query per
    // row, but the matrix is small (≤48 rows = 8 modules × 6 roles).
    const results = await prisma.$transaction(async (tx) => {
        const updates: { id: string }[] = [];
        for (const p of parsed.data) {
            const existing = await tx.notificationPreference.findFirst({
                where: {
                    companyId,
                    role: p.role,
                    module: p.module,
                    alertType: p.alertType ?? null,
                },
                select: { id: true },
            });
            if (existing) {
                const updated = await tx.notificationPreference.update({
                    where: { id: existing.id },
                    data: { inCenter: p.inCenter, inEmail: p.inEmail, minPriority: p.minPriority },
                    select: { id: true },
                });
                updates.push(updated);
            } else {
                const created = await tx.notificationPreference.create({
                    data: {
                        companyId,
                        role: p.role,
                        module: p.module,
                        alertType: p.alertType ?? null,
                        inCenter: p.inCenter,
                        inEmail: p.inEmail,
                        minPriority: p.minPriority,
                    },
                    select: { id: true },
                });
                updates.push(created);
            }
        }
        return updates;
    });
    res.json({ updated: results.length });
});

router.post('/reset', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    requireAdmin(req);
    await prisma.notificationPreference.deleteMany({ where: { companyId: req.companyId } });
    await seedDefaultsIfEmpty(req.companyId);
    const prefs = await prisma.notificationPreference.findMany({
        where: { companyId: req.companyId },
        orderBy: [{ module: 'asc' }, { role: 'asc' }],
    });
    res.json({ data: prefs, reset: true });
});

export default router;
