/**
 * Tests: hospitality + hospitalityFinance + hospitalityChannels + hospitalityDashboard
 */
import request from 'supertest';
import { app } from '../../index';
import { prisma } from '../../lib/prisma';

const CO  = 'ht-test-co';
const UID = 'ht-test-user';

jest.mock('../../middleware/auth', () => ({
    authenticate: (req: any, _: any, next: any) => { req.userId = UID; req.companyId = CO; req.userRole = 'admin'; req.userName = 'Test'; next(); },
    authorize: () => (_: any, __: any, next: any) => next(),
    AuthRequest: {} as any,
}));
jest.mock('../../lib/socket', () => ({ emitToCompany: jest.fn(), initSocket: jest.fn().mockReturnValue({ on: jest.fn() }) }));

let roomId: string;

async function cleanup() {
    await prisma.bookingConsumption.deleteMany({ where: { booking: { companyId: CO } } }).catch(() => {});
    await prisma.booking.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.housekeepingTask.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.room.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.transaction.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: UID } }).catch(() => {});
    await prisma.company.deleteMany({ where: { id: CO } }).catch(() => {});
}

beforeAll(async () => {
    await cleanup();
    await prisma.company.create({ data: { id: CO, name: 'Hotel Test', nuit: `HT-${Date.now()}`, status: 'active' } });
    await prisma.user.create({ data: { id: UID, name: 'Admin', email: `ht-${Date.now()}@t.com`, password: 'x', role: 'admin', companyId: CO, isActive: true } });
});

afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

// ── Rooms ─────────────────────────────────────────────────────────────────────
describe('Hospitality - Rooms', () => {
    it('GET /api/hospitality/rooms returns list', async () => {
        const res = await request(app).get('/api/hospitality/rooms').expect(200);
        expect(res.body).toBeDefined();
    });

    it('POST /api/hospitality/rooms creates a room', async () => {
        const res = await request(app).post('/api/hospitality/rooms').send({
            number: `R-${Date.now()}`, type: 'single', floor: 1,
            pricePerNight: 1500, capacity: 2, status: 'available',
        }).expect(201);
        expect(res.body).toHaveProperty('id');
        roomId = res.body.id;
    });

    it('POST /api/hospitality/rooms rejects missing number', async () => {
        await request(app).post('/api/hospitality/rooms').send({ type: 'single', pricePerNight: 1000 }).expect(400);
    });

    it('PUT /api/hospitality/rooms/:id updates room', async () => {
        if (!roomId) return;
        const res = await request(app).put(`/api/hospitality/rooms/${roomId}`).send({ pricePerNight: 2000 }).expect(200);
        expect(Number(res.body.pricePerNight)).toBe(2000);
    });

    it('DELETE /api/hospitality/rooms/:id removes room', async () => {
        const r = await prisma.room.create({ data: { number: `DEL-${Date.now()}`, type: 'single', floor: 1, pricePerNight: 500, capacity: 1, status: 'available', companyId: CO } });
        await request(app).delete(`/api/hospitality/rooms/${r.id}`).expect(200);
    });
});

// ── Bookings ──────────────────────────────────────────────────────────────────
describe('Hospitality - Bookings', () => {
    let bookingId: string;

    beforeAll(async () => {
        if (!roomId) {
            const r = await prisma.room.create({ data: { number: `BK-${Date.now()}`, type: 'double', floor: 2, pricePerNight: 2000, capacity: 2, status: 'available', companyId: CO } });
            roomId = r.id;
        }
    });

    it('GET /api/hospitality/bookings returns list', async () => {
        const res = await request(app).get('/api/hospitality/bookings').expect(200);
        expect(res.body).toBeDefined();
    });

    it('POST /api/hospitality/bookings creates check-in', async () => {
        const res = await request(app).post('/api/hospitality/bookings').send({
            roomId,
            customerName: 'João Hóspede',
            customerPhone: '841000001',
            checkInDate: new Date().toISOString(),
            checkOutDate: new Date(Date.now() + 2 * 86400000).toISOString(),
            adults: 1, children: 0,
            totalAmount: 4000,
            paymentMethod: 'cash',
            mealPlan: 'none',
        }).expect(201);
        expect(res.body.data ?? res.body).toHaveProperty('id');
        bookingId = (res.body.data ?? res.body).id;
    });

    it('GET /api/hospitality/bookings/:id/details returns booking', async () => {
        if (!bookingId) return;
        const res = await request(app).get(`/api/hospitality/bookings/${bookingId}/details`).expect(200);
        expect((res.body.data ?? res.body).id).toBe(bookingId);
    });

    it('GET /api/hospitality/bookings/today-checkouts returns list', async () => {
        const res = await request(app).get('/api/hospitality/bookings/today-checkouts').expect(200);
        expect(Array.isArray(res.body.data ?? res.body)).toBe(true);
    });
});

// ── Housekeeping ──────────────────────────────────────────────────────────────
describe('Hospitality - Housekeeping', () => {
    it('GET /api/hospitality/housekeeping returns list', async () => {
        const res = await request(app).get('/api/hospitality/housekeeping').expect(200);
        expect(res.body).toBeDefined();
    });

    it('POST /api/hospitality/housekeeping creates task', async () => {
        if (!roomId) return;
        const res = await request(app).post('/api/hospitality/housekeeping').send({
            roomId, type: 'cleaning', priority: 'normal', assignedTo: 'Limpeza A',
        }).expect(201);
        expect(res.body).toHaveProperty('id');
    });
});

// ── Calendar ──────────────────────────────────────────────────────────────────
describe('Hospitality - Calendar', () => {
    it('GET /api/hospitality/calendar returns calendar data', async () => {
        const res = await request(app).get('/api/hospitality/calendar').expect(200);
        expect(res.body).toBeDefined();
    });
});

// ── Hospitality Finance ───────────────────────────────────────────────────────
describe('HospitalityFinance', () => {
    it('GET /api/hospitality/finance/dashboard returns data', async () => {
        const res = await request(app).get('/api/hospitality/finance/dashboard').expect(200);
        expect(res.body).toBeDefined();
    });

    it('GET /api/hospitality/finance/transactions returns list', async () => {
        const res = await request(app).get('/api/hospitality/finance/transactions').expect(200);
        expect(res.body).toBeDefined();
    });

    it('POST /api/hospitality/finance/transactions creates transaction', async () => {
        const res = await request(app).post('/api/hospitality/finance/transactions').send({
            type: 'income', category: 'Diárias', description: 'Diária quarto',
            amount: 2000, date: new Date().toISOString(),
        }).expect(201);
        expect(res.body).toHaveProperty('id');
    });
});

// ── Hospitality Dashboard ─────────────────────────────────────────────────────
describe('HospitalityDashboard', () => {
    it('GET /api/hospitality/dashboard/summary returns summary', async () => {
        const res = await request(app).get('/api/hospitality/dashboard/summary').expect(200);
        expect(res.body).toBeDefined();
    });

    it('GET /api/hospitality/dashboard/recent-bookings returns list', async () => {
        const res = await request(app).get('/api/hospitality/dashboard/recent-bookings').expect(200);
        expect(res.body).toBeDefined();
    });
});

// ── Hospitality Channels ──────────────────────────────────────────────────────
describe('HospitalityChannels', () => {
    it('GET /api/hospitality/channels returns channels list', async () => {
        const res = await request(app).get('/api/hospitality/channels').expect(200);
        expect(Array.isArray(res.body.data ?? res.body)).toBe(true);
    });
});
