import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import {
    createProductSchema,
    updateProductSchema,
    adjustStockSchema,
    formatZodError,
    ZodError
} from '../validation';
import { productsService } from '../services/products.service';
import { ApiError } from '../middleware/error.middleware';

const router = Router();

// Get all products with pagination
router.get('/', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const result = await productsService.list(req.query, req.companyId);
    res.json(result);
});

// Get all stock movements (Global Audit Log) - MUST be before /:id route
router.get('/stock-movements', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const result = await productsService.getMovements(req.query, req.companyId);
    res.json(result);
});

// Get product by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const product = await productsService.getById(req.params.id, req.companyId);
    res.json(product);
});

// Get low stock products
router.get('/alerts/low-stock', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const result = await productsService.getLowStock(req.query, req.companyId);
    res.json(result);
});

// Get expiring soon products
router.get('/alerts/expiring', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const result = await productsService.getExpiring(req.query, req.companyId);
    res.json(result);
});

// Get product stock movements (Audit Trail)
router.get('/:id/movements', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const result = await productsService.getMovements(req.query, req.companyId, req.params.id);
    res.json(result);
});

// Create product
router.post('/', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');

    // Validate request body
    const validatedData = createProductSchema.parse(req.body);

    const product = await productsService.create(validatedData, req.companyId);
    res.status(201).json(product);
});

// Update product
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');

    // Validate request body
    const validatedData = updateProductSchema.parse(req.body);

    const product = await productsService.update(req.params.id, validatedData, req.companyId);
    res.json(product);
});

// Update stock
router.patch('/:id/stock', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');

    // Validate request body
    const validatedData = adjustStockSchema.parse(req.body);

    const result = await productsService.updateStock(req.params.id, validatedData, req.companyId, req.userName || 'Sistema');
    res.json(result);
});

// Delete product
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    await productsService.delete(req.params.id, req.companyId);
    res.json({ message: 'Produto removido com sucesso' });
});

export default router;

