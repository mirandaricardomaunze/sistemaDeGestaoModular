import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import {
    createInvoiceSchema,
    updateInvoiceSchema,
    addPaymentSchema,
    creditNoteSchema
} from '../validation';
import { invoicesService } from '../services/invoicesService';
import { ApiError } from '../middleware/error.middleware';
import { prisma } from '../lib/prisma';
import { pdfService } from '../services/pdfService';
import { sendInvoiceEmail } from '../utils/mail';
import { emitToCompany } from '../lib/socket';

const router = Router();

// ============================================================================
// Invoices
// ============================================================================

router.get('/', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const result = await invoicesService.list(req.query, req.companyId);
    res.json(result);
});

router.get('/available-sources', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const sources = await invoicesService.getAvailableSources(req.companyId);
    res.json(sources);
});

router.get('/credit-notes', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const result = await invoicesService.listCreditNotes(req.query, req.companyId);
    res.json(result);
});

router.get('/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const invoice = await invoicesService.getById(req.params.id, req.companyId);
    res.json(invoice);
});

router.post('/', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const validatedData = createInvoiceSchema.parse(req.body);
    const invoice = await invoicesService.create(validatedData, req.companyId);
    emitToCompany(req.companyId, 'invoice:created', invoice);
    res.status(201).json(invoice);
});

router.put('/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const validatedData = updateInvoiceSchema.parse(req.body);
    const result = await invoicesService.update(req.params.id, validatedData, req.companyId);
    emitToCompany(req.companyId, 'invoice:updated', result);
    res.json(result);
});

router.post('/:id/print', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const invoice = await invoicesService.incrementPrintCount(req.params.id, req.companyId);
    res.json(invoice);
});

router.post('/:id/payments', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const validatedData = addPaymentSchema.parse(req.body);
    const result = await invoicesService.addPayment(req.params.id, validatedData, req.companyId);
    res.status(201).json(result);
});

router.post('/:id/cancel', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    await invoicesService.cancel(req.params.id, req.companyId);
    res.json({ message: 'Fatura cancelada com sucesso' });
});

// Alias: frontend calls PUT /:id/cancel
router.put('/:id/cancel', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    await invoicesService.cancel(req.params.id, req.companyId);
    res.json({ message: 'Fatura cancelada com sucesso' });
});

router.post('/:id/credit-notes', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const validatedData = creditNoteSchema.parse(req.body);
    const result = await invoicesService.createCreditNote(req.params.id, validatedData, req.companyId);
    res.status(201).json(result);
});

// Download PDF
router.get('/:id/pdf', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const invoice = await invoicesService.getById(req.params.id, req.companyId);
    const company = await prisma.companySettings.findFirst({ where: { companyId: req.companyId } });

    const companyInfo = {
        companyName: company?.companyName,
        tradeName: company?.tradeName,
        taxId: company?.nuit,
        phone: company?.phone,
        email: company?.email,
        address: company?.address,
        ivaRate: company?.ivaRate,
        bankAccounts: company?.bankAccounts,
    };

    const pdfBuffer = await pdfService.generateInvoicePDF(invoice, companyInfo);
    res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Fatura-${invoice.invoiceNumber}.pdf"`,
        'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
});

// Send invoice by email
router.post('/:id/send-email', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const { email } = req.body;

    const invoice = await invoicesService.getById(req.params.id, req.companyId);
    const recipientEmail = email || invoice.customerEmail;
    if (!recipientEmail) throw ApiError.badRequest('Email do destinatrio não fornecido');

    const company = await prisma.companySettings.findFirst({ where: { companyId: req.companyId } });
    const companyInfo = {
        name: company?.tradeName || company?.companyName || 'Empresa',
        email: company?.email ?? undefined,
        phone: company?.phone ?? undefined,
        taxId: company?.nuit ?? undefined,
    };

    // Generate PDF and attach it
    const pdfBuffer = await pdfService.generateInvoicePDF(invoice, companyInfo);

    await sendInvoiceEmail({
        to: recipientEmail,
        invoice: {
            invoiceNumber: invoice.invoiceNumber,
            customerName: invoice.customerName,
            issueDate: invoice.issueDate,
            dueDate: invoice.dueDate,
            subtotal: Number(invoice.subtotal),
            tax: Number(invoice.tax),
            total: Number(invoice.total),
            amountDue: Number(invoice.amountDue),
            status: invoice.status,
            items: (invoice.items || []).map((i: any) => ({
                description: i.description,
                quantity: i.quantity,
                unitPrice: Number(i.unitPrice),
                total: Number(i.total),
            })),
        },
        company: companyInfo,
        pdfBuffer,
    });

    // Mark invoice as sent if it was draft
    if (invoice.status === 'draft') {
        await prisma.invoice.update({ where: { id: req.params.id }, data: { status: 'sent' } });
    }

    res.json({ message: `Fatura enviada com sucesso para ${recipientEmail}` });
});

// Alerts
router.get('/alerts/overdue', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const today = new Date();
    const invoices = await prisma.invoice.findMany({
        where: {
            companyId: req.companyId,
            status: { in: ['sent', 'partial'] },
            dueDate: { lt: today },
            amountDue: { gt: 0 }
        },
        orderBy: { dueDate: 'asc' },
        take: 100,
    });
    res.json(invoices);
});

router.post('/convert-order/:orderId', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const invoice = await invoicesService.convertOrderToInvoice(req.params.orderId, req.companyId, req.userName);
    res.status(201).json(invoice);
});

export default router;
