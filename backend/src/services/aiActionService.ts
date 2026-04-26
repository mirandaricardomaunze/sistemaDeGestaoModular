import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';

export class AIActionService {
    async executeAction(action: string, params: any, companyId: string): Promise<{ success: boolean; [key: string]: any }> {
        switch (action) {
            case 'get_sales_summary':        return this.getSalesSummary(companyId, params.period || 'today');
            case 'get_stock_alerts':         return this.getStockAlerts(companyId);
            case 'get_inventory_status':     return this.getInventoryStatus(companyId, params.search);
            case 'get_customers_summary':    return this.getCustomersSummary(companyId);
            case 'get_financial_overview':   return this.getFinancialOverview(companyId, params.period || '30');
            case 'get_employees_summary':    return this.getEmployeesSummary(companyId);
            case 'get_pending_orders':       return this.getPendingOrders(companyId);
            case 'get_invoices_summary':     return this.getInvoicesSummary(companyId);
            default: throw ApiError.badRequest(
                `Ação '${action}' não reconhecida. Ações disponíveis: get_sales_summary, get_stock_alerts, ` +
                `get_inventory_status, get_customers_summary, get_financial_overview, ` +
                `get_employees_summary, get_pending_orders, get_invoices_summary`
            );
        }
    }

    // ── Sales ─────────────────────────────────────────────────────────────────

    private async getSalesSummary(companyId: string, period: string) {
        const start = new Date();
        if (period === 'week')       start.setDate(start.getDate() - 7);
        else if (period === 'month') start.setDate(start.getDate() - 30);
        else                         start.setHours(0, 0, 0, 0); // today

        const [sales, topProducts] = await Promise.all([
            prisma.sale.aggregate({
                where: { companyId, createdAt: { gte: start } },
                _sum: { total: true },
                _count: true,
                _avg: { total: true },
            }),
            prisma.saleItem.groupBy({
                by: ['productId'],
                where: { productId: { not: null }, sale: { companyId, createdAt: { gte: start } } },
                _sum: { quantity: true, total: true },
                orderBy: { _sum: { total: 'desc' } },
                take: 5,
            }),
        ]);

        const productIds = topProducts.map(p => p.productId).filter(Boolean) as string[];
        const products = await prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true },
        });
        const nameMap = new Map(products.map(p => [p.id, p.name]));

        return {
            success: true,
            period,
            total_revenue_mzn: Number(sales._sum?.total || 0),
            total_sales_count: sales._count,
            average_sale_mzn:  Number(sales._avg?.total || 0),
            top_products: topProducts.map(p => ({
                name:          nameMap.get(p.productId!) || 'Desconhecido',
                quantity_sold: p._sum?.quantity || 0,
                revenue_mzn:   Number(p._sum?.total || 0),
            })),
        };
    }

    // ── Stock ─────────────────────────────────────────────────────────────────

    private async getStockAlerts(companyId: string) {
        const in30Days = new Date(Date.now() + 30 * 86400000);

        const [lowStock, outOfStock, expiringSoon] = await Promise.all([
            prisma.product.findMany({
                where: { companyId, isActive: true, currentStock: { gt: 0, lte: 10 } },
                select: { name: true, currentStock: true, minStock: true },
                orderBy: { currentStock: 'asc' },
                take: 10,
            }),
            prisma.product.count({ where: { companyId, isActive: true, currentStock: 0 } }),
            prisma.productBatch.count({
                where: {
                    product: { companyId },
                    expiryDate: { lte: in30Days, gte: new Date() },
                    quantity: { gt: 0 },
                },
            }),
        ]);

        return {
            success: true,
            low_stock_count:         lowStock.length,
            out_of_stock_count:      outOfStock,
            expiring_within_30_days: expiringSoon,
            low_stock_products: lowStock.map(p => ({
                name:          p.name,
                current_stock: p.currentStock,
                min_stock:     p.minStock,
            })),
        };
    }

    private async getInventoryStatus(companyId: string, search?: string) {
        const where: any = { companyId, isActive: true };
        if (search) where.name = { contains: search, mode: 'insensitive' };

        const [total, inStock, lowStock, outOfStock, topByStock] = await Promise.all([
            prisma.product.count({ where }),
            prisma.product.count({ where: { ...where, currentStock: { gt: 10 } } }),
            prisma.product.count({ where: { ...where, currentStock: { gt: 0, lte: 10 } } }),
            prisma.product.count({ where: { ...where, currentStock: 0 } }),
            prisma.product.findMany({
                where,
                select: { name: true, currentStock: true, costPrice: true },
                orderBy: { currentStock: 'desc' },
                take: 5,
            }),
        ]);

        return {
            success: true,
            total_products: total,
            in_stock:        inStock,
            low_stock:       lowStock,
            out_of_stock:    outOfStock,
            top_stocked: topByStock.map(p => ({
                name:                  p.name,
                stock:                 p.currentStock,
                estimated_value_mzn:   p.currentStock * Number(p.costPrice),
            })),
        };
    }

    // ── Customers ─────────────────────────────────────────────────────────────

    private async getCustomersSummary(companyId: string) {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

        const [total, newThisMonth, topCustomers, withBalance] = await Promise.all([
            prisma.customer.count({ where: { companyId } }),
            prisma.customer.count({ where: { companyId, createdAt: { gte: thirtyDaysAgo } } }),
            prisma.sale.groupBy({
                by: ['customerId'],
                where: { companyId, customerId: { not: null }, createdAt: { gte: thirtyDaysAgo } },
                _sum: { total: true },
                _count: { id: true },
                orderBy: { _sum: { total: 'desc' } },
                take: 5,
            }),
            prisma.customer.count({ where: { companyId, currentBalance: { gt: 0 } } }),
        ]);

        const customerIds = topCustomers.map(c => c.customerId).filter(Boolean) as string[];
        const customers = await prisma.customer.findMany({
            where: { id: { in: customerIds } },
            select: { id: true, name: true },
        });
        const nameMap = new Map(customers.map(c => [c.id, c.name]));

        return {
            success: true,
            total_customers:      total,
            new_this_month:       newThisMonth,
            customers_with_debt:  withBalance,
            top_customers_30d: topCustomers.map(c => ({
                name:            nameMap.get(c.customerId!) || 'Anónimo',
                purchases:       (c as any)._count.id,
                total_spent_mzn: Number(c._sum?.total || 0),
            })),
        };
    }

    // ── Finance ───────────────────────────────────────────────────────────────

    private async getFinancialOverview(companyId: string, periodDays: string) {
        const days  = Math.min(365, Math.max(1, parseInt(periodDays) || 30));
        const since = new Date(Date.now() - days * 86400000);

        const [revenue, expenses, overdueInvoices, pendingReceivables] = await Promise.all([
            prisma.sale.aggregate({
                where: { companyId, createdAt: { gte: since } },
                _sum: { total: true },
            }),
            prisma.transaction.aggregate({
                where: { companyId, type: 'expense', createdAt: { gte: since } },
                _sum: { amount: true },
            }),
            prisma.invoice.aggregate({
                where: { companyId, status: { in: ['sent', 'partial'] }, dueDate: { lt: new Date() }, amountDue: { gt: 0 } },
                _sum: { amountDue: true },
                _count: true,
            }),
            prisma.invoice.aggregate({
                where: { companyId, status: { in: ['draft', 'sent', 'partial'] }, amountDue: { gt: 0 } },
                _sum: { amountDue: true },
                _count: true,
            }),
        ]);

        const revenueVal  = Number(revenue._sum?.total || 0);
        const expensesVal = Number(expenses._sum?.amount || 0);

        return {
            success: true,
            period_days:  days,
            revenue_mzn:  revenueVal,
            expenses_mzn: expensesVal,
            profit_mzn:   revenueVal - expensesVal,
            overdue_invoices: {
                count:     overdueInvoices._count,
                total_mzn: Number(overdueInvoices._sum?.amountDue || 0),
            },
            pending_receivables: {
                count:     pendingReceivables._count,
                total_mzn: Number(pendingReceivables._sum?.amountDue || 0),
            },
        };
    }

    // ── HR ────────────────────────────────────────────────────────────────────

    private async getEmployeesSummary(companyId: string) {
        const now          = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear  = now.getFullYear();

        const [total, active, inactive, payrollThisMonth, pendingVacations] = await Promise.all([
            prisma.employee.count({ where: { companyId } }),
            prisma.employee.count({ where: { companyId, isActive: true } }),
            prisma.employee.count({ where: { companyId, isActive: false } }),
            prisma.payrollRecord.aggregate({
                where: { companyId, month: currentMonth, year: currentYear },
                _sum: { netSalary: true },
                _count: true,
            }),
            prisma.vacationRequest.count({ where: { employee: { companyId }, status: 'pending' } }),
        ]);

        return {
            success: true,
            total_employees: total,
            active:          active,
            inactive:        inactive,
            payroll_this_month: {
                processed:      payrollThisMonth._count,
                total_net_mzn:  Number(payrollThisMonth._sum?.netSalary || 0),
            },
            pending_vacation_requests: pendingVacations,
        };
    }

    // ── Orders ────────────────────────────────────────────────────────────────

    private async getPendingOrders(companyId: string) {
        const [pending, inProgress, purchaseOrdersOpen] = await Promise.all([
            prisma.customerOrder.count({ where: { companyId, status: 'created', orderType: 'order' } }),
            prisma.customerOrder.count({ where: { companyId, status: 'separated', orderType: 'order' } }),
            prisma.purchaseOrder.count({ where: { companyId, status: { in: ['draft', 'ordered'] }, deletedAt: null } }),
        ]);

        const recentOrders = await prisma.customerOrder.findMany({
            where:   { companyId, status: { in: ['created', 'separated'] }, orderType: 'order' },
            select:  { orderNumber: true, customerName: true, total: true, status: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take:    5,
        });

        return {
            success: true,
            customer_orders_pending:     pending,
            customer_orders_in_progress: inProgress,
            purchase_orders_open:        purchaseOrdersOpen,
            recent_orders: recentOrders.map(o => ({
                number:     o.orderNumber,
                customer:   o.customerName,
                total_mzn:  Number(o.total),
                status:     o.status,
            })),
        };
    }

    // ── Invoices ──────────────────────────────────────────────────────────────

    private async getInvoicesSummary(companyId: string) {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

        const [draft, sent, paid, partial, overdue, recentlyPaid, total] = await Promise.all([
            prisma.invoice.count({ where: { companyId, status: 'draft' } }),
            prisma.invoice.count({ where: { companyId, status: 'sent' } }),
            prisma.invoice.count({ where: { companyId, status: 'paid' } }),
            prisma.invoice.count({ where: { companyId, status: 'partial' } }),
            prisma.invoice.count({ where: { companyId, status: { in: ['sent', 'partial'] }, dueDate: { lt: new Date() } } }),
            prisma.invoice.aggregate({
                where:  { companyId, status: 'paid', updatedAt: { gte: thirtyDaysAgo } },
                _sum:   { total: true },
                _count: true,
            }),
            prisma.invoice.count({ where: { companyId } }),
        ]);

        return {
            success: true,
            total_invoices: total,
            by_status: { draft, sent, paid, partial, overdue },
            paid_last_30_days: {
                count:     recentlyPaid._count,
                total_mzn: Number(recentlyPaid._sum?.total || 0),
            },
        };
    }
}

export const aiActionService = new AIActionService();
