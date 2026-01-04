import { Router } from 'express';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { cacheService, CacheKeys } from '../services/cache.service';
import { logger } from '../utils/logger';

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
        const product = await prisma.product.findUnique({
            where: { id: req.params.id },
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
        const {
            code, name, description, category, price, costPrice,
            currentStock, minStock, maxStock, unit, barcode,
            expiryDate, batchNumber, location, supplierId, imageUrl,
            isReturnable, returnPrice, packSize
        } = req.body;

        // Check if code already exists
        const existing = await prisma.product.findUnique({
            where: { code }
        });

        if (existing) {
            return res.status(400).json({ error: 'Código de produto já existe' });
        }

        // Determine stock status
        let status: 'in_stock' | 'low_stock' | 'out_of_stock' = 'in_stock';
        if (currentStock === 0) status = 'out_of_stock';
        else if (currentStock <= minStock) status = 'low_stock';

        const product = await prisma.product.create({
            data: {
                code,
                name,
                description,
                category: category || 'other',
                price,
                costPrice: costPrice || 0,
                currentStock: currentStock || 0,
                minStock: minStock || 5,
                maxStock,
                unit: unit || 'un',
                barcode,
                expiryDate: expiryDate ? new Date(expiryDate) : null,
                batchNumber,
                location,
                supplierId,
                imageUrl,
                status,
                isReturnable: isReturnable || false,
                returnPrice: returnPrice || 0,
                packSize: packSize || 1
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
                    relatedType: 'product'
                }
            });
        }

        res.status(201).json(product);
    } catch (error) {
        logger.error('Create product error:', error);
        res.status(500).json({ error: 'Erro ao criar produto' });
    }
});

// Update product
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Recalculate status if stock changed
        if (updateData.currentStock !== undefined || updateData.minStock !== undefined) {
            const current = await prisma.product.findUnique({ where: { id } });
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

        const product = await prisma.product.update({
            where: { id },
            data: updateData,
            include: { supplier: true }
        });

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
                        priority: product.status === 'out_of_stock' ? 'critical' : 'high',
                        title: product.status === 'out_of_stock'
                            ? `Stock esgotado: ${product.name}`
                            : `Stock baixo: ${product.name}`,
                        message: `${product.name} (${product.code}) tem apenas ${product.currentStock} unidades. Mínimo: ${product.minStock}`,
                        relatedId: product.id,
                        relatedType: 'product'
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
        logger.error('Update product error:', error);
        res.status(500).json({ error: 'Erro ao atualizar produto' });
    }
});

// Delete product (soft delete)
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        await prisma.product.update({
            where: { id: req.params.id },
            data: { isActive: false }
        });

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
        const { quantity, operation, warehouseId, reason } = req.body;

        const product = await prisma.product.findUnique({ where: { id } });
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

        const updated = await prisma.product.update({
            where: { id },
            data: { currentStock: newStock, status }
        });

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
                            ? `Stock esgotado: ${updated.name}`
                            : `Stock baixo: ${updated.name}`,
                        message: `${updated.name} (${updated.code}) tem apenas ${updated.currentStock} unidades. Mínimo: ${updated.minStock}`,
                        relatedId: updated.id,
                        relatedType: 'product'
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
        logger.error('Update stock error:', error);
        res.status(500).json({ error: 'Erro ao atualizar stock' });
    }
});

// Get low stock products
router.get('/alerts/low-stock', authenticate, async (req: AuthRequest, res) => {
    try {
        const products = await prisma.product.findMany({
            where: {
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

