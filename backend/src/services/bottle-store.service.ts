import { prisma } from '../lib/prisma';
import { subMonths, startOfDay, endOfDay, format } from 'date-fns';
import { stockService } from './StockService';
import { ApiError } from '../middleware/error.middleware';

export interface BottleStoreQuery {
    startDate?: string;
    endDate?: string;
    period?: string;
    productId?: string;
    type?: string;
    search?: string;
    page?: number | string;
    limit?: number | string;
}

export interface StockMovementData {
    productId: string;
    quantity: number | string;
    type: string;
    reason?: string;
    warehouseId?: string;
}

export class BottleStoreService {
    async getDashboardStats(companyId: string, range: string) {
        const now = new Date();
        const months = range === '1M' ? 1 : range === '2M' ? 2 : range === '3M' ? 3 : range === '6M' ? 6 : 12;
        const cutoffDate = subMonths(now, months);

        const [saleAggregates, stockAggregates, lowStockCount, productCount] = await Promise.all([
            prisma.sale.aggregate({
                where: { companyId, createdAt: { gte: cutoffDate }, items: { some: { product: { category: 'beverages' } } } },
                _sum: { total: true }, _count: { id: true }
            }),
            prisma.product.aggregate({
                where: { companyId, category: 'beverages', isActive: true }, _sum: { currentStock: true }
            }),
            prisma.product.count({
                where: { companyId, category: 'beverages', isActive: true, currentStock: { lte: 10 } } // Simple threshold for now
            }),
            prisma.product.count({ where: { companyId, category: 'beverages', isActive: true } })
        ]);

        const totalSales = Number(saleAggregates._sum.total || 0);
        const totalTx = saleAggregates._count.id;

        const saleItems = await prisma.saleItem.findMany({
            where: { sale: { companyId, createdAt: { gte: cutoffDate } }, product: { category: 'beverages' } },
            select: { quantity: true, unitPrice: true, product: { select: { costPrice: true } } }
        });

        const totalProfit = saleItems.reduce((acc, item) => {
            const cost = Number(item.product?.costPrice || 0);
            const price = Number(item.unitPrice);
            return acc + ((price - cost) * item.quantity);
        }, 0);

        const salesDates = await prisma.sale.findMany({
            where: { companyId, createdAt: { gte: cutoffDate }, items: { some: { product: { category: 'beverages' } } } },
            select: { createdAt: true, total: true }, orderBy: { createdAt: 'asc' }
        });

        const salesByDate: Record<string, number> = {};
        salesDates.forEach(s => {
            const dateKey = format(s.createdAt, 'yyyy-MM-dd');
            salesByDate[dateKey] = (salesByDate[dateKey] || 0) + Number(s.total);
        });

        const chartData = Object.entries(salesByDate).map(([date, amount]) => ({ date, amount }));

        const [recentMovements, recentSales] = await Promise.all([
            prisma.stockMovement.findMany({
                where: { companyId, originModule: 'BOTTLE_STORE' },
                include: { product: { select: { name: true } } },
                orderBy: { createdAt: 'desc' }, take: 5
            }),
            prisma.sale.findMany({
                where: { companyId, items: { some: { product: { category: 'beverages' } } } },
                include: { customer: { select: { name: true } } },
                orderBy: { createdAt: 'desc' }, take: 5
            })
        ]);

        return {
            summary: {
                totalSales, totalTx, avgTicket: totalTx > 0 ? totalSales / totalTx : 0,
                totalProfit, lowStockCount, totalProducts: productCount
            },
            chartData, categoryData: [{ name: 'Bebidas', value: totalSales }],
            recentActivity: { movements: recentMovements, sales: recentSales }
        };
    }

    async getSalesReport(companyId: string, query: BottleStoreQuery) {
        const { startDate, endDate, period, page = '1', limit = '50' } = query;
        let start = new Date(0); let end = new Date();

        if (period === 'today') { start = startOfDay(new Date()); end = endOfDay(new Date()); }
        else if (startDate && endDate) { start = startOfDay(new Date(startDate)); end = endOfDay(new Date(endDate)); }

        const skip = (Number(page) - 1) * Number(limit);
        const where = { companyId, createdAt: { gte: start, lte: end }, items: { some: { product: { category: 'beverages' } } } };

        const [saleAggregates, salesData, total] = await Promise.all([
            prisma.sale.aggregate({ where, _sum: { total: true, tax: true }, _count: { id: true } }),
            prisma.sale.findMany({
                where, select: { id: true, receiptNumber: true, createdAt: true, total: true, tax: true, customer: { select: { name: true } } },
                orderBy: { createdAt: 'desc' }, skip, take: Number(limit)
            }),
            prisma.sale.count({ where })
        ]);

        const totalSales = Number(saleAggregates._sum.total || 0);
        return {
            summary: { totalSales, totalTax: Number(saleAggregates._sum.tax || 0), transactionCount: saleAggregates._count.id, avgTicket: saleAggregates._count.id > 0 ? totalSales / saleAggregates._count.id : 0 },
            sales: salesData, pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) }
        };
    }

    async recordStockMovement(companyId: string, performedBy: string, data: StockMovementData) {
        const { productId, quantity, type, reason, warehouseId } = data;
        const product = await prisma.product.findFirst({ where: { id: productId, companyId, category: 'beverages' } });
        if (!product) throw ApiError.notFound('Produto não encontrado ou não pertence à categoria de bebidas');

        return stockService.recordMovement({
            productId, companyId, quantity: Number(quantity), movementType: type as any,
            originModule: 'BOTTLE_STORE', performedBy, reason, warehouseId
        });
    }
}

export const bottleStoreService = new BottleStoreService();
