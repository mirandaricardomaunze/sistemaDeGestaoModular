import request from 'supertest';
import type { Request, Response, NextFunction } from 'express';
import { app } from '../../index';
import { prisma } from '../../lib/prisma';

const COMPANY_ID = 'invoice-test-co';
const USER_ID = 'invoice-test-user';

type MockReq = Request & { userId?: string; companyId?: string; userName?: string; userRole?: string };

jest.mock('../../middleware/auth', () => ({
    authenticate: (req: MockReq, _res: Response, next: NextFunction) => {
        req.userId = USER_ID;
        req.companyId = COMPANY_ID;
        req.userName = 'Test User';
        req.userRole = 'admin';
        next();
    },
    authorize: () => (_req: Request, _res: Response, next: NextFunction) => next(),
    AuthRequest: {} as unknown,
}));

jest.mock('../../services/pdfService', () => ({
    pdfService: {
        generateInvoicePDF: jest.fn().mockResolvedValue(Buffer.from('PDF')),
        generateNotePDF: jest.fn().mockResolvedValue(Buffer.from('NOTE-PDF')),
    },
}));

jest.mock('../../utils/mail', () => ({
    sendInvoiceEmail: jest.fn().mockResolvedValue(undefined),
    sendNoteEmail: jest.fn().mockResolvedValue(undefined),
    dispatchEmail: jest.fn(async (_name: string, _data: unknown, directSend: () => Promise<unknown>) => {
        await directSend();
    }),
}));

async function cleanup() {
    await prisma.invoicePayment.deleteMany({ where: { invoice: { companyId: COMPANY_ID } } }).catch(() => {});
    await prisma.creditNoteItem.deleteMany({ where: { creditNote: { companyId: COMPANY_ID } } }).catch(() => {});
    await prisma.creditNote.deleteMany({ where: { companyId: COMPANY_ID } }).catch(() => {});
    await prisma.debitNoteItem.deleteMany({ where: { debitNote: { companyId: COMPANY_ID } } }).catch(() => {});
    await prisma.debitNote.deleteMany({ where: { companyId: COMPANY_ID } }).catch(() => {});
    await prisma.invoiceItem.deleteMany({ where: { invoice: { companyId: COMPANY_ID } } }).catch(() => {});
    await prisma.invoice.deleteMany({ where: { companyId: COMPANY_ID } }).catch(() => {});
    await prisma.documentSeries.deleteMany({ where: { companyId: COMPANY_ID } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { companyId: COMPANY_ID } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: USER_ID } }).catch(() => {});
    await prisma.company.deleteMany({ where: { id: COMPANY_ID } }).catch(() => {});
}

beforeAll(async () => {
    await cleanup();
    await prisma.company.create({ data: { id: COMPANY_ID, name: 'Invoice Test Co', nuit: 'INV-TEST-NUIT' } });
    await prisma.user.create({
        data: { id: USER_ID, name: 'Test', email: 'inv-test@test.com', password: 'x', role: 'admin', companyId: COMPANY_ID },
    });
});

afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
});

const VALID_INVOICE = {
    customerName: 'Cliente Teste',
    issueDate: new Date().toISOString(),
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
    items: [{ description: 'Serviço A', quantity: 2, unitPrice: 500, vatRate: 16, vatAmount: 160, total: 1160 }],
    subtotal: 1000,
    tax: 160,
    total: 1160,
    amountDue: 1160,
    paymentMethod: 'transfer',
    status: 'draft',
};

const unwrap = <T = unknown>(body: { data?: T } | T): T => (body as { data?: T })?.data ?? body as T;

describe('GET /api/invoices', () => {
    it('returns paginated invoice list', async () => {
        const res = await request(app).get('/api/invoices').expect(200);
        const body = unwrap(res.body);
        expect(body).toHaveProperty('data');
        expect(body).toHaveProperty('pagination');
        expect(Array.isArray(body.data)).toBe(true);
    });
});

describe('POST /api/invoices', () => {
    it('creates invoice with valid data', async () => {
        const res = await request(app).post('/api/invoices').send(VALID_INVOICE).expect(201);
        const body = unwrap(res.body);
        expect(body).toHaveProperty('id');
        expect(body.customerName).toBe('Cliente Teste');
        expect(body.status).toBe('draft');
    });

    it('rejects empty items array', async () => {
        const res = await request(app)
            .post('/api/invoices')
            .send({ ...VALID_INVOICE, items: [] })
            .expect(400);
        expect(res.body).toHaveProperty('message');
    });

    it('rejects negative total', async () => {
        const res = await request(app)
            .post('/api/invoices')
            .send({ ...VALID_INVOICE, total: -100 })
            .expect(400);
        expect(res.body).toHaveProperty('message');
    });
});

describe('Invoice lifecycle', () => {
    let invoiceId: string;

    beforeEach(async () => {
        const res = await request(app).post('/api/invoices').send(VALID_INVOICE).expect(201);
        invoiceId = unwrap(res.body).id;
    });

    it('GET /api/invoices/:id returns the invoice', async () => {
        const res = await request(app).get(`/api/invoices/${invoiceId}`).expect(200);
        expect(unwrap(res.body).id).toBe(invoiceId);
    });

    it('GET /api/invoices/:id/pdf returns PDF buffer', async () => {
        const res = await request(app).get(`/api/invoices/${invoiceId}/pdf`).expect(200);
        expect(res.headers['content-type']).toMatch(/application\/pdf/);
    });

    it('POST /api/invoices/:id/payments adds a payment', async () => {
        const res = await request(app)
            .post(`/api/invoices/${invoiceId}/payments`)
            .send({ amount: 500, method: 'cash', reference: 'PAY-001', paidAt: new Date().toISOString() })
            .expect(201);
        expect(unwrap(res.body)).toHaveProperty('id');
    });

    it('POST /api/invoices/:id/cancel cancels the invoice', async () => {
        await request(app).post(`/api/invoices/${invoiceId}/cancel`).expect(200);
        const check = await request(app).get(`/api/invoices/${invoiceId}`).expect(200);
        expect(unwrap(check.body).status).toBe('cancelled');
    });

    it('GET /api/invoices/:id returns 404 for unknown id', async () => {
        await request(app).get('/api/invoices/nonexistent-id-000').expect(404);
    });
});

describe('GET /api/invoices/alerts/overdue', () => {
    it('returns overdue invoices array', async () => {
        const res = await request(app).get('/api/invoices/alerts/overdue').expect(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});

describe('GET /api/invoices/credit-notes', () => {
    it('returns paginated credit notes', async () => {
        const res = await request(app).get('/api/invoices/credit-notes').expect(200);
        expect(res.body).toHaveProperty('data');
    });
});

describe('Credit Notes — PDF + Email', () => {
    // BD remota (Supabase) tem latência ~5-8s por chamada e este describe corre
    // 3 sequenciais no beforeEach. Aumenta timeout só aqui.
    jest.setTimeout(90000);

    let invoiceId: string;
    let creditNoteId: string;

    beforeEach(async () => {
        const invRes = await request(app).post('/api/invoices').send(VALID_INVOICE).expect(201);
        const invoice = unwrap<{ id: string; items: Array<{ id: string; description: string }> }>(invRes.body);
        invoiceId = invoice.id;

        // Fetch full invoice to get item IDs (credit note requires originalInvoiceItemId)
        const fullRes = await request(app).get(`/api/invoices/${invoiceId}`).expect(200);
        const full = unwrap<{ items: Array<{ id: string; description: string }> }>(fullRes.body);
        const firstItem = full.items[0];

        const cnRes = await request(app)
            .post(`/api/invoices/${invoiceId}/credit-notes`)
            .send({
                reason: 'Devolução para teste de PDF/email',
                items: [{
                    description: firstItem.description,
                    quantity: 1,
                    unitPrice: 500,
                    total: 500,
                    originalInvoiceItemId: firstItem.id,
                }],
            })
            .expect(201);
        creditNoteId = cnRes.body.id;
    });

    it('GET /api/invoices/credit-notes/:id/pdf returns PDF buffer', async () => {
        const res = await request(app).get(`/api/invoices/credit-notes/${creditNoteId}/pdf`).expect(200);
        expect(res.headers['content-type']).toMatch(/application\/pdf/);
        expect(res.headers['content-disposition']).toMatch(/NotaCredito-/);
    });

    it('POST /api/invoices/credit-notes/:id/send-email sends email when email provided', async () => {
        const res = await request(app)
            .post(`/api/invoices/credit-notes/${creditNoteId}/send-email`)
            .send({ email: 'destino@teste.com' })
            .expect(200);
        expect(res.body.message).toMatch(/destino@teste.com/);
    });

    it('POST /api/invoices/credit-notes/:id/send-email rejects when no email available', async () => {
        const res = await request(app).post(`/api/invoices/credit-notes/${creditNoteId}/send-email`).send({}).expect(400);
        expect(res.body.message).toMatch(/email/i);
    });
});

describe('Debit Notes', () => {
    let invoiceId: string;

    beforeEach(async () => {
        const res = await request(app).post('/api/invoices').send(VALID_INVOICE).expect(201);
        invoiceId = unwrap(res.body).id;
    });

    it('GET /api/invoices/debit-notes returns paginated list', async () => {
        const res = await request(app).get('/api/invoices/debit-notes').expect(200);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('pagination');
    });

    it('POST /api/invoices/:id/debit-notes creates a debit note and raises amountDue', async () => {
        const before = unwrap<{ amountDue: number; total: number }>((await request(app).get(`/api/invoices/${invoiceId}`)).body);

        const res = await request(app)
            .post(`/api/invoices/${invoiceId}/debit-notes`)
            .send({
                reason: 'Juros de mora',
                items: [{ description: 'Juros de mora 30 dias', quantity: 1, unitPrice: 100, total: 100 }],
            })
            .expect(201);

        const dn = res.body;
        expect(dn).toHaveProperty('id');
        expect(dn.number).toMatch(/^ND-\d{4}-\d{4}$/);
        expect(dn.status).toBe('issued');
        expect(dn.subtotal).toBe(100);

        const after = unwrap<{ amountDue: number }>((await request(app).get(`/api/invoices/${invoiceId}`)).body);
        expect(Number(after.amountDue)).toBeGreaterThan(Number(before.amountDue));
    });

    it('rejects debit note when fatura está cancelada', async () => {
        await request(app).post(`/api/invoices/${invoiceId}/cancel`).expect(200);
        const res = await request(app)
            .post(`/api/invoices/${invoiceId}/debit-notes`)
            .send({ reason: 'X', items: [{ description: 'X', quantity: 1, unitPrice: 50, total: 50 }] })
            .expect(400);
        expect(res.body).toHaveProperty('message');
    });

    it('rejects debit note with empty items', async () => {
        const res = await request(app)
            .post(`/api/invoices/${invoiceId}/debit-notes`)
            .send({ reason: 'Test', items: [] })
            .expect(400);
        expect(res.body).toHaveProperty('message');
    });

    it('cancels an issued debit note and reverts amountDue', async () => {
        const before = unwrap<{ amountDue: number }>((await request(app).get(`/api/invoices/${invoiceId}`)).body);

        const dn = (await request(app)
            .post(`/api/invoices/${invoiceId}/debit-notes`)
            .send({
                reason: 'Frete adicional',
                items: [{ description: 'Frete', quantity: 1, unitPrice: 200, total: 200 }],
            })
            .expect(201)).body;

        const afterCreate = unwrap<{ amountDue: number }>((await request(app).get(`/api/invoices/${invoiceId}`)).body);
        expect(Number(afterCreate.amountDue)).toBeGreaterThan(Number(before.amountDue));

        const cancelRes = await request(app).post(`/api/invoices/debit-notes/${dn.id}/cancel`).expect(200);
        expect(cancelRes.body.status).toBe('cancelled');

        const afterCancel = unwrap<{ amountDue: number }>((await request(app).get(`/api/invoices/${invoiceId}`)).body);
        expect(Number(afterCancel.amountDue)).toBe(Number(before.amountDue));
    });

    it('rejects cancelling an already cancelled debit note', async () => {
        const dn = (await request(app)
            .post(`/api/invoices/${invoiceId}/debit-notes`)
            .send({
                reason: 'Test',
                items: [{ description: 'X', quantity: 1, unitPrice: 50, total: 50 }],
            })
            .expect(201)).body;

        await request(app).post(`/api/invoices/debit-notes/${dn.id}/cancel`).expect(200);
        const res = await request(app).post(`/api/invoices/debit-notes/${dn.id}/cancel`).expect(400);
        expect(res.body.message).toMatch(/já está cancelada/i);
    });

    it('settles an issued debit note without changing amountDue', async () => {
        const dn = (await request(app)
            .post(`/api/invoices/${invoiceId}/debit-notes`)
            .send({
                reason: 'Multa contratual',
                items: [{ description: 'Multa', quantity: 1, unitPrice: 80, total: 80 }],
            })
            .expect(201)).body;

        const before = unwrap<{ amountDue: number }>((await request(app).get(`/api/invoices/${invoiceId}`)).body);
        const settleRes = await request(app).post(`/api/invoices/debit-notes/${dn.id}/settle`).expect(200);
        expect(settleRes.body.status).toBe('settled');

        const after = unwrap<{ amountDue: number }>((await request(app).get(`/api/invoices/${invoiceId}`)).body);
        expect(Number(after.amountDue)).toBe(Number(before.amountDue));
    });

    it('refuses to cancel a settled debit note', async () => {
        const dn = (await request(app)
            .post(`/api/invoices/${invoiceId}/debit-notes`)
            .send({
                reason: 'Test',
                items: [{ description: 'X', quantity: 1, unitPrice: 30, total: 30 }],
            })
            .expect(201)).body;

        await request(app).post(`/api/invoices/debit-notes/${dn.id}/settle`).expect(200);
        const res = await request(app).post(`/api/invoices/debit-notes/${dn.id}/cancel`).expect(400);
        expect(res.body.message).toMatch(/liquidada/i);
    });

    it('GET /api/invoices/debit-notes/:id/pdf returns PDF buffer', async () => {
        const dn = (await request(app)
            .post(`/api/invoices/${invoiceId}/debit-notes`)
            .send({
                reason: 'Test PDF',
                items: [{ description: 'X', quantity: 1, unitPrice: 25, total: 25 }],
            })
            .expect(201)).body;

        const res = await request(app).get(`/api/invoices/debit-notes/${dn.id}/pdf`).expect(200);
        expect(res.headers['content-type']).toMatch(/application\/pdf/);
        expect(res.headers['content-disposition']).toMatch(/NotaDebito-/);
    });

    it('POST /api/invoices/debit-notes/:id/send-email sends email when email provided', async () => {
        const dn = (await request(app)
            .post(`/api/invoices/${invoiceId}/debit-notes`)
            .send({
                reason: 'Test Email',
                items: [{ description: 'X', quantity: 1, unitPrice: 10, total: 10 }],
            })
            .expect(201)).body;

        const res = await request(app)
            .post(`/api/invoices/debit-notes/${dn.id}/send-email`)
            .send({ email: 'destino@teste.com' })
            .expect(200);
        expect(res.body.message).toMatch(/destino@teste.com/);
    });

    it('POST /api/invoices/debit-notes/:id/send-email rejects when no email available', async () => {
        const dn = (await request(app)
            .post(`/api/invoices/${invoiceId}/debit-notes`)
            .send({
                reason: 'Test',
                items: [{ description: 'X', quantity: 1, unitPrice: 10, total: 10 }],
            })
            .expect(201)).body;

        // Sem email no body nem customer com email cadastrado → 400
        const res = await request(app).post(`/api/invoices/debit-notes/${dn.id}/send-email`).send({}).expect(400);
        expect(res.body.message).toMatch(/email/i);
    });
});
