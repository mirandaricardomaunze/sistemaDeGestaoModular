/**
 * Tests: pharmacy + pharmacyFinance
 */
import request from 'supertest';
import { app } from '../../index';
import { prisma } from '../../lib/prisma';

const CO  = 'ph-test-co';
const UID = 'ph-test-user';

jest.mock('../../middleware/auth', () => ({
    authenticate: (req: any, _: any, next: any) => { req.userId = UID; req.companyId = CO; req.userRole = 'admin'; req.userName = 'Test'; next(); },
    authorize: () => (_: any, __: any, next: any) => next(),
    AuthRequest: {} as any,
}));
jest.mock('../../lib/socket', () => ({ emitToCompany: jest.fn(), initSocket: jest.fn().mockReturnValue({ on: jest.fn() }) }));

let productId: string;
let medicationId: string;
let batchId: string;

async function cleanup() {
    await prisma.pharmacySaleItem.deleteMany({ where: { sale: { companyId: CO } } }).catch(() => {});
    await prisma.pharmacySale.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.prescriptionItem.deleteMany({ where: { prescription: { companyId: CO } } }).catch(() => {});
    await prisma.prescription.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.medicationBatch.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.medication.deleteMany({ where: { product: { companyId: CO } } }).catch(() => {});
    await prisma.pharmacyPartner.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.transaction.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.product.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: UID } }).catch(() => {});
    await prisma.company.deleteMany({ where: { id: CO } }).catch(() => {});
}

beforeAll(async () => {
    await cleanup();
    await prisma.company.create({ data: { id: CO, name: 'Pharmacy Test Co', nuit: `PH-${Date.now()}`, status: 'active' } });
    await prisma.user.create({ data: { id: UID, name: 'Admin', email: `ph-${Date.now()}@t.com`, password: 'x', role: 'admin', companyId: CO, isActive: true } });

    const p = await prisma.product.create({ data: { name: 'Paracetamol 500mg', code: `MED-${Date.now()}`, price: 25, unit: 'cx', companyId: CO, originModule: 'pharmacy', currentStock: 100 } });
    productId = p.id;

    const med = await prisma.medication.create({ data: { productId, companyId: CO, activeIngredient: 'Paracetamol', dosage: '500mg', dosageForm: 'comprimido', storageTemp: 'ambiente' } });
    medicationId = med.id;

    const b = await prisma.medicationBatch.create({ data: { medicationId, companyId: CO, batchNumber: `BT-${Date.now()}`, quantity: 100, quantityAvailable: 100, expiryDate: new Date(Date.now() + 365 * 86400000), costPrice: 10, sellingPrice: 25 } });
    batchId = b.id;
});

afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

// ── Dashboard ─────────────────────────────────────────────────────────────────
describe('Pharmacy Dashboard', () => {
    it('GET /api/pharmacy/dashboard returns metrics', async () => {
        const res = await request(app).get('/api/pharmacy/dashboard').expect(200);
        expect(res.body).toHaveProperty('totalMedications');
    });
});

// ── Medications ───────────────────────────────────────────────────────────────
describe('Pharmacy Medications', () => {
    it('GET /api/pharmacy/medications returns paginated list', async () => {
        const res = await request(app).get('/api/pharmacy/medications').expect(200);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('pagination');
    });

    it('GET /api/pharmacy/medications?search= filters results', async () => {
        const res = await request(app).get('/api/pharmacy/medications?search=Paracetamol').expect(200);
        expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('POST /api/pharmacy/medications requires productId', async () => {
        await request(app).post('/api/pharmacy/medications').send({ activeIngredient: 'X' }).expect(400);
    });

    it('PUT /api/pharmacy/medications/:id updates medication', async () => {
        const res = await request(app).put(`/api/pharmacy/medications/${medicationId}`).send({ posology: '1 comprimido 8/8h' }).expect(200);
        expect(res.body.posology).toBe('1 comprimido 8/8h');
    });
});

// ── Batches ───────────────────────────────────────────────────────────────────
describe('Pharmacy Batches', () => {
    it('GET /api/pharmacy/batches returns list', async () => {
        const res = await request(app).get('/api/pharmacy/batches').expect(200);
        expect(res.body).toHaveProperty('data');
    });

    it('POST /api/pharmacy/batches rejects past expiry date', async () => {
        await request(app).post('/api/pharmacy/batches').send({
            medicationId, batchNumber: 'PAST-01', quantity: 10,
            expiryDate: new Date(Date.now() - 86400000).toISOString(),
        }).expect(400);
    });

    it('POST /api/pharmacy/batches creates a batch', async () => {
        const res = await request(app).post('/api/pharmacy/batches').send({
            medicationId, batchNumber: `NEW-${Date.now()}`, quantity: 50,
            expiryDate: new Date(Date.now() + 180 * 86400000).toISOString(),
            costPrice: 8, sellingPrice: 20,
        }).expect(201);
        expect(res.body).toHaveProperty('id');
    });

    it('PUT /api/pharmacy/batches/:id updates batch', async () => {
        const res = await request(app).put(`/api/pharmacy/batches/${batchId}`).send({ sellingPrice: 30 }).expect(200);
        expect(Number(res.body.sellingPrice)).toBe(30);
    });

    it('DELETE /api/pharmacy/batches/:id rejects batch with stock', async () => {
        await request(app).delete(`/api/pharmacy/batches/${batchId}`).expect(400);
    });
});

// ── Sales ─────────────────────────────────────────────────────────────────────
describe('Pharmacy Sales', () => {
    it('GET /api/pharmacy/sales returns paginated list', async () => {
        const res = await request(app).get('/api/pharmacy/sales').expect(200);
        expect(res.body).toHaveProperty('data');
    });

    it('POST /api/pharmacy/sales rejects empty items', async () => {
        await request(app).post('/api/pharmacy/sales').send({ items: [], paymentMethod: 'cash' }).expect(400);
    });

    it('POST /api/pharmacy/sales creates a sale', async () => {
        const res = await request(app).post('/api/pharmacy/sales').send({
            items: [{ batchId, quantity: 2, unitPrice: 25 }],
            paymentMethod: 'cash',
            totalAmount: 50,
        }).expect(201);
        expect(res.body).toHaveProperty('id');
    });

    it('GET /api/pharmacy/sales/chart returns chart data', async () => {
        const res = await request(app).get('/api/pharmacy/sales/chart').expect(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/pharmacy/sales/top-products returns list', async () => {
        const res = await request(app).get('/api/pharmacy/sales/top-products').expect(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});

// ── Prescriptions ─────────────────────────────────────────────────────────────
describe('Pharmacy Prescriptions', () => {
    it('GET /api/pharmacy/prescriptions returns list', async () => {
        const res = await request(app).get('/api/pharmacy/prescriptions').expect(200);
        expect(res.body).toHaveProperty('data');
    });

    it('POST /api/pharmacy/prescriptions rejects missing prescriber', async () => {
        await request(app).post('/api/pharmacy/prescriptions').send({ items: [] }).expect(400);
    });

    it('POST /api/pharmacy/prescriptions creates prescription', async () => {
        const res = await request(app).post('/api/pharmacy/prescriptions').send({
            prescriber: 'Dr. Silva',
            prescriberCRM: '12345-MZ',
            patientName: 'Maria Teste',
            items: [{ medicationId, quantity: 2, dosageInstructions: '1 cp 8/8h', durationDays: 7 }],
        }).expect(201);
        expect(res.body).toHaveProperty('id');
    });
});

// ── Partners ──────────────────────────────────────────────────────────────────
describe('Pharmacy Partners', () => {
    let partnerId: string;

    it('GET /api/pharmacy/partners returns list', async () => {
        const res = await request(app).get('/api/pharmacy/partners').expect(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('POST /api/pharmacy/partners creates partner', async () => {
        const res = await request(app).post('/api/pharmacy/partners').send({
            name: 'Seguro Saúde', type: 'insurance', discountRate: 20,
        }).expect(201);
        expect(res.body).toHaveProperty('id');
        partnerId = res.body.id;
    });

    it('PUT /api/pharmacy/partners/:id updates partner', async () => {
        if (!partnerId) return;
        const res = await request(app).put(`/api/pharmacy/partners/${partnerId}`).send({ discountRate: 25 }).expect(200);
        expect(Number(res.body.discountRate)).toBe(25);
    });

    it('DELETE /api/pharmacy/partners/:id removes partner', async () => {
        if (!partnerId) return;
        await request(app).delete(`/api/pharmacy/partners/${partnerId}`).expect(200);
    });
});

// ── Stock Movements ───────────────────────────────────────────────────────────
describe('Pharmacy Stock Movements', () => {
    it('GET /api/pharmacy/stock-movements returns list', async () => {
        const res = await request(app).get('/api/pharmacy/stock-movements').expect(200);
        expect(Array.isArray(res.body.data ?? res.body)).toBe(true);
    });
});

// ── Finance ───────────────────────────────────────────────────────────────────
describe('PharmacyFinance', () => {
    it('GET /api/pharmacy/finance/dashboard returns data', async () => {
        const res = await request(app).get('/api/pharmacy/finance/dashboard').expect(200);
        expect(res.body).toBeDefined();
    });

    it('GET /api/pharmacy/finance/transactions returns list', async () => {
        const res = await request(app).get('/api/pharmacy/finance/transactions').expect(200);
        expect(res.body).toBeDefined();
    });

    it('POST /api/pharmacy/finance/transactions creates transaction', async () => {
        const res = await request(app).post('/api/pharmacy/finance/transactions').send({
            type: 'income', category: 'Vendas', description: 'Venda directa',
            amount: 500, date: new Date().toISOString(),
        }).expect(201);
        expect(res.body).toHaveProperty('id');
    });

    it('POST /api/pharmacy/finance/transactions rejects invalid type', async () => {
        await request(app).post('/api/pharmacy/finance/transactions').send({
            type: 'invalid', category: 'X', description: 'X', amount: 10, date: new Date().toISOString(),
        }).expect(400);
    });
});
