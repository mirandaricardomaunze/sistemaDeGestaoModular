import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import {
    createOrderSchema,
    decideOrderCancellationSchema,
    requestOrderCancellationSchema,
    updateOrderSchema,
    updateOrderStatusSchema
} from '../validation';
import { ordersService } from '../services/ordersService';
import { orderCancellationService } from '../services/orderCancellationService';
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

router.get('/cancellation-requests', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const requests = await orderCancellationService.list(req.query, req.companyId);
    res.json(requests);
});

router.post('/cancellation-requests/:requestId/approve', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const validatedData = decideOrderCancellationSchema.parse(req.body);
    const result = await orderCancellationService.approve(req.params.requestId, validatedData, req.companyId, {
        userId: req.userId,
        userName: req.userName,
    });
    res.json(result);
});

router.post('/cancellation-requests/:requestId/reject', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const validatedData = decideOrderCancellationSchema.parse(req.body);
    const result = await orderCancellationService.reject(req.params.requestId, validatedData, req.companyId, {
        userId: req.userId,
        userName: req.userName,
    });
    res.json(result);
});

router.get('/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const order = await ordersService.getById(req.params.id, req.companyId);
    res.json(order);
});

router.post('/:id/cancellation-requests', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const validatedData = requestOrderCancellationSchema.parse(req.body);
    const request = await orderCancellationService.request(req.params.id, validatedData, req.companyId, {
        userId: req.userId,
        userName: req.userName,
    });
    res.status(201).json(request);
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
