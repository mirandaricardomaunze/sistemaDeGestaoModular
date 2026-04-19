import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logisticsService } from '../services/logisticsService';
import { ApiError } from '../middleware/error.middleware';
import { prisma } from '../lib/prisma';
import { emitToCompany } from '../lib/socket';

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
        include: {
            maintenances: { orderBy: { date: 'desc' } },
            deliveries: { take: 10, orderBy: { createdAt: 'desc' } }
        }
    });
    if (!vehicle) throw ApiError.notFound('Veículo não encontrado');
    res.json(vehicle);
});

router.put('/vehicles/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const vehicle = await logisticsService.updateVehicle(req.companyId, req.params.id, req.body);
    res.json(vehicle);
});

router.delete('/vehicles/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    await logisticsService.deleteVehicle(req.companyId, req.params.id);
    res.json({ message: 'Veículo eliminado com sucesso' });
});

// ============================================================================
// DRIVERS
// ============================================================================

router.get('/drivers', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const result = await logisticsService.getDrivers(req.companyId, req.query);
    res.json(result);
});

router.post('/drivers', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const driver = await logisticsService.createDriver(req.companyId, req.body);
    res.status(201).json(driver);
});

router.get('/drivers/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const driver = await logisticsService.getDriver(req.companyId, req.params.id);
    res.json(driver);
});

router.put('/drivers/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const driver = await logisticsService.updateDriver(req.companyId, req.params.id, req.body);
    res.json(driver);
});

router.delete('/drivers/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    await logisticsService.deleteDriver(req.companyId, req.params.id);
    res.json({ message: 'Motorista eliminado com sucesso' });
});

// ============================================================================
// ROUTES (Rotas de entrega)
// ============================================================================

router.get('/routes', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const result = await logisticsService.getRoutes(req.companyId, req.query);
    res.json(result);
});

router.post('/routes', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const route = await logisticsService.createRoute(req.companyId, req.body);
    res.status(201).json(route);
});

router.get('/routes/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const route = await logisticsService.getRoute(req.companyId, req.params.id);
    res.json(route);
});

router.put('/routes/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const route = await logisticsService.updateRoute(req.companyId, req.params.id, req.body);
    res.json(route);
});

router.delete('/routes/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    await logisticsService.deleteRoute(req.companyId, req.params.id);
    res.json({ message: 'Rota eliminada com sucesso' });
});

// ============================================================================
// DELIVERIES
// ============================================================================

router.get('/deliveries', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const result = await logisticsService.getDeliveries(req.companyId, req.query);
    res.json(result);
});

router.post('/deliveries', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const delivery = await logisticsService.createDelivery(req.companyId, req.body);

    // Socket Notification: New Delivery Assigned
    emitToCompany(req.companyId, 'logistics:new_delivery', {
        id: delivery.id,
        driverId: delivery.driverId,
        destination: delivery.deliveryAddress,
        timestamp: new Date()
    });

    res.status(201).json(delivery);
});

router.get('/deliveries/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const delivery = await logisticsService.getDelivery(req.companyId, req.params.id);
    res.json(delivery);
});

router.put('/deliveries/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const delivery = await logisticsService.updateDelivery(req.companyId, req.params.id, req.body);
    res.json(delivery);
});

router.delete('/deliveries/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    await logisticsService.deleteDelivery(req.companyId, req.params.id);
    res.json({ message: 'Entrega eliminada com sucesso' });
});

import { generateDeliveryPDF } from '../utils/pdf.generator';

router.get('/deliveries/:id/pdf', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    
    const delivery = await logisticsService.getDelivery(req.companyId, req.params.id);
    if (!delivery) throw ApiError.notFound('Entrega não encontrada');

    const company = await prisma.company.findUnique({
        where: { id: req.companyId },
        select: { name: true, phone: true, address: true, nuit: true }
    });

    generateDeliveryPDF(res, delivery, company || {});
});

router.put('/deliveries/:id/status', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const { status, ...extra } = req.body;
    const delivery = await logisticsService.updateDeliveryStatus(req.companyId, req.params.id, status, extra);
    res.json(delivery);
});

router.post('/deliveries/:id/pay', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const delivery = await logisticsService.payDelivery(req.companyId, req.params.id, req.body);
    res.json(delivery);
});

// ============================================================================
// PARCELS
// ============================================================================

router.get('/parcels', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const result = await logisticsService.getParcels(req.companyId, req.query);
    res.json(result);
});

router.post('/parcels', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const parcel = await logisticsService.createParcel(req.companyId, req.body);
    res.status(201).json(parcel);
});

router.get('/parcels/track/:trackingNumber', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const parcel = await logisticsService.trackParcel(req.companyId, req.params.trackingNumber);
    res.json(parcel);
});

router.get('/parcels/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const parcel = await logisticsService.getParcel(req.companyId, req.params.id);
    res.json(parcel);
});

router.put('/parcels/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const parcel = await logisticsService.updateParcel(req.companyId, req.params.id, req.body);
    res.json(parcel);
});

router.delete('/parcels/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    await logisticsService.deleteParcel(req.companyId, req.params.id);
    res.json({ message: 'Encomenda eliminada com sucesso' });
});

router.post('/parcels/:id/pickup', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const parcel = await logisticsService.registerParcelPickup(req.companyId, req.params.id, req.body);
    res.json(parcel);
});

router.put('/parcels/:id/status', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const parcel = await logisticsService.updateParcelStatus(req.companyId, req.params.id, req.body.status);
    res.json(parcel);
});

router.post('/parcels/:id/notify', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const notification = await logisticsService.sendParcelNotification(req.companyId, req.params.id, req.body);
    res.status(201).json(notification);
});

// ============================================================================
// VEHICLE MAINTENANCE
// ============================================================================

router.get('/maintenances', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const result = await logisticsService.getMaintenances(req.companyId, req.query);
    res.json(result);
});

router.post('/maintenances', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const maintenance = await logisticsService.createMaintenance(req.companyId, req.body);
    res.status(201).json(maintenance);
});

router.put('/maintenances/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const maintenance = await logisticsService.updateMaintenance(req.companyId, req.params.id, req.body);
    res.json(maintenance);
});

router.delete('/maintenances/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    await logisticsService.deleteMaintenance(req.companyId, req.params.id);
    res.json({ message: 'Manutenção eliminada com sucesso' });
});

// ============================================================================
// FUEL SUPPLIES
// ============================================================================

router.get('/fuel', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const result = await logisticsService.getFuelSupplies(req.companyId, req.query);
    res.json(result);
});

router.post('/fuel', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const supply = await logisticsService.createFuelSupply(req.companyId, req.body);
    res.status(201).json(supply);
});

router.delete('/fuel/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    await logisticsService.deleteFuelSupply(req.companyId, req.params.id);
    res.json({ message: 'Abastecimento eliminado com sucesso' });
});

// ============================================================================
// VEHICLE INCIDENTS
// ============================================================================

router.get('/incidents', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const result = await logisticsService.getIncidents(req.companyId, req.query);
    res.json(result);
});

router.post('/incidents', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const incident = await logisticsService.createIncident(req.companyId, req.body);

    // Socket Notification: High Priority Incident
    emitToCompany(req.companyId, 'logistics:incident', {
        id: incident.id,
        type: incident.type,
        vehicleId: incident.vehicleId,
        message: `Novo incidente reportado: ${incident.type}`,
        timestamp: new Date()
    });

    res.status(201).json(incident);
});

router.put('/incidents/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const incident = await logisticsService.updateIncident(req.companyId, req.params.id, req.body);
    res.json(incident);
});

router.delete('/incidents/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    await logisticsService.deleteIncident(req.companyId, req.params.id);
    res.json({ message: 'Incidente eliminado com sucesso' });
});

// ============================================================================
// REPORTS SUMMARY
// ============================================================================

router.get('/reports/summary', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const result = await logisticsService.getReportsSummary(req.companyId, req.query as any);
    res.json(result);
});

export default router;
