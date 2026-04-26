import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import {
    createOrderSchema,
    updateOrderSchema,
    updateOrderStatusSchema
} from '../validation';
import { ordersService } from '../services/ordersService';
import { invoicesService } from '../services/invoicesService';
import { ApiError } from '../middleware/error.middleware';

const router = Router();

// ============================================================================
// Orders
// ============================================================================

router.get('/', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const result = await ordersService.list(req.query, req.companyId);
    res.json(result);
});

router.get('/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const order = await ordersService.getById(req.params.id, req.companyId);
    res.json(order);
});

router.post('/', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const validatedData = createOrderSchema.parse(req.body);
    const order = await ordersService.create(validatedData, req.companyId);
    res.status(201).json(order);
});

router.patch('/:id/status', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const validatedData = updateOrderStatusSchema.parse(req.body);
    const order = await ordersService.updateStatus(req.params.id, validatedData, req.companyId);
    res.json(order);
});

router.put('/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const validatedData = updateOrderSchema.parse(req.body);
    const order = await ordersService.update(req.params.id, validatedData, req.companyId);
    res.json(order);
});

router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    await ordersService.delete(req.params.id, req.companyId);
    res.json({ message: 'Encomenda eliminada com sucesso' });
});

router.post('/:id/print', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const order = await ordersService.incrementPrintCount(req.params.id, req.companyId);
    res.json(order);
});

// Convert order to invoice
router.post('/:id/invoice', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const invoice = await invoicesService.convertOrderToInvoice(req.params.id, req.companyId, req.userName);
    res.status(201).json(invoice);
});

export default router;
