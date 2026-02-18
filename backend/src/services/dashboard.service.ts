import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { cacheService, CacheKeys } from './cache.service';
import { logger } from '../utils/logger';

export class DashboardService {
    async getMetrics(companyId: string) {
        if (!companyId) throw ApiError.badRequest('Company not identified');
        const cacheKey = CacheKeys.dashboardMetrics(companyId);
        return cacheService.getOrSet(cacheKey, async () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const endOfDay = new Date(today);
            endOfDay.setHours(23, 59, 59, 999);
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

            const [todaySales, monthSales, lastMonthSales, lowStockItems, activeEmployees, pendingAlerts, overdueInvoices, totalCustomers, totalProducts, salesItems] = await Promise.all([
                prisma.sale.aggregate({ where: { companyId, createdAt: { gte: today, lte: endOfDay } }, _sum: { total: true }, _count: true }),
                prisma.sale.aggregate({ where: { companyId, createdAt: { gte: startOfMonth, lte: endOfMonth } }, _sum: { total: true }, _count: true }),
                prisma.sale.aggregate({ where: { companyId, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } }, _sum: { total: true } }),
                prisma.product.count({ where: { isActive: true, companyId, OR: [{ status: 'low_stock' }, { status: 'out_of_stock' }] } }),
                prisma.employee.count({ where: { isActive: true, companyId } }),
                prisma.alert.count({ where: { isResolved: false, companyId } }),
                prisma.invoice.count({ where: { companyId, status: { in: ['sent', 'partial', 'overdue'] }, dueDate: { lt: new Date() }, amountDue: { gt: 0 } } }),
                prisma.customer.count({ where: { isActive: true, companyId } }),
                prisma.product.count({ where: { isActive: true, companyId } }),
                prisma.saleItem.findMany({ where: { sale: { companyId, createdAt: { gte: startOfMonth, lte: endOfMonth } } }, include: { product: { select: { costPrice: true } } } })
            ]);

            const currentMonthTotal = Number(monthSales._sum?.total) || 0;
            const lastMonthTotal = Number(lastMonthSales._sum?.total) || 0;
            const salesGrowth = lastMonthTotal > 0 ? ((currentMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : 0;
            const monthProfit = salesItems.reduce((sum, item) => sum + (Number(item.total) - Number(item.product.costPrice) * item.quantity), 0);

            return {
                todaySales: { total: todaySales._sum?.total || 0, count: todaySales._count },
                monthSales: { total: monthSales._sum?.total || 0, count: monthSales._count },
                salesGrowth: Math.round(salesGrowth * 100) / 100, monthProfit,
                lowStockItems, activeEmployees, pendingAlerts, overdueInvoices, totalCustomers, totalProducts
            };
        }, 300);
    }

    async getSalesChart(companyId: string, period: string) {
        const today = new Date();
        let startDate: Date;
        let groupBy: 'day' | 'month';

        switch (period) {
            case 'week': startDate = new Date(today); startDate.setDate(today.getDate() - 7); groupBy = 'day'; break;
            case 'year': startDate = new Date(today.getFullYear(), 0, 1); groupBy = 'month'; break;
            default: startDate = new Date(today.getFullYear(), today.getMonth(), 1); groupBy = 'day';
        }

        const sales = await prisma.sale.findMany({ where: { companyId, createdAt: { gte: startDate } }, select: { createdAt: true, total: true } });
        const grouped: Record<string, number> = {};
        sales.forEach(sale => {
            const date = new Date(sale.createdAt);
            const key = groupBy === 'month' ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : date.toISOString().slice(0, 10);
            grouped[key] = (grouped[key] || 0) + Number(sale.total);
        });

        return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
    }

    async getTopProducts(companyId: string, limit: number, period?: string) {
        const cacheKey = CacheKeys.dashboardTopProducts(companyId, limit, parseInt(period || '30'));
        return cacheService.getOrSet(cacheKey, async () => {
            const where: any = { sale: { companyId } };
            if (period) {
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - parseInt(period));
                where.sale.createdAt = { gte: startDate };
            }

            const topProducts = await prisma.saleItem.groupBy({
                by: ['productId'], where, _sum: { quantity: true, total: true },
                orderBy: { _sum: { total: 'desc' } }, take: limit
            });

            const products = await prisma.product.findMany({
                where: { id: { in: topProducts.map(item => item.productId) } },
                select: { id: true, name: true, code: true, category: true }
            });

            const productsMap = new Map(products.map(p => [p.id, p]));
            return topProducts.map(item => ({
                product: productsMap.get(item.productId),
                quantity: item._sum?.quantity || 0,
                revenue: item._sum?.total || 0
            }));
        }, 300);
    }
}

export const dashboardService = new DashboardService();
