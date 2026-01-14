import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { cacheService, CacheKeys } from '../services/cache.service';
import * as crypto from 'crypto';

const router = Router();

// Get all sales with pagination
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        // Import validation
        const { validateSalesQuery, formatZodError } = await import('../utils/validation');
        const { z } = await import('zod');

        // Validate query parameters
        let validatedQuery;
        try {
            validatedQuery = validateSalesQuery(req.query);
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({
                    error: 'Parâmetros de consulta inválidos',
                    details: formatZodError(error)
                });
            }
            throw error;
        }

        const {
            startDate,
            endDate,
            customerId,
            paymentMethod,
            page,
            limit,
            sortBy,
            sortOrder
        } = validatedQuery;

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        const where: any = {
            companyId: req.companyId
        };

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) where.createdAt.lte = new Date(endDate);
        }

        if (customerId) where.customerId = customerId;
        if (paymentMethod) where.paymentMethod = paymentMethod;

        // Get total count and sales in parallel
        const [total, sales] = await Promise.all([
            prisma.sale.count({ where }),
            prisma.sale.findMany({
                where,
                include: {
                    customer: { select: { id: true, name: true, code: true } },
                    user: { select: { id: true, name: true } },
                    items: {
                        include: {
                            product: { select: { id: true, name: true, code: true } }
                        }
                    }
                },
                orderBy: { [sortBy]: sortOrder },
                skip,
                take: limitNum
            })
        ]);

        res.json({
            data: sales,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                hasMore: skip + sales.length < total
            }
        });
    } catch (error: any) {
        logger.error('Get sales error:', {
            message: error.message,
            stack: error.stack,
            userId: req.userId,
            timestamp: new Date().toISOString()
        });
        res.status(500).json({
            error: 'Erro ao buscar vendas',
            code: 'SALES_FETCH_ERROR'
        });
    }
});

// Get sale by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        // Validate UUID format
        const { z } = await import('zod');
        const uuidSchema = z.string().uuid();

        try {
            uuidSchema.parse(req.params.id);
        } catch {
            return res.status(400).json({ error: 'ID de venda inválido' });
        }

        const sale = await prisma.sale.findFirst({
            where: {
                id: req.params.id,
                companyId: req.companyId // Multi-tenancy isolation
            },
            include: {
                customer: true,
                user: { select: { id: true, name: true } },
                items: {
                    include: { product: true }
                }
            }
        });

        if (!sale) {
            return res.status(404).json({ error: 'Venda não encontrada' });
        }

        res.json(sale);
    } catch (error: any) {
        logger.error('Get sale error:', {
            message: error.message,
            saleId: req.params.id,
            userId: req.userId,
            timestamp: new Date().toISOString()
        });
        res.status(500).json({
            error: 'Erro ao buscar venda',
            code: 'SALE_FETCH_ERROR'
        });
    }
});

// Create sale (POS)
router.post('/', authenticate, async (req: AuthRequest, res) => {
    try {
        // Import validation at the top of the file
        const { validateCreateSale, formatZodError } = await import('../utils/validation');
        const { z } = await import('zod');

        // Validate input
        let validatedData;
        try {
            validatedData = validateCreateSale(req.body);
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({
                    error: 'Dados de entrada inválidos',
                    details: formatZodError(error)
                });
            }
            throw error;
        }

        const {
            customerId,
            items,
            subtotal,
            discount: inputDiscount,
            tax,
            total: inputTotal,
            paymentMethod,
            amountPaid,
            change,
            notes,
            redeemPoints // Extract redeemPoints from request
        } = validatedData;

        // Constants for Loyalty System (Should be in settings later)
        const POINTS_EARN_RATE = 100; // Spend 100 to earn 1 point
        const POINT_VALUE = 1;        // 1 point = 1.00 currency unit discount

        // Use Prisma transaction with proper isolation to prevent race conditions
        const sale = await prisma.$transaction(async (tx) => {
            // Step 0: Validate Customer and Loyalty Points (if applicable)
            let loyaltyDiscount = 0;
            let pointsToRedeem = 0;
            let customerData = null;

            if (customerId) {
                customerData = await tx.customer.findFirst({
                    where: {
                        id: customerId,
                        companyId: req.companyId // Multi-tenancy isolation
                    }
                });
                if (!customerData) throw new Error('Cliente não encontrado ou acesso negado');

                // Handle Redemption
                if (redeemPoints && redeemPoints > 0) {
                    // Cast to any to avoid type errors if Prisma Client is not regenerated yet
                    const customerPoints = (customerData as any).loyaltyPoints || 0;

                    if (customerPoints < redeemPoints) {
                        throw new Error(`Pontos insuficientes. Disponível: ${customerPoints}`);
                    }
                    pointsToRedeem = redeemPoints;
                    loyaltyDiscount = pointsToRedeem * POINT_VALUE;
                }
            }

            // Recalculate totals with loyalty discount
            const finalDiscount = (inputDiscount || 0) + loyaltyDiscount;
            const total = inputTotal - loyaltyDiscount; // Adjust total if points are treated as discount
            // Note: If total implies the final payable, we should ensure the math adds up. 
            // In POS, usually "Total" is sent as the final value. 
            // If the user sent a specific Total, we assume they already calculated it? 
            // Secure approach: Recalculate or trust the inputs but ensure consistency.
            // Let's trust inputTotal as the "Pre-Loyalty" total if we receive it, 
            // BUT usually the frontend sends the *final* expected total. 
            // Let's assume inputTotal INCLUDES the loyalty discount if the frontend calculated it?
            // Actually, safer to perform the deduction here to ensure backend authority.
            // Let's assume inputTotal is the value BEFORE loyalty discount if we are applying it here, 
            // OR we just validate.
            // Strategy: We will update the 'discount' and 'total' fields of the created sale object.

            // Step 1: Get and lock document series
            const docSeriesResult = await tx.$queryRaw<Array<{
                id: string;
                code: string;
                name: string;
                prefix: string;
                series: string;
                lastNumber: number;
                isActive: boolean;
            }>>`
                SELECT * FROM document_series 
                WHERE prefix = 'FR' AND "isActive" = true AND "companyId" = ${req.companyId}
                ORDER BY "createdAt" DESC 
                LIMIT 1 
                FOR UPDATE
            `;

            let docSeries = docSeriesResult[0];

            if (!docSeries) {
                docSeries = await tx.documentSeries.create({
                    data: {
                        code: `FR-${new Date().getFullYear()}`,
                        name: `Faturas Recibo ${new Date().getFullYear()}`,
                        prefix: 'FR',
                        series: 'A',
                        lastNumber: 0,
                        isActive: true,
                        companyId: req.companyId
                    }
                });
            }

            const series = docSeries.series;
            const fiscalNumber = docSeries.lastNumber + 1;
            const receiptNumber = `FR ${series}/${String(fiscalNumber).padStart(4, '0')}`;

            await tx.documentSeries.update({
                where: { id: docSeries.id },
                data: { lastNumber: fiscalNumber }
            });

            // Step 3: Hash Code
            const today = new Date();
            const hashData = `${receiptNumber}|${today.toISOString()}|${total}|${docSeries.lastNumber}`;
            const hashCode = crypto.createHash('sha256').update(hashData).digest('hex').substring(0, 4).toUpperCase();

            // Step 4: Validate Products
            const productIds = items.map((item: any) => item.productId);
            const products = await tx.product.findMany({
                where: {
                    id: { in: productIds },
                    companyId: req.companyId // Multi-tenancy isolation
                },
                select: { id: true, name: true, code: true, currentStock: true, minStock: true }
            });

            const productMap = new Map(products.map(p => [p.id, p]));
            for (const item of items) {
                const product = productMap.get(item.productId);
                if (!product) throw new Error(`Produto ${item.productId} não encontrado`);
                if (product.currentStock < item.quantity) {
                    throw new Error(`Stock insuficiente para ${product.name}. Disponível: ${product.currentStock}`);
                }
            }

            // Step 5: Create Sale
            const createdSale = await tx.sale.create({
                data: {
                    receiptNumber,
                    companyId: req.companyId, // Multi-tenancy isolation
                    customerId,
                    userId: req.userId!,
                    subtotal,
                    discount: finalDiscount,
                    tax: tax || 0,
                    total: total, // Updated total
                    paymentMethod: paymentMethod || 'cash',
                    amountPaid,
                    change: change || 0,
                    notes: notes ? `${notes} ${pointsToRedeem > 0 ? `(Pontos redimidos: ${pointsToRedeem})` : ''}` : undefined,
                    series,
                    fiscalNumber,
                    hashCode,
                    items: {
                        create: items.map((item: any) => ({
                            productId: item.productId,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            discount: item.discount || 0,
                            total: item.total
                        }))
                    }
                },
                include: {
                    customer: true,
                    items: { include: { product: true } }
                }
            });

            // Step 6: Update Stock & Log Movements
            for (const item of items) {
                const product = productMap.get(item.productId);
                const balanceBefore = product?.currentStock || 0;
                const balanceAfter = balanceBefore - item.quantity;

                // Update Quantities
                await tx.product.update({
                    where: { id: item.productId },
                    data: { currentStock: { decrement: item.quantity } }
                });

                // Log Movement (Audit)
                await tx.stockMovement.create({
                    data: {
                        productId: item.productId,
                        movementType: 'sale',
                        quantity: -item.quantity,
                        balanceBefore,
                        balanceAfter,
                        reference: receiptNumber,
                        referenceType: 'sale',
                        reason: `Venda ${receiptNumber}`,
                        performedBy: req.userName || 'PDV', // Potentially user ID or Name
                        companyId: req.companyId,
                        originModule: 'pos'
                    }
                });
            }

            // Step 7: Update Product Status & Alerts (Logic unchanged, summarized for brevity)
            const updatedProducts = await tx.product.findMany({
                where: { id: { in: productIds } },
                select: { id: true, name: true, code: true, currentStock: true, minStock: true, status: true }
            });

            const statusUpdates: Array<{ id: string; status: 'in_stock' | 'low_stock' | 'out_of_stock' }> = [];
            const alertsToCreate: Array<any> = [];

            for (const product of updatedProducts) {
                let newStatus: 'in_stock' | 'low_stock' | 'out_of_stock' = 'in_stock';
                if (product.currentStock === 0) newStatus = 'out_of_stock';
                else if (product.currentStock <= product.minStock) newStatus = 'low_stock';

                if (newStatus !== product.status) {
                    statusUpdates.push({ id: product.id, status: newStatus });
                    if (newStatus !== 'in_stock') {
                        const existingAlert = await tx.alert.findFirst({
                            where: {
                                type: 'low_stock',
                                relatedId: product.id,
                                isResolved: false,
                                companyId: req.companyId // Multi-tenancy isolation
                            }
                        });
                        if (!existingAlert) {
                            alertsToCreate.push({
                                type: 'low_stock',
                                priority: newStatus === 'out_of_stock' ? 'critical' : 'high',
                                title: newStatus === 'out_of_stock' ? `Stock esgotado: ${product.name}` : `Stock baixo: ${product.name}`,
                                message: `${product.name} (${product.code}) tem apenas ${product.currentStock} unidades.`,
                                relatedId: product.id,
                                relatedType: 'product',
                                companyId: req.companyId // Multi-tenancy isolation
                            });
                        }
                    }
                }
            }

            await Promise.all(statusUpdates.map(u => tx.product.update({ where: { id: u.id }, data: { status: u.status } })));
            if (alertsToCreate.length > 0) await tx.alert.createMany({ data: alertsToCreate });


            // Step 8: Update Customer Totals & Loyalty
            if (customerId && customerData) {
                const pointsEarned = Math.floor(Number(total) / POINTS_EARN_RATE);

                await tx.customer.update({
                    where: { id: customerId },
                    data: {
                        totalPurchases: { increment: total },
                        // If you see an error here, it means the Prisma Client is not up to date.
                        // Please stop the server and run: npx prisma generate
                        loyaltyPoints: {
                            increment: pointsEarned - pointsToRedeem
                        }
                    }
                });

                // Record transactions
                if (pointsToRedeem > 0) {
                    await tx.loyaltyTransaction.create({
                        data: {
                            customerId,
                            points: -pointsToRedeem,
                            type: 'redeem',
                            description: `Redenção na venda ${receiptNumber}`,
                            referenceId: createdSale.id
                        }
                    });
                }

                if (pointsEarned > 0) {
                    await tx.loyaltyTransaction.create({
                        data: {
                            customerId,
                            points: pointsEarned,
                            type: 'earn',
                            description: `Ganho na venda ${receiptNumber}`,
                            referenceId: createdSale.id
                        }
                    });
                }
            }

            // Step 9: Register IVA Retention in Fiscal Module
            if (tax && tax > 0) {
                try {
                    const ivaConfig = await tx.taxConfig.findFirst({
                        where: {
                            type: 'iva',
                            isActive: true,
                            companyId: req.companyId // Multi-tenancy isolation
                        }
                    });

                    await tx.taxRetention.create({
                        data: {
                            type: 'iva',
                            entityType: 'sale',
                            entityId: createdSale.id,
                            period: today.toISOString().slice(0, 7), // YYYY-MM
                            baseAmount: subtotal,
                            retainedAmount: tax,
                            rate: ivaConfig?.rate || 16,
                            description: `IVA da Venda ${receiptNumber}`
                        }
                    });
                } catch (fiscalError) {
                    console.error('Failed to register fiscal retention for sale:', fiscalError);
                    // Don't fail the entire transaction for fiscal registration errors
                    // Just log it for manual review
                }
            }

            return createdSale;
        }, {
            isolationLevel: 'Serializable',
            timeout: 10000
        });

        res.status(201).json(sale);
    } catch (error: any) {
        logger.error('Create sale error:', {
            message: error.message,
            stack: error.stack,
            userId: req.userId,
            timestamp: new Date().toISOString()
        });

        // Return specific error messages
        if (error.message?.includes('Stock insuficiente')) {
            return res.status(400).json({ error: error.message });
        }
        if (error.message?.includes('não encontrado')) {
            return res.status(404).json({ error: error.message });
        }
        if (error.message?.includes('timeout')) {
            return res.status(408).json({ error: 'Operação demorou muito tempo. Tente novamente.' });
        }

        res.status(500).json({
            error: 'Erro ao registrar venda',
            code: 'SALE_CREATE_ERROR'
        });
    }
});

// Get sales statistics
router.get('/stats/summary', authenticate, async (req: AuthRequest, res) => {
    try {
        const { startDate, endDate } = req.query;

        const where: any = {
            companyId: req.companyId // Multi-tenancy isolation
        };
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(String(startDate));
            if (endDate) where.createdAt.lte = new Date(String(endDate));
        }

        const [totalSales, salesCount, avgSale] = await Promise.all([
            prisma.sale.aggregate({
                where,
                _sum: { total: true }
            }),
            prisma.sale.count({ where }),
            prisma.sale.aggregate({
                where,
                _avg: { total: true }
            })
        ]);

        // Sales by payment method
        const byPaymentMethod = await prisma.sale.groupBy({
            by: ['paymentMethod'],
            where,
            _sum: { total: true },
            _count: true
        });

        // Top products
        const topProducts = await prisma.saleItem.groupBy({
            by: ['productId'],
            where: {
                sale: { companyId: req.companyId }
            },
            _sum: { quantity: true, total: true },
            orderBy: { _sum: { total: 'desc' } },
            take: 10
        });

        const topProductsWithDetails = await Promise.all(
            topProducts.map(async (item) => {
                const product = await prisma.product.findFirst({
                    where: {
                        id: item.productId,
                        companyId: req.companyId // Multi-tenancy isolation
                    },
                    select: { id: true, name: true, code: true }
                });
                return {
                    product,
                    totalQuantity: item._sum?.quantity,
                    totalRevenue: item._sum?.total
                };
            })
        );

        res.json({
            totalRevenue: totalSales._sum?.total || 0,
            salesCount,
            avgSale: avgSale._avg?.total || 0,
            byPaymentMethod,
            topProducts: topProductsWithDetails
        });
    } catch (error: any) {
        logger.error('Get sales stats error:', {
            message: error.message,
            stack: error.stack,
            userId: req.userId,
            timestamp: new Date().toISOString()
        });
        res.status(500).json({
            error: 'Erro ao buscar estatísticas',
            code: 'STATS_FETCH_ERROR'
        });
    }
});

// Cancel/Void sale (POS)
router.post('/:id/cancel', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const result = await prisma.$transaction(async (tx) => {
            // 1. Get sale with items and verify ownership
            const sale = await tx.sale.findFirst({
                where: {
                    id,
                    companyId: req.companyId // Multi-tenancy isolation
                },
                include: { items: true }
            });

            if (!sale) {
                throw new Error('Venda não encontrada');
            }

            // 2. Restore stock and log movements
            const productIds = sale.items.map(i => i.productId);
            const products = await tx.product.findMany({
                where: { id: { in: productIds } }
            });
            const productMap = new Map(products.map(p => [p.id, p]));

            for (const item of sale.items) {
                const product = productMap.get(item.productId);
                const balanceBefore = product?.currentStock || 0;
                const balanceAfter = balanceBefore + item.quantity;

                await tx.product.update({
                    where: { id: item.productId },
                    data: { currentStock: { increment: item.quantity } }
                });

                // Log Movement (Audit)
                await tx.stockMovement.create({
                    data: {
                        productId: item.productId,
                        movementType: 'return_in',
                        quantity: item.quantity,
                        balanceBefore,
                        balanceAfter,
                        reason: `Anulação de Venda ${sale.receiptNumber}`,
                        performedBy: req.userName || 'Admin',
                        companyId: req.companyId,
                        originModule: 'pos',
                        reference: sale.receiptNumber,
                        referenceType: 'sale'
                    }
                });
            }

            // 3. Create Audit Log (since we are deleting the sale, we must record this action)
            await tx.auditLog.create({
                data: {
                    userId: req.userId,
                    action: 'VOID_SALE',
                    entity: 'Sales',
                    entityId: id,
                    oldData: sale as any,
                    newData: { reason },
                    ipAddress: req.ip
                }
            });

            // 4. Update customer stats if applicable
            if (sale.customerId) {
                await tx.customer.update({
                    where: { id: sale.customerId },
                    data: { totalPurchases: { decrement: sale.total } }
                });
            }

            // 5. Delete the sale (Since we don't have a status field yet)
            await tx.sale.delete({
                where: { id }
            });

            return { message: 'Venda anulada com sucesso', restoredItems: sale.items.length };
        });

        res.json(result);
    } catch (error: any) {
        logger.error('Cancel sale error:', error);
        res.status(500).json({
            error: error.message || 'Erro ao anular venda',
            code: 'SALE_CANCEL_ERROR'
        });
    }
});

// Get today's sales
router.get('/today/summary', authenticate, async (req: AuthRequest, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);

        const [sales, totals] = await Promise.all([
            prisma.sale.findMany({
                where: {
                    companyId: req.companyId, // Multi-tenancy isolation
                    createdAt: {
                        gte: today,
                        lte: endOfDay
                    }
                },
                include: {
                    customer: { select: { name: true } },
                    items: { select: { quantity: true } }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.sale.aggregate({
                where: {
                    companyId: req.companyId, // Multi-tenancy isolation
                    createdAt: {
                        gte: today,
                        lte: endOfDay
                    }
                },
                _sum: { total: true, discount: true, tax: true },
                _count: true
            })
        ]);

        res.json({
            sales,
            totals: {
                count: totals._count,
                total: totals._sum?.total || 0,
                discount: totals._sum?.discount || 0,
                tax: totals._sum?.tax || 0
            }
        });
    } catch (error: any) {
        logger.error('Get today sales error:', {
            message: error.message,
            stack: error.stack,
            userId: req.userId,
            timestamp: new Date().toISOString()
        });
        res.status(500).json({
            error: 'Erro ao buscar vendas de hoje',
            code: 'TODAY_SALES_FETCH_ERROR'
        });
    }
});

export default router;
