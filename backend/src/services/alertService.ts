import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { getPaginationParams, createPaginatedResponse } from '../utils/pagination';
import { logger } from '../utils/logger';
import { emailQueue, JOB_OPTIONS } from '../queues/emailQueue';

type AlertListQuery = {
    page?: string | number;
    limit?: string | number;
    module?: string;
    priority?: string;
    isRead?: string | boolean;
    isResolved?: string | boolean;
    type?: string;
};

async function enqueueToAdmins(companyId: string, jobName: string, buildData: (email: string, name: string) => Record<string, unknown>) {
    if (!emailQueue) return; // Redis not configured — skip silently
    const admins = await prisma.user.findMany({
        where: { companyId, role: { in: ['admin', 'manager'] }, isActive: true },
        select: { email: true, name: true }
    });
    for (const admin of admins.filter(a => a.email)) {
        await emailQueue.add(jobName, buildData(admin.email!, admin.name), JOB_OPTIONS).catch((err: unknown) => {
            logger.warn(`Email queue error — ${jobName} not enqueued`, { error: (err as Error).message });
        });
    }
}

export class AlertsService {
    async list(params: AlertListQuery, companyId: string) {
        const { page, limit, skip } = getPaginationParams(params);
        const { module, priority, isRead, isResolved, type } = params;

        const where: Prisma.AlertWhereInput = { companyId };
        if (module) where.module = module;
        if (priority) where.priority = priority as Prisma.AlertWhereInput['priority'];
        if (isRead !== undefined) where.isRead = isRead === 'true' || isRead === true;
        if (isResolved !== undefined) where.isResolved = isResolved === 'true' || isResolved === true;
        if (type) where.type = type as Prisma.AlertWhereInput['type'];

        const [total, alerts] = await Promise.all([
            prisma.alert.count({ where }),
            prisma.alert.findMany({
                where,
                orderBy: [{ isResolved: 'asc' }, { priority: 'asc' }, { createdAt: 'desc' }],
                skip,
                take: limit
            })
        ]);

        return createPaginatedResponse(alerts, page, limit, total);
    }

    async getUnreadCount(companyId: string, module?: string) {
        const where: Prisma.AlertWhereInput = {
            companyId,
            isRead: false,
            isResolved: false,
            ...(module ? { module } : {})
        };

        const [byPriorityRows, byModuleRows, total] = await Promise.all([
            prisma.alert.groupBy({ by: ['priority'], where, _count: { _all: true } }),
            prisma.alert.groupBy({ by: ['module'], where, _count: { _all: true } }),
            prisma.alert.count({ where })
        ]);

        const byPriority: Record<string, number> = {};
        for (const row of byPriorityRows) byPriority[row.priority] = row._count._all;

        const byModule: Record<string, number> = {};
        for (const row of byModuleRows) {
            if (row.module) byModule[row.module] = row._count._all;
        }

        return { total, byPriority, byModule };
    }

    async getSummary(companyId: string) {
        const [total, unread, critical, high, recentAlerts] = await Promise.all([
            prisma.alert.count({ where: { companyId, isResolved: false } }),
            prisma.alert.count({ where: { companyId, isRead: false, isResolved: false } }),
            prisma.alert.count({ where: { companyId, priority: 'critical', isResolved: false } }),
            prisma.alert.count({ where: { companyId, priority: 'high', isResolved: false } }),
            prisma.alert.findMany({
                where: { companyId, isResolved: false },
                orderBy: { createdAt: 'desc' },
                take: 5
            })
        ]);

        return { total, unread, critical, high, recentAlerts };
    }

    async markAsRead(id: string, companyId: string) {
        return prisma.alert.updateMany({
            where: { id, companyId },
            data: { isRead: true }
        });
    }

    async markAllAsRead(companyId: string, module?: string) {
        return prisma.alert.updateMany({
            where: {
                companyId,
                isRead: false,
                ...(module ? { module } : {})
            },
            data: { isRead: true }
        });
    }

    async resolve(id: string, companyId: string) {
        return prisma.alert.updateMany({
            where: { id, companyId },
            data: { isResolved: true, resolvedAt: new Date(), isRead: true }
        });
    }

    async delete(id: string, companyId: string) {
        return prisma.alert.deleteMany({
            where: { id, companyId }
        });
    }

    async clearResolved(companyId: string) {
        return prisma.alert.deleteMany({
            where: { companyId, isResolved: true }
        });
    }

    async create(companyId: string, data: {
        type: string;
        priority?: string;
        title: string;
        message: string;
        module?: string;
        relatedId?: string;
        relatedType?: string;
        actionUrl?: string;
        metadata?: Record<string, unknown>;
    }) {
        return prisma.alert.create({
            data: {
                type: data.type as Prisma.AlertUncheckedCreateInput['type'],
                priority: (data.priority ?? 'medium') as Prisma.AlertUncheckedCreateInput['priority'],
                title: data.title,
                message: data.message,
                module: data.module,
                relatedId: data.relatedId,
                relatedType: data.relatedType,
                actionUrl: data.actionUrl,
                metadata: data.metadata,
                companyId
            }
        });
    }

    private async getActiveModuleCodes(companyId: string): Promise<Set<string>> {
        const mods = await prisma.companyModule.findMany({
            where: { companyId, isActive: true },
            select: { moduleCode: true }
        });
        return new Set(mods.map(m => m.moduleCode.toUpperCase()));
    }

    async generate(companyId: string, module?: string) {
        try {
            const [config, activeModules] = await Promise.all([
                prisma.alertConfig.findFirst({ where: { companyId } }).then(c => c ?? {
                    lowStockThreshold: 10,
                    expiryWarningDays: 30
                }),
                this.getActiveModuleCodes(companyId)
            ]);

            const now = new Date();
            let createdCount = 0;

            // --- Stock alerts (inventory, pharmacy, pos, bottlestore) ---
            // Only run if the company has at least one product-carrying module active
            const hasProductModule = activeModules.has('COMMERCIAL') || activeModules.has('PHARMACY') ||
                activeModules.has('BOTTLE_STORE') || activeModules.has('RESTAURANT') ||
                activeModules.size === 0; // fallback: no optional modules yet (new company)

            if (hasProductModule && (!module || ['inventory', 'pharmacy', 'pos', 'bottlestore'].includes(module))) {
                const alertModule = module ?? 'inventory';

                const warehouses = await prisma.warehouse.findMany({
                    where: { companyId, isActive: true },
                    select: { id: true, name: true }
                });
                const warehouseIds = warehouses.map(w => w.id);

                const [outOfStockWs, lowStockWs, existingStockAlerts] = await Promise.all([
                    prisma.warehouseStock.findMany({
                        where: { warehouseId: { in: warehouseIds }, quantity: 0, product: { companyId, isActive: true } },
                        select: { warehouseId: true, quantity: true, product: { select: { id: true, name: true, code: true } } }
                    }),
                    prisma.warehouseStock.findMany({
                        where: { warehouseId: { in: warehouseIds }, quantity: { gt: 0, lte: config.lowStockThreshold }, product: { companyId, isActive: true } },
                        select: { warehouseId: true, quantity: true, product: { select: { id: true, name: true, code: true } } }
                    }),
                    prisma.alert.findMany({
                        where: { companyId, type: { in: ['out_of_stock', 'low_stock'] }, isResolved: false },
                        select: { type: true, relatedId: true, metadata: true }
                    })
                ]);

                const warehouseNameById = new Map(warehouses.map(w => [w.id, w.name]));
                // Build O(1) lookup so we skip duplicates without per-item findFirst.
                const existingKey = (type: string, productId: string, warehouseId: string) => `${type}|${productId}|${warehouseId}`;
                const existing = new Set<string>();
                for (const a of existingStockAlerts) {
                    if (!a.relatedId) continue;
                    const meta = a.metadata as { warehouseId?: string } | null;
                    if (!meta?.warehouseId) continue;
                    existing.add(existingKey(a.type, a.relatedId, meta.warehouseId));
                }

                const toCreate: Prisma.AlertUncheckedCreateInput[] = [];
                const emailJobs: Array<() => Promise<void>> = [];

                for (const ws of outOfStockWs) {
                    const warehouseName = warehouseNameById.get(ws.warehouseId) ?? '';
                    if (existing.has(existingKey('out_of_stock', ws.product.id, ws.warehouseId))) continue;
                    toCreate.push({
                        type: 'out_of_stock', priority: 'critical',
                        title: `Produto sem stock - ${warehouseName}`,
                        message: `"${ws.product.name}" (${ws.product.code}) está sem stock no armazém ${warehouseName}.`,
                        module: alertModule, relatedId: ws.product.id, relatedType: 'product',
                        actionUrl: `/products/${ws.product.id}`, companyId,
                        metadata: { warehouseId: ws.warehouseId }
                    });
                    emailJobs.push(() => enqueueToAdmins(companyId, 'stock-alert', (email, userName) => ({
                        email, userName, productName: ws.product.name, warehouseName,
                        currentStock: ws.quantity, threshold: config.lowStockThreshold, type: 'out_of_stock'
                    })));
                }

                for (const ws of lowStockWs) {
                    const warehouseName = warehouseNameById.get(ws.warehouseId) ?? '';
                    if (existing.has(existingKey('low_stock', ws.product.id, ws.warehouseId))) continue;
                    toCreate.push({
                        type: 'low_stock', priority: 'high',
                        title: `Stock baixo - ${warehouseName}`,
                        message: `"${ws.product.name}" tem apenas ${ws.quantity} unidade(s) no armazém ${warehouseName}.`,
                        module: alertModule, relatedId: ws.product.id, relatedType: 'product',
                        actionUrl: `/products/${ws.product.id}`, companyId,
                        metadata: { warehouseId: ws.warehouseId }
                    });
                    emailJobs.push(() => enqueueToAdmins(companyId, 'stock-alert', (email, userName) => ({
                        email, userName, productName: ws.product.name, warehouseName,
                        currentStock: ws.quantity, threshold: config.lowStockThreshold, type: 'low_stock'
                    })));
                }

                if (toCreate.length > 0) {
                    await prisma.alert.createMany({ data: toCreate });
                    createdCount += toCreate.length;
                    await Promise.all(emailJobs.map(job => job()));
                }
            }

            // --- Expiry alerts (pharmacy, inventory) ---
            if (!module || ['pharmacy', 'inventory'].includes(module)) {
                const expiryWarning = new Date();
                expiryWarning.setDate(expiryWarning.getDate() + config.expiryWarningDays);
                const expiryModule = module ?? 'pharmacy';
                const hasPharmacy = activeModules.has('PHARMACY');

                const [expiredBatchesInv, expiringSoonBatchesInv, expiredMedBatches, expiringMedBatches, existingExpiryAlerts] = await Promise.all([
                    prisma.productBatch.findMany({
                        where: { companyId, quantity: { gt: 0 }, expiryDate: { lt: now }, product: { isActive: true } },
                        select: { id: true, batchNumber: true, expiryDate: true, product: { select: { name: true } } }
                    }),
                    prisma.productBatch.findMany({
                        where: { companyId, quantity: { gt: 0 }, expiryDate: { gte: now, lte: expiryWarning }, product: { isActive: true } },
                        select: { id: true, batchNumber: true, expiryDate: true, product: { select: { name: true } } }
                    }),
                    hasPharmacy ? prisma.medicationBatch.findMany({
                        where: { companyId, status: 'active', quantityAvailable: { gt: 0 }, expiryDate: { lt: now } },
                        select: { id: true, batchNumber: true, expiryDate: true, medication: { select: { product: { select: { name: true } } } } }
                    }) : Promise.resolve([]),
                    hasPharmacy ? prisma.medicationBatch.findMany({
                        where: { companyId, status: 'active', quantityAvailable: { gt: 0 }, expiryDate: { gte: now, lte: expiryWarning } },
                        select: { id: true, batchNumber: true, expiryDate: true, medication: { select: { product: { select: { name: true } } } } }
                    }) : Promise.resolve([]),
                    prisma.alert.findMany({
                        where: { companyId, type: { in: ['expired_product', 'expiring_soon'] }, isResolved: false },
                        select: { type: true, relatedId: true }
                    })
                ]);

                const expiryExisting = new Set<string>();
                for (const a of existingExpiryAlerts) {
                    if (a.relatedId) expiryExisting.add(`${a.type}|${a.relatedId}`);
                }

                const toCreate: Prisma.AlertUncheckedCreateInput[] = [];

                for (const b of expiredBatchesInv) {
                    if (expiryExisting.has(`expired_product|${b.id}`)) continue;
                    toCreate.push({
                        type: 'expired_product', priority: 'critical',
                        title: 'Lote expirado',
                        message: `"${b.product.name}" (Lote: ${b.batchNumber}) expirou em ${b.expiryDate!.toLocaleDateString('pt-BR')}.`,
                        module: expiryModule, relatedId: b.id, relatedType: 'product_batch', companyId
                    });
                }

                for (const b of expiringSoonBatchesInv) {
                    if (expiryExisting.has(`expiring_soon|${b.id}`)) continue;
                    const daysLeft = Math.ceil((b.expiryDate!.getTime() - now.getTime()) / 86400000);
                    toCreate.push({
                        type: 'expiring_soon', priority: 'high',
                        title: 'Lote a expirar',
                        message: `"${b.product.name}" (Lote: ${b.batchNumber}) expira em ${daysLeft} dia(s) (${b.expiryDate!.toLocaleDateString('pt-BR')}).`,
                        module: expiryModule, relatedId: b.id, relatedType: 'product_batch', companyId
                    });
                }

                for (const batch of expiredMedBatches) {
                    if (expiryExisting.has(`expired_product|${batch.id}`)) continue;
                    toCreate.push({
                        type: 'expired_product', priority: 'critical',
                        title: 'Lote de Medicamento expirado',
                        message: `Lote ${batch.batchNumber} de "${batch.medication.product.name}" expirou em ${batch.expiryDate.toLocaleDateString('pt-BR')}.`,
                        module: 'pharmacy', relatedId: batch.id, relatedType: 'medication_batch', companyId
                    });
                }

                for (const batch of expiringMedBatches) {
                    if (expiryExisting.has(`expiring_soon|${batch.id}`)) continue;
                    toCreate.push({
                        type: 'expiring_soon', priority: 'high',
                        title: 'Lote de Medicamento a expirar',
                        message: `Lote ${batch.batchNumber} de "${batch.medication.product.name}" expira em ${batch.expiryDate.toLocaleDateString('pt-BR')}.`,
                        module: 'pharmacy', relatedId: batch.id, relatedType: 'medication_batch', companyId
                    });
                }

                if (toCreate.length > 0) {
                    await prisma.alert.createMany({ data: toCreate });
                    createdCount += toCreate.length;
                }
            }

            logger.info(`Generated ${createdCount} alerts for company ${companyId}${module ? ` (module: ${module})` : ''}`);
            return { created: createdCount, message: `${createdCount} alerta(s) criado(s)` };
        } catch (error) {
            logger.error('Error generating alerts:', { error, companyId, module });
            throw error;
        }
    }
}

export const alertsService = new AlertsService();

export const checkExpiringBatches = async () => {
    logger.info('Checking batches expiring in 7 days');

    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    sevenDaysFromNow.setHours(23, 59, 59, 999);

    try {
        const expiringBatches = await prisma.productBatch.findMany({
            where: {
                expiryDate: { gte: now, lte: sevenDaysFromNow },
                quantity: { gt: 0 }
            },
            include: {
                product: { select: { name: true } },
                company: true
            }
        });

        if (expiringBatches.length === 0) return;

        logger.info(`Found ${expiringBatches.length} product batches expiring in 7 days`);

        for (const b of expiringBatches) {
            if (!b.companyId) continue;
            await enqueueToAdmins(b.companyId, 'expiration-alert', (email, userName) => ({
                email, userName,
                productName: b.product.name,
                batchNumber: b.batchNumber,
                expiryDate: b.expiryDate,
                currentStock: b.quantity,
            }));
        }
    } catch (error) {
        logger.error('Error checking expiring batches', { error });
    }
};
