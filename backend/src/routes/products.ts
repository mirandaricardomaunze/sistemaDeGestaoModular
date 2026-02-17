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

const router = Router();

// Get all products with pagination
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        if (!req.companyId) return res.status(400).json({ error: 'Company not identified' });
        const result = await productsService.list(req.query, req.companyId);
        res.json(result);
    } catch (error) {
        logger.error('Get products error:', error);
        res.status(500).json({ error: 'Erro ao buscar produtos' });
    }
});

// Get all stock movements (Global Audit Log) - MUST be before /:id route
router.get('/stock-movements', authenticate, async (req: AuthRequest, res) => {
    try {
        if (!req.companyId) return res.status(400).json({ error: 'Company not identified' });
        const result = await productsService.getMovements(req.query, req.companyId);
        res.json(result);
    } catch (error) {
        logger.error('Get stock movements error:', error);
        res.status(500).json({ error: 'Erro ao buscar histórico de movimentações' });
    }
});

// Get product by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        if (!req.companyId) return res.status(400).json({ error: 'Company not identified' });
        const product = await productsService.getById(req.params.id, req.companyId);
        res.json(product);
    } catch (error) {
        logger.error('Get product error:', error);
        res.status(404).json({ error: error.message || 'Produto não encontrado' });
    }
});

// Get low stock products
router.get('/alerts/low-stock', authenticate, async (req: AuthRequest, res) => {
    try {
        if (!req.companyId) return res.status(400).json({ error: 'Company not identified' });
        const result = await productsService.getLowStock(req.query, req.companyId);
        res.json(result);
    } catch (error) {
        logger.error('Get low stock error:', error);
        res.status(500).json({ error: 'Erro ao buscar produtos com baixo stock' });
    }
});

// Get expiring soon products
router.get('/alerts/expiring', authenticate, async (req: AuthRequest, res) => {
    try {
        if (!req.companyId) return res.status(400).json({ error: 'Company not identified' });
        const result = await productsService.getExpiring(req.query, req.companyId);
        res.json(result);
    } catch (error) {
        logger.error('Get expiring soon error:', error);
        res.status(500).json({ error: 'Erro ao buscar produtos a expirar' });
    }
});

// Get product stock movements (Audit Trail)
router.get('/:id/movements', authenticate, async (req: AuthRequest, res) => {
    try {
        if (!req.companyId) return res.status(400).json({ error: 'Company not identified' });
        const result = await productsService.getMovements(req.query, req.companyId, req.params.id);
        res.json(result);
    } catch (error) {
        logger.error('Get product movements error:', error);
        res.status(500).json({ error: 'Erro ao buscar histórico de movimentações' });
    }
});

// Create product
router.post('/', authenticate, async (req: AuthRequest, res) => {
    try {
        if (!req.companyId) return res.status(400).json({ error: 'Company not identified' });

        // Validate request body
        const validatedData = createProductSchema.parse(req.body);

        const product = await productsService.create(validatedData, req.companyId);
        res.status(201).json(product);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({
                error: 'Dados inválidos',
                details: formatZodError(error)
            });
        }
        logger.error('Create product error:', error);
        res.status(500).json({ error: error.message || 'Erro ao criar produto' });
    }
});

// Update product
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        if (!req.companyId) return res.status(400).json({ error: 'Company not identified' });

        // Validate request body
        const validatedData = updateProductSchema.parse(req.body);

        const product = await productsService.update(req.params.id, validatedData, req.companyId);
        res.json(product);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({
                error: 'Dados inválidos',
                details: formatZodError(error)
            });
        }
        logger.error('Update product error:', error);
        res.status(500).json({ error: error.message || 'Erro ao atualizar produto' });
    }
});

// Update stock
router.patch('/:id/stock', authenticate, async (req: AuthRequest, res) => {
    try {
        if (!req.companyId) return res.status(400).json({ error: 'Company not identified' });

        // Validate request body
        const validatedData = adjustStockSchema.parse(req.body);

        const result = await productsService.updateStock(req.params.id, validatedData, req.companyId, req.userName || 'Sistema');
        res.json(result);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({
                error: 'Dados inválidos',
                details: formatZodError(error)
            });
        }
        logger.error('Update stock error:', error);
        res.status(500).json({ error: error.message || 'Erro ao atualizar stock' });
    }
});

// Delete product
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        if (!req.companyId) return res.status(400).json({ error: 'Company not identified' });
        await productsService.delete(req.params.id, req.companyId);
        res.json({ message: 'Produto removido com sucesso' });
    } catch (error) {
        logger.error('Delete product error:', error);
        res.status(500).json({ error: error.message || 'Erro ao remover produto' });
    }
});

export default router;

