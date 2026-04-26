import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { CreateSaleInput } from '../utils/validation';
import { ApiError } from '../middleware/error.middleware';
import { getPaginationParams, createPaginatedResponse } from '../utils/pagination';
import { stockService } from './stockService';
import { ResultHandler } from '../utils/result';

export class SalesService {
    /**
     * List sales with pagination and filters
     */
    async list(params: any, companyId: string) {
        const { page, limit, skip } = getPaginationParams(params);
        const {
            startDate,
            endDate,
            customerId,
            paymentMethod,
            warehouseId,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = params;

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
        if (warehouseId) where.warehouseId = warehouseId;

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
                take: limit
            })
        ]);

        return ResultHandler.success(createPaginatedResponse(sales, page, limit, total));
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

        if (!sale) throw ApiError.notFound('Venda não encontrada');
        return ResultHandler.success(sale);
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
            discount: inputDiscount,
            paymentMethod,
            amountPaid,
            paymentRef,
            notes,
            redeemPoints,
            sessionId,
            originModule,
            tableId,
            warehouseId
        } = data;

        const POINTS_EARN_RATE = 100;
        const POINT_VALUE = 1;

        return await prisma.$transaction(async (tx: any) => {
            // 0. Validate Session (Mandatory for POS modules)
            if (['commercial', 'bottlestore', 'restaurant'].includes(originModule || '')) {
                if (!sessionId) {
                    throw ApiError.badRequest(`Uma sessão de caixa aberta é obrigatória para o módulo ${originModule}.`);
                }
                const session = await tx.cashSession.findFirst({
                    where: { id: sessionId, companyId, status: 'open' }
                });
                if (!session) {
                    throw ApiError.badRequest('Sessão de caixa não encontrada ou já encerrada.');
                }
            }

            // 0.1 Validate Customer & Loyalty
            let loyaltyDiscount = 0;
            let pointsToRedeem = 0;
            let customerData = null;

            if (customerId) {
                customerData = await tx.customer.findFirst({
                    where: { id: customerId, companyId }
                });
                if (!customerData) throw ApiError.notFound('Cliente não encontrado ou acesso negado');

                if (redeemPoints && redeemPoints > 0) {
                    const customerPoints = (customerData as any).loyaltyPoints || 0;
                    if (customerPoints < redeemPoints) {
                        throw ApiError.badRequest(`Pontos insuficientes. Disponível: ${customerPoints}`);
                    }
                    pointsToRedeem = redeemPoints;
                    loyaltyDiscount = pointsToRedeem * POINT_VALUE;
                }
            }

            // ====================================================================
            // SERVER-SIDE AUTHORITATIVE CALCULATION
            // Fetch real prices from DB and recalculate all totals.
            // Never trust frontend-provided subtotal/tax/total.
            // ====================================================================
            const productIds = items.map(i => i.productId);
            const products = await tx.product.findMany({
                where: { id: { in: productIds }, companyId },
                select: { id: true, name: true, price: true, currentStock: true }
            });
            const productMap = new Map<string, { id: string; name: string; price: any; currentStock: number }>(products.map((p: any) => [p.id, p]));

            // Fetch company IVA rate for server-side tax calculation
            const companySettings = await tx.companySettings.findFirst({
                where: { companyId },
                select: { ivaRate: true }
            });
            const ivaRate = Number(companySettings?.ivaRate ?? 16) / 100;

            // Recalculate each item total using DB prices
            const verifiedItems = items.map(item => {
                const product = productMap.get(item.productId);
                if (!product) {
                    throw ApiError.notFound(`Produto não encontrado: ${item.productId}`);
                }

                // Verify unit price matches DB (allow 0.01 tolerance for rounding)
                const dbPrice = Number(product.price);
                if (dbPrice > 0 && Math.abs(dbPrice - item.unitPrice) > 0.01) {
                    logger.warn('Price mismatch detected', {
                        productId: item.productId,
                        productName: product.name,
                        frontendPrice: item.unitPrice,
                        dbPrice,
                        userId, companyId
                    });
                    // Use DB price as authoritative source
                    item.unitPrice = dbPrice;
                }

                const computedItemTotal = (item.unitPrice * item.quantity) - (item.discount || 0);
                return { ...item, total: Math.round(computedItemTotal * 100) / 100 };
            });

            const computedSubtotal = verifiedItems.reduce((sum, item) => sum + item.total, 0);
            const computedTax = Math.round(computedSubtotal * ivaRate * 100) / 100;
            const finalDiscount = (inputDiscount || 0) + loyaltyDiscount;
            const computedTotal = Math.round((computedSubtotal - finalDiscount + computedTax) * 100) / 100;

            // Use server-computed values as authoritative
            const subtotal = computedSubtotal;
            const tax = computedTax;
            const total = computedTotal;

            // 1. Document Series -- use FOR UPDATE to prevent duplicate receipt numbers under concurrency.
            // Prisma.sql uses parameterized queries (safe against SQL injection).
            const docSeriesResult = (await tx.$queryRaw(Prisma.sql`
                SELECT id, series, "lastNumber" FROM document_series
                WHERE prefix = 'FR' AND "isActive" = true AND "companyId" = ${companyId}
                ORDER BY "createdAt" DESC
                LIMIT 1
                FOR UPDATE
            `)) as Array<{ id: string; series: string; lastNumber: number }>;

            let docSeries = docSeriesResult[0];
            if (!docSeries) {
                const yearCode = `FR-${new Date().getFullYear()}`;
                docSeries = await tx.documentSeries.upsert({
                    where: { companyId_code: { companyId, code: yearCode } },
                    update: { isActive: true, prefix: 'FR' },
                    create: {
                        code: yearCode,
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
            // $queryRaw returns PostgreSQL INT as BigInt — coerce to JS number
            const fiscalNumber = Number(docSeries.lastNumber) + 1;
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
            for (const item of verifiedItems) {
                await stockService.validateAvailability(item.productId, item.quantity, companyId, tx, warehouseId);
            }

            // 5. Create Sale
            const isCreditSale = paymentMethod === 'credit';
            // Compute precise change (server-side authoritative calculation)
            const computedChange = isCreditSale ? 0 : Math.max(0, (amountPaid || 0) - total);

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
                    amountPaid: isCreditSale ? 0 : (amountPaid || 0),
                    change: computedChange,
                    isCredit: isCreditSale,
                    paymentRef: paymentRef || undefined,
                    sessionId: sessionId || undefined,
                    originModule: originModule || 'commercial',
                    tableId: tableId || undefined,
                    warehouseId: warehouseId || undefined,
                    notes: notes ? `${notes}${pointsToRedeem > 0 ? ` (Pontos redimidos: ${pointsToRedeem})` : ''}` : undefined,
                    series,
                    fiscalNumber,
                    hashCode,
                    items: {
                        create: verifiedItems.map((item) => ({
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

            // 6. Atomically close restaurant kitchen orders when a restaurant sale is paid
            if (originModule === 'restaurant' && tableId) {
                await tx.restaurantOrder.updateMany({
                    where: {
                        tableId,
                        companyId,
                        status: { in: ['pending', 'preparing', 'ready'] }
                    },
                    data: { status: 'served', servedAt: new Date() }
                });
                await tx.restaurantTable.updateMany({
                    where: { id: tableId, companyId },
                    data: { status: 'available' }
                });
            }

            // 7. Update Stock & Log Movements (Alerts handled internally by StockService)
            for (const item of verifiedItems) {
                await stockService.recordMovement({
                    productId: item.productId,
                    quantity: -item.quantity,
                    movementType: 'sale',
                    originModule: 'COMMERCIAL',
                    referenceType: 'SALE',
                    referenceContent: receiptNumber,
                    reason: `Venda ${receiptNumber}`,
                    performedBy: userName,
                    companyId,
                    warehouseId
                }, tx);
            }

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

            return ResultHandler.success(createdSale);
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

            if (!sale) throw ApiError.notFound('Venda não encontrada');

            // Restore Stock
            for (const item of sale.items) {
                await stockService.recordMovement({
                    productId: item.productId,
                    quantity: item.quantity,
                    movementType: 'return_in',
                    originModule: 'COMMERCIAL',
                    referenceType: 'SALE',
                    referenceContent: sale.receiptNumber,
                    reason: `Anulação de Venda ${sale.receiptNumber}`,
                    performedBy: userName,
                    companyId
                }, tx);
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

            // Restore Customer Stats and reverse loyalty points
            if (sale.customerId) {
                await tx.customer.update({
                    where: { id: sale.customerId },
                    data: { totalPurchases: { decrement: sale.total } }
                });

                // Reverse all loyalty transactions tied to this sale
                const loyaltyTxs = await tx.loyaltyTransaction.findMany({
                    where: { referenceId: id },
                    select: { id: true, points: true, type: true }
                });
                for (const lt of loyaltyTxs) {
                    await tx.customer.update({
                        where: { id: sale.customerId },
                        data: { loyaltyPoints: { decrement: lt.points } }
                    });
                    await tx.loyaltyTransaction.delete({ where: { id: lt.id } });
                }
            }

            await tx.sale.delete({ where: { id } });

            return ResultHandler.success({ message: 'Venda anulada com sucesso', restoredItems: sale.items.length });
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

        const productIds = topProducts.map(i => i.productId).filter(Boolean) as string[];
        const productDetails = await prisma.product.findMany({
            where: { id: { in: productIds }, companyId },
            select: { id: true, name: true, code: true }
        });
        const productMap = Object.fromEntries(productDetails.map(p => [p.id, p]));

        const topProductsWithDetails = topProducts.map(item => ({
            product: item.productId ? (productMap[item.productId] ?? null) : null,
            totalQuantity: item._sum?.quantity,
            totalRevenue: item._sum?.total
        }));

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
