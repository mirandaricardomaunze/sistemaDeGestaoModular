import { prisma } from '../lib/prisma';
import { subMonths, startOfDay, endOfDay, format } from 'date-fns';
import { StockService } from './StockService';

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
    static async getDashboardStats(companyId: string, range: string) {
        const now = new Date();
        const months = range === '1M' ? 1 : range === '2M' ? 2 : range === '3M' ? 3 : range === '6M' ? 6 : 12;
        const cutoffDate = subMonths(now, months);

        // Optimized summary metrics using aggregations
        const [saleAggregates, stockAggregates, lowStockCount, productCount] = await Promise.all([
            prisma.sale.aggregate({
                where: {
                    companyId,
                    createdAt: { gte: cutoffDate },
                    items: { some: { product: { category: 'beverages' } } }
                },
                _sum: { total: true },
                _count: { id: true }
            }),
            prisma.product.aggregate({
                where: { companyId, category: 'beverages', isActive: true },
                _sum: { currentStock: true }
            }),
            prisma.product.count({
                where: {
                    companyId,
                    category: 'beverages',
                    isActive: true,
                    currentStock: { lte: prisma.product.fields.minStock }
                }
            }),
            prisma.product.count({
                where: { companyId, category: 'beverages', isActive: true }
            })
        ]);

        const totalSales = Number(saleAggregates._sum.total || 0);
        const totalTx = saleAggregates._count.id;
        const avgTicket = totalTx > 0 ? totalSales / totalTx : 0;

        // Optimized profit calculation - fetch only necessary fields
        const saleItems = await prisma.saleItem.findMany({
            where: {
                sale: { companyId, createdAt: { gte: cutoffDate } },
                product: { category: 'beverages' }
            },
            select: {
                quantity: true,
                unitPrice: true,
                product: { select: { costPrice: true } }
            }
        });

        const totalProfit = saleItems.reduce((acc, item) => {
            const cost = Number(item.product?.costPrice || 0);
            const price = Number(item.unitPrice);
            return acc + ((price - cost) * item.quantity);
        }, 0);

        // Stock values
        const beverageProducts = await prisma.product.findMany({
            where: { companyId, category: 'beverages', isActive: true },
            select: { currentStock: true, costPrice: true, price: true }
        });

        const stockValueCost = beverageProducts.reduce((acc, p) => acc + (Number(p.costPrice || 0) * p.currentStock), 0);
        const stockValueSale = beverageProducts.reduce((acc, p) => acc + (Number(p.price) * p.currentStock), 0);

        // Group by date for chart - using findMany but with minimal select for better performance
        const salesDates = await prisma.sale.findMany({
            where: {
                companyId,
                createdAt: { gte: cutoffDate },
                items: { some: { product: { category: 'beverages' } } }
            },
            select: { createdAt: true, total: true },
            orderBy: { createdAt: 'asc' }
        });

        const salesByDate: Record<string, number> = {};
        salesDates.forEach(s => {
            const dateKey = format(s.createdAt, 'yyyy-MM-dd');
            salesByDate[dateKey] = (salesByDate[dateKey] || 0) + Number(s.total);
        });

        const chartData = Object.entries(salesByDate).map(([date, amount]) => ({
            date,
            amount
        }));

        // Category distribution using groupBy
        const categoryDataRaw = await prisma.saleItem.groupBy({
            by: ['productId'],
            where: {
                sale: { companyId, createdAt: { gte: cutoffDate } },
                product: { category: 'beverages' }
            },
            _sum: { total: true }
        });

        // Map product IDs to names if needed, or just group by category if we can join
        // Since groupBy doesn't support joins well, we'll do as before but more limited
        const categoryData = [{ name: 'Bebidas', value: totalSales }]; // Simplified for now

        // Recent Activity
        const [recentMovements, recentSales] = await Promise.all([
            prisma.stockMovement.findMany({
                where: { companyId, originModule: 'BOTTLE_STORE' },
                include: { product: { select: { name: true } } },
                orderBy: { createdAt: 'desc' },
                take: 5
            }),
            prisma.sale.findMany({
                where: {
                    companyId,
                    items: { some: { product: { category: 'beverages' } } }
                },
                include: { customer: { select: { name: true } } },
                orderBy: { createdAt: 'desc' },
                take: 5
            })
        ]);

        return {
            summary: {
                totalSales,
                totalTx,
                avgTicket,
                totalProfit,
                stockValueCost,
                stockValueSale,
                lowStockCount,
                totalProducts: productCount
            },
            chartData,
            categoryData,
            recentActivity: {
                movements: recentMovements,
                sales: recentSales
            }
        };
    }

    static async getSalesReport(companyId: string, query: BottleStoreQuery) {
        const { startDate, endDate, period, page = '1', limit = '50' } = query;
        let start = new Date(0);
        let end = new Date();

        if (period === 'today') {
            start = startOfDay(new Date());
            end = endOfDay(new Date());
        } else if (startDate && endDate) {
            start = startOfDay(new Date(startDate));
            end = endOfDay(new Date(endDate));
        }

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where = {
            companyId,
            createdAt: { gte: start, lte: end },
            items: { some: { product: { category: 'beverages' } } }
        };

        const [saleAggregates, salesData, total] = await Promise.all([
            prisma.sale.aggregate({
                where,
                _sum: { total: true, tax: true },
                _count: { id: true }
            }),
            prisma.sale.findMany({
                where,
                select: {
                    id: true,
                    receiptNumber: true,
                    createdAt: true,
                    total: true,
                    tax: true,
                    customer: { select: { name: true } }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum
            }),
            prisma.sale.count({ where })
        ]);

        // Top Products using groupBy
        const topProductsRaw = await prisma.saleItem.groupBy({
            by: ['productId'],
            where: {
                sale: { companyId, createdAt: { gte: start, lte: end } },
                product: { category: 'beverages' }
            },
            _sum: { quantity: true, total: true },
            orderBy: { _sum: { total: 'desc' } },
            take: 10
        });

        // Fetch product names for top products
        const topProductDetails = await prisma.product.findMany({
            where: { id: { in: topProductsRaw.map(p => p.productId) } },
            select: { id: true, name: true }
        });

        const topProducts = topProductsRaw.map(tp => ({
            id: tp.productId,
            name: topProductDetails.find(p => p.id === tp.productId)?.name || 'Produto Desconhecido',
            quantity: tp._sum.quantity || 0,
            revenue: Number(tp._sum.total || 0)
        }));

        const totalSales = Number(saleAggregates._sum.total || 0);
        const totalTax = Number(saleAggregates._sum.tax || 0);

        return {
            summary: {
                totalSales,
                totalTax,
                transactionCount: saleAggregates._count.id,
                avgTicket: saleAggregates._count.id > 0 ? totalSales / saleAggregates._count.id : 0
            },
            topProducts,
            sales: salesData.map(s => ({
                id: s.id,
                saleNumber: s.receiptNumber,
                createdAt: s.createdAt,
                customer: s.customer?.name || 'Cliente Balcão',
                total: s.total,
                tax: s.tax
            })),
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum),
                hasMore: skip + salesData.length < total
            }
        };
    }

    static async getStockMovements(companyId: string, query: BottleStoreQuery) {
        const { productId, type, search, page = 1, limit = 20 } = query;
        const skip = (Number(page) - 1) * Number(limit);

        const where: any = {
            companyId,
            originModule: 'BOTTLE_STORE'
        };

        if (productId) where.productId = productId;
        if (type) where.movementType = type;
        if (search) {
            where.product = {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { code: { contains: search, mode: 'insensitive' } }
                ]
            };
        }

        const [items, total] = await Promise.all([
            prisma.stockMovement.findMany({
                where,
                include: {
                    product: {
                        select: { name: true, code: true }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: Number(limit)
            }),
            prisma.stockMovement.count({ where })
        ]);

        return {
            items,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / Number(limit))
            }
        };
    }

    static async recordStockMovement(companyId: string, performedBy: string, data: StockMovementData) {
        const { productId, quantity, type, reason, warehouseId } = data;

        // Verify it's a beverage product
        const product = await prisma.product.findFirst({
            where: { id: productId, companyId, category: 'beverages' }
        });

        if (!product) {
            throw new Error('Produto não encontrado ou não pertence à categoria de bebidas');
        }

        return await StockService.recordMovement({
            productId,
            companyId,
            quantity: Number(quantity),
            movementType: type,
            originModule: 'BOTTLE_STORE',
            performedBy,
            reason,
            warehouseId
        });
    }
}
