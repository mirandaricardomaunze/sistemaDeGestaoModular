import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { cacheService } from './cacheService';
import { getPaginationParams, createPaginatedResponse } from '../utils/pagination';
import { stockService } from './stockService';
import { ResultHandler, Result } from '../utils/result';

// ============================================================================
// Commercial Analytics Service
// Premium commercial module: margin analysis, stock aging, supplier performance,
// inventory turnover, purchase order management
// ============================================================================

const ANALYTICS_CACHE_TTL = 300;
const UNCATEGORISED = 'Sem Categoria';

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

export class CommercialService {

    // ── Dashboard Analytics ───────────────────────────────────────────────────

    async getAnalytics(companyId: string, userId?: string) {
        if (!companyId) throw ApiError.badRequest('Company not identified');
        const cacheKey = `commercial:analytics:${companyId}${userId ? `:${userId}` : ''}`;

        return cacheService.getOrSet(cacheKey, async () => {
            const today = new Date();
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

            const saleFilter: any = { companyId, createdAt: { gte: startOfMonth, lte: endOfMonth } };
            if (userId) saleFilter.userId = userId;

            const [
                monthItems,
                lastMonthItems,
                allActiveProducts,
                pendingPOs,
                overduePOs,
                totalPOSpend,
            ] = await Promise.all([
                prisma.saleItem.findMany({
                    where: { sale: saleFilter },
                    include: { product: { select: { costPrice: true, category: true } } }
                }),
                prisma.saleItem.findMany({
                    where: { sale: { ...saleFilter, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } },
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
                    where: {
                        companyId,
                        status: { in: ['draft', 'ordered', 'partial'] },
                        expectedDeliveryDate: { lt: today },
                        deletedAt: null
                    }
                }),
                prisma.purchaseOrder.aggregate({
                    where: { companyId, createdAt: { gte: startOfMonth }, deletedAt: null },
                    _sum: { total: true }
                })
            ]);

            const revenue = monthItems.reduce((s, i) => s + Number(i.total), 0);
            const cogs = monthItems.reduce((s, i) => s + (Number(i.product?.costPrice ?? 0) * i.quantity), 0);
            const grossProfit = revenue - cogs;
            const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

            const lastRevenue = lastMonthItems.reduce((s, i) => s + Number(i.total), 0);
            const lastCogs = lastMonthItems.reduce((s, i) => s + (Number(i.product?.costPrice ?? 0) * i.quantity), 0);
            const lastMargin = lastRevenue > 0 ? ((lastRevenue - lastCogs) / lastRevenue) * 100 : 0;
            const marginTrend = grossMargin - lastMargin;

            const inventoryValue = allActiveProducts.reduce(
                (s, p) => s + Number(p.costPrice) * p.currentStock, 0
            );
            const reorderNeeded = allActiveProducts.filter(p => p.currentStock <= p.minStock).length;
            const avgInventory = inventoryValue > 0 ? inventoryValue : 1;
            const inventoryTurnover = avgInventory > 0 ? (cogs * 12) / avgInventory : 0;
            const poSpend = Number(totalPOSpend._sum?.total ?? 0);

            return ResultHandler.success({
                revenue: round2(revenue),
                cogs: round2(cogs),
                grossProfit: round2(grossProfit),
                grossMargin: round2(grossMargin),
                marginTrend: round2(marginTrend),
                inventoryValue: Math.round(inventoryValue),
                inventoryTurnover: round2(inventoryTurnover),
                reorderNeeded,
                pendingPOs,
                overduePOs,
                poSpend: round2(poSpend),
                lastMonthMargin: round2(lastMargin),
            });
        }, ANALYTICS_CACHE_TTL);
    }

    // ── Margin Analysis ───────────────────────────────────────────────────────

    async getMarginAnalysis(companyId: string, periodDays = 30, userId?: string) {
        if (!companyId) throw ApiError.badRequest('Company not identified');

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - periodDays);

        const saleFilter: any = { companyId, createdAt: { gte: startDate } };
        if (userId) saleFilter.userId = userId;

        const saleItems = await prisma.saleItem.findMany({
            where: { sale: saleFilter },
            include: {
                product: { select: { id: true, name: true, code: true, costPrice: true, category: true, categoryId: true } }
            }
        });

        const categoryMap: Record<string, { revenue: number; cogs: number; qty: number; name: string }> = {};
        const productMap: Record<string, { id: string; name: string; code: string; category: string; revenue: number; cogs: number; qty: number }> = {};

        for (const item of saleItems) {
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
                    id: pid,
                    name: item.product?.name || '',
                    code: item.product?.code || '',
                    category: cat,
                    revenue: 0, cogs: 0, qty: 0
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
            margin: c.revenue > 0 ? round2(((c.revenue - c.cogs) / c.revenue) * 100) : 0,
            qty: c.qty
        })).sort((a, b) => b.profit - a.profit);

        const byProduct = Object.values(productMap).map(p => ({
            id: p.id,
            name: p.name,
            code: p.code,
            category: p.category,
            revenue: Math.round(p.revenue),
            cogs: Math.round(p.cogs),
            profit: Math.round(p.revenue - p.cogs),
            margin: p.revenue > 0 ? round2(((p.revenue - p.cogs) / p.revenue) * 100) : 0,
            qty: p.qty
        })).sort((a, b) => b.profit - a.profit);

        const sixMonthsAgo = new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1);
        const trendItems = await prisma.saleItem.findMany({
            where: { sale: { ...saleFilter, createdAt: { gte: sixMonthsAgo } } },
            include: { product: { select: { costPrice: true } }, sale: { select: { createdAt: true } } }
        });
        const trendMap: Record<string, { revenue: number; cogs: number }> = {};
        for (const item of trendItems) {
            const d = item.sale.createdAt;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!trendMap[key]) trendMap[key] = { revenue: 0, cogs: 0 };
            trendMap[key].revenue += Number(item.total);
            trendMap[key].cogs += Number(item.product?.costPrice ?? 0) * item.quantity;
        }
        const monthlyTrend = Array.from({ length: 6 }, (_, i) => {
            const d = new Date(new Date().getFullYear(), new Date().getMonth() - (5 - i), 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const { revenue = 0, cogs = 0 } = trendMap[key] ?? {};
            return {
                month: key,
                revenue: Math.round(revenue),
                cogs: Math.round(cogs),
                margin: revenue > 0 ? round2(((revenue - cogs) / revenue) * 100) : 0
            };
        });

        return ResultHandler.success({ byCategory, byProduct, monthlyTrend });
    }

    // ── Stock Aging ───────────────────────────────────────────────────────────

    async getStockAging(companyId: string) {
        if (!companyId) throw ApiError.badRequest('Company not identified');

        const products = await prisma.product.findMany({
            where: { companyId, isActive: true, currentStock: { gt: 0 } },
            select: { id: true, name: true, code: true, category: true, currentStock: true, costPrice: true, price: true, updatedAt: true }
        });

        const today = new Date();
        const productIds = products.map(p => p.id);
        const lastSales = await prisma.saleItem.findMany({
            where: { productId: { in: productIds }, sale: { companyId } },
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

            const stockValue = round2(Number(p.costPrice) * p.currentStock);
            const potentialRevenue = round2(Number(p.price) * p.currentStock);

            let agingBucket: 'fresh' | 'slow' | 'aging' | 'critical';
            if (daysSinceLastSale <= 30) agingBucket = 'fresh';
            else if (daysSinceLastSale <= 60) agingBucket = 'slow';
            else if (daysSinceLastSale <= 90) agingBucket = 'aging';
            else agingBucket = 'critical';

            return {
                id: p.id,
                name: p.name,
                code: p.code,
                category: p.category?.trim() || UNCATEGORISED,
                currentStock: p.currentStock,
                stockValue,
                potentialRevenue,
                daysSinceLastSale,
                lastSaleDate: lastSale?.toISOString() || null,
                agingBucket
            };
        });

        const order = { critical: 0, aging: 1, slow: 2, fresh: 3 };
        aged.sort((a, b) => order[a.agingBucket] - order[b.agingBucket]);

        const summary = {
            fresh: aged.filter(p => p.agingBucket === 'fresh').length,
            slow: aged.filter(p => p.agingBucket === 'slow').length,
            aging: aged.filter(p => p.agingBucket === 'aging').length,
            critical: aged.filter(p => p.agingBucket === 'critical').length,
            totalStockValue: aged.reduce((s, p) => s + p.stockValue, 0),
            criticalValue: aged.filter(p => p.agingBucket === 'critical').reduce((s, p) => s + p.stockValue, 0),
        };

        return ResultHandler.success({ products: aged, summary });
    }

    // ── Supplier Performance ──────────────────────────────────────────────────

    async getSupplierPerformance(companyId: string) {
        if (!companyId) throw ApiError.badRequest('Company not identified');

        const suppliers = await prisma.supplier.findMany({
            where: { companyId, isActive: true },
            include: {
                purchaseOrders: {
                    where: { companyId, deletedAt: null },
                    select: {
                        id: true, status: true, total: true,
                        expectedDeliveryDate: true, receivedDate: true, createdAt: true
                    }
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
            const onTimeRate = received.length > 0 ? round2((onTime / received.length) * 100) : null;
            const pendingOrders = orders.filter(o => ['draft', 'ordered', 'partial'].includes(o.status)).length;
            const overdueOrders = orders.filter(o =>
                ['draft', 'ordered', 'partial'].includes(o.status) &&
                o.expectedDeliveryDate && o.expectedDeliveryDate < today
            ).length;
            const avgOrderValue = totalOrders > 0 ? round2(totalSpend / totalOrders) : 0;

            return {
                id: s.id,
                name: s.name,
                code: s.code,
                contactPerson: s.contactPerson,
                phone: s.phone,
                email: s.email,
                totalOrders,
                totalSpend: Math.round(totalSpend),
                avgOrderValue,
                onTimeRate,
                pendingOrders,
                overdueOrders,
                productCount: s._count.products,
                lastOrderDate: orders.length > 0
                    ? orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0].createdAt
                    : null
            };
        }).sort((a, b) => b.totalSpend - a.totalSpend));
    }

    // ── Purchase Orders ───────────────────────────────────────────────────────

    async listPurchaseOrders(companyId: string, query: any): Promise<Result<any>> {
        if (!companyId) throw ApiError.badRequest('Company not identified');
        const { page, limit, skip } = getPaginationParams(query);
        const { status, supplierId, search } = query;

        const where: any = { companyId, deletedAt: null };
        if (status) where.status = status;
        if (supplierId) where.supplierId = supplierId;
        if (search) {
            where.OR = [
                { orderNumber: { contains: String(search), mode: 'insensitive' } },
                { supplier: { name: { contains: String(search), mode: 'insensitive' } } }
            ];
        }

        const [total, orders] = await Promise.all([
            prisma.purchaseOrder.count({ where }),
            prisma.purchaseOrder.findMany({
                where,
                include: {
                    supplier: { select: { id: true, name: true, code: true, phone: true } },
                    items: { include: { product: { select: { id: true, name: true, code: true, unit: true } } } }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            })
        ]);

        const response = createPaginatedResponse(orders, page, limit, total);
        return ResultHandler.success(response);
    }

    async getPurchaseOrderById(id: string, companyId: string): Promise<Result<any>> {
        const order = await prisma.purchaseOrder.findFirst({
            where: { id, companyId, deletedAt: null },
            include: {
                supplier: true,
                items: { include: { product: { select: { id: true, name: true, code: true, unit: true, costPrice: true } } } }
            }
        });
        if (!order) throw ApiError.notFound('Ordem de compra não encontrada');
        return ResultHandler.success(order);
    }

    async updatePurchaseOrderStatus(id: string, status: string, companyId: string, userId?: string): Promise<Result<any>> {
        const validTransitions: Record<string, string[]> = {
            draft:     ['ordered', 'cancelled'],
            ordered:   ['partial', 'received', 'cancelled'],
            partial:   ['received', 'cancelled'],
            received:  [],
            cancelled: [],
        };

        const order = await prisma.purchaseOrder.findFirst({
            where: { id, companyId, deletedAt: null },
            include: { items: true }
        });
        if (!order) throw ApiError.notFound('Ordem de compra não encontrada');

        const allowed = validTransitions[order.status] ?? [];
        if (!allowed.includes(status)) {
            throw ApiError.badRequest(`Transição de "${order.status}" para "${status}" não é permitida`);
        }

        const result = await prisma.$transaction(async (tx) => {
            const updated = await tx.purchaseOrder.update({
                where: { id },
                data: {
                    status: status as any,
                    ...(status === 'received' ? { receivedDate: new Date() } : {}),
                },
                include: {
                    supplier: { select: { id: true, name: true } },
                    items: { include: { product: { select: { id: true, name: true } } } }
                }
            });

            // When received: update stock quantities AND sync product costPrice
            if (status === 'received' && order.status !== 'received') {
                for (const item of order.items) {
                    const qtyToAdd = item.quantity - item.receivedQty;
                    if (qtyToAdd > 0) {
                        await stockService.recordMovement({
                            productId: item.productId,
                            companyId,
                            quantity: qtyToAdd,
                            movementType: 'purchase',
                            originModule: 'COMMERCIAL',
                            referenceType: 'PURCHASE',
                            referenceContent: order.orderNumber,
                            reason: `Receção de OC ${order.orderNumber}`,
                            performedBy: userId || companyId,
                        }, tx as any);
                        await tx.product.update({
                            where: { id: item.productId },
                            data: { costPrice: item.unitCost },
                        });
                        await tx.purchaseOrderItem.update({
                            where: { id: item.id },
                            data: { receivedQty: item.quantity }
                        });
                    }
                }
            }

            return updated;
        });

        // Invalidate analytics cache so dashboard reflects new PO state
        cacheService.invalidatePattern(`commercial:analytics:${companyId}`);

        return ResultHandler.success(result, `Estado da OC actualizado para ${status}`);
    }

    // ── Partial Delivery ──────────────────────────────────────────────────────

    async registerPartialDelivery(id: string, deliveries: Array<{ itemId: string; receivedQty: number }>, companyId: string, userId?: string): Promise<Result<any>> {
        const order = await prisma.purchaseOrder.findFirst({
            where: { id, companyId, deletedAt: null, status: { in: ['ordered', 'partial'] } },
            include: { items: true }
        });
        if (!order) throw ApiError.notFound('Ordem de compra não encontrada ou já concluída');

        const result = await prisma.$transaction(async (tx) => {
            let allReceived = true;

            for (const delivery of deliveries) {
                const item = order.items.find(i => i.id === delivery.itemId);
                if (!item) continue;

                const newReceived = Math.min(item.receivedQty + delivery.receivedQty, item.quantity);
                const addedQty = newReceived - item.receivedQty;

                if (addedQty > 0) {
                    await tx.purchaseOrderItem.update({
                        where: { id: item.id },
                        data: { receivedQty: newReceived }
                    });
                    await stockService.recordMovement({
                        productId: item.productId,
                        companyId,
                        quantity: addedQty,
                        movementType: 'purchase',
                        originModule: 'COMMERCIAL',
                        referenceType: 'PURCHASE',
                        referenceContent: order.orderNumber,
                        reason: `Entrega parcial de OC ${order.orderNumber}`,
                        performedBy: userId || companyId,
                    }, tx as any);
                }

                if (newReceived < item.quantity) allReceived = false;
            }

            const newStatus = allReceived ? 'received' : 'partial';
            return tx.purchaseOrder.update({
                where: { id },
                data: {
                    status: newStatus as any,
                    ...(newStatus === 'received' ? { receivedDate: new Date() } : {})
                },
                include: {
                    supplier: { select: { id: true, name: true } },
                    items: { include: { product: { select: { id: true, name: true } } } }
                }
            });
        });

        cacheService.invalidatePattern(`commercial:analytics:${companyId}`);

        return ResultHandler.success(result, 'Entrega parcial registada');
    }

    // ── Soft Delete PO ────────────────────────────────────────────────────────

    async deletePurchaseOrder(id: string, companyId: string): Promise<Result<any>> {
        const order = await prisma.purchaseOrder.findFirst({ where: { id, companyId, status: 'draft', deletedAt: null } });
        if (!order) throw ApiError.badRequest('Apenas ordens em rascunho podem ser eliminadas');
        await prisma.purchaseOrder.update({ where: { id }, data: { deletedAt: new Date() } });
        return ResultHandler.success(true, 'Ordem de compra eliminada');
    }

    // ── Inventory Turnover by Category ────────────────────────────────────────

    async getInventoryTurnover(companyId: string, periodDays = 90) {
        if (!companyId) throw ApiError.badRequest('Company not identified');

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - periodDays);

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
            const turnover = inv > 0 ? round2(annualisedCogs / inv) : 0;
            const daysOnHand = turnover > 0 ? Math.round(365 / turnover) : 0;

            return {
                category: cat,
                cogs: Math.round(cogs),
                inventoryValue: Math.round(inv),
                turnover,
                daysOnHand
            };
        }).sort((a, b) => b.turnover - a.turnover);
    }

    // ── Sales Report ──────────────────────────────────────────────────────────

    async getSalesReport(companyId: string, periodDays = 30, userId?: string) {
        if (!companyId) throw ApiError.badRequest('Company not identified');

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - periodDays);

        const saleFilter: any = { companyId, createdAt: { gte: startDate } };
        if (userId) saleFilter.userId = userId;

        const [salesByDay, topProducts, paymentMethods] = await Promise.all([
            prisma.sale.findMany({
                where: saleFilter,
                select: { createdAt: true, total: true, paymentMethod: true }
            }),
            prisma.saleItem.groupBy({
                by: ['productId'],
                where: { sale: saleFilter },
                _sum: { total: true, quantity: true },
                orderBy: { _sum: { total: 'desc' } },
                take: 10
            }),
            prisma.sale.groupBy({
                by: ['paymentMethod'],
                where: saleFilter,
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

        const productIds = topProducts.map(t => t.productId).filter((id): id is string => id !== null);
        const productNames = await prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true, code: true, category: true }
        });
        const nameMap = new Map(productNames.map(p => [p.id, p]));

        const topProductsWithNames = topProducts.map(t => ({
            product: t.productId ? nameMap.get(t.productId) : undefined,
            revenue: round2(Number(t._sum?.total || 0)),
            qty: Number(t._sum?.quantity || 0)
        }));

        return ResultHandler.success({
            dailySales,
            topProducts: topProductsWithNames,
            paymentMethods: paymentMethods.map(pm => ({
                method: pm.paymentMethod,
                total: round2(Number(pm._sum?.total || 0)),
                count: pm._count.id
            }))
        });
    }

    // ── Accounts Receivable ───────────────────────────────────────────────────

    async getAccountsReceivable(companyId: string, params: any = {}) {
        if (!companyId) throw ApiError.badRequest('Company not identified');

        const { page, limit, skip } = getPaginationParams(params);
        const { status, search } = params;

        const where: any = {
            companyId,
            amountDue: { gt: 0 },
        };
        if (status === 'overdue') {
            where.dueDate = { lt: new Date() };
            where.status = { in: ['sent', 'partial', 'overdue'] };
        } else if (status === 'pending') {
            where.status = { in: ['sent', 'partial'] };
            where.dueDate = { gte: new Date() };
        } else {
            where.status = { in: ['sent', 'partial', 'overdue'] };
        }
        if (search) {
            where.OR = [
                { customer: { name: { contains: String(search), mode: 'insensitive' } } },
                { invoiceNumber: { contains: String(search), mode: 'insensitive' } },
            ];
        }

        const [total, invoices] = await Promise.all([
            prisma.invoice.count({ where }),
            prisma.invoice.findMany({
                where,
                include: { customer: { select: { id: true, name: true, phone: true, code: true, currentBalance: true } } },
                orderBy: { dueDate: 'asc' },
                skip,
                take: limit,
            }),
        ]);

        const today = new Date();
        const data = invoices.map(inv => {
            const isOverdue = !!inv.dueDate && new Date(inv.dueDate) < today;
            const daysOverdue = isOverdue && inv.dueDate
                ? Math.floor((today.getTime() - new Date(inv.dueDate).getTime()) / 86400000)
                : 0;
            return {
                id: inv.id,
                number: inv.invoiceNumber,
                quotationId: inv.quotationId ?? null,
                customer: inv.customer,
                total: round2(Number(inv.total)),
                amountDue: round2(Number(inv.amountDue)),
                amountPaid: round2(Number(inv.total) - Number(inv.amountDue)),
                dueDate: inv.dueDate,
                status: inv.status,
                daysOverdue,
                isOverdue,
                createdAt: inv.createdAt,
            };
        });

        const totalReceivable = invoices.reduce((s, i) => s + Number(i.amountDue), 0);
        const overdueAmount = invoices
            .filter(i => i.dueDate && new Date(i.dueDate) < today)
            .reduce((s, i) => s + Number(i.amountDue), 0);

        const response = createPaginatedResponse(data, page, limit, total);
        
        return ResultHandler.success({
            ...response,
            summary: {
                totalReceivable: Math.round(totalReceivable),
                overdueAmount: Math.round(overdueAmount),
                invoiceCount: total,
                overdueCount: invoices.filter(i => i.dueDate && new Date(i.dueDate) < today).length,
            },
        });
    }

    // ── Quotations ────────────────────────────────────────────────────────────

    async listQuotations(companyId: string, params: any) {
        if (!companyId) throw ApiError.badRequest('Company not identified');
        const { page, limit, skip } = getPaginationParams(params);
        const { status, search } = params;

        const where: any = {
            companyId,
            orderType: 'quotation',
        };
        if (status) where.status = status;
        if (search) {
            where.OR = [
                { orderNumber: { contains: String(search), mode: 'insensitive' } },
                { customerName: { contains: String(search), mode: 'insensitive' } },
            ];
        }

        const [total, quotes] = await Promise.all([
            prisma.customerOrder.count({ where }),
            prisma.customerOrder.findMany({
                where,
                include: {
                    customer: { select: { id: true, name: true, phone: true } },
                    items: true,
                },
                orderBy: { createdAt: 'desc' },
                skip, take: limit,
            }),
        ]);

        const response = createPaginatedResponse(quotes, page, limit, total);
        return ResultHandler.success(response);
    }

    async createQuotation(data: any, companyId: string): Promise<Result<any>> {
        if (!companyId) throw ApiError.badRequest('Company not identified');

        // Input validation
        if (!data.customerName?.trim()) throw ApiError.badRequest('Nome do cliente é obrigatório');
        if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
            throw ApiError.badRequest('A cotação deve ter pelo menos um item');
        }

        // Validate each item has required fields and positive quantity/price
        for (const item of data.items) {
            if (!item.productName?.trim()) throw ApiError.badRequest('Cada item deve ter nome do produto');
            if (!item.quantity || item.quantity <= 0) throw ApiError.badRequest('Quantidade deve ser maior que zero');
            if (item.price === undefined || item.price === null || item.price < 0) throw ApiError.badRequest('Preço inválido no item');
        }

        // Validate that product IDs exist (when provided)
        const providedProductIds = data.items.map((i: any) => i.productId).filter(Boolean);
        if (providedProductIds.length > 0) {
            const existingProducts = await prisma.product.findMany({
                where: { id: { in: providedProductIds }, companyId, isActive: true },
                select: { id: true }
            });
            if (existingProducts.length !== providedProductIds.length) {
                throw ApiError.badRequest('Um ou mais produtos não foram encontrados ou estão inactivos');
            }
        }

        const total = data.items.reduce((s: number, i: any) => s + (Number(i.price) * Number(i.quantity)), 0);
        const year = new Date().getFullYear();

        const result = await prisma.$transaction(async (tx) => {
            const count = await tx.customerOrder.count({ where: { companyId } });
            const orderNumber = `COT-${year}-${String(count + 1).padStart(4, '0')}`;

            // Reserve stock for products in the quotation
            for (const item of data.items) {
                if (item.productId) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { reservedStock: { increment: Number(item.quantity) } }
                    });
                }
            }

            const cleanNotes = (data.notes ?? '').replace(/__QUOTE__/g, '').trim();

            return tx.customerOrder.create({
                data: {
                    orderNumber,
                    customerName: data.customerName.trim(),
                    customerPhone: data.customerPhone?.trim() || '',
                    customerEmail: data.customerEmail?.trim() || null,
                    total,
                    notes: cleanNotes || null,
                    orderType: 'quotation',
                    deliveryDate: data.validUntil ? new Date(data.validUntil) : null,
                    customerId: data.customerId || null,
                    companyId,
                    items: {
                        create: data.items.map((i: any) => ({
                            productId: i.productId || null,
                            productName: i.productName.trim(),
                            quantity: Number(i.quantity),
                            price: Number(i.price),
                            total: round2(Number(i.price) * Number(i.quantity)),
                        })),
                    },
                },
                include: {
                    customer: { select: { id: true, name: true } },
                    items: true,
                },
            });
        });

        return ResultHandler.success(result, 'Cotação criada com sucesso');
    }

    // ── Convert Quotation → Invoice ───────────────────────────────────────────

    async convertQuotationToInvoice(quotationId: string, data: any, companyId: string): Promise<Result<any>> {
        if (!companyId) throw ApiError.badRequest('Company not identified');

        const quotation = await prisma.customerOrder.findFirst({
            where: { id: quotationId, companyId, orderType: 'quotation' },
            include: { items: true }
        });
        if (!quotation) throw ApiError.notFound('Cotação não encontrada');
        if (quotation.status === 'cancelled') throw ApiError.badRequest('Não é possível converter uma cotação cancelada');

        const dueDays = Number(data.dueDays ?? 30);
        if (dueDays < 1) throw ApiError.badRequest('Prazo de vencimento inválido');

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + dueDays);

        const year = new Date().getFullYear();

        const result = await prisma.$transaction(async (tx) => {
            const invCount = await tx.invoice.count({ where: { companyId } });
            const invoiceNumber = `INV-${year}-${String(invCount + 1).padStart(5, '0')}`;

            const subtotal = Number(quotation.total);
            const taxRate = Number(data.taxRate ?? 0.16);
            const tax = round2(subtotal * taxRate);
            const total = round2(subtotal + tax);

            const created = await tx.invoice.create({
                data: {
                    invoiceNumber,
                    quotationId: quotation.id,
                    customerName: quotation.customerName,
                    customerEmail: quotation.customerEmail ?? null,
                    customerPhone: quotation.customerPhone ?? null,
                    customerId: quotation.customerId ?? null,
                    subtotal,
                    tax,
                    discount: 0,
                    total,
                    amountPaid: 0,
                    amountDue: total,
                    status: 'sent',
                    dueDate,
                    companyId,
                    items: {
                        create: quotation.items.map(item => ({
                            description: item.productName,
                            productId: item.productId ?? null,
                            quantity: item.quantity,
                            unitPrice: Number(item.price),
                            discount: 0,
                            ivaRate: taxRate * 100,
                            ivaAmount: round2(Number(item.price) * Number(item.quantity) * taxRate),
                            total: round2(Number(item.price) * Number(item.quantity) * (1 + taxRate)),
                        }))
                    }
                },
                include: {
                    customer: { select: { id: true, name: true } },
                    items: true,
                }
            });

            // Release reserved stock and mark quotation as completed
            for (const item of quotation.items) {
                if (item.productId) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { reservedStock: { decrement: Number(item.quantity) } }
                    });
                }
            }

            await tx.customerOrder.update({
                where: { id: quotationId },
                data: { status: 'completed' }
            });

            return created;
        });

        cacheService.invalidatePattern(`commercial:analytics:${companyId}`);

        return ResultHandler.success(result, 'Cotação convertida para fatura');
    }

    // ── Validate Supplier for PO Items ────────────────────────────────────────

    async validateSupplierProducts(supplierId: string, productIds: string[], companyId: string): Promise<void> {
        if (!productIds.length) return;

        const mismatchedProducts = await prisma.product.findMany({
            where: {
                id: { in: productIds },
                companyId,
                supplierId: { not: supplierId }
            },
            select: { name: true, supplierId: true }
        });

        if (mismatchedProducts.length > 0) {
            const names = mismatchedProducts.map(p => p.name).join(', ');
            throw ApiError.badRequest(`Os seguintes produtos não pertencem a este fornecedor: ${names}`);
        }
    }
    
    // ── Multi-Warehouse Intelligence ──────────────────────────────────────────
    
    async getWarehouseDistribution(companyId: string) {
        if (!companyId) throw ApiError.badRequest('Company not identified');

        const warehouses = await prisma.warehouse.findMany({
            where: { companyId, isActive: true },
            include: {
                stocks: {
                    include: {
                        product: { select: { costPrice: true, name: true, code: true } }
                    }
                }
            }
        });

        return warehouses.map(w => {
            const totalValue = w.stocks.reduce((sum, ws) => sum + (Number(ws.product.costPrice || 0) * ws.quantity), 0);
            const totalItems = w.stocks.reduce((sum, ws) => sum + ws.quantity, 0);
            
            // Top 5 products by value in this warehouse
            const topProducts = w.stocks
                .map(ws => ({
                    id: ws.id,
                    name: ws.product.name,
                    code: ws.product.code,
                    quantity: ws.quantity,
                    value: Math.round(Number(ws.product.costPrice || 0) * ws.quantity)
                }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 5);

            return {
                id: w.id,
                name: w.name,
                location: w.location,
                valuation: Math.round(totalValue),
                volume: totalItems,
                productCount: w.stocks.length,
                topProducts
            };
        }).sort((a, b) => b.valuation - a.valuation);
    }
    // ── Real-time Stock Reservations ──────────────────────────────────────────
    
    async reserveItem(params: { productId: string; quantity: number; sessionId?: string; companyId: string }) {
        const { productId, quantity, sessionId, companyId } = params;
        
        // 1. Verify availability including active reservations
        await stockService.validateAvailability(productId, quantity, companyId);
        
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 min TTL
        
        return await prisma.$transaction(async (tx) => {
            // Update product reservedStock
            await tx.product.update({
                where: { id: productId },
                data: { reservedStock: { increment: quantity } }
            });
            
            // Create reservation record
            return await (tx as any).stockReservation.create({
                data: {
                    productId,
                    quantity,
                    sessionId,
                    companyId,
                    expiresAt
                }
            });
        });
    }
    
    async releaseItem(reservationId: string, companyId: string) {
        const reservation = await (prisma as any).stockReservation.findFirst({
            where: { id: reservationId, companyId }
        });
        
        if (!reservation) return ResultHandler.success(true);
        
        return await prisma.$transaction(async (tx) => {
            // Decrement product reservedStock
            await tx.product.update({
                where: { id: reservation.productId },
                data: { reservedStock: { decrement: reservation.quantity } }
            });
            
            // Delete reservation record
            await (tx as any).stockReservation.delete({
                where: { id: reservationId }
            });
            
            return true;
        });
    }

    async cleanupExpiredReservations() {
        const now = new Date();
        const expired = await (prisma as any).stockReservation.findMany({
            where: { expiresAt: { lt: now } }
        });
        
        if (expired.length === 0) return;
        
        await prisma.$transaction(async (tx) => {
            for (const res of expired) {
                await tx.product.update({
                    where: { id: res.productId },
                    data: { reservedStock: { decrement: res.quantity } }
                });
            }
            
            await (tx as any).stockReservation.deleteMany({
                where: { id: { in: expired.map((e: any) => e.id) } }
            });
        });
    }
}

export const commercialService = new CommercialService();
