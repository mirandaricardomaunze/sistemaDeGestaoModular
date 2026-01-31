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
            sortOrder = 'asc',
            origin_module = 'inventory'
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where: any = {
            isActive: true,
            companyId: req.companyId,
            origin_module: origin_module as string
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
        if (!req.companyId) return res.status(400).json({ error: 'Company not identified' });
        const cacheKey = CacheKeys.productList(req.companyId, pageNum, JSON.stringify(where));

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

// Get all stock movements (Global Audit Log) - MUST be before /:id route
router.get('/stock-movements', authenticate, async (req: AuthRequest, res) => {
    try {
        const {
            page = '1',
            limit = '20',
            type,
            warehouseId,
            productId,
            search,
            startDate,
            endDate
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where: any = {
            companyId: req.companyId
        };

        if (type && type !== 'all') {
            where.movementType = type;
        }

        if (warehouseId && warehouseId !== 'all') {
            where.warehouseId = warehouseId;
        }

        if (productId) {
            where.productId = productId;
        }

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate as string);
            if (endDate) {
                const end = new Date(endDate as string);
                end.setHours(23, 59, 59, 999);
                where.createdAt.lte = end;
            }
        }

        // Search by product name/code or reason
        if (search) {
            where.OR = [
                { reason: { contains: search as string, mode: 'insensitive' } },
                { reference: { contains: search as string, mode: 'insensitive' } },
                { product: { name: { contains: search as string, mode: 'insensitive' } } },
                { product: { code: { contains: search as string, mode: 'insensitive' } } }
            ];
        }

        const [total, movements] = await Promise.all([
            prisma.stockMovement.count({ where }),
            prisma.stockMovement.findMany({
                where,
                include: {
                    product: { select: { id: true, name: true, code: true, unit: true } },
                    warehouse: { select: { id: true, name: true, code: true } }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum
            })
        ]);

        res.json({
            data: movements,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                hasMore: skip + movements.length < total
            }
        });
    } catch (error) {
        logger.error('Get stock movements error:', error);
        res.status(500).json({ error: 'Erro ao buscar histórico de movimentações' });
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
            code, name, description, category, price, costPrice,
            currentStock, minStock, maxStock, unit, barcode,
            isActive, isService, requiresPrescription, dosageForm, strength, manufacturer,
            origin_module, expiryDate, batchNumber, location, supplierId
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
                category: (category as any) || 'other',
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
                isActive: isActive ?? true,
                origin_module: origin_module || 'inventory'
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

        const finalResult = await prisma.$transaction(async (tx) => {
            const product = await tx.product.findFirst({
                where: { id, companyId: req.companyId }
            });

            if (!product) throw new Error('Produto não encontrado');

            const balanceBefore = product.currentStock;
            let newStock = balanceBefore;

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

            // Update Product
            await tx.product.update({
                where: { id },
                data: { currentStock: newStock, status }
            });

            // Handle Warehouse Stock if specified
            let warehouseBalanceBefore = 0;
            if (warehouseId) {
                const wStock = await tx.warehouseStock.findUnique({
                    where: { warehouseId_productId: { warehouseId, productId: id } }
                });
                warehouseBalanceBefore = wStock?.quantity || 0;

                await tx.warehouseStock.upsert({
                    where: { warehouseId_productId: { warehouseId, productId: id } },
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
                        quantity: operation === 'add' ? quantity : (operation === 'subtract' ? 0 : quantity)
                    }
                });
            }

            // Log Movement
            await tx.stockMovement.create({
                data: {
                    productId: id,
                    warehouseId: warehouseId || null,
                    movementType: 'adjustment',
                    quantity: operation === 'add' ? quantity : (operation === 'subtract' ? -quantity : (newStock - balanceBefore)),
                    balanceBefore: warehouseId ? warehouseBalanceBefore : balanceBefore,
                    balanceAfter: warehouseId ? (warehouseBalanceBefore + (operation === 'add' ? quantity : (operation === 'subtract' ? -quantity : (newStock - balanceBefore)))) : newStock,
                    reason: reason || `Ajuste manual (${operation})`,
                    performedBy: req.userName || 'Sistema',
                    companyId: req.companyId,
                    originModule: 'inventory',
                    reference: null
                }
            });

            // Create alert if status is low/out and no open alert exists, OR resolve if back to normal
            if (status !== 'in_stock') {
                const existingAlert = await tx.alert.findFirst({
                    where: {
                        relatedId: id,
                        type: 'low_stock',
                        isResolved: false
                    }
                });

                if (!existingAlert) {
                    await tx.alert.create({
                        data: {
                            type: 'low_stock',
                            priority: status === 'out_of_stock' ? 'critical' : 'high',
                            title: status === 'out_of_stock'
                                ? `Stock esgotado: ${product.name}`
                                : `Stock baixo: ${product.name}`,
                            message: `${product.name} (${product.code}) tem apenas ${newStock} unidades. Mínimo: ${product.minStock}`,
                            relatedId: id,
                            relatedType: 'product',
                            companyId: req.companyId
                        }
                    });
                }
            } else {
                await tx.alert.updateMany({
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

            return tx.product.findFirst({
                where: { id, companyId: req.companyId },
                include: {
                    warehouseStocks: {
                        include: { warehouse: { select: { id: true, name: true, code: true } } }
                    }
                }
            });
        });

        res.json(finalResult);
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
        const { page = '1', limit = '20' } = req.query;
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where = {
            companyId: req.companyId,
            isActive: true,
            OR: [
                { status: 'low_stock' as const },
                { status: 'out_of_stock' as const }
            ]
        };

        const [total, products] = await Promise.all([
            prisma.product.count({ where }),
            prisma.product.findMany({
                where,
                orderBy: { currentStock: 'asc' },
                skip,
                take: limitNum
            })
        ]);

        res.json({
            data: products,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                hasMore: skip + products.length < total
            }
        });
    } catch (error) {
        logger.error('Get low stock error:', error);
        res.status(500).json({ error: 'Erro ao buscar produtos com baixo stock' });
    }
});

// Get expiring soon products
router.get('/alerts/expiring', authenticate, async (req: AuthRequest, res) => {
    try {
        const { days = '30', page = '1', limit = '20' } = req.query;
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const expiryThreshold = new Date();
        expiryThreshold.setDate(expiryThreshold.getDate() + parseInt(days as string));

        const where = {
            companyId: req.companyId,
            isActive: true,
            expiryDate: {
                not: null,
                lte: expiryThreshold
            }
        };

        const [total, products] = await Promise.all([
            prisma.product.count({ where }),
            prisma.product.findMany({
                where,
                orderBy: { expiryDate: 'asc' },
                skip,
                take: limitNum
            })
        ]);

        res.json({
            data: products,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                hasMore: skip + products.length < total
            }
        });
    } catch (error) {
        logger.error('Get expiring soon error:', error);
        res.status(500).json({ error: 'Erro ao buscar produtos a expirar' });
    }
});

// Get product stock movements (Audit Trail)
router.get('/:id/movements', authenticate, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const { page = '1', limit = '10' } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where = {
            productId: id,
            companyId: req.companyId
        };

        const [total, movements] = await Promise.all([
            prisma.stockMovement.count({ where }),
            prisma.stockMovement.findMany({
                where,
                include: {
                    warehouse: { select: { id: true, name: true, code: true } }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum
            })
        ]);

        res.json({
            data: movements,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                hasMore: skip + movements.length < total
            }
        });
    } catch (error) {
        logger.error('Get product movements error:', error);
        res.status(500).json({ error: 'Erro ao buscar histórico de movimentações' });
    }
});



export default router;

