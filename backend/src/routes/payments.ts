/**
 * M-Pesa Payment Routes
 * API endpoints for M-Pesa payment integration
 */

import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { mpesaService } from '../services/mpesaService';
import { z } from 'zod';
import { ApiError } from '../middleware/error.middleware';
import { buildPaginationMeta } from '../utils/pagination';
import { logger } from '../utils/logger';

const router = Router();

// Validation schemas
const initiatePaymentSchema = z.object({
    phone: z.string().min(9, 'Número de telefone inválido'),
    amount: z.number().positive('Valor deve ser positivo'),
    reference: z.string().min(1, 'Referência obrigatória'),
    module: z.enum(['pos', 'invoice', 'hospitality', 'pharmacy']),
    moduleReferenceId: z.string().optional(),
});

const mpesaCallbackSchema = z.object({
    transactionId: z.string().min(1),
    status: z.enum(['success', 'failed']),
    amount: z.number().optional(),
}).passthrough();

const historyQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.string().optional(),
    module: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
});

// =============================================================================
// PUBLIC ROUTES (for webhooks)
// =============================================================================

/**
 * M-Pesa Callback/Webhook
 * This endpoint receives payment confirmations from M-Pesa
 * POST /api/payments/mpesa/callback
 */
router.post('/mpesa/callback', async (req, res) => {
    logger.info('M-Pesa Callback received', { body: req.body });
    const validatedCallback = mpesaCallbackSchema.parse(req.body);
    const success = await mpesaService.processCallback(validatedCallback);

    if (success) {
        res.json({ ResultCode: 0, ResultDesc: 'Success' });
    } else {
        throw ApiError.badRequest('Failed to process M-Pesa callback');
    }
});

// =============================================================================
// AUTHENTICATED ROUTES
// =============================================================================

/**
 * Check if M-Pesa is available/configured
 * GET /api/payments/mpesa/status
 */
router.get('/mpesa/status', authenticate, async (req: AuthRequest, res) => {
    const isAvailable = mpesaService.isAvailable();

    res.json({
        available: true, // Always available (simulation mode fallback)
        configured: isAvailable,
        mode: isAvailable ? 'production' : 'sandbox',
        message: isAvailable
            ? 'M-Pesa configurado e pronto'
            : 'M-Pesa em modo simulação (credenciais não configuradas)'
    });
});

/**
 * Initiate M-Pesa Payment
 * POST /api/payments/mpesa/initiate
 */
router.post('/mpesa/initiate', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const validatedData = initiatePaymentSchema.parse(req.body);
    const { phone, amount, reference, module, moduleReferenceId } = validatedData;

    const result = await mpesaService.initiatePayment({
        phone,
        amount,
        reference,
        module,
        moduleReferenceId,
        companyId: req.companyId,
    });

    if (result.status === 'completed') {
        res.json({
            success: true,
            transactionId: result.id,
            mpesaTransactionId: result.transactionId,
            conversationId: result.conversationId,
            message: 'Pagamento iniciado com sucesso',
            simulated: !mpesaService.isAvailable(),
        });
    } else {
        throw ApiError.badRequest('Erro ao iniciar pagamento M-Pesa');
    }
});

/**
 * Get transaction status
 * GET /api/payments/mpesa/transaction/:id
 */
router.get('/mpesa/transaction/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const result = await mpesaService.getTransactionStatus(req.params.id, req.companyId);

    if (!result) {
        throw ApiError.notFound('Transação não encontrada');
    }

    // Verify company access
    if (result.companyId && result.companyId !== req.companyId) {
        throw ApiError.forbidden('Acesso negado');
    }

    res.json(result);
});

/**
 * Get transactions for a module reference
 * GET /api/payments/mpesa/module/:module/:referenceId
 */
router.get('/mpesa/module/:module/:referenceId', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const { module, referenceId } = req.params;

    if (!['pos', 'invoice', 'hospitality', 'pharmacy'].includes(module)) {
        throw ApiError.badRequest('Módulo inválido');
    }

    const transactions = await mpesaService.getTransactionsByReference(
        referenceId,
        req.companyId
    );

    res.json(transactions);
});

/**
 * Cancel pending transaction
 * POST /api/payments/mpesa/transaction/:id/cancel
 */
router.post('/mpesa/transaction/:id/cancel', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    // First check ownership
    const transaction = await prisma.mpesaTransaction.findUnique({
        where: { id: req.params.id },
    });

    if (!transaction) {
        throw ApiError.notFound('Transação não encontrada');
    }

    if (transaction.companyId && transaction.companyId !== req.companyId) {
        throw ApiError.forbidden('Acesso negado');
    }

    const success = await mpesaService.cancelTransaction(req.params.id, req.companyId);

    if (success) {
        res.json({ success: true, message: 'Transação cancelada' });
    } else {
        throw ApiError.badRequest('Não é possível cancelar esta transação');
    }
});

/**
 * Get transaction history (paginated)
 * GET /api/payments/mpesa/history
 */
router.get('/mpesa/history', authenticate, async (req: AuthRequest, res) => {
    const { page, limit, status, module, startDate, endDate } = historyQuerySchema.parse(req.query);
    const skip = (page - 1) * limit;

    const where: any = { companyId: req.companyId };

    if (status) where.status = status;
    if (module) where.module = module;

    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [total, transactions] = await Promise.all([
        prisma.mpesaTransaction.count({ where }),
        prisma.mpesaTransaction.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        }),
    ]);

    res.json({
        data: transactions,
        pagination: buildPaginationMeta(page, limit, total),
    });
});

export default router;
