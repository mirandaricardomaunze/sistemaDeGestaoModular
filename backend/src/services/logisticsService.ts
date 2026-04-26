import { randomBytes } from 'crypto';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { cacheService } from './cacheService';
import { getPaginationParams, createPaginatedResponse } from '../utils/pagination';
import { ResultHandler } from '../utils/result';

const DASHBOARD_CACHE_TTL = 120;
const DEFAULT_LIMIT = 20;

function paginationParams(query: any) {
    return getPaginationParams({ limit: DEFAULT_LIMIT, ...query });
}

export class LogisticsService {

    // ── Private helpers ───────────────────────────────────────────────────────

    private formatCode(prefix: string, count: number): string {
        return `${prefix}-${String(count + 1).padStart(4, '0')}`;
    }

    private async generateDriverCode(companyId: string): Promise<string> {
        const count = await prisma.driver.count({ where: { companyId } });
        return this.formatCode('DRV', count);
    }

    private async generateRouteCode(companyId: string): Promise<string> {
        const count = await prisma.deliveryRoute.count({ where: { companyId } });
        return this.formatCode('RTE', count);
    }

    private async generateDeliveryNumber(companyId: string): Promise<string> {
        const today = new Date();
        const prefix = `DEL-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
        const count = await prisma.delivery.count({ where: { companyId, number: { startsWith: prefix } } });
        return `${prefix}-${String(count + 1).padStart(4, '0')}`;
    }

    private generateTrackingNumber(): string {
        return 'PKG' + randomBytes(5).toString('hex').toUpperCase().slice(0, 9);
    }

    // ── Dashboard ─────────────────────────────────────────────────────────────

    async getDashboard(companyId: string) {
        const cacheKey = `logistics:dashboard:${companyId}`;
        const cached = cacheService.get(cacheKey);
        if (cached) return ResultHandler.success(cached);

        const todayStart = new Date(new Date().setHours(0, 0, 0, 0));

        // All independent queries in a single parallel batch
        const [
            vehicles, drivers, routes, deliveries, parcels, recentDeliveries,
            pendingDeliveries, inTransitDeliveries, deliveredToday,
            availableVehicles, availableDrivers,
            pickupRevenue, deliveryRevenue, deliveriesByProvince, pendingParcels
        ] = await Promise.all([
            prisma.vehicle.count({ where: { companyId } }),
            prisma.driver.count({ where: { companyId } }),
            prisma.deliveryRoute.count({ where: { companyId } }),
            prisma.delivery.count({ where: { companyId } }),
            prisma.parcel.count({ where: { companyId } }),
            prisma.delivery.findMany({
                where: { companyId }, take: 5, orderBy: { createdAt: 'desc' },
                include: { driver: true, vehicle: true, route: true }
            }),
            prisma.delivery.count({ where: { companyId, status: 'pending' } }),
            prisma.delivery.count({ where: { companyId, status: 'in_transit' } }),
            prisma.delivery.count({ where: { companyId, status: 'delivered', deliveredDate: { gte: todayStart } } }),
            prisma.vehicle.count({ where: { companyId, status: 'available' } }),
            prisma.driver.count({ where: { companyId, status: 'available' } }),
            prisma.transaction.aggregate({ where: { companyId, module: 'logistics', type: 'income', parcelId: { not: null } }, _sum: { amount: true } }),
            prisma.transaction.aggregate({ where: { companyId, module: 'logistics', type: 'income', deliveryId: { not: null } }, _sum: { amount: true } }),
            prisma.delivery.groupBy({ by: ['province'], where: { companyId, province: { not: null } }, _count: { id: true } }),
            prisma.parcel.count({ where: { companyId, status: { in: ['received', 'awaiting_pickup'] } } }),
        ]);

        const result = {
            totals: { vehicles, drivers, routes, deliveries, parcels },
            stats: {
                pendingDeliveries, inTransitDeliveries, deliveredToday,
                availableVehicles, availableDrivers, pendingParcels,
                pickupRevenue: Number(pickupRevenue._sum?.amount || 0),
                deliveryRevenue: Number(deliveryRevenue._sum?.amount || 0),
                deliveriesByProvince: deliveriesByProvince.map(p => ({ province: p.province, count: (p as any)._count.id }))
            },
            recentDeliveries
        };

        cacheService.set(cacheKey, result, DASHBOARD_CACHE_TTL);
        return ResultHandler.success(result);
    }

    // ── Vehicles ──────────────────────────────────────────────────────────────

    async getVehicles(companyId: string, query: any) {
        const { page, limit, skip } = paginationParams(query);
        const { status, type, search } = query;
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
            prisma.vehicle.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { _count: { select: { deliveries: true } } } }),
            prisma.vehicle.count({ where })
        ]);
        return ResultHandler.success(createPaginatedResponse(vehicles, page, limit, total));
    }

    async createVehicle(companyId: string, data: any) {
        const existing = await prisma.vehicle.findFirst({ where: { companyId, plate: data.plate } });
        if (existing) throw ApiError.badRequest('Já existe um veículo com esta matrícula');
        const vehicle = await prisma.vehicle.create({ data: { ...data, companyId } });
        return ResultHandler.success(vehicle);
    }

    async updateVehicle(companyId: string, id: string, data: any) {
        const vehicle = await prisma.vehicle.findFirst({ where: { id, companyId } });
        if (!vehicle) throw ApiError.notFound('Veículo não encontrado');
        try {
            return ResultHandler.success(await prisma.vehicle.update({ where: { id }, data }));
        } catch (e: any) {
            if (e.code === 'P2002') throw ApiError.badRequest('Já existe um veículo com esta matrícula');
            throw e;
        }
    }

    async deleteVehicle(companyId: string, id: string) {
        const vehicle = await prisma.vehicle.findFirst({
            where: { id, companyId }, include: { _count: { select: { deliveries: true } } }
        });
        if (!vehicle) throw ApiError.notFound('Veículo não encontrado');
        if (vehicle._count.deliveries > 0) throw ApiError.badRequest('Não é possível eliminar um veículo com entregas associadas');
        return prisma.vehicle.delete({ where: { id } });
    }

    // ── Drivers ───────────────────────────────────────────────────────────────

    async getDrivers(companyId: string, query: any) {
        const { page, limit, skip } = paginationParams(query);
        const { status, search } = query;
        const where: any = { companyId };
        if (status) where.status = status;
        if (search) {
            where.OR = [
                { name: { contains: search as string, mode: 'insensitive' } },
                { code: { contains: search as string, mode: 'insensitive' } }
            ];
        }
        const [drivers, total] = await Promise.all([
            prisma.driver.findMany({ where, skip, take: limit, orderBy: { name: 'asc' }, include: { _count: { select: { deliveries: true } } } }),
            prisma.driver.count({ where })
        ]);
        return ResultHandler.success(createPaginatedResponse(drivers, page, limit, total));
    }

    async getDriver(companyId: string, id: string) {
        const driver = await prisma.driver.findFirst({
            where: { id, companyId },
            include: {
                deliveries: { take: 10, orderBy: { createdAt: 'desc' }, include: { route: true, vehicle: true } },
                _count: { select: { deliveries: true } }
            }
        });
        if (!driver) throw ApiError.notFound('Motorista não encontrado');
        return ResultHandler.success(driver);
    }

    async createDriver(companyId: string, data: any) {
        const code = await this.generateDriverCode(companyId);
        return ResultHandler.success(await prisma.driver.create({ data: { ...data, code, companyId } }));
    }

    async updateDriver(companyId: string, id: string, data: any) {
        const driver = await prisma.driver.findFirst({ where: { id, companyId } });
        if (!driver) throw ApiError.notFound('Motorista não encontrado');
        return ResultHandler.success(await prisma.driver.update({ where: { id }, data }));
    }

    async deleteDriver(companyId: string, id: string) {
        const driver = await prisma.driver.findFirst({
            where: { id, companyId }, include: { _count: { select: { deliveries: true } } }
        });
        if (!driver) throw ApiError.notFound('Motorista não encontrado');
        if (driver._count.deliveries > 0) throw ApiError.badRequest('Não é possível eliminar um motorista com entregas associadas');
        return prisma.driver.delete({ where: { id } });
    }

    // ── Routes ────────────────────────────────────────────────────────────────

    async getRoutes(companyId: string, query: any) {
        const { page, limit, skip } = paginationParams(query);
        const { active, search } = query;
        const where: any = { companyId };
        if (active !== undefined) where.isActive = active === 'true';
        if (search) {
            where.OR = [
                { name: { contains: search as string, mode: 'insensitive' } },
                { code: { contains: search as string, mode: 'insensitive' } },
                { origin: { contains: search as string, mode: 'insensitive' } },
                { destination: { contains: search as string, mode: 'insensitive' } }
            ];
        }
        const [data, total] = await Promise.all([
            prisma.deliveryRoute.findMany({ where, skip, take: limit, orderBy: { name: 'asc' }, include: { _count: { select: { deliveries: true } } } }),
            prisma.deliveryRoute.count({ where })
        ]);
        return ResultHandler.success(createPaginatedResponse(data, page, limit, total));
    }

    async getRoute(companyId: string, id: string) {
        const route = await prisma.deliveryRoute.findFirst({
            where: { id, companyId }, include: { _count: { select: { deliveries: true } } }
        });
        if (!route) throw ApiError.notFound('Rota não encontrada');
        return ResultHandler.success(route);
    }

    async createRoute(companyId: string, data: any) {
        const code = await this.generateRouteCode(companyId);
        return ResultHandler.success(await prisma.deliveryRoute.create({ data: { ...data, code, companyId, isActive: data.isActive ?? true } }));
    }

    async updateRoute(companyId: string, id: string, data: any) {
        const route = await prisma.deliveryRoute.findFirst({ where: { id, companyId } });
        if (!route) throw ApiError.notFound('Rota não encontrada');
        return ResultHandler.success(await prisma.deliveryRoute.update({ where: { id }, data }));
    }

    async deleteRoute(companyId: string, id: string) {
        const route = await prisma.deliveryRoute.findFirst({
            where: { id, companyId }, include: { _count: { select: { deliveries: true } } }
        });
        if (!route) throw ApiError.notFound('Rota não encontrada');
        if (route._count.deliveries > 0) throw ApiError.badRequest('Não é possível eliminar uma rota com entregas associadas');
        return prisma.deliveryRoute.delete({ where: { id } });
    }

    // ── Deliveries ────────────────────────────────────────────────────────────

    async getDeliveries(companyId: string, query: any) {
        const { page, limit, skip } = paginationParams(query);
        const { status, priority, driverId, vehicleId, search, startDate, endDate } = query;
        const where: any = { companyId };
        if (status) where.status = status;
        if (priority) where.priority = priority;
        if (driverId) where.driverId = driverId;
        if (vehicleId) where.vehicleId = vehicleId;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate as string);
            if (endDate) where.createdAt.lte = new Date(endDate as string);
        }
        if (search) {
            where.OR = [
                { number: { contains: search as string, mode: 'insensitive' } },
                { recipientName: { contains: search as string, mode: 'insensitive' } }
            ];
        }
        const [deliveries, total] = await Promise.all([
            prisma.delivery.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { driver: true, vehicle: true, route: true, items: true } }),
            prisma.delivery.count({ where })
        ]);
        return ResultHandler.success({ deliveries, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
    }

    async getDelivery(companyId: string, id: string) {
        const delivery = await prisma.delivery.findFirst({
            where: { id, companyId }, include: { driver: true, vehicle: true, route: true, items: true }
        });
        if (!delivery) throw ApiError.notFound('Entrega não encontrada');
        return ResultHandler.success(delivery);
    }

    async createDelivery(companyId: string, data: any) {
        const number = await this.generateDeliveryNumber(companyId);
        return prisma.$transaction(async (tx) => {
            const delivery = await tx.delivery.create({
                data: {
                    ...data, number, companyId,
                    items: data.items?.length ? { create: data.items } : undefined
                },
                include: { driver: true, vehicle: true, route: true }
            });
            if (data.driverId && data.status === 'in_transit') {
                await tx.driver.update({ where: { id: data.driverId }, data: { status: 'on_delivery' } });
            }
            if (data.vehicleId && data.status === 'in_transit') {
                await tx.vehicle.update({ where: { id: data.vehicleId }, data: { status: 'in_use' } });
            }
            // Return raw entity — route accesses .driverId for socket emission before res.json
            return delivery;
        });
    }

    async updateDelivery(companyId: string, id: string, data: any) {
        const existing = await prisma.delivery.findFirst({ where: { id, companyId } });
        if (!existing) throw ApiError.notFound('Entrega não encontrada');
        const { items: _items, ...rest } = data;
        return ResultHandler.success(await prisma.delivery.update({ where: { id }, data: rest, include: { driver: true, vehicle: true, route: true, items: true } }));
    }

    async deleteDelivery(companyId: string, id: string) {
        const delivery = await prisma.delivery.findFirst({ where: { id, companyId } });
        if (!delivery) throw ApiError.notFound('Entrega não encontrada');
        if (['in_transit', 'out_for_delivery'].includes(delivery.status)) {
            throw ApiError.badRequest('Não é possível eliminar uma entrega em trânsito');
        }
        await prisma.deliveryItem.deleteMany({ where: { deliveryId: id } });
        return prisma.delivery.delete({ where: { id } });
    }

    async updateDeliveryStatus(companyId: string, id: string, status: string, extra: any) {
        const existing = await prisma.delivery.findFirst({ where: { id, companyId } });
        if (!existing) throw ApiError.notFound('Entrega não encontrada');

        const updateData: any = { status };
        if (status === 'in_transit') updateData.departureDate = new Date();
        else if (status === 'delivered') {
            updateData.deliveredDate = new Date();
            if (extra.recipientSign) updateData.recipientSign = extra.recipientSign;
            if (extra.proofOfDelivery) updateData.proofOfDelivery = extra.proofOfDelivery;
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
            return ResultHandler.success(delivery);
        });
    }

    async payDelivery(companyId: string, id: string, data: { paymentMethod: string; amount?: number }) {
        const delivery = await prisma.delivery.findFirst({ where: { id, companyId } });
        if (!delivery) throw ApiError.notFound('Entrega não encontrada');
        if (delivery.isPaid) throw ApiError.badRequest('Esta entrega já foi paga');

        return prisma.$transaction(async (tx) => {
            const updated = await tx.delivery.update({ where: { id }, data: { isPaid: true } });
            await tx.transaction.create({
                data: {
                    companyId, module: 'logistics', category: 'payment', type: 'income',
                    amount: data.amount ?? delivery.shippingCost ?? 0,
                    paymentMethod: data.paymentMethod as any,
                    deliveryId: id,
                    description: `Pagamento da entrega ${delivery.number}`
                }
            });
            return ResultHandler.success(updated);
        });
    }

    // ── Parcels ───────────────────────────────────────────────────────────────

    async getParcels(companyId: string, query: any) {
        const { page, limit, skip } = paginationParams(query);
        const { status, warehouseId, search } = query;
        const where: any = { companyId };
        if (status) where.status = status;
        if (warehouseId) where.warehouseId = warehouseId;
        if (search) {
            where.OR = [
                { trackingNumber: { contains: search as string, mode: 'insensitive' } },
                { recipientName: { contains: search as string, mode: 'insensitive' } },
                { senderName: { contains: search as string, mode: 'insensitive' } }
            ];
        }
        const [parcels, total] = await Promise.all([
            prisma.parcel.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { warehouse: true } }),
            prisma.parcel.count({ where })
        ]);
        return ResultHandler.success({ parcels, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
    }

    async getParcel(companyId: string, id: string) {
        const parcel = await prisma.parcel.findFirst({
            where: { id, companyId },
            include: { warehouse: true, notifications: { orderBy: { sentAt: 'desc' } } }
        });
        if (!parcel) throw ApiError.notFound('Encomenda não encontrada');
        return ResultHandler.success(parcel);
    }

    async trackParcel(companyId: string, trackingNumber: string) {
        const parcel = await prisma.parcel.findFirst({
            where: { trackingNumber, companyId },
            include: { warehouse: true, notifications: { orderBy: { sentAt: 'desc' } } }
        });
        if (!parcel) throw ApiError.notFound('Encomenda não encontrada');
        return ResultHandler.success(parcel);
    }

    async createParcel(companyId: string, data: any) {
        const parcel = await prisma.parcel.create({
            data: { ...data, trackingNumber: this.generateTrackingNumber(), status: 'received', companyId },
            include: { warehouse: true }
        });
        return ResultHandler.success(parcel);
    }

    async updateParcel(companyId: string, id: string, data: any) {
        const parcel = await prisma.parcel.findFirst({ where: { id, companyId } });
        if (!parcel) throw ApiError.notFound('Encomenda não encontrada');
        return ResultHandler.success(await prisma.parcel.update({ where: { id }, data, include: { warehouse: true } }));
    }

    async deleteParcel(companyId: string, id: string) {
        const parcel = await prisma.parcel.findFirst({ where: { id, companyId } });
        if (!parcel) throw ApiError.notFound('Encomenda não encontrada');
        if (parcel.status === 'picked_up') throw ApiError.badRequest('Não é possível eliminar uma encomenda já levantada');
        await prisma.parcelNotification.deleteMany({ where: { parcelId: id } });
        return prisma.parcel.delete({ where: { id } });
    }

    async registerParcelPickup(companyId: string, id: string, data: {
        pickedUpBy: string; pickedUpDocument?: string; pickupSignature?: string;
        paymentMethod?: string; isPaid?: boolean;
    }) {
        const parcel = await prisma.parcel.findFirst({ where: { id, companyId } });
        if (!parcel) throw ApiError.notFound('Encomenda não encontrada');
        if (parcel.status === 'picked_up') throw ApiError.badRequest('Encomenda já levantada');

        return prisma.$transaction(async (tx) => {
            const updated = await tx.parcel.update({
                where: { id },
                data: {
                    status: 'picked_up', pickedUpAt: new Date(),
                    pickedUpBy: data.pickedUpBy, pickedUpDocument: data.pickedUpDocument,
                    pickupSignature: data.pickupSignature,
                    isPaid: data.isPaid ?? parcel.isPaid,
                    paymentMethod: data.paymentMethod ?? parcel.paymentMethod
                },
                include: { warehouse: true }
            });
            if (data.isPaid && !parcel.isPaid && Number(parcel.fees) > 0) {
                await tx.transaction.create({
                    data: {
                        companyId, module: 'logistics', category: 'payment', type: 'income',
                        amount: parcel.fees,
                        paymentMethod: (data.paymentMethod || 'cash') as any,
                        parcelId: id,
                        description: `Levantamento da encomenda ${parcel.trackingNumber}`
                    }
                });
            }
            return ResultHandler.success(updated);
        });
    }

    async updateParcelStatus(companyId: string, id: string, status: string) {
        const parcel = await prisma.parcel.findFirst({ where: { id, companyId } });
        if (!parcel) throw ApiError.notFound('Encomenda não encontrada');
        return ResultHandler.success(await prisma.parcel.update({ where: { id }, data: { status: status as any } }));
    }

    async sendParcelNotification(companyId: string, id: string, data: { type?: string; recipient?: string; message: string }) {
        const parcel = await prisma.parcel.findFirst({ where: { id, companyId } });
        if (!parcel) throw ApiError.notFound('Encomenda não encontrada');
        return ResultHandler.success(await prisma.parcelNotification.create({
            data: {
                parcelId: id,
                type: (data.type || 'sms') as any,
                recipient: data.recipient || parcel.recipientPhone,
                message: data.message,
                sentAt: new Date(),
                status: 'sent'
            }
        }));
    }

    // ── Maintenance ───────────────────────────────────────────────────────────

    async getMaintenances(companyId: string, query: any) {
        const { page, limit, skip } = paginationParams(query);
        const { vehicleId, status } = query;
        const where: any = { vehicle: { companyId } };
        if (vehicleId) where.vehicleId = vehicleId;
        if (status) where.status = status;
        const [data, total] = await Promise.all([
            prisma.vehicleMaintenance.findMany({ where, skip, take: limit, orderBy: { date: 'desc' }, include: { vehicle: true } }),
            prisma.vehicleMaintenance.count({ where })
        ]);
        return ResultHandler.success(createPaginatedResponse(data, page, limit, total));
    }

    async createMaintenance(companyId: string, data: any) {
        const vehicle = await prisma.vehicle.findFirst({ where: { id: data.vehicleId, companyId } });
        if (!vehicle) throw ApiError.notFound('Veículo não encontrado');
        return prisma.$transaction(async (tx) => {
            const maintenance = await tx.vehicleMaintenance.create({ data: { ...data, date: new Date(data.date) }, include: { vehicle: true } });
            const vehicleUpdate: any = { lastMaintenance: new Date(data.date) };
            if (data.nextDate) vehicleUpdate.nextMaintenance = new Date(data.nextDate);
            if (data.mileageAt) vehicleUpdate.mileage = data.mileageAt;
            if (data.status === 'in_progress') vehicleUpdate.status = 'maintenance';
            await tx.vehicle.update({ where: { id: data.vehicleId }, data: vehicleUpdate });
            return ResultHandler.success(maintenance);
        });
    }

    async updateMaintenance(companyId: string, id: string, data: any) {
        const maintenance = await prisma.vehicleMaintenance.findFirst({ where: { id, vehicle: { companyId } } });
        if (!maintenance) throw ApiError.notFound('Manutenção não encontrada');
        return prisma.$transaction(async (tx) => {
            const updated = await tx.vehicleMaintenance.update({ where: { id }, data, include: { vehicle: true } });
            if (data.status === 'completed') {
                await tx.vehicle.update({ where: { id: maintenance.vehicleId }, data: { status: 'available' } });
            }
            return ResultHandler.success(updated);
        });
    }

    async deleteMaintenance(companyId: string, id: string) {
        const maintenance = await prisma.vehicleMaintenance.findFirst({ where: { id, vehicle: { companyId } } });
        if (!maintenance) throw ApiError.notFound('Manutenção não encontrada');
        return prisma.vehicleMaintenance.delete({ where: { id } });
    }

    // ── Fuel ──────────────────────────────────────────────────────────────────

    async getFuelSupplies(companyId: string, params: any) {
        const { page, limit, skip } = paginationParams(params);
        const { vehicleId, startDate, endDate } = params;
        const where: any = { companyId };
        if (vehicleId) where.vehicleId = vehicleId;
        if (startDate || endDate) {
            where.date = {};
            if (startDate) where.date.gte = new Date(startDate);
            if (endDate) where.date.lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
        }
        const [data, total] = await Promise.all([
            (prisma as any).fuelSupply.findMany({ where, include: { vehicle: { select: { id: true, plate: true, brand: true, model: true } } }, orderBy: { date: 'desc' }, skip, take: limit }),
            (prisma as any).fuelSupply.count({ where }),
        ]);
        return ResultHandler.success(createPaginatedResponse(data, page, limit, total));
    }

    async createFuelSupply(companyId: string, data: any) {
        const vehicle = await prisma.vehicle.findFirst({ where: { id: data.vehicleId, companyId } });
        if (!vehicle) throw ApiError.notFound('Veículo não encontrado');
        const supply = await (prisma as any).fuelSupply.create({
            data: {
                vehicleId: data.vehicleId, companyId,
                date: data.date ? new Date(data.date) : new Date(),
                liters: data.liters, pricePerLiter: data.pricePerLiter ?? null,
                amount: data.amount, mileage: data.mileage ?? 0,
                provider: data.provider ?? null, notes: data.notes ?? null,
            },
            include: { vehicle: { select: { id: true, plate: true, brand: true, model: true } } },
        });
        if (data.mileage && data.mileage > vehicle.mileage) {
            await prisma.vehicle.update({ where: { id: data.vehicleId }, data: { mileage: data.mileage } });
        }
        cacheService.del(`logistics:dashboard:${companyId}`);
        return ResultHandler.success(supply);
    }

    async deleteFuelSupply(companyId: string, id: string) {
        const supply = await (prisma as any).fuelSupply.findFirst({ where: { id, companyId } });
        if (!supply) throw ApiError.notFound('Abastecimento não encontrado');
        return (prisma as any).fuelSupply.delete({ where: { id } });
    }

    // ── Incidents ─────────────────────────────────────────────────────────────

    async getIncidents(companyId: string, params: any) {
        const { page, limit, skip } = paginationParams(params);
        const { vehicleId, driverId, type } = params;
        const where: any = { companyId };
        if (vehicleId) where.vehicleId = vehicleId;
        if (driverId) where.driverId = driverId;
        if (type) where.type = type;
        const [data, total] = await Promise.all([
            (prisma as any).vehicleIncident.findMany({
                where,
                include: {
                    vehicle: { select: { id: true, plate: true, brand: true, model: true } },
                    driver: { select: { id: true, name: true, code: true } },
                },
                orderBy: { date: 'desc' }, skip, take: limit,
            }),
            (prisma as any).vehicleIncident.count({ where }),
        ]);
        return ResultHandler.success(createPaginatedResponse(data, page, limit, total));
    }

    async createIncident(companyId: string, data: any) {
        const vehicle = await prisma.vehicle.findFirst({ where: { id: data.vehicleId, companyId } });
        if (!vehicle) throw ApiError.notFound('Veículo não encontrado');
        if (data.driverId) {
            const driver = await prisma.driver.findFirst({ where: { id: data.driverId, companyId } });
            if (!driver) throw ApiError.notFound('Motorista não encontrado');
        }
        const incident = await (prisma as any).vehicleIncident.create({
            data: {
                vehicleId: data.vehicleId, driverId: data.driverId ?? null, companyId,
                date: data.date ? new Date(data.date) : new Date(),
                type: data.type ?? 'other', severity: data.severity ?? 'low',
                description: data.description, cost: data.cost ?? null,
                location: data.location ?? null, status: data.status ?? 'open',
                notes: data.notes ?? null,
            },
            include: {
                vehicle: { select: { id: true, plate: true, brand: true, model: true } },
                driver: { select: { id: true, name: true, code: true } },
            },
        });
        if (data.type === 'breakdown' && data.severity !== 'low') {
            await prisma.vehicle.update({ where: { id: data.vehicleId }, data: { status: 'maintenance' } });
        }
        cacheService.del(`logistics:dashboard:${companyId}`);
        // Return raw entity — route accesses .id/.type for socket emission before res.json
        return incident;
    }

    async updateIncident(companyId: string, id: string, data: any) {
        const incident = await (prisma as any).vehicleIncident.findFirst({ where: { id, companyId } });
        if (!incident) throw ApiError.notFound('Incidente não encontrado');

        const updateData = Object.fromEntries(
            Object.entries({
                type: data.type, severity: data.severity, description: data.description,
                cost: data.cost, location: data.location, status: data.status, notes: data.notes,
                date: data.date ? new Date(data.date) : undefined,
            }).filter(([, v]) => v !== undefined)
        );

        const updated = await (prisma as any).vehicleIncident.update({
            where: { id }, data: updateData,
            include: {
                vehicle: { select: { id: true, plate: true, brand: true, model: true } },
                driver: { select: { id: true, name: true, code: true } },
            },
        });

        if ((data.status === 'resolved' || data.status === 'closed') && incident.type === 'breakdown') {
            const v = await prisma.vehicle.findFirst({ where: { id: incident.vehicleId, status: 'maintenance' } });
            if (v) await prisma.vehicle.update({ where: { id: incident.vehicleId }, data: { status: 'available' } });
        }

        cacheService.del(`logistics:dashboard:${companyId}`);
        return ResultHandler.success(updated);
    }

    async deleteIncident(companyId: string, id: string) {
        const incident = await (prisma as any).vehicleIncident.findFirst({ where: { id, companyId } });
        if (!incident) throw ApiError.notFound('Incidente não encontrado');
        return (prisma as any).vehicleIncident.delete({ where: { id } });
    }

    // ── Reports ───────────────────────────────────────────────────────────────

    async getReportsSummary(companyId: string, query: { startDate?: string; endDate?: string }) {
        const { startDate, endDate } = query;
        const where: any = { companyId };
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) where.createdAt.lte = new Date(endDate + 'T23:59:59.999Z');
        }

        const [total, delivered, failed, pending, inTransit, revenueAgg, avgTimeData, statusGroups,
               driverGroups, routeCountGroups, routeRevenueGroups] = await Promise.all([
            prisma.delivery.count({ where }),
            prisma.delivery.count({ where: { ...where, status: 'delivered' } }),
            prisma.delivery.count({ where: { ...where, status: 'failed' } }),
            prisma.delivery.count({ where: { ...where, status: 'pending' } }),
            prisma.delivery.count({ where: { ...where, status: 'in_transit' } }),
            prisma.delivery.aggregate({ where: { ...where, isPaid: true }, _sum: { shippingCost: true } }),
            prisma.delivery.findMany({
                where: { ...where, status: 'delivered', deliveredDate: { not: null } },
                select: { createdAt: true, deliveredDate: true }
            }),
            prisma.delivery.groupBy({ by: ['status'], where, _count: { id: true } }),
            // DB-level aggregation for driver performance — avoids loading all delivery rows
            prisma.delivery.groupBy({
                by: ['driverId', 'status'],
                where: { ...where, driverId: { not: null } },
                _count: { id: true }
            }),
            prisma.delivery.groupBy({
                by: ['routeId'],
                where: { ...where, routeId: { not: null } },
                _count: { id: true }
            }),
            prisma.delivery.groupBy({
                by: ['routeId'],
                where: { ...where, routeId: { not: null }, isPaid: true },
                _sum: { shippingCost: true }
            }),
        ]);

        const avgDeliveryHours = avgTimeData.length > 0
            ? avgTimeData.reduce((sum, d) => sum + (new Date(d.deliveredDate!).getTime() - new Date(d.createdAt).getTime()) / 3600000, 0) / avgTimeData.length
            : 0;

        // Resolve driver names for top results
        const driverIds = [...new Set(driverGroups.map(g => g.driverId).filter(Boolean))] as string[];
        const driverNames = await prisma.driver.findMany({ where: { id: { in: driverIds } }, select: { id: true, name: true } });
        const driverNameMap = new Map(driverNames.map(d => [d.id, d.name]));

        const driverStatsMap: Record<string, { name: string; total: number; delivered: number; failed: number }> = {};
        for (const g of driverGroups) {
            if (!g.driverId) continue;
            if (!driverStatsMap[g.driverId]) driverStatsMap[g.driverId] = { name: driverNameMap.get(g.driverId) || '', total: 0, delivered: 0, failed: 0 };
            driverStatsMap[g.driverId].total += (g as any)._count.id;
            if (g.status === 'delivered') driverStatsMap[g.driverId].delivered += (g as any)._count.id;
            if (g.status === 'failed') driverStatsMap[g.driverId].failed += (g as any)._count.id;
        }
        const driverPerformance = Object.values(driverStatsMap)
            .map(ds => ({ ...ds, successRate: ds.total > 0 ? (ds.delivered / ds.total) * 100 : 0 }))
            .sort((a, b) => b.total - a.total).slice(0, 10);

        // Resolve route names for top results
        const routeIds = [...new Set(routeCountGroups.map(g => g.routeId).filter(Boolean))] as string[];
        const routeNames = await prisma.deliveryRoute.findMany({ where: { id: { in: routeIds } }, select: { id: true, name: true } });
        const routeNameMap = new Map(routeNames.map(r => [r.id, r.name]));
        const revenueMap = new Map(routeRevenueGroups.map(g => [g.routeId, Number((g as any)._sum?.shippingCost || 0)]));

        const routeUsage = routeCountGroups
            .map(g => ({ name: routeNameMap.get(g.routeId!) || '', count: (g as any)._count.id, revenue: revenueMap.get(g.routeId!) || 0 }))
            .sort((a, b) => b.count - a.count).slice(0, 10);

        return ResultHandler.success({
            summary: {
                total, delivered, failed, pending, inTransit,
                successRate: total > 0 ? (delivered / total) * 100 : 0,
                totalRevenue: Number(revenueAgg._sum?.shippingCost || 0),
                avgDeliveryHours
            },
            statusDistribution: statusGroups.map((g: any) => ({ status: g.status, count: g._count.id })),
            driverPerformance,
            routeUsage
        });
    }

    // ── Staff HR (Attendance & Payroll) ───────────────────────────────────────

    private async findEmployeeForStaff(companyId: string, staffId: string) {
        // First check if staffId IS an employeeId
        const emp = await prisma.employee.findFirst({ where: { id: staffId, companyId } });
        if (emp) return emp;

        // Otherwise check if it's a Driver ID and find linked Employee
        const driver = await prisma.driver.findFirst({ where: { id: staffId, companyId } });
        if (!driver) return null;

        return prisma.employee.findFirst({
            where: {
                companyId,
                OR: [
                    { code: driver.code },
                    { email: driver.email || undefined }
                ]
            }
        });
    }

    async getStaffAttendance(companyId: string, query: { staffId?: string; startDate?: string; endDate?: string }) {
        const where: any = { companyId };
        if (query.staffId) {
            const employee = await this.findEmployeeForStaff(companyId, query.staffId);
            if (!employee) return ResultHandler.success([]);
            where.employeeId = employee.id;
        }
        if (query.startDate || query.endDate) {
            where.date = {};
            if (query.startDate) where.date.gte = new Date(query.startDate);
            if (query.endDate) where.date.lte = new Date(query.endDate + 'T23:59:59.999Z');
        }

        const attendance = await prisma.attendanceRecord.findMany({
            where,
            orderBy: { date: 'desc' },
            include: { employee: { select: { id: true, name: true, code: true } } }
        });

        // Map employeeId back to "staffId" expected by frontend if it was a driver
        return ResultHandler.success(attendance.map(a => ({
            ...a,
            staffId: query.staffId || a.employeeId
        })));
    }

    async recordStaffTime(companyId: string, data: { staffId: string; type: 'checkIn' | 'checkOut'; timestamp?: string; notes?: string }) {
        const employee = await this.findEmployeeForStaff(companyId, data.staffId);
        if (!employee) throw ApiError.notFound('Funcionário não encontrado no sistema de RH');

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const existing = await prisma.attendanceRecord.findUnique({
            where: { employeeId_date: { employeeId: employee.id, date: today } }
        });

        const time = data.timestamp ? new Date(data.timestamp) : new Date();

        if (data.type === 'checkIn') {
            if (existing && existing.checkIn) throw ApiError.badRequest('Check-in já realizado hoje');
            const record = await prisma.attendanceRecord.upsert({
                where: { employeeId_date: { employeeId: employee.id, date: today } },
                create: {
                    companyId,
                    employeeId: employee.id,
                    date: today,
                    checkIn: time,
                    status: 'present'
                },
                update: { checkIn: time, status: 'present' }
            });
            return ResultHandler.success(record);
        } else {
            if (!existing || !existing.checkIn) throw ApiError.badRequest('Check-in não encontrado para hoje');
            if (existing.checkOut) throw ApiError.badRequest('Check-out já realizado hoje');
            
            const hoursWorked = existing.checkIn 
                ? (time.getTime() - existing.checkIn.getTime()) / 3600000 
                : 0;

            const record = await prisma.attendanceRecord.update({
                where: { id: existing.id },
                data: {
                    checkOut: time,
                    hoursWorked: Number(hoursWorked.toFixed(2))
                }
            });
            return ResultHandler.success(record);
        }
    }

    async getStaffPayroll(companyId: string, query: { staffId?: string; month?: number; year?: number; status?: string }) {
        const where: any = { companyId };
        if (query.staffId) {
            const employee = await this.findEmployeeForStaff(companyId, query.staffId);
            if (!employee) return ResultHandler.success([]);
            where.employeeId = employee.id;
        }
        if (query.month) where.month = Number(query.month);
        if (query.year) where.year = Number(query.year);
        if (query.status) where.status = query.status;

        const payroll = await prisma.payrollRecord.findMany({
            where,
            orderBy: [{ year: 'desc' }, { month: 'desc' }],
            include: { employee: { select: { id: true, name: true, code: true } } }
        });

        return ResultHandler.success(payroll);
    }

    async createStaffPayroll(companyId: string, data: { staffId: string; month: number; year: number }) {
        const employee = await this.findEmployeeForStaff(companyId, data.staffId);
        if (!employee) throw ApiError.notFound('Funcionário não encontrado');

        const existing = await prisma.payrollRecord.findUnique({
            where: { employeeId_month_year: { employeeId: employee.id, month: data.month, year: data.year } }
        });
        if (existing) throw ApiError.badRequest('Folha de salário já existe para este período');

        // Basic calculation (real system would be more complex)
        const baseSalary = Number(employee.baseSalary);
        const totalEarnings = baseSalary; // + bonuses, etc.
        const totalDeductions = baseSalary * 0.03; // Simple 3% INSS
        const netSalary = totalEarnings - totalDeductions;

        const record = await prisma.payrollRecord.create({
            data: {
                companyId,
                employeeId: employee.id,
                month: data.month,
                year: data.year,
                baseSalary,
                totalEarnings,
                totalDeductions,
                netSalary,
                status: 'draft'
            }
        });

        return ResultHandler.success(record);
    }

    async updateStaffPayrollStatus(companyId: string, id: string, status: string) {
        const record = await prisma.payrollRecord.findFirst({ where: { id, companyId } });
        if (!record) throw ApiError.notFound('Folha de salário não encontrada');

        const updateData: any = { status };
        if (status === 'processed') updateData.processedAt = new Date();
        if (status === 'paid') updateData.paidAt = new Date();

        return ResultHandler.success(await prisma.payrollRecord.update({ where: { id }, data: updateData }));
    }
}

export const logisticsService = new LogisticsService();
