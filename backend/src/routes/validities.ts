/**
 * Validity Routes -- delegates to BatchesService (ProductBatch table).
 * The old /products/:productId/validities and /validities/* URLs are kept
 * so that any existing clients continue to work without changes.
 */
import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { batchesService } from '../services/batchesService';
import { ApiError } from '../middleware/error.middleware';
import { z } from 'zod';

const router = Router();

const createSchema = z.object({
    lote: z.string().max(100).optional().nullable(),
    quantity: z.number().int().min(0),
    expiryDate: z.string().min(1, 'Data de validade obrigatória'),
    costPrice: z.number().nonnegative().optional(),
    notes: z.string().max(500).optional().nullable(),
});

const updateSchema = createSchema.partial();

// GET /products/:productId/validities  →  list batches for product
router.get('/products/:productId/validities', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const result = await batchesService.list(req.companyId, { productId: req.params.productId, limit: 100 });
    const batches = result.data ?? result;
    const now = Date.now();
    // Map ProductBatch fields to the old ProductValidity shape so the frontend is compatible
    res.json(
        (Array.isArray(batches) ? batches : []).map((b: any) => ({
            id: b.id,
            productId: b.productId,
            lote: b.batchNumber,
            quantity: b.quantity,
            expiryDate: b.expiryDate ?? null,
            status: b.status === 'active' ? 'active'
                : b.status === 'expiring_soon' ? 'expiring_soon'
                : b.status === 'expired' ? 'expired'
                : 'active',
            notes: b.notes ?? null,
            companyId: b.companyId,
            createdAt: b.createdAt,
            updatedAt: b.updatedAt,
            daysToExpiry: b.expiryDate
                ? Math.ceil((new Date(b.expiryDate).getTime() - now) / 86400000)
                : undefined,
        }))
    );
});

// POST /products/:productId/validities  →  create batch
router.post('/products/:productId/validities', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const data = createSchema.parse(req.body);
    const batch = await batchesService.create({
        batchNumber: data.lote || `LOTE-${Date.now()}`,
        productId: req.params.productId,
        quantity: data.quantity,
        expiryDate: data.expiryDate,
        costPrice: data.costPrice,
        notes: data.notes ?? undefined,
    }, req.companyId);
    res.status(201).json(batch);
});

// PUT /validities/:id  →  update batch
router.put('/validities/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const data = updateSchema.parse(req.body);
    const updated = await batchesService.update(req.params.id, {
        quantity: data.quantity,
        expiryDate: data.expiryDate,
        notes: data.notes ?? undefined,
    }, req.companyId);
    res.json(updated);
});

// DELETE /validities/:id  →  delete batch
router.delete('/validities/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    await batchesService.delete(req.params.id, req.companyId);
    res.json({ message: 'Lote eliminado com sucesso' });
});

// GET /validities/expiring?days=30  →  expiring batches
router.get('/validities/expiring', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const days = parseInt(req.query.days as string) || 30;
    const result = await batchesService.getExpiring(req.companyId, { days });
    res.json(result);
});

export default router;
