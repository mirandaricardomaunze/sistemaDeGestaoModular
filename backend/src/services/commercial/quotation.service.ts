import { OrderStatus, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../middleware/error.middleware';
import { createPaginatedResponse, getPaginationParams, PaginatedResponse } from '../../utils/pagination';
import { ResultHandler, Result } from '../../utils/result';
import { round2, DEFAULT_IVA_RATE, invalidateCommercialCache, withSequenceRetry } from './shared';

export interface QuotationListParams {
    page?: number | string;
    limit?: number | string;
    status?: string;
    search?: string;
}

interface CreateQuotationItemInput {
    productId?: string | null;
    productName: string;
    quantity: number;
    price: number;
}

export interface CreateQuotationInput {
    customerId?: string | null;
    customerName: string;
    customerPhone?: string | null;
    customerEmail?: string | null;
    validUntil?: string | null;
    notes?: string | null;
    items: CreateQuotationItemInput[];
}

export interface ConvertQuotationInput {
    dueDays?: number | string;
    taxRate?: number | string;
}

interface ProductSummaryDTO {
    id: string;
    barcode: string | null;
    code: string;
    name: string;
}

interface QuotationItemDTO {
    id: string;
    productId: string | null;
    productName: string;
    quantity: number;
    price: number;
    total: number;
    product?: ProductSummaryDTO | null;
}

export interface QuotationDTO {
    id: string;
    orderNumber: string;
    customerId: string | null;
    customerName: string;
    customerPhone: string;
    customerEmail: string | null;
    status: OrderStatus;
    total: number;
    notes: string | null;
    deliveryDate: Date | null;
    createdAt: Date;
    items: QuotationItemDTO[];
}

export interface InvoiceFromQuotationDTO {
    id: string;
    invoiceNumber: string;
    quotationId: string | null;
    customerId: string | null;
    customerName: string;
    subtotal: number;
    tax: number;
    total: number;
    amountDue: number;
    status: string;
    dueDate: Date;
    items: Array<{
        id: string;
        productId: string | null;
        description: string;
        quantity: number;
        unitPrice: number;
        ivaRate: number;
        ivaAmount: number;
        total: number;
    }>;
}

const ORDER_STATUSES = Object.values(OrderStatus);

type QuotationWithItems = Prisma.CustomerOrderGetPayload<{
    include: {
        customer: { select: { id: true; name: true; phone: true } };
        items: true;
    };
}>;

type InvoiceWithItems = Prisma.InvoiceGetPayload<{
    include: {
        customer: { select: { id: true; name: true } };
        items: true;
    };
}>;

type QuotationAuditSource = Prisma.CustomerOrderGetPayload<{
    include: { items: true };
}>;

type CommercialQuotationTransactionClient = Pick<typeof prisma, 'auditLog' | 'customerOrder' | 'invoice' | 'product'>;

export class CommercialQuotationService {
    async listQuotations(
        companyId: string,
        params: QuotationListParams
    ): Promise<Result<PaginatedResponse<QuotationDTO>>> {
        if (!companyId) throw ApiError.badRequest('Empresa nao identificada. Faca login novamente.');
        const { page, limit, skip } = getPaginationParams(params);
        const where = this.buildQuotationWhere(companyId, params);

        const [total, quotes] = await Promise.all([
            prisma.customerOrder.count({ where }),
            prisma.customerOrder.findMany({
                where,
                include: {
                    customer: { select: { id: true, name: true, phone: true } },
                    items: true,
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
        ]);

        const productById = await this.getProductMap(companyId, quotes);
        const data = quotes.map(quote => this.toQuotationDTO(quote, productById));

        return ResultHandler.success(createPaginatedResponse(data, page, limit, total));
    }

    async createQuotation(
        data: CreateQuotationInput,
        companyId: string,
        userId?: string,
        userName?: string
    ): Promise<Result<QuotationDTO>> {
        if (!companyId) throw ApiError.badRequest('Empresa nao identificada. Faca login novamente.');
        this.validateQuotationInput(data);

        const providedProductIds = data.items.map(item => item.productId).filter((id): id is string => Boolean(id));
        await this.assertProductsExist(companyId, providedProductIds);

        const total = this.calculateQuotationTotal(data.items);
        const year = new Date().getFullYear();

        const result = await withSequenceRetry(() => prisma.$transaction(async tx => {
            const orderNumber = await this.getNextQuotationNumber(tx, companyId, year);

            for (const item of data.items) {
                if (item.productId) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { reservedStock: { increment: Number(item.quantity) } }
                    });
                }
            }

            const created = await tx.customerOrder.create({
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
                        create: data.items.map(item => ({
                            productId: item.productId || null,
                            productName: item.productName.trim(),
                            quantity: Number(item.quantity),
                            price: Number(item.price),
                            total: round2(Number(item.price) * Number(item.quantity)),
                        })),
                    },
                },
                include: { customer: { select: { id: true, name: true, phone: true } }, items: true },
            });

            await tx.auditLog.create({
                data: {
                    userId,
                    userName,
                    action: 'CREATE_COMMERCIAL_QUOTATION',
                    entity: 'CustomerOrder',
                    entityId: created.id,
                    newData: this.toQuotationAuditPayload(created),
                    companyId
                }
            });

            return created;
        }, { timeout: 20000, maxWait: 5000 }));

        invalidateCommercialCache(companyId);
        return ResultHandler.success(this.toQuotationDTO(result), 'Cotacao criada com sucesso');
    }

    async convertQuotationToInvoice(
        quotationId: string,
        data: ConvertQuotationInput,
        companyId: string,
        userId?: string,
        userName?: string
    ): Promise<Result<InvoiceFromQuotationDTO>> {
        if (!companyId) throw ApiError.badRequest('Empresa nao identificada. Faca login novamente.');

        const dueDays = Number(data.dueDays ?? 30);
        if (dueDays < 1) throw ApiError.badRequest('Prazo de vencimento invalido');

        const taxRate = await this.resolveTaxRate(companyId, data.taxRate);
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + dueDays);
        const year = new Date().getFullYear();

        const result = await withSequenceRetry(() => prisma.$transaction(async tx => {
            const quotation = await this.claimConvertibleQuotation(tx, quotationId, companyId);
            const invoiceNumber = await this.getNextInvoiceNumber(tx, companyId, year);
            const subtotal = Number(quotation.total);
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
                    subtotal,
                    tax,
                    discount: 0,
                    total,
                    amountPaid: 0,
                    amountDue: total,
                    status: 'sent',
                    dueDate,
                    companyId,
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

            for (const item of quotation.items) {
                if (item.productId) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { reservedStock: { decrement: Number(item.quantity) } }
                    });
                }
            }

            await tx.auditLog.create({
                data: {
                    userId,
                    userName,
                    action: 'CONVERT_COMMERCIAL_QUOTATION_TO_INVOICE',
                    entity: 'Invoice',
                    entityId: created.id,
                    oldData: this.toQuotationAuditPayload(quotation),
                    newData: this.toInvoiceAuditPayload(created),
                    companyId
                }
            });

            return created;
        }, { timeout: 30000, maxWait: 10000 }));

        invalidateCommercialCache(companyId);
        return ResultHandler.success(this.toInvoiceDTO(result), 'Cotacao convertida para fatura');
    }

    private buildQuotationWhere(companyId: string, params: QuotationListParams): Prisma.CustomerOrderWhereInput {
        const where: Prisma.CustomerOrderWhereInput = { companyId, orderType: 'quotation' };
        if (this.isOrderStatus(params.status)) where.status = params.status;
        if (params.search) {
            where.OR = [
                { orderNumber: { contains: params.search, mode: 'insensitive' } },
                { customerName: { contains: params.search, mode: 'insensitive' } },
            ];
        }
        return where;
    }

    private isOrderStatus(status: string | undefined): status is OrderStatus {
        return Boolean(status && ORDER_STATUSES.includes(status as OrderStatus));
    }

    private validateQuotationInput(data: CreateQuotationInput): void {
        if (!data.customerName?.trim()) throw ApiError.badRequest('Nome do cliente e obrigatorio');
        if (!Array.isArray(data.items) || data.items.length === 0) {
            throw ApiError.badRequest('A cotacao deve ter pelo menos um item');
        }
        for (const item of data.items) {
            if (!item.productName?.trim()) throw ApiError.badRequest('Cada item deve ter nome do produto');
            if (!item.quantity || item.quantity <= 0) throw ApiError.badRequest('Quantidade deve ser maior que zero');
            if (item.price === undefined || item.price === null || item.price < 0) {
                throw ApiError.badRequest('Preco invalido no item');
            }
        }
    }

    private async assertProductsExist(companyId: string, productIds: string[]): Promise<void> {
        if (productIds.length === 0) return;
        const existing = await prisma.product.findMany({
            where: { id: { in: productIds }, companyId, isActive: true },
            select: { id: true }
        });
        if (existing.length !== productIds.length) {
            throw ApiError.badRequest('Um ou mais produtos nao foram encontrados ou estao inactivos');
        }
    }

    private calculateQuotationTotal(items: CreateQuotationItemInput[]): number {
        return items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
    }

    private async getNextQuotationNumber(
        tx: CommercialQuotationTransactionClient,
        companyId: string,
        year: number
    ): Promise<string> {
        const lastQuote = await tx.customerOrder.findFirst({
            where: { companyId, orderType: 'quotation', orderNumber: { startsWith: `COT-${year}-` } },
            orderBy: { orderNumber: 'desc' },
            select: { orderNumber: true }
        });
        const lastNum = lastQuote ? parseInt(lastQuote.orderNumber.split('-')[2] || '0', 10) : 0;
        return `COT-${year}-${String(lastNum + 1).padStart(4, '0')}`;
    }

    private async getNextInvoiceNumber(
        tx: CommercialQuotationTransactionClient,
        companyId: string,
        year: number
    ): Promise<string> {
        const lastInvoice = await tx.invoice.findFirst({
            where: { companyId, invoiceNumber: { startsWith: `INV-${year}-` } },
            orderBy: { invoiceNumber: 'desc' },
            select: { invoiceNumber: true }
        });
        const lastInvNum = lastInvoice ? parseInt(lastInvoice.invoiceNumber.split('-')[2] || '0', 10) : 0;
        return `INV-${year}-${String(lastInvNum + 1).padStart(5, '0')}`;
    }

    private async resolveTaxRate(companyId: string, rawTaxRate: ConvertQuotationInput['taxRate']): Promise<number> {
        if (rawTaxRate !== undefined) return Number(rawTaxRate);
        const defaultIva = await prisma.ivaRate.findFirst({
            where: { companyId, isDefault: true, isActive: true },
            select: { rate: true }
        });
        return defaultIva ? Number(defaultIva.rate) / 100 : DEFAULT_IVA_RATE;
    }

    private async claimConvertibleQuotation(
        tx: CommercialQuotationTransactionClient,
        quotationId: string,
        companyId: string
    ) {
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
            if (!existing) throw ApiError.notFound('Cotacao nao encontrada');
            if (existing.status === 'cancelled') throw ApiError.badRequest('Nao e possivel converter uma cotacao cancelada');
            throw ApiError.badRequest('Esta cotacao ja foi convertida em fatura');
        }

        return tx.customerOrder.findFirstOrThrow({
            where: { id: quotationId, companyId, orderType: 'quotation' },
            include: { items: true }
        });
    }

    private async getProductMap(
        companyId: string,
        quotes: QuotationWithItems[]
    ): Promise<Map<string, ProductSummaryDTO>> {
        const productIds = Array.from(new Set(
            quotes.flatMap(quote => quote.items.map(item => item.productId).filter((id): id is string => Boolean(id)))
        ));
        const products = productIds.length > 0
            ? await prisma.product.findMany({
                where: { id: { in: productIds }, companyId },
                select: { id: true, barcode: true, code: true, name: true },
            })
            : [];
        return new Map(products.map(product => [product.id, product]));
    }

    private toQuotationDTO(
        quote: QuotationWithItems,
        productById: Map<string, ProductSummaryDTO> = new Map()
    ): QuotationDTO {
        return {
            id: quote.id,
            orderNumber: quote.orderNumber,
            customerId: quote.customerId,
            customerName: quote.customerName,
            customerPhone: quote.customerPhone,
            customerEmail: quote.customerEmail,
            status: quote.status,
            total: Number(quote.total),
            notes: quote.notes,
            deliveryDate: quote.deliveryDate,
            createdAt: quote.createdAt,
            items: quote.items.map(item => ({
                id: item.id,
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity,
                price: Number(item.price),
                total: Number(item.total),
                product: item.productId ? productById.get(item.productId) ?? null : null,
            })),
        };
    }

    private toInvoiceDTO(invoice: InvoiceWithItems): InvoiceFromQuotationDTO {
        return {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            quotationId: invoice.quotationId,
            customerId: invoice.customerId,
            customerName: invoice.customerName,
            subtotal: Number(invoice.subtotal),
            tax: Number(invoice.tax),
            total: Number(invoice.total),
            amountDue: Number(invoice.amountDue),
            status: invoice.status,
            dueDate: invoice.dueDate,
            items: invoice.items.map(item => ({
                id: item.id,
                productId: item.productId,
                description: item.description,
                quantity: item.quantity,
                unitPrice: Number(item.unitPrice),
                ivaRate: Number(item.ivaRate),
                ivaAmount: Number(item.ivaAmount),
                total: Number(item.total),
            })),
        };
    }

    private toQuotationAuditPayload(quote: QuotationAuditSource): Prisma.JsonObject {
        return {
            id: quote.id,
            orderNumber: quote.orderNumber,
            customerName: quote.customerName,
            status: quote.status,
            total: Number(quote.total),
            itemCount: quote.items.length,
        };
    }

    private toInvoiceAuditPayload(invoice: InvoiceWithItems): Prisma.JsonObject {
        return {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            quotationId: invoice.quotationId,
            customerName: invoice.customerName,
            total: Number(invoice.total),
            amountDue: Number(invoice.amountDue),
            itemCount: invoice.items.length,
        };
    }
}

export const commercialQuotationService = new CommercialQuotationService();
