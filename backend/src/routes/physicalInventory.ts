import { Router } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/error.middleware';
import { physicalInventoryService } from '../services/physicalInventoryService';
import { BulkCountSchema, CreateInventorySchema } from '../validation/physicalInventory.validation';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa nao identificada');
    const items = await physicalInventoryService.listInventories(req.companyId, req.query.warehouseId as string | undefined);
    res.json({ success: true, data: items });
});

router.get('/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa nao identificada');
    const item = await physicalInventoryService.getInventoryDetail(req.params.id, req.companyId);
    res.json({ success: true, data: item });
});

router.post('/', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa nao identificada');
    const parsed = CreateInventorySchema.parse(req.body);
    const item = await physicalInventoryService.createInventory(req.companyId, req.userId || 'system', parsed);
    res.status(201).json({ success: true, data: item });
});

router.post('/:id/counts', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa nao identificada');
    const parsed = BulkCountSchema.parse(req.body);
    const item = await physicalInventoryService.submitCounts(req.params.id, req.companyId, parsed);
    res.json({ success: true, data: item });
});

router.post('/:id/approve', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa nao identificada');
    const item = await physicalInventoryService.approveInventory(req.params.id, req.companyId, req.userId || 'system');
    res.json({ success: true, data: item });
});

router.post('/:id/cancel', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa nao identificada');
    const item = await physicalInventoryService.cancelInventory(req.params.id, req.companyId);
    res.json({ success: true, data: item });
});

export default router;
