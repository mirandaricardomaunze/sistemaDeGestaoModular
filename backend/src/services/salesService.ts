import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { CreateSaleInput } from '../utils/validation';
import { ApiError } from '../middleware/error.middleware';
import { getPaginationParams, createPaginatedResponse, parseFields } from '../utils/pagination';

const SALE_FIELD_ALLOWLIST = [
    'id', 'receiptNumber', 'subtotal', 'discount', 'taxAmount',
    'total', 'paymentMethod', 'amountPaid', 'change', 'status',
    'customerId', 'userId', 'createdAt', 'originModule',
    'customer.id', 'customer.name', 'customer.code',
    'user.id', 'user.name'
] as const;
import { stockService } from './stockService';
import { ResultHandler } from '../utils/result';
import { invalidateDashboardCache } from './dashboardService';
import { invalidateCommercialCache } from './commercial/shared';
import { approvalsService } from './approvalsService';
import { getThresholds } from './approvals/thresholds';

type SaleListParams = {
    page?: string | number;
    limit?: string | number;
    fields?: string;
    startDate?: string;
    endDate?: string;
    customerId?: string;
    paymentMethod?: string;
    warehouseId?: string;
    search?: string;
    originModule?: string;
    voidStatus?: string;
    includeVoided?: boolean | string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
};

type SaleStatsParams = {
    startDate?: string;
    endDate?: string;
};

function invalidateSaleDependentCaches(companyId: string, originModule?: string | null): void {
    invalidateDashboardCache(companyId);

    if ((originModule || '').toLowerCase() === 'commercial') {
        invalidateCommercialCache(companyId);
    }
}

export class SalesService {
    /**
     * List sales with pagination and filters
     */
    async list(params: SaleListParams, companyId: string) {
        const { page, limit, skip } = getPaginationParams(params);
        const {
            startDate,
            endDate,
            customerId,
            paymentMethod,
            warehouseId,
            search,
            originModule,
            voidStatus,
            includeVoided,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = params;

        const where: Prisma.SaleWhereInput = { companyId };

        // Hide voided sales by default; callers can opt in.
        if (voidStatus) {
            where.voidStatus = voidStatus;
        } else if (!includeVoided) {
            where.voidStatus = { not: 'voided' };
        }

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(String(startDate));
            if (endDate) where.createdAt.lte = new Date(String(endDate));
        }

        if (customerId) where.customerId = customerId;
        if (paymentMethod) where.paymentMethod = paymentMethod as Prisma.SaleWhereInput['paymentMethod'];
        if (warehouseId) where.warehouseId = warehouseId;
        if (originModule) where.originModule = originModule;

        if (search && typeof search === 'string') {
            const term = search.trim();
            if (term) {
                where.OR = [
                    { receiptNumber: { contains: term, mode: 'insensitive' } },
                    { customer: { name: { contains: term, mode: 'insensitive' } } }
                ];
            }
        }

        const projection = parseFields(params.fields, SALE_FIELD_ALLOWLIST);
        const baseArgs = {
            where,
            orderBy: { [sortBy]: sortOrder } as Prisma.SaleOrderByWithRelationInput,
            skip,
            take: limit
        };
        const findArgs: Prisma.SaleFindManyArgs = projection
            // Field-select mode skips items[] by default — callers that need them
            // either request the full row, or fetch the sale by id.
            ? { ...baseArgs, select: projection as Prisma.SaleSelect }
            : {
                ...baseArgs,
                include: {
                    customer: { select: { id: true, name: true, code: true } },
                    user: { select: { id: true, name: true } },
                    items: {
                        include: {
                            product: { select: { id: true, name: true, code: true } }
                        }
                    }
                }
            };

        const [total, sales] = await Promise.all([
            prisma.sale.count({ where }),
            prisma.sale.findMany(findArgs)
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
        userIp: string,
        userRole?: string
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
            warehouseId,
            discountReason,
            discountKind,
            discountAudit
        } = data;

        // ── Discount authorization (role-based ceiling + optional approval) ──
        // Operators/cashiers can apply small discounts; managers and above unlimited.
        // For amounts above the role ceiling, an approved ApprovalRequest of type
        // 'discount_override' linked to this sale (resourceType='draft_sale',
        // resourceId=data.draftId) lets the cashier proceed.
        const DISCOUNT_LIMIT_PCT: Record<string, number> = {
            super_admin: 100,
            admin: 100,
            manager: 100,
            operator: 10,
            cashier: 10,
            stock_keeper: 5,
        };
        const role = (userRole || 'operator').toLowerCase();
        const roleMaxPct = DISCOUNT_LIMIT_PCT[role] ?? 10;
        const thresholds = await getThresholds(companyId);
        // Settings threshold is stored as a fraction (0.15 = 15%); convert to percent.
        const configuredMaxPct = thresholds.discount !== undefined
            ? Number(thresholds.discount) * 100
            : roleMaxPct;
        const maxPct = Math.min(roleMaxPct, configuredMaxPct);
        const grossSubtotal = items.reduce((s, i) => s + (Number(i.unitPrice) * Number(i.quantity)), 0);
        const totalDiscount = (Number(inputDiscount) || 0)
            + items.reduce((s, i) => s + (Number(i.discount) || 0), 0);
        const effectivePct = grossSubtotal > 0 ? (totalDiscount / grossSubtotal) * 100 : 0;

        const discountApprovalId = data.discountApprovalId;
        if (effectivePct > maxPct + 0.01) {
            const approval = discountApprovalId
                ? await approvalsService.findApprovedFor(companyId, 'discount_override', 'draft_sale', discountApprovalId)
                : null;
            // Approval must cover at least the requested discount amount.
            if (!approval || (approval.amount !== null && approval.amount + 0.01 < totalDiscount)) {
                logger.warn('Discount limit exceeded', { userId, role, effectivePct, maxPct, companyId });
                throw ApiError.forbidden(
                    `Desconto de ${effectivePct.toFixed(1)}% excede o limite (${maxPct.toFixed(1)}%). Solicite aprovação de um gestor.`
                );
            }
        }
        // Reason is mandatory whenever any discount is applied
        const lineHasReason = items.every(i => !i.discount || i.discount <= 0 || (i.discountReason && i.discountReason.trim().length > 0));
        const globalHasReason = !inputDiscount || (inputDiscount || 0) <= 0 || (discountReason && discountReason.trim().length > 0);
        if (!lineHasReason || !globalHasReason) {
            throw ApiError.badRequest('Todo o desconto deve ter um motivo.');
        }

        const POINTS_EARN_RATE = 100;
        const POINT_VALUE = 1;

        const result = await prisma.$transaction(async (tx) => {
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
                    const customerPoints = customerData.loyaltyPoints || 0;
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
                select: { id: true, name: true, price: true, costPrice: true, packSize: true, currentStock: true }
            });
            const productMap = new Map(products.map((p) => [p.id, p] as const));

            // Fetch company IVA rate for server-side tax calculation
            const companySettings = await tx.companySettings.findFirst({
                where: { companyId },
                select: { ivaRate: true }
            });
            const ivaRate = Number(companySettings?.ivaRate ?? 16) / 100;

            // Recalculate each item total using DB prices.
            // product.price = preço de venda DA CAIXA. Stock e SaleItem operam em UNIDADES,
            // por isso o preço unitário canónico é price / packSize. O frontend pode também
            // enviar item.unitPrice = price (caixa inteira) com quantity = packSize, ou um
            // preço escalonado/promocional — toleramos ambas as formas mas guardamos sempre
            // por unidade.
            const verifiedItems = items.map(item => {
                const product = productMap.get(item.productId);
                if (!product) {
                    throw ApiError.notFound(`Produto não encontrado: ${item.productId}`);
                }

                const packSize = Number(product.packSize) || 1;
                const dbBoxPrice = Number(product.price);
                const dbUnitPrice = dbBoxPrice / packSize;
                const sentPrice = Number(item.unitPrice) || 0;

                // Aceita: (a) preço por unidade ≈ dbUnitPrice; (b) preço por caixa ≈ dbBoxPrice
                // (cliente legado a vender em caixa); (c) qualquer preço inferior — assume-se
                // desconto/promo válido. Rejeita apenas preços ACIMA do oficial.
                const matchesUnit = Math.abs(dbUnitPrice - sentPrice) <= Math.max(0.01, dbUnitPrice * 0.001);
                const matchesBox = packSize > 1 && Math.abs(dbBoxPrice - sentPrice) <= 0.01;
                const isBelow = sentPrice <= dbUnitPrice + 0.01;

                let normalizedUnitPrice = sentPrice;
                if (matchesBox) {
                    // Cliente enviou preço por caixa — converte para por unidade.
                    normalizedUnitPrice = dbUnitPrice;
                } else if (!matchesUnit && !isBelow) {
                    logger.warn('Price mismatch detected', {
                        productId: item.productId,
                        productName: product.name,
                        frontendPrice: sentPrice,
                        dbUnitPrice,
                        dbBoxPrice,
                        packSize,
                        userId, companyId
                    });
                    normalizedUnitPrice = dbUnitPrice;
                }

                item.unitPrice = Math.round(normalizedUnitPrice * 10000) / 10000;
                const computedItemTotal = (item.unitPrice * item.quantity) - (item.discount || 0);
                return {
                    ...item,
                    total: Math.round(computedItemTotal * 100) / 100,
                    // Snapshot the cost at sale time so margin reports remain
                    // accurate even if the product is later renamed, reposted
                    // with a new costPrice, or soft-deleted.
                    costPriceSnapshot: Number(product.costPrice ?? 0),
                    productNameSnapshot: product.name,
                };
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
                    discountReason: discountReason || undefined,
                    discountKind: discountKind || undefined,
                    discountAudit: discountAudit ? (discountAudit as Prisma.InputJsonValue) : undefined,
                    items: {
                        create: verifiedItems.map((item) => ({
                            productId: item.productId,
                            productName: item.productNameSnapshot,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            costPrice: item.costPriceSnapshot,
                            discount: item.discount || 0,
                            total: item.total,
                            discountReason: item.discountReason || undefined,
                            discountKind: item.discountKind || undefined,
                            discountAppliedBy: item.discountAppliedBy || undefined
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

            const reservationIds = verifiedItems.flatMap((item) => item.reservationIds || []);
            if (reservationIds.length > 0) {
                const uniqueReservationIds = Array.from(new Set(reservationIds));
                const reservations = await tx.stockReservation.findMany({
                    where: { id: { in: uniqueReservationIds }, companyId }
                });
                const sessionIds = reservations.map((r) => r.sessionId).filter((id): id is string => !!id);
                const sessions = sessionIds.length > 0
                    ? await tx.cashSession.findMany({
                        where: { id: { in: sessionIds }, companyId },
                        select: { id: true, warehouseId: true }
                    })
                    : [];
                const warehouseBySession = new Map(sessions.map((s) => [s.id, s.warehouseId || undefined] as const));

                for (const reservation of reservations) {
                    await tx.product.update({
                        where: { id: reservation.productId },
                        data: { reservedStock: { decrement: reservation.quantity } }
                    });
                    const reservationWarehouseId = reservation.sessionId
                        ? warehouseBySession.get(reservation.sessionId)
                        : undefined;
                    if (reservationWarehouseId) {
                        await tx.warehouseStock.updateMany({
                            where: { productId: reservation.productId, companyId, warehouseId: reservationWarehouseId },
                            data: { reservedQuantity: { decrement: reservation.quantity } }
                        });
                    }
                }
                await tx.stockReservation.deleteMany({ where: { id: { in: reservations.map((r) => r.id) }, companyId } });
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
            const transactionModule = originModule || 'retail';
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
                    module: transactionModule,
                    companyId
                }
            });

            return ResultHandler.success(createdSale);
        }, {
            isolationLevel: 'Serializable',
            timeout: 30000,
            maxWait: 10000
        });

        invalidateSaleDependentCaches(companyId, originModule || 'commercial');

        // Once the sale closed successfully, mark a one-shot discount approval
        // as consumed so it cannot be reused on a different sale.
        if (discountApprovalId) {
            try {
                await approvalsService.markConsumed(discountApprovalId, companyId);
            } catch (err) {
                logger.warn('Failed to consume discount approval', { discountApprovalId, err });
            }
        }
        return result;
    }

    /**
     * Step 1: Request Void
     * Operator/manager flags a sale for cancellation. Stock is NOT restored yet.
     * Sale enters `pending_void` and waits for a second approver.
     */
    async requestVoid(id: string, reason: string, companyId: string, userId: string, userName: string, userIp: string) {
        const trimmed = (reason || '').trim();
        if (trimmed.length < 5) throw ApiError.badRequest('Motivo deve ter pelo menos 5 caracteres');

        return await prisma.$transaction(async (tx) => {
            const sale = await tx.sale.findFirst({ where: { id, companyId } });
            if (!sale) throw ApiError.notFound('Venda não encontrada');
            if (sale.voidStatus === 'voided') throw ApiError.badRequest('Venda já foi anulada');
            if (sale.voidStatus === 'pending_void') throw ApiError.badRequest('Já existe um pedido de anulação pendente para esta venda');

            const updated = await tx.sale.update({
                where: { id },
                data: {
                    voidStatus: 'pending_void',
                    voidReason: trimmed,
                    voidRequestedBy: userId,
                    voidRequestedAt: new Date(),
                    voidRejectedBy: null,
                    voidRejectedAt: null,
                    voidRejectReason: null
                }
            });

            await tx.auditLog.create({
                data: {
                    userId,
                    action: 'REQUEST_VOID_SALE',
                    entity: 'Sales',
                    entityId: id,
                    oldData: { voidStatus: sale.voidStatus || 'active' } as Prisma.InputJsonValue,
                    newData: { voidStatus: 'pending_void', reason: trimmed, requestedBy: userName } as Prisma.InputJsonValue,
                    ipAddress: userIp
                }
            });

            return ResultHandler.success({ message: 'Pedido de anulação registado. Aguarda aprovação.', sale: updated });
        }, { timeout: 15000, maxWait: 10000 });
    }

    /**
     * Step 2a: Approve Void
     * Second approver (different user) confirms the cancellation.
     * Restores stock, reverses customer stats and loyalty, marks sale as `voided`.
     * The sale row is preserved for audit — never hard-deleted.
     */
    async approveVoid(id: string, companyId: string, approverId: string, approverName: string, userIp: string) {
        let originModuleForInvalidation: string | null | undefined;
        const result = await prisma.$transaction(async (tx) => {
            const sale = await tx.sale.findFirst({
                where: { id, companyId },
                include: { items: true }
            });

            if (!sale) throw ApiError.notFound('Venda não encontrada');
            originModuleForInvalidation = sale.originModule;
            if (sale.voidStatus !== 'pending_void') {
                throw ApiError.badRequest('Apenas pedidos pendentes podem ser aprovados');
            }
            if (sale.voidRequestedBy && sale.voidRequestedBy === approverId) {
                throw ApiError.forbidden('O aprovador deve ser diferente de quem solicitou a anulação');
            }

            // Restore Stock
            for (const item of sale.items) {
                if (!item.productId) continue;
                await stockService.recordMovement({
                    productId: item.productId,
                    quantity: item.quantity,
                    movementType: 'return_in',
                    originModule: 'COMMERCIAL',
                    referenceType: 'SALE',
                    referenceContent: sale.receiptNumber,
                    reason: `Anulação de Venda ${sale.receiptNumber}`,
                    performedBy: approverName,
                    companyId
                }, tx);
            }

            // Reverse customer stats and loyalty points
            if (sale.customerId) {
                await tx.customer.update({
                    where: { id: sale.customerId },
                    data: { totalPurchases: { decrement: sale.total } }
                });

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

            await tx.sale.update({
                where: { id },
                data: {
                    voidStatus: 'voided',
                    voidApprovedBy: approverId,
                    voidApprovedAt: new Date()
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: approverId,
                    action: 'APPROVE_VOID_SALE',
                    entity: 'Sales',
                    entityId: id,
                    oldData: { voidStatus: 'pending_void' } as Prisma.InputJsonValue,
                    newData: {
                        voidStatus: 'voided',
                        approvedBy: approverName,
                        requestedBy: sale.voidRequestedBy,
                        reason: sale.voidReason,
                        restoredItems: sale.items.length,
                        total: Number(sale.total)
                    } as Prisma.InputJsonValue,
                    ipAddress: userIp
                }
            });

            return ResultHandler.success({ message: 'Anulação aprovada. Stock e fidelização revertidos.', restoredItems: sale.items.length });
        }, { timeout: 30000, maxWait: 10000 });

        invalidateSaleDependentCaches(companyId, originModuleForInvalidation);
        return result;
    }

    /**
     * Step 2b: Reject Void
     * Approver refuses the cancellation. Sale returns to `active`.
     */
    async rejectVoid(id: string, reason: string, companyId: string, approverId: string, approverName: string, userIp: string) {
        const trimmed = (reason || '').trim();
        if (trimmed.length < 5) throw ApiError.badRequest('Motivo da rejeição deve ter pelo menos 5 caracteres');

        return await prisma.$transaction(async (tx) => {
            const sale = await tx.sale.findFirst({ where: { id, companyId } });
            if (!sale) throw ApiError.notFound('Venda não encontrada');
            if (sale.voidStatus !== 'pending_void') {
                throw ApiError.badRequest('Apenas pedidos pendentes podem ser rejeitados');
            }
            if (sale.voidRequestedBy && sale.voidRequestedBy === approverId) {
                throw ApiError.forbidden('O aprovador deve ser diferente de quem solicitou a anulação');
            }

            await tx.sale.update({
                where: { id },
                data: {
                    voidStatus: 'active',
                    voidRejectedBy: approverId,
                    voidRejectedAt: new Date(),
                    voidRejectReason: trimmed
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: approverId,
                    action: 'REJECT_VOID_SALE',
                    entity: 'Sales',
                    entityId: id,
                    oldData: { voidStatus: 'pending_void', requestedBy: sale.voidRequestedBy, requestReason: sale.voidReason } as Prisma.InputJsonValue,
                    newData: { voidStatus: 'active', rejectedBy: approverName, rejectReason: trimmed } as Prisma.InputJsonValue,
                    ipAddress: userIp
                }
            });

            return ResultHandler.success({ message: 'Pedido de anulação rejeitado.' });
        }, { timeout: 15000, maxWait: 10000 });
    }

    /**
     * @deprecated Backwards-compat shim. The legacy POST /:id/cancel endpoint
     * now creates a *pending_void* request (step 1) instead of deleting the sale.
     * A second user must call /void/approve to actually restore stock.
     */
    async cancel(id: string, reason: string, companyId: string, userId: string, userName: string, userIp: string) {
        return await this.requestVoid(id, reason, companyId, userId, userName, userIp);
    }

    /**
     * List sales currently awaiting a void approval -- managers' inbox.
     */
    async listPendingVoids(companyId: string) {
        const sales = await prisma.sale.findMany({
            where: { companyId, voidStatus: 'pending_void' },
            include: {
                customer: { select: { id: true, name: true, code: true } },
                user: { select: { id: true, name: true } },
                items: { select: { id: true, quantity: true, unitPrice: true, total: true, productId: true } }
            },
            orderBy: { voidRequestedAt: 'desc' }
        });
        return ResultHandler.success(sales);
    }

    /**
     * Get Sales Statistics
     */
    async getStats(params: SaleStatsParams, companyId: string) {
        const { startDate, endDate } = params;
        const where: Prisma.SaleWhereInput = { companyId, voidStatus: { not: 'voided' } };

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
                where: { sale: { companyId, voidStatus: { not: 'voided' } } },
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

        const todayWhere = { companyId, createdAt: { gte: today, lte: endOfDay }, voidStatus: { not: 'voided' as const } };
        const [sales, totals] = await Promise.all([
            prisma.sale.findMany({
                where: todayWhere,
                include: {
                    customer: { select: { name: true } },
                    items: { select: { quantity: true } }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.sale.aggregate({
                where: todayWhere,
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
