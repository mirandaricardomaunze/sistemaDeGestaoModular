/**
 * Tests: hospitality + hospitalityFinance + hospitalityChannels + hospitalityDashboard
 *
 * Coverage:
 *   - Rooms CRUD
 *   - Bookings: check-in, consumption, checkout, extend, details, today-checkouts
 *   - Reservations (with conflict detection)
 *   - Housekeeping: list, create, update (status), delete
 *   - Calendar
 *   - Finance: dashboard, revenues, expenses CRUD, profit-loss, by-room
 *   - Dashboard: summary, recent-bookings, metrics, charts (revenue, occupancy,
 *     room-types, consumption), reports
 *   - Channels: iCal feed (public via ?c=), sync
 *   - Multi-tenant isolation
 *   - RBAC (cashier blocked / operator blocked from manager-only writes)
 */
import request from 'supertest';
import type { Request, Response, NextFunction } from 'express';
import { app } from '../../index';
import { prisma } from '../../lib/prisma';

const CO  = 'ht-test-co';
const UID = 'ht-test-user';

type MockReq = Request & { userId?: string; companyId?: string; userName?: string; userRole?: string };

jest.mock('../../middleware/auth', () => ({
    authenticate: (req: MockReq, _: Response, next: NextFunction) => {
        req.userId    = (req.headers['x-mock-uid'] as string)  || UID;
        req.companyId = (req.headers['x-mock-co'] as string)   || CO;
        req.userRole  = (req.headers['x-mock-role'] as string) || 'admin';
        req.userName  = 'Test';
        next();
    },
    authorize: (...roles: string[]) => (req: MockReq, res: Response, next: NextFunction) => {
        if (!roles.includes(req.userRole ?? '')) {
            return res.status(403).json({ message: 'Acesso negado' });
        }
        next();
    },
    AuthRequest: {} as unknown,
}));
jest.mock('../../lib/socket', () => ({ emitToCompany: jest.fn(), emitToModule: jest.fn(), emitToUser: jest.fn(), getIO: jest.fn(), initSocket: jest.fn().mockReturnValue({ on: jest.fn() }) }));

jest.setTimeout(120000);

let roomId: string;
let productId: string;
let sessionId: string;

async function cleanup() {
    await Promise.all([
        prisma.bookingConsumption.deleteMany({ where: { booking: { companyId: CO } } }).catch(() => {}),
        prisma.transaction.deleteMany({ where: { companyId: CO } }).catch(() => {}),
        prisma.stockMovement.deleteMany({ where: { companyId: CO } }).catch(() => {}),
        prisma.housekeepingTask.deleteMany({ where: { companyId: CO } }).catch(() => {}),
        prisma.auditLog.deleteMany({ where: { companyId: CO } }).catch(() => {}),
        prisma.cashMovement.deleteMany({ where: { session: { companyId: CO } } }).catch(() => {}),
    ]);
    await prisma.booking.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.cashSession.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.product.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.room.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: UID } }).catch(() => {});
    await prisma.company.deleteMany({ where: { id: CO } }).catch(() => {});
}

beforeAll(async () => {
    await cleanup();
    await prisma.company.create({ data: { id: CO, name: 'Hotel Test', nuit: `HT-${Date.now()}`, status: 'active' } });
    await prisma.user.create({ data: { id: UID, name: 'Admin', email: `ht-${Date.now()}@t.com`, password: 'x', role: 'admin', companyId: CO, isActive: true } });

    // Pre-seed a product for room consumption tests
    const p = await prisma.product.create({
        data: { name: 'Água Mineral', code: `MIN-${Date.now()}`, price: 50, unit: 'un', companyId: CO, currentStock: 100 }
    });
    productId = p.id;

    // Cash session needed for booking checkout
    const s = await prisma.cashSession.create({ data: { openedById: UID, companyId: CO, openingBalance: 0, status: 'open' } });
    sessionId = s.id;
});

afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

const unwrap = (res: { body: unknown }) => (res.body as { data?: unknown })?.data ?? res.body;

// ═════════════════════════════════════════════════════════════════════════════
// ROOMS
// ═════════════════════════════════════════════════════════════════════════════
describe('Hospitality - Rooms', () => {
    it('GET /rooms returns list', async () => {
        const res = await request(app).get('/api/hospitality/rooms').expect(200);
        expect(res.body).toBeDefined();
    });

    it('POST /rooms creates a room', async () => {
        const res = await request(app).post('/api/hospitality/rooms').send({
            number: `R-${Date.now()}`, type: 'single', floor: 1,
            pricePerNight: 1500, capacity: 2,
        }).expect(201);
        const body = unwrap(res);
        expect(body).toHaveProperty('id');
        roomId = body.id;
    });

    it('POST /rooms rejects missing number', async () => {
        await request(app).post('/api/hospitality/rooms').send({ type: 'single', pricePerNight: 1000 }).expect(400);
    });

    it('PUT /rooms/:id updates room', async () => {
        const res = await request(app).put(`/api/hospitality/rooms/${roomId}`).send({ pricePerNight: 2000 }).expect(200);
        const body = unwrap(res);
        expect(Number(body.price)).toBe(2000);
    });

    it('DELETE /rooms/:id removes room', async () => {
        const r = await prisma.room.create({ data: { number: `DEL-${Date.now()}`, type: 'single', price: 500, status: 'available', companyId: CO } });
        await request(app).delete(`/api/hospitality/rooms/${r.id}`).expect(200);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// BOOKINGS
// ═════════════════════════════════════════════════════════════════════════════
describe('Hospitality - Bookings', () => {
    let bookingId: string;

    beforeAll(async () => {
        if (!roomId) {
            const r = await prisma.room.create({ data: { number: `BK-${Date.now()}`, type: 'double', price: 2000, status: 'available', companyId: CO } });
            roomId = r.id;
        }
    });

    it('GET /bookings returns list', async () => {
        const res = await request(app).get('/api/hospitality/bookings').expect(200);
        expect(res.body).toBeDefined();
    });

    it('POST /bookings creates check-in', async () => {
        const res = await request(app).post('/api/hospitality/bookings').send({
            roomId,
            guestName: 'João Hóspede',
            guestPhone: '841000001',
            checkIn: new Date().toISOString(),
            checkOut: new Date(Date.now() + 2 * 86400000).toISOString(),
            guestCount: 1,
            totalPrice: 4000,
            mealPlan: 'none',
        }).expect(201);
        bookingId = unwrap(res).id;
        expect(bookingId).toBeDefined();
    });

    it('GET /bookings/:id/details returns booking', async () => {
        const res = await request(app).get(`/api/hospitality/bookings/${bookingId}/details`).expect(200);
        expect(unwrap(res).id).toBe(bookingId);
    });

    it('GET /bookings/today-checkouts returns list', async () => {
        const res = await request(app).get('/api/hospitality/bookings/today-checkouts').expect(200);
        expect(Array.isArray(unwrap(res))).toBe(true);
    });

    it('POST /bookings/:id/consumptions adds product to booking', async () => {
        const before = await prisma.product.findUnique({ where: { id: productId } });
        const res = await request(app)
            .post(`/api/hospitality/bookings/${bookingId}/consumptions`)
            .send({ productId, quantity: 2 })
            .expect(201);
        expect(res.body).toHaveProperty('id');
        const after = await prisma.product.findUnique({ where: { id: productId } });
        expect(after!.currentStock).toBe(before!.currentStock - 2);
    });

    it('POST /bookings/:id/consumptions rejects insufficient stock', async () => {
        await request(app)
            .post(`/api/hospitality/bookings/${bookingId}/consumptions`)
            .send({ productId, quantity: 100000 })
            .expect(400);
    });

    it('PUT /bookings/:id/extend extends checkout date', async () => {
        const newDate = new Date(Date.now() + 5 * 86400000).toISOString();
        const res = await request(app)
            .put(`/api/hospitality/bookings/${bookingId}/extend`)
            .send({ newCheckoutDate: newDate, adjustPrice: 6000 })
            .expect(200);
        expect(Number(res.body.totalPrice)).toBe(6000);
    });

    it('PUT /bookings/:id/extend returns 404 for unknown booking', async () => {
        await request(app)
            .put('/api/hospitality/bookings/nope/extend')
            .send({ newCheckoutDate: new Date().toISOString() })
            .expect(404);
    });

    it('PUT /bookings/:id/checkout closes booking', async () => {
        const res = await request(app)
            .put(`/api/hospitality/bookings/${bookingId}/checkout`)
            .send({ sessionId })
            .expect(200);
        expect(res.body).toBeDefined();
    });

    it('PUT /bookings/:id/checkout returns 400 without an open session', async () => {
        // Create another booking and try checkout without sessionId
        const r = await prisma.room.create({ data: { number: `NS-${Date.now()}`, type: 'single', price: 1000, status: 'available', companyId: CO } });
        const b = await prisma.booking.create({
            data: { roomId: r.id, customerName: 'No-Session', checkIn: new Date(), expectedCheckout: new Date(Date.now() + 86400000), totalPrice: 1000, status: 'checked_in', companyId: CO }
        });
        await request(app)
            .put(`/api/hospitality/bookings/${b.id}/checkout`)
            .expect(400);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// HOUSEKEEPING
// ═════════════════════════════════════════════════════════════════════════════
describe('Hospitality - Housekeeping', () => {
    let taskId: string;

    it('GET /housekeeping returns list', async () => {
        const res = await request(app).get('/api/hospitality/housekeeping').expect(200);
        expect(res.body).toBeDefined();
    });

    it('POST /housekeeping creates task', async () => {
        const res = await request(app).post('/api/hospitality/housekeeping').send({
            roomId, type: 'stay_cleaning', priority: 1,
        }).expect(201);
        taskId = unwrap(res).id;
        expect(taskId).toBeDefined();
    });

    it('PUT /housekeeping/:id updates status to in_progress', async () => {
        const res = await request(app)
            .put(`/api/hospitality/housekeeping/${taskId}`)
            .send({ status: 'in_progress', notes: 'Iniciado' })
            .expect(200);
        expect(res.body.status).toBe('in_progress');
        expect(res.body.startedAt).toBeTruthy();
    });

    it('PUT /housekeeping/:id status=completed flips room to available', async () => {
        const res = await request(app)
            .put(`/api/hospitality/housekeeping/${taskId}`)
            .send({ status: 'completed' })
            .expect(200);
        expect(res.body.status).toBe('completed');
        expect(res.body.completedAt).toBeTruthy();

        const room = await prisma.room.findUnique({ where: { id: roomId } });
        expect(room?.status).toBe('available');
    });

    it('PUT /housekeeping/:id returns 404 for unknown id', async () => {
        await request(app)
            .put('/api/hospitality/housekeeping/nope')
            .send({ status: 'completed' })
            .expect(404);
    });

    it('DELETE /housekeeping/:id removes task', async () => {
        const t = await prisma.housekeepingTask.create({ data: { roomId, type: 'checkout_cleaning', companyId: CO } });
        await request(app).delete(`/api/hospitality/housekeeping/${t.id}`).expect(200);
    });

    it('DELETE /housekeeping/:id returns 404 for unknown id', async () => {
        await request(app).delete('/api/hospitality/housekeeping/nope').expect(404);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// RESERVATIONS (calendar booking with conflict check)
// ═════════════════════════════════════════════════════════════════════════════
describe('Hospitality - Reservations', () => {
    it('POST /reservations creates a confirmed reservation', async () => {
        const res = await request(app).post('/api/hospitality/reservations').send({
            roomId,
            customerName: 'Maria Reserva',
            checkIn: new Date(Date.now() + 30 * 86400000).toISOString(),
            expectedCheckout: new Date(Date.now() + 33 * 86400000).toISOString(),
            mealPlan: 'breakfast',
            guestCount: 2,
        }).expect(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body.status).toBe('confirmed');
    });

    it('POST /reservations rejects overlapping dates', async () => {
        // First reservation
        await request(app).post('/api/hospitality/reservations').send({
            roomId,
            customerName: 'Original',
            checkIn: new Date(Date.now() + 60 * 86400000).toISOString(),
            expectedCheckout: new Date(Date.now() + 65 * 86400000).toISOString(),
            guestCount: 1,
        }).expect(201);
        // Conflicting reservation (overlap)
        await request(app).post('/api/hospitality/reservations').send({
            roomId,
            customerName: 'Conflict',
            checkIn: new Date(Date.now() + 62 * 86400000).toISOString(),
            expectedCheckout: new Date(Date.now() + 67 * 86400000).toISOString(),
            guestCount: 1,
        }).expect(400);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// CALENDAR
// ═════════════════════════════════════════════════════════════════════════════
describe('Hospitality - Calendar', () => {
    it('GET /calendar returns rooms + bookings + dateRange', async () => {
        const res = await request(app).get('/api/hospitality/calendar').expect(200);
        expect(res.body).toHaveProperty('rooms');
        expect(res.body).toHaveProperty('bookings');
        expect(res.body).toHaveProperty('dateRange');
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// FINANCE
// ═════════════════════════════════════════════════════════════════════════════
describe('HospitalityFinance', () => {
    let expenseId: string;

    it('GET /finance/dashboard returns data', async () => {
        const res = await request(app).get('/api/hospitality/finance/dashboard').expect(200);
        expect(res.body).toBeDefined();
    });

    it('GET /finance/revenues returns list', async () => {
        const res = await request(app).get('/api/hospitality/finance/revenues').expect(200);
        expect(res.body).toBeDefined();
    });

    it('GET /finance/expenses returns list', async () => {
        const res = await request(app).get('/api/hospitality/finance/expenses').expect(200);
        expect(res.body).toBeDefined();
    });

    it('POST /finance/expenses creates expense', async () => {
        const res = await request(app).post('/api/hospitality/finance/expenses').send({
            category: 'utilities', description: 'Electricidade', amount: 2000,
            date: new Date().toISOString().slice(0, 10),
        });
        expect([200, 201]).toContain(res.status);
        const body = res.body?.id ? res.body : (res.body?.data ?? res.body);
        expenseId = body.id;
    });

    it('PUT /finance/expenses/:id updates expense', async () => {
        if (!expenseId) return;
        const res = await request(app)
            .put(`/api/hospitality/finance/expenses/${expenseId}`)
            .send({ amount: 2500 });
        expect([200]).toContain(res.status);
    });

    it('DELETE /finance/expenses/:id removes expense', async () => {
        if (!expenseId) return;
        await request(app).delete(`/api/hospitality/finance/expenses/${expenseId}`).expect(200);
    });

    it('GET /finance/reports/profit-loss requires startDate/endDate', async () => {
        await request(app).get('/api/hospitality/finance/reports/profit-loss').expect(400);
    });

    it('GET /finance/reports/profit-loss returns report', async () => {
        const res = await request(app)
            .get('/api/hospitality/finance/reports/profit-loss')
            .query({
                startDate: new Date(Date.now() - 30 * 86400000).toISOString(),
                endDate: new Date().toISOString(),
            })
            .expect(200);
        expect(res.body).toBeDefined();
    });

    it('GET /finance/reports/by-room returns report', async () => {
        const res = await request(app)
            .get('/api/hospitality/finance/reports/by-room')
            .query({
                startDate: new Date(Date.now() - 30 * 86400000).toISOString(),
                endDate: new Date().toISOString(),
            })
            .expect(200);
        expect(res.body).toBeDefined();
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═════════════════════════════════════════════════════════════════════════════
describe('HospitalityDashboard', () => {
    it('GET /dashboard/summary returns summary', async () => {
        const res = await request(app).get('/api/hospitality/dashboard/summary').expect(200);
        expect(res.body).toBeDefined();
    });

    it('GET /dashboard/recent-bookings returns list', async () => {
        const res = await request(app).get('/api/hospitality/dashboard/recent-bookings').expect(200);
        expect(res.body).toBeDefined();
    });

    it('GET /dashboard/metrics returns metrics', async () => {
        const res = await request(app).get('/api/hospitality/dashboard/metrics').expect(200);
        expect(res.body).toBeDefined();
    });

    const CHARTS = ['revenue', 'occupancy', 'room-types', 'consumption'];
    for (const chart of CHARTS) {
        it(`GET /dashboard/charts/${chart} returns chart`, async () => {
            const res = await request(app).get(`/api/hospitality/dashboard/charts/${chart}`).expect(200);
            expect(res.body).toBeDefined();
        });
    }

    it('GET /dashboard/reports returns reports', async () => {
        const res = await request(app).get('/api/hospitality/dashboard/reports').expect(200);
        expect(res.body).toBeDefined();
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// CHANNELS (iCal feed + sync)
// ═════════════════════════════════════════════════════════════════════════════
describe('HospitalityChannels', () => {
    it('GET /channels/rooms/:roomId/ical without ?c= returns 400', async () => {
        await request(app).get(`/api/hospitality/channels/rooms/${roomId}/ical`).expect(400);
    });

    it('GET /channels/rooms/:roomId/ical with ?c= returns iCalendar', async () => {
        const res = await request(app)
            .get(`/api/hospitality/channels/rooms/${roomId}/ical`)
            .query({ c: CO });
        expect([200, 404]).toContain(res.status); // 404 if room not found scenario
        if (res.status === 200) {
            expect(res.headers['content-type']).toMatch(/text\/calendar/);
        }
    });

    it('POST /channels/rooms/:roomId/sync rejects missing icalUrl', async () => {
        await request(app)
            .post(`/api/hospitality/channels/rooms/${roomId}/sync`)
            .send({})
            .expect(400);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// MULTI-TENANT ISOLATION
// ═════════════════════════════════════════════════════════════════════════════
describe('Hospitality multi-tenant isolation', () => {
    it('rooms and bookings from another company are not visible', async () => {
        const otherCo = `other-ht-co-${Date.now()}`;
        await prisma.company.create({ data: { id: otherCo, name: 'Other Hotel', nuit: `OHT-${Date.now()}` } });

        const otherRoom = await prisma.room.create({
            data: { number: `OUT-${Date.now()}`, type: 'single', price: 1, status: 'available', companyId: otherCo }
        });
        const otherBooking = await prisma.booking.create({
            data: {
                roomId: otherRoom.id,
                customerName: 'Outsider',
                checkIn: new Date(),
                expectedCheckout: new Date(Date.now() + 86400000),
                totalPrice: 1,
                companyId: otherCo,
            }
        });

        const rooms = await request(app).get('/api/hospitality/rooms').expect(200);
        const roomList = unwrap(rooms) as { data?: unknown[]; rooms?: unknown[] } | unknown[];
        const roomArray = Array.isArray(roomList) ? roomList : ((roomList as { data?: unknown[] }).data ?? (roomList as { rooms?: unknown[] }).rooms ?? []);
        const roomIds = (roomArray as Array<{ id: string }>).map((r) => r.id);
        expect(roomIds).not.toContain(otherRoom.id);

        const bookings = await request(app).get('/api/hospitality/bookings').expect(200);
        const bookingList = unwrap(bookings) as { data?: unknown[]; bookings?: unknown[] } | unknown[];
        const bookingArray = Array.isArray(bookingList) ? bookingList : ((bookingList as { data?: unknown[] }).data ?? (bookingList as { bookings?: unknown[] }).bookings ?? []);
        const bookingIds = (bookingArray as Array<{ id: string }>).map((b) => b.id);
        expect(bookingIds).not.toContain(otherBooking.id);

        // Cleanup
        await prisma.booking.delete({ where: { id: otherBooking.id } });
        await prisma.room.delete({ where: { id: otherRoom.id } });
        await prisma.company.delete({ where: { id: otherCo } });
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// RBAC
// ═════════════════════════════════════════════════════════════════════════════
describe('Hospitality RBAC', () => {
    describe('Cashier is blocked from staff-protected endpoints', () => {
        const STAFF_PROTECTED_GETS = [
            '/api/hospitality/finance/dashboard',
            '/api/hospitality/finance/revenues',
            '/api/hospitality/finance/expenses',
            '/api/hospitality/finance/reports/profit-loss?startDate=2024-01-01&endDate=2024-12-31',
            '/api/hospitality/finance/reports/by-room',
            '/api/hospitality/dashboard/summary',
            '/api/hospitality/dashboard/recent-bookings',
            '/api/hospitality/dashboard/metrics',
            '/api/hospitality/dashboard/charts/revenue',
            '/api/hospitality/dashboard/charts/occupancy',
            '/api/hospitality/dashboard/reports',
        ];
        for (const url of STAFF_PROTECTED_GETS) {
            it(`GET ${url.split('?')[0]} returns 403 for cashier`, async () => {
                await request(app).get(url).set('x-mock-role', 'cashier').expect(403);
            });
        }
    });

    describe('Operator is blocked from manager-only writes', () => {
        it('POST /rooms', async () => {
            await request(app).post('/api/hospitality/rooms').send({}).set('x-mock-role', 'operator').expect(403);
        });
        it('PUT /rooms/:id', async () => {
            await request(app).put(`/api/hospitality/rooms/${roomId}`).send({ pricePerNight: 9999 }).set('x-mock-role', 'operator').expect(403);
        });
        it('DELETE /rooms/:id', async () => {
            await request(app).delete(`/api/hospitality/rooms/${roomId}`).set('x-mock-role', 'operator').expect(403);
        });
        it('PUT /bookings/:id/extend', async () => {
            await request(app).put('/api/hospitality/bookings/x/extend').send({}).set('x-mock-role', 'operator').expect(403);
        });
        it('DELETE /housekeeping/:id', async () => {
            await request(app).delete('/api/hospitality/housekeeping/x').set('x-mock-role', 'operator').expect(403);
        });
        it('PUT /finance/expenses/:id', async () => {
            await request(app).put('/api/hospitality/finance/expenses/x').send({}).set('x-mock-role', 'operator').expect(403);
        });
        it('DELETE /finance/expenses/:id', async () => {
            await request(app).delete('/api/hospitality/finance/expenses/x').set('x-mock-role', 'operator').expect(403);
        });
        it('POST /channels/rooms/:roomId/sync', async () => {
            await request(app).post(`/api/hospitality/channels/rooms/${roomId}/sync`).send({ icalUrl: 'http://x' }).set('x-mock-role', 'operator').expect(403);
        });
    });

    describe('Operator is allowed on staff-protected reads', () => {
        it('GET /finance/dashboard returns 200', async () => {
            await request(app).get('/api/hospitality/finance/dashboard').set('x-mock-role', 'operator').expect(200);
        });
        it('GET /dashboard/summary returns 200', async () => {
            await request(app).get('/api/hospitality/dashboard/summary').set('x-mock-role', 'operator').expect(200);
        });
        it('POST /finance/expenses returns 2xx', async () => {
            const res = await request(app)
                .post('/api/hospitality/finance/expenses')
                .send({ category: 'utilities', description: 'Internet', amount: 500, date: new Date().toISOString().slice(0, 10) })
                .set('x-mock-role', 'operator');
            expect([200, 201]).toContain(res.status);
        });
    });
});
