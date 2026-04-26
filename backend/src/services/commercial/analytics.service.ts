import { prisma } from '../../lib/prisma';
import { ApiError } from '../../middleware/error.middleware';
import { cacheService } from '../cacheService';
import { ResultHandler } from '../../utils/result';
import { round2, calcMargin, UNCATEGORISED, daysAgo, monthStart, monthEnd } from './shared';

const ANALYTICS_CACHE_TTL = 300;

interface SaleFilter {
    companyId: string;
    createdAt?: { gte?: Date; lte?: Date };
    userId?: string;
}

export class CommercialAnalyticsService {

    async getAnalytics(companyId: string, userId?: string) {
        if (!companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
        const cacheKey = `commercial:analytics:${companyId}${userId ? `:${userId}` : ''}`;

        return cacheService.getOrSet(cacheKey, async () => {
            const today = new Date();
            const curStart = monthStart();
            const curEnd = monthEnd();
            const prevStart = monthStart(-1);
            const prevEnd = monthEnd(-1);

            const saleFilter: SaleFilter = { companyId, createdAt: { gte: curStart, lte: curEnd } };
            if (userId) saleFilter.userId = userId;

            const [monthItems, lastMonthItems, allActiveProducts, pendingPOs, overduePOs, totalPOSpend] =
                await Promise.all([
                    prisma.saleItem.findMany({
                        where: { sale: saleFilter as any },
                        include: { product: { select: { costPrice: true, category: true } } }
                    }),
                    prisma.saleItem.findMany({
                        where: { sale: { ...saleFilter, createdAt: { gte: prevStart, lte: prevEnd } } as any },
                        include: { product: { select: { costPrice: true } } }
                    }),
                    prisma.product.findMany({
                        where: { companyId, isActive: true, originModule: 'commercial' },
                        select: { id: true, costPrice: true, price: true, currentStock: true, minStock: true, category: true }
                    }),
                    prisma.purchaseOrder.count({
                        where: { companyId, status: { in: ['draft', 'ordered'] }, deletedAt: null }
                    }),
                    prisma.purchaseOrder.count({
                        where: { companyId, status: { in: ['draft', 'ordered', 'partial'] }, expectedDeliveryDate: { lt: today }, deletedAt: null }
                    }),
                    prisma.purchaseOrder.aggregate({
                        where: { companyId, createdAt: { gte: curStart }, deletedAt: null },
                        _sum: { total: true }
                    })
                ]);

            const revenue = monthItems.reduce((s, i) => s + Number(i.total), 0);
            const cogs = monthItems.reduce((s, i) => s + Number(i.product?.costPrice ?? 0) * i.quantity, 0);
            const grossProfit = revenue - cogs;
            const grossMargin = calcMargin(revenue, cogs);

            const lastRevenue = lastMonthItems.reduce((s, i) => s + Number(i.total), 0);
            const lastCogs = lastMonthItems.reduce((s, i) => s + Number(i.product?.costPrice ?? 0) * i.quantity, 0);
            const lastMargin = calcMargin(lastRevenue, lastCogs);

            const inventoryValue = allActiveProducts.reduce((s, p) => s + Number(p.costPrice) * p.currentStock, 0);
            const reorderNeeded = allActiveProducts.filter(p => p.currentStock <= p.minStock).length;
            const inventoryTurnover = inventoryValue > 0 ? round2((cogs * 12) / inventoryValue) : 0;
            const poSpend = Number(totalPOSpend._sum?.total ?? 0);

            return ResultHandler.success({
                revenue: round2(revenue),
                cogs: round2(cogs),
                grossProfit: round2(grossProfit),
                grossMargin,
                marginTrend: round2(grossMargin - lastMargin),
                inventoryValue: Math.round(inventoryValue),
                inventoryTurnover,
                reorderNeeded,
                pendingPOs,
                overduePOs,
                poSpend: round2(poSpend),
                lastMonthMargin: lastMargin,
            });
        }, ANALYTICS_CACHE_TTL);
    }

    async getMarginAnalysis(companyId: string, periodDays = 30, userId?: string) {
        if (!companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
        const cacheKey = `commercial:margins:${companyId}:${periodDays}${userId ? `:${userId}` : ''}`;
        return cacheService.getOrSet(cacheKey, async () => {

        const startDate = daysAgo(periodDays);
        const sixMonthsAgo = monthStart(-5);

        const saleFilter: SaleFilter = { companyId };
        if (userId) saleFilter.userId = userId;

        // Single query from sixMonthsAgo covers both the analysis period and the trend window
        const allItems = await prisma.saleItem.findMany({
            where: { sale: { ...saleFilter, createdAt: { gte: sixMonthsAgo } } as any },
            include: {
                product: { select: { id: true, name: true, code: true, costPrice: true, category: true, categoryId: true } },
                sale: { select: { createdAt: true } }
            }
        });

        // Partition: periodItems for category/product analysis, allItems for trend
        const periodItems = allItems.filter(i => i.sale.createdAt >= startDate);

        const categoryMap: Record<string, { revenue: number; cogs: number; qty: number; name: string }> = {};
        const productMap: Record<string, { id: string; name: string; code: string; category: string; revenue: number; cogs: number; qty: number }> = {};

        for (const item of periodItems) {
            const rev = Number(item.total);
            const cost = Number(item.product?.costPrice ?? 0) * item.quantity;
            const cat = item.product?.category?.trim() || UNCATEGORISED;

            if (!categoryMap[cat]) categoryMap[cat] = { revenue: 0, cogs: 0, qty: 0, name: cat };
            categoryMap[cat].revenue += rev;
            categoryMap[cat].cogs += cost;
            categoryMap[cat].qty += item.quantity;

            const pid = item.productId || '';
            if (pid) {
                if (!productMap[pid]) productMap[pid] = {
                    id: pid, name: item.product?.name || '', code: item.product?.code || '',
                    category: cat, revenue: 0, cogs: 0, qty: 0
                };
                productMap[pid].revenue += rev;
                productMap[pid].cogs += cost;
                productMap[pid].qty += item.quantity;
            }
        }

        const byCategory = Object.values(categoryMap).map(c => ({
            category: c.name,
            revenue: Math.round(c.revenue),
            cogs: Math.round(c.cogs),
            profit: Math.round(c.revenue - c.cogs),
            margin: calcMargin(c.revenue, c.cogs),
            qty: c.qty
        })).sort((a, b) => b.profit - a.profit);

        const byProduct = Object.values(productMap).map(p => ({
            id: p.id, name: p.name, code: p.code, category: p.category,
            revenue: Math.round(p.revenue),
            cogs: Math.round(p.cogs),
            profit: Math.round(p.revenue - p.cogs),
            margin: calcMargin(p.revenue, p.cogs),
            qty: p.qty
        })).sort((a, b) => b.profit - a.profit);

        // Trend: aggregate all items by month
        const trendMap: Record<string, { revenue: number; cogs: number }> = {};
        for (const item of allItems) {
            const d = item.sale.createdAt;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!trendMap[key]) trendMap[key] = { revenue: 0, cogs: 0 };
            trendMap[key].revenue += Number(item.total);
            trendMap[key].cogs += Number(item.product?.costPrice ?? 0) * item.quantity;
        }

        const monthlyTrend = Array.from({ length: 6 }, (_, i) => {
            const d = monthStart(i - 5);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const { revenue = 0, cogs = 0 } = trendMap[key] ?? {};
            return { month: key, revenue: Math.round(revenue), cogs: Math.round(cogs), margin: calcMargin(revenue, cogs) };
        });

        return ResultHandler.success({ byCategory, byProduct, monthlyTrend });
        }, ANALYTICS_CACHE_TTL);
    }

    async getStockAging(companyId: string) {
        if (!companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
        const cacheKey = `commercial:stock-aging:${companyId}`;
        return cacheService.getOrSet(cacheKey, async () => {

        const products = await prisma.product.findMany({
            where: { companyId, isActive: true, currentStock: { gt: 0 } },
            select: { id: true, name: true, code: true, category: true, currentStock: true, costPrice: true, price: true, updatedAt: true }
        });

        const today = new Date();
        const lastSales = await prisma.saleItem.findMany({
            where: { productId: { in: products.map(p => p.id) }, sale: { companyId } },
            select: { productId: true, sale: { select: { createdAt: true } } },
            orderBy: { sale: { createdAt: 'desc' } },
            distinct: ['productId']
        });
        const lastSaleMap = new Map(lastSales.map(s => [s.productId, s.sale.createdAt]));

        const aged = products.map(p => {
            const lastSale = lastSaleMap.get(p.id);
            const daysSinceLastSale = lastSale
                ? Math.floor((today.getTime() - lastSale.getTime()) / 86400000)
                : Math.floor((today.getTime() - p.updatedAt.getTime()) / 86400000);

            let agingBucket: 'fresh' | 'slow' | 'aging' | 'critical';
            if (daysSinceLastSale <= 30) agingBucket = 'fresh';
            else if (daysSinceLastSale <= 60) agingBucket = 'slow';
            else if (daysSinceLastSale <= 90) agingBucket = 'aging';
            else agingBucket = 'critical';

            return {
                id: p.id, name: p.name, code: p.code,
                category: p.category?.trim() || UNCATEGORISED,
                currentStock: p.currentStock,
                stockValue: round2(Number(p.costPrice) * p.currentStock),
                potentialRevenue: round2(Number(p.price) * p.currentStock),
                daysSinceLastSale,
                lastSaleDate: lastSale?.toISOString() || null,
                agingBucket
            };
        });

        const order: Record<string, number> = { critical: 0, aging: 1, slow: 2, fresh: 3 };
        aged.sort((a, b) => order[a.agingBucket] - order[b.agingBucket]);

        const critical = aged.filter(p => p.agingBucket === 'critical');
        return ResultHandler.success({
            products: aged,
            summary: {
                fresh: aged.filter(p => p.agingBucket === 'fresh').length,
                slow: aged.filter(p => p.agingBucket === 'slow').length,
                aging: aged.filter(p => p.agingBucket === 'aging').length,
                critical: critical.length,
                totalStockValue: aged.reduce((s, p) => s + p.stockValue, 0),
                criticalValue: critical.reduce((s, p) => s + p.stockValue, 0),
            }
        });
        }, ANALYTICS_CACHE_TTL);
    }

    async getInventoryTurnover(companyId: string, periodDays = 90) {
        if (!companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
        const cacheKey = `commercial:inventory-turnover:${companyId}:${periodDays}`;
        return cacheService.getOrSet(cacheKey, async () => {

        const startDate = daysAgo(periodDays);

        const [saleItems, products] = await Promise.all([
            prisma.saleItem.findMany({
                where: { sale: { companyId, createdAt: { gte: startDate } } },
                include: { product: { select: { costPrice: true, category: true, currentStock: true } } }
            }),
            prisma.product.findMany({
                where: { companyId, isActive: true },
                select: { category: true, costPrice: true, currentStock: true }
            })
        ]);

        const cogsByCategory: Record<string, number> = {};
        const inventoryByCategory: Record<string, number> = {};

        for (const item of saleItems) {
            const cat = item.product?.category?.trim() || UNCATEGORISED;
            cogsByCategory[cat] = (cogsByCategory[cat] || 0) + Number(item.product?.costPrice ?? 0) * item.quantity;
        }
        for (const p of products) {
            const cat = p.category?.trim() || UNCATEGORISED;
            inventoryByCategory[cat] = (inventoryByCategory[cat] || 0) + Number(p.costPrice) * p.currentStock;
        }

        const allCats = new Set([...Object.keys(cogsByCategory), ...Object.keys(inventoryByCategory)]);

        return Array.from(allCats).map(cat => {
            const cogs = cogsByCategory[cat] || 0;
            const inv = inventoryByCategory[cat] || 0;
            const annualisedCogs = cogs * (365 / periodDays);
            // turnover = 0 when no sales OR no inventory
            const turnover = (inv > 0 && cogs > 0) ? round2(annualisedCogs / inv) : 0;
            // Cap daysOnHand at 999 to avoid absurd values (e.g. 36500)
            const rawDays = turnover > 0 ? Math.round(365 / turnover) : 0;
            return {
                category: cat,
                cogs: Math.round(cogs),
                inventoryValue: Math.round(inv),
                turnover,
                daysOnHand: rawDays > 0 ? Math.min(rawDays, 999) : 0
            };
        }).sort((a, b) => b.turnover - a.turnover);
        }, ANALYTICS_CACHE_TTL);
    }

    async getSalesReport(companyId: string, periodDays = 30, userId?: string) {
        if (!companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
        const cacheKey = `commercial:sales-report:${companyId}:${periodDays}${userId ? `:${userId}` : ''}`;
        return cacheService.getOrSet(cacheKey, async () => {

        const startDate = daysAgo(periodDays);
        const saleFilter: SaleFilter = { companyId, createdAt: { gte: startDate } };
        if (userId) saleFilter.userId = userId;

        const [salesByDay, saleItemsForTop, paymentMethods] = await Promise.all([
            prisma.sale.findMany({
                where: saleFilter as any,
                select: { createdAt: true, total: true, paymentMethod: true }
            }),
            // Use denormalized productName on saleItem — eliminates the N+1 product lookup
            prisma.saleItem.findMany({
                where: { sale: saleFilter as any },
                select: { productId: true, productName: true, total: true, quantity: true }
            }),
            prisma.sale.groupBy({
                by: ['paymentMethod'],
                where: saleFilter as any,
                _sum: { total: true },
                _count: { id: true }
            })
        ]);

        const grouped: Record<string, { revenue: number; count: number }> = {};
        for (const sale of salesByDay) {
            const key = sale.createdAt.toISOString().slice(0, 10);
            if (!grouped[key]) grouped[key] = { revenue: 0, count: 0 };
            grouped[key].revenue += Number(sale.total);
            grouped[key].count++;
        }
        const dailySales = Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, v]) => ({ date, ...v }));

        // Aggregate in-memory by productId (or productName as fallback)
        const productAgg: Record<string, { name: string; revenue: number; qty: number }> = {};
        for (const item of saleItemsForTop) {
            const key = (item.productId ?? item.productName) as string;
            if (!productAgg[key]) productAgg[key] = { name: item.productName ?? '', revenue: 0, qty: 0 };
            productAgg[key].revenue += Number(item.total);
            productAgg[key].qty += item.quantity;
        }
        const topProducts = Object.values(productAgg)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10)
            .map(p => ({ product: { name: p.name }, revenue: round2(p.revenue), qty: p.qty }));

        return ResultHandler.success({
            dailySales,
            topProducts,
            paymentMethods: paymentMethods.map(pm => ({
                method: pm.paymentMethod,
                total: round2(Number(pm._sum?.total || 0)),
                count: pm._count.id
            }))
        });
        }, ANALYTICS_CACHE_TTL);
    }

    async getSupplierPerformance(companyId: string) {
        if (!companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
        const cacheKey = `commercial:supplier-performance:${companyId}`;
        return cacheService.getOrSet(cacheKey, async () => {

        const suppliers = await prisma.supplier.findMany({
            where: { companyId, isActive: true },
            include: {
                purchaseOrders: {
                    where: { companyId, deletedAt: null },
                    select: { id: true, status: true, total: true, expectedDeliveryDate: true, receivedDate: true, createdAt: true }
                },
                _count: { select: { products: true } }
            }
        });

        const today = new Date();

        return ResultHandler.success(suppliers.map(s => {
            const orders = s.purchaseOrders;
            const totalOrders = orders.length;
            const totalSpend = orders.reduce((sum, o) => sum + Number(o.total), 0);
            const received = orders.filter(o => o.status === 'received');
            const onTime = received.filter(o =>
                o.receivedDate && o.expectedDeliveryDate && o.receivedDate <= o.expectedDeliveryDate
            ).length;
            const pendingOrders = orders.filter(o => ['draft', 'ordered', 'partial'].includes(o.status)).length;
            const overdueOrders = orders.filter(o =>
                ['draft', 'ordered', 'partial'].includes(o.status) &&
                o.expectedDeliveryDate && o.expectedDeliveryDate < today
            ).length;

            // O(N) reduce instead of O(N log N) sort to find last order date
            const lastOrderDate = orders.length > 0
                ? orders.reduce<Date | null>((max, o) => max === null || o.createdAt > max ? o.createdAt : max, null)
                : null;

            return {
                id: s.id, name: s.name, code: s.code,
                contactPerson: s.contactPerson, phone: s.phone, email: s.email,
                totalOrders,
                totalSpend: Math.round(totalSpend),
                avgOrderValue: totalOrders > 0 ? round2(totalSpend / totalOrders) : 0,
                onTimeRate: received.length > 0 ? round2((onTime / received.length) * 100) : null,
                pendingOrders, overdueOrders,
                productCount: s._count.products,
                lastOrderDate
            };
        }).sort((a, b) => b.totalSpend - a.totalSpend));
        }, ANALYTICS_CACHE_TTL);
    }

    async getWarehouseDistribution(companyId: string) {
        if (!companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
        const cacheKey = `commercial:warehouse-distribution:${companyId}`;
        return cacheService.getOrSet(cacheKey, async () => {

        const warehouses = await prisma.warehouse.findMany({
            where: { companyId, isActive: true },
            include: {
                stocks: {
                    include: { product: { select: { costPrice: true, name: true, code: true } } }
                }
            }
        });

        const data = warehouses.map(w => {
            const totalValue = w.stocks.reduce((sum, ws) => sum + Number(ws.product.costPrice || 0) * ws.quantity, 0);
            const topProducts = w.stocks
                .map(ws => ({
                    id: ws.id, name: ws.product.name, code: ws.product.code,
                    quantity: ws.quantity,
                    value: Math.round(Number(ws.product.costPrice || 0) * ws.quantity)
                }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 5);

            return {
                id: w.id, name: w.name, location: w.location,
                valuation: Math.round(totalValue),
                volume: w.stocks.reduce((sum, ws) => sum + ws.quantity, 0),
                productCount: w.stocks.length,
                topProducts
            };
        }).sort((a, b) => b.valuation - a.valuation);

        return ResultHandler.success(data);
        }, ANALYTICS_CACHE_TTL);
    }
}

export const commercialAnalyticsService = new CommercialAnalyticsService();
