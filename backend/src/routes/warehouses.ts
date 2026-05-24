import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { warehousesService } from '../services/warehousesService';
import { ApiError } from '../middleware/error.middleware';

const router = Router();

// ============================================================================
// STOCK TRANSFERS
// ============================================================================

router.get('/transfers/all', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const transfers = await warehousesService.getAllTransfers(req.companyId, req.query);
    res.json(transfers);
});

router.get('/transfers/pending', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const pending = await warehousesService.listPendingApprovals(req.companyId);
    res.json(pending);
});

router.post('/transfers', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const userName = req.userName || 'Sistema';
    const userId = req.userId || 'system';
    const result = await warehousesService.createTransfer(req.companyId, req.body, userId, userName);
    res.status(201).json(result);
});

router.post('/transfers/:id/submit', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const result = await warehousesService.submitTransfer(req.companyId, req.params.id, req.userId!, req.userName);
    res.json(result);
});

router.post('/transfers/:id/approve', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const result = await warehousesService.approveTransfer(req.companyId, req.params.id, req.userId!, req.userName);
    res.json(result);
});

router.post('/transfers/:id/reject', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const result = await warehousesService.rejectTransfer(req.companyId, req.params.id, req.userId!, req.userName, req.body.reason);
    res.json(result);
});

router.post('/transfers/:id/dispatch', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const userName = req.userName || 'Sistema';
    const userId = req.userId || 'system';
    const result = await warehousesService.dispatchTransfer(req.companyId, req.params.id, userId, userName);
    res.json(result);
});

router.post('/transfers/:id/receive', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const userName = req.userName || 'Sistema';
    const userId = req.userId || 'system';
    const result = await warehousesService.receiveTransfer(req.companyId, req.params.id, userId, userName, req.body.items);
    res.json(result);
});

router.post('/transfers/:id/complete', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const userName = req.userName || 'Sistema';
    const userId = req.userId || 'system';
    const result = await warehousesService.completeTransfer(req.companyId, req.params.id, userId, userName);
    res.json(result);
});

router.post('/transfers/:id/cancel', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const userName = req.userName || 'Sistema';
    const userId = req.userId || 'system';
    const result = await warehousesService.cancelTransfer(req.companyId, req.params.id, userId, userName);
    res.json(result);
});

// ============================================================================
// WAREHOUSES CRUD
// ============================================================================

router.get('/', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const warehouses = await warehousesService.getWarehouses(req.companyId);
    res.json(warehouses);
});

router.get('/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const warehouse = await warehousesService.getWarehouseById(req.companyId, req.params.id);
    res.json(warehouse);
});

router.post('/', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const warehouse = await warehousesService.createWarehouse(req.companyId, req.body);
    res.status(201).json(warehouse);
});

router.put('/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const updated = await warehousesService.updateWarehouse(req.companyId, req.params.id, req.body);
    res.json(updated);
});

router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    await warehousesService.deleteWarehouse(req.companyId, req.params.id);
    res.json({ message: 'Armazém removido com sucesso' });
});

export default router;
