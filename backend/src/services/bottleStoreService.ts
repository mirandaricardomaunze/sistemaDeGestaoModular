import { prisma } from '../lib/prisma';
import { subMonths, startOfDay, endOfDay, format } from 'date-fns';
import { stockService } from './stockService';
import { ApiError } from '../middleware/error.middleware';
import { ResultHandler } from '../utils/result';

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

        const [saleAggregates, beverageProducts, lowStockCount, productCount] = await Promise.all([
            prisma.sale.aggregate({
                where: { companyId, createdAt: { gte: cutoffDate }, items: { some: { product: { category: { equals: 'beverages', mode: 'insensitive' } } } } },
                _sum: { total: true }, _count: { id: true }
            }),
            prisma.product.findMany({
                where: { companyId, category: { equals: 'beverages', mode: 'insensitive' }, isActive: true },
                select: { currentStock: true, costPrice: true, price: true }
            }),
            prisma.product.count({
                where: { companyId, category: { equals: 'beverages', mode: 'insensitive' }, isActive: true, currentStock: { lte: 10 } }
            }),
            prisma.product.count({ where: { companyId, category: { equals: 'beverages', mode: 'insensitive' }, isActive: true } })
        ]);

        const stockValueCost = beverageProducts.reduce((sum, p) => sum + (p.currentStock * Number(p.costPrice || 0)), 0);
        const stockValueSale = beverageProducts.reduce((sum, p) => sum + (p.currentStock * Number(p.price || 0)), 0);

        const totalSales = Number(saleAggregates._sum?.total || 0);
        const totalTx = saleAggregates._count?.id || 0;

        const saleItems = await prisma.saleItem.findMany({
            where: { sale: { companyId, createdAt: { gte: cutoffDate } }, product: { category: { equals: 'beverages', mode: 'insensitive' } } },
            select: { quantity: true, unitPrice: true, product: { select: { costPrice: true } } }
        });

        const totalProfit = saleItems.reduce((acc, item) => {
            const cost = Number(item.product?.costPrice || 0);
            const price = Number(item.unitPrice);
            return acc + ((price - cost) * item.quantity);
        }, 0);

        const salesDates = await prisma.sale.findMany({
            where: { companyId, createdAt: { gte: cutoffDate }, items: { some: { product: { category: { equals: 'beverages', mode: 'insensitive' } } } } },
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
                where: { companyId, items: { some: { product: { category: { equals: 'beverages', mode: 'insensitive' } } } } },
                include: { customer: { select: { name: true } } },
                orderBy: { createdAt: 'desc' }, take: 5
            })
        ]);

        return ResultHandler.success({
            summary: {
                totalSales, totalTx, avgTicket: totalTx > 0 ? totalSales / totalTx : 0,
                totalProfit, lowStockCount, totalProducts: productCount,
                stockValueCost, stockValueSale
            },
            chartData, categoryData: [{ name: 'Bebidas', value: totalSales }],
            recentActivity: { movements: recentMovements, sales: recentSales }
        });
    }

    async getSalesReport(companyId: string, query: BottleStoreQuery) {
        const { startDate, endDate, period, page = '1', limit = '50' } = query;
        let start = new Date(0); let end = new Date();

        if (period === 'today') { start = startOfDay(new Date()); end = endOfDay(new Date()); }
        else if (startDate && endDate) { start = startOfDay(new Date(startDate)); end = endOfDay(new Date(endDate)); }

        const skip = (Number(page) - 1) * Number(limit);
        const where = {
            companyId,
            createdAt: { gte: start, lte: end },
            items: { some: { product: { category: { equals: 'beverages', mode: 'insensitive' } } } }
        };

        const [saleAggregates, salesData, total] = await Promise.all([
            prisma.sale.aggregate({ where: where as any, _sum: { total: true, tax: true }, _count: { id: true } }),
            prisma.sale.findMany({
                where: where as any,
                select: { id: true, receiptNumber: true, createdAt: true, total: true, tax: true, customer: { select: { name: true } } },
                orderBy: { createdAt: 'desc' }, skip, take: Number(limit)
            }),
            prisma.sale.count({ where: where as any })
        ]);

        const totalSales = Number(saleAggregates._sum?.total || 0);
        return ResultHandler.success({
            summary: {
                totalSales,
                totalTax: Number(saleAggregates._sum?.tax || 0),
                transactionCount: saleAggregates._count?.id || 0,
                avgTicket: (saleAggregates._count?.id || 0) > 0 ? totalSales / (saleAggregates._count?.id || 0) : 0
            },
            sales: salesData, pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) }
        });
    }

    async getStockMovements(companyId: string, query: BottleStoreQuery) {
        const { startDate, endDate, period, productId, type, page = '1', limit = '20' } = query;
        const skip = (Number(page) - 1) * Number(limit);

        const where: any = { companyId, originModule: 'BOTTLE_STORE' };
        if (productId) where.productId = productId;
        if (type) where.movementType = type as any;

        if (period === 'today') {
            where.createdAt = { gte: startOfDay(new Date()), lte: endOfDay(new Date()) };
        } else if (startDate && endDate) {
            where.createdAt = { gte: startOfDay(new Date(startDate)), lte: endOfDay(new Date(endDate)) };
        }

        const [movements, total] = await Promise.all([
            prisma.stockMovement.findMany({
                where, include: { product: { select: { name: true, code: true } } },
                orderBy: { createdAt: 'desc' }, skip, take: Number(limit)
            }),
            prisma.stockMovement.count({ where })
        ]);

        return { data: movements, pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } };
    }

    async recordStockMovement(companyId: string, performedBy: string, data: StockMovementData) {
        const { productId, quantity, type, reason, warehouseId } = data;
        const product = await prisma.product.findFirst({ where: { id: productId, companyId, category: { equals: 'beverages', mode: 'insensitive' } } });
        if (!product) throw ApiError.notFound('Produto não encontrado ou não pertence à categoria de bebidas');

        return stockService.recordMovement({
            productId, companyId, quantity: Number(quantity), movementType: type as any,
            originModule: 'BOTTLE_STORE', performedBy, reason, warehouseId
        });
    }

    // ============================================================================
    // BATCHES -- lotes com validade
    // ============================================================================

    async getBatches(companyId: string, query: any) {
        const { productId, status, page = 1, limit = 30 } = query;
        const skip = (Number(page) - 1) * Number(limit);

        const where: any = { companyId };
        if (productId) where.productId = productId;
        if (status) where.status = status;
        else where.status = { not: 'depleted' };

        const [batches, total] = await Promise.all([
            prisma.productBatch.findMany({
                where,
                include: { product: { select: { id: true, name: true, code: true } } },
                orderBy: { expiryDate: 'asc' },
                skip, take: Number(limit),
            }),
            prisma.productBatch.count({ where }),
        ]);

        // Update status based on current date
        const now = new Date();
        const in30 = new Date(now.getTime() + 30 * 86400000);
        const updated = batches.map(b => ({
            ...b,
            computedStatus: !b.expiryDate ? 'active'
                : b.expiryDate < now ? 'expired'
                : b.expiryDate < in30 ? 'expiring_soon'
                : 'active',
            daysToExpiry: b.expiryDate
                ? Math.ceil((b.expiryDate.getTime() - now.getTime()) / 86400000)
                : null,
        }));

        return { data: updated, pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } };
    }

    async getExpiringBatches(companyId: string, days = 30) {
        const now = new Date();
        const cutoff = new Date(now.getTime() + days * 86400000);

        const batches = await prisma.productBatch.findMany({
            where: {
                companyId,
                quantity: { gt: 0 },
                expiryDate: { gte: now, lte: cutoff },
            },
            include: { product: { select: { id: true, name: true, code: true } } },
            orderBy: { expiryDate: 'asc' },
        });

        const expired = await prisma.productBatch.findMany({
            where: { companyId, quantity: { gt: 0 }, expiryDate: { lt: now } },
            include: { product: { select: { id: true, name: true, code: true } } },
            orderBy: { expiryDate: 'asc' },
        });

        return {
            expiringSoon: batches.map(b => ({
                ...b,
                daysToExpiry: Math.ceil((b.expiryDate!.getTime() - now.getTime()) / 86400000),
            })),
            expired,
            counts: { expiringSoon: batches.length, expired: expired.length },
        };
    }

    async createBatch(companyId: string, data: any, performedBy?: string) {
        const product = await prisma.product.findFirst({ where: { id: data.productId, companyId } });
        if (!product) throw ApiError.notFound('Produto não encontrado');

        const batch = await prisma.productBatch.create({
            data: {
                companyId,
                productId: data.productId,
                batchNumber: data.batchNumber,
                supplierId: data.supplierId ?? null,
                initialQuantity: Number(data.quantity),
                quantity: Number(data.quantity),
                costPrice: data.costPrice ?? product.costPrice,
                manufactureDate: data.manufactureDate ? new Date(data.manufactureDate) : null,
                receivedDate: data.receivedDate ? new Date(data.receivedDate) : new Date(),
                expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
                status: 'active',
                notes: data.notes ?? null,
            },
            include: { product: { select: { id: true, name: true, code: true } } },
        });

        await stockService.recordMovement({
            productId: data.productId,
            companyId,
            quantity: Number(data.quantity),
            movementType: 'purchase',
            originModule: 'BOTTLE_STORE',
            referenceType: 'PURCHASE',
            referenceContent: data.batchNumber,
            reason: `Entrada de lote ${data.batchNumber}`,
            performedBy: performedBy || companyId,
            warehouseId: data.warehouseId,
        });

        return batch;
    }

    // ============================================================================
    // PRICE TIERS -- descontos por volume
    // ============================================================================

    async getPriceTiers(companyId: string, productId?: string) {
        const where: any = { companyId };
        if (productId) where.productId = productId;
        return prisma.priceTier.findMany({
            where,
            include: { product: { select: { id: true, name: true, code: true, price: true } } },
            orderBy: [{ productId: 'asc' }, { minQty: 'asc' }],
        });
    }

    async createPriceTier(companyId: string, data: any) {
        const product = await prisma.product.findFirst({ where: { id: data.productId, companyId } });
        if (!product) throw ApiError.notFound('Produto não encontrado');

        return prisma.priceTier.create({
            data: {
                companyId,
                productId: data.productId,
                minQty: Number(data.minQty),
                price: data.price,
                label: data.label ?? null,
            },
            include: { product: { select: { id: true, name: true, price: true } } },
        });
    }

    async deletePriceTier(companyId: string, id: string) {
        const tier = await prisma.priceTier.findFirst({ where: { id, companyId } });
        if (!tier) throw ApiError.notFound('Nível de preço não encontrado');
        return prisma.priceTier.delete({ where: { id } });
    }
}

export const bottleStoreService = new BottleStoreService();
