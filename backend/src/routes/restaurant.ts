import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { restaurantService } from '../services/restaurant.service';
import { ApiError } from '../middleware/error.middleware';

const router = Router();

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

export default router;
