import { prisma } from '../lib/prisma';
import { cacheService, CacheKeys } from './cache.service';
import { logger } from '../utils/logger';
import { Prisma } from '@prisma/client';
import { getPaginationParams, buildPaginationMeta, createPaginatedResponse } from '../utils/pagination';
import { ApiError } from '../middleware/error.middleware';
import { logAudit } from '../middleware/audit';

export class ProductsService {
    /**
     * List products with pagination, search, and filters
     */
    async list(params: any, companyId: string) {
        const { page, limit, skip } = getPaginationParams(params);
        const {
            search,
            category,
            status,
            minPrice,
            maxPrice,
            supplierId,
            sortBy = 'name',
            sortOrder = 'asc',
            originModule = 'inventory',
            warehouseId
        } = params;

        const where: Prisma.ProductWhereInput = {
            isActive: true,
            companyId: companyId,
            originModule: originModule as string
        };

        if (search) {
            where.OR = [
                { name: { contains: String(search), mode: 'insensitive' } },
                { code: { contains: String(search), mode: 'insensitive' } },
                { barcode: { contains: String(search) } },
                { sku: { contains: String(search), mode: 'insensitive' } }
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
        const cacheKey = CacheKeys.productList(companyId, page, JSON.stringify(where));

        // Try cache
        const cached = cacheService.get(cacheKey);
        if (cached) {
            logger.info(`Products cache hit: page ${page}`);
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
                    categoryModel: {
                        select: { id: true, name: true }
                    },
                    warehouseStocks: {
                        include: {
                            warehouse: { select: { id: true, name: true, code: true } }
                        }
                    }
                },
                orderBy: { [sortBy as string]: sortOrder },
                skip,
                take: limit
            })
        ]);

        const response = createPaginatedResponse(products, page, limit, total);

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

        if (!product) throw ApiError.notFound('Produto não encontrado');
        return product;
    }

    /**
     * Get Product by Barcode
     */
    async getByBarcode(barcode: string, companyId: string) {
        const product = await prisma.product.findFirst({
            where: {
                barcode,
                companyId,
                isActive: true
            },
            include: {
                supplier: true,
                warehouseStocks: {
                    include: { warehouse: true }
                }
            }
        });

        if (!product) throw ApiError.notFound('Produto com este código de barras não encontrado');
        return product;
    }

    /**
     * Create Product
     */
    async create(data: any, companyId: string) {
        const {
            code, name, description, category, categoryId, price, costPrice,
            currentStock, minStock, maxStock, unit, barcode, sku,
            isActive, isService, requiresPrescription, dosageForm, strength, manufacturer,
            originModule, location, supplierId
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

        if (existing) throw ApiError.badRequest('Código de produto já existe');

        // Professional Inventory: Start with zero stock. 
        // Quantities must be added via Batches/Validities or Stock Movements.
        const stock = 0; 
        const min = minStock || 5;
        let status: 'in_stock' | 'low_stock' | 'out_of_stock' = 'out_of_stock';
        // status is always out_of_stock when creating without batch

        // Data object typed as any to prevent strict Prisma client type mismatch before generation
        const productData: any = {
            code: productCode,
            name,
            description,
            category: category || 'other',
            categoryId: categoryId || null,
            price,
            costPrice: costPrice || 0,
            currentStock: stock,
            minStock: min,
            maxStock,
            unit: unit || 'un',
            barcode,
            sku: sku || null,
            location,
            supplierId,
            companyId,
            status,
            isActive: isActive ?? true,
            originModule: originModule || 'inventory'
        };

        const product = await prisma.product.create({
            data: productData,
            include: { supplier: true }
        });

        // Create Alert
        if (status === 'out_of_stock' || status === 'low_stock') {
            await this.createStockAlert(product, status, companyId);
        }

        return product;
    }

    /**
     * Update Product
     */
    async update(id: string, data: any, companyId: string, userId?: string) {
        // Get old data for audit
        const oldProduct = await prisma.product.findFirst({
            where: { id, companyId }
        });

        if (!oldProduct) throw ApiError.notFound('Produto não encontrado');

        // Only include fields that exist on the Product model to avoid PrismaClientValidationError
        const allowedFields = [
            'code', 'name', 'description', 'category', 'categoryId',
            'price', 'costPrice', 'currentStock', 'reservedStock',
            'minStock', 'maxStock', 'unit', 'barcode', 'sku',
            'location', 'status', 'imageUrl', 'isActive',
            'originModule', 'supplierId', 'isReturnable', 'packSize', 'returnPrice'
        ];

        const updateData: any = {};
        for (const key of allowedFields) {
            if (data[key] !== undefined) {
                updateData[key] = data[key];
            }
        }

        // Recalculate status if stock changed
        if (updateData.currentStock !== undefined || updateData.minStock !== undefined) {
            const stock = updateData.currentStock ?? oldProduct.currentStock;
            const min = updateData.minStock ?? oldProduct.minStock;

            if (stock === 0) updateData.status = 'out_of_stock';
            else if (stock <= min) updateData.status = 'low_stock';
            else updateData.status = 'in_stock';

            // WARNING: Direct stock update should be discouraged in favor of movements
            // but we keep it here for compatibility with existing adjustment logic if needed
        }

        const result = await prisma.product.updateMany({
            where: { id, companyId },
            data: updateData
        });

        if (result.count === 0) throw ApiError.notFound('Produto não encontrado ou acesso negado');

        const product = await prisma.product.findFirst({
            where: { id, companyId },
            include: {
                supplier: true,
                categoryModel: true
            }
        });

        if (!product) throw ApiError.notFound('Produto não encontrado');

        // Manual Detailed Audit
        if (userId) {
            await logAudit({
                userId,
                action: 'UPDATE_PRODUCT',
                entity: 'products',
                entityId: product.id,
                oldData: oldProduct as any,
                newData: product as any
            });
        }

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

        if (result.count === 0) throw ApiError.notFound('Produto não encontrado ou acesso negado');
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

            if (!product) throw ApiError.notFound('Produto não encontrado');

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
     * Get Expiring Products — delegates to ProductBatch table
     */
    async getExpiring(params: any, companyId: string) {
        const { days = '30', page = '1', limit = '20' } = params;
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const expiryThreshold = new Date();
        expiryThreshold.setDate(expiryThreshold.getDate() + parseInt(days as string));
        const now = new Date();

        const where = {
            companyId,
            quantity: { gt: 0 },
            status: { not: 'depleted' as const },
            expiryDate: { not: null, lte: expiryThreshold }
        };

        const [total, batches] = await Promise.all([
            prisma.productBatch.count({ where }),
            prisma.productBatch.findMany({
                where,
                include: { product: { select: { id: true, name: true, code: true, unit: true } } },
                orderBy: { expiryDate: 'asc' },
                skip,
                take: limitNum
            })
        ]);

        const data = batches.map(b => ({
            ...b,
            daysToExpiry: b.expiryDate ? Math.ceil((b.expiryDate.getTime() - now.getTime()) / 86400000) : null,
            isExpired: b.expiryDate ? b.expiryDate < now : false,
        }));

        return {
            data,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                hasMore: skip + data.length < total
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
            pagination: buildPaginationMeta(pageNum, limitNum, total)
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
    /**
     * Get Inventory Metrics for Reports (Valuation, Turnover, etc.)
     */
    async getInventoryMetrics(companyId: string) {
        const products = await prisma.product.findMany({
            where: { companyId, isActive: true },
            select: {
                id: true,
                name: true,
                price: true,
                costPrice: true,
                currentStock: true,
                category: true,
                saleItems: {
                    where: { sale: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }, // Last 30 days
                    select: { quantity: true }
                }
            }
        });

        let totalValue = 0;
        let totalCost = 0;
        let lowStockCount = 0;
        const categoryData: Record<string, { count: number; value: number }> = {};

        products.forEach(p => {
            const stock = p.currentStock || 0;
            const price = Number(p.price) || 0;
            const cost = Number(p.costPrice) || 0;

            totalValue += stock * price;
            totalCost += stock * cost;

            if (!categoryData[p.category]) categoryData[p.category] = { count: 0, value: 0 };
            categoryData[p.category].count++;
            categoryData[p.category].value += stock * price;
        });

        // Calculate Turnover (simple version: sales / avg inventory)
        // Here we just return sales in last 30 days per product for the report to process
        const turnoverData = products.map(p => ({
            name: p.name,
            stock: p.currentStock,
            salesLast30Days: p.saleItems.reduce((acc: number, item: any) => acc + item.quantity, 0)
        })).sort((a, b) => b.salesLast30Days - a.salesLast30Days);

        return {
            totalValue,
            totalCost,
            potentialProfit: totalValue - totalCost,
            totalProducts: products.length,
            categoryDistribution: categoryData,
            topMovingProducts: turnoverData.slice(0, 10)
        };
    }

    // ── Price Tiers ─────────────────────────────────────────────────────────────

    async getPriceTiers(productId: string, companyId: string) {
        // Verify product belongs to company
        const product = await prisma.product.findFirst({ where: { id: productId, companyId } });
        if (!product) throw new ApiError(404, 'Produto não encontrado');

        return prisma.priceTier.findMany({
            where: { productId, companyId },
            orderBy: { minQty: 'asc' }
        });
    }

    async setPriceTiers(productId: string, tiers: { minQty: number; price: number; label?: string }[], companyId: string) {
        const product = await prisma.product.findFirst({ where: { id: productId, companyId } });
        if (!product) throw new ApiError(404, 'Produto não encontrado');

        // Replace all tiers for this product
        await prisma.$transaction([
            prisma.priceTier.deleteMany({ where: { productId, companyId } }),
            ...tiers
                .filter(t => t.minQty > 0 && t.price > 0)
                .map(t =>
                    prisma.priceTier.create({
                        data: { productId, companyId, minQty: t.minQty, price: t.price, label: t.label }
                    })
                )
        ]);

        return prisma.priceTier.findMany({
            where: { productId, companyId },
            orderBy: { minQty: 'asc' }
        });
    }

    async getAllProductsWithTiers(companyId: string, originModule?: string) {
        const products = await prisma.product.findMany({
            where: { companyId, isActive: true, ...(originModule ? { originModule } : {}) },
            include: { priceTiers: { orderBy: { minQty: 'asc' } } },
            orderBy: { name: 'asc' }
        });
        return products;
    }

    /**
     * Bulk update prices for products
     */
    async bulkUpdatePrices(params: any, companyId: string, userId?: string, userName?: string) {
        const { category, adjustmentType, adjustmentValue, operation, origin_module } = params;

        const where: Prisma.ProductWhereInput = {
            companyId,
            isActive: true,
            ...(category ? { category } : {}),
            ...(origin_module ? { originModule: origin_module } : {})
        };

        const products = await prisma.product.findMany({ where });
        if (products.length === 0) throw ApiError.notFound('Nenhum produto encontrado para o filtro seleccionado');

        const updates = products.map(product => {
            const currentPrice = Number(product.price);
            let newPrice = currentPrice;

            if (adjustmentType === 'percentage') {
                const delta = (currentPrice * adjustmentValue) / 100;
                newPrice = operation === 'increase' ? currentPrice + delta : currentPrice - delta;
            } else {
                newPrice = operation === 'increase' ? currentPrice + adjustmentValue : currentPrice - adjustmentValue;
            }

            if (newPrice < 0) newPrice = 0;

            return prisma.product.update({
                where: { id: product.id },
                data: { price: newPrice }
            });
        });

        await prisma.$transaction(updates);

        // Audit Log
        if (userId) {
            const { auditService } = require('./audit.service');
            await auditService.log({
                userId,
                userName,
                action: 'BULK_PRICE_UPDATE',
                entity: 'products',
                companyId,
                details: {
                    filter: { category, origin_module },
                    adjustment: { type: adjustmentType, value: adjustmentValue, operation },
                    productsAffected: products.length
                }
            });
        }

        return { count: products.length };
    }
}

export const productsService = new ProductsService();
