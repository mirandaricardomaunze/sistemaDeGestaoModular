import { Router } from 'express';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Get all alerts
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const { type, priority, isRead, isResolved, limit = 50 } = req.query;

        const where: any = {};
        if (type) where.type = type;
        if (priority) where.priority = priority;
        if (isRead !== undefined) where.isRead = isRead === 'true';
        if (isResolved !== undefined) where.isResolved = isResolved === 'true';

        const alerts = await prisma.alert.findMany({
            where,
            orderBy: [
                { isResolved: 'asc' },
                { priority: 'asc' },
                { createdAt: 'desc' }
            ],
            take: parseInt(String(limit))
        });

        res.json(alerts);
    } catch (error) {
        console.error('Get alerts error:', error);
        res.status(500).json({ error: 'Erro ao buscar alertas' });
    }
});

// Get unread alerts count
router.get('/unread-count', authenticate, async (req: AuthRequest, res) => {
    try {
        const count = await prisma.alert.count({
            where: { isRead: false, isResolved: false }
        });

        const byCriticality = await prisma.alert.groupBy({
            by: ['priority'],
            where: { isRead: false, isResolved: false },
            _count: true
        });

        res.json({
            total: count,
            byPriority: byCriticality.reduce((acc: Record<string, number>, item: { priority: string; _count: number }) => {
                acc[item.priority] = item._count;
                return acc;
            }, {} as Record<string, number>)
        });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ error: 'Erro ao contar alertas' });
    }
});

// Create alert
router.post('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const alert = await prisma.alert.create({
            data: req.body
        });

        res.status(201).json(alert);
    } catch (error) {
        console.error('Create alert error:', error);
        res.status(500).json({ error: 'Erro ao criar alerta' });
    }
});

// Mark alert as read
router.patch('/:id/read', authenticate, async (req: AuthRequest, res) => {
    try {
        const alert = await prisma.alert.update({
            where: { id: req.params.id },
            data: { isRead: true }
        });

        res.json(alert);
    } catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({ error: 'Erro ao marcar como lido' });
    }
});

// Mark all alerts as read
router.patch('/read-all', authenticate, async (req: AuthRequest, res) => {
    try {
        await prisma.alert.updateMany({
            where: { isRead: false },
            data: { isRead: true }
        });

        res.json({ message: 'Todos alertas marcados como lidos' });
    } catch (error) {
        console.error('Mark all read error:', error);
        res.status(500).json({ error: 'Erro ao marcar todos como lidos' });
    }
});

// Resolve alert
router.patch('/:id/resolve', authenticate, async (req: AuthRequest, res) => {
    try {
        const alert = await prisma.alert.update({
            where: { id: req.params.id },
            data: {
                isResolved: true,
                resolvedAt: new Date()
            }
        });

        res.json(alert);
    } catch (error) {
        console.error('Resolve alert error:', error);
        res.status(500).json({ error: 'Erro ao resolver alerta' });
    }
});

// Delete alert
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        await prisma.alert.delete({
            where: { id: req.params.id }
        });

        res.json({ message: 'Alerta removido' });
    } catch (error) {
        console.error('Delete alert error:', error);
        res.status(500).json({ error: 'Erro ao remover alerta' });
    }
});

// Generate system alerts (call this periodically)
router.post('/generate', authenticate, async (req: AuthRequest, res) => {
    try {
        const alerts: any[] = [];

        // Check low stock products based on actual values
        const products = await prisma.product.findMany({
            where: { isActive: true }
        });

        const lowStockProducts = products.filter((p: typeof products[number]) =>
            p.currentStock === 0 || p.currentStock <= p.minStock
        );

        for (const product of lowStockProducts) {
            // Check if alert already exists
            const existing = await prisma.alert.findFirst({
                where: {
                    type: 'low_stock',
                    relatedId: product.id,
                    isResolved: false
                }
            });

            if (!existing) {
                const isOut = product.currentStock === 0;
                const alert = await prisma.alert.create({
                    data: {
                        type: 'low_stock',
                        priority: isOut ? 'critical' : 'high',
                        title: isOut
                            ? `Stock esgotado: ${product.name}`
                            : `Stock baixo: ${product.name}`,
                        message: `${product.name} (${product.code}) tem apenas ${product.currentStock} unidades. Mínimo: ${product.minStock}`,
                        relatedId: product.id,
                        relatedType: 'product'
                    }
                });
                alerts.push(alert);
            }
        }

        // Check expiring products (next 30 days)
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

        const expiringProducts = await prisma.product.findMany({
            where: {
                isActive: true,
                expiryDate: {
                    lte: thirtyDaysFromNow,
                    gte: new Date()
                }
            }
        });

        for (const product of expiringProducts) {
            const existing = await prisma.alert.findFirst({
                where: {
                    type: 'expired_product',
                    relatedId: product.id,
                    isResolved: false
                }
            });

            if (!existing && product.expiryDate) {
                const daysUntilExpiry = Math.ceil(
                    (product.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                );

                const alert = await prisma.alert.create({
                    data: {
                        type: 'expired_product',
                        priority: daysUntilExpiry <= 7 ? 'critical' : daysUntilExpiry <= 14 ? 'high' : 'medium',
                        title: `Produto a expirar: ${product.name}`,
                        message: `${product.name} expira em ${daysUntilExpiry} dias (${product.expiryDate.toLocaleDateString('pt-MZ')})`,
                        relatedId: product.id,
                        relatedType: 'product'
                    }
                });
                alerts.push(alert);
            }
        }

        // Check overdue invoices
        const overdueInvoices = await prisma.invoice.findMany({
            where: {
                status: { in: ['sent', 'partial'] },
                dueDate: { lt: new Date() },
                amountDue: { gt: 0 }
            }
        });

        for (const invoice of overdueInvoices) {
            const existing = await prisma.alert.findFirst({
                where: {
                    type: 'payment_due',
                    relatedId: invoice.id,
                    isResolved: false
                }
            });

            if (!existing) {
                const daysOverdue = Math.ceil(
                    (Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)
                );

                const alert = await prisma.alert.create({
                    data: {
                        type: 'payment_due',
                        priority: daysOverdue > 30 ? 'critical' : daysOverdue > 14 ? 'high' : 'medium',
                        title: `Fatura vencida: ${invoice.invoiceNumber}`,
                        message: `Fatura de ${invoice.customerName} vencida há ${daysOverdue} dias. Valor: ${invoice.amountDue} MT`,
                        relatedId: invoice.id,
                        relatedType: 'invoice'
                    }
                });
                alerts.push(alert);
            }
        }

        res.json({
            generated: alerts.length,
            alerts
        });
    } catch (error) {
        console.error('Generate alerts error:', error);
        res.status(500).json({ error: 'Erro ao gerar alertas' });
    }
});

export default router;
