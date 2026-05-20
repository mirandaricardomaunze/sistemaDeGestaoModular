import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { customersService } from '../services/customersService';
import {
    createCustomerSchema,
    updateCustomerSchema,
    updateCustomerBalanceSchema
} from '../utils/validation';
import { ApiError } from '../middleware/error.middleware';
import { emitToCompany } from '../lib/socket';

const router = Router();

const customerAccountPaymentSchema = z.object({
    targetType: z.enum(['invoice', 'credit_sale']),
    targetId: z.string().min(1, 'Documento obrigatorio'),
    amount: z.coerce.number().positive('Valor deve ser maior que zero'),
    method: z.enum(['cash', 'card', 'transfer', 'check', 'mpesa', 'emola', 'other']),
    reference: z.string().max(100, 'Referencia muito longa').optional().nullable(),
    notes: z.string().max(500, 'Notas muito longas').optional().nullable(),
    sessionId: z.string().optional().nullable()
});

function sanitizeCustomerPayload(payload: Record<string, unknown>) {
    const sanitized = { ...payload };
    for (const key of ['code', 'email', 'phone', 'document', 'address', 'city', 'province', 'notes']) {
        if (sanitized[key] === '') sanitized[key] = undefined;
    }
    if (sanitized.creditLimit === '' || sanitized.creditLimit === null) sanitized.creditLimit = undefined;
    if (typeof sanitized.creditLimit === 'string') sanitized.creditLimit = Number(sanitized.creditLimit);
    return sanitized;
}

// Get all customers with pagination
router.get('/', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const result = await customersService.list(req.query, req.companyId);
    res.json(result);
});

// Get customer by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const customer = await customersService.getById(req.params.id, req.companyId);
    res.json(customer);
});

// Create customer
router.post('/', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const validatedData = createCustomerSchema.parse(sanitizeCustomerPayload(req.body));
    const customer = await customersService.create(validatedData, req.companyId);
    emitToCompany(req.companyId, 'customer:created', customer);
    res.status(201).json(customer);
});

// Update customer
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const validatedData = updateCustomerSchema.parse(sanitizeCustomerPayload(req.body));
    const updated = await customersService.update(req.params.id, validatedData, req.companyId);
    emitToCompany(req.companyId, 'customer:updated', updated);
    res.json(updated);
});

// Delete customer (soft delete)
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    await customersService.delete(req.params.id, req.companyId);
    emitToCompany(req.companyId, 'customer:deleted', { id: req.params.id });
    res.json({ message: 'Cliente removido com sucesso' });
});

// Get customer purchase history with pagination
router.get('/:id/purchases', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const result = await customersService.getPurchases(req.params.id, req.query, req.companyId);
    res.json(result);
});

// Get customer financial account: invoices, payments and credit debts
router.get('/:id/account', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa nao identificada. Faca login novamente.');
    const result = await customersService.getAccount(req.params.id, req.companyId);
    res.json(result);
});

// Register a payment against an open customer invoice or credit sale.
router.post('/:id/account/payments', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa nao identificada. Faca login novamente.');
    const validatedData = customerAccountPaymentSchema.parse(req.body);
    const result = await customersService.registerAccountPayment(
        req.params.id,
        validatedData,
        req.companyId,
        req.userName || 'Sistema'
    );
    emitToCompany(req.companyId, 'customer:payment_registered', {
        customerId: req.params.id,
        targetType: validatedData.targetType,
        targetId: validatedData.targetId,
        amount: validatedData.amount
    });
    res.status(201).json(result);
});

// Update customer balance
router.patch('/:id/balance', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const validatedData = updateCustomerBalanceSchema.parse(req.body);
    const result = await customersService.updateBalance(req.params.id, validatedData, req.companyId);
    res.json(result);
});

export default router;
