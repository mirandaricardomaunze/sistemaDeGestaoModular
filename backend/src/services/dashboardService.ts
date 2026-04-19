import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { cacheService, CacheKeys } from './cacheService';
import { logger } from '../utils/logger';

export class DashboardService {
    async getMetrics(companyId: string, warehouseId?: string) {
        if (!companyId) throw ApiError.badRequest('Company not identified');
        const cacheKey = CacheKeys.dashboardMetrics(companyId, warehouseId);
        return cacheService.getOrSet(cacheKey, async () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const endOfDay = new Date(today);
            endOfDay.setHours(23, 59, 59, 999);
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

            const saleWhere: any = { companyId, warehouseId };
            if (!warehouseId) delete saleWhere.warehouseId;

            const [todaySales, monthSales, lastMonthSales, lowStockItems, activeEmployees, pendingAlerts, overdueInvoices, totalCustomers, totalProducts, salesItems] = await Promise.all([
                prisma.sale.aggregate({ where: { ...saleWhere, createdAt: { gte: today, lte: endOfDay } }, _sum: { total: true }, _count: true }),
                prisma.sale.aggregate({ where: { ...saleWhere, createdAt: { gte: startOfMonth, lte: endOfMonth } }, _sum: { total: true }, _count: true }),
                prisma.sale.aggregate({ where: { ...saleWhere, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } }, _sum: { total: true } }),
                prisma.product.count({
                    where: {
                        isActive: true,
                        companyId,
                        OR: [{ status: 'low_stock' }, { status: 'out_of_stock' }],
                        ...(warehouseId ? { warehouseStocks: { some: { warehouseId, quantity: { lte: 10 } } } } : {})
                    }
                }),
                prisma.employee.count({ where: { isActive: true, companyId } }),
                prisma.alert.count({ where: { isResolved: false, companyId, ...(warehouseId ? { relatedType: 'warehouse', relatedId: warehouseId } : {}) } }),
                prisma.invoice.count({ where: { companyId, status: { in: ['sent', 'partial', 'overdue'] }, dueDate: { lt: new Date() }, amountDue: { gt: 0 } } }),
                prisma.customer.count({ where: { isActive: true, companyId } }),
                prisma.product.count({
                    where: {
                        isActive: true,
                        companyId,
                        ...(warehouseId ? { warehouseStocks: { some: { warehouseId } } } : {})
                    }
                }),
                prisma.saleItem.findMany({ where: { sale: { ...saleWhere, createdAt: { gte: startOfMonth, lte: endOfMonth } } }, include: { product: { select: { costPrice: true } } } })
            ]);

            const currentMonthTotal = Number(monthSales._sum?.total) || 0;
            const lastMonthTotal = Number(lastMonthSales._sum?.total) || 0;
            const salesGrowth = lastMonthTotal > 0 ? ((currentMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : 0;
            const monthProfit = salesItems.reduce((sum, item) => sum + (Number(item.total) - Number(item.product?.costPrice ?? 0) * item.quantity), 0);

            return {
                todaySales: { total: todaySales._sum?.total || 0, count: todaySales._count },
                monthSales: { total: monthSales._sum?.total || 0, count: monthSales._count },
                salesGrowth: Math.round(salesGrowth * 100) / 100, monthProfit,
                lowStockItems, activeEmployees, pendingAlerts, overdueInvoices, totalCustomers, totalProducts
            };
        }, 300);
    }

    async getSalesChart(companyId: string, period: string, warehouseId?: string) {
        const today = new Date();
        let startDate: Date;
        let groupBy: 'day' | 'month';

        switch (period) {
            case 'week': startDate = new Date(today); startDate.setDate(today.getDate() - 7); groupBy = 'day'; break;
            case 'year': startDate = new Date(today.getFullYear(), 0, 1); groupBy = 'month'; break;
            default: startDate = new Date(today.getFullYear(), today.getMonth(), 1); groupBy = 'day';
        }

        const where: any = { companyId, createdAt: { gte: startDate } };
        if (warehouseId) where.warehouseId = warehouseId;

        const sales = await prisma.sale.findMany({ where, select: { createdAt: true, total: true } });
        const grouped: Record<string, number> = {};
        sales.forEach(sale => {
            const date = new Date(sale.createdAt);
            const key = groupBy === 'month' ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : date.toISOString().slice(0, 10);
            grouped[key] = (grouped[key] || 0) + Number(sale.total);
        });

        return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
    }

    async getTopProducts(companyId: string, limit: number, period?: string, warehouseId?: string) {
        const cacheKey = CacheKeys.dashboardTopProducts(companyId, limit, parseInt(period || '30'), warehouseId);
        return cacheService.getOrSet(cacheKey, async () => {
            const where: any = { sale: { companyId, warehouseId } };
            if (!warehouseId) delete where.sale.warehouseId;
            
            if (period) {
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - parseInt(period));
                where.sale.createdAt = { gte: startDate };
            }

            const topProducts = await prisma.saleItem.groupBy({
                by: ['productId'], where, _sum: { quantity: true, total: true },
                orderBy: { _sum: { total: 'desc' } }, take: limit
            });

            const productIds = topProducts.map(item => item.productId).filter((id): id is string => id !== null);
            const products = await prisma.product.findMany({
                where: { id: { in: productIds } },
                select: { id: true, name: true, code: true, category: true }
            });

            const productsMap = new Map(products.map(p => [p.id, p]));
            return topProducts.map(item => ({
                product: item.productId ? productsMap.get(item.productId) : undefined,
                quantity: item._sum?.quantity || 0,
                revenue: item._sum?.total || 0
            }));
        }, 300);
    }

    async getRecentActivity(companyId: string, limit: number = 10, warehouseId?: string) {
        // Fetch recent sales as activity
        const where: any = { companyId };
        if (warehouseId) where.warehouseId = warehouseId;

        const recentSales = await prisma.sale.findMany({
            where,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: { customer: { select: { name: true } }, user: { select: { name: true } } }
        });

        return recentSales.map(sale => ({
            id: sale.id,
            type: 'sale',
            title: `Venda ${sale.receiptNumber}`,
            description: `Venda para ${sale.customer?.name || 'Consumidor Final'}`,
            amount: Number(sale.total),
            user: sale.user.name,
            timestamp: sale.createdAt
        }));
    }

    async getCategoryStats(companyId: string, periodDays: number = 30, warehouseId?: string) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - periodDays);

        const where: any = { sale: { companyId, createdAt: { gte: startDate } } };
        if (warehouseId) where.sale.warehouseId = warehouseId;

        const stats = await prisma.saleItem.groupBy({
            by: ['productId'],
            where,
            _sum: { total: true }
        });

        const statsProductIds = stats.map(s => s.productId).filter((id): id is string => id !== null);
        const products = await prisma.product.findMany({
            where: { id: { in: statsProductIds } },
            select: { id: true, category: true }
        });

        const categoryMap: Record<string, number> = {};
        const productCategoryMap = new Map(products.map(p => [p.id, p.category]));

        stats.forEach(stat => {
            const category = (stat.productId ? productCategoryMap.get(stat.productId) : null) || 'other';
            categoryMap[category] = (categoryMap[category] || 0) + Number(stat._sum?.total || 0);
        });

        return Object.entries(categoryMap).map(([category, value]) => ({ category, value }));
    }

    async getPaymentMethodsBreakdown(companyId: string, periodDays: number = 30, warehouseId?: string) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - periodDays);

        const where: any = { companyId, createdAt: { gte: startDate } };
        if (warehouseId) where.warehouseId = warehouseId;

        const stats = await prisma.sale.groupBy({
            by: ['paymentMethod'],
            where,
            _sum: { total: true },
            _count: { id: true }
        });

        return stats.map(stat => ({
            method: stat.paymentMethod,
            value: Number(stat._sum?.total || 0),
            count: stat._count.id
        }));
    }
}

export const dashboardService = new DashboardService();
