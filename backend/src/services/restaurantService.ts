import { prisma } from '../lib/prisma';
import { subMonths, format, eachDayOfInterval, startOfDay, endOfDay } from 'date-fns';
import { ApiError } from '../middleware/error.middleware';
import { getPaginationParams, createPaginatedResponse } from '../utils/pagination';
import { ResultHandler } from '../utils/result';

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

        return ResultHandler.success({
            summary: { totalSales, totalOrders, avgTicket, totalTables, occupiedTables, availableTables: tableStatusMap['available'] || 0 },
            chartData,
            categoryData,
            recentActivity: recentSales,
        });
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

        return ResultHandler.success(createPaginatedResponse(tables, page, limit, total));
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
        return ResultHandler.success(table);
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

    // =========================================================================
    // MENU ITEMS
    // =========================================================================

    async listMenuItems(companyId: string, params: any) {
        const { page, limit, skip } = getPaginationParams(params);
        const where: any = { companyId };
        if (params.category) where.category = params.category;
        if (params.isAvailable !== undefined) where.isAvailable = params.isAvailable === 'true' || params.isAvailable === true;
        if (params.search) where.name = { contains: params.search, mode: 'insensitive' };

        const [total, items] = await Promise.all([
            prisma.restaurantMenuItem.count({ where }),
            prisma.restaurantMenuItem.findMany({ where, orderBy: [{ category: 'asc' }, { name: 'asc' }], skip, take: limit }),
        ]);
        return createPaginatedResponse(items, page, limit, total);
    }

    async createMenuItem(companyId: string, data: any) {
        return prisma.restaurantMenuItem.create({
            data: {
                companyId,
                name: data.name,
                description: data.description,
                category: data.category || 'outros',
                price: Number(data.price),
                imageUrl: data.imageUrl,
                prepTime: data.prepTime ? Number(data.prepTime) : null,
                isAvailable: data.isAvailable !== undefined ? Boolean(data.isAvailable) : true,
                allergens: data.allergens,
                calories: data.calories ? Number(data.calories) : null,
                notes: data.notes,
            },
        });
    }

    async updateMenuItem(id: string, companyId: string, data: any) {
        const item = await prisma.restaurantMenuItem.findFirst({ where: { id, companyId } });
        if (!item) throw ApiError.notFound('Item de menu não encontrado');
        return prisma.restaurantMenuItem.update({ where: { id }, data: { ...data, price: data.price ? Number(data.price) : undefined } });
    }

    async deleteMenuItem(id: string, companyId: string) {
        const item = await prisma.restaurantMenuItem.findFirst({ where: { id, companyId } });
        if (!item) throw ApiError.notFound('Item de menu não encontrado');
        await prisma.restaurantMenuItem.delete({ where: { id } });
    }

    async toggleMenuItemAvailability(id: string, companyId: string, isAvailable: boolean) {
        const item = await prisma.restaurantMenuItem.findFirst({ where: { id, companyId } });
        if (!item) throw ApiError.notFound('Item de menu não encontrado');
        return prisma.restaurantMenuItem.update({ where: { id }, data: { isAvailable } });
    }

    // =========================================================================
    // KITCHEN ORDERS
    // =========================================================================

    private async generateOrderNumber(companyId: string): Promise<string> {
        const count = await prisma.restaurantOrder.count({ where: { companyId } });
        const d = new Date();
        return `ORD-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(count + 1).padStart(4, '0')}`;
    }

    async listOrders(companyId: string, params: any) {
        const where: any = { companyId };
        if (params.status) where.status = params.status;
        if (params.tableId) where.tableId = params.tableId;

        const orders = await prisma.restaurantOrder.findMany({
            where,
            include: {
                table: { select: { id: true, number: true, name: true } },
                items: { include: { menuItem: { select: { name: true, prepTime: true } } } },
            },
            orderBy: { createdAt: 'desc' },
            take: params.limit ? Number(params.limit) : 50,
        });
        return orders;
    }

    async createOrder(companyId: string, data: any) {
        const orderNumber = await this.generateOrderNumber(companyId);
        const items = data.items || [];
        const total = items.reduce((s: number, i: any) => s + Number(i.unitPrice) * Number(i.quantity), 0);

        const order = await prisma.restaurantOrder.create({
            data: {
                company: { connect: { id: companyId } },
                orderNumber,
                table: data.tableId ? { connect: { id: data.tableId } } : undefined,
                notes: data.notes,
                totalAmount: total,
                status: 'pending',
                items: {
                    create: items.map((i: any) => ({
                        menuItemId: i.menuItemId || null,
                        name: i.name,
                        quantity: Number(i.quantity),
                        unitPrice: Number(i.unitPrice),
                        notes: i.notes,
                    })),
                },
            },
            include: {
                table: { select: { id: true, number: true, name: true } },
                items: true,
            },
        });

        // If tableId provided, mark table as occupied
        if (data.tableId) {
            await prisma.restaurantTable.updateMany({
                where: { id: data.tableId, companyId, status: 'available' },
                data: { status: 'occupied' },
            });
        }

        return order;
    }

    async updateOrderStatus(id: string, companyId: string, status: string, notes?: string) {
        const order = await prisma.restaurantOrder.findFirst({ where: { id, companyId } });
        if (!order) throw ApiError.notFound('Pedido não encontrado');

        const updateData: any = { status };
        if (notes) updateData.notes = notes;
        if (status === 'ready') updateData.readyAt = new Date();
        if (status === 'served') updateData.servedAt = new Date();

        // When order is served/cancelled, free the table if no other open orders
        if ((status === 'served' || status === 'cancelled') && order.tableId) {
            const openOrders = await prisma.restaurantOrder.count({
                where: { tableId: order.tableId, companyId, status: { in: ['pending', 'preparing', 'ready'] }, id: { not: id } },
            });
            if (openOrders === 0) {
                await prisma.restaurantTable.updateMany({
                    where: { id: order.tableId, companyId },
                    data: { status: 'available' },
                });
            }
        }

        return prisma.restaurantOrder.update({
            where: { id },
            data: updateData,
            include: { table: { select: { id: true, number: true, name: true } }, items: true },
        });
    }

    // =========================================================================
    // RESERVATIONS
    // =========================================================================

    async listReservations(companyId: string, params: any) {
        const { page, limit, skip } = getPaginationParams(params);
        const where: any = { companyId };
        if (params.status) where.status = params.status;
        if (params.search) {
            where.OR = [
                { guestName: { contains: params.search, mode: 'insensitive' } },
                { guestPhone: { contains: params.search, mode: 'insensitive' } },
            ];
        }
        if (params.date) {
            const d = new Date(params.date);
            where.scheduledAt = { gte: startOfDay(d), lte: endOfDay(d) };
        }

        const [total, reservations] = await Promise.all([
            prisma.restaurantReservation.count({ where }),
            prisma.restaurantReservation.findMany({
                where,
                include: { table: { select: { id: true, number: true, name: true } } },
                orderBy: { scheduledAt: 'asc' },
                skip,
                take: limit,
            }),
        ]);
        return createPaginatedResponse(reservations, page, limit, total);
    }

    async createReservation(companyId: string, data: any) {
        if (!data.guestName || !data.guestPhone || !data.scheduledAt) {
            throw ApiError.badRequest('Nome, telefone e data/hora são obrigatórios');
        }
        return prisma.restaurantReservation.create({
            data: {
                companyId,
                guestName: data.guestName,
                guestPhone: data.guestPhone,
                guestEmail: data.guestEmail,
                partySize: Number(data.partySize) || 2,
                tableId: data.tableId || null,
                scheduledAt: new Date(data.scheduledAt),
                notes: data.notes,
                status: 'pending',
            },
            include: { table: { select: { id: true, number: true, name: true } } },
        });
    }

    async updateReservation(id: string, companyId: string, data: any) {
        const res = await prisma.restaurantReservation.findFirst({ where: { id, companyId } });
        if (!res) throw ApiError.notFound('Reserva não encontrada');
        return prisma.restaurantReservation.update({
            where: { id },
            data: {
                guestName: data.guestName,
                guestPhone: data.guestPhone,
                guestEmail: data.guestEmail,
                partySize: data.partySize ? Number(data.partySize) : undefined,
                tableId: data.tableId || null,
                scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
                notes: data.notes,
            },
            include: { table: { select: { id: true, number: true, name: true } } },
        });
    }

    async updateReservationStatus(id: string, companyId: string, status: string) {
        const res = await prisma.restaurantReservation.findFirst({ where: { id, companyId } });
        if (!res) throw ApiError.notFound('Reserva não encontrada');

        // When seated, mark table as occupied
        if (status === 'seated' && res.tableId) {
            await prisma.restaurantTable.updateMany({
                where: { id: res.tableId, companyId },
                data: { status: 'occupied' },
            });
        }
        // When cancelled/no_show, free the table
        if ((status === 'cancelled' || status === 'no_show') && res.tableId) {
            const otherReservations = await prisma.restaurantReservation.count({
                where: { tableId: res.tableId, companyId, status: { in: ['pending', 'confirmed', 'seated'] }, id: { not: id } },
            });
            if (otherReservations === 0) {
                await prisma.restaurantTable.updateMany({ where: { id: res.tableId, companyId }, data: { status: 'available' } });
            }
        }

        return prisma.restaurantReservation.update({ where: { id }, data: { status } });
    }

    async deleteReservation(id: string, companyId: string) {
        const res = await prisma.restaurantReservation.findFirst({ where: { id, companyId } });
        if (!res) throw ApiError.notFound('Reserva não encontrada');
        await prisma.restaurantReservation.delete({ where: { id } });
    }
}

export const restaurantService = new RestaurantService();
