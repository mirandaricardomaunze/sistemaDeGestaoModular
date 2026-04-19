import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { cacheService } from './cacheService';
import { ResultHandler } from '../utils/result';

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

        const finalResult = ResultHandler.success(result);
        cacheService.set(cacheKey, result, 120);
        return finalResult;
    }

    // ============================================================================
    // VEHICLES
    // ============================================================================

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

        return ResultHandler.success({ data: vehicles, pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) } });
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
        if (data.plate && data.plate !== vehicle.plate) {
            const dup = await prisma.vehicle.findFirst({ where: { companyId, plate: data.plate, id: { not: id } } });
            if (dup) throw ApiError.badRequest('Já existe um veículo com esta matrícula');
        }
        return prisma.vehicle.update({ where: { id }, data });
    }

    async deleteVehicle(companyId: string, id: string) {
        const vehicle = await prisma.vehicle.findFirst({
            where: { id, companyId },
            include: { _count: { select: { deliveries: true } } }
        });
        if (!vehicle) throw ApiError.notFound('Veículo não encontrado');
        if ((vehicle._count as any).deliveries > 0) throw ApiError.badRequest('Não é possível eliminar um veículo com entregas associadas');
        return prisma.vehicle.delete({ where: { id } });
    }

    // ============================================================================
    // DRIVERS
    // ============================================================================

    async getDrivers(companyId: string, query: any) {
        const { status, search, page = 1, limit = 20 } = query;
        const skip = (Number(page) - 1) * Number(limit);
        const where: any = { companyId };
        if (status) where.status = status;
        if (search) {
            where.OR = [
                { name: { contains: search as string, mode: 'insensitive' } },
                { code: { contains: search as string, mode: 'insensitive' } }
            ];
        }
        const [drivers, total] = await Promise.all([
            prisma.driver.findMany({ where, skip, take: Number(limit), orderBy: { name: 'asc' }, include: { _count: { select: { deliveries: true } } } }),
            prisma.driver.count({ where })
        ]);
        return { data: drivers, pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) } };
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
        return driver;
    }

    async createDriver(companyId: string, data: any) {
        const code = await this.generateDriverCode(companyId);
        return prisma.driver.create({ data: { ...data, code, companyId } });
    }

    async updateDriver(companyId: string, id: string, data: any) {
        const driver = await prisma.driver.findFirst({ where: { id, companyId } });
        if (!driver) throw ApiError.notFound('Motorista não encontrado');
        return prisma.driver.update({ where: { id }, data });
    }

    async deleteDriver(companyId: string, id: string) {
        const driver = await prisma.driver.findFirst({
            where: { id, companyId },
            include: { _count: { select: { deliveries: true } } }
        });
        if (!driver) throw ApiError.notFound('Motorista não encontrado');
        if ((driver._count as any).deliveries > 0) throw ApiError.badRequest('Não é possível eliminar um motorista com entregas associadas');
        return prisma.driver.delete({ where: { id } });
    }

    private async generateDriverCode(companyId: string): Promise<string> {
        const count = await prisma.driver.count({ where: { companyId } });
        return `DRV-${String(count + 1).padStart(4, '0')}`;
    }

    // ============================================================================
    // DELIVERY ROUTES
    // ============================================================================

    async getRoutes(companyId: string, query: any) {
        const { active, search, page = 1, limit = 20 } = query;
        const skip = (Number(page) - 1) * Number(limit);
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
            prisma.deliveryRoute.findMany({ where, skip, take: Number(limit), orderBy: { name: 'asc' }, include: { _count: { select: { deliveries: true } } } }),
            prisma.deliveryRoute.count({ where })
        ]);
        return { data, pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) } };
    }

    async getRoute(companyId: string, id: string) {
        const route = await prisma.deliveryRoute.findFirst({
            where: { id, companyId },
            include: { _count: { select: { deliveries: true } } }
        });
        if (!route) throw ApiError.notFound('Rota não encontrada');
        return route;
    }

    async createRoute(companyId: string, data: any) {
        const code = await this.generateRouteCode(companyId);
        return prisma.deliveryRoute.create({ data: { ...data, code, companyId, isActive: data.isActive ?? true } });
    }

    async updateRoute(companyId: string, id: string, data: any) {
        const route = await prisma.deliveryRoute.findFirst({ where: { id, companyId } });
        if (!route) throw ApiError.notFound('Rota não encontrada');
        return prisma.deliveryRoute.update({ where: { id }, data });
    }

    async deleteRoute(companyId: string, id: string) {
        const route = await prisma.deliveryRoute.findFirst({
            where: { id, companyId },
            include: { _count: { select: { deliveries: true } } }
        });
        if (!route) throw ApiError.notFound('Rota não encontrada');
        if ((route._count as any).deliveries > 0) throw ApiError.badRequest('Não é possível eliminar uma rota com entregas associadas');
        return prisma.deliveryRoute.delete({ where: { id } });
    }

    private async generateRouteCode(companyId: string): Promise<string> {
        const count = await prisma.deliveryRoute.count({ where: { companyId } });
        return `RTE-${String(count + 1).padStart(4, '0')}`;
    }

    // ============================================================================
    // DELIVERIES
    // ============================================================================

    async getDeliveries(companyId: string, query: any) {
        const { status, priority, driverId, vehicleId, search, startDate, endDate, page = 1, limit = 20 } = query;
        const skip = (Number(page) - 1) * Number(limit);
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
            prisma.delivery.findMany({ where, skip, take: Number(limit), orderBy: { createdAt: 'desc' }, include: { driver: true, vehicle: true, route: true, items: true } }),
            prisma.delivery.count({ where })
        ]);
        return { deliveries, pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } };
    }

    async getDelivery(companyId: string, id: string) {
        const delivery = await prisma.delivery.findFirst({
            where: { id, companyId },
            include: { driver: true, vehicle: true, route: true, items: true }
        });
        if (!delivery) throw ApiError.notFound('Entrega não encontrada');
        return delivery;
    }

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

    async updateDelivery(companyId: string, id: string, data: any) {
        const existing = await prisma.delivery.findFirst({ where: { id, companyId } });
        if (!existing) throw ApiError.notFound('Entrega não encontrada');
        const { items, ...rest } = data;
        return prisma.delivery.update({ where: { id }, data: rest, include: { driver: true, vehicle: true, route: true, items: true } });
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
            return delivery;
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
                    companyId,
                    module: 'logistics',
                    category: 'payment',
                    type: 'income',
                    amount: data.amount ?? delivery.shippingCost ?? 0,
                    paymentMethod: data.paymentMethod as any,
                    deliveryId: id,
                    description: `Pagamento da entrega ${delivery.number}`
                }
            });
            return updated;
        });
    }

    // ============================================================================
    // PARCELS
    // ============================================================================

    async getParcels(companyId: string, query: any) {
        const { status, warehouseId, search, page = 1, limit = 20 } = query;
        const skip = (Number(page) - 1) * Number(limit);
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
            prisma.parcel.findMany({ where, skip, take: Number(limit), orderBy: { createdAt: 'desc' }, include: { warehouse: true } }),
            prisma.parcel.count({ where })
        ]);
        return { parcels, pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } };
    }

    async getParcel(companyId: string, id: string) {
        const parcel = await prisma.parcel.findFirst({
            where: { id, companyId },
            include: { warehouse: true, notifications: { orderBy: { sentAt: 'desc' } } }
        });
        if (!parcel) throw ApiError.notFound('Encomenda não encontrada');
        return parcel;
    }

    async trackParcel(companyId: string, trackingNumber: string) {
        const parcel = await prisma.parcel.findFirst({
            where: { trackingNumber, companyId },
            include: { warehouse: true, notifications: { orderBy: { sentAt: 'desc' } } }
        });
        if (!parcel) throw ApiError.notFound('Encomenda não encontrada');
        return parcel;
    }

    async createParcel(companyId: string, data: any) {
        const trackingNumber = this.generateTrackingNumber();
        return prisma.parcel.create({
            data: { ...data, trackingNumber, status: 'received', companyId },
            include: { warehouse: true }
        });
    }

    async updateParcel(companyId: string, id: string, data: any) {
        const parcel = await prisma.parcel.findFirst({ where: { id, companyId } });
        if (!parcel) throw ApiError.notFound('Encomenda não encontrada');
        return prisma.parcel.update({ where: { id }, data, include: { warehouse: true } });
    }

    async deleteParcel(companyId: string, id: string) {
        const parcel = await prisma.parcel.findFirst({ where: { id, companyId } });
        if (!parcel) throw ApiError.notFound('Encomenda não encontrada');
        if (parcel.status === 'picked_up') throw ApiError.badRequest('Não é possível eliminar uma encomenda já levantada');
        await prisma.parcelNotification.deleteMany({ where: { parcelId: id } });
        return prisma.parcel.delete({ where: { id } });
    }

    async registerParcelPickup(companyId: string, id: string, data: {
        pickedUpBy: string;
        pickedUpDocument?: string;
        pickupSignature?: string;
        paymentMethod?: string;
        isPaid?: boolean;
    }) {
        const parcel = await prisma.parcel.findFirst({ where: { id, companyId } });
        if (!parcel) throw ApiError.notFound('Encomenda não encontrada');
        if (parcel.status === 'picked_up') throw ApiError.badRequest('Encomenda já levantada');

        return prisma.$transaction(async (tx) => {
            const updated = await tx.parcel.update({
                where: { id },
                data: {
                    status: 'picked_up',
                    pickedUpAt: new Date(),
                    pickedUpBy: data.pickedUpBy,
                    pickedUpDocument: data.pickedUpDocument,
                    pickupSignature: data.pickupSignature,
                    isPaid: data.isPaid ?? parcel.isPaid,
                    paymentMethod: data.paymentMethod ?? parcel.paymentMethod
                },
                include: { warehouse: true }
            });

            if (data.isPaid && !parcel.isPaid && Number(parcel.fees) > 0) {
                await tx.transaction.create({
                    data: {
                        companyId,
                        module: 'logistics',
                        category: 'payment',
                        type: 'income',
                        amount: parcel.fees,
                        paymentMethod: (data.paymentMethod || 'cash') as any,
                        parcelId: id,
                        description: `Levantamento da encomenda ${parcel.trackingNumber}`
                    }
                });
            }
            return updated;
        });
    }

    async updateParcelStatus(companyId: string, id: string, status: string) {
        const parcel = await prisma.parcel.findFirst({ where: { id, companyId } });
        if (!parcel) throw ApiError.notFound('Encomenda não encontrada');
        return prisma.parcel.update({ where: { id }, data: { status: status as any } });
    }

    async sendParcelNotification(companyId: string, id: string, data: { type?: string; recipient?: string; message: string }) {
        const parcel = await prisma.parcel.findFirst({ where: { id, companyId } });
        if (!parcel) throw ApiError.notFound('Encomenda não encontrada');
        return prisma.parcelNotification.create({
            data: {
                parcelId: id,
                type: (data.type || 'sms') as any,
                recipient: data.recipient || parcel.recipientPhone,
                message: data.message,
                sentAt: new Date(),
                status: 'sent'
            }
        });
    }

    private generateTrackingNumber(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = 'PKG';
        for (let i = 0; i < 9; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
        return result;
    }

    // ============================================================================
    // VEHICLE MAINTENANCE
    // ============================================================================

    async getMaintenances(companyId: string, query: any) {
        const { vehicleId, status, page = 1, limit = 20 } = query;
        const skip = (Number(page) - 1) * Number(limit);
        const where: any = { vehicle: { companyId } };
        if (vehicleId) where.vehicleId = vehicleId;
        if (status) where.status = status;
        const [data, total] = await Promise.all([
            prisma.vehicleMaintenance.findMany({ where, skip, take: Number(limit), orderBy: { date: 'desc' }, include: { vehicle: true } }),
            prisma.vehicleMaintenance.count({ where })
        ]);
        return { data, pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) } };
    }

    async createMaintenance(companyId: string, data: any) {
        const vehicle = await prisma.vehicle.findFirst({ where: { id: data.vehicleId, companyId } });
        if (!vehicle) throw ApiError.notFound('Veículo não encontrado');

        return prisma.$transaction(async (tx) => {
            const maintenance = await tx.vehicleMaintenance.create({
                data: { ...data, date: new Date(data.date) },
                include: { vehicle: true }
            });
            // Update vehicle last/next maintenance dates
            const updateVehicle: any = { lastMaintenance: new Date(data.date) };
            if (data.nextDate) updateVehicle.nextMaintenance = new Date(data.nextDate);
            if (data.mileageAt) updateVehicle.mileage = data.mileageAt;
            if (data.status === 'in_progress') updateVehicle.status = 'maintenance';
            await tx.vehicle.update({ where: { id: data.vehicleId }, data: updateVehicle });
            return maintenance;
        });
    }

    async updateMaintenance(companyId: string, id: string, data: any) {
        const maintenance = await prisma.vehicleMaintenance.findFirst({
            where: { id, vehicle: { companyId } }
        });
        if (!maintenance) throw ApiError.notFound('Manutenção não encontrada');

        return prisma.$transaction(async (tx) => {
            const updated = await tx.vehicleMaintenance.update({
                where: { id },
                data,
                include: { vehicle: true }
            });
            // If completed, set vehicle back to available
            if (data.status === 'completed') {
                await tx.vehicle.update({ where: { id: maintenance.vehicleId }, data: { status: 'available' } });
            }
            return updated;
        });
    }

    async deleteMaintenance(companyId: string, id: string) {
        const maintenance = await prisma.vehicleMaintenance.findFirst({
            where: { id, vehicle: { companyId } }
        });
        if (!maintenance) throw ApiError.notFound('Manutenção não encontrada');
        return prisma.vehicleMaintenance.delete({ where: { id } });
    }

    // ============================================================================
    // FUEL SUPPLIES
    // ============================================================================

    async getFuelSupplies(companyId: string, params: any) {
        const { vehicleId, startDate, endDate, page = 1, limit = 20 } = params;
        const skip = (Number(page) - 1) * Number(limit);

        const where: any = { companyId };
        if (vehicleId) where.vehicleId = vehicleId;
        if (startDate || endDate) {
            where.date = {};
            if (startDate) where.date.gte = new Date(startDate);
            if (endDate) where.date.lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
        }

        const [data, total] = await Promise.all([
            (prisma as any).fuelSupply.findMany({
                where,
                include: { vehicle: { select: { id: true, plate: true, brand: true, model: true } } },
                orderBy: { date: 'desc' },
                skip,
                take: Number(limit),
            }),
            (prisma as any).fuelSupply.count({ where }),
        ]);

        return {
            data,
            pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) },
        };
    }

    async createFuelSupply(companyId: string, data: any) {
        const vehicle = await prisma.vehicle.findFirst({ where: { id: data.vehicleId, companyId } });
        if (!vehicle) throw ApiError.notFound('Veículo não encontrado');

        const supply = await (prisma as any).fuelSupply.create({
            data: {
                vehicleId: data.vehicleId,
                companyId,
                date: data.date ? new Date(data.date) : new Date(),
                liters: data.liters,
                pricePerLiter: data.pricePerLiter ?? null,
                amount: data.amount,
                mileage: data.mileage ?? 0,
                provider: data.provider ?? null,
                notes: data.notes ?? null,
            },
            include: { vehicle: { select: { id: true, plate: true, brand: true, model: true } } },
        });

        // Update vehicle mileage if higher than current
        if (data.mileage && data.mileage > vehicle.mileage) {
            await prisma.vehicle.update({ where: { id: data.vehicleId }, data: { mileage: data.mileage } });
        }

        cacheService.del(`logistics:dashboard:${companyId}`);
        return supply;
    }

    async deleteFuelSupply(companyId: string, id: string) {
        const supply = await (prisma as any).fuelSupply.findFirst({ where: { id, companyId } });
        if (!supply) throw ApiError.notFound('Abastecimento não encontrado');
        return (prisma as any).fuelSupply.delete({ where: { id } });
    }

    // ============================================================================
    // VEHICLE INCIDENTS
    // ============================================================================

    async getIncidents(companyId: string, params: any) {
        const { vehicleId, driverId, type, page = 1, limit = 20 } = params;
        const skip = (Number(page) - 1) * Number(limit);

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
                orderBy: { date: 'desc' },
                skip,
                take: Number(limit),
            }),
            (prisma as any).vehicleIncident.count({ where }),
        ]);

        return {
            data,
            pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) },
        };
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
                vehicleId: data.vehicleId,
                driverId: data.driverId ?? null,
                companyId,
                date: data.date ? new Date(data.date) : new Date(),
                type: data.type ?? 'other',
                severity: data.severity ?? 'low',
                description: data.description,
                cost: data.cost ?? null,
                location: data.location ?? null,
                status: data.status ?? 'open',
                notes: data.notes ?? null,
            },
            include: {
                vehicle: { select: { id: true, plate: true, brand: true, model: true } },
                driver: { select: { id: true, name: true, code: true } },
            },
        });

        // If breakdown or accident, set vehicle to maintenance/inactive
        if (data.type === 'breakdown' && data.severity !== 'low') {
            await prisma.vehicle.update({ where: { id: data.vehicleId }, data: { status: 'maintenance' } });
        }

        cacheService.del(`logistics:dashboard:${companyId}`);
        return incident;
    }

    async updateIncident(companyId: string, id: string, data: any) {
        const incident = await (prisma as any).vehicleIncident.findFirst({ where: { id, companyId } });
        if (!incident) throw ApiError.notFound('Incidente não encontrado');

        const updated = await (prisma as any).vehicleIncident.update({
            where: { id },
            data: {
                ...(data.type && { type: data.type }),
                ...(data.severity && { severity: data.severity }),
                ...(data.description && { description: data.description }),
                ...(data.cost !== undefined && { cost: data.cost }),
                ...(data.location !== undefined && { location: data.location }),
                ...(data.status && { status: data.status }),
                ...(data.notes !== undefined && { notes: data.notes }),
                ...(data.date && { date: new Date(data.date) }),
            },
            include: {
                vehicle: { select: { id: true, plate: true, brand: true, model: true } },
                driver: { select: { id: true, name: true, code: true } },
            },
        });

        // If resolved/closed, restore vehicle if it was in maintenance due to incident
        if ((data.status === 'resolved' || data.status === 'closed') && incident.type === 'breakdown') {
            const vehicle = await prisma.vehicle.findFirst({ where: { id: incident.vehicleId, status: 'maintenance' } });
            if (vehicle) {
                await prisma.vehicle.update({ where: { id: incident.vehicleId }, data: { status: 'available' } });
            }
        }

        cacheService.del(`logistics:dashboard:${companyId}`);
        return updated;
    }

    async deleteIncident(companyId: string, id: string) {
        const incident = await (prisma as any).vehicleIncident.findFirst({ where: { id, companyId } });
        if (!incident) throw ApiError.notFound('Incidente não encontrado');
        return (prisma as any).vehicleIncident.delete({ where: { id } });
    }

    // ============================================================================
    // REPORTS SUMMARY
    // ============================================================================

    async getReportsSummary(companyId: string, query: { startDate?: string; endDate?: string }) {
        const { startDate, endDate } = query;
        const where: any = { companyId };
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) where.createdAt.lte = new Date(endDate + 'T23:59:59.999Z');
        }

        const [total, delivered, failed, pending, inTransit, revenueAgg, avgTimeData, statusGroups] = await Promise.all([
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
            prisma.delivery.groupBy({ by: ['status'], where, _count: { id: true } })
        ]);

        const avgDeliveryHours = avgTimeData.length > 0
            ? avgTimeData.reduce((sum, d) => {
                const diff = new Date(d.deliveredDate!).getTime() - new Date(d.createdAt).getTime();
                return sum + diff / (1000 * 60 * 60);
              }, 0) / avgTimeData.length
            : 0;

        // Driver performance (top 10)
        const driverDeliveries = await prisma.delivery.findMany({
            where: { ...where, driverId: { not: null } },
            select: { driverId: true, status: true, driver: { select: { name: true } } }
        });

        const driverStats: Record<string, { name: string; total: number; delivered: number; failed: number }> = {};
        driverDeliveries.forEach((d: any) => {
            if (!d.driverId || !d.driver) return;
            if (!driverStats[d.driverId]) {
                driverStats[d.driverId] = { name: d.driver.name, total: 0, delivered: 0, failed: 0 };
            }
            driverStats[d.driverId].total++;
            if (d.status === 'delivered') driverStats[d.driverId].delivered++;
            if (d.status === 'failed') driverStats[d.driverId].failed++;
        });

        const driverPerformance = Object.values(driverStats)
            .map(ds => ({ ...ds, successRate: ds.total > 0 ? (ds.delivered / ds.total) * 100 : 0 }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 10);

        // Route usage (top 10)
        const routeDeliveries = await prisma.delivery.findMany({
            where: { ...where, routeId: { not: null } },
            select: { routeId: true, isPaid: true, shippingCost: true, route: { select: { name: true } } }
        });

        const routeStats: Record<string, { name: string; count: number; revenue: number }> = {};
        routeDeliveries.forEach((d: any) => {
            if (!d.routeId || !d.route) return;
            if (!routeStats[d.routeId]) {
                routeStats[d.routeId] = { name: d.route.name, count: 0, revenue: 0 };
            }
            routeStats[d.routeId].count++;
            if (d.isPaid) routeStats[d.routeId].revenue += Number(d.shippingCost || 0);
        });

        const routeUsage = Object.values(routeStats)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        return {
            summary: {
                total,
                delivered,
                failed,
                pending,
                inTransit,
                successRate: total > 0 ? (delivered / total) * 100 : 0,
                totalRevenue: Number(revenueAgg._sum?.shippingCost || 0),
                avgDeliveryHours
            },
            statusDistribution: statusGroups.map((g: any) => ({ status: g.status, count: g._count.id })),
            driverPerformance,
            routeUsage
        };
    }
}

export const logisticsService = new LogisticsService();
