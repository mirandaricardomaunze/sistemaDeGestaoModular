import { prisma } from '../../lib/prisma';
import { ApiError } from '../../middleware/error.middleware';
import { ResultHandler } from '../../utils/result';
import { getPaginationParams, createPaginatedResponse, parseFields } from '../../utils/pagination';
import { cacheService } from '../cacheService';
import { generateDriverCode } from './shared';

const VEHICLE_FIELDS = [
    'id', 'plate', 'brand', 'model', 'type', 'status', 'year',
    'capacity', 'fuelType', 'createdAt', 'updatedAt'
] as const;

const DRIVER_FIELDS = [
    'id', 'code', 'name', 'phone', 'license', 'status',
    'cnhCategory', 'cnhExpiry', 'createdAt'
] as const;

const DEFAULT_LIMIT = 20;

export class FleetService {
    // ── Vehicles ──────────────────────────────────────────────────────────────

    async getVehicles(companyId: string, query: any) {
        const { limit, skip, page } = getPaginationParams({ limit: DEFAULT_LIMIT, ...query });
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
        const projection = parseFields(query.fields, VEHICLE_FIELDS);
        const findArgs: any = { where, skip, take: limit, orderBy: { createdAt: 'desc' } };
        if (projection) findArgs.select = projection;
        else findArgs.include = { _count: { select: { deliveries: true } } };
        const [vehicles, total] = await Promise.all([
            prisma.vehicle.findMany(findArgs),
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
        const { limit, skip, page } = getPaginationParams({ limit: DEFAULT_LIMIT, ...query });
        const { status, search } = query;
        const where: any = { companyId };
        if (status) where.status = status;
        if (search) {
            where.OR = [
                { name: { contains: search as string, mode: 'insensitive' } },
                { code: { contains: search as string, mode: 'insensitive' } }
            ];
        }
        const projection = parseFields(query.fields, DRIVER_FIELDS);
        const findArgs: any = { where, skip, take: limit, orderBy: { name: 'asc' } };
        if (projection) findArgs.select = projection;
        else findArgs.include = { _count: { select: { deliveries: true } } };
        const [drivers, total] = await Promise.all([
            prisma.driver.findMany(findArgs),
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
        const code = await generateDriverCode(companyId);
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

    // ── Maintenance ───────────────────────────────────────────────────────────

    async getMaintenances(companyId: string, query: any) {
        const { limit, skip, page } = getPaginationParams({ limit: DEFAULT_LIMIT, ...query });
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
        const { limit, skip, page } = getPaginationParams({ limit: DEFAULT_LIMIT, ...params });
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
        const { limit, skip, page } = getPaginationParams({ limit: DEFAULT_LIMIT, ...params });
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
}
