import { Prisma } from '@prisma/client';
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
                        // Include products from the commercial flow AND the
                        // generic inventory bucket (the default originModule).
                        // Excluding 'inventory' would zero out valuations on
                        // every catalog created before originModule was wired up.
                        where: { companyId, isActive: true, originModule: { in: ['commercial', 'inventory'] } },
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

            // Prefer the costPrice snapshot stored on the SaleItem at sale time;
            // fall back to the live product cost only for legacy rows that
            // pre-date the snapshot column.
            const itemCogs = (i: any) =>
                Number(i.costPrice ?? i.product?.costPrice ?? 0) * i.quantity;

            const revenue = monthItems.reduce((s, i) => s + Number(i.total), 0);
            const cogs = monthItems.reduce((s, i) => s + itemCogs(i), 0);
            const grossProfit = revenue - cogs;
            const grossMargin = calcMargin(revenue, cogs);

            const lastRevenue = lastMonthItems.reduce((s, i) => s + Number(i.total), 0);
            const lastCogs = lastMonthItems.reduce((s, i) => s + itemCogs(i), 0);
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
        const userClause = userId ? Prisma.sql`AND s."userId" = ${userId}` : Prisma.empty;

        // Aggregate categories in SQL — one row per category.
        // Subquery normalises blanks/NULLs into UNCATEGORISED so GROUP BY can reference the alias directly
        // (Postgres treats parameterised expressions as distinct between SELECT and GROUP BY otherwise).
        const categoryRows = await prisma.$queryRaw<Array<{
            category: string | null;
            revenue: number;
            cogs: number;
            qty: number;
        }>>`
            SELECT category,
                   COALESCE(SUM(total), 0)::float AS revenue,
                   COALESCE(SUM(cost), 0)::float AS cogs,
                   COALESCE(SUM(quantity), 0)::int AS qty
            FROM (
                SELECT COALESCE(NULLIF(TRIM(p.category), ''), ${UNCATEGORISED}) AS category,
                       si.total AS total,
                       (COALESCE(si."cost_price", p."costPrice", 0) * si.quantity) AS cost,
                       si.quantity AS quantity
                FROM sale_items si
                JOIN sales s ON s.id = si."saleId"
                LEFT JOIN products p ON p.id = si."productId"
                WHERE s."companyId" = ${companyId}
                  AND s."createdAt" >= ${startDate}
                  ${userClause}
            ) sub
            GROUP BY category
        `;

        // Aggregate products in SQL — one row per product
        const productRows = await prisma.$queryRaw<Array<{
            id: string;
            name: string | null;
            code: string | null;
            category: string | null;
            revenue: number;
            cogs: number;
            qty: number;
        }>>`
            SELECT p.id AS id,
                   p.name AS name,
                   p.code AS code,
                   COALESCE(NULLIF(TRIM(p.category), ''), ${UNCATEGORISED}) AS category,
                   COALESCE(SUM(si.total), 0)::float AS revenue,
                   COALESCE(SUM(COALESCE(si."cost_price", p."costPrice", 0) * si.quantity), 0)::float AS cogs,
                   COALESCE(SUM(si.quantity), 0)::int AS qty
            FROM sale_items si
            JOIN sales s ON s.id = si."saleId"
            JOIN products p ON p.id = si."productId"
            WHERE s."companyId" = ${companyId}
              AND s."createdAt" >= ${startDate}
              ${userClause}
            GROUP BY p.id, p.name, p.code, p.category
        `;

        // Monthly trend — one row per (year, month) over the last 6 months
        const trendRows = await prisma.$queryRaw<Array<{
            month: string;
            revenue: number;
            cogs: number;
        }>>`
            SELECT TO_CHAR(s."createdAt", 'YYYY-MM') AS month,
                   COALESCE(SUM(si.total), 0)::float AS revenue,
                   COALESCE(SUM(COALESCE(si."cost_price", p."costPrice", 0) * si.quantity), 0)::float AS cogs
            FROM sale_items si
            JOIN sales s ON s.id = si."saleId"
            LEFT JOIN products p ON p.id = si."productId"
            WHERE s."companyId" = ${companyId}
              AND s."createdAt" >= ${sixMonthsAgo}
              ${userClause}
            GROUP BY TO_CHAR(s."createdAt", 'YYYY-MM')
        `;
        const trendMap = new Map(trendRows.map(r => [r.month, { revenue: Number(r.revenue), cogs: Number(r.cogs) }]));

        const byCategory = categoryRows
            .map(c => {
                const revenue = Number(c.revenue);
                const cogs = Number(c.cogs);
                return {
                    category: c.category ?? UNCATEGORISED,
                    revenue: Math.round(revenue),
                    cogs: Math.round(cogs),
                    profit: Math.round(revenue - cogs),
                    margin: calcMargin(revenue, cogs),
                    qty: Number(c.qty)
                };
            })
            .sort((a, b) => b.profit - a.profit);

        const byProduct = productRows
            .map(p => {
                const revenue = Number(p.revenue);
                const cogs = Number(p.cogs);
                return {
                    id: p.id,
                    name: p.name ?? '',
                    code: p.code ?? '',
                    category: p.category ?? UNCATEGORISED,
                    revenue: Math.round(revenue),
                    cogs: Math.round(cogs),
                    profit: Math.round(revenue - cogs),
                    margin: calcMargin(revenue, cogs),
                    qty: Number(p.qty)
                };
            })
            .sort((a, b) => b.profit - a.profit);

        const monthlyTrend = Array.from({ length: 6 }, (_, i) => {
            const d = monthStart(i - 5);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const { revenue = 0, cogs = 0 } = trendMap.get(key) ?? {};
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
        // Aggregate last-sale dates in SQL — avoids loading every saleItem into memory
        // and the expensive `distinct` planner path on large catalogs.
        const lastSaleRows = products.length > 0
            ? await prisma.$queryRaw<Array<{ productId: string; lastSale: Date }>>`
                SELECT si."productId" as "productId", MAX(s."createdAt") as "lastSale"
                FROM sale_items si
                JOIN sales s ON s.id = si."saleId"
                WHERE s."companyId" = ${companyId}
                  AND si."productId" = ANY(${products.map(p => p.id)}::text[])
                GROUP BY si."productId"
              `
            : [];
        const lastSaleMap = new Map(lastSaleRows.map(r => [r.productId, r.lastSale]));

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

        // 1. List warehouses (no embedded stock — avoids loading every WarehouseStock row).
        const warehouses = await prisma.warehouse.findMany({
            where: { companyId, isActive: true },
            select: { id: true, name: true, location: true }
        });
        if (warehouses.length === 0) return ResultHandler.success([]);

        const warehouseIds = warehouses.map(w => w.id);

        // 2. Aggregate totals per warehouse in SQL.
        const totals = await prisma.$queryRaw<Array<{
            warehouseId: string;
            valuation: number;
            volume: number;
            productCount: number;
        }>>`
            SELECT ws."warehouseId" AS "warehouseId",
                   COALESCE(SUM(p."costPrice" * ws.quantity), 0)::float AS valuation,
                   COALESCE(SUM(ws.quantity), 0)::int AS volume,
                   COUNT(*)::int AS "productCount"
            FROM warehouse_stocks ws
            JOIN products p ON p.id = ws."productId"
            WHERE ws."warehouseId" = ANY(${warehouseIds}::text[])
            GROUP BY ws."warehouseId"
        `;
        const totalsMap = new Map(totals.map(t => [t.warehouseId, t]));

        // 3. Top-5 products per warehouse via window function — bounded result set.
        const topRows = await prisma.$queryRaw<Array<{
            warehouseId: string;
            id: string;
            name: string;
            code: string;
            quantity: number;
            value: number;
        }>>`
            SELECT * FROM (
                SELECT ws."warehouseId" AS "warehouseId",
                       ws.id AS id,
                       p.name AS name,
                       p.code AS code,
                       ws.quantity AS quantity,
                       (p."costPrice" * ws.quantity)::float AS value,
                       ROW_NUMBER() OVER (PARTITION BY ws."warehouseId" ORDER BY (p."costPrice" * ws.quantity) DESC) AS rn
                FROM warehouse_stocks ws
                JOIN products p ON p.id = ws."productId"
                WHERE ws."warehouseId" = ANY(${warehouseIds}::text[])
            ) ranked
            WHERE rn <= 5
        `;
        const topByWarehouse = new Map<string, Array<{ id: string; name: string; code: string; quantity: number; value: number }>>();
        for (const r of topRows) {
            const list = topByWarehouse.get(r.warehouseId) ?? [];
            list.push({ id: r.id, name: r.name, code: r.code, quantity: r.quantity, value: Math.round(r.value) });
            topByWarehouse.set(r.warehouseId, list);
        }

        const data = warehouses
            .map(w => {
                const t = totalsMap.get(w.id);
                return {
                    id: w.id,
                    name: w.name,
                    location: w.location,
                    valuation: Math.round(Number(t?.valuation ?? 0)),
                    volume: Number(t?.volume ?? 0),
                    productCount: Number(t?.productCount ?? 0),
                    topProducts: topByWarehouse.get(w.id) ?? []
                };
            })
            .sort((a, b) => b.valuation - a.valuation);

        return ResultHandler.success(data);
        }, ANALYTICS_CACHE_TTL);
    }
}

export const commercialAnalyticsService = new CommercialAnalyticsService();
