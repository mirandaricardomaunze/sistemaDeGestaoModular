import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { buildPaginationMeta } from '../utils/pagination';

export class InvoicesService {
    async list(params: any, companyId: string) {
        const { status, customerId, startDate, endDate, page = '1', limit = '20', sortBy = 'createdAt', sortOrder = 'desc' } = params;
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where: any = { companyId };
        if (status && status !== 'all') where.status = status;
        if (customerId) where.customerId = customerId;
        if (startDate || endDate) {
            where.issueDate = {};
            if (startDate) where.issueDate.gte = new Date(String(startDate));
            if (endDate) where.issueDate.lte = new Date(String(endDate));
        }

        const [total, invoices] = await Promise.all([
            prisma.invoice.count({ where }),
            prisma.invoice.findMany({
                where,
                include: { customer: { select: { id: true, name: true, code: true } }, _count: { select: { items: true, payments: true } } },
                orderBy: { [sortBy as string]: sortOrder },
                skip,
                take: limitNum
            })
        ]);

        return {
            data: invoices,
            pagination: buildPaginationMeta(pageNum, limitNum, total)
        };
    }

    async getAvailableSources(companyId: string) {
        const invoicedInvoices = await prisma.invoice.findMany({
            where: { companyId },
            select: { orderId: true }
        });

        const invoicedOrderIds = invoicedInvoices.map(i => i.orderId).filter((id): id is string => !!id);

        const [availableSales, availableOrders] = await Promise.all([
            prisma.pharmacySale.findMany({
                where: { companyId, status: 'completed', id: { notIn: invoicedOrderIds } },
                include: { customer: true, items: { include: { batch: { include: { medication: { include: { product: true } } } } } } },
                orderBy: { createdAt: 'desc' }, take: 50
            }),
            prisma.customerOrder.findMany({
                where: { companyId, status: 'completed', id: { notIn: invoicedOrderIds } },
                include: { items: true },
                orderBy: { createdAt: 'desc' }, take: 50
            })
        ]);

        return [
            ...availableSales.map(s => ({
                id: s.id, number: s.saleNumber, type: 'pharmacy', customerId: s.customerId,
                customerName: s.customerName || s.customer?.name || 'Cliente Balcão',
                items: s.items.map(i => ({
                    productId: i.batch?.medication?.productId, description: i.productName,
                    quantity: i.quantity, unitPrice: Number(i.unitPrice), total: Number(i.total)
                })),
                total: Number(s.total)
            })),
            ...availableOrders.map(o => ({
                id: o.id, number: o.orderNumber, type: 'commercial',
                customerName: o.customerName, items: o.items.map(i => ({
                    productId: i.productId, description: i.productName,
                    quantity: i.quantity, unitPrice: Number(i.price), total: Number(i.total)
                })),
                total: Number(o.total)
            }))
        ];
    }

    async create(data: any, companyId: string) {
        const count = await prisma.invoice.count({ where: { companyId } });
        const invoiceNumber = `FAT-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

        const { items, ...invoiceData } = data;
        const invoice = await prisma.invoice.create({
            data: {
                ...invoiceData,
                invoiceNumber,
                companyId,
                dueDate: data.dueDate ? new Date(data.dueDate) : new Date(),
                amountDue: data.total,
                items: {
                    create: items.map((item: any) => ({
                        productId: item.productId, description: item.description,
                        quantity: item.quantity, unitPrice: item.unitPrice,
                        discount: item.discount || 0, total: item.total
                    }))
                }
            },
            include: { customer: true, items: true }
        });

        // Register IVA Retention
        if (data.taxAmount > 0) {
            try {
                const ivaConfig = await prisma.taxConfig.findFirst({ where: { type: 'iva', isActive: true, companyId } });
                await prisma.taxRetention.create({
                    data: {
                        companyId, type: 'iva', entityType: 'invoice', entityId: invoice.id,
                        period: new Date().toISOString().slice(0, 7),
                        baseAmount: data.subtotal, retainedAmount: data.taxAmount,
                        rate: ivaConfig?.rate || 16, description: `IVA da Fatura ${invoiceNumber}`
                    }
                });
            } catch (e) { console.error('Fiscal retention error:', e); }
        }

        return invoice;
    }

    async getById(id: string, companyId: string) {
        const invoice = await prisma.invoice.findFirst({
            where: { id, companyId },
            include: { customer: true, items: { include: { product: true } }, payments: true, creditNotes: true }
        });
        if (!invoice) throw ApiError.notFound('Fatura não encontrada');
        return invoice;
    }

    async cancel(id: string, companyId: string) {
        const result = await prisma.invoice.updateMany({
            where: { id, companyId },
            data: { status: 'cancelled' }
        });
        if (result.count === 0) throw ApiError.notFound('Fatura não encontrada');
        return true;
    }

    async addPayment(id: string, data: any, companyId: string) {
        const invoice = await prisma.invoice.findFirst({ where: { id, companyId } });
        if (!invoice) throw ApiError.notFound('Fatura não encontrada');

        const payment = await prisma.invoicePayment.create({
            data: { invoiceId: id, amount: data.amount, method: data.method, reference: data.reference, notes: data.notes }
        });

        const newAmountPaid = Number(invoice.amountPaid) + data.amount;
        const newAmountDue = Number(invoice.total) - newAmountPaid;
        let newStatus: any = invoice.status;
        if (newAmountDue <= 0) newStatus = 'paid';
        else if (newAmountPaid > 0) newStatus = 'partial';

        await prisma.invoice.update({
            where: { id },
            data: { amountPaid: newAmountPaid, amountDue: Math.max(0, newAmountDue), status: newStatus, paidDate: newStatus === 'paid' ? new Date() : null }
        });

        return payment;
    }

    async listCreditNotes(params: any, companyId: string) {
        const { invoiceId, page = '1', limit = '20' } = params;
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where: any = { companyId };
        if (invoiceId) where.originalInvoiceId = invoiceId;

        const [total, creditNotes] = await Promise.all([
            prisma.creditNote.count({ where }),
            prisma.creditNote.findMany({ where, include: { originalInvoice: true, items: true }, orderBy: { createdAt: 'desc' }, skip, take: limitNum })
        ]);

        return {
            data: creditNotes,
            pagination: buildPaginationMeta(pageNum, limitNum, total)
        };
    }

    async createCreditNote(invoiceId: string, data: any, companyId: string) {
        const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, companyId } });
        if (!invoice) throw ApiError.notFound('Fatura não encontrada');

        const count = await prisma.creditNote.count({ where: { companyId } });
        const number = `NC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

        const subtotal = data.items.reduce((sum: number, item: any) => sum + item.total, 0);
        const total = subtotal * 1.16;

        return prisma.creditNote.create({
            data: {
                number, originalInvoiceId: invoiceId, customerId: invoice.customerId,
                customerName: invoice.customerName, subtotal, tax: subtotal * 0.16, total,
                reason: data.reason, notes: data.notes, companyId,
                items: {
                    create: data.items.map((item: any) => ({
                        productId: item.productId, description: item.description,
                        quantity: item.quantity, unitPrice: item.unitPrice, total: item.total,
                        originalInvoiceItemId: item.originalInvoiceItemId, companyId
                    }))
                }
            },
            include: { items: true, originalInvoice: true }
        });
    }
}

export const invoicesService = new InvoicesService();
