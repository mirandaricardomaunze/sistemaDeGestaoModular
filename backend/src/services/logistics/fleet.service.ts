import { Prisma } from '@prisma/client';
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
    'id', 'code', 'name', 'phone', 'email', 'category',
    'licenseNumber', 'licenseType', 'licenseExpiry', 'status',
    'medicalExamExpiry', 'safetyTrainingDate', 'createdAt'
] as const;

const DEFAULT_LIMIT = 20;

type ListQuery = {
    page?: string | number;
    limit?: string | number;
    fields?: string;
    search?: string;
    status?: string;
    category?: string;
    type?: string;
    vehicleId?: string;
    driverId?: string;
    startDate?: string;
    endDate?: string;
};

type VehicleInput = {
    plate: string;
    brand: string;
    model: string;
    year?: number;
    type?: string;
    capacity?: number | string;
    capacityUnit?: string;
    fuelType?: string;
    status?: string;
    mileage?: number;
    insuranceExpiry?: string | Date;
    notes?: string;
};

type DriverInput = {
    code?: string;
    name: string;
    phone: string;
    email?: string;
    category?: string;
    licenseNumber: string;
    licenseType?: string;
    licenseExpiry?: string | Date;
    medicalExamExpiry?: string | Date;
    safetyTrainingDate?: string | Date;
    status?: string;
    hireDate?: string | Date;
    address?: string;
    emergencyContact?: string;
    baseSalary?: number | string;
    subsidyTransport?: number | string;
    subsidyFood?: number | string;
    commissionRate?: number | string | null;
    bankName?: string | null;
    bankAccountNumber?: string | null;
    bankNib?: string | null;
    socialSecurityNumber?: string | null;
    nuit?: string | null;
    birthDate?: string | Date | null;
    notes?: string;
};

type MaintenanceInput = {
    vehicleId: string;
    type?: string;
    description: string;
    cost: number | string;
    date: string | Date;
    nextDate?: string | Date;
    mileageAt?: number;
    status?: string;
    provider?: string;
    notes?: string;
};

type FuelSupplyInput = {
    vehicleId: string;
    date?: string | Date;
    liters: number | string;
    pricePerLiter?: number | string | null;
    amount: number | string;
    mileage?: number;
    provider?: string | null;
    notes?: string | null;
};

type IncidentInput = {
    vehicleId: string;
    driverId?: string | null;
    date?: string | Date;
    type?: string;
    severity?: string;
    description: string;
    cost?: number | string | null;
    location?: string | null;
    status?: string;
    notes?: string | null;
};

export class FleetService {
    // ── Vehicles ──────────────────────────────────────────────────────────────

    async getVehicles(companyId: string, query: ListQuery) {
        const { limit, skip, page } = getPaginationParams({ limit: DEFAULT_LIMIT, ...query });
        const { status, type, search } = query;
        const where: Prisma.VehicleWhereInput = { companyId };
        if (status) where.status = status as Prisma.VehicleWhereInput['status'];
        if (type) where.type = type as Prisma.VehicleWhereInput['type'];
        if (search) {
            where.OR = [
                { plate: { contains: search, mode: 'insensitive' } },
                { brand: { contains: search, mode: 'insensitive' } },
                { model: { contains: search, mode: 'insensitive' } }
            ];
        }
        const projection = parseFields(query.fields, VEHICLE_FIELDS);
        const baseArgs = { where, skip, take: limit, orderBy: { createdAt: 'desc' as const } };
        const findArgs: Prisma.VehicleFindManyArgs = projection
            ? { ...baseArgs, select: projection as Prisma.VehicleSelect }
            : { ...baseArgs, include: { _count: { select: { deliveries: true } } } };
        const [vehicles, total] = await Promise.all([
            prisma.vehicle.findMany(findArgs),
            prisma.vehicle.count({ where })
        ]);
        return ResultHandler.success(createPaginatedResponse(vehicles, page, limit, total));
    }

    async createVehicle(companyId: string, data: VehicleInput) {
        const existing = await prisma.vehicle.findFirst({ where: { companyId, plate: data.plate } });
        if (existing) throw ApiError.badRequest('Já existe um veículo com esta matrícula');
        const vehicle = await prisma.vehicle.create({ data: { ...data, companyId } as Prisma.VehicleUncheckedCreateInput });
        return ResultHandler.success(vehicle);
    }

    async updateVehicle(companyId: string, id: string, data: Partial<VehicleInput>) {
        const vehicle = await prisma.vehicle.findFirst({ where: { id, companyId } });
        if (!vehicle) throw ApiError.notFound('Veículo não encontrado');
        try {
            return ResultHandler.success(await prisma.vehicle.update({ where: { id }, data: data as Prisma.VehicleUncheckedUpdateInput }));
        } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                throw ApiError.badRequest('Já existe um veículo com esta matrícula');
            }
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

    async getDrivers(companyId: string, query: ListQuery) {
        const { limit, skip, page } = getPaginationParams({ limit: DEFAULT_LIMIT, ...query });
        const { status, search, category } = query;
        const where: Prisma.DriverWhereInput = { companyId };
        if (status) where.status = status as Prisma.DriverWhereInput['status'];
        if (category) where.category = category as Prisma.DriverWhereInput['category'];
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } }
            ];
        }
        const projection = parseFields(query.fields, DRIVER_FIELDS);
        const baseArgs = { where, skip, take: limit, orderBy: { name: 'asc' as const } };
        const findArgs: Prisma.DriverFindManyArgs = projection
            ? { ...baseArgs, select: projection as Prisma.DriverSelect }
            : { ...baseArgs, include: { _count: { select: { deliveries: true } } } };
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

    async createDriver(companyId: string, data: DriverInput) {
        const code = data.code || await generateDriverCode(companyId);
        const driverData = this.normalizeDriverData({ ...data, code });
        return ResultHandler.success(await prisma.driver.create({ data: { ...driverData, companyId } as Prisma.DriverUncheckedCreateInput }));
    }

    async updateDriver(companyId: string, id: string, data: Partial<DriverInput>) {
        const driver = await prisma.driver.findFirst({ where: { id, companyId } });
        if (!driver) throw ApiError.notFound('Motorista não encontrado');
        const driverData = this.normalizeDriverData(data);
        return ResultHandler.success(await prisma.driver.update({ where: { id }, data: driverData as Prisma.DriverUncheckedUpdateInput }));
    }

    private normalizeDriverData(data: Partial<DriverInput>) {
        const normalized: Record<string, unknown> = { ...data };
        ['licenseExpiry', 'medicalExamExpiry', 'safetyTrainingDate', 'hireDate', 'birthDate'].forEach((field) => {
            const value = normalized[field];
            if (value === '') {
                normalized[field] = null;
            } else if (value) {
                normalized[field] = new Date(value as string | Date);
            }
        });
        return normalized;
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

    async getMaintenances(companyId: string, query: ListQuery) {
        const { limit, skip, page } = getPaginationParams({ limit: DEFAULT_LIMIT, ...query });
        const { vehicleId, status } = query;
        const where: Prisma.VehicleMaintenanceWhereInput = { vehicle: { companyId } };
        if (vehicleId) where.vehicleId = vehicleId;
        if (status) where.status = status as Prisma.VehicleMaintenanceWhereInput['status'];
        const [data, total] = await Promise.all([
            prisma.vehicleMaintenance.findMany({ where, skip, take: limit, orderBy: { date: 'desc' }, include: { vehicle: true } }),
            prisma.vehicleMaintenance.count({ where })
        ]);
        return ResultHandler.success(createPaginatedResponse(data, page, limit, total));
    }

    async createMaintenance(companyId: string, data: MaintenanceInput) {
        const vehicle = await prisma.vehicle.findFirst({ where: { id: data.vehicleId, companyId } });
        if (!vehicle) throw ApiError.notFound('Veículo não encontrado');
        return prisma.$transaction(async (tx) => {
            const maintenance = await tx.vehicleMaintenance.create({
                data: { ...data, date: new Date(data.date) } as Prisma.VehicleMaintenanceUncheckedCreateInput,
                include: { vehicle: true }
            });
            const vehicleUpdate: Prisma.VehicleUpdateInput = { lastMaintenance: new Date(data.date) };
            if (data.nextDate) vehicleUpdate.nextMaintenance = new Date(data.nextDate);
            if (data.mileageAt) vehicleUpdate.mileage = data.mileageAt;
            if (data.status === 'in_progress') vehicleUpdate.status = 'maintenance';
            await tx.vehicle.update({ where: { id: data.vehicleId }, data: vehicleUpdate });
            return ResultHandler.success(maintenance);
        });
    }

    async updateMaintenance(companyId: string, id: string, data: Partial<MaintenanceInput>) {
        const maintenance = await prisma.vehicleMaintenance.findFirst({ where: { id, vehicle: { companyId } } });
        if (!maintenance) throw ApiError.notFound('Manutenção não encontrada');
        return prisma.$transaction(async (tx) => {
            const updated = await tx.vehicleMaintenance.update({
                where: { id },
                data: data as Prisma.VehicleMaintenanceUncheckedUpdateInput,
                include: { vehicle: true }
            });
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

    async getFuelSupplies(companyId: string, params: ListQuery) {
        const { limit, skip, page } = getPaginationParams({ limit: DEFAULT_LIMIT, ...params });
        const { vehicleId, startDate, endDate } = params;
        const where: Prisma.FuelSupplyWhereInput = { companyId };
        if (vehicleId) where.vehicleId = vehicleId;
        if (startDate || endDate) {
            where.date = {};
            if (startDate) where.date.gte = new Date(startDate);
            if (endDate) where.date.lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
        }
        const [data, total] = await Promise.all([
            prisma.fuelSupply.findMany({ where, include: { vehicle: { select: { id: true, plate: true, brand: true, model: true } } }, orderBy: { date: 'desc' }, skip, take: limit }),
            prisma.fuelSupply.count({ where }),
        ]);
        return ResultHandler.success(createPaginatedResponse(data, page, limit, total));
    }

    async createFuelSupply(companyId: string, data: FuelSupplyInput) {
        const vehicle = await prisma.vehicle.findFirst({ where: { id: data.vehicleId, companyId } });
        if (!vehicle) throw ApiError.notFound('Veículo não encontrado');
        const supply = await prisma.fuelSupply.create({
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
        const supply = await prisma.fuelSupply.findFirst({ where: { id, companyId } });
        if (!supply) throw ApiError.notFound('Abastecimento não encontrado');
        return prisma.fuelSupply.delete({ where: { id } });
    }

    // ── Incidents ─────────────────────────────────────────────────────────────

    async getIncidents(companyId: string, params: ListQuery) {
        const { limit, skip, page } = getPaginationParams({ limit: DEFAULT_LIMIT, ...params });
        const { vehicleId, driverId, type } = params;
        const where: Prisma.VehicleIncidentWhereInput = { companyId };
        if (vehicleId) where.vehicleId = vehicleId;
        if (driverId) where.driverId = driverId;
        if (type) where.type = type as Prisma.VehicleIncidentWhereInput['type'];
        const [data, total] = await Promise.all([
            prisma.vehicleIncident.findMany({
                where,
                include: {
                    vehicle: { select: { id: true, plate: true, brand: true, model: true } },
                    driver: { select: { id: true, name: true, code: true } },
                },
                orderBy: { date: 'desc' }, skip, take: limit,
            }),
            prisma.vehicleIncident.count({ where }),
        ]);
        return ResultHandler.success(createPaginatedResponse(data, page, limit, total));
    }

    async createIncident(companyId: string, data: IncidentInput) {
        const vehicle = await prisma.vehicle.findFirst({ where: { id: data.vehicleId, companyId } });
        if (!vehicle) throw ApiError.notFound('Veículo não encontrado');
        if (data.driverId) {
            const driver = await prisma.driver.findFirst({ where: { id: data.driverId, companyId } });
            if (!driver) throw ApiError.notFound('Motorista não encontrado');
        }
        const incident = await prisma.vehicleIncident.create({
            data: {
                vehicleId: data.vehicleId, driverId: data.driverId ?? null, companyId,
                date: data.date ? new Date(data.date) : new Date(),
                type: (data.type ?? 'other') as Prisma.VehicleIncidentUncheckedCreateInput['type'],
                severity: (data.severity ?? 'low') as Prisma.VehicleIncidentUncheckedCreateInput['severity'],
                description: data.description, cost: data.cost ?? null,
                location: data.location ?? null,
                status: (data.status ?? 'open') as Prisma.VehicleIncidentUncheckedCreateInput['status'],
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

    async updateIncident(companyId: string, id: string, data: Partial<IncidentInput>) {
        const incident = await prisma.vehicleIncident.findFirst({ where: { id, companyId } });
        if (!incident) throw ApiError.notFound('Incidente não encontrado');

        const updateData: Prisma.VehicleIncidentUpdateInput = Object.fromEntries(
            Object.entries({
                type: data.type, severity: data.severity, description: data.description,
                cost: data.cost, location: data.location, status: data.status, notes: data.notes,
                date: data.date ? new Date(data.date) : undefined,
            }).filter(([, v]) => v !== undefined)
        );

        const updated = await prisma.vehicleIncident.update({
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
        const incident = await prisma.vehicleIncident.findFirst({ where: { id, companyId } });
        if (!incident) throw ApiError.notFound('Incidente não encontrado');
        return prisma.vehicleIncident.delete({ where: { id } });
    }
}
