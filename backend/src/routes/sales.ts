import { Router, Response } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { salesService } from '../services/salesService';
import { validateCreateSale, validateSalesQuery, formatZodError } from '../utils/validation';
import { z } from 'zod';
import { ApiError } from '../middleware/error.middleware';
import { emitToCompany } from '../lib/socket';

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

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(req.params.id)) throw ApiError.badRequest('ID inválido: deve ser um UUID válido');

    const sale = await salesService.getById(req.params.id, req.companyId);
    res.json(sale);
});

// Get sales statistics (both /stats and /stats/summary for compatibility)
router.get('/stats', authenticate, async (req: AuthRequest, res: Response) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const result = await salesService.getStats(req.query, req.companyId);
    res.json(result);
});

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
    ) as any;

    emitToCompany(req.companyId, 'sale:created', { id: sale.id, total: sale.total, receiptNumber: sale.receiptNumber });

    if (validatedData.originModule === 'restaurant') {
        emitToCompany(req.companyId, 'restaurant:new_order', {
            id: sale.id,
            total: sale.total,
            table: sale.tableId,
            timestamp: new Date()
        });
    }

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
