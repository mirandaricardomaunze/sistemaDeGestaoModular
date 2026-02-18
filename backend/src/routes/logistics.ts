import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logisticsService } from '../services/logistics.service';
import { ApiError } from '../middleware/error.middleware';
import { prisma } from '../lib/prisma';

const router = Router();

// ============================================================================
// DASHBOARD
// ============================================================================

router.get('/dashboard', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const result = await logisticsService.getDashboard(req.companyId);
    res.json(result);
});

// ============================================================================
// VEHICLES
// ============================================================================

router.get('/vehicles', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const result = await logisticsService.getVehicles(req.companyId, req.query);
    res.json(result);
});

router.post('/vehicles', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const vehicle = await logisticsService.createVehicle(req.companyId, req.body);
    res.status(201).json(vehicle);
});

router.get('/vehicles/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const vehicle = await prisma.vehicle.findFirst({
        where: { id: req.params.id, companyId: req.companyId },
        include: { maintenances: { orderBy: { date: 'desc' } }, deliveries: { take: 10, orderBy: { createdAt: 'desc' } } }
    });
    if (!vehicle) throw ApiError.notFound('Veículo não encontrado');
    res.json(vehicle);
});

// ============================================================================
// DRIVERS
// ============================================================================

router.get('/drivers', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const { status, search, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = { companyId: req.companyId };
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
    res.json({ data: drivers, pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) } });
});

// ============================================================================
// DELIVERIES
// ============================================================================

router.get('/deliveries', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const { status, priority, driverId, vehicleId, search, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = { companyId: req.companyId };
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (driverId) where.driverId = driverId;
    if (vehicleId) where.vehicleId = vehicleId;
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
    res.json({ deliveries, pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
});

router.post('/deliveries', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const delivery = await logisticsService.createDelivery(req.companyId, req.body);
    res.status(201).json(delivery);
});

router.put('/deliveries/:id/status', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const { status, ...extra } = req.body;
    const delivery = await logisticsService.updateDeliveryStatus(req.companyId, req.params.id, status, extra);
    res.json(delivery);
});

// ============================================================================
// PARCELS
// ============================================================================

router.get('/parcels', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const { status, search, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = { companyId: req.companyId };
    if (status) where.status = status;
    if (search) {
        where.OR = [
            { trackingNumber: { contains: search as string, mode: 'insensitive' } },
            { recipientName: { contains: search as string, mode: 'insensitive' } }
        ];
    }
    const [parcels, total] = await Promise.all([
        prisma.parcel.findMany({ where, skip, take: Number(limit), orderBy: { createdAt: 'desc' }, include: { warehouse: true } }),
        prisma.parcel.count({ where })
    ]);
    res.json({ parcels, pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
});

router.post('/parcels', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const parcel = await logisticsService.createParcel(req.companyId, req.body);
    res.status(201).json(parcel);
});

export default router;
