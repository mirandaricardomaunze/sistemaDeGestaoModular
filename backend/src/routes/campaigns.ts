import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { campaignsService } from '../services/campaigns.service';
import { ApiError } from '../middleware/error.middleware';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    res.json(await campaignsService.list(req.query, req.companyId));
});

router.get('/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    res.json(await campaignsService.getById(req.params.id, req.companyId));
});

router.post('/', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    res.status(201).json(await campaignsService.create(req.body, req.companyId));
});

router.put('/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    res.json(await campaignsService.update(req.params.id, req.body, req.companyId));
});

router.post('/:id/activate', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    res.json(await campaignsService.setStatus(req.params.id, 'active', req.companyId));
});

router.post('/:id/pause', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    res.json(await campaignsService.setStatus(req.params.id, 'paused', req.companyId));
});

router.post('/:id/cancel', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    res.json(await campaignsService.setStatus(req.params.id, 'cancelled', req.companyId));
});

router.post('/validate-code', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const { code, cartTotal } = req.body;
    res.json(await campaignsService.validateCode(code, cartTotal, req.companyId));
});

router.post('/:id/use', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    res.status(201).json(await campaignsService.recordUsage(req.params.id, req.body, req.companyId));
});

router.get('/:id/stats', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    res.json(await campaignsService.getStats(req.params.id, req.companyId));
});

export default router;
