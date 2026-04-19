import { prisma } from '../lib/prisma';
import { Queue } from 'bullmq';
import { connection } from '../config/redis';
import { getPaginationParams, createPaginatedResponse } from '../utils/pagination';
import { logger } from '../utils/logger';

// Lazy-initialize the email queue so the server can start without Redis
let emailQueue: Queue | null = null;
function getEmailQueue(): Queue | null {
    if (!emailQueue) {
        try {
            emailQueue = new Queue('email-queue', { connection });
        } catch (err) {
            logger.warn('BullMQ email queue unavailable -- Redis not connected');
        }
    }
    return emailQueue;
}

export class AlertsService {
    async list(params: any, companyId: string) {
        const { page, limit, skip } = getPaginationParams(params);
        const { module, priority, isRead, isResolved, type } = params;

        const where: any = { companyId };
        if (module) where.module = module;
        if (priority) where.priority = priority;
        if (isRead !== undefined) where.isRead = isRead === 'true';
        if (isResolved !== undefined) where.isResolved = isResolved === 'true';
        if (type) where.type = type;

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
        const unreadAlerts = await prisma.alert.findMany({
            where: {
                companyId,
                isRead: false,
                isResolved: false,
                ...(module ? { module } : {})
            }
        });

        const byPriority: Record<string, number> = {};
        const byModule: Record<string, number> = {};

        unreadAlerts.forEach(alert => {
            byPriority[alert.priority] = (byPriority[alert.priority] || 0) + 1;
            if (alert.module) {
                byModule[alert.module] = (byModule[alert.module] || 0) + 1;
            }
        });

        return {
            total: unreadAlerts.length,
            byPriority,
            byModule
        };
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
                type: data.type as any,
                priority: (data.priority ?? 'medium') as any,
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

    async generate(companyId: string, module?: string) {
        const config = await prisma.alertConfig.findFirst({ where: { companyId } }) ?? {
            lowStockThreshold: 10,
            expiryWarningDays: 30
        };

        const now = new Date();
        let createdCount = 0;

        // --- Stock alerts (inventory, pharmacy, pos, bottlestore) ---
        if (!module || ['inventory', 'pharmacy', 'pos', 'bottlestore'].includes(module)) {
            const alertModule = module ?? 'inventory';

            // Get all warehouses to check them individually
            const warehouses = await prisma.warehouse.findMany({ where: { companyId, isActive: true } });

            for (const warehouse of warehouses) {
                // Out of stock in this warehouse
                const outOfStockWs = await prisma.warehouseStock.findMany({
                    where: { 
                        warehouseId: warehouse.id, 
                        quantity: 0, 
                        product: { companyId, isActive: true } 
                    },
                    include: { product: { select: { id: true, name: true, code: true } } }
                });

                for (const ws of outOfStockWs) {
                    const exists = await prisma.alert.findFirst({
                        where: { 
                            companyId, 
                            type: 'out_of_stock', 
                            relatedId: ws.product.id, 
                            isResolved: false,
                            metadata: { path: ['warehouseId'], equals: warehouse.id }
                        }
                    });

                    if (!exists) {
                        await prisma.alert.create({
                            data: {
                                type: 'out_of_stock', priority: 'critical',
                                title: `Produto sem stock - ${warehouse.name}`,
                                message: `"${ws.product.name}" (${ws.product.code}) está sem stock no armazém ${warehouse.name}.`,
                                module: alertModule, relatedId: ws.product.id, relatedType: 'product',
                                actionUrl: `/products/${ws.product.id}`, companyId,
                                metadata: { warehouseId: warehouse.id }
                            }
                        });
                        createdCount++;
                    }
                }

                // Low stock in this warehouse
                const lowStockWs = await prisma.warehouseStock.findMany({
                    where: { 
                        warehouseId: warehouse.id, 
                        quantity: { gt: 0, lte: config.lowStockThreshold },
                        product: { companyId, isActive: true } 
                    },
                    include: { product: { select: { id: true, name: true, code: true } } }
                });

                for (const ws of lowStockWs) {
                    const exists = await prisma.alert.findFirst({
                        where: { 
                            companyId, 
                            type: 'low_stock', 
                            relatedId: ws.product.id, 
                            isResolved: false,
                            metadata: { path: ['warehouseId'], equals: warehouse.id }
                        }
                    });

                    if (!exists) {
                        await prisma.alert.create({
                            data: {
                                type: 'low_stock', priority: 'high',
                                title: `Stock baixo - ${warehouse.name}`,
                                message: `"${ws.product.name}" tem apenas ${ws.quantity} unidade(s) no armazém ${warehouse.name}.`,
                                module: alertModule, relatedId: ws.product.id, relatedType: 'product',
                                actionUrl: `/products/${ws.product.id}`, companyId,
                                metadata: { warehouseId: warehouse.id }
                            }
                        });
                        createdCount++;
                    }
                }
            }
        }

        // --- Expiry alerts (pharmacy, inventory) ---
        if (!module || ['pharmacy', 'inventory'].includes(module)) {
            const expiryWarning = new Date();
            expiryWarning.setDate(expiryWarning.getDate() + config.expiryWarningDays);
            const expiryModule = module ?? 'pharmacy';

            // 1. ProductBatch -- expired lotes (inventory / commercial)
            const expiredBatchesInv = await prisma.productBatch.findMany({
                where: { companyId, quantity: { gt: 0 }, expiryDate: { lt: now } },
                include: { product: { select: { id: true, name: true, isActive: true } } }
            });
            for (const b of expiredBatchesInv) {
                if (!b.product.isActive) continue;
                const exists = await prisma.alert.findFirst({
                    where: { companyId, type: 'expired_product', relatedId: b.id, isResolved: false }
                });
                if (!exists) {
                    await prisma.alert.create({
                        data: {
                            type: 'expired_product', priority: 'critical',
                            title: 'Lote expirado',
                            message: `"${b.product.name}" (Lote: ${b.batchNumber}) expirou em ${b.expiryDate!.toLocaleDateString('pt-BR')}.`,
                            module: expiryModule, relatedId: b.id, relatedType: 'product_batch', companyId
                        }
                    });
                    createdCount++;
                }
            }

            // 2. ProductBatch -- expiring soon lotes (inventory / commercial)
            const expiringSoonBatchesInv = await prisma.productBatch.findMany({
                where: { companyId, quantity: { gt: 0 }, expiryDate: { gte: now, lte: expiryWarning } },
                include: { product: { select: { id: true, name: true, isActive: true } } }
            });
            for (const b of expiringSoonBatchesInv) {
                if (!b.product.isActive) continue;
                const exists = await prisma.alert.findFirst({
                    where: { companyId, type: 'expiring_soon', relatedId: b.id, isResolved: false }
                });
                if (!exists) {
                    const daysLeft = Math.ceil((b.expiryDate!.getTime() - now.getTime()) / 86400000);
                    await prisma.alert.create({
                        data: {
                            type: 'expiring_soon', priority: 'high',
                            title: 'Lote a expirar',
                            message: `"${b.product.name}" (Lote: ${b.batchNumber}) expira em ${daysLeft} dia(s) (${b.expiryDate!.toLocaleDateString('pt-BR')}).`,
                            module: expiryModule, relatedId: b.id, relatedType: 'product_batch', companyId
                        }
                    });
                    createdCount++;
                }
            }

            // 3. Medication Batches Expiry (Pharmacy specific)
            const expiredBatches = await prisma.medicationBatch.findMany({
                where: { companyId, status: 'active', quantityAvailable: { gt: 0 }, expiryDate: { lt: now } },
                include: { medication: { include: { product: { select: { name: true } } } } }
            });
            for (const batch of expiredBatches) {
                const exists = await prisma.alert.findFirst({
                    where: { companyId, type: 'expired_product', relatedId: batch.id, isResolved: false }
                });
                if (!exists) {
                    await prisma.alert.create({
                        data: {
                            type: 'expired_product', priority: 'critical',
                            title: 'Lote de Medicamento expirado',
                            message: `Lote ${batch.batchNumber} de "${batch.medication.product.name}" expirou em ${batch.expiryDate.toLocaleDateString('pt-BR')}.`,
                            module: 'pharmacy', relatedId: batch.id, relatedType: 'medication_batch', companyId
                        }
                    });
                    createdCount++;
                }
            }

            const expiringBatches = await prisma.medicationBatch.findMany({
                where: { companyId, status: 'active', quantityAvailable: { gt: 0 }, expiryDate: { gte: now, lte: expiryWarning } },
                include: { medication: { include: { product: { select: { name: true } } } } }
            });
            for (const batch of expiringBatches) {
                const exists = await prisma.alert.findFirst({
                    where: { companyId, type: 'expiring_soon', relatedId: batch.id, isResolved: false }
                });
                if (!exists) {
                    await prisma.alert.create({
                        data: {
                            type: 'expiring_soon', priority: 'high',
                            title: 'Lote de Medicamento a expirar',
                            message: `Lote ${batch.batchNumber} de "${batch.medication.product.name}" expira em ${batch.expiryDate.toLocaleDateString('pt-BR')}.`,
                            module: 'pharmacy', relatedId: batch.id, relatedType: 'medication_batch', companyId
                        }
                    });
                    createdCount++;
                }
            }
        }

        logger.info(`Generated ${createdCount} alerts for company ${companyId}${module ? ` (module: ${module})` : ''}`);
        return { created: createdCount, message: `${createdCount} alerta(s) criado(s)` };
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
            const usersToNotify = await prisma.user.findMany({
                where: { companyId: b.companyId, role: { in: ['admin', 'manager'] } }
            });

            for (const user of usersToNotify) {
                if (user.email) {
                    const queue = getEmailQueue();
                    if (queue) {
                        await queue.add('expiration-alert', {
                            email: user.email,
                            productName: b.product.name,
                            batchNumber: b.batchNumber,
                            expiryDate: b.expiryDate,
                            currentStock: b.quantity,
                            userName: user.name
                        });
                    }
                }
            }
        }
    } catch (error) {
        logger.error('Error checking expiring batches', { error });
    }
};
