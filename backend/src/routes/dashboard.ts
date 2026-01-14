import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { cacheService, CacheKeys } from '../services/cache.service';
import { logger } from '../utils/logger';

const router = Router();

// Get dashboard metrics
router.get('/metrics', authenticate, async (req: AuthRequest, res) => {
    try {
        if (!req.companyId) return res.status(400).json({ error: 'Company not identified' });
        const cacheKey = CacheKeys.dashboardMetrics(req.companyId);

        // Try cache first (5 minute TTL)
        const cached = cacheService.get(cacheKey);
        if (cached) {
            logger.info('Dashboard metrics cache hit');
            return res.json(cached);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);

        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

        // Optimize: Run aggregations in parallel
        const [
            todaySales,
            monthSales,
            lastMonthSales,
            lowStockItems,
            activeEmployees,
            pendingAlerts,
            overdueInvoices,
            totalCustomers,
            totalProducts,
            salesItems
        ] = await Promise.all([
            prisma.sale.aggregate({
                where: { companyId: req.companyId, createdAt: { gte: today, lte: endOfDay } },
                _sum: { total: true },
                _count: true
            }),
            prisma.sale.aggregate({
                where: { companyId: req.companyId, createdAt: { gte: startOfMonth, lte: endOfMonth } },
                _sum: { total: true },
                _count: true
            }),
            prisma.sale.aggregate({
                where: { companyId: req.companyId, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
                _sum: { total: true }
            }),
            prisma.product.count({
                where: {
                    isActive: true,
                    companyId: req.companyId,
                    OR: [
                        { status: 'low_stock' },
                        { status: 'out_of_stock' }
                    ]
                }
            }),
            prisma.employee.count({
                where: { isActive: true, companyId: req.companyId }
            }),
            prisma.alert.count({
                where: { isResolved: false, companyId: req.companyId }
            }),
            prisma.invoice.count({
                where: {
                    companyId: req.companyId,
                    status: { in: ['sent', 'partial', 'overdue'] },
                    dueDate: { lt: new Date() },
                    amountDue: { gt: 0 }
                }
            }),
            prisma.customer.count({
                where: { isActive: true, companyId: req.companyId }
            }),
            prisma.product.count({
                where: { isActive: true, companyId: req.companyId }
            }),
            prisma.saleItem.findMany({
                where: {
                    sale: {
                        companyId: req.companyId,
                        createdAt: { gte: startOfMonth, lte: endOfMonth }
                    }
                },
                include: {
                    product: { select: { costPrice: true } }
                }
            })
        ]);

        // Sales growth
        const currentMonthTotal = Number(monthSales._sum?.total) || 0;
        const lastMonthTotal = Number(lastMonthSales._sum?.total) || 0;
        const salesGrowth = lastMonthTotal > 0
            ? ((currentMonthTotal - lastMonthTotal) / lastMonthTotal) * 100
            : 0;

        // Calculate profit (this month)
        const monthProfit = salesItems.reduce((sum, item) => {
            const revenue = Number(item.total);
            const cost = Number(item.product.costPrice) * item.quantity;
            return sum + (revenue - cost);
        }, 0);

        const metrics = {
            todaySales: {
                total: todaySales._sum?.total || 0,
                count: todaySales._count
            },
            monthSales: {
                total: monthSales._sum?.total || 0,
                count: monthSales._count
            },
            salesGrowth: Math.round(salesGrowth * 100) / 100,
            monthProfit,
            lowStockItems,
            activeEmployees,
            pendingAlerts,
            overdueInvoices,
            totalCustomers,
            totalProducts
        };

        // Cache for 5 minutes
        cacheService.set(cacheKey, metrics, 300);

        res.json(metrics);
    } catch (error) {
        logger.error('Get metrics error:', error);
        res.status(500).json({ error: 'Erro ao buscar métricas' });
    }
});

// Get sales chart data
router.get('/charts/sales', authenticate, async (req: AuthRequest, res) => {
    try {
        const { period } = req.query; // 'week', 'month', 'year'

        const today = new Date();
        let startDate: Date;
        let groupBy: 'day' | 'week' | 'month';

        switch (period) {
            case 'week':
                startDate = new Date(today);
                startDate.setDate(today.getDate() - 7);
                groupBy = 'day';
                break;
            case 'year':
                startDate = new Date(today.getFullYear(), 0, 1);
                groupBy = 'month';
                break;
            default: // month
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                groupBy = 'day';
        }

        const sales = await prisma.sale.findMany({
            where: { companyId: req.companyId, createdAt: { gte: startDate } },
            select: { createdAt: true, total: true }
        });

        // Group sales
        const grouped: Record<string, number> = {};

        sales.forEach(sale => {
            let key: string;
            const date = new Date(sale.createdAt);

            if (groupBy === 'month') {
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            } else {
                key = date.toISOString().slice(0, 10);
            }

            grouped[key] = (grouped[key] || 0) + Number(sale.total);
        });

        const chartData = Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, value]) => ({ date, value }));

        res.json(chartData);
    } catch (error) {
        logger.error('Get sales chart error:', error);
        res.status(500).json({ error: 'Erro ao buscar dados do gráfico' });
    }
});

// Get top products
router.get('/charts/top-products', authenticate, async (req: AuthRequest, res) => {
    try {
        const { limit = 10, period } = req.query;
        if (!req.companyId) return res.status(400).json({ error: 'Company not identified' });
        const cacheKey = CacheKeys.dashboardTopProducts(req.companyId, parseInt(String(limit)), parseInt(String(period) || '30'));

        // Try cache first (5 minutes)
        const cached = cacheService.get(cacheKey);
        if (cached) {
            logger.info(`Top products cache hit: limit=${limit}, period=${period}`);
            return res.json(cached);
        }

        const where: any = {};
        if (period) {
            const days = parseInt(String(period));
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            where.sale = { companyId: req.companyId, createdAt: { gte: startDate } };
        } else {
            where.sale = { companyId: req.companyId };
        }

        const topProducts = await prisma.saleItem.groupBy({
            by: ['productId'],
            where,
            _sum: { quantity: true, total: true },
            orderBy: { _sum: { total: 'desc' } },
            take: parseInt(String(limit))
        });

        // 🚀 OPTIMIZE: Fetch all products in one query instead of N queries
        const productIds = topProducts.map(item => item.productId);
        const products = await prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true, code: true, category: true }
        });

        // Map products by ID for fast lookup
        const productsMap = new Map(products.map(p => [p.id, p]));

        const result = topProducts.map(item => ({
            product: productsMap.get(item.productId),
            quantity: item._sum?.quantity || 0,
            revenue: item._sum?.total || 0
        }));

        // Cache for 5 minutes
        cacheService.set(cacheKey, result, 300);

        res.json(result);
    } catch (error) {
        logger.error('Get top products error:', error);
        res.status(500).json({ error: 'Erro ao buscar produtos mais vendidos' });
    }
});

// Get sales by category
router.get('/charts/categories', authenticate, async (req: AuthRequest, res) => {
    try {
        const { period } = req.query;

        const where: any = {};
        if (period) {
            const days = parseInt(String(period));
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            where.createdAt = { gte: startDate };
        }
        where.companyId = req.companyId;

        const sales = await prisma.saleItem.findMany({
            where: { sale: where },
            include: {
                product: { select: { category: true } }
            }
        });

        const byCategory: Record<string, number> = {};
        sales.forEach(item => {
            const cat = item.product.category;
            byCategory[cat] = (byCategory[cat] || 0) + Number(item.total);
        });

        const result = Object.entries(byCategory)
            .map(([category, value]) => ({ category, value }))
            .sort((a, b) => b.value - a.value);

        res.json(result);
    } catch (error) {
        logger.error('Get categories chart error:', error);
        res.status(500).json({ error: 'Erro ao buscar vendas por categoria' });
    }
});

// Get payment methods breakdown
router.get('/charts/payment-methods', authenticate, async (req: AuthRequest, res) => {
    try {
        const { period } = req.query;

        const where: any = {};
        if (period) {
            const days = parseInt(String(period));
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            where.createdAt = { gte: startDate };
        }
        where.companyId = req.companyId;

        const breakdown = await prisma.sale.groupBy({
            by: ['paymentMethod'],
            where,
            _sum: { total: true },
            _count: true
        });

        res.json(breakdown.map(item => ({
            method: item.paymentMethod,
            total: item._sum?.total || 0,
            count: item._count
        })));
    } catch (error) {
        logger.error('Get payment methods error:', error);
        res.status(500).json({ error: 'Erro ao buscar métodos de pagamento' });
    }
});

// Get recent activity
router.get('/recent-activity', authenticate, async (req: AuthRequest, res) => {
    try {
        const [recentSales, recentInvoices, recentAlerts] = await Promise.all([
            prisma.sale.findMany({
                where: { companyId: req.companyId },
                take: 5,
                orderBy: { createdAt: 'desc' },
                include: {
                    customer: { select: { name: true } },
                    user: { select: { name: true } }
                }
            }),
            prisma.invoice.findMany({
                where: { companyId: req.companyId },
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    invoiceNumber: true,
                    customerName: true,
                    total: true,
                    status: true,
                    createdAt: true
                }
            }),
            prisma.alert.findMany({
                where: { companyId: req.companyId, isResolved: false },
                take: 5,
                orderBy: { createdAt: 'desc' }
            })
        ]);

        res.json({
            recentSales,
            recentInvoices,
            recentAlerts
        });
    } catch (error) {
        logger.error('Get recent activity error:', error);
        res.status(500).json({ error: 'Erro ao buscar atividade recente' });
    }
});

export default router;
