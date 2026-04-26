import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { restaurantService } from '../services/restaurantService';
import { ApiError } from '../middleware/error.middleware';
import { requireModule } from '../middleware/module';

const router = Router();
router.use(authenticate, requireModule('RESTAURANT'));

// ============================================================================
// DASHBOARD
// ============================================================================

router.get('/dashboard', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const range = (req.query.range as string) || '1M';
    const data = await restaurantService.getDashboard(req.companyId, range);
    res.json(data);
});

// ============================================================================
// TABLES
// ============================================================================

router.get('/tables', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const result = await restaurantService.listTables(req.companyId, req.query);
    res.json(result);
});

router.get('/tables/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const table = await restaurantService.getTableById(req.params.id, req.companyId);
    res.json(table);
});

router.post('/tables', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const { number, name, capacity, section, notes } = req.body;
    if (!number) throw ApiError.badRequest('Número da mesa é obrigatório');
    const table = await restaurantService.createTable({ number: Number(number), name, capacity: capacity ? Number(capacity) : 4, section, notes }, req.companyId);
    res.status(201).json(table);
});

router.put('/tables/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const table = await restaurantService.updateTable(req.params.id, req.body, req.companyId);
    res.json(table);
});

router.patch('/tables/:id/status', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const { status } = req.body;
    if (!status) throw ApiError.badRequest('Status é obrigatório');
    const table = await restaurantService.updateTableStatus(req.params.id, status, req.companyId);
    res.json(table);
});

router.delete('/tables/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    await restaurantService.deleteTable(req.params.id, req.companyId);
    res.json({ success: true });
});

// ============================================================================
// REPORTS
// ============================================================================

router.get('/reports', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const data = await restaurantService.getReports(req.companyId, req.query);
    res.json(data);
});

// ============================================================================
// MENU ITEMS
// ============================================================================

router.get('/menu', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const data = await restaurantService.listMenuItems(req.companyId, req.query);
    res.json(data);
});

router.post('/menu', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    if (!req.body.name || !req.body.price) throw ApiError.badRequest('Nome e preço são obrigatórios');
    const item = await restaurantService.createMenuItem(req.companyId, req.body);
    res.status(201).json(item);
});

router.put('/menu/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const item = await restaurantService.updateMenuItem(req.params.id, req.companyId, req.body);
    res.json(item);
});

router.delete('/menu/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    await restaurantService.deleteMenuItem(req.params.id, req.companyId);
    res.json({ success: true });
});

router.patch('/menu/:id/availability', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const item = await restaurantService.toggleMenuItemAvailability(req.params.id, req.companyId, Boolean(req.body.isAvailable));
    res.json(item);
});

// ============================================================================
// KITCHEN ORDERS
// ============================================================================

router.get('/orders', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const orders = await restaurantService.listOrders(req.companyId, req.query);
    res.json(orders);
});

router.post('/orders', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const order = await restaurantService.createOrder(req.companyId, req.body);
    res.status(201).json(order);
});

router.patch('/orders/:id/status', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    if (!req.body.status) throw ApiError.badRequest('Status é obrigatório');
    const order = await restaurantService.updateOrderStatus(req.params.id, req.companyId, req.body.status, req.body.notes);
    res.json(order);
});

// ============================================================================
// RESERVATIONS
// ============================================================================

router.get('/reservations', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const data = await restaurantService.listReservations(req.companyId, req.query);
    res.json(data);
});

router.post('/reservations', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const reservation = await restaurantService.createReservation(req.companyId, req.body);
    res.status(201).json(reservation);
});

router.put('/reservations/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const reservation = await restaurantService.updateReservation(req.params.id, req.companyId, req.body);
    res.json(reservation);
});

router.delete('/reservations/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    await restaurantService.deleteReservation(req.params.id, req.companyId);
    res.json({ success: true });
});

router.patch('/reservations/:id/status', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    if (!req.body.status) throw ApiError.badRequest('Status é obrigatório');
    const reservation = await restaurantService.updateReservationStatus(req.params.id, req.companyId, req.body.status);
    res.json(reservation);
});

export default router;
