import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import {
    createInvoiceSchema,
    updateInvoiceSchema,
    addPaymentSchema,
    creditNoteSchema,
    debitNoteSchema
} from '../validation';
import { invoicesService } from '../services/invoicesService';
import { ApiError } from '../middleware/error.middleware';
import { prisma } from '../lib/prisma';
import { pdfService } from '../services/pdfService';
import { sendInvoiceEmail, sendNoteEmail, dispatchEmail } from '../utils/mail';
import { emitToCompany } from '../lib/socket';

const router = Router();

// ============================================================================
// Invoices
// ============================================================================

router.get('/', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const result = await invoicesService.list(req.query, req.companyId);
    res.json(result);
});

router.get('/available-sources', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const sources = await invoicesService.getAvailableSources(req.companyId);
    res.json(sources);
});

router.get('/credit-notes', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const result = await invoicesService.listCreditNotes(req.query, req.companyId);
    res.json(result);
});

router.post('/credit-notes', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa nao identificada. Faca login novamente.');
    const validatedData = creditNoteSchema.parse(req.body);
    if (!validatedData.originalInvoiceId) throw ApiError.badRequest('Fatura original obrigatoria');
    const result = await invoicesService.createCreditNote(
        validatedData.originalInvoiceId,
        validatedData,
        req.companyId,
        req.userId,
        req.userName,
        req.ip
    );
    res.status(201).json(result);
});

router.get('/debit-notes', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const result = await invoicesService.listDebitNotes(req.query, req.companyId);
    res.json(result);
});

router.post('/debit-notes', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const validatedData = debitNoteSchema.parse(req.body);
    if (!validatedData.originalInvoiceId) throw ApiError.badRequest('Fatura original obrigatória');
    const result = await invoicesService.createDebitNote(
        validatedData.originalInvoiceId,
        validatedData,
        req.companyId,
        req.userId,
        req.userName,
        req.ip,
    );
    res.status(201).json(result);
});

router.get('/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const invoice = await invoicesService.getById(req.params.id, req.companyId);
    res.json(invoice);
});

router.post('/', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const validatedData = createInvoiceSchema.parse(req.body);
    const invoice = await invoicesService.create(validatedData, req.companyId, req.userName);
    emitToCompany(req.companyId, 'invoice:created', invoice);
    res.status(201).json(invoice);
});

router.put('/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const validatedData = updateInvoiceSchema.parse(req.body);
    const result = await invoicesService.update(req.params.id, validatedData, req.companyId);
    emitToCompany(req.companyId, 'invoice:updated', result);
    res.json(result);
});

router.post('/:id/print', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const invoice = await invoicesService.incrementPrintCount(req.params.id, req.companyId);
    res.json(invoice);
});

router.post('/:id/payments', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const validatedData = addPaymentSchema.parse(req.body);
    const result = await invoicesService.addPayment(req.params.id, validatedData, req.companyId);
    res.status(201).json(result);
});

router.post('/:id/cancel', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    await invoicesService.cancel(req.params.id, req.companyId, req.body?.approvalId);
    res.json({ message: 'Fatura cancelada com sucesso' });
});

// Alias: frontend calls PUT /:id/cancel
router.put('/:id/cancel', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    await invoicesService.cancel(req.params.id, req.companyId, req.body?.approvalId);
    res.json({ message: 'Fatura cancelada com sucesso' });
});

router.post('/:id/credit-notes', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const validatedData = creditNoteSchema.parse(req.body);
    const result = await invoicesService.createCreditNote(req.params.id, validatedData, req.companyId, req.userId, req.userName, req.ip);
    res.status(201).json(result);
});

router.post('/:id/debit-notes', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const validatedData = debitNoteSchema.parse(req.body);
    const result = await invoicesService.createDebitNote(req.params.id, validatedData, req.companyId, req.userId, req.userName, req.ip);
    res.status(201).json(result);
});

router.post('/debit-notes/:id/cancel', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const result = await invoicesService.cancelDebitNote(req.params.id, req.companyId, req.userId, req.userName, req.ip);
    res.json(result);
});

router.post('/debit-notes/:id/settle', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const result = await invoicesService.settleDebitNote(req.params.id, req.companyId, req.userId, req.userName, req.ip);
    res.json(result);
});

// ─── PDF e Email para Notas de Crédito ─────────────────────────────────────
async function buildCompanyInfo(companyId: string) {
    const company = await prisma.companySettings.findFirst({ where: { companyId } });
    return {
        companyName: company?.companyName,
        tradeName: company?.tradeName,
        taxId: company?.nuit,
        phone: company?.phone,
        email: company?.email,
        address: company?.address,
        ivaRate: company?.ivaRate,
        bankAccounts: company?.bankAccounts,
    };
}

router.get('/credit-notes/:id/pdf', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const note = await invoicesService.getCreditNoteById(req.params.id, req.companyId);
    const companyInfo = await buildCompanyInfo(req.companyId);
    const pdfBuffer = await pdfService.generateNotePDF(
        { ...note, issueDate: note.issueDate as string | Date, status: note.status as string | null },
        'credit',
        companyInfo,
    );
    res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="NotaCredito-${note.number}.pdf"`,
        'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
});

router.post('/credit-notes/:id/send-email', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const { email } = req.body;
    const note = await invoicesService.getCreditNoteById(req.params.id, req.companyId);

    // Tenta obter email do cliente da fatura original se não foi fornecido.
    let recipient = email as string | undefined;
    if (!recipient && note.customerId) {
        const customer = await prisma.customer.findFirst({ where: { id: note.customerId, companyId: req.companyId } });
        recipient = customer?.email ?? undefined;
    }
    if (!recipient) throw ApiError.badRequest('Email do destinatário não fornecido');

    const companyInfo = await buildCompanyInfo(req.companyId);
    const pdfBuffer = await pdfService.generateNotePDF(
        { ...note, issueDate: note.issueDate as string | Date, status: note.status as string | null },
        'credit',
        companyInfo,
    );

    const creditNotePayload = {
        to: recipient,
        type: 'credit' as const,
        note: {
            number: note.number,
            originalInvoiceNumber: note.originalInvoiceNumber,
            customerName: note.customerName,
            issueDate: note.issueDate as string | Date,
            reason: note.reason,
            subtotal: note.subtotal,
            tax: note.tax,
            total: note.total,
            items: note.items.map(i => ({ description: i.description, quantity: Number(i.quantity), unitPrice: i.unitPrice, total: i.total })),
        },
        company: {
            name: companyInfo.tradeName || companyInfo.companyName || 'Empresa',
            email: companyInfo.email ?? undefined,
            phone: companyInfo.phone ?? undefined,
            taxId: companyInfo.taxId ?? undefined,
        },
    };
    await dispatchEmail(
        'note-email',
        { ...creditNotePayload, pdfBase64: pdfBuffer.toString('base64') },
        () => sendNoteEmail({ ...creditNotePayload, pdfBuffer }),
    );

    res.json({ message: `Nota de Crédito enviada com sucesso para ${recipient}` });
});

// ─── PDF e Email para Notas de Débito ──────────────────────────────────────
router.get('/debit-notes/:id/pdf', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const note = await invoicesService.getDebitNoteById(req.params.id, req.companyId);
    const companyInfo = await buildCompanyInfo(req.companyId);
    const pdfBuffer = await pdfService.generateNotePDF(
        { ...note, issueDate: note.issueDate as string | Date, status: note.status as string | null },
        'debit',
        companyInfo,
    );
    res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="NotaDebito-${note.number}.pdf"`,
        'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
});

router.post('/debit-notes/:id/send-email', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const { email } = req.body;
    const note = await invoicesService.getDebitNoteById(req.params.id, req.companyId);

    let recipient = email as string | undefined;
    if (!recipient && note.customerId) {
        const customer = await prisma.customer.findFirst({ where: { id: note.customerId, companyId: req.companyId } });
        recipient = customer?.email ?? undefined;
    }
    if (!recipient) throw ApiError.badRequest('Email do destinatário não fornecido');

    const companyInfo = await buildCompanyInfo(req.companyId);
    const pdfBuffer = await pdfService.generateNotePDF(
        { ...note, issueDate: note.issueDate as string | Date, status: note.status as string | null },
        'debit',
        companyInfo,
    );

    const debitNotePayload = {
        to: recipient,
        type: 'debit' as const,
        note: {
            number: note.number,
            originalInvoiceNumber: note.originalInvoiceNumber,
            customerName: note.customerName,
            issueDate: note.issueDate as string | Date,
            reason: note.reason,
            subtotal: note.subtotal,
            tax: note.tax,
            total: note.total,
            items: note.items.map(i => ({ description: i.description, quantity: Number(i.quantity), unitPrice: i.unitPrice, total: i.total })),
        },
        company: {
            name: companyInfo.tradeName || companyInfo.companyName || 'Empresa',
            email: companyInfo.email ?? undefined,
            phone: companyInfo.phone ?? undefined,
            taxId: companyInfo.taxId ?? undefined,
        },
    };
    await dispatchEmail(
        'note-email',
        { ...debitNotePayload, pdfBase64: pdfBuffer.toString('base64') },
        () => sendNoteEmail({ ...debitNotePayload, pdfBuffer }),
    );

    res.json({ message: `Nota de Débito enviada com sucesso para ${recipient}` });
});

// Download PDF
router.get('/:id/pdf', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
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
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
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

    const invoicePayload = {
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
            items: (invoice.items || []).map((i) => ({
                description: i.description,
                quantity: Number(i.quantity),
                unitPrice: Number(i.unitPrice),
                total: Number(i.total),
            })),
        },
        company: companyInfo,
    };
    await dispatchEmail(
        'invoice-email',
        { ...invoicePayload, pdfBase64: pdfBuffer.toString('base64') },
        () => sendInvoiceEmail({ ...invoicePayload, pdfBuffer }),
    );

    // Mark invoice as sent if it was draft
    if (invoice.status === 'draft') {
        await prisma.invoice.update({ where: { id: req.params.id }, data: { status: 'sent' } });
    }

    res.json({ message: `Fatura enviada com sucesso para ${recipientEmail}` });
});

// Alerts
router.get('/alerts/overdue', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
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
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const invoice = await invoicesService.convertOrderToInvoice(req.params.orderId, req.companyId, req.userName);
    res.status(201).json(invoice);
});

export default router;
