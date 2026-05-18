/**
 * Tests: bottleStore + bottleStoreFinance
 *
 * Coverage:
 *   - Dashboard, reports, stock movements
 *   - Bottle returns (deposit + return + customer balance + summary)
 *   - Cash sessions (open/close/withdrawal/deposit/history/summary/z-report)
 *   - Credit sales (list, pay, debtors, payment history, customer summary)
 *   - Batches (list, expiring, create)
 *   - Price tiers (CRUD)
 *   - Finance (transactions CRUD)
 *   - Multi-tenant isolation
 *   - RBAC (cashier OK on POS work, blocked on reports/admin; operator blocked from manager-only writes)
 */
import request from 'supertest';
import type { Request, Response, NextFunction } from 'express';
import { app } from '../../index';
import { prisma } from '../../lib/prisma';

const CO  = 'bs-test-co';
const UID = 'bs-test-user';

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

const unwrap = (res: { body: unknown }) => {
    const body = res.body as { data?: unknown } | unknown;
    return (body as { data?: unknown })?.data ?? body;
};

let productId: string;
let customerId: string;
let saleId: string;

async function cleanup() {
    await Promise.all([
        prisma.bottleReturn.deleteMany({ where: { companyId: CO } }).catch(() => {}),
        prisma.priceTier.deleteMany({ where: { companyId: CO } }).catch(() => {}),
        prisma.creditPayment.deleteMany({ where: { customer: { companyId: CO } } }).catch(() => {}),
        prisma.transaction.deleteMany({ where: { companyId: CO } }).catch(() => {}),
        prisma.cashMovement.deleteMany({ where: { session: { companyId: CO } } }).catch(() => {}),
        prisma.stockMovement.deleteMany({ where: { companyId: CO } }).catch(() => {}),
        prisma.auditLog.deleteMany({ where: { companyId: CO } }).catch(() => {}),
    ]);
    await Promise.all([
        prisma.saleItem.deleteMany({ where: { sale: { companyId: CO } } }).catch(() => {}),
        prisma.cashSession.deleteMany({ where: { companyId: CO } }).catch(() => {}),
    ]);
    await prisma.sale.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await Promise.all([
        prisma.customer.deleteMany({ where: { companyId: CO } }).catch(() => {}),
        prisma.product.deleteMany({ where: { companyId: CO } }).catch(() => {}),
    ]);
    await prisma.user.deleteMany({ where: { id: UID } }).catch(() => {});
    await prisma.company.deleteMany({ where: { id: CO } }).catch(() => {});
}

beforeAll(async () => {
    await cleanup();
    await prisma.company.create({ data: { id: CO, name: 'Bottle Store Test Co', nuit: `BS-${Date.now()}`, status: 'active' } });
    await prisma.user.create({ data: { id: UID, name: 'Admin', email: `bs-${Date.now()}@t.com`, password: 'x', role: 'admin', companyId: CO, isActive: true } });

    const p = await prisma.product.create({
        data: {
            name: 'Coca-Cola 1L', code: `BS-${Date.now()}`,
            price: 80, costPrice: 50, currentStock: 100,
            unit: 'un', companyId: CO, originModule: 'bottle_store',
        }
    });
    productId = p.id;

    const c = await prisma.customer.create({
        data: { code: `CST-${Date.now()}`, name: 'Cliente Vasilhame', phone: '841000000', companyId: CO }
    });
    customerId = c.id;

    // A credit sale for credit-sales tests
    const sale = await prisma.sale.create({
        data: {
            receiptNumber: `BS-CR-${Date.now()}`,
            companyId: CO,
            customerId,
            userId: UID,
            originModule: 'bottle_store',
            paymentMethod: 'credit',
            isCredit: true,
            subtotal: 200, total: 200, amountPaid: 0, paidAmount: 0,
        }
    });
    saleId = sale.id;
});

afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

// ═════════════════════════════════════════════════════════════════════════════
// DASHBOARD / REPORTS / MOVEMENTS
// ═════════════════════════════════════════════════════════════════════════════
describe('BottleStore Dashboard & Reports', () => {
    it('GET /dashboard returns stats', async () => {
        const res = await request(app).get('/api/bottleStore/dashboard').expect(200);
        expect(res.body).toBeDefined();
    });

    it('GET /reports returns sales report', async () => {
        const res = await request(app).get('/api/bottleStore/reports').expect(200);
        expect(res.body).toBeDefined();
    });

    it('GET /movements returns stock movements', async () => {
        const res = await request(app).get('/api/bottleStore/movements').expect(200);
        expect(res.body).toBeDefined();
    });

    it('POST /movements records a stock movement', async () => {
        const res = await request(app).post('/api/bottleStore/movements').send({
            productId, movementType: 'adjustment', quantity: 10,
            reason: 'Inventário inicial',
        });
        expect([200, 201]).toContain(res.status);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// BOTTLE RETURNS (Vasilhames)
// ═════════════════════════════════════════════════════════════════════════════
describe('BottleStore - Bottle Returns', () => {
    it('GET /bottle-returns returns list', async () => {
        const res = await request(app).get('/api/bottleStore/bottle-returns').expect(200);
        expect(res.body).toBeDefined();
    });

    it('POST /bottle-returns/deposit registers deposit', async () => {
        const res = await request(app)
            .post('/api/bottleStore/bottle-returns/deposit')
            .send({ customerId, productId, quantity: 5, depositValue: 50 });
        expect([200, 201]).toContain(res.status);
    });

    it('POST /bottle-returns/return registers return', async () => {
        const res = await request(app)
            .post('/api/bottleStore/bottle-returns/return')
            .send({ customerId, productId, quantity: 2, depositValue: 50 });
        expect([200, 201]).toContain(res.status);
    });

    it('GET /bottle-returns/customer/:id returns customer balance', async () => {
        const res = await request(app).get(`/api/bottleStore/bottle-returns/customer/${customerId}`).expect(200);
        expect(res.body).toBeDefined();
    });

    it('GET /bottle-returns/summary requires customerId', async () => {
        await request(app).get('/api/bottleStore/bottle-returns/summary').expect(400);
    });

    it('GET /bottle-returns/summary returns summary', async () => {
        const res = await request(app)
            .get('/api/bottleStore/bottle-returns/summary')
            .query({ customerId })
            .expect(200);
        expect(res.body).toBeDefined();
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// CASH SESSIONS — POS
// ═════════════════════════════════════════════════════════════════════════════
describe('BottleStore - Cash Sessions', () => {
    let sessionId: string;

    beforeEach(async () => {
        await prisma.cashMovement.deleteMany({ where: { session: { companyId: CO } } }).catch(() => {});
        await prisma.cashSession.deleteMany({ where: { companyId: CO } }).catch(() => {});
    });

    it('GET /cash-session returns null when no session is open', async () => {
        const res = await request(app).get('/api/bottleStore/cash-session').expect(200);
        expect(res.body).toBeNull();
    });

    it('POST /cash-session/open opens a session', async () => {
        const res = await request(app)
            .post('/api/bottleStore/cash-session/open')
            .send({ openingBalance: 500 })
            .expect(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body.status).toBe('open');
        sessionId = res.body.id;
    });

    it('POST /cash-session/open rejects negative balance', async () => {
        await request(app)
            .post('/api/bottleStore/cash-session/open')
            .send({ openingBalance: -100 })
            .expect(400);
    });

    it('POST /cash-session/withdrawal registers sangria', async () => {
        await request(app).post('/api/bottleStore/cash-session/open').send({ openingBalance: 1000 }).expect(201);
        const res = await request(app)
            .post('/api/bottleStore/cash-session/withdrawal')
            .send({ amount: 200, reason: 'Pagamento fornecedor' })
            .expect(201);
        expect(res.body.type).toBe('sangria');
    });

    it('POST /cash-session/deposit registers suprimento', async () => {
        await request(app).post('/api/bottleStore/cash-session/open').send({ openingBalance: 200 }).expect(201);
        const res = await request(app)
            .post('/api/bottleStore/cash-session/deposit')
            .send({ amount: 300, reason: 'Reforço' })
            .expect(201);
        expect(res.body.type).toBe('suprimento');
    });

    it('POST /cash-session/close closes a session', async () => {
        await request(app).post('/api/bottleStore/cash-session/open').send({ openingBalance: 500 }).expect(201);
        const res = await request(app)
            .post('/api/bottleStore/cash-session/close')
            .send({ closingBalance: 500 })
            .expect(200);
        expect(res.body.status).toBe('closed');
    });

    it('GET /cash-session/summary returns daily summary', async () => {
        const res = await request(app).get('/api/bottleStore/cash-session/summary').expect(200);
        expect(res.body === null || typeof res.body === 'object').toBe(true);
    });

    it('GET /cash-session/history returns session history', async () => {
        const res = await request(app).get('/api/bottleStore/cash-session/history').expect(200);
        expect(Array.isArray(res.body.data ?? res.body)).toBe(true);
    });

    it('GET /cash-session/z-report returns z-report or 404', async () => {
        await request(app).post('/api/bottleStore/cash-session/open').send({ openingBalance: 100 }).expect(201);
        await request(app).post('/api/bottleStore/cash-session/close').send({ closingBalance: 100 }).expect(200);
        const res = await request(app).get('/api/bottleStore/cash-session/z-report');
        expect([200, 404]).toContain(res.status);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// CREDIT SALES
// ═════════════════════════════════════════════════════════════════════════════
describe('BottleStore - Credit Sales', () => {
    it('GET /credit-sales returns list', async () => {
        const res = await request(app).get('/api/bottleStore/credit-sales').expect(200);
        expect(res.body).toBeDefined();
    });

    it('POST /credit-sales/pay registers a payment', async () => {
        const res = await request(app)
            .post('/api/bottleStore/credit-sales/pay')
            .send({ saleId, amount: 50, paymentMethod: 'cash' });
        expect([200, 201]).toContain(res.status);
    });

    it('GET /credit-sales/debtors returns debtors report', async () => {
        const res = await request(app).get('/api/bottleStore/credit-sales/debtors').expect(200);
        expect(res.body).toBeDefined();
    });

    it('GET /credit-sales/customer/:id returns customer summary', async () => {
        const res = await request(app).get(`/api/bottleStore/credit-sales/customer/${customerId}`).expect(200);
        expect(res.body).toBeDefined();
    });

    it('GET /credit-sales/:saleId/payments returns payment history', async () => {
        const res = await request(app).get(`/api/bottleStore/credit-sales/${saleId}/payments`).expect(200);
        expect(res.body).toBeDefined();
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// BATCHES
// ═════════════════════════════════════════════════════════════════════════════
describe('BottleStore - Batches', () => {
    it('GET /batches returns list', async () => {
        const res = await request(app).get('/api/bottleStore/batches').expect(200);
        expect(res.body).toBeDefined();
    });

    it('GET /batches/expiring returns expiring batches', async () => {
        const res = await request(app).get('/api/bottleStore/batches/expiring').expect(200);
        expect(res.body).toBeDefined();
    });

    it('GET /batches/expiring accepts custom days', async () => {
        const res = await request(app).get('/api/bottleStore/batches/expiring').query({ days: 7 }).expect(200);
        expect(res.body).toBeDefined();
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// PRICE TIERS
// ═════════════════════════════════════════════════════════════════════════════
describe('BottleStore - Price Tiers', () => {
    let tierId: string;

    it('GET /price-tiers returns list', async () => {
        const res = await request(app).get('/api/bottleStore/price-tiers').expect(200);
        expect(res.body).toBeDefined();
    });

    it('POST /price-tiers creates tier', async () => {
        const res = await request(app)
            .post('/api/bottleStore/price-tiers')
            .send({ productId, minQty: 10, price: 70, label: 'Atacado' });
        expect([200, 201]).toContain(res.status);
        const body = unwrap(res);
        tierId = body.id;
    });

    it('DELETE /price-tiers/:id removes tier', async () => {
        if (!tierId) return;
        await request(app).delete(`/api/bottleStore/price-tiers/${tierId}`).expect(200);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// FINANCE
// ═════════════════════════════════════════════════════════════════════════════
describe('BottleStoreFinance', () => {
    let txId: string;

    it('GET /finance/dashboard returns data', async () => {
        const res = await request(app).get('/api/bottleStore/finance/dashboard').expect(200);
        expect(res.body).toBeDefined();
    });

    it('GET /finance/transactions returns list', async () => {
        const res = await request(app).get('/api/bottleStore/finance/transactions').expect(200);
        expect(res.body).toBeDefined();
    });

    it('POST /finance/transactions creates transaction', async () => {
        const res = await request(app).post('/api/bottleStore/finance/transactions').send({
            type: 'income', category: 'Vendas', description: 'Venda balcão',
            amount: 1000, date: new Date().toISOString(),
        }).expect(201);
        expect(res.body).toHaveProperty('id');
        txId = res.body.id;
    });

    it('POST /finance/transactions rejects invalid type', async () => {
        await request(app).post('/api/bottleStore/finance/transactions').send({
            type: 'invalid', category: 'X', description: 'X', amount: 10, date: new Date().toISOString(),
        }).expect(400);
    });

    it('PUT /finance/transactions/:id updates', async () => {
        const res = await request(app)
            .put(`/api/bottleStore/finance/transactions/${txId}`)
            .send({ amount: 1500 })
            .expect(200);
        expect(Number(res.body.amount)).toBe(1500);
    });

    it('DELETE /finance/transactions/:id removes', async () => {
        await request(app).delete(`/api/bottleStore/finance/transactions/${txId}`).expect(200);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// MULTI-TENANT ISOLATION
// ═════════════════════════════════════════════════════════════════════════════
describe('BottleStore multi-tenant isolation', () => {
    it('bottle returns and credit sales from another company are not visible', async () => {
        const otherCo = `other-bs-co-${Date.now()}`;
        await prisma.company.create({ data: { id: otherCo, name: 'Other BS', nuit: `OBS-${Date.now()}` } });

        const otherProduct = await prisma.product.create({
            data: { name: 'Outsider', code: `OUT-${Date.now()}`, price: 1, unit: 'un', companyId: otherCo, originModule: 'bottle_store', currentStock: 1 }
        });
        const otherReturn = await prisma.bottleReturn.create({
            data: { productId: otherProduct.id, quantity: 1, type: 'deposit', performedBy: 'X', companyId: otherCo }
        });
        // Need a user in the other company for the FK
        const otherUser = await prisma.user.create({
            data: { name: 'Outsider', email: `out-${Date.now()}@t.com`, password: 'x', role: 'admin', companyId: otherCo, isActive: true }
        });
        const otherSale = await prisma.sale.create({
            data: {
                receiptNumber: `OUT-CR-${Date.now()}`,
                companyId: otherCo,
                userId: otherUser.id,
                originModule: 'bottle_store',
                paymentMethod: 'credit',
                isCredit: true,
                subtotal: 1, total: 1, amountPaid: 0, paidAmount: 0,
            }
        });

        const returns = await request(app).get('/api/bottleStore/bottle-returns').expect(200);
        const rArr = unwrap(returns);
        const returnIds = ((Array.isArray(rArr) ? rArr : ((rArr as { data?: unknown[] }).data ?? [])) as Array<{ id: string }>).map((r) => r.id);
        expect(returnIds).not.toContain(otherReturn.id);

        const credit = await request(app).get('/api/bottleStore/credit-sales').expect(200);
        const cArr = unwrap(credit);
        const creditIds = ((Array.isArray(cArr) ? cArr : ((cArr as { data?: unknown[] }).data ?? [])) as Array<{ id: string }>).map((s) => s.id);
        expect(creditIds).not.toContain(otherSale.id);

        // Cleanup
        await prisma.sale.delete({ where: { id: otherSale.id } });
        await prisma.bottleReturn.delete({ where: { id: otherReturn.id } });
        await prisma.product.delete({ where: { id: otherProduct.id } });
        await prisma.user.delete({ where: { id: otherUser.id } });
        await prisma.company.delete({ where: { id: otherCo } });
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// RBAC — bottle store is POS-heavy: cashier OK on counter ops, blocked on reports/admin
// ═════════════════════════════════════════════════════════════════════════════
describe('BottleStore RBAC', () => {
    describe('Cashier is allowed on POS counter operations', () => {
        beforeEach(async () => {
            await prisma.cashMovement.deleteMany({ where: { session: { companyId: CO } } }).catch(() => {});
            await prisma.cashSession.deleteMany({ where: { companyId: CO } }).catch(() => {});
        });

        it('GET /cash-session', async () => {
            await request(app).get('/api/bottleStore/cash-session').set('x-mock-role', 'cashier').expect(200);
        });

        it('POST /cash-session/open', async () => {
            await request(app)
                .post('/api/bottleStore/cash-session/open')
                .send({ openingBalance: 500 })
                .set('x-mock-role', 'cashier')
                .expect(201);
        });

        it('POST /bottle-returns/deposit', async () => {
            const res = await request(app)
                .post('/api/bottleStore/bottle-returns/deposit')
                .send({ customerId, productId, quantity: 1, depositValue: 50 })
                .set('x-mock-role', 'cashier');
            expect([200, 201]).toContain(res.status);
        });

        it('POST /credit-sales/pay', async () => {
            const res = await request(app)
                .post('/api/bottleStore/credit-sales/pay')
                .send({ saleId, amount: 10, paymentMethod: 'cash' })
                .set('x-mock-role', 'cashier');
            expect([200, 201]).toContain(res.status);
        });
    });

    describe('Cashier is blocked from staff-protected reads', () => {
        const STAFF_PROTECTED_GETS = [
            '/api/bottleStore/dashboard',
            '/api/bottleStore/reports',
            '/api/bottleStore/movements',
            '/api/bottleStore/credit-sales',
            '/api/bottleStore/credit-sales/debtors',
            '/api/bottleStore/cash-session/z-report',
            '/api/bottleStore/cash-session/history',
            '/api/bottleStore/batches',
            '/api/bottleStore/batches/expiring',
            '/api/bottleStore/price-tiers',
            '/api/bottleStore/finance/dashboard',
            '/api/bottleStore/finance/transactions',
        ];
        for (const url of STAFF_PROTECTED_GETS) {
            it(`GET ${url} returns 403 for cashier`, async () => {
                await request(app).get(url).set('x-mock-role', 'cashier').expect(403);
            });
        }

        it(`GET /credit-sales/customer/:id returns 403 for cashier`, async () => {
            await request(app).get(`/api/bottleStore/credit-sales/customer/${customerId}`).set('x-mock-role', 'cashier').expect(403);
        });
    });

    describe('Operator is blocked from manager-only writes', () => {
        it('POST /price-tiers', async () => {
            await request(app).post('/api/bottleStore/price-tiers').send({}).set('x-mock-role', 'operator').expect(403);
        });
        it('DELETE /price-tiers/:id', async () => {
            await request(app).delete('/api/bottleStore/price-tiers/x').set('x-mock-role', 'operator').expect(403);
        });
        it('PUT /finance/transactions/:id', async () => {
            await request(app).put('/api/bottleStore/finance/transactions/x').send({}).set('x-mock-role', 'operator').expect(403);
        });
        it('DELETE /finance/transactions/:id', async () => {
            await request(app).delete('/api/bottleStore/finance/transactions/x').set('x-mock-role', 'operator').expect(403);
        });
    });

    describe('Operator is allowed on staff-protected reads', () => {
        it('GET /dashboard returns 200', async () => {
            await request(app).get('/api/bottleStore/dashboard').set('x-mock-role', 'operator').expect(200);
        });
        it('GET /credit-sales returns 200', async () => {
            await request(app).get('/api/bottleStore/credit-sales').set('x-mock-role', 'operator').expect(200);
        });
        it('GET /finance/dashboard returns 200', async () => {
            await request(app).get('/api/bottleStore/finance/dashboard').set('x-mock-role', 'operator').expect(200);
        });
    });
});
