/**
 * M-Pesa Payment Routes
 * API endpoints for M-Pesa payment integration
 */

import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { mpesaService } from '../services/mpesa.service';
import { z } from 'zod';

const router = Router();

// Validation schemas
const initiatePaymentSchema = z.object({
    phone: z.string().min(9, 'Número de telefone inválido'),
    amount: z.number().positive('Valor deve ser positivo'),
    reference: z.string().min(1, 'Referência obrigatória'),
    module: z.enum(['pos', 'invoice', 'hospitality', 'pharmacy']),
    moduleReferenceId: z.string().optional(),
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
    try {
        console.log('M-Pesa Callback received:', JSON.stringify(req.body, null, 2));

        const success = await mpesaService.processCallback(req.body);

        if (success) {
            res.json({ ResultCode: 0, ResultDesc: 'Success' });
        } else {
            res.status(400).json({ ResultCode: 1, ResultDesc: 'Failed to process' });
        }
    } catch (error) {
        console.error('M-Pesa Callback Error:', error);
        res.status(500).json({ ResultCode: 1, ResultDesc: 'Internal error' });
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
    try {
        const isAvailable = mpesaService.isAvailable();

        res.json({
            available: true, // Always available (simulation mode fallback)
            configured: isAvailable,
            mode: isAvailable ? 'production' : 'sandbox',
            message: isAvailable
                ? 'M-Pesa configurado e pronto'
                : 'M-Pesa em modo simulação (credenciais não configuradas)'
        });
    } catch (error) {
        console.error('M-Pesa status error:', error);
        res.status(500).json({ error: 'Erro ao verificar status M-Pesa' });
    }
});

/**
 * Initiate M-Pesa Payment
 * POST /api/payments/mpesa/initiate
 */
router.post('/mpesa/initiate', authenticate, async (req: AuthRequest, res) => {
    try {
        console.log('M-Pesa initiate request body:', JSON.stringify(req.body, null, 2));
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

        if (result.success) {
            res.json({
                success: true,
                transactionId: result.transactionId,
                mpesaTransactionId: result.mpesaTransactionId,
                conversationId: result.conversationId,
                message: result.message,
                simulated: result.simulated,
            });
        } else {
            res.status(400).json({
                success: false,
                transactionId: result.transactionId,
                message: result.message,
            });
        }
    } catch (error: unknown) {
        console.error('M-Pesa initiate error:', error.message || error);
        if (error.errors) {
            console.error('Validation errors:', JSON.stringify(error.errors, null, 2));
        }
        if (error.name === 'ZodError') {
            return res.status(400).json({
                error: 'Dados inválidos',
                details: error.errors,
            });
        }
        res.status(500).json({ error: 'Erro ao iniciar pagamento M-Pesa', details: error.message });
    }
});

/**
 * Get transaction status
 * GET /api/payments/mpesa/transaction/:id
 */
router.get('/mpesa/transaction/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const result = await mpesaService.getTransactionStatus(req.params.id);

        if (!result) {
            return res.status(404).json({ error: 'Transação não encontrada' });
        }

        // Verify company access
        if (result.transaction.companyId && result.transaction.companyId !== req.companyId) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        res.json(result);
    } catch (error) {
        console.error('M-Pesa transaction status error:', error);
        res.status(500).json({ error: 'Erro ao verificar transação' });
    }
});

/**
 * Get transactions for a module reference
 * GET /api/payments/mpesa/module/:module/:referenceId
 */
router.get('/mpesa/module/:module/:referenceId', authenticate, async (req: AuthRequest, res) => {
    try {
        const { module, referenceId } = req.params;

        if (!['pos', 'invoice', 'hospitality', 'pharmacy'].includes(module)) {
            return res.status(400).json({ error: 'Módulo inválido' });
        }

        const transactions = await mpesaService.getTransactionsByReference(
            module as any,
            referenceId
        );

        // Filter by company
        const filtered = transactions.filter(
            (t) => !t.companyId || t.companyId === req.companyId
        );

        res.json(filtered);
    } catch (error) {
        console.error('M-Pesa module transactions error:', error);
        res.status(500).json({ error: 'Erro ao buscar transações' });
    }
});

/**
 * Cancel pending transaction
 * POST /api/payments/mpesa/transaction/:id/cancel
 */
router.post('/mpesa/transaction/:id/cancel', authenticate, async (req: AuthRequest, res) => {
    try {
        // First check ownership
        const transaction = await prisma.mpesaTransaction.findUnique({
            where: { id: req.params.id },
        });

        if (!transaction) {
            return res.status(404).json({ error: 'Transação não encontrada' });
        }

        if (transaction.companyId && transaction.companyId !== req.companyId) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const success = await mpesaService.cancelTransaction(req.params.id);

        if (success) {
            res.json({ success: true, message: 'Transação cancelada' });
        } else {
            res.status(400).json({
                success: false,
                message: 'Não é possível cancelar esta transação',
            });
        }
    } catch (error) {
        console.error('M-Pesa cancel error:', error);
        res.status(500).json({ error: 'Erro ao cancelar transação' });
    }
});

/**
 * Get transaction history (paginated)
 * GET /api/payments/mpesa/history
 */
router.get('/mpesa/history', authenticate, async (req: AuthRequest, res) => {
    try {
        const {
            page = '1',
            limit = '20',
            status,
            module,
            startDate,
            endDate,
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where: any = {
            companyId: req.companyId,
        };

        if (status) where.status = status;
        if (module) where.module = module;

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate as string);
            if (endDate) where.createdAt.lte = new Date(endDate as string);
        }

        const [total, transactions] = await Promise.all([
            prisma.mpesaTransaction.count({ where }),
            prisma.mpesaTransaction.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum,
            }),
        ]);

        res.json({
            data: transactions,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                hasMore: skip + transactions.length < total,
            },
        });
    } catch (error) {
        console.error('M-Pesa history error:', error);
        res.status(500).json({ error: 'Erro ao buscar histórico' });
    }
});

export default router;
