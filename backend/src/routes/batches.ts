import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { batchesService } from '../services/batches.service';
import { ApiError } from '../middleware/error.middleware';

const router = Router();

// ============================================================================
// DASHBOARD
// ============================================================================

router.get('/dashboard', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    res.json(await batchesService.getDashboard(req.companyId));
});

// ============================================================================
// EXPIRING BATCHES
// ============================================================================

router.get('/expiring', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    res.json(await batchesService.getExpiring(req.companyId, req.query));
});

// ============================================================================
// CRUD
// ============================================================================

router.get('/', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    res.json(await batchesService.list(req.companyId, req.query));
});

router.get('/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    res.json(await batchesService.getById(req.params.id, req.companyId));
});

router.post('/', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const { batchNumber, productId, quantity } = req.body;
    if (!batchNumber || !productId || quantity === undefined) {
        throw ApiError.badRequest('batchNumber, productId e quantity são obrigatórios');
    }
    const batch = await batchesService.create(req.body, req.companyId);
    res.status(201).json(batch);
});

router.put('/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    res.json(await batchesService.update(req.params.id, req.body, req.companyId));
});

router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    res.json(await batchesService.delete(req.params.id, req.companyId));
});

export default router;
