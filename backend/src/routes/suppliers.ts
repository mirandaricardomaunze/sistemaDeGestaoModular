import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { suppliersService } from '../services/suppliersService';
import { ApiError } from '../middleware/error.middleware';
import {
    createSupplierSchema,
    updateSupplierSchema,
    createPurchaseOrderSchema,
    receivePurchaseOrderSchema
} from '../validation';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    res.json(await suppliersService.list(req.query, req.companyId));
});

router.get('/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    res.json(await suppliersService.getById(req.params.id, req.companyId));
});

router.post('/', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const validatedData = createSupplierSchema.parse(req.body);
    res.status(201).json(await suppliersService.create(validatedData, req.companyId));
});

router.put('/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const validatedData = updateSupplierSchema.parse(req.body);
    res.json(await suppliersService.update(req.params.id, validatedData, req.companyId));
});

router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    await suppliersService.delete(req.params.id, req.companyId);
    res.json({ message: 'Fornecedor removido com sucesso' });
});

router.post('/:id/orders', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const validatedData = createPurchaseOrderSchema.parse(req.body);
    res.status(201).json(await suppliersService.createOrder(req.params.id, validatedData, req.companyId));
});

router.get('/:id/orders', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    res.json(await suppliersService.listOrders(req.params.id, req.query, req.companyId));
});

router.post('/orders/:orderId/receive', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const validatedData = receivePurchaseOrderSchema.parse(req.body);
    await suppliersService.receiveOrder(
        req.params.orderId, 
        validatedData.items, 
        req.companyId, 
        req.userName || 'Sistema',
        req.userId,
        req.userName,
        validatedData.warehouseId
    );
    res.json({ message: 'Itens recebidos com sucesso' });
});

export default router;
