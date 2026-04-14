import { prisma } from '../lib/prisma';
import { subMonths, format, eachDayOfInterval, startOfDay, endOfDay } from 'date-fns';
import { ApiError } from '../middleware/error.middleware';
import { getPaginationParams, createPaginatedResponse } from '../utils/pagination';

export class RestaurantService {

    // =========================================================================
    // DASHBOARD
    // =========================================================================

    async getDashboard(companyId: string, range: string) {
        const months = range === '1M' ? 1 : range === '2M' ? 2 : range === '3M' ? 3 : range === '6M' ? 6 : 12;
        const cutoff = subMonths(new Date(), months);

        const [saleStats, tableStats, recentSales] = await Promise.all([
            prisma.sale.aggregate({
                where: { companyId, originModule: 'restaurant', createdAt: { gte: cutoff } },
                _sum: { total: true },
                _count: { id: true },
            }),
            prisma.restaurantTable.groupBy({
                by: ['status'],
                where: { companyId },
                _count: { id: true },
            }),
            prisma.sale.findMany({
                where: { companyId, originModule: 'restaurant', createdAt: { gte: cutoff } },
                select: { createdAt: true, total: true, receiptNumber: true, table: { select: { number: true, name: true } }, customer: { select: { name: true } } },
                orderBy: { createdAt: 'desc' },
                take: 10,
            }),
        ]);

        const totalSales = Number(saleStats._sum?.total || 0);
        const totalOrders = saleStats._count?.id || 0;
        const avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0;

        const tableStatusMap: Record<string, number> = {};
        tableStats.forEach(s => { tableStatusMap[s.status] = s._count.id; });
        const totalTables = Object.values(tableStatusMap).reduce((a, b) => a + b, 0);
        const occupiedTables = tableStatusMap['occupied'] || 0;

        // Build chart data grouped by day
        const days = eachDayOfInterval({ start: cutoff, end: new Date() });
        const salesByDay = await prisma.sale.findMany({
            where: { companyId, originModule: 'restaurant', createdAt: { gte: cutoff } },
            select: { createdAt: true, total: true },
        });
        const salesMap: Record<string, number> = {};
        salesByDay.forEach(s => {
            const key = format(s.createdAt, 'dd/MM');
            salesMap[key] = (salesMap[key] || 0) + Number(s.total);
        });
        const step = Math.max(1, Math.floor(days.length / 20));
        const chartData = days
            .filter((_, i) => i % step === 0)
            .map(d => ({ date: format(d, 'dd/MM'), amount: salesMap[format(d, 'dd/MM')] || 0 }));

        // Category breakdown via sale items
        const itemStats = await prisma.saleItem.findMany({
            where: { sale: { companyId, originModule: 'restaurant', createdAt: { gte: cutoff } } },
            select: { total: true, product: { select: { category: true } } },
        });
        const catMap: Record<string, number> = {};
        itemStats.forEach(i => {
            const cat = i.product?.category || 'outros';
            catMap[cat] = (catMap[cat] || 0) + Number(i.total);
        });
        const categoryData = Object.entries(catMap).map(([name, value]) => ({ name, value }));

        return {
            summary: { totalSales, totalOrders, avgTicket, totalTables, occupiedTables, availableTables: tableStatusMap['available'] || 0 },
            chartData,
            categoryData,
            recentActivity: recentSales,
        };
    }

    // =========================================================================
    // TABLES
    // =========================================================================

    async listTables(companyId: string, params: any) {
        const { page, limit, skip } = getPaginationParams(params);
        const where: any = { companyId };
        if (params.status) where.status = params.status;
        if (params.section) where.section = params.section;

        const [total, tables] = await Promise.all([
            prisma.restaurantTable.count({ where }),
            prisma.restaurantTable.findMany({
                where,
                include: {
                    sales: {
                        where: { originModule: 'restaurant' },
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                        select: { id: true, receiptNumber: true, total: true, createdAt: true, items: { select: { quantity: true, total: true, product: { select: { name: true } } } } },
                    },
                },
                orderBy: { number: 'asc' },
                skip,
                take: limit,
            }),
        ]);

        return createPaginatedResponse(tables, page, limit, total);
    }

    async getTableById(id: string, companyId: string) {
        const table = await prisma.restaurantTable.findFirst({
            where: { id, companyId },
            include: {
                sales: {
                    where: { originModule: 'restaurant' },
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                    include: { items: { include: { product: { select: { name: true, code: true } } } } },
                },
            },
        });
        if (!table) throw ApiError.notFound('Mesa não encontrada');
        return table;
    }

    async createTable(data: { number: number; name?: string; capacity?: number; section?: string; notes?: string }, companyId: string) {
        const existing = await prisma.restaurantTable.findFirst({ where: { companyId, number: data.number } });
        if (existing) throw new ApiError(409, `Mesa ${data.number} já existe`);

        return prisma.restaurantTable.create({
            data: { ...data, companyId, capacity: data.capacity || 4 },
        });
    }

    async updateTable(id: string, data: Partial<{ number: number; name: string; capacity: number; status: string; section: string; notes: string }>, companyId: string) {
        const table = await prisma.restaurantTable.findFirst({ where: { id, companyId } });
        if (!table) throw ApiError.notFound('Mesa não encontrada');

        if (data.number && data.number !== table.number) {
            const conflict = await prisma.restaurantTable.findFirst({ where: { companyId, number: data.number, id: { not: id } } });
            if (conflict) throw new ApiError(409, `Mesa ${data.number} já existe`);
        }

        return prisma.restaurantTable.update({ where: { id }, data });
    }

    async deleteTable(id: string, companyId: string) {
        const table = await prisma.restaurantTable.findFirst({ where: { id, companyId } });
        if (!table) throw ApiError.notFound('Mesa não encontrada');
        if (table.status === 'occupied') throw ApiError.badRequest('Não é possível eliminar uma mesa ocupada');
        await prisma.restaurantTable.delete({ where: { id } });
        return { success: true };
    }

    async updateTableStatus(id: string, status: string, companyId: string) {
        const table = await prisma.restaurantTable.findFirst({ where: { id, companyId } });
        if (!table) throw ApiError.notFound('Mesa não encontrada');
        return prisma.restaurantTable.update({ where: { id }, data: { status } });
    }

    // =========================================================================
    // REPORTS
    // =========================================================================

    async getReports(companyId: string, params: any) {
        const { startDate, endDate, page, limit } = params;
        const { skip } = getPaginationParams(params);

        const where: any = { companyId, originModule: 'restaurant' };
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = startOfDay(new Date(startDate));
            if (endDate) where.createdAt.lte = endOfDay(new Date(endDate));
        }

        const [total, sales, aggregates] = await Promise.all([
            prisma.sale.count({ where }),
            prisma.sale.findMany({
                where,
                include: {
                    table: { select: { number: true, name: true } },
                    customer: { select: { name: true } },
                    items: { include: { product: { select: { name: true, category: true } } } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: Number(limit) || 50,
            }),
            prisma.sale.aggregate({
                where,
                _sum: { total: true, subtotal: true, tax: true },
                _count: { id: true },
            }),
        ]);

        return {
            ...createPaginatedResponse(sales, Number(page) || 1, Number(limit) || 50, total),
            summary: {
                totalRevenue: Number(aggregates._sum?.total || 0),
                totalOrders: aggregates._count?.id || 0,
                avgTicket: aggregates._count?.id ? Number(aggregates._sum?.total || 0) / aggregates._count.id : 0,
            },
        };
    }
}

export const restaurantService = new RestaurantService();
