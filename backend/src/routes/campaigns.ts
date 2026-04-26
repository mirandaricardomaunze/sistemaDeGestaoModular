import { Router } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { campaignsService } from '../services/campaignsService';
import { ApiError } from '../middleware/error.middleware';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    res.json(await campaignsService.list(req.query, req.companyId));
});

router.get('/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    res.json(await campaignsService.getById(req.params.id, req.companyId));
});

router.post('/', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    res.status(201).json(await campaignsService.create(req.body, req.companyId));
});

router.put('/:id', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    res.json(await campaignsService.update(req.params.id, req.body, req.companyId));
});

router.post('/:id/activate', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    res.json(await campaignsService.setStatus(req.params.id, 'active', req.companyId));
});

router.post('/:id/pause', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    res.json(await campaignsService.setStatus(req.params.id, 'paused', req.companyId));
});

router.post('/:id/cancel', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    res.json(await campaignsService.setStatus(req.params.id, 'cancelled', req.companyId));
});

router.post('/validate-code', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const { code, cartTotal } = req.body;
    res.json(await campaignsService.validateCode(code, cartTotal, req.companyId));
});

// Alias: frontend calls /validate instead of /validate-code
router.post('/validate', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const { code, cartTotal } = req.body;
    res.json(await campaignsService.validateCode(code, cartTotal, req.companyId));
});

router.post('/:id/use', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    res.status(201).json(await campaignsService.recordUsage(req.params.id, req.body, req.companyId));
});

// Alias: frontend calls POST /usage instead of /:id/use
router.post('/usage', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const { campaignId, ...rest } = req.body;
    if (!campaignId) throw ApiError.badRequest('campaignId é obrigatório');
    res.status(201).json(await campaignsService.recordUsage(campaignId, rest, req.companyId));
});

router.get('/:id/stats', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    res.json(await campaignsService.getStats(req.params.id, req.companyId));
});

export default router;
