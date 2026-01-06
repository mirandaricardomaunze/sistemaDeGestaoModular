import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { cacheService, CacheKeys } from '../services/cache.service';
import { logger } from '../utils/logger';
import {
    createProductSchema,
    updateProductSchema,
    adjustStockSchema,
    formatZodError,
    ZodError
} from '../validation';

const router = Router();

// Get all products with pagination
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const {
            search,
            category,
            status,
            minPrice,
            maxPrice,
            supplierId,
            page = '1',
            limit = '20',
            sortBy = 'name',
            sortOrder = 'asc'
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where: any = {
            isActive: true,
            companyId: req.companyId
        };

        if (search) {
            where.OR = [
                { name: { contains: String(search), mode: 'insensitive' } },
                { code: { contains: String(search), mode: 'insensitive' } },
                { barcode: { contains: String(search) } }
            ];
        }

        if (category && category !== 'all') {
            where.category = category;
        }

        if (status && status !== 'all') {
            where.status = status;
        }

        if (minPrice) {
            where.price = { ...where.price, gte: parseFloat(String(minPrice)) };
        }

        if (maxPrice) {
            where.price = { ...where.price, lte: parseFloat(String(maxPrice)) };
        }

        if (supplierId) {
            where.supplierId = supplierId;
        }

        const { warehouseId } = req.query;
        if (warehouseId && warehouseId !== 'all') {
            where.warehouseStocks = {
                some: {
                    warehouseId: String(warehouseId),
                    quantity: { gt: 0 }
                }
            };
        }

        // Create cache key
        const cacheKey = CacheKeys.productList(pageNum, JSON.stringify(where));

        // Try cache first
        const cached = cacheService.get(cacheKey);
        if (cached) {
            logger.info(`Products cache hit: page ${pageNum}`);
            return res.json(cached);
        }

        // Get total count for pagination
        const total = await prisma.product.count({ where });

        // Get paginated products with optimized query (avoid N+1)
        const products = await prisma.product.findMany({
            where,
            include: {
                supplier: {
                    select: { id: true, name: true, code: true }
                },
                warehouseStocks: {
                    include: {
                        warehouse: { select: { id: true, name: true, code: true } }
                    }
                }
            },
            orderBy: { [sortBy as string]: sortOrder },
            skip,
            take: limitNum
        });

        const response = {
            data: products,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                hasMore: skip + products.length < total
            }
        };

        // Cache for 2 minutes
        cacheService.set(cacheKey, response, 120);

        res.json(response);
    } catch (error) {
        logger.error('Get products error:', error);
        res.status(500).json({ error: 'Erro ao buscar produtos' });
    }
});

// Get product by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const product = await prisma.product.findFirst({
            where: {
                id: req.params.id,
                companyId: req.companyId // Multi-tenancy isolation
            },
            include: {
                supplier: true,
                warehouseStocks: {
                    include: { warehouse: true }
                }
            }
        });

        if (!product) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }

        res.json(product);
    } catch (error) {
        logger.error('Get product error:', error);
        res.status(500).json({ error: 'Erro ao buscar produto' });
    }
});

// Create product
router.post('/', authenticate, async (req: AuthRequest, res) => {
    try {
        // Validate request body
        const validatedData = createProductSchema.parse(req.body);
        const {
            code, name, description, categoryId, price, costPrice,
            currentStock, minStock, maxStock, unit, barcode,
            expiryDate, batchNumber, location, supplierId, taxRate,
            isActive, isService, requiresPrescription, dosageForm, strength, manufacturer
        } = validatedData;

        // Use provided code or generate one
        const productCode = code || `PROD-${Date.now().toString().slice(-6)}`;

        // Check if code already exists within the company
        const existing = await prisma.product.findFirst({
            where: {
                code: productCode,
                companyId: req.companyId
            }
        });

        if (existing) {
            return res.status(400).json({ error: 'Código de produto já existe' });
        }

        // Determine stock status
        const stock = currentStock || 0;
        const min = minStock || 5;
        let status: 'in_stock' | 'low_stock' | 'out_of_stock' = 'in_stock';
        if (stock === 0) status = 'out_of_stock';
        else if (stock <= min) status = 'low_stock';

        const product = await prisma.product.create({
            data: {
                code: productCode,
                name,
                description,
                category: 'other', // Default category
                price,
                costPrice: costPrice || 0,
                currentStock: stock,
                minStock: min,
                maxStock,
                unit: unit || 'un',
                barcode,
                expiryDate: expiryDate ? new Date(expiryDate) : null,
                batchNumber,
                location,
                supplierId,
                companyId: req.companyId, // Multi-tenancy isolation
                status,
                isActive: isActive ?? true
            },
            include: { supplier: true }
        });

        // Create alert if stock is low or out
        if (status !== 'in_stock') {
            await prisma.alert.create({
                data: {
                    type: 'low_stock',
                    priority: status === 'out_of_stock' ? 'critical' : 'high',
                    title: status === 'out_of_stock'
                        ? `Stock esgotado: ${product.name}`
                        : `Stock baixo: ${product.name}`,
                    message: `${product.name} (${product.code}) tem apenas ${product.currentStock} unidades. Mínimo: ${product.minStock}`,
                    relatedId: product.id,
                    relatedType: 'product',
                    companyId: req.companyId // Multi-tenancy isolation
                }
            });
        }

        res.status(201).json(product);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({
                error: 'Dados inválidos',
                details: formatZodError(error)
            });
        }
        logger.error('Create product error:', error);
        res.status(500).json({ error: 'Erro ao criar produto' });
    }
});

// Update product
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;

        // Validate request body
        const validatedData = updateProductSchema.parse(req.body);
        const updateData: any = { ...validatedData };

        // Verify ownership and recalculate status if stock changed
        if (updateData.currentStock !== undefined || updateData.minStock !== undefined) {
            const current = await prisma.product.findFirst({
                where: {
                    id,
                    companyId: req.companyId
                }
            });
            if (current) {
                const stock = updateData.currentStock ?? current.currentStock;
                const min = updateData.minStock ?? current.minStock;

                if (stock === 0) updateData.status = 'out_of_stock';
                else if (stock <= min) updateData.status = 'low_stock';
                else updateData.status = 'in_stock';
            }
        }

        // Handle expiry date
        if (updateData.expiryDate) {
            updateData.expiryDate = new Date(updateData.expiryDate);
        }

        const result = await prisma.product.updateMany({
            where: {
                id,
                companyId: req.companyId // Multi-tenancy isolation
            },
            data: updateData
        });

        if (result.count === 0) {
            return res.status(404).json({ error: 'Produto não encontrado ou acesso negado' });
        }

        const product = await prisma.product.findFirst({
            where: {
                id,
                companyId: req.companyId
            },
            include: { supplier: true }
        });

        if (!product) {
            return res.status(404).json({ error: 'Produto não encontrado ou acesso negado' });
        }

        // Create alert if status changed to low/out, OR resolve if back to normal
        if (product.status !== 'in_stock') {
            const existingAlert = await prisma.alert.findFirst({
                where: {
                    relatedId: product.id,
                    type: 'low_stock',
                    isResolved: false
                }
            });

            if (!existingAlert) {
                await prisma.alert.create({
                    data: {
                        type: 'low_stock',
                        title: product.status === 'out_of_stock'
                            ? `Stock esgotado: ${product.name}`
                            : `Stock baixo: ${product.name}`,
                        message: `${product.name} (${product.code}) tem apenas ${product.currentStock} unidades. Mínimo: ${product.minStock}`,
                        relatedId: product.id,
                        relatedType: 'product',
                        companyId: req.companyId // Multi-tenancy isolation
                    }
                });
            }
        } else {
            // Back to in_stock, resolve existing low_stock alerts
            await prisma.alert.updateMany({
                where: {
                    relatedId: product.id,
                    type: 'low_stock',
                    isResolved: false
                },
                data: {
                    isResolved: true,
                    resolvedAt: new Date()
                }
            });
        }

        res.json(product);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({
                error: 'Dados inválidos',
                details: formatZodError(error)
            });
        }
        logger.error('Update product error:', error);
        res.status(500).json({ error: 'Erro ao atualizar produto' });
    }
});

// Delete product (soft delete)
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const result = await prisma.product.updateMany({
            where: {
                id: req.params.id,
                companyId: req.companyId // Multi-tenancy isolation
            },
            data: { isActive: false }
        });

        if (result.count === 0) {
            return res.status(404).json({ error: 'Produto não encontrado ou acesso negado' });
        }

        res.json({ message: 'Produto removido com sucesso' });
    } catch (error) {
        logger.error('Delete product error:', error);
        res.status(500).json({ error: 'Erro ao remover produto' });
    }
});

// Update stock
router.patch('/:id/stock', authenticate, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;

        // Validate request body
        const validatedData = adjustStockSchema.parse(req.body);
        const { quantity, operation, warehouseId, reason } = validatedData;

        const product = await prisma.product.findFirst({
            where: {
                id,
                companyId: req.companyId // Multi-tenancy isolation
            }
        });
        if (!product) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }

        let newStock = product.currentStock;

        if (operation === 'add') {
            newStock += quantity;
        } else if (operation === 'subtract') {
            newStock -= quantity;
            if (newStock < 0) newStock = 0;
        } else if (operation === 'set') {
            newStock = quantity;
        }

        // Determine stock status
        let status: 'in_stock' | 'low_stock' | 'out_of_stock' = 'in_stock';
        if (newStock === 0) status = 'out_of_stock';
        else if (newStock <= product.minStock) status = 'low_stock';

        const updated = await prisma.product.updateMany({
            where: {
                id,
                companyId: req.companyId // Multi-tenancy isolation
            },
            data: { currentStock: newStock, status }
        });

        if (updated.count === 0) {
            return res.status(404).json({ error: 'Produto não encontrado ou acesso negado' });
        }

        const result = await prisma.product.findFirst({
            where: {
                id,
                companyId: req.companyId
            }
        });

        if (!result) {
            return res.status(404).json({ error: 'Produto não encontrado ou acesso negado' });
        }

        // Create alert if status is low/out and no open alert exists, OR resolve if back to normal
        if (status !== 'in_stock') {
            const existingAlert = await prisma.alert.findFirst({
                where: {
                    relatedId: id,
                    type: 'low_stock',
                    isResolved: false
                }
            });

            if (!existingAlert) {
                await prisma.alert.create({
                    data: {
                        type: 'low_stock',
                        priority: status === 'out_of_stock' ? 'critical' : 'high',
                        title: status === 'out_of_stock'
                            ? `Stock esgotado: ${result.name}`
                            : `Stock baixo: ${result.name}`,
                        message: `${result.name} (${result.code}) tem apenas ${result.currentStock} unidades. Mínimo: ${result.minStock}`,
                        relatedId: result.id,
                        relatedType: 'product',
                        companyId: req.companyId // Multi-tenancy isolation
                    }
                });
            }
        } else {
            // Back to in_stock, resolve existing low_stock alerts
            await prisma.alert.updateMany({
                where: {
                    relatedId: id,
                    type: 'low_stock',
                    isResolved: false
                },
                data: {
                    isResolved: true,
                    resolvedAt: new Date()
                }
            });
        }

        // If warehouse specified, update warehouse stock too
        if (warehouseId) {
            await prisma.warehouseStock.upsert({
                where: {
                    warehouseId_productId: {
                        warehouseId,
                        productId: id
                    }
                },
                update: {
                    quantity: operation === 'add'
                        ? { increment: quantity }
                        : operation === 'subtract'
                            ? { decrement: quantity }
                            : quantity
                },
                create: {
                    warehouseId,
                    productId: id,
                    quantity
                }
            });
        }

        res.json(updated);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({
                error: 'Dados inválidos',
                details: formatZodError(error)
            });
        }
        logger.error('Update stock error:', error);
        res.status(500).json({ error: 'Erro ao atualizar stock' });
    }
});

// Get low stock products
router.get('/alerts/low-stock', authenticate, async (req: AuthRequest, res) => {
    try {
        const products = await prisma.product.findMany({
            where: {
                companyId: req.companyId, // Multi-tenancy isolation
                isActive: true,
                OR: [
                    { status: 'low_stock' },
                    { status: 'out_of_stock' }
                ]
            },
            orderBy: { currentStock: 'asc' }
        });

        res.json(products);
    } catch (error) {
        logger.error('Get low stock error:', error);
        res.status(500).json({ error: 'Erro ao buscar produtos com baixo stock' });
    }
});

// Get expiring soon products
router.get('/alerts/expiring', authenticate, async (req: AuthRequest, res) => {
    try {
        const { days = '30' } = req.query;
        const expiryThreshold = new Date();
        expiryThreshold.setDate(expiryThreshold.getDate() + parseInt(days as string));

        const products = await prisma.product.findMany({
            where: {
                companyId: req.companyId, // Multi-tenancy isolation
                isActive: true,
                expiryDate: {
                    not: null,
                    lte: expiryThreshold
                }
            },
            orderBy: { expiryDate: 'asc' }
        });

        res.json(products);
    } catch (error) {
        logger.error('Get expiring soon error:', error);
        res.status(500).json({ error: 'Erro ao buscar produtos a expirar' });
    }
});

export default router;

