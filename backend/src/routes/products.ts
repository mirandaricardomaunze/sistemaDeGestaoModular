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
import { productsService } from '../services/productsService';
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

// Get product by Barcode
router.get('/barcode/:barcode', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const barcode = req.params.barcode;
    // Whitelist: allow only alphanumeric, hyphens and dots (no path traversal or injections)
    if (!/^[\w\-.]{1,100}$/.test(barcode)) throw ApiError.badRequest('Código de barras inválido');
    const product = await productsService.getByBarcode(barcode, req.companyId);
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

    const product = await productsService.update(req.params.id, validatedData, req.companyId, req.userId);
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

// Bulk price adjustment
router.post('/bulk-price-adjustment', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const result = await productsService.bulkUpdatePrices(
        req.body,
        req.companyId,
        req.userId,
        req.userName
    );
    res.json(result);
});

// ── Price Tiers ───────────────────────────────────────────────────────────────

// GET /api/products/price-tiers/batch?ids=id1,id2,... -- Batch fetch for POS load
router.get('/price-tiers/batch', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const ids = String(req.query.ids || '').split(',').map(s => s.trim()).filter(Boolean);
    if (ids.length === 0) { res.json({}); return; }
    const { prisma } = await import('../lib/prisma');
    const tiers = await prisma.priceTier.findMany({
        where: { productId: { in: ids }, product: { companyId: req.companyId } },
        select: { productId: true, minQty: true, price: true }
    });
    const map: Record<string, { minQty: number; price: number }[]> = {};
    for (const t of tiers) {
        if (!t.productId) continue;
        if (!map[t.productId]) map[t.productId] = [];
        map[t.productId].push({ minQty: t.minQty, price: Number(t.price) });
    }
    res.json(map);
});

// Get price tiers for a product
router.get('/:id/price-tiers', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const tiers = await productsService.getPriceTiers(req.params.id, req.companyId);
    res.json(tiers);
});

// Set/replace price tiers for a product
router.put('/:id/price-tiers', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const { tiers } = req.body;
    if (!Array.isArray(tiers)) throw ApiError.badRequest('tiers deve ser um array');
    const result = await productsService.setPriceTiers(req.params.id, tiers, req.companyId);
    res.json(result);
});

export default router;

