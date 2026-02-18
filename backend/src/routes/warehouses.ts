import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { warehousesService } from '../services/warehouses.service';
import { ApiError } from '../middleware/error.middleware';

const router = Router();

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

// ============================================================================
// STOCK TRANSFERS
// ============================================================================

router.get('/transfers/all', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const transfers = await warehousesService.getAllTransfers(req.companyId, req.query);
    res.json(transfers);
});

router.post('/transfers', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const userName = (req as any).userName || 'Sistema';
    const result = await warehousesService.createTransfer(req.companyId, req.body, userName);
    res.status(201).json(result);
});

export default router;
