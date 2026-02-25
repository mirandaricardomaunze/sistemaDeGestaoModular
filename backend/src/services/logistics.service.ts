import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { cacheService } from './cache.service';

export class LogisticsService {
    async getDashboard(companyId: string) {
        const cacheKey = `logistics:dashboard:${companyId}`;
        const cached = cacheService.get(cacheKey);
        if (cached) return cached;

        const [vehicles, drivers, routes, deliveries, parcels, recentDeliveries] = await Promise.all([
            prisma.vehicle.count({ where: { companyId } }),
            prisma.driver.count({ where: { companyId } }),
            prisma.deliveryRoute.count({ where: { companyId } }),
            prisma.delivery.count({ where: { companyId } }),
            prisma.parcel.count({ where: { companyId } }),
            prisma.delivery.findMany({
                where: { companyId }, take: 5, orderBy: { createdAt: 'desc' },
                include: { driver: true, vehicle: true, route: true }
            })
        ]);

        const [pendingDeliveries, inTransitDeliveries, deliveredToday] = await Promise.all([
            prisma.delivery.count({ where: { companyId, status: 'pending' } }),
            prisma.delivery.count({ where: { companyId, status: 'in_transit' } }),
            prisma.delivery.count({ where: { companyId, status: 'delivered', deliveredDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } })
        ]);

        const [availableVehicles, availableDrivers] = await Promise.all([
            prisma.vehicle.count({ where: { companyId, status: 'available' } }),
            prisma.driver.count({ where: { companyId, status: 'available' } })
        ]);

        const [pickupRevenue, deliveryRevenue] = await Promise.all([
            prisma.transaction.aggregate({ where: { companyId, module: 'logistics', type: 'income', parcelId: { not: null } }, _sum: { amount: true } }),
            prisma.transaction.aggregate({ where: { companyId, module: 'logistics', type: 'income', deliveryId: { not: null } }, _sum: { amount: true } })
        ]);

        const deliveriesByProvince = await prisma.delivery.groupBy({
            by: ['province'], where: { companyId, province: { not: null } }, _count: { id: true }
        });

        const result = {
            totals: { vehicles, drivers, routes, deliveries, parcels },
            stats: {
                pendingDeliveries, inTransitDeliveries, deliveredToday, availableVehicles, availableDrivers,
                pendingParcels: await prisma.parcel.count({ where: { companyId, status: { in: ['received', 'awaiting_pickup'] } } }),
                pickupRevenue: Number(pickupRevenue._sum?.amount || 0),
                deliveryRevenue: Number(deliveryRevenue._sum?.amount || 0),
                deliveriesByProvince: deliveriesByProvince.map(p => ({ province: p.province, count: (p as any)._count.id }))
            },
            recentDeliveries
        };

        cacheService.set(cacheKey, result, 120);
        return result;
    }

    // VEHICLES
    async getVehicles(companyId: string, query: any) {
        const { status, type, search, page = 1, limit = 20 } = query;
        const skip = (Number(page) - 1) * Number(limit);
        const where: any = { companyId };
        if (status) where.status = status;
        if (type) where.type = type;
        if (search) {
            where.OR = [
                { plate: { contains: search as string, mode: 'insensitive' } },
                { brand: { contains: search as string, mode: 'insensitive' } },
                { model: { contains: search as string, mode: 'insensitive' } }
            ];
        }

        const [vehicles, total] = await Promise.all([
            prisma.vehicle.findMany({ where, skip, take: Number(limit), orderBy: { createdAt: 'desc' }, include: { _count: { select: { deliveries: true } } } }),
            prisma.vehicle.count({ where })
        ]);

        return { data: vehicles, pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) } };
    }

    async createVehicle(companyId: string, data: any) {
        const existing = await prisma.vehicle.findFirst({ where: { companyId, plate: data.plate } });
        if (existing) throw ApiError.badRequest('Já existe um veículo com esta matrícula');
        return prisma.vehicle.create({ data: { ...data, companyId } });
    }

    // DELIVERIES
    async createDelivery(companyId: string, data: any) {
        const number = await this.generateDeliveryNumber(companyId);
        return prisma.$transaction(async (tx) => {
            const delivery = await tx.delivery.create({
                data: { ...data, number, companyId, items: data.items ? { create: data.items } : undefined },
                include: { driver: true, vehicle: true, route: true }
            });

            if (data.driverId && data.status === 'in_transit') {
                await tx.driver.update({ where: { id: data.driverId }, data: { status: 'on_delivery' } });
            }
            if (data.vehicleId && data.status === 'in_transit') {
                await tx.vehicle.update({ where: { id: data.vehicleId }, data: { status: 'in_use' } });
            }
            return delivery;
        });
    }

    private async generateDeliveryNumber(companyId: string): Promise<string> {
        const today = new Date();
        const prefix = `DEL-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
        const count = await prisma.delivery.count({ where: { companyId, number: { startsWith: prefix } } });
        return `${prefix}-${String(count + 1).padStart(4, '0')}`;
    }

    async updateDeliveryStatus(companyId: string, id: string, status: string, extra: any) {
        const existing = await prisma.delivery.findFirst({ where: { id, companyId } });
        if (!existing) throw ApiError.notFound('Entrega não encontrada');

        const updateData: any = { status };
        if (status === 'in_transit') updateData.departureDate = new Date();
        else if (status === 'delivered') {
            updateData.deliveredDate = new Date();
            if (extra.recipientSign) updateData.recipientSign = extra.recipientSign;
        } else if (status === 'failed') {
            updateData.failureReason = extra.failureReason;
            updateData.attempts = existing.attempts + 1;
        }

        return prisma.$transaction(async (tx) => {
            const delivery = await tx.delivery.update({ where: { id }, data: updateData });
            if (['delivered', 'failed', 'cancelled'].includes(status)) {
                if (existing.driverId) await tx.driver.update({ where: { id: existing.driverId }, data: { status: 'available' } });
                if (existing.vehicleId) await tx.vehicle.update({ where: { id: existing.vehicleId }, data: { status: 'available' } });
            }
            return delivery;
        });
    }

    // PARCELS
    async createParcel(companyId: string, data: any) {
        const trackingNumber = this.generateTrackingNumber();
        return prisma.parcel.create({
            data: { ...data, trackingNumber, status: 'received', companyId },
            include: { warehouse: true }
        });
    }

    private generateTrackingNumber(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = 'PKG';
        for (let i = 0; i < 9; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
        return result;
    }
}

export const logisticsService = new LogisticsService();
