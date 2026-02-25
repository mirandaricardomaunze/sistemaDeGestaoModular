import { prisma } from '../lib/prisma';
import { Queue } from 'bullmq';
import { connection } from '../config/redis';
import { getPaginationParams, createPaginatedResponse } from '../utils/pagination';

const emailQueue = new Queue('email-queue', { connection });

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
}

export const alertsService = new AlertsService();

export const checkExpiringBatches = async () => {
    console.log('🔍 Iniciando verificação de lotes prestes a expirar...');

    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const startOfTargetDay = new Date(sevenDaysFromNow);
    startOfTargetDay.setHours(0, 0, 0, 0);

    const endOfTargetDay = new Date(sevenDaysFromNow);
    endOfTargetDay.setHours(23, 59, 59, 999);

    try {
        const expiringProducts = await prisma.product.findMany({
            where: {
                expiryDate: {
                    gte: startOfTargetDay,
                    lte: endOfTargetDay
                },
                currentStock: {
                    gt: 0
                }
            },
            include: {
                company: true
            }
        });

        if (expiringProducts.length === 0) {
            console.log('✅ Nenhum produto expira em exatamente 7 dias.');
            return;
        }

        console.log(`⚠️ Encontrados ${expiringProducts.length} produtos para alertar.`);

        for (const product of expiringProducts) {
            if (!product.companyId) continue;

            const usersToNotify = await prisma.user.findMany({
                where: {
                    companyId: product.companyId,
                    role: { in: ['admin', 'manager'] }
                }
            });

            for (const user of usersToNotify) {
                if (user.email) {
                    await emailQueue.add('expiration-alert', {
                        email: user.email,
                        productName: product.name,
                        batchNumber: product.batchNumber,
                        expiryDate: product.expiryDate,
                        currentStock: product.currentStock,
                        userName: user.name
                    });
                }
            }
        }
    } catch (error) {
        console.error('❌ Erro ao verificar lotes expirando:', error);
    }
};
