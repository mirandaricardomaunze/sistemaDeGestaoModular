import request from 'supertest';
import { app } from '../../index';
import { prisma } from '../../lib/prisma';

const COMPANY_ID = 'invoice-test-co';
const USER_ID = 'invoice-test-user';

jest.mock('../../middleware/auth', () => ({
    authenticate: (req: any, _res: any, next: any) => {
        req.userId = USER_ID;
        req.companyId = COMPANY_ID;
        req.userName = 'Test User';
        req.userRole = 'admin';
        next();
    },
    authorize: () => (_req: any, _res: any, next: any) => next(),
    AuthRequest: {} as any,
}));

jest.mock('../../services/pdfService', () => ({
    pdfService: { generateInvoicePDF: jest.fn().mockResolvedValue(Buffer.from('PDF')) },
}));

jest.mock('../../utils/mail', () => ({
    sendInvoiceEmail: jest.fn().mockResolvedValue(undefined),
}));

async function cleanup() {
    await prisma.invoicePayment.deleteMany({ where: { invoice: { companyId: COMPANY_ID } } }).catch(() => {});
    await prisma.creditNoteItem.deleteMany({ where: { creditNote: { companyId: COMPANY_ID } } }).catch(() => {});
    await prisma.creditNote.deleteMany({ where: { companyId: COMPANY_ID } }).catch(() => {});
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

describe('GET /api/invoices', () => {
    it('returns paginated invoice list', async () => {
        const res = await request(app).get('/api/invoices').expect(200);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('pagination');
        expect(Array.isArray(res.body.data)).toBe(true);
    });
});

describe('POST /api/invoices', () => {
    it('creates invoice with valid data', async () => {
        const res = await request(app).post('/api/invoices').send(VALID_INVOICE).expect(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body.customerName).toBe('Cliente Teste');
        expect(res.body.status).toBe('draft');
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
        invoiceId = res.body.id;
    });

    it('GET /api/invoices/:id returns the invoice', async () => {
        const res = await request(app).get(`/api/invoices/${invoiceId}`).expect(200);
        expect(res.body.id).toBe(invoiceId);
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
        expect(res.body).toHaveProperty('id');
    });

    it('POST /api/invoices/:id/cancel cancels the invoice', async () => {
        await request(app).post(`/api/invoices/${invoiceId}/cancel`).expect(200);
        const check = await request(app).get(`/api/invoices/${invoiceId}`).expect(200);
        expect(check.body.status).toBe('cancelled');
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
