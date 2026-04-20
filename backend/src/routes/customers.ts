import { Router } from 'express';
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

// Get all customers with pagination
router.get('/', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const result = await customersService.list(req.query, req.companyId);
    res.json(result);
});

// Get customer by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const customer = await customersService.getById(req.params.id, req.companyId);
    res.json(customer);
});

// Create customer
router.post('/', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const validatedData = createCustomerSchema.parse(req.body);
    const customer = await customersService.create(validatedData, req.companyId);
    emitToCompany(req.companyId, 'customer:created', customer);
    res.status(201).json(customer);
});

// Update customer
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const validatedData = updateCustomerSchema.parse(req.body);
    const updated = await customersService.update(req.params.id, validatedData, req.companyId);
    emitToCompany(req.companyId, 'customer:updated', updated);
    res.json(updated);
});

// Delete customer (soft delete)
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    await customersService.delete(req.params.id, req.companyId);
    emitToCompany(req.companyId, 'customer:deleted', { id: req.params.id });
    res.json({ message: 'Cliente removido com sucesso' });
});

// Get customer purchase history with pagination
router.get('/:id/purchases', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const result = await customersService.getPurchases(req.params.id, req.query, req.companyId);
    res.json(result);
});

// Update customer balance
router.patch('/:id/balance', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const validatedData = updateCustomerBalanceSchema.parse(req.body);
    const result = await customersService.updateBalance(req.params.id, validatedData, req.companyId);
    res.json(result);
});

export default router;
