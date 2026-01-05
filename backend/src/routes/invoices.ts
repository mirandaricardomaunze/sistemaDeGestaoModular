import { Router } from 'express';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import {
    createInvoiceSchema,
    updateInvoiceSchema,
    addPaymentSchema,
    creditNoteSchema,
    formatZodError,
    ZodError
} from '../validation';

const router = Router();

// Get all invoices with pagination
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const {
            status,
            customerId,
            startDate,
            endDate,
            page = '1',
            limit = '20',
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where: any = {
            companyId: req.companyId // Multi-tenancy isolation
        };

        if (status && status !== 'all') where.status = status;
        if (customerId) where.customerId = customerId;

        if (startDate || endDate) {
            where.issueDate = {};
            if (startDate) where.issueDate.gte = new Date(String(startDate));
            if (endDate) where.issueDate.lte = new Date(String(endDate));
        }

        // Get total count and paginated items in parallel
        const [total, invoices] = await Promise.all([
            prisma.invoice.count({ where }),
            prisma.invoice.findMany({
                where,
                include: {
                    customer: { select: { id: true, name: true, code: true } },
                    _count: { select: { items: true, payments: true } }
                },
                orderBy: { [sortBy as string]: sortOrder },
                skip,
                take: limitNum
            })
        ]);

        res.json({
            data: invoices,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                hasMore: skip + invoices.length < total
            }
        });
    } catch (error) {
        console.error('Get invoices error:', error);
        res.status(500).json({ error: 'Erro ao buscar faturas' });
    }
});

// Get invoice by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const invoice = await prisma.invoice.findFirst({
            where: {
                id: req.params.id,
                companyId: req.companyId // Multi-tenancy isolation
            },
            include: {
                customer: true,
                items: { include: { product: true } },
                payments: true,
                creditNotes: true
            }
        });

        if (!invoice) {
            return res.status(404).json({ error: 'Fatura não encontrada' });
        }

        res.json(invoice);
    } catch (error) {
        console.error('Get invoice error:', error);
        res.status(500).json({ error: 'Erro ao buscar fatura' });
    }
});

// Create invoice
router.post('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const validatedData = createInvoiceSchema.parse(req.body);
        const {
            customerId,
            customerName,
            customerEmail,
            customerPhone,
            customerAddress,
            items,
            subtotal,
            discount,
            total,
            dueDate,
            notes,
            orderId,
            orderNumber
        } = validatedData;

        // Generate invoice number per company
        const year = new Date().getFullYear();
        const count = await prisma.invoice.count({
            where: { companyId: req.companyId }
        });
        const invoiceNumber = `FAT-${year}-${String(count + 1).padStart(5, '0')}`;

        const invoice = await prisma.invoice.create({
            data: {
                invoiceNumber,
                customerId: customerId || null,
                customerName: customerName || '',
                customerEmail: customerEmail || null,
                customerPhone: customerPhone || null,
                customerAddress: customerAddress || null,
                orderId: orderId || null,
                orderNumber: orderNumber || null,
                subtotal,
                discount: discount || 0,
                tax: validatedData.taxAmount || 0,
                total,
                dueDate: dueDate ? new Date(dueDate) : new Date(),
                amountDue: total,
                notes: notes || null,
                companyId: req.companyId,
                items: {
                    create: items.map((item) => ({
                        productId: item.productId,
                        description: item.description,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        discount: item.discount || 0,
                        total: item.total
                    }))
                }
            } as any,
            include: {
                customer: true,
                items: true
            }
        });

        // Register IVA Retention in Fiscal Module
        try {
            const tax = validatedData.taxAmount || 0;
            if (tax > 0) {
                const ivaConfig = await prisma.taxConfig.findFirst({
                    where: {
                        type: 'iva',
                        isActive: true,
                        companyId: req.companyId
                    }
                });

                await prisma.taxRetention.create({
                    data: {
                        companyId: req.companyId,
                        type: 'iva',
                        entityType: 'invoice',
                        entityId: invoice.id,
                        period: new Date().toISOString().slice(0, 7), // YYYY-MM
                        baseAmount: subtotal,
                        retainedAmount: tax,
                        rate: ivaConfig?.rate || 16,
                        description: `IVA da Fatura ${invoiceNumber}`
                    } as any
                });
            }
        } catch (fiscalError) {
            console.error('Failed to register fiscal retention for invoice:', fiscalError);
        }

        res.status(201).json(invoice);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Dados inválidos', details: formatZodError(error) });
        }
        console.error('Create invoice error:', error);
        res.status(500).json({ error: 'Erro ao criar fatura' });
    }
});

// Update invoice
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const validatedData = updateInvoiceSchema.parse(req.body);
        const { items, ...updateData } = validatedData;

        // Update invoice (not items)
        const result = await prisma.invoice.updateMany({
            where: {
                id,
                companyId: req.companyId // Multi-tenancy isolation
            },
            data: updateData as any
        });

        if (result.count === 0) {
            return res.status(404).json({ error: 'Fatura não encontrada ou acesso negado' });
        }

        const invoice = await prisma.invoice.findUnique({
            where: { id },
            include: {
                customer: true,
                items: true,
                payments: true
            }
        });

        res.json(invoice);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Dados inválidos', details: formatZodError(error) });
        }
        console.error('Update invoice error:', error);
        res.status(500).json({ error: 'Erro ao atualizar fatura' });
    }
});

// Add payment to invoice
router.post('/:id/payments', authenticate, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const validatedData = addPaymentSchema.parse(req.body);
        const { amount, method, reference, notes } = validatedData;

        const invoice = await prisma.invoice.findFirst({
            where: {
                id,
                companyId: req.companyId // Multi-tenancy isolation
            }
        });

        if (!invoice) {
            return res.status(404).json({ error: 'Fatura não encontrada' });
        }

        // Create payment
        const payment = await prisma.invoicePayment.create({
            data: {
                invoiceId: id,
                amount,
                method: method as any,
                reference,
                notes
            }
        });

        // Update invoice amounts
        const newAmountPaid = Number(invoice.amountPaid) + amount;
        const newAmountDue = Number(invoice.total) - newAmountPaid;

        let newStatus: 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled' = invoice.status;
        if (newAmountDue <= 0) {
            newStatus = 'paid';
        } else if (newAmountPaid > 0) {
            newStatus = 'partial';
        }

        await prisma.invoice.update({
            where: { id },
            data: {
                amountPaid: newAmountPaid,
                amountDue: Math.max(0, newAmountDue),
                status: newStatus,
                paidDate: newStatus === 'paid' ? new Date() : null
            }
        });

        res.status(201).json(payment);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Dados inválidos', details: formatZodError(error) });
        }
        console.error('Add payment error:', error);
        res.status(500).json({ error: 'Erro ao adicionar pagamento' });
    }
});

// Cancel invoice
router.post('/:id/cancel', authenticate, async (req: AuthRequest, res) => {
    try {
        const result = await prisma.invoice.updateMany({
            where: {
                id: req.params.id,
                companyId: req.companyId // Multi-tenancy isolation
            },
            data: { status: 'cancelled' }
        });

        if (result.count === 0) {
            return res.status(404).json({ error: 'Fatura não encontrada ou acesso negado' });
        }

        res.json({ message: 'Fatura cancelada com sucesso' });
    } catch (error) {
        console.error('Cancel invoice error:', error);
        res.status(500).json({ error: 'Erro ao cancelar fatura' });
    }
});

// Send invoice (mark as sent)
router.post('/:id/send', authenticate, async (req: AuthRequest, res) => {
    try {
        const result = await prisma.invoice.updateMany({
            where: {
                id: req.params.id,
                companyId: req.companyId // Multi-tenancy isolation
            },
            data: { status: 'sent' }
        });

        if (result.count === 0) {
            return res.status(404).json({ error: 'Fatura não encontrada ou acesso negado' });
        }

        res.json({ message: 'Fatura marcada como enviada' });
    } catch (error) {
        console.error('Send invoice error:', error);
        res.status(500).json({ error: 'Erro ao enviar fatura' });
    }
});

// Create credit note
router.post('/:id/credit-notes', authenticate, async (req: AuthRequest, res) => {
    try {
        const invoiceId = req.params.id;
        const validatedData = creditNoteSchema.parse(req.body);
        const { items, reason, notes } = validatedData;

        const invoice = await prisma.invoice.findFirst({
            where: {
                id: invoiceId,
                companyId: req.companyId // Multi-tenancy isolation
            },
            include: { customer: true }
        });

        if (!invoice) {
            return res.status(404).json({ error: 'Fatura não encontrada ou acesso negado' });
        }

        // Generate credit note number
        const year = new Date().getFullYear();
        const count = await prisma.creditNote.count();
        const number = `NC-${year}-${String(count + 1).padStart(4, '0')}`;

        // Calculate totals
        const subtotal = items.reduce((sum: number, item) => sum + item.total, 0);
        const taxRate = 0.16; // 16% IVA
        const tax = subtotal * taxRate;
        const total = subtotal + tax;

        const creditNote = await prisma.creditNote.create({
            data: {
                number,
                originalInvoiceId: invoiceId,
                customerId: invoice.customerId,
                customerName: invoice.customerName,
                subtotal,
                tax,
                total,
                reason,
                notes,
                items: {
                    create: items.map((item) => ({
                        productId: item.productId,
                        description: item.description,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        total: item.total,
                        originalInvoiceItemId: item.originalInvoiceItemId
                    }))
                }
            },
            include: {
                items: true,
                originalInvoice: true
            }
        });

        res.status(201).json(creditNote);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Dados inválidos', details: formatZodError(error) });
        }
        console.error('Create credit note error:', error);
        res.status(500).json({ error: 'Erro ao criar nota de crédito' });
    }
});

// Get credit notes with pagination
router.get('/credit-notes', authenticate, async (req: AuthRequest, res) => {
    try {
        const {
            invoiceId,
            page = '1',
            limit = '20'
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where: any = {
            companyId: req.companyId // Multi-tenancy isolation
        };

        if (invoiceId) {
            where.originalInvoiceId = invoiceId;
        }

        // Get total count and paginated items in parallel
        const [total, creditNotes] = await Promise.all([
            prisma.creditNote.count({ where }),
            prisma.creditNote.findMany({
                where,
                include: {
                    originalInvoice: true,
                    items: true
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum
            })
        ]);

        res.json({
            data: creditNotes,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                hasMore: skip + creditNotes.length < total
            }
        });
    } catch (error) {
        console.error('Get credit notes error:', error);
        res.status(500).json({ error: 'Erro ao buscar notas de crédito' });
    }
});

// Get overdue invoices with pagination
router.get('/alerts/overdue', authenticate, async (req: AuthRequest, res) => {
    try {
        const {
            page = '1',
            limit = '20'
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const today = new Date();

        const where: any = {
            companyId: req.companyId, // Multi-tenancy isolation
            status: { in: ['sent', 'partial'] },
            dueDate: { lt: today },
            amountDue: { gt: 0 }
        };

        // Get total count and paginated items in parallel
        const [total, overdueInvoices] = await Promise.all([
            prisma.invoice.count({ where }),
            prisma.invoice.findMany({
                where,
                include: {
                    customer: { select: { id: true, name: true, phone: true } }
                },
                orderBy: { dueDate: 'asc' },
                skip,
                take: limitNum
            })
        ]);

        // Update status to overdue for those found (background optimization might be better but this works)
        for (const inv of overdueInvoices) {
            if (inv.status !== 'overdue') {
                await prisma.invoice.update({
                    where: { id: inv.id },
                    data: { status: 'overdue' }
                });
            }
        }

        res.json({
            data: overdueInvoices,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                hasMore: skip + overdueInvoices.length < total
            }
        });
    } catch (error) {
        console.error('Get overdue invoices error:', error);
        res.status(500).json({ error: 'Erro ao buscar faturas vencidas' });
    }
});

export default router;
