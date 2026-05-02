import { prisma } from '../../lib/prisma';
import { ApiError } from '../../middleware/error.middleware';
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination';
import { ResultHandler, Result } from '../../utils/result';
import { round2, DEFAULT_IVA_RATE, invalidateCommercialCache, withSequenceRetry } from './shared';

export class CommercialQuotationService {

    async listQuotations(companyId: string, params: any): Promise<Result<any>> {
        if (!companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
        const { page, limit, skip } = getPaginationParams(params);
        const { status, search } = params;

        const where: any = { companyId, orderType: 'quotation' };
        if (status) where.status = status;
        if (search) {
            where.OR = [
                { orderNumber: { contains: String(search), mode: 'insensitive' } },
                { customerName: { contains: String(search), mode: 'insensitive' } },
            ];
        }

        const [total, quotes] = await Promise.all([
            prisma.customerOrder.count({ where }),
            prisma.customerOrder.findMany({
                where,
                include: {
                    customer: { select: { id: true, name: true, phone: true } },
                    items: true,
                },
                orderBy: { createdAt: 'desc' },
                skip, take: limit,
            }),
        ]);

        const productIds = Array.from(new Set(
            quotes.flatMap(q => q.items.map(i => i.productId).filter((id): id is string => !!id))
        ));
        const products = productIds.length > 0
            ? await prisma.product.findMany({
                where: { id: { in: productIds }, companyId },
                select: { id: true, barcode: true, code: true, name: true },
            })
            : [];
        const productById = new Map(products.map(p => [p.id, p]));

        const quotesWithProducts = quotes.map(q => ({
            ...q,
            items: q.items.map(i => ({
                ...i,
                product: i.productId ? productById.get(i.productId) ?? null : null,
            })),
        }));

        return ResultHandler.success(createPaginatedResponse(quotesWithProducts, page, limit, total));
    }

    async createQuotation(data: any, companyId: string): Promise<Result<any>> {
        if (!companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
        if (!data.customerName?.trim()) throw ApiError.badRequest('Nome do cliente é obrigatório');
        if (!Array.isArray(data.items) || data.items.length === 0) throw ApiError.badRequest('A cotação deve ter pelo menos um item');
        for (const item of data.items) {
            if (!item.productName?.trim()) throw ApiError.badRequest('Cada item deve ter nome do produto');
            if (!item.quantity || item.quantity <= 0) throw ApiError.badRequest('Quantidade deve ser maior que zero');
            if (item.price === undefined || item.price === null || item.price < 0) throw ApiError.badRequest('Preço inválido no item');
        }

        const providedProductIds = data.items.map((i: any) => i.productId).filter(Boolean);
        if (providedProductIds.length > 0) {
            const existing = await prisma.product.findMany({
                where: { id: { in: providedProductIds }, companyId, isActive: true },
                select: { id: true }
            });
            if (existing.length !== providedProductIds.length) {
                throw ApiError.badRequest('Um ou mais produtos não foram encontrados ou estão inactivos');
            }
        }

        const total = data.items.reduce((s: number, i: any) => s + Number(i.price) * Number(i.quantity), 0);
        const year = new Date().getFullYear();

        // Retry on P2002 because orderNumber generation is not atomic across concurrent
        // transactions; the @@unique([companyId, orderNumber]) constraint catches collisions.
        const result = await withSequenceRetry(() => prisma.$transaction(async (tx) => {
            const lastQuote = await tx.customerOrder.findFirst({
                where: { companyId, orderType: 'quotation', orderNumber: { startsWith: `COT-${year}-` } },
                orderBy: { orderNumber: 'desc' },
                select: { orderNumber: true }
            });
            const lastNum = lastQuote ? parseInt(lastQuote.orderNumber.split('-')[2] || '0', 10) : 0;
            const orderNumber = `COT-${year}-${String(lastNum + 1).padStart(4, '0')}`;

            for (const item of data.items) {
                if (item.productId) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { reservedStock: { increment: Number(item.quantity) } }
                    });
                }
            }

            return tx.customerOrder.create({
                data: {
                    orderNumber,
                    customerName: data.customerName.trim(),
                    customerPhone: data.customerPhone?.trim() || '',
                    customerEmail: data.customerEmail?.trim() || null,
                    total,
                    notes: (data.notes ?? '').replace(/__QUOTE__/g, '').trim() || null,
                    orderType: 'quotation',
                    deliveryDate: data.validUntil ? new Date(data.validUntil) : null,
                    customerId: data.customerId || null,
                    companyId,
                    items: {
                        create: data.items.map((i: any) => ({
                            productId: i.productId || null,
                            productName: i.productName.trim(),
                            quantity: Number(i.quantity),
                            price: Number(i.price),
                            total: round2(Number(i.price) * Number(i.quantity)),
                        })),
                    },
                },
                include: { customer: { select: { id: true, name: true } }, items: true },
            });
        }, { timeout: 20000, maxWait: 5000 }));

        invalidateCommercialCache(companyId);
        return ResultHandler.success(result, 'Cotação criada com sucesso');
    }

    async convertQuotationToInvoice(quotationId: string, data: any, companyId: string): Promise<Result<any>> {
        if (!companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');

        const dueDays = Number(data.dueDays ?? 30);
        if (dueDays < 1) throw ApiError.badRequest('Prazo de vencimento inválido');

        // Resolve IVA: explicit > company default > module default
        let resolvedTaxRate = data.taxRate !== undefined ? Number(data.taxRate) : null;
        if (resolvedTaxRate === null) {
            const defaultIva = await prisma.ivaRate.findFirst({
                where: { companyId, isDefault: true, isActive: true },
                select: { rate: true }
            });
            resolvedTaxRate = defaultIva ? Number(defaultIva.rate) / 100 : DEFAULT_IVA_RATE;
        }

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + dueDays);
        const year = new Date().getFullYear();

        // Retry on unique-key collisions when generating invoiceNumber under concurrency.
        const result = await withSequenceRetry(() => prisma.$transaction(async (tx) => {
            // Atomic claim: only proceed if quotation is still convertible. updateMany returns 0
            // when another concurrent request already flipped the status — prevents double conversion.
            const claim = await tx.customerOrder.updateMany({
                where: {
                    id: quotationId,
                    companyId,
                    orderType: 'quotation',
                    status: { notIn: ['cancelled', 'completed'] },
                },
                data: { status: 'completed' },
            });
            if (claim.count === 0) {
                const existing = await tx.customerOrder.findFirst({
                    where: { id: quotationId, companyId, orderType: 'quotation' },
                    select: { status: true }
                });
                if (!existing) throw ApiError.notFound('Cotação não encontrada');
                if (existing.status === 'cancelled') throw ApiError.badRequest('Não é possível converter uma cotação cancelada');
                throw ApiError.badRequest('Esta cotação já foi convertida em fatura');
            }

            const quotation = await tx.customerOrder.findFirstOrThrow({
                where: { id: quotationId, companyId, orderType: 'quotation' },
                include: { items: true }
            });

            const lastInvoice = await tx.invoice.findFirst({
                where: { companyId, invoiceNumber: { startsWith: `INV-${year}-` } },
                orderBy: { invoiceNumber: 'desc' },
                select: { invoiceNumber: true }
            });
            const lastInvNum = lastInvoice ? parseInt(lastInvoice.invoiceNumber.split('-')[2] || '0', 10) : 0;
            const invoiceNumber = `INV-${year}-${String(lastInvNum + 1).padStart(5, '0')}`;
            const subtotal = Number(quotation.total);
            const taxRate = resolvedTaxRate as number;
            const tax = round2(subtotal * taxRate);
            const total = round2(subtotal + tax);

            const created = await tx.invoice.create({
                data: {
                    invoiceNumber,
                    quotationId: quotation.id,
                    customerName: quotation.customerName,
                    customerEmail: quotation.customerEmail ?? null,
                    customerPhone: quotation.customerPhone ?? null,
                    customerId: quotation.customerId ?? null,
                    subtotal, tax, discount: 0, total,
                    amountPaid: 0, amountDue: total,
                    status: 'sent', dueDate, companyId,
                    items: {
                        create: quotation.items.map(item => ({
                            description: item.productName,
                            productId: item.productId ?? null,
                            quantity: item.quantity,
                            unitPrice: Number(item.price),
                            discount: 0,
                            ivaRate: taxRate * 100,
                            ivaAmount: round2(Number(item.price) * Number(item.quantity) * taxRate),
                            total: round2(Number(item.price) * Number(item.quantity) * (1 + taxRate)),
                        }))
                    }
                },
                include: { customer: { select: { id: true, name: true } }, items: true }
            });

            // Release reserved stock now that quotation is converted.
            for (const item of quotation.items) {
                if (item.productId) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { reservedStock: { decrement: Number(item.quantity) } }
                    });
                }
            }

            return created;
        }, { timeout: 30000, maxWait: 10000 }));

        invalidateCommercialCache(companyId);
        return ResultHandler.success(result, 'Cotação convertida para fatura');
    }
}

export const commercialQuotationService = new CommercialQuotationService();
