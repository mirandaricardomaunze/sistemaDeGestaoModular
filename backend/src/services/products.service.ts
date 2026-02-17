import { prisma } from '../lib/prisma';
import { cacheService, CacheKeys } from './cache.service';
import { logger } from '../utils/logger';
import { Prisma } from '@prisma/client';

export class ProductsService {
    /**
     * List products with pagination, search, and filters
     */
    async list(params: any, companyId: string) {
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
            origin_module = 'inventory',
            warehouseId
        } = params;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where: Prisma.ProductWhereInput = {
            isActive: true,
            companyId: companyId,
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

        if (minPrice || maxPrice) {
            const priceFilter: any = typeof where.price === 'object' ? { ...where.price } : {};
            if (minPrice) priceFilter.gte = parseFloat(String(minPrice));
            if (maxPrice) priceFilter.lte = parseFloat(String(maxPrice));
            where.price = priceFilter;
        }

        if (supplierId) {
            where.supplierId = supplierId;
        }

        if (warehouseId && warehouseId !== 'all') {
            where.warehouseStocks = {
                some: {
                    warehouseId: String(warehouseId),
                    quantity: { gt: 0 }
                }
            };
        }

        // Cache Key
        const cacheKey = CacheKeys.productList(companyId, pageNum, JSON.stringify(where));

        // Try cache
        const cached = cacheService.get(cacheKey);
        if (cached) {
            logger.info(`Products cache hit: page ${pageNum}`);
            return cached;
        }

        // Database Query
        const [total, products] = await Promise.all([
            prisma.product.count({ where }),
            prisma.product.findMany({
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
            })
        ]);

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

        // Set Cache (2 mins)
        cacheService.set(cacheKey, response, 120);

        return response;
    }

    /**
     * Get Product by ID
     */
    async getById(id: string, companyId: string) {
        const product = await prisma.product.findFirst({
            where: {
                id,
                companyId
            },
            include: {
                supplier: true,
                warehouseStocks: {
                    include: { warehouse: true }
                }
            }
        });

        if (!product) throw new Error('Produto não encontrado');
        return product;
    }

    /**
     * Create Product
     */
    async create(data: any, companyId: string) {
        const {
            code, name, description, category, price, costPrice,
            currentStock, minStock, maxStock, unit, barcode,
            isActive, isService, requiresPrescription, dosageForm, strength, manufacturer,
            origin_module, expiryDate, batchNumber, location, supplierId
        } = data;

        // Use provided code or generate one
        const productCode = code || `PROD-${Date.now().toString().slice(-6)}`;

        // Check duplicate code
        const existing = await prisma.product.findFirst({
            where: {
                code: productCode,
                companyId
            }
        });

        if (existing) throw new Error('Código de produto já existe');

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
                companyId,
                status,
                isActive: isActive ?? true,
                origin_module: origin_module || 'inventory'
            },
            include: { supplier: true }
        });

        // Create Alert
        if (status !== 'in_stock') {
            await this.createStockAlert(product, status, companyId);
        }

        return product;
    }

    /**
     * Update Product
     */
    async update(id: string, data: any, companyId: string) {
        const updateData: any = { ...data };

        // Recalculate status if stock changed
        if (updateData.currentStock !== undefined || updateData.minStock !== undefined) {
            const current = await prisma.product.findFirst({
                where: { id, companyId }
            });

            if (current) {
                const stock = updateData.currentStock ?? current.currentStock;
                const min = updateData.minStock ?? current.minStock;

                if (stock === 0) updateData.status = 'out_of_stock';
                else if (stock <= min) updateData.status = 'low_stock';
                else updateData.status = 'in_stock';
            }
        }

        if (updateData.expiryDate) {
            updateData.expiryDate = new Date(updateData.expiryDate);
        }

        const result = await prisma.product.updateMany({
            where: { id, companyId },
            data: updateData
        });

        if (result.count === 0) throw new Error('Produto não encontrado ou acesso negado');

        const product = await prisma.product.findFirst({
            where: { id, companyId },
            include: { supplier: true }
        });

        if (!product) throw new Error('Produto não encontrado');

        // Manage Alerts
        if (product.status !== 'in_stock') {
            await this.createStockAlert(product, product.status, companyId);
        } else {
            await this.resolveStockAlert(product.id, companyId);
        }

        return product;
    }

    /**
     * Delete Product (Soft Delete)
     */
    async delete(id: string, companyId: string) {
        const result = await prisma.product.updateMany({
            where: { id, companyId },
            data: { isActive: false }
        });

        if (result.count === 0) throw new Error('Produto não encontrado ou acesso negado');
        return true;
    }

    /**
     * Update Stock (Transaction)
     */
    async updateStock(id: string, data: any, companyId: string, userName: string) {
        const { quantity, operation, warehouseId, reason } = data;

        return await prisma.$transaction(async (tx) => {
            const product = await tx.product.findFirst({
                where: { id, companyId }
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

            // Determine Status
            let status: 'in_stock' | 'low_stock' | 'out_of_stock' = 'in_stock';
            if (newStock === 0) status = 'out_of_stock';
            else if (newStock <= product.minStock) status = 'low_stock';

            // Update Product
            await tx.product.update({
                where: { id },
                data: { currentStock: newStock, status }
            });

            // Update Warehouse Stock
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
                    performedBy: userName,
                    companyId: companyId,
                    originModule: 'inventory',
                    reference: null
                }
            });

            // Handle Alerts
            if (status !== 'in_stock') {
                // We need to use tx for alerts within transaction
                const existingAlert = await tx.alert.findFirst({
                    where: { relatedId: id, type: 'low_stock', isResolved: false }
                });

                if (!existingAlert) {
                    await tx.alert.create({
                        data: {
                            type: 'low_stock',
                            priority: status === 'out_of_stock' ? 'critical' : 'high',
                            title: status === 'out_of_stock' ? `Stock esgotado: ${product.name}` : `Stock baixo: ${product.name}`,
                            message: `${product.name} (${product.code}) tem apenas ${newStock} unidades. Mínimo: ${product.minStock}`,
                            relatedId: id,
                            relatedType: 'product',
                            companyId
                        }
                    });
                }
            } else {
                await tx.alert.updateMany({
                    where: { relatedId: id, type: 'low_stock', isResolved: false },
                    data: { isResolved: true, resolvedAt: new Date() }
                });
            }

            return tx.product.findFirst({
                where: { id, companyId },
                include: {
                    warehouseStocks: {
                        include: { warehouse: { select: { id: true, name: true, code: true } } }
                    }
                }
            });
        });
    }

    /**
     * Get Low Stock Products
     */
    async getLowStock(params: any, companyId: string) {
        const { page = '1', limit = '20' } = params;
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where: Prisma.ProductWhereInput = {
            companyId,
            isActive: true,
            OR: [
                { status: 'low_stock' },
                { status: 'out_of_stock' }
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

        return {
            data: products,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                hasMore: skip + products.length < total
            }
        };
    }

    /**
     * Get Expiring Products
     */
    async getExpiring(params: any, companyId: string) {
        const { days = '30', page = '1', limit = '20' } = params;
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const expiryThreshold = new Date();
        expiryThreshold.setDate(expiryThreshold.getDate() + parseInt(days as string));

        const where: Prisma.ProductWhereInput = {
            companyId,
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

        return {
            data: products,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                hasMore: skip + products.length < total
            }
        };
    }

    /**
     * Get Stock Movements
     */
    async getMovements(params: any, companyId: string, id?: string) {
        const {
            page = '1',
            limit = '20',
            type,
            warehouseId,
            productId,
            search,
            startDate,
            endDate
        } = params;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where: Prisma.StockMovementWhereInput = {
            companyId
        };

        if (id) {
            where.productId = id;
        }

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

        return {
            data: movements,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                hasMore: skip + movements.length < total
            }
        };
    }

    // --- Private Helpers ---

    private async createStockAlert(product: any, status: string, companyId: string) {
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
                    priority: status === 'out_of_stock' ? 'critical' : 'high',
                    title: status === 'out_of_stock'
                        ? `Stock esgotado: ${product.name}`
                        : `Stock baixo: ${product.name}`,
                    message: `${product.name} (${product.code}) tem apenas ${product.currentStock} unidades. Mínimo: ${product.minStock}`,
                    relatedId: product.id,
                    relatedType: 'product',
                    companyId
                }
            });
        }
    }

    private async resolveStockAlert(productId: string, companyId: string) {
        await prisma.alert.updateMany({
            where: {
                relatedId: productId,
                type: 'low_stock',
                isResolved: false,
                companyId
            },
            data: {
                isResolved: true,
                resolvedAt: new Date()
            }
        });
    }
}

export const productsService = new ProductsService();
