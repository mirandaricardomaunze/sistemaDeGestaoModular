import { Router, Response } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { salesService } from '../services/sales.service';
import { validateCreateSale, validateSalesQuery, formatZodError } from '../utils/validation';
import { z } from 'zod';
import { ApiError } from '../middleware/error.middleware';

const router = Router();

// Get all sales with pagination
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');

    // Validate query
    const validatedQuery = validateSalesQuery(req.query);

    const result = await salesService.list(validatedQuery, req.companyId);
    res.json(result);
});

// Get sale by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');

    const sale = await salesService.getById(req.params.id, req.companyId);
    res.json(sale);
});

// Get sales statistics
router.get('/stats/summary', authenticate, async (req: AuthRequest, res: Response) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');

    const result = await salesService.getStats(req.query, req.companyId);
    res.json(result);
});

// Get today's sales
router.get('/today/summary', authenticate, async (req: AuthRequest, res: Response) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');

    const result = await salesService.getTodaySummary(req.companyId);
    res.json(result);
});

// Create sale (POS)
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');

    // Validate input
    const validatedData = validateCreateSale(req.body);

    const sale = await salesService.create(
        validatedData,
        req.companyId,
        req.userId!,
        req.userName || 'Sistema',
        (req as any).ip || req.socket.remoteAddress || ''
    );

    res.status(201).json(sale);
});

// Cancel/Void sale (POS)
router.post('/:id/cancel', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');

    const { reason } = req.body;
    if (!reason) throw ApiError.badRequest('Motivo é obrigatório');

    const result = await salesService.cancel(
        req.params.id,
        reason,
        req.companyId,
        req.userId!,
        req.userName || 'Admin',
        (req as any).ip || req.socket.remoteAddress || ''
    );

    res.json(result);
});

export default router;
