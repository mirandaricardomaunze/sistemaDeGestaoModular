import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { CreateSaleInput } from '../utils/validation';

export class SalesService {
    /**
     * List sales with pagination and filters
     */
    async list(params: any, companyId: string) {
        const {
            startDate,
            endDate,
            customerId,
            paymentMethod,
            page = '1',
            limit = '20',
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = params;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where: any = {
            companyId
        };

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate as string);
            if (endDate) where.createdAt.lte = new Date(endDate as string);
        }

        if (customerId) where.customerId = customerId;
        if (paymentMethod) where.paymentMethod = paymentMethod;

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
                orderBy: { [sortBy as string]: sortOrder },
                skip,
                take: limitNum
            })
        ]);

        return {
            data: sales,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                hasMore: skip + sales.length < total
            }
        };
    }

    /**
     * Get Sale by ID
     */
    async getById(id: string, companyId: string) {
        const sale = await prisma.sale.findFirst({
            where: {
                id,
                companyId
            },
            include: {
                customer: true,
                user: { select: { id: true, name: true } },
                items: {
                    include: { product: true }
                }
            }
        });

        if (!sale) throw new Error('Venda não encontrada');
        return sale;
    }

    /**
     * Create Sale (Transactional)
     */
    async create(
        data: CreateSaleInput,
        companyId: string,
        userId: string,
        userName: string,
        userIp: string
    ) {
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
            redeemPoints
        } = data;

        const POINTS_EARN_RATE = 100;
        const POINT_VALUE = 1;

        return await prisma.$transaction(async (tx: any) => {
            // 0. Validate Customer & Loyalty
            let loyaltyDiscount = 0;
            let pointsToRedeem = 0;
            let customerData = null;

            if (customerId) {
                customerData = await tx.customer.findFirst({
                    where: { id: customerId, companyId }
                });
                if (!customerData) throw new Error('Cliente não encontrado ou acesso negado');

                if (redeemPoints && redeemPoints > 0) {
                    const customerPoints = (customerData as any).loyaltyPoints || 0;
                    if (customerPoints < redeemPoints) {
                        throw new Error(`Pontos insuficientes. Disponível: ${customerPoints}`);
                    }
                    pointsToRedeem = redeemPoints;
                    loyaltyDiscount = pointsToRedeem * POINT_VALUE;
                }
            }

            const finalDiscount = (inputDiscount || 0) + loyaltyDiscount;
            const total = inputTotal - loyaltyDiscount;

            // 1. Document Series
            const docSeriesResult = await tx.$queryRaw<Array<{
                id: string;
                series: string;
                lastNumber: number;
            }>>`
                SELECT * FROM document_series 
                WHERE prefix = 'FR' AND "isActive" = true AND "companyId" = ${companyId}
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
                        companyId
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

            // 3. Hash Code
            const today = new Date();
            const hashData = `${receiptNumber}|${today.toISOString()}|${total}|${docSeries.lastNumber}`;
            const hashCode = crypto.createHash('sha256').update(hashData).digest('hex').substring(0, 4).toUpperCase();

            // 4. Validate Products & Stock
            const productIds = items.map((item) => item.productId);
            const products = await tx.product.findMany({
                where: { id: { in: productIds }, companyId },
                select: { id: true, name: true, code: true, currentStock: true, minStock: true }
            });

            const productMap = new Map<string, { id: string; name: string; code: string; currentStock: number; minStock: number }>(products.map((p: any) => [p.id, p]));

            for (const item of items) {
                const product = productMap.get(item.productId);
                if (!product) throw new Error(`Produto ${item.productId} não encontrado`);
                if (product.currentStock < item.quantity) {
                    throw new Error(`Stock insuficiente para ${product.name}. Disponível: ${product.currentStock}`);
                }
            }

            // 5. Create Sale
            const createdSale = await tx.sale.create({
                data: {
                    receiptNumber,
                    companyId,
                    customerId,
                    userId,
                    subtotal,
                    discount: finalDiscount,
                    tax: tax || 0,
                    total,
                    paymentMethod: paymentMethod || 'cash',
                    amountPaid,
                    change: change || 0,
                    notes: notes ? `${notes} ${pointsToRedeem > 0 ? `(Pontos redimidos: ${pointsToRedeem})` : ''}` : undefined,
                    series,
                    fiscalNumber,
                    hashCode,
                    items: {
                        create: items.map((item) => ({
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

            // 6. Update Stock & Log Movements
            for (const item of items) {
                const product = productMap.get(item.productId);
                const balanceBefore = product?.currentStock || 0;
                const balanceAfter = balanceBefore - item.quantity;

                await tx.product.update({
                    where: { id: item.productId },
                    data: { currentStock: { decrement: item.quantity } }
                });

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
                        performedBy: userName,
                        companyId,
                        originModule: 'pos'
                    }
                });
            }

            // 7. Update Alerts (Optimized)
            const updatedProducts = await tx.product.findMany({
                where: { id: { in: productIds } },
                select: { id: true, name: true, code: true, currentStock: true, minStock: true, status: true }
            });

            const alertsToCreate: any[] = [];

            for (const product of updatedProducts) {
                let newStatus: 'in_stock' | 'low_stock' | 'out_of_stock' = 'in_stock';
                if (product.currentStock === 0) newStatus = 'out_of_stock';
                else if (product.currentStock <= product.minStock) newStatus = 'low_stock';

                if (newStatus !== product.status) {
                    await tx.product.update({ where: { id: product.id }, data: { status: newStatus } });

                    if (newStatus !== 'in_stock') {
                        const existingAlert = await tx.alert.findFirst({
                            where: { type: 'low_stock', relatedId: product.id, isResolved: false, companyId }
                        });
                        if (!existingAlert) {
                            alertsToCreate.push({
                                type: 'low_stock',
                                priority: newStatus === 'out_of_stock' ? 'critical' : 'high',
                                title: newStatus === 'out_of_stock' ? `Stock esgotado: ${product.name}` : `Stock baixo: ${product.name}`,
                                message: `${product.name} (${product.code}) tem apenas ${product.currentStock} unidades.`,
                                relatedId: product.id,
                                relatedType: 'product',
                                companyId
                            });
                        }
                    }
                }
            }
            if (alertsToCreate.length > 0) await tx.alert.createMany({ data: alertsToCreate });

            // 8. Update Customer
            if (customerId && customerData) {
                const pointsEarned = Math.floor(Number(total) / POINTS_EARN_RATE);
                await tx.customer.update({
                    where: { id: customerId },
                    data: {
                        totalPurchases: { increment: total },
                        loyaltyPoints: { increment: pointsEarned - pointsToRedeem }
                    }
                });

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

            // 9. Fiscal Retention
            if (tax && tax > 0) {
                try {
                    const ivaConfig = await tx.taxConfig.findFirst({
                        where: { type: 'iva', isActive: true, companyId }
                    });
                    await tx.taxRetention.create({
                        data: {
                            type: 'iva',
                            entityType: 'sale',
                            entityId: createdSale.id,
                            period: today.toISOString().slice(0, 7),
                            baseAmount: subtotal,
                            retainedAmount: tax,
                            rate: ivaConfig?.rate || 16,
                            description: `IVA da Venda ${receiptNumber}`
                        }
                    });
                } catch (e) {
                    logger.error('Failed to register fiscal retention', e);
                }
            }

            // 10. Transaction Record
            await tx.transaction.create({
                data: {
                    type: 'income',
                    category: 'Sales',
                    description: `Venda Retalho: ${receiptNumber}`,
                    amount: total,
                    date: today,
                    status: 'completed',
                    paymentMethod: paymentMethod || 'cash',
                    reference: receiptNumber,
                    module: 'retail',
                    companyId
                }
            });

            return createdSale;
        }, {
            isolationLevel: 'Serializable',
            timeout: 10000
        });
    }

    /**
     * Cancel/Void Sale
     */
    async cancel(id: string, reason: string, companyId: string, userId: string, userName: string, userIp: string) {
        return await prisma.$transaction(async (tx: any) => {
            const sale = await tx.sale.findFirst({
                where: { id, companyId },
                include: { items: true }
            });

            if (!sale) throw new Error('Venda não encontrada');

            // Restore Stock
            const productIds = sale.items.map((i: any) => i.productId);
            const products = await tx.product.findMany({ where: { id: { in: productIds } } });

            const productMap = new Map<string, any>(products.map((p: any) => [p.id, p]));

            for (const item of sale.items) {
                const product = productMap.get(item.productId);
                const balanceBefore = product?.currentStock || 0;

                await tx.product.update({
                    where: { id: item.productId },
                    data: { currentStock: { increment: item.quantity } }
                });

                await tx.stockMovement.create({
                    data: {
                        productId: item.productId,
                        movementType: 'return_in',
                        quantity: item.quantity,
                        balanceBefore,
                        balanceAfter: balanceBefore + item.quantity,
                        reason: `Anulação de Venda ${sale.receiptNumber}`,
                        performedBy: userName,
                        companyId,
                        originModule: 'pos',
                        reference: sale.receiptNumber,
                        referenceType: 'sale'
                    }
                });
            }

            // Audit
            await tx.auditLog.create({
                data: {
                    userId,
                    action: 'VOID_SALE',
                    entity: 'Sales',
                    entityId: id,
                    oldData: sale as any,
                    newData: { reason },
                    ipAddress: userIp
                }
            });

            // Restore Customer Stats
            if (sale.customerId) {
                await tx.customer.update({
                    where: { id: sale.customerId },
                    data: { totalPurchases: { decrement: sale.total } }
                });
            }

            await tx.sale.delete({ where: { id } });

            return { message: 'Venda anulada com sucesso', restoredItems: sale.items.length };
        });
    }

    /**
     * Get Sales Statistics
     */
    async getStats(params: any, companyId: string) {
        const { startDate, endDate } = params;
        const where: any = { companyId };

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(String(startDate));
            if (endDate) where.createdAt.lte = new Date(String(endDate));
        }

        const [totalSales, salesCount, avgSale, byPaymentMethod, topProducts] = await Promise.all([
            prisma.sale.aggregate({ where, _sum: { total: true } }),
            prisma.sale.count({ where }),
            prisma.sale.aggregate({ where, _avg: { total: true } }),
            prisma.sale.groupBy({
                by: ['paymentMethod'],
                where,
                _sum: { total: true },
                _count: true
            }),
            prisma.saleItem.groupBy({
                by: ['productId'],
                where: { sale: { companyId } },
                _sum: { quantity: true, total: true },
                orderBy: { _sum: { total: 'desc' } },
                take: 10
            })
        ]);

        const topProductsWithDetails = await Promise.all(
            topProducts.map(async (item) => {
                const product = await prisma.product.findFirst({
                    where: { id: item.productId, companyId },
                    select: { id: true, name: true, code: true }
                });
                return {
                    product,
                    totalQuantity: item._sum?.quantity,
                    totalRevenue: item._sum?.total
                };
            })
        );

        return {
            totalRevenue: totalSales._sum?.total || 0,
            salesCount,
            avgSale: avgSale._avg?.total || 0,
            byPaymentMethod,
            topProducts: topProductsWithDetails
        };
    }

    /**
     * Get Today's Sales Summary
     */
    async getTodaySummary(companyId: string) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);

        const [sales, totals] = await Promise.all([
            prisma.sale.findMany({
                where: { companyId, createdAt: { gte: today, lte: endOfDay } },
                include: {
                    customer: { select: { name: true } },
                    items: { select: { quantity: true } }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.sale.aggregate({
                where: { companyId, createdAt: { gte: today, lte: endOfDay } },
                _sum: { total: true, discount: true, tax: true },
                _count: true
            })
        ]);

        return {
            sales,
            totals: {
                count: totals._count,
                total: totals._sum?.total || 0,
                discount: totals._sum?.discount || 0,
                tax: totals._sum?.tax || 0
            }
        };
    }
}

export const salesService = new SalesService();
