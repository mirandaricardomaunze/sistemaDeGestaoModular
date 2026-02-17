import { Router, Response } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { salesService } from '../services/sales.service';
import { validateCreateSale, validateSalesQuery, formatZodError } from '../utils/validation';
import { z } from 'zod';

const router = Router();

// Get all sales with pagination
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        if (!req.companyId) return res.status(400).json({ error: 'Company not identified' });

        // Validate query
        const validatedQuery = validateSalesQuery(req.query);

        const result = await salesService.list(validatedQuery, req.companyId);
        res.json(result);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                error: 'Parâmetros de consulta inválidos',
                details: formatZodError(error)
            });
        }
        logger.error('Get sales error:', error);
        res.status(500).json({ error: 'Erro ao buscar vendas' });
    }
});

// Get sale by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        if (!req.companyId) return res.status(400).json({ error: 'Company not identified' });

        const sale = await salesService.getById(req.params.id, req.companyId);
        res.json(sale);
    } catch (error: any) {
        logger.error('Get sale error:', error);
        res.status(404).json({ error: error.message || 'Venda não encontrada' });
    }
});

// Get sales statistics
router.get('/stats/summary', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        if (!req.companyId) return res.status(400).json({ error: 'Company not identified' });

        const result = await salesService.getStats(req.query, req.companyId);
        res.json(result);
    } catch (error) {
        logger.error('Get sales stats error:', error);
        res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
});

// Get today's sales
router.get('/today/summary', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        if (!req.companyId) return res.status(400).json({ error: 'Company not identified' });

        const result = await salesService.getTodaySummary(req.companyId);
        res.json(result);
    } catch (error) {
        logger.error('Get today sales error:', error);
        res.status(500).json({ error: 'Erro ao buscar vendas de hoje' });
    }
});

// Create sale (POS)
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        if (!req.companyId) return res.status(400).json({ error: 'Company not identified' });

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
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                error: 'Dados de entrada inválidos',
                details: formatZodError(error)
            });
        }

        const msg = error.message || '';
        if (msg.includes('Stock insuficiente') || msg.includes('Pontos insuficientes')) {
            return res.status(400).json({ error: msg });
        }
        if (msg.includes('não encontrado')) {
            return res.status(404).json({ error: msg });
        }

        logger.error('Create sale error:', error);
        res.status(500).json({ error: 'Erro ao registrar venda' });
    }
});

// Cancel/Void sale (POS)
router.post('/:id/cancel', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
    try {
        if (!req.companyId) return res.status(400).json({ error: 'Company not identified' });

        const { reason } = req.body;
        if (!reason) return res.status(400).json({ error: 'Motivo é obrigatório' });

        const result = await salesService.cancel(
            req.params.id,
            reason,
            req.companyId,
            req.userId!,
            req.userName || 'Admin',
            (req as any).ip || req.socket.remoteAddress || ''
        );

        res.json(result);
    } catch (error: any) {
        logger.error('Cancel sale error:', error);
        res.status(500).json({ error: error.message || 'Erro ao anular venda' });
    }
});

export default router;
