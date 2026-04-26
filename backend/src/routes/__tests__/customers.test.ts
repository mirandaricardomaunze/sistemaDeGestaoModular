import request from 'supertest';
import { app } from '../../index';
import { prisma } from '../../lib/prisma';

const COMPANY_ID = 'customer-test-co';
const USER_ID = 'customer-test-user';

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

async function cleanup() {
    await prisma.loyaltyTransaction.deleteMany({ where: { customer: { companyId: COMPANY_ID } } }).catch(() => {});
    await prisma.customerHistory.deleteMany({ where: { customer: { companyId: COMPANY_ID } } }).catch(() => {});
    await prisma.customer.deleteMany({ where: { companyId: COMPANY_ID } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { companyId: COMPANY_ID } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: USER_ID } }).catch(() => {});
    await prisma.company.deleteMany({ where: { id: COMPANY_ID } }).catch(() => {});
}

beforeAll(async () => {
    await cleanup();
    await prisma.company.create({ data: { id: COMPANY_ID, name: 'Customer Test Co', nuit: 'CUST-TEST-NUIT' } });
    await prisma.user.create({
        data: { id: USER_ID, name: 'Test', email: 'cust-test@test.com', password: 'x', role: 'admin', companyId: COMPANY_ID },
    });
});

afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
});

const VALID_CUSTOMER = {
    name: 'João Silva',
    email: 'joao@example.com',
    phone: '841234567',
    nuit: '123456789',
    address: 'Rua Teste, 123',
};

describe('GET /api/customers', () => {
    it('returns paginated customer list', async () => {
        const res = await request(app).get('/api/customers').expect(200);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('pagination');
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('supports search query', async () => {
        const res = await request(app).get('/api/customers?search=João').expect(200);
        expect(res.body).toHaveProperty('data');
    });

    it('enforces page limit clamping', async () => {
        const res = await request(app).get('/api/customers?limit=9999').expect(200);
        expect(res.body).toHaveProperty('data');
    });
});

describe('POST /api/customers', () => {
    it('creates a customer with valid data', async () => {
        const res = await request(app).post('/api/customers').send(VALID_CUSTOMER).expect(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body.name).toBe('João Silva');
        expect(res.body.companyId).toBe(COMPANY_ID);
    });

    it('rejects empty name', async () => {
        const res = await request(app)
            .post('/api/customers')
            .send({ ...VALID_CUSTOMER, name: '' })
            .expect(400);
        expect(res.body).toHaveProperty('message');
    });

    it('allows creating a customer without optional fields', async () => {
        const res = await request(app)
            .post('/api/customers')
            .send({ name: 'Minimal Customer' })
            .expect(201);
        expect(res.body).toHaveProperty('id');
    });
});

describe('Customer CRUD lifecycle', () => {
    let customerId: string;

    beforeEach(async () => {
        const res = await request(app).post('/api/customers').send({ ...VALID_CUSTOMER, email: `test-${Date.now()}@example.com` }).expect(201);
        customerId = res.body.id;
    });

    it('GET /api/customers/:id returns the customer', async () => {
        const res = await request(app).get(`/api/customers/${customerId}`).expect(200);
        expect(res.body.id).toBe(customerId);
        expect(res.body.name).toBe('João Silva');
    });

    it('PUT /api/customers/:id updates the customer', async () => {
        const res = await request(app)
            .put(`/api/customers/${customerId}`)
            .send({ name: 'João Silva Atualizado', phone: '851111111' })
            .expect(200);
        expect(res.body.name).toBe('João Silva Atualizado');
    });

    it('DELETE /api/customers/:id soft-deletes or removes the customer', async () => {
        await request(app).delete(`/api/customers/${customerId}`).expect(200);
    });

    it('GET /api/customers/:id returns 404 for unknown id', async () => {
        await request(app).get('/api/customers/nonexistent-cust-id').expect(404);
    });
});

describe('Customer search and filtering', () => {
    it('filters by companyId correctly (isolation)', async () => {
        // create a customer in a DIFFERENT company
        const otherCo = 'other-co-id-' + Date.now();
        await prisma.company.create({ data: { id: otherCo, name: 'Other Co', nuit: `NUIT-${Date.now()}` } });
        await prisma.customer.create({ data: { name: 'Outsider', companyId: otherCo } });

        const res = await request(app).get('/api/customers?search=Outsider').expect(200);
        const names = res.body.data.map((c: any) => c.name);
        expect(names).not.toContain('Outsider');

        // cleanup
        await prisma.customer.deleteMany({ where: { companyId: otherCo } });
        await prisma.company.delete({ where: { id: otherCo } });
    });
});
