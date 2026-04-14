import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { cacheService } from './cache.service';
import { getPaginationParams, createPaginatedResponse } from '../utils/pagination';

// ============================================================================
// Commercial Analytics Service
// Premium commercial module: margin analysis, stock aging, supplier performance,
// inventory turnover, purchase order management
// ============================================================================

export class CommercialService {

    // ── Dashboard Analytics ───────────────────────────────────────────────────

    async getAnalytics(companyId: string) {
        if (!companyId) throw ApiError.badRequest('Company not identified');
        const cacheKey = `commercial:analytics:${companyId}`;

        return cacheService.getOrSet(cacheKey, async () => {
            const today = new Date();
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
            const start30Days = new Date(); start30Days.setDate(today.getDate() - 30);
            const start90Days = new Date(); start90Days.setDate(today.getDate() - 90);

            const [
                monthItems,
                lastMonthItems,
                allActiveProducts,
                pendingPOs,
                overduePOs,
                totalPOSpend,
            ] = await Promise.all([
                // Sale items this month with cost price
                prisma.saleItem.findMany({
                    where: { sale: { companyId, createdAt: { gte: startOfMonth, lte: endOfMonth } } },
                    include: { product: { select: { costPrice: true, category: true } } }
                }),
                // Last month items for comparison
                prisma.saleItem.findMany({
                    where: { sale: { companyId, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } },
                    include: { product: { select: { costPrice: true } } }
                }),
                // All active products
                prisma.product.findMany({
                    where: { companyId, isActive: true, originModule: 'commercial' },
                    select: { id: true, costPrice: true, price: true, currentStock: true, minStock: true, category: true }
                }),
                // Pending purchase orders count
                prisma.purchaseOrder.count({
                    where: { companyId, status: { in: ['draft', 'ordered'] } }
                }),
                // Overdue purchase orders
                prisma.purchaseOrder.count({
                    where: {
                        companyId,
                        status: { in: ['draft', 'ordered', 'partial'] },
                        expectedDeliveryDate: { lt: today }
                    }
                }),
                // Total PO spend this month
                prisma.purchaseOrder.aggregate({
                    where: { companyId, createdAt: { gte: startOfMonth } },
                    _sum: { total: true }
                })
            ]);

            // Revenue & COGS this month
            const revenue = monthItems.reduce((s, i) => s + Number(i.total), 0);
            const cogs = monthItems.reduce((s, i) => s + (Number(i.product?.costPrice ?? 0) * i.quantity), 0);
            const grossProfit = revenue - cogs;
            const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

            // Last month margin
            const lastRevenue = lastMonthItems.reduce((s, i) => s + Number(i.total), 0);
            const lastCogs = lastMonthItems.reduce((s, i) => s + (Number(i.product?.costPrice ?? 0) * i.quantity), 0);
            const lastMargin = lastRevenue > 0 ? ((lastRevenue - lastCogs) / lastRevenue) * 100 : 0;
            const marginTrend = grossMargin - lastMargin;

            // Inventory value
            const inventoryValue = allActiveProducts.reduce(
                (s, p) => s + Number(p.costPrice) * p.currentStock, 0
            );

            // Products needing reorder
            const reorderNeeded = allActiveProducts.filter(p => p.currentStock <= p.minStock).length;

            // Inventory turnover (COGS / avg inventory value)
            const avgInventory = inventoryValue > 0 ? inventoryValue : 1;
            const annualisedCogs = cogs * 12;
            const inventoryTurnover = avgInventory > 0 ? annualisedCogs / avgInventory : 0;

            // PO total spend this month
            const poSpend = Number(totalPOSpend._sum?.total ?? 0);

            return {
                revenue,
                cogs,
                grossProfit,
                grossMargin: Math.round(grossMargin * 100) / 100,
                marginTrend: Math.round(marginTrend * 100) / 100,
                inventoryValue: Math.round(inventoryValue),
                inventoryTurnover: Math.round(inventoryTurnover * 100) / 100,
                reorderNeeded,
                pendingPOs,
                overduePOs,
                poSpend,
                lastMonthMargin: Math.round(lastMargin * 100) / 100,
            };
        }, 300);
    }

    // ── Margin Analysis ───────────────────────────────────────────────────────

    async getMarginAnalysis(companyId: string, periodDays: number = 30) {
        if (!companyId) throw ApiError.badRequest('Company not identified');

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - periodDays);

        // Sale items with product cost in period
        const saleItems = await prisma.saleItem.findMany({
            where: { sale: { companyId, createdAt: { gte: startDate } } },
            include: {
                product: { select: { id: true, name: true, code: true, costPrice: true, category: true, categoryId: true } }
            }
        });

        // Margin by category
        const categoryMap: Record<string, { revenue: number; cogs: number; qty: number; name: string }> = {};
        const productMap: Record<string, { id: string; name: string; code: string; category: string; revenue: number; cogs: number; qty: number }> = {};

        for (const item of saleItems) {
            const rev = Number(item.total);
            const cost = Number(item.product?.costPrice ?? 0) * item.quantity;
            const cat = item.product?.category || 'other';

            // By category
            if (!categoryMap[cat]) categoryMap[cat] = { revenue: 0, cogs: 0, qty: 0, name: cat };
            categoryMap[cat].revenue += rev;
            categoryMap[cat].cogs += cost;
            categoryMap[cat].qty += item.quantity;

            // By product
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
            margin: c.revenue > 0 ? Math.round(((c.revenue - c.cogs) / c.revenue) * 10000) / 100 : 0,
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
            margin: p.revenue > 0 ? Math.round(((p.revenue - p.cogs) / p.revenue) * 10000) / 100 : 0,
            qty: p.qty
        })).sort((a, b) => b.profit - a.profit).slice(0, 50);

        // Monthly margin trend (last 6 months)
        const monthlyTrend: Array<{ month: string; revenue: number; cogs: number; margin: number }> = [];
        for (let m = 5; m >= 0; m--) {
            const mStart = new Date(new Date().getFullYear(), new Date().getMonth() - m, 1);
            const mEnd = new Date(new Date().getFullYear(), new Date().getMonth() - m + 1, 0);
            const items = await prisma.saleItem.findMany({
                where: { sale: { companyId, createdAt: { gte: mStart, lte: mEnd } } },
                include: { product: { select: { costPrice: true } } }
            });
            const mRev = items.reduce((s, i) => s + Number(i.total), 0);
            const mCogs = items.reduce((s, i) => s + Number(i.product?.costPrice ?? 0) * i.quantity, 0);
            monthlyTrend.push({
                month: `${mStart.getFullYear()}-${String(mStart.getMonth() + 1).padStart(2, '0')}`,
                revenue: Math.round(mRev),
                cogs: Math.round(mCogs),
                margin: mRev > 0 ? Math.round(((mRev - mCogs) / mRev) * 10000) / 100 : 0
            });
        }

        return { byCategory, byProduct, monthlyTrend };
    }

    // ── Stock Aging ───────────────────────────────────────────────────────────

    async getStockAging(companyId: string) {
        if (!companyId) throw ApiError.badRequest('Company not identified');

        const products = await prisma.product.findMany({
            where: { companyId, isActive: true, currentStock: { gt: 0 } },
            select: { id: true, name: true, code: true, category: true, currentStock: true, costPrice: true, price: true, updatedAt: true }
        });

        const today = new Date();

        // For each product, find the last sale date
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

            const stockValue = Number(p.costPrice) * p.currentStock;
            const potentialRevenue = Number(p.price) * p.currentStock;

            let agingBucket: 'fresh' | 'slow' | 'aging' | 'critical';
            if (daysSinceLastSale <= 30) agingBucket = 'fresh';
            else if (daysSinceLastSale <= 60) agingBucket = 'slow';
            else if (daysSinceLastSale <= 90) agingBucket = 'aging';
            else agingBucket = 'critical';

            return {
                id: p.id,
                name: p.name,
                code: p.code,
                category: p.category,
                currentStock: p.currentStock,
                stockValue: Math.round(stockValue),
                potentialRevenue: Math.round(potentialRevenue),
                daysSinceLastSale,
                lastSaleDate: lastSale?.toISOString() || null,
                agingBucket
            };
        });

        // Sort by critical first
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

        return { products: aged, summary };
    }

    // ── Supplier Performance ──────────────────────────────────────────────────

    async getSupplierPerformance(companyId: string) {
        if (!companyId) throw ApiError.badRequest('Company not identified');

        const suppliers = await prisma.supplier.findMany({
            where: { companyId, isActive: true },
            include: {
                purchaseOrders: {
                    where: { companyId },
                    select: {
                        id: true, status: true, total: true,
                        expectedDeliveryDate: true, receivedDate: true, createdAt: true
                    }
                },
                _count: { select: { products: true } }
            }
        });

        const today = new Date();

        return suppliers.map(s => {
            const orders = s.purchaseOrders;
            const totalOrders = orders.length;
            const totalSpend = orders.reduce((sum, o) => sum + Number(o.total), 0);
            const received = orders.filter(o => o.status === 'received');
            const onTime = received.filter(o =>
                o.receivedDate && o.expectedDeliveryDate && o.receivedDate <= o.expectedDeliveryDate
            ).length;
            const onTimeRate = received.length > 0 ? (onTime / received.length) * 100 : null;
            const pendingOrders = orders.filter(o => ['draft', 'ordered', 'partial'].includes(o.status)).length;
            const overdueOrders = orders.filter(o =>
                ['draft', 'ordered', 'partial'].includes(o.status) &&
                o.expectedDeliveryDate && o.expectedDeliveryDate < today
            ).length;
            const avgOrderValue = totalOrders > 0 ? totalSpend / totalOrders : 0;

            return {
                id: s.id,
                name: s.name,
                code: s.code,
                contactPerson: s.contactPerson,
                phone: s.phone,
                email: s.email,
                totalOrders,
                totalSpend: Math.round(totalSpend),
                avgOrderValue: Math.round(avgOrderValue),
                onTimeRate: onTimeRate !== null ? Math.round(onTimeRate * 100) / 100 : null,
                pendingOrders,
                overdueOrders,
                productCount: s._count.products,
                lastOrderDate: orders.length > 0
                    ? orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0].createdAt
                    : null
            };
        }).sort((a, b) => b.totalSpend - a.totalSpend);
    }

    // ── Purchase Orders (Global list + status management) ─────────────────────

    async listPurchaseOrders(companyId: string, params: any) {
        if (!companyId) throw ApiError.badRequest('Company not identified');
        const { page, limit, skip } = getPaginationParams(params);
        const { status, supplierId, search } = params;

        const where: any = { companyId };
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

        return createPaginatedResponse(orders, page, limit, total);
    }

    async getPurchaseOrderById(id: string, companyId: string) {
        const order = await prisma.purchaseOrder.findFirst({
            where: { id, companyId },
            include: {
                supplier: true,
                items: { include: { product: { select: { id: true, name: true, code: true, unit: true, costPrice: true } } } }
            }
        });
        if (!order) throw ApiError.notFound('Ordem de compra não encontrada');
        return order;
    }

    async updatePurchaseOrderStatus(id: string, status: string, companyId: string) {
        const allowed = ['draft', 'ordered', 'partial', 'received', 'cancelled'];
        if (!allowed.includes(status)) throw ApiError.badRequest('Status inválido');

        const order = await prisma.purchaseOrder.findFirst({ where: { id, companyId } });
        if (!order) throw ApiError.notFound('Ordem de compra não encontrada');

        const updated = await prisma.purchaseOrder.update({
            where: { id },
            data: {
                status: status as any,
                ...(status === 'received' ? { receivedDate: new Date() } : {})
            },
            include: {
                supplier: { select: { id: true, name: true } },
                items: { include: { product: { select: { id: true, name: true } } } }
            }
        });
        return updated;
    }

    async deletePurchaseOrder(id: string, companyId: string) {
        const order = await prisma.purchaseOrder.findFirst({ where: { id, companyId, status: 'draft' } });
        if (!order) throw ApiError.badRequest('Apenas ordens em rascunho podem ser eliminadas');
        await prisma.purchaseOrder.delete({ where: { id } });
        return true;
    }

    // ── Inventory Turnover by Category ────────────────────────────────────────

    async getInventoryTurnover(companyId: string, periodDays: number = 90) {
        if (!companyId) throw ApiError.badRequest('Company not identified');

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - periodDays);

        const saleItems = await prisma.saleItem.findMany({
            where: { sale: { companyId, createdAt: { gte: startDate } } },
            include: { product: { select: { costPrice: true, category: true, currentStock: true } } }
        });

        const products = await prisma.product.findMany({
            where: { companyId, isActive: true },
            select: { category: true, costPrice: true, currentStock: true }
        });

        // COGS by category in period
        const cogsByCategory: Record<string, number> = {};
        const inventoryByCategory: Record<string, number> = {};

        for (const item of saleItems) {
            const cat = item.product?.category || 'other';
            cogsByCategory[cat] = (cogsByCategory[cat] || 0) + Number(item.product?.costPrice ?? 0) * item.quantity;
        }

        for (const p of products) {
            const cat = p.category || 'other';
            inventoryByCategory[cat] = (inventoryByCategory[cat] || 0) + Number(p.costPrice) * p.currentStock;
        }

        const allCats = new Set([...Object.keys(cogsByCategory), ...Object.keys(inventoryByCategory)]);

        return Array.from(allCats).map(cat => {
            const cogs = cogsByCategory[cat] || 0;
            const inv = inventoryByCategory[cat] || 0;
            // Annualise the COGS
            const annualisedCogs = cogs * (365 / periodDays);
            const turnover = inv > 0 ? annualisedCogs / inv : 0;
            const daysOnHand = turnover > 0 ? 365 / turnover : 0;

            return {
                category: cat,
                cogs: Math.round(cogs),
                inventoryValue: Math.round(inv),
                turnover: Math.round(turnover * 100) / 100,
                daysOnHand: Math.round(daysOnHand)
            };
        }).sort((a, b) => b.turnover - a.turnover);
    }

    // ── Sales by Period (for report charts) ───────────────────────────────────

    async getSalesReport(companyId: string, periodDays: number = 30) {
        if (!companyId) throw ApiError.badRequest('Company not identified');

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - periodDays);

        const [salesByDay, topProducts, paymentMethods] = await Promise.all([
            // Daily sales
            prisma.sale.findMany({
                where: { companyId, createdAt: { gte: startDate } },
                select: { createdAt: true, total: true, paymentMethod: true }
            }),
            // Top products by revenue
            prisma.saleItem.groupBy({
                by: ['productId'],
                where: { sale: { companyId, createdAt: { gte: startDate } } },
                _sum: { total: true, quantity: true },
                orderBy: { _sum: { total: 'desc' } },
                take: 10
            }),
            // Payment methods
            prisma.sale.groupBy({
                by: ['paymentMethod'],
                where: { companyId, createdAt: { gte: startDate } },
                _sum: { total: true },
                _count: { id: true }
            })
        ]);

        // Group sales by day
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

        // Resolve product names
        const productIds = topProducts.map(t => t.productId).filter((id): id is string => id !== null);
        const productNames = await prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true, code: true, category: true }
        });
        const nameMap = new Map(productNames.map(p => [p.id, p]));

        const topProductsWithNames = topProducts.map(t => ({
            product: t.productId ? nameMap.get(t.productId) : undefined,
            revenue: Number(t._sum?.total || 0),
            qty: Number(t._sum?.quantity || 0)
        }));

        return {
            dailySales,
            topProducts: topProductsWithNames,
            paymentMethods: paymentMethods.map(pm => ({
                method: pm.paymentMethod,
                total: Number(pm._sum?.total || 0),
                count: pm._count.id
            }))
        };
    }

    // ── Accounts Receivable ───────────────────────────────────────────────────

    async getAccountsReceivable(companyId: string, params: any = {}) {
        if (!companyId) throw ApiError.badRequest('Company not identified');

        const { page, limit, skip } = getPaginationParams(params);
        const { status, search } = params;

        // Overdue or partially paid invoices (amount still due > 0)
        const where: any = {
            companyId,
            amountDue: { gt: 0 },
        };
        if (status === 'overdue') {
            where.dueDate = { lt: new Date() };
            where.status  = { in: ['sent', 'partial', 'overdue'] };
        } else if (status === 'pending') {
            where.status = { in: ['sent', 'partial'] };
            where.dueDate = { gte: new Date() };
        } else {
            where.status = { in: ['sent', 'partial', 'overdue'] };
        }
        if (search) {
            where.OR = [
                { customer: { name: { contains: String(search), mode: 'insensitive' } } },
                { number: { contains: String(search), mode: 'insensitive' } },
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
            const daysOverdue = inv.dueDate
                ? Math.max(0, Math.floor((today.getTime() - new Date(inv.dueDate).getTime()) / 86400000))
                : 0;
            return {
                id:          inv.id,
                number:      inv.invoiceNumber,
                customer:    inv.customer,
                total:       Number(inv.total),
                amountDue:   Number(inv.amountDue),
                amountPaid:  Number(inv.total) - Number(inv.amountDue),
                dueDate:     inv.dueDate,
                status:      inv.status,
                daysOverdue,
                isOverdue:   !!inv.dueDate && new Date(inv.dueDate) < today,
                createdAt:   inv.createdAt,
            };
        });

        // Summary
        const totalReceivable = invoices.reduce((s, i) => s + Number(i.amountDue), 0);
        const overdueAmount   = invoices
            .filter(i => i.dueDate && new Date(i.dueDate) < today)
            .reduce((s, i) => s + Number(i.amountDue), 0);

        return {
            ...createPaginatedResponse(data, page, limit, total),
            summary: {
                totalReceivable: Math.round(totalReceivable),
                overdueAmount:   Math.round(overdueAmount),
                invoiceCount:    total,
                overdueCount:    invoices.filter(i => i.dueDate && new Date(i.dueDate) < today).length,
            },
        };
    }

    // ── Quotations (CustomerOrder with type tag) ──────────────────────────────

    async listQuotations(companyId: string, params: any) {
        if (!companyId) throw ApiError.badRequest('Company not identified');
        const { page, limit, skip } = getPaginationParams(params);
        const { status, search } = params;

        const where: any = {
            companyId,
            notes: { contains: '__QUOTE__' },
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

        return createPaginatedResponse(quotes, page, limit, total);
    }

    async createQuotation(data: any, companyId: string) {
        if (!companyId) throw ApiError.badRequest('Company not identified');

        const count = await prisma.customerOrder.count({ where: { companyId } });
        const orderNumber = `ORC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
        const total = (data.items ?? []).reduce((s: number, i: any) => s + (i.price * i.quantity), 0);

        // Tag note with __QUOTE__ marker so we can filter quotations separately
        const notes = `__QUOTE__${data.notes ? '\n' + data.notes : ''}`;

        return prisma.customerOrder.create({
            data: {
                orderNumber,
                customerName:  data.customerName,
                customerPhone: data.customerPhone,
                customerEmail: data.customerEmail,
                total,
                notes,
                deliveryDate:  data.validUntil ? new Date(data.validUntil) : null,
                customerId:    data.customerId || null,
                companyId,
                items: {
                    create: (data.items ?? []).map((i: any) => ({
                        productId:   i.productId,
                        productName: i.productName,
                        quantity:    i.quantity,
                        price:       i.price,
                        total:       i.price * i.quantity,
                    })),
                },
            },
            include: {
                customer: { select: { id: true, name: true } },
                items: true,
            },
        });
    }
}

export const commercialService = new CommercialService();
