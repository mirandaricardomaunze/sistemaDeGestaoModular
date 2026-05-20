/// <reference types="jest" />
/**
 * Tests: pharmacy + pharmacyFinance
 *
 * Coverage:
 *   - Dashboard, Medications, Batches, Sales, Prescriptions, Partners
 *   - Stock movements
 *   - Sale refund (restock)
 *   - Patient profile / medication history / controlled history
 *   - Drug interactions (CRUD + check)
 *   - Narcotic register (compliance)
 *   - Batch recalls (CRUD + affected sales)
 *   - Partner invoices (generate + payment)
 *   - Stock reconciliation
 *   - Reports (sales, expiring, stock, top-customers, suppliers)
 *   - Price history, alerts, reorder suggestions
 *   - Finance CRUD (PUT, DELETE)
 *   - Multi-tenant isolation
 */
import request from 'supertest';
import type { Request, Response, NextFunction } from 'express';
import { app } from '../../index';
import { prisma } from '../../lib/prisma';

const CO  = 'ph-test-co';
const UID = 'ph-test-user';

type MockReq = Request & { userId?: string; companyId?: string; userName?: string; userRole?: string };

// Auth mock — role driven by x-mock-role header (default admin) so RBAC can be tested.
jest.mock('../../middleware/auth', () => {
    const { tenantContext } = require('../../lib/context');
    return {
        authenticate: (req: MockReq, _: Response, next: NextFunction) => {
            req.userId    = (req.headers['x-mock-uid'] as string)  || UID;
            req.companyId = (req.headers['x-mock-co'] as string)   || CO;
            req.userRole  = (req.headers['x-mock-role'] as string) || 'admin';
            req.userName  = 'Test';
            tenantContext.run({ companyId: req.companyId, userId: req.userId }, () => next());
        },
        authorize: (...roles: string[]) => (req: MockReq, res: Response, next: NextFunction) => {
            if (!roles.includes(req.userRole ?? '')) {
                return res.status(403).json({ message: 'Acesso negado' });
            }
            next();
        },
        AuthRequest: {} as unknown,
    };
});
jest.mock('../../lib/socket', () => ({ emitToCompany: jest.fn(), emitToModule: jest.fn(), emitToUser: jest.fn(), getIO: jest.fn(), initSocket: jest.fn().mockReturnValue({ on: jest.fn() }) }));

// The pharmacy suite hits many tables (medications, batches, sales, recalls,
// narcotics, partner invoices, drug interactions). Hooks can take >30s on
// slower DBs — bump the global timeout up front.
jest.setTimeout(120000);

let productId: string;
let medicationId: string;
let medicationBId: string;
let batchId: string;
let sessionId: string;
let customerId: string;

const unwrap = (res: { body: any }): any => {
    const body = res.body;
    return (body?.data ?? body) as any;
};

async function cleanup() {
    // 1. Limpar referências do usuário UID para evitar violações de chave estrangeira
    try {
        await prisma.cashMovement.deleteMany({ where: { performedById: UID } });
    } catch (err) {}
    try {
        await prisma.cashSession.deleteMany({ where: { OR: [{ openedById: UID }, { closedById: UID }] } });
    } catch (err) {}
    try {
        await prisma.sale.deleteMany({ where: { userId: UID } });
    } catch (err) {}
    try {
        await prisma.employee.deleteMany({ where: { userId: UID } });
    } catch (err) {}
    try {
        await prisma.userModuleRole.deleteMany({ where: { userId: UID } });
    } catch (err) {}
    try {
        await prisma.calendarAttendee.deleteMany({ where: { userId: UID } });
    } catch (err) {}
    try {
        await prisma.calendarEvent.deleteMany({ where: { createdById: UID } });
    } catch (err) {}
    try {
        await prisma.auditLog.deleteMany({ where: { userId: UID } });
    } catch (err) {}

    // 2. Limpar tabelas filhas (leaf tables) associadas ao companyId CO
    try {
        await prisma.partnerInvoice.deleteMany({ where: { companyId: CO } });
    } catch (err) {}
    try {
        await prisma.batchRecall.deleteMany({ where: { companyId: CO } });
    } catch (err) {}
    try {
        await prisma.drugInteraction.deleteMany({ where: { companyId: CO } });
    } catch (err) {}
    try {
        await prisma.narcoticRegister.deleteMany({ where: { companyId: CO } });
    } catch (err) {}
    try {
        await prisma.pharmacySaleItem.deleteMany({ where: { sale: { companyId: CO } } });
    } catch (err) {}
    try {
        await prisma.prescriptionItem.deleteMany({ where: { prescription: { companyId: CO } } });
    } catch (err) {}
    try {
        await prisma.cashMovement.deleteMany({ where: { session: { companyId: CO } } });
    } catch (err) {}
    try {
        await prisma.stockMovement.deleteMany({ where: { companyId: CO } });
    } catch (err) {}
    try {
        await prisma.alert.deleteMany({ where: { companyId: CO } });
    } catch (err) {}
    try {
        await prisma.transaction.deleteMany({ where: { companyId: CO } });
    } catch (err) {}
    try {
        await prisma.auditLog.deleteMany({ where: { companyId: CO } });
    } catch (err) {}

    // 3. Limpar tabelas intermediárias (parent tables)
    try {
        await prisma.pharmacySale.deleteMany({ where: { companyId: CO } });
    } catch (err) {}
    try {
        await prisma.prescription.deleteMany({ where: { companyId: CO } });
    } catch (err) {}
    try {
        await prisma.medicationBatch.deleteMany({ where: { companyId: CO } });
    } catch (err) {}
    try {
        await prisma.cashSession.deleteMany({ where: { companyId: CO } });
    } catch (err) {}

    try {
        await prisma.medication.deleteMany({ where: { product: { companyId: CO } } });
    } catch (err) {}

    try {
        await prisma.pharmacyPartner.deleteMany({ where: { companyId: CO } });
    } catch (err) {}
    try {
        await prisma.customer.deleteMany({ where: { companyId: CO } });
    } catch (err) {}
    try {
        await prisma.product.deleteMany({ where: { companyId: CO } });
    } catch (err) {}

    // 4. Limpar configurações específicas de empresa se houver
    try {
        await prisma.companyModule.deleteMany({ where: { companyId: CO } });
    } catch (err) {}
    try {
        await prisma.companySettings.deleteMany({ where: { companyId: CO } });
    } catch (err) {}

    // 5. Finalmente deletar o usuário e a empresa
    try {
        await prisma.user.deleteMany({ where: { id: UID } });
    } catch (err) {}
    try {
        await prisma.company.deleteMany({ where: { id: CO } });
    } catch (err) {}
}

beforeAll(async () => {
    await cleanup();
    await prisma.company.create({ data: { id: CO, name: 'Pharmacy Test Co', nuit: `PH-${Date.now()}`, status: 'active' } });
    await prisma.user.create({ data: { id: UID, name: 'Admin', email: `ph-${Date.now()}@t.com`, password: 'x', role: 'admin', companyId: CO, isActive: true } });

    const p = await prisma.product.create({ data: { name: 'Paracetamol 500mg', code: `MED-${Date.now()}`, price: 25, unit: 'cx', companyId: CO, originModule: 'pharmacy', currentStock: 100 } });
    productId = p.id;

    const med = await prisma.medication.create({ data: { productId, companyId: CO, activeIngredient: 'Paracetamol', dosage: '500mg', pharmaceuticalForm: 'comprimido', storageTemp: 'ambiente', isControlled: false } });
    medicationId = med.id;

    // Second medication for drug interactions
    const pB = await prisma.product.create({ data: { name: 'Ibuprofeno 400mg', code: `MED-B-${Date.now()}`, price: 30, unit: 'cx', companyId: CO, originModule: 'pharmacy', currentStock: 50 } });
    const medB = await prisma.medication.create({ data: { productId: pB.id, companyId: CO, activeIngredient: 'Ibuprofeno', dosage: '400mg', pharmaceuticalForm: 'comprimido' } });
    medicationBId = medB.id;

    const b = await prisma.medicationBatch.create({ data: { medicationId, companyId: CO, batchNumber: `BT-${Date.now()}`, quantity: 100, quantityAvailable: 100, expiryDate: new Date(Date.now() + 365 * 86400000), costPrice: 10, sellingPrice: 25, supplier: 'FarmaSupply', invoiceNumber: 'INV-1' } });
    batchId = b.id;

    // Customer (paciente)
    const cust = await prisma.customer.create({ data: { code: `CST-${Date.now()}`, name: 'João Paciente', phone: '841999000', companyId: CO } });
    customerId = cust.id;

    // Cash session for POS sales
    const session = await prisma.cashSession.create({ data: { openedById: UID, companyId: CO, openingBalance: 0, status: 'open' } });
    sessionId = session.id;
});

afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

// ═════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═════════════════════════════════════════════════════════════════════════════
describe('Pharmacy Dashboard', () => {
    it('GET /api/pharmacy/dashboard returns metrics', async () => {
        const res = await request(app).get('/api/pharmacy/dashboard').expect(200);
        expect(res.body).toHaveProperty('totalMedications');
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// MEDICATIONS
// ═════════════════════════════════════════════════════════════════════════════
describe('Pharmacy Medications', () => {
    it('GET /api/pharmacy/medications returns paginated list', async () => {
        const res = await request(app).get('/api/pharmacy/medications').expect(200);
        const payload = unwrap(res);
        expect(payload).toHaveProperty('data');
        expect(payload).toHaveProperty('pagination');
    });

    it('GET /api/pharmacy/medications?search= filters results', async () => {
        const res = await request(app).get('/api/pharmacy/medications?search=Paracetamol').expect(200);
        const payload = unwrap(res);
        expect(Array.isArray(payload.data)).toBe(true);
        expect(payload.data.length).toBeGreaterThanOrEqual(1);
    });

    it('POST /api/pharmacy/medications requires productId', async () => {
        await request(app).post('/api/pharmacy/medications').send({ activeIngredient: 'X' }).expect(400);
    });

    it('PUT /api/pharmacy/medications/:id updates medication', async () => {
        const res = await request(app).put(`/api/pharmacy/medications/${medicationId}`).send({ dosage: '750mg' }).expect(200);
        const payload = unwrap(res);
        expect(payload.dosage).toBe('750mg');
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// BATCHES
// ═════════════════════════════════════════════════════════════════════════════
describe('Pharmacy Batches', () => {
    it('GET /api/pharmacy/batches returns list', async () => {
        const res = await request(app).get('/api/pharmacy/batches').expect(200);
        const payload = unwrap(res);
        expect(payload).toHaveProperty('data');
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
        const payload = unwrap(res);
        expect(payload).toHaveProperty('id');
    });

    it('PUT /api/pharmacy/batches/:id updates batch', async () => {
        const res = await request(app).put(`/api/pharmacy/batches/${batchId}`).send({ sellingPrice: 30 }).expect(200);
        expect(Number(res.body.sellingPrice)).toBe(30);
    });

    it('DELETE /api/pharmacy/batches/:id rejects batch with stock', async () => {
        await request(app).delete(`/api/pharmacy/batches/${batchId}`).expect(400);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// SALES
// ═════════════════════════════════════════════════════════════════════════════
describe('Pharmacy Sales', () => {
    it('GET /api/pharmacy/sales returns paginated list', async () => {
        const res = await request(app).get('/api/pharmacy/sales').expect(200);
        const payload = unwrap(res);
        expect(payload).toHaveProperty('data');
    });

    it('POST /api/pharmacy/sales rejects empty items', async () => {
        await request(app).post('/api/pharmacy/sales').send({
            items: [], paymentMethod: 'cash', sessionId,
        }).expect(400);
    });

    it('POST /api/pharmacy/sales creates a sale', async () => {
        const res = await request(app).post('/api/pharmacy/sales').send({
            items: [{ batchId, quantity: 2 }],
            paymentMethod: 'cash',
            sessionId,
        }).expect(201);
        const payload = unwrap(res);
        expect(payload).toHaveProperty('id');
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

// ═════════════════════════════════════════════════════════════════════════════
// SALE REFUND
// ═════════════════════════════════════════════════════════════════════════════
describe('Pharmacy Sale Refund', () => {
    let saleId: string;

    beforeAll(async () => {
        // Create a sale via Prisma so we can test refund deterministically
        const sale = await prisma.pharmacySale.create({
            data: {
                saleNumber: `PH-REF-${Date.now()}`,
                companyId: CO,
                customerName: 'Cliente Refund',
                subtotal: 50, total: 50, soldBy: 'Test',
                items: { create: [{ batchId, productName: 'Paracetamol 500mg', quantity: 2, unitPrice: 25, total: 50 }] }
            }
        });
        saleId = sale.id;
        // Bring batch quantity down so refund visibly increments
        await prisma.medicationBatch.update({ where: { id: batchId }, data: { quantityAvailable: { decrement: 2 } } });
    });

    it('POST /sales/:id/refund restores stock and marks sale refunded', async () => {
        const res = await request(app)
            .post(`/api/pharmacy/sales/${saleId}/refund`)
            .send({ reason: 'Cliente desistiu' })
            .expect(200);
        expect(res.body).toHaveProperty('message');

        const sale = await prisma.pharmacySale.findUnique({ where: { id: saleId } });
        expect(sale?.status).toBe('refunded');
    });

    it('POST /sales/:id/refund rejects already-refunded sale', async () => {
        await request(app)
            .post(`/api/pharmacy/sales/${saleId}/refund`)
            .send({ reason: 'Tentando de novo' })
            .expect(400);
    });

    it('POST /sales/:id/refund returns 404 for unknown sale', async () => {
        await request(app)
            .post('/api/pharmacy/sales/nonexistent-id/refund')
            .send({ reason: 'X' })
            .expect(404);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// PRESCRIPTIONS
// ═════════════════════════════════════════════════════════════════════════════
describe('Pharmacy Prescriptions', () => {
    let createdPrescriptionId: string;
    let createdPrescriptionNo: string;

    it('GET /api/pharmacy/prescriptions returns list', async () => {
        const res = await request(app).get('/api/pharmacy/prescriptions').expect(200);
        const payload = unwrap(res);
        expect(payload).toHaveProperty('data');
    });

    it('POST /api/pharmacy/prescriptions rejects missing prescriber', async () => {
        await request(app).post('/api/pharmacy/prescriptions').send({ items: [] }).expect(400);
    });

    it('POST /api/pharmacy/prescriptions creates prescription', async () => {
        const res = await request(app).post('/api/pharmacy/prescriptions').send({
            patientName: 'Maria Teste',
            prescriberName: 'Dr. Silva',
            prescriberCRM: '12345-MZ',
            prescriptionDate: new Date().toISOString(),
            items: [
                { medicationName: 'Paracetamol 500mg', medicationId, quantity: 2, posology: '1 cp 8/8h', duration: '7 dias' },
            ],
        }).expect(201);
        const payload = unwrap(res);
        expect(payload).toHaveProperty('id');
        createdPrescriptionId = payload.id;
        createdPrescriptionNo = payload.prescriptionNo;
    });

    it('GET /api/pharmacy/prescriptions/lookup finds by number', async () => {
        const res = await request(app).get(`/api/pharmacy/prescriptions/lookup?number=${createdPrescriptionNo}`).expect(200);
        expect(res.body.id).toBe(createdPrescriptionId);
    });

    it('GET /api/pharmacy/prescriptions/lookup returns 404 for unknown number', async () => {
        await request(app).get('/api/pharmacy/prescriptions/lookup?number=PRE-NONE').expect(404);
    });

    it('PUT /api/pharmacy/prescriptions/:id/status updates status', async () => {
        const res = await request(app)
            .put(`/api/pharmacy/prescriptions/${createdPrescriptionId}/status`)
            .send({ status: 'cancelled' })
            .expect(200);
        expect(res.body.status).toBe('cancelled');
    });

    it('PUT /api/pharmacy/prescriptions/:id/status returns 404 for unknown id', async () => {
        await request(app)
            .put('/api/pharmacy/prescriptions/nope/status')
            .send({ status: 'cancelled' })
            .expect(404);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// PARTNERS
// ═════════════════════════════════════════════════════════════════════════════
describe('Pharmacy Partners', () => {
    let partnerId: string;

    it('GET /api/pharmacy/partners returns list', async () => {
        const res = await request(app).get('/api/pharmacy/partners').expect(200);
        const payload = unwrap(res);
        expect(Array.isArray(payload)).toBe(true);
    });

    it('POST /api/pharmacy/partners creates partner', async () => {
        const res = await request(app).post('/api/pharmacy/partners').send({
            name: 'Seguro Saúde', category: 'Private Insurance', coveragePercentage: 20,
        }).expect(201);
        const payload = unwrap(res);
        expect(payload).toHaveProperty('id');
        partnerId = payload.id;
    });

    it('PUT /api/pharmacy/partners/:id updates partner', async () => {
        if (!partnerId) return;
        const res = await request(app).put(`/api/pharmacy/partners/${partnerId}`).send({ coveragePercentage: 25 }).expect(200);
        const payload = unwrap(res);
        expect(Number(payload.coveragePercentage)).toBe(25);
    });

    it('DELETE /api/pharmacy/partners/:id removes partner', async () => {
        if (!partnerId) return;
        await request(app).delete(`/api/pharmacy/partners/${partnerId}`).expect(200);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// STOCK MOVEMENTS
// ═════════════════════════════════════════════════════════════════════════════
describe('Pharmacy Stock Movements', () => {
    it('GET /api/pharmacy/stock-movements returns list', async () => {
        const res = await request(app).get('/api/pharmacy/stock-movements').expect(200);
        const payload = unwrap(res);
        expect(Array.isArray(payload.data ?? payload)).toBe(true);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// PATIENT PROFILE / HISTORY
// ═════════════════════════════════════════════════════════════════════════════
describe('Pharmacy Patient Profile', () => {
    it('GET /patients/:id/profile returns profile fields', async () => {
        const res = await request(app).get(`/api/pharmacy/patients/${customerId}/profile`).expect(200);
        expect(res.body.id).toBe(customerId);
        expect(res.body).toHaveProperty('allergies');
    });

    it('PUT /patients/:id/profile updates allergies and chronic conditions', async () => {
        const res = await request(app)
            .put(`/api/pharmacy/patients/${customerId}/profile`)
            .send({ allergies: ['Penicilina'], chronicConditions: ['Hipertensão'], bloodType: 'O+', emergencyContact: '841000111' })
            .expect(200);
        expect(res.body).toHaveProperty('message');

        const updated = await prisma.customer.findUnique({ where: { id: customerId } });
        expect(updated?.allergies).toContain('Penicilina');
        expect(updated?.bloodType).toBe('O+');
    });

    it('PUT /patients/:id/profile returns 404 for unknown patient', async () => {
        await request(app)
            .put('/api/pharmacy/patients/nope/profile')
            .send({ allergies: ['X'] })
            .expect(404);
    });

    it('GET /patients/:id/medication-history returns paginated history', async () => {
        const res = await request(app).get(`/api/pharmacy/patients/${customerId}/medication-history`).expect(200);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('pagination');
    });

    it('GET /patients/:id/controlled-history returns list', async () => {
        const res = await request(app).get(`/api/pharmacy/patients/${customerId}/controlled-history`).expect(200);
        const payload = unwrap(res);
        expect(Array.isArray(payload)).toBe(true);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// DRUG INTERACTIONS
// ═════════════════════════════════════════════════════════════════════════════
describe('Pharmacy Drug Interactions', () => {
    let interactionId: string;

    it('POST /interactions creates an interaction', async () => {
        const res = await request(app)
            .post('/api/pharmacy/interactions')
            .send({
                medicationAId: medicationId, medicationBId: medicationBId,
                severity: 'high', description: 'Aumenta risco de sangramento',
                mechanism: 'Inibição plaquetária aditiva', management: 'Evitar combinação',
            })
            .expect(201);
        expect(res.body).toHaveProperty('id');
        interactionId = res.body.id;
    });

    it('POST /interactions rejects missing fields', async () => {
        await request(app).post('/api/pharmacy/interactions').send({}).expect(400);
    });

    it('POST /interactions rejects duplicate pair', async () => {
        await request(app)
            .post('/api/pharmacy/interactions')
            .send({
                medicationAId: medicationId, medicationBId: medicationBId,
                severity: 'high', description: 'Duplicada',
            })
            .expect(400);
    });

    it('GET /interactions returns list', async () => {
        const res = await request(app).get('/api/pharmacy/interactions').expect(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /interactions?medicationId= filters', async () => {
        const res = await request(app).get(`/api/pharmacy/interactions?medicationId=${medicationId}`).expect(200);
        expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('POST /interactions/check returns interactions for a cart', async () => {
        const res = await request(app)
            .post('/api/pharmacy/interactions/check')
            .send({ medicationIds: [medicationId, medicationBId] })
            .expect(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('POST /interactions/check with single med returns empty', async () => {
        const res = await request(app)
            .post('/api/pharmacy/interactions/check')
            .send({ medicationIds: [medicationId] })
            .expect(200);
        expect(res.body).toEqual([]);
    });

    it('DELETE /interactions/:id removes', async () => {
        await request(app).delete(`/api/pharmacy/interactions/${interactionId}`).expect(200);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// NARCOTIC REGISTER (compliance)
// ═════════════════════════════════════════════════════════════════════════════
describe('Pharmacy Narcotic Register', () => {
    let registerId: string;

    it('POST /narcotic-register creates entry and computes closingBalance', async () => {
        const res = await request(app).post('/api/pharmacy/narcotic-register').send({
            registerDate: new Date().toISOString(),
            medicationId,
            medicationName: 'Morfina',
            batchNumber: 'NCT-001',
            openingBalance: 100,
            received: 50,
            dispensed: 30,
            returned: 0,
            destroyed: 0,
        }).expect(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body.closingBalance).toBe(120); // 100 + 50 - 30
        expect(res.body.discrepancy).toBe(0);
        registerId = res.body.id;
    });

    it('POST /narcotic-register flags discrepancy when closingBalance would be negative', async () => {
        const res = await request(app).post('/api/pharmacy/narcotic-register').send({
            registerDate: new Date().toISOString(),
            medicationId,
            medicationName: 'Morfina',
            batchNumber: 'NCT-002',
            openingBalance: 10,
            dispensed: 50,
        }).expect(201);
        expect(res.body.closingBalance).toBe(0);
        expect(res.body.discrepancy).toBe(40);
    });

    it('GET /narcotic-register returns paginated list', async () => {
        const res = await request(app).get('/api/pharmacy/narcotic-register').expect(200);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('pagination');
    });

    it('PUT /narcotic-register/:id updates entry and recomputes balance', async () => {
        const res = await request(app)
            .put(`/api/pharmacy/narcotic-register/${registerId}`)
            .send({ dispensed: 50 })
            .expect(200);
        expect(res.body.closingBalance).toBe(100); // 100 + 50 - 50
    });

    it('PUT /narcotic-register/:id returns 404 for unknown id', async () => {
        await request(app)
            .put('/api/pharmacy/narcotic-register/nope')
            .send({ dispensed: 0 })
            .expect(404);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// BATCH RECALLS
// ═════════════════════════════════════════════════════════════════════════════
describe('Pharmacy Batch Recalls', () => {
    let recallId: string;

    it('POST /recalls creates a recall', async () => {
        const res = await request(app).post('/api/pharmacy/recalls').send({
            medicationId,
            batchNumbers: ['BT-RECALL-1'],
            reason: 'Contaminação detectada',
            severity: 'voluntary',
            recallDate: new Date().toISOString(),
        }).expect(201);
        expect(res.body).toHaveProperty('recallNumber');
        recallId = res.body.id;
    });

    it('POST /recalls rejects missing fields', async () => {
        await request(app).post('/api/pharmacy/recalls').send({}).expect(400);
    });

    it('GET /recalls returns paginated list', async () => {
        const res = await request(app).get('/api/pharmacy/recalls').expect(200);
        expect(res.body).toHaveProperty('data');
    });

    it('GET /recalls?status=active filters', async () => {
        const res = await request(app).get('/api/pharmacy/recalls?status=active').expect(200);
        for (const r of res.body.data) expect(r.status).toBe('active');
    });

    it('GET /recalls/:id/affected-sales returns list', async () => {
        const res = await request(app).get(`/api/pharmacy/recalls/${recallId}/affected-sales`).expect(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('PUT /recalls/:id/resolve marks resolved', async () => {
        const res = await request(app)
            .put(`/api/pharmacy/recalls/${recallId}/resolve`)
            .send({ recoveredUnits: 50, actionTaken: 'Stock devolvido ao fornecedor' })
            .expect(200);
        expect(res.body.status).toBe('resolved');
        expect(res.body.recoveredUnits).toBe(50);
    });

    it('PUT /recalls/:id/resolve returns 404 for unknown id', async () => {
        await request(app)
            .put('/api/pharmacy/recalls/nope/resolve')
            .send({ recoveredUnits: 0 })
            .expect(404);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// PARTNER INVOICES (insurance billing)
// ═════════════════════════════════════════════════════════════════════════════
describe('Pharmacy Partner Invoices', () => {
    let partnerId: string;

    beforeAll(async () => {
        const partner = await prisma.pharmacyPartner.create({ data: { name: 'Convênio Teste', category: 'Insurance', coveragePercentage: 50, companyId: CO } });
        partnerId = partner.id;
        // Sale with insurance amount tied to this partner
        await prisma.pharmacySale.create({
            data: {
                saleNumber: `PH-PI-${Date.now()}`,
                companyId: CO,
                customerName: 'Convênio Cliente',
                partnerId,
                subtotal: 200, total: 100, insuranceAmount: 100, soldBy: 'Test',
            }
        });
    });

    it('GET /partner-invoices returns paginated list', async () => {
        const res = await request(app).get('/api/pharmacy/partner-invoices').expect(200);
        expect(res.body).toHaveProperty('data');
    });

    it('POST /partner-invoices/generate aggregates sales', async () => {
        const res = await request(app)
            .post('/api/pharmacy/partner-invoices/generate')
            .send({
                partnerId,
                periodStart: new Date(Date.now() - 7 * 86400000).toISOString(),
                periodEnd: new Date().toISOString(),
                dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
            })
            .expect(201);
        expect(res.body).toHaveProperty('invoiceNumber');
        expect(Number(res.body.totalAmount)).toBeGreaterThan(0);

        const invoiceId = res.body.id;

        const payRes = await request(app)
            .put(`/api/pharmacy/partner-invoices/${invoiceId}/payment`)
            .send({ amount: 100 })
            .expect(200);
        expect(payRes.body.status).toBe('paid');
    });

    it('POST /partner-invoices/generate rejects empty period', async () => {
        await request(app)
            .post('/api/pharmacy/partner-invoices/generate')
            .send({
                partnerId,
                periodStart: new Date('2000-01-01').toISOString(),
                periodEnd: new Date('2000-01-02').toISOString(),
            })
            .expect(400);
    });

    it('POST /partner-invoices/generate rejects missing partnerId', async () => {
        await request(app)
            .post('/api/pharmacy/partner-invoices/generate')
            .send({ periodStart: new Date().toISOString(), periodEnd: new Date().toISOString() })
            .expect(400);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// STOCK RECONCILIATION
// ═════════════════════════════════════════════════════════════════════════════
describe('Pharmacy Stock Reconciliation', () => {
    it('GET /stock-reconciliation/snapshot returns medications with batches', async () => {
        const res = await request(app).get('/api/pharmacy/stock-reconciliation/snapshot').expect(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body[0]).toHaveProperty('systemStock');
        expect(res.body[0]).toHaveProperty('batches');
    });

    it('POST /stock-reconciliation adjusts stock and logs movement', async () => {
        const before = await prisma.product.findUnique({ where: { id: productId } });
        const physicalCount = (before!.currentStock || 0) + 5;

        const res = await request(app)
            .post('/api/pharmacy/stock-reconciliation')
            .send({
                counts: [{ medicationId, physicalCount, systemStock: before!.currentStock }],
                notes: 'Contagem mensal',
            })
            .expect(200);

        expect(res.body).toHaveProperty('adjustedCount');
        expect(res.body.adjustedCount).toBe(1);

        const after = await prisma.product.findUnique({ where: { id: productId } });
        expect(after!.currentStock).toBe(physicalCount);

        // Audit movement should exist
        const movement = await prisma.stockMovement.findFirst({
            where: { productId, movementType: 'adjustment', companyId: CO },
            orderBy: { createdAt: 'desc' }
        });
        expect(movement).not.toBeNull();
    });

    it('POST /stock-reconciliation skips items with zero variance', async () => {
        const product = await prisma.product.findUnique({ where: { id: productId } });
        const res = await request(app)
            .post('/api/pharmacy/stock-reconciliation')
            .send({ counts: [{ medicationId, physicalCount: product!.currentStock, systemStock: product!.currentStock }] })
            .expect(200);
        expect(res.body.adjustedCount).toBe(0);
    });

    it('POST /stock-reconciliation rejects missing counts', async () => {
        await request(app).post('/api/pharmacy/stock-reconciliation').send({}).expect(400);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// REPORTS
// ═════════════════════════════════════════════════════════════════════════════
describe('Pharmacy Reports', () => {
    it('GET /reports/sales returns enriched sales with margin summary', async () => {
        const res = await request(app).get('/api/pharmacy/reports/sales').expect(200);
        expect(res.body).toHaveProperty('summary');
        expect(res.body.summary).toHaveProperty('totalRevenue');
        expect(res.body.summary).toHaveProperty('margin');
    });

    it('GET /reports/expiring returns batches near expiry', async () => {
        const res = await request(app).get('/api/pharmacy/reports/expiring?days=400').expect(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /reports/stock returns stock summary', async () => {
        const res = await request(app).get('/api/pharmacy/reports/stock').expect(200);
        expect(res.body).toHaveProperty('summary');
        expect(res.body.summary).toHaveProperty('totalStock');
    });

    it('GET /reports/stock?lowStock=true filters low-stock only', async () => {
        const res = await request(app).get('/api/pharmacy/reports/stock?lowStock=true').expect(200);
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /reports/top-customers returns ranking', async () => {
        const res = await request(app).get('/api/pharmacy/reports/top-customers').expect(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /reports/suppliers returns supplier analysis', async () => {
        const res = await request(app).get('/api/pharmacy/reports/suppliers').expect(200);
        expect(Array.isArray(res.body)).toBe(true);
        if (res.body.length > 0) {
            expect(res.body[0]).toHaveProperty('totalCost');
            expect(res.body[0]).toHaveProperty('medicationCount');
        }
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// PRICE HISTORY
// ═════════════════════════════════════════════════════════════════════════════
describe('Pharmacy Price History', () => {
    it('GET /medications/:id/price-history returns batch-derived history', async () => {
        const res = await request(app).get(`/api/pharmacy/medications/${medicationId}/price-history`).expect(200);
        expect(Array.isArray(res.body)).toBe(true);
        if (res.body.length > 0) {
            expect(res.body[0]).toHaveProperty('costPrice');
            expect(res.body[0]).toHaveProperty('sellingPrice');
            expect(res.body[0]).toHaveProperty('margin');
        }
    });

    it('GET /medications/:id/price-history returns 404 for unknown medication', async () => {
        await request(app).get('/api/pharmacy/medications/nope/price-history').expect(404);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// INTELLIGENT ALERTS
// ═════════════════════════════════════════════════════════════════════════════
describe('Pharmacy Alerts', () => {
    it('GET /alerts returns categorized alerts with summary', async () => {
        const res = await request(app).get('/api/pharmacy/alerts').expect(200);
        expect(res.body).toHaveProperty('alerts');
        expect(res.body).toHaveProperty('summary');
        expect(res.body.summary).toHaveProperty('critical');
        expect(res.body.summary).toHaveProperty('warning');
        expect(res.body.summary).toHaveProperty('info');
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// REORDER SUGGESTIONS
// ═════════════════════════════════════════════════════════════════════════════
describe('Pharmacy Reorder Suggestions', () => {
    it('GET /reorder-suggestions returns suggestions with cost estimate', async () => {
        const res = await request(app).get('/api/pharmacy/reorder-suggestions').expect(200);
        expect(res.body).toHaveProperty('suggestions');
        expect(res.body).toHaveProperty('totalEstimatedCost');
        expect(res.body).toHaveProperty('count');
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// FINANCE
// ═════════════════════════════════════════════════════════════════════════════
describe('Pharmacy Finance', () => {
    let txId: string;

    it('GET /finance/dashboard returns data', async () => {
        const res = await request(app).get('/api/pharmacy/finance/dashboard').expect(200);
        expect(res.body).toBeDefined();
    });

    it('GET /finance/transactions returns list', async () => {
        const res = await request(app).get('/api/pharmacy/finance/transactions').expect(200);
        expect(res.body).toBeDefined();
    });

    it('POST /finance/transactions creates transaction', async () => {
        const res = await request(app).post('/api/pharmacy/finance/transactions').send({
            type: 'income', category: 'Vendas', description: 'Venda directa',
            amount: 500, date: new Date().toISOString(),
        }).expect(201);
        expect(res.body).toHaveProperty('id');
        txId = res.body.id;
    });

    it('POST /finance/transactions rejects invalid type', async () => {
        await request(app).post('/api/pharmacy/finance/transactions').send({
            type: 'invalid', category: 'X', description: 'X', amount: 10, date: new Date().toISOString(),
        }).expect(400);
    });

    it('PUT /finance/transactions/:id updates', async () => {
        const res = await request(app)
            .put(`/api/pharmacy/finance/transactions/${txId}`)
            .send({ description: 'Atualizada', amount: 999 })
            .expect(200);
        expect(res.body.description).toBe('Atualizada');
        expect(Number(res.body.amount)).toBe(999);
    });

    it('PUT /finance/transactions/:id returns 404 for unknown id', async () => {
        await request(app)
            .put('/api/pharmacy/finance/transactions/nope')
            .send({ amount: 10 })
            .expect(404);
    });

    it('DELETE /finance/transactions/:id removes', async () => {
        await request(app).delete(`/api/pharmacy/finance/transactions/${txId}`).expect(200);
    });

    it('DELETE /finance/transactions/:id returns 404 for unknown id', async () => {
        await request(app).delete('/api/pharmacy/finance/transactions/nope').expect(404);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// MULTI-TENANT ISOLATION
// ═════════════════════════════════════════════════════════════════════════════
describe('Pharmacy multi-tenant isolation', () => {
    it('medications, batches, sales, recalls and narcotic registers from another company are not visible', async () => {
        const otherCo = `other-ph-co-${Date.now()}`;
        await prisma.company.create({ data: { id: otherCo, name: 'Other Pharmacy', nuit: `OPH-${Date.now()}` } });

        // Other company resources
        const otherProduct = await prisma.product.create({
            data: { name: 'Outsider Drug', code: `OUT-${Date.now()}`, price: 1, unit: 'cx', companyId: otherCo, originModule: 'pharmacy', currentStock: 1 }
        });
        const otherMed = await prisma.medication.create({ data: { productId: otherProduct.id, companyId: otherCo, activeIngredient: 'X', dosage: '1mg' } });
        const otherBatch = await prisma.medicationBatch.create({ data: { medicationId: otherMed.id, companyId: otherCo, batchNumber: 'OUT-BT-1', quantity: 10, quantityAvailable: 10, expiryDate: new Date(Date.now() + 365 * 86400000), costPrice: 0, sellingPrice: 1 } });
        const otherSale = await prisma.pharmacySale.create({ data: { saleNumber: `PH-OUT-${Date.now()}`, companyId: otherCo, customerName: 'X', subtotal: 1, total: 1, soldBy: 'X' } });
        const otherRecall = await prisma.batchRecall.create({ data: { recallNumber: `REC-OUT-${Date.now()}`, medicationId: otherMed.id, batchNumbers: ['OUT-1'], reason: 'X', severity: 'voluntary', issuedBy: 'X', recallDate: new Date(), companyId: otherCo } });
        const otherNarc = await prisma.narcoticRegister.create({ data: { registerDate: new Date(), medicationId: otherMed.id, medicationName: 'X', batchNumber: 'OUT', openingBalance: 0, closingBalance: 0, verifiedBy: 'X', companyId: otherCo } });

        // Cross-tenant requests authenticated as CO must NOT see otherCo data
        const meds = await request(app).get('/api/pharmacy/medications').expect(200);
        const medIds = unwrap(meds).data.map((m) => m.id);
        expect(medIds).not.toContain(otherMed.id);

        const batches = await request(app).get('/api/pharmacy/batches').expect(200);
        const batchIds = unwrap(batches).data.map((b) => b.id);
        expect(batchIds).not.toContain(otherBatch.id);

        const sales = await request(app).get('/api/pharmacy/sales').expect(200);
        const saleIds = unwrap(sales).data.map((s) => s.id);
        expect(saleIds).not.toContain(otherSale.id);

        const recalls = await request(app).get('/api/pharmacy/recalls').expect(200);
        const recallIds = ((recalls.body.data || []) as Array<{ id: string }>).map((r) => r.id);
        expect(recallIds).not.toContain(otherRecall.id);

        const narc = await request(app).get('/api/pharmacy/narcotic-register').expect(200);
        const narcIds = ((narc.body.data || []) as Array<{ id: string }>).map((n) => n.id);
        expect(narcIds).not.toContain(otherNarc.id);

        // Cleanup
        await prisma.narcoticRegister.delete({ where: { id: otherNarc.id } });
        await prisma.batchRecall.delete({ where: { id: otherRecall.id } });
        await prisma.pharmacySale.delete({ where: { id: otherSale.id } });
        await prisma.medicationBatch.delete({ where: { id: otherBatch.id } });
        await prisma.medication.delete({ where: { id: otherMed.id } });
        await prisma.product.delete({ where: { id: otherProduct.id } });
        await prisma.company.delete({ where: { id: otherCo } });
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// RBAC — cashier and (where stricter) operator must be blocked from sensitive endpoints
// ═════════════════════════════════════════════════════════════════════════════
describe('Pharmacy RBAC', () => {
    // Reads protected with STAFF_ROLES — cashier must get 403
    describe('Cashier is blocked from compliance/financial reads', () => {
        const STAFF_PROTECTED_GETS = [
            '/api/pharmacy/narcotic-register',
            '/api/pharmacy/recalls',
            '/api/pharmacy/partner-invoices',
            '/api/pharmacy/stock-reconciliation/snapshot',
            '/api/pharmacy/reports/sales',
            '/api/pharmacy/reports/expiring',
            '/api/pharmacy/reports/stock',
            '/api/pharmacy/reports/top-customers',
            '/api/pharmacy/reports/suppliers',
            '/api/pharmacy/alerts',
            '/api/pharmacy/reorder-suggestions',
            '/api/pharmacy/finance/dashboard',
            '/api/pharmacy/finance/transactions',
        ];
        for (const url of STAFF_PROTECTED_GETS) {
            it(`GET ${url} returns 403 for cashier`, async () => {
                await request(app).get(url).set('x-mock-role', 'cashier').expect(403);
            });
        }
    });

    // Writes protected with MANAGER_ROLES — operator (and cashier) must get 403
    describe('Operator is blocked from manager-only writes', () => {
        it('DELETE /medications/:id', async () => {
            await request(app).delete(`/api/pharmacy/medications/${medicationId}`).set('x-mock-role', 'operator').expect(403);
        });

        it('POST /sales/:id/refund', async () => {
            await request(app).post('/api/pharmacy/sales/any/refund').send({ reason: 'X' }).set('x-mock-role', 'operator').expect(403);
        });

        it('POST /interactions', async () => {
            await request(app).post('/api/pharmacy/interactions').send({}).set('x-mock-role', 'operator').expect(403);
        });

        it('DELETE /interactions/:id', async () => {
            await request(app).delete('/api/pharmacy/interactions/x').set('x-mock-role', 'operator').expect(403);
        });

        it('POST /narcotic-register', async () => {
            await request(app).post('/api/pharmacy/narcotic-register').send({}).set('x-mock-role', 'operator').expect(403);
        });

        it('PUT /narcotic-register/:id', async () => {
            await request(app).put('/api/pharmacy/narcotic-register/x').send({}).set('x-mock-role', 'operator').expect(403);
        });

        it('POST /recalls', async () => {
            await request(app).post('/api/pharmacy/recalls').send({}).set('x-mock-role', 'operator').expect(403);
        });

        it('PUT /recalls/:id/resolve', async () => {
            await request(app).put('/api/pharmacy/recalls/x/resolve').send({}).set('x-mock-role', 'operator').expect(403);
        });

        it('POST /partner-invoices/generate', async () => {
            await request(app).post('/api/pharmacy/partner-invoices/generate').send({}).set('x-mock-role', 'operator').expect(403);
        });

        it('PUT /partner-invoices/:id/payment', async () => {
            await request(app).put('/api/pharmacy/partner-invoices/x/payment').send({ amount: 1 }).set('x-mock-role', 'operator').expect(403);
        });

        it('POST /stock-reconciliation', async () => {
            await request(app).post('/api/pharmacy/stock-reconciliation').send({}).set('x-mock-role', 'operator').expect(403);
        });

        it('PUT /finance/transactions/:id', async () => {
            await request(app).put('/api/pharmacy/finance/transactions/x').send({}).set('x-mock-role', 'operator').expect(403);
        });

        it('DELETE /finance/transactions/:id', async () => {
            await request(app).delete('/api/pharmacy/finance/transactions/x').set('x-mock-role', 'operator').expect(403);
        });
    });

    // Operator is allowed on STAFF_ROLES protected endpoints (cashier blocked, operator OK)
    describe('Operator is allowed on staff-protected reads', () => {
        it('GET /reports/sales returns 200 for operator', async () => {
            await request(app).get('/api/pharmacy/reports/sales').set('x-mock-role', 'operator').expect(200);
        });

        it('GET /alerts returns 200 for operator', async () => {
            await request(app).get('/api/pharmacy/alerts').set('x-mock-role', 'operator').expect(200);
        });

        it('GET /finance/dashboard returns 200 for operator', async () => {
            await request(app).get('/api/pharmacy/finance/dashboard').set('x-mock-role', 'operator').expect(200);
        });
    });
});
