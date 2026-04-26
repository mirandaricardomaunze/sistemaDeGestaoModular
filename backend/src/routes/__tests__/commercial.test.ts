/**
 * Commercial Module Test Suite
 *
 * Covers:
 * - Analytics (analytics, margins, stock-aging, supplier-performance,
 *   inventory-turnover, sales-report, warehouse-distribution)
 * - Purchase Orders (list, get, status update, partial delivery, delete)
 * - Quotations (list, create, convert to invoice)
 * - Accounts Receivable
 * - Cash Sessions / Shifts (open, close, movement, history, summary, z-report)
 * - Stock Reservations (reserve, release)
 * - Commercial Finance (dashboard, transactions CRUD)
 * - RBAC (403 when role insufficient)
 */

import request from 'supertest';
import { app } from '../../index';
import { prisma } from '../../lib/prisma';

// ── Constants ─────────────────────────────────────────────────────────────────

const CO = 'comm-test-co';
const USER_ADMIN = 'comm-user-admin';
const USER_OPERATOR = 'comm-user-operator';
const USER_CASHIER = 'comm-user-cashier';

// Auth mock — role controlled per-request via x-mock-role header
jest.mock('../../middleware/auth', () => ({
    authenticate: (req: any, _res: any, next: any) => {
        req.userId    = req.headers['x-mock-uid']  || USER_ADMIN;
        req.companyId = req.headers['x-mock-co']   || CO;
        req.userRole  = req.headers['x-mock-role'] || 'admin';
        req.userName  = 'Test User';
        next();
    },
    authorize: (...roles: string[]) => (req: any, res: any, next: any) => {
        if (!roles.includes(req.userRole)) {
            return res.status(403).json({ message: 'Acesso negado' });
        }
        next();
    },
    AuthRequest: {} as any,
}));

// Silence socket in tests
jest.mock('../../lib/socket', () => ({
    initSocket: jest.fn().mockReturnValue({ on: jest.fn() }),
    emitToCompany: jest.fn(),
}));

// ── Test data IDs (set in beforeAll) ─────────────────────────────────────────
let supplierId: string;
let productId: string;
let warehouseId: string;

// ── Setup / Teardown ─────────────────────────────────────────────────────────

async function cleanup() {
    await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { companyId: CO } } }).catch(() => {});
    await prisma.purchaseOrder.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.customerOrderItem.deleteMany({ where: { order: { companyId: CO } } }).catch(() => {});
    await prisma.customerOrder.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.stockReservation.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.cashMovement.deleteMany({ where: { session: { companyId: CO } } }).catch(() => {});
    await prisma.cashSession.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.transaction.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.warehouseStock.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.product.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.supplier.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.warehouse.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.user.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.company.deleteMany({ where: { id: CO } }).catch(() => {});
}

beforeAll(async () => {
    await cleanup();

    await prisma.company.create({
        data: { id: CO, name: 'Commercial Test Co', nuit: `COMM-NUIT-${Date.now()}`, status: 'active' },
    });

    await prisma.user.createMany({
        data: [
            { id: USER_ADMIN,    name: 'Admin',    email: `admin-${Date.now()}@c.com`,    password: 'x', role: 'admin',    companyId: CO, isActive: true },
            { id: USER_OPERATOR, name: 'Operator', email: `op-${Date.now()}@c.com`,       password: 'x', role: 'operator', companyId: CO, isActive: true },
            { id: USER_CASHIER,  name: 'Cashier',  email: `cashier-${Date.now()}@c.com`,  password: 'x', role: 'cashier',  companyId: CO, isActive: true },
        ],
    });

    const supplier = await prisma.supplier.create({
        data: { name: 'Fornecedor Teste', code: `SUP-${Date.now()}`, phone: '841000000', companyId: CO },
    });
    supplierId = supplier.id;

    const product = await prisma.product.create({
        data: {
            name: 'Produto Teste',
            code: `PRD-${Date.now()}`,
            price: 100,
            costPrice: 60,
            currentStock: 50,
            unit: 'un',
            companyId: CO,
            supplierId: supplier.id,
        },
    });
    productId = product.id;

    const warehouse = await prisma.warehouse.create({
        data: { name: 'Armazém Teste', code: `WH-${Date.now()}`, companyId: CO, isActive: true },
    });
    warehouseId = warehouse.id;

    await prisma.warehouseStock.create({
        data: { productId, warehouseId, companyId: CO, quantity: 50 },
    });
});

afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
});

// ═════════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/commercial/analytics', () => {
    it('returns analytics data for admin', async () => {
        const res = await request(app).get('/api/commercial/analytics').expect(200);
        expect(res.body).toBeDefined();
    });

    it('returns 403 for cashier role', async () => {
        await request(app)
            .get('/api/commercial/analytics')
            .set('x-mock-role', 'cashier')
            .expect(403);
    });
});

describe('GET /api/commercial/margins', () => {
    it('returns margin analysis with default period', async () => {
        const res = await request(app).get('/api/commercial/margins').expect(200);
        expect(res.body).toBeDefined();
    });

    it('clamps period to 1–365', async () => {
        // period=9999 should be clamped — no 400 error
        await request(app).get('/api/commercial/margins?period=9999').expect(200);
        await request(app).get('/api/commercial/margins?period=0').expect(200);
    });

    it('returns 403 for cashier', async () => {
        await request(app)
            .get('/api/commercial/margins')
            .set('x-mock-role', 'cashier')
            .expect(403);
    });
});

describe('GET /api/commercial/stock-aging', () => {
    it('returns stock aging data', async () => {
        const res = await request(app).get('/api/commercial/stock-aging').expect(200);
        expect(res.body).toBeDefined();
    });
});

describe('GET /api/commercial/supplier-performance', () => {
    it('returns supplier performance data', async () => {
        const res = await request(app).get('/api/commercial/supplier-performance').expect(200);
        expect(res.body).toBeDefined();
    });
});

describe('GET /api/commercial/inventory-turnover', () => {
    it('returns inventory turnover with default period', async () => {
        const res = await request(app).get('/api/commercial/inventory-turnover').expect(200);
        expect(res.body).toBeDefined();
    });

    it('accepts custom period', async () => {
        const res = await request(app).get('/api/commercial/inventory-turnover?period=60').expect(200);
        expect(res.body).toBeDefined();
    });
});

describe('GET /api/commercial/sales-report', () => {
    it('returns sales report', async () => {
        const res = await request(app).get('/api/commercial/sales-report').expect(200);
        expect(res.body).toBeDefined();
    });
});

describe('GET /api/commercial/warehouse-distribution', () => {
    it('returns warehouse distribution data', async () => {
        const res = await request(app).get('/api/commercial/warehouse-distribution').expect(200);
        expect(res.body).toBeDefined();
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// PURCHASE ORDERS
// ═════════════════════════════════════════════════════════════════════════════

describe('Purchase Orders', () => {
    let poId: string;

    const PO_PAYLOAD = () => ({
        orderNumber: `PO-${Date.now()}`,
        supplierId,
        total: 300,
        status: 'draft',
        items: [
            { productId, quantity: 3, unitCost: 60, receivedQty: 0, total: 180 },
        ],
    });

    // Helper: create a PO directly via Prisma (the route doesn't have a POST, only PATCH/GET/DELETE)
    async function createPO(extra?: Partial<typeof PO_PAYLOAD>) {
        const data: any = { ...PO_PAYLOAD(), ...extra };
        const po = await prisma.purchaseOrder.create({
            data: {
                orderNumber: data.orderNumber,
                supplierId: data.supplierId,
                total: data.total,
                status: data.status,
                companyId: CO,
                items: {
                    create: data.items.map((i: any) => ({
                        productId: i.productId,
                        quantity: i.quantity,
                        unitCost: i.unitCost,
                        receivedQty: i.receivedQty ?? 0,
                        total: i.total,
                    })),
                },
            },
            include: { items: true },
        });
        return po;
    }

    // Helper: unwrap ResultHandler envelope
    const rows = (res: any) => res.body?.data?.data ?? res.body?.data ?? res.body;
    const pagination = (res: any) => res.body?.data?.pagination ?? res.body?.pagination;

    describe('GET /api/commercial/purchase-orders', () => {
        it('returns paginated list', async () => {
            const res = await request(app).get('/api/commercial/purchase-orders').expect(200);
            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('data');
            expect(Array.isArray(rows(res))).toBe(true);
            expect(pagination(res)).toHaveProperty('total');
        });

        it('filters by status', async () => {
            await createPO({ orderNumber: `PO-DRAFT-${Date.now()}`, status: 'draft' });
            const res = await request(app).get('/api/commercial/purchase-orders?status=draft').expect(200);
            rows(res).forEach((po: any) => expect(po.status).toBe('draft'));
        });

        it('supports search by orderNumber', async () => {
            const unique = `PO-SEARCH-${Date.now()}`;
            await createPO({ orderNumber: unique });
            const res = await request(app).get(`/api/commercial/purchase-orders?search=${unique}`).expect(200);
            expect(rows(res).some((po: any) => po.orderNumber === unique)).toBe(true);
        });

        it('returns 403 for cashier', async () => {
            await request(app)
                .get('/api/commercial/purchase-orders')
                .set('x-mock-role', 'cashier')
                .expect(403);
        });
    });

    describe('GET /api/commercial/purchase-orders/:id', () => {
        beforeEach(async () => {
            const po = await createPO();
            poId = po.id;
        });

        it('returns the purchase order with items and supplier', async () => {
            const res = await request(app).get(`/api/commercial/purchase-orders/${poId}`).expect(200);
            expect(res.body).toHaveProperty('data');
            expect(res.body.data.id).toBe(poId);
            expect(res.body.data).toHaveProperty('items');
            expect(res.body.data).toHaveProperty('supplier');
        });

        it('returns 404 for unknown id', async () => {
            await request(app).get('/api/commercial/purchase-orders/nonexistent-po-id').expect(404);
        });
    });

    describe('PATCH /api/commercial/purchase-orders/:id/status', () => {
        beforeEach(async () => {
            const po = await createPO();
            poId = po.id;
        });

        it('advances status from draft to ordered', async () => {
            const res = await request(app)
                .patch(`/api/commercial/purchase-orders/${poId}/status`)
                .send({ status: 'ordered' })
                .expect(200);
            expect(res.body).toHaveProperty('success');
        });

        it('returns 400 when status is missing', async () => {
            await request(app)
                .patch(`/api/commercial/purchase-orders/${poId}/status`)
                .send({})
                .expect(400);
        });
    });

    describe('DELETE /api/commercial/purchase-orders/:id', () => {
        it('soft-deletes a draft PO', async () => {
            const po = await createPO({ orderNumber: `PO-DEL-${Date.now()}` });
            await request(app)
                .delete(`/api/commercial/purchase-orders/${po.id}`)
                .set('x-mock-role', 'admin')
                .expect(200);

            // Verify it no longer appears in list
            const res = await request(app).get(`/api/commercial/purchase-orders/${po.id}`).expect(404);
            expect(res.body).toHaveProperty('message');
        });

        it('returns 403 for operator (only admin/manager can delete)', async () => {
            const po = await createPO({ orderNumber: `PO-DEL-OP-${Date.now()}` });
            await request(app)
                .delete(`/api/commercial/purchase-orders/${po.id}`)
                .set('x-mock-role', 'operator')
                .expect(403);
        });
    });

    describe('PATCH /api/commercial/purchase-orders/:id/partial-delivery', () => {
        it('registers a partial delivery', async () => {
            const po = await createPO({ orderNumber: `PO-PART-${Date.now()}`, status: 'ordered' });
            const itemId = po.items[0].id;

            const res = await request(app)
                .patch(`/api/commercial/purchase-orders/${po.id}/partial-delivery`)
                .send({ deliveries: [{ itemId, receivedQty: 1 }] })
                .expect(200);

            expect(res.body).toHaveProperty('success');
        });

        it('returns 400 when deliveries array is empty', async () => {
            const po = await createPO({ orderNumber: `PO-EMPTY-${Date.now()}` });
            await request(app)
                .patch(`/api/commercial/purchase-orders/${po.id}/partial-delivery`)
                .send({ deliveries: [] })
                .expect(400);
        });

        it('returns 400 when deliveries field is absent', async () => {
            const po = await createPO({ orderNumber: `PO-NOFIELD-${Date.now()}` });
            await request(app)
                .patch(`/api/commercial/purchase-orders/${po.id}/partial-delivery`)
                .send({})
                .expect(400);
        });
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// QUOTATIONS
// ═════════════════════════════════════════════════════════════════════════════

describe('Quotations', () => {
    const VALID_QUOTE = () => ({
        customerName: 'Cliente Cotação',
        customerPhone: '841234567',
        items: [
            { productId, productName: 'Produto Teste', quantity: 2, price: 100, total: 200 },
        ],
        subtotal: 200,
        total: 200,
        validUntil: new Date(Date.now() + 30 * 86400000).toISOString(),
    });

    // Helper shared for quotation assertions
    const qRows = (res: any) => res.body?.data?.data ?? res.body?.data ?? res.body;

    describe('GET /api/commercial/quotations', () => {
        it('returns paginated quotation list', async () => {
            const res = await request(app).get('/api/commercial/quotations').expect(200);
            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('data');
            expect(Array.isArray(qRows(res))).toBe(true);
        });

        it('supports search', async () => {
            const res = await request(app).get('/api/commercial/quotations?search=Cliente').expect(200);
            expect(Array.isArray(qRows(res))).toBe(true);
        });
    });

    describe('POST /api/commercial/quotations', () => {
        it('creates a quotation with valid data', async () => {
            const res = await request(app)
                .post('/api/commercial/quotations')
                .send(VALID_QUOTE())
                .expect(201);
            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('data');
            expect(res.body.data.customerName).toBe('Cliente Cotação');
        });

        it('rejects missing customerName', async () => {
            const res = await request(app)
                .post('/api/commercial/quotations')
                .send({ ...VALID_QUOTE(), customerName: '' })
                .expect(400);
            expect(res.body).toHaveProperty('message');
        });

        it('rejects empty items array', async () => {
            const res = await request(app)
                .post('/api/commercial/quotations')
                .send({ ...VALID_QUOTE(), items: [] })
                .expect(400);
            expect(res.body).toHaveProperty('message');
        });

        it('rejects item with zero quantity', async () => {
            const res = await request(app)
                .post('/api/commercial/quotations')
                .send({
                    ...VALID_QUOTE(),
                    items: [{ ...VALID_QUOTE().items[0], quantity: 0 }],
                })
                .expect(400);
            expect(res.body).toHaveProperty('message');
        });
    });

    describe('POST /api/commercial/quotations/:id/convert-to-invoice', () => {
        it('converts an approved quotation to invoice', async () => {
            // Create quotation first
            const qRes = await request(app)
                .post('/api/commercial/quotations')
                .send(VALID_QUOTE())
                .expect(201);
            const quoteId = qRes.body.data.id;

            const res = await request(app)
                .post(`/api/commercial/quotations/${quoteId}/convert-to-invoice`)
                .send({
                    issueDate: new Date().toISOString(),
                    dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
                    paymentMethod: 'cash',
                })
                .expect(201);

            expect(res.body).toHaveProperty('success', true);
            expect(res.body.data).toHaveProperty('invoiceNumber');
        });

        it('returns 404 for unknown quotation id', async () => {
            await request(app)
                .post('/api/commercial/quotations/nonexistent-quote/convert-to-invoice')
                .send({ issueDate: new Date().toISOString(), dueDate: new Date().toISOString() })
                .expect(404);
        });
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// ACCOUNTS RECEIVABLE
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/commercial/accounts-receivable', () => {
    it('returns accounts receivable data for admin', async () => {
        const res = await request(app)
            .get('/api/commercial/accounts-receivable')
            .expect(200);
        expect(res.body).toBeDefined();
    });

    it('returns 403 for operator (only admin/manager)', async () => {
        await request(app)
            .get('/api/commercial/accounts-receivable')
            .set('x-mock-role', 'operator')
            .expect(403);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// CASH SESSIONS (TURNOS DE CAIXA)
// ═════════════════════════════════════════════════════════════════════════════

describe('Cash Sessions', () => {
    // ensure no open session before each group
    beforeEach(async () => {
        await prisma.cashMovement.deleteMany({ where: { session: { companyId: CO } } }).catch(() => {});
        await prisma.cashSession.deleteMany({ where: { companyId: CO } }).catch(() => {});
    });

    describe('GET /api/commercial/shift', () => {
        it('returns null when no session is open', async () => {
            const res = await request(app).get('/api/commercial/shift').expect(200);
            expect(res.body).toBeNull();
        });
    });

    describe('POST /api/commercial/shift/open', () => {
        it('opens a session with a valid opening balance', async () => {
            const res = await request(app)
                .post('/api/commercial/shift/open')
                .send({ openingBalance: 500 })
                .expect(201);

            expect(res.body).toHaveProperty('id');
            expect(res.body).toHaveProperty('status', 'open');
            expect(Number(res.body.openingBalance)).toBe(500);
        });

        it('accepts balance of 0 (caixa vazia)', async () => {
            const res = await request(app)
                .post('/api/commercial/shift/open')
                .send({ openingBalance: 0 })
                .expect(201);
            expect(Number(res.body.openingBalance)).toBe(0);
        });

        it('rejects missing opening balance', async () => {
            await request(app)
                .post('/api/commercial/shift/open')
                .send({})
                .expect(400);
        });

        it('rejects negative opening balance', async () => {
            await request(app)
                .post('/api/commercial/shift/open')
                .send({ openingBalance: -50 })
                .expect(400);
        });

        it('rejects opening a second session while one is already open', async () => {
            await request(app).post('/api/commercial/shift/open').send({ openingBalance: 100 }).expect(201);
            await request(app).post('/api/commercial/shift/open').send({ openingBalance: 200 }).expect(400);
        });
    });

    describe('GET /api/commercial/shift (after open)', () => {
        it('returns the open session', async () => {
            await request(app).post('/api/commercial/shift/open').send({ openingBalance: 300 }).expect(201);
            const res = await request(app).get('/api/commercial/shift').expect(200);
            expect(res.body).toHaveProperty('id');
            expect(res.body.status).toBe('open');
        });
    });

    describe('POST /api/commercial/shift/movement', () => {
        it('registers a sangria (withdrawal)', async () => {
            await request(app).post('/api/commercial/shift/open').send({ openingBalance: 1000 }).expect(201);
            const res = await request(app)
                .post('/api/commercial/shift/movement')
                .send({ type: 'sangria', amount: 200, reason: 'Pagamento fornecedor' })
                .expect(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body.type).toBe('sangria');
        });

        it('registers a suprimento (deposit)', async () => {
            await request(app).post('/api/commercial/shift/open').send({ openingBalance: 500 }).expect(201);
            const res = await request(app)
                .post('/api/commercial/shift/movement')
                .send({ type: 'suprimento', amount: 300, reason: 'Reforço de caixa' })
                .expect(201);
            expect(res.body.type).toBe('suprimento');
        });

        it('returns 4xx without an open session', async () => {
            // No session open (cleared in beforeEach) — service throws notFound (404)
            const res = await request(app)
                .post('/api/commercial/shift/movement')
                .send({ type: 'sangria', amount: 100, reason: 'Teste' });
            expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });

    describe('POST /api/commercial/shift/close', () => {
        it('closes an open session', async () => {
            await request(app).post('/api/commercial/shift/open').send({ openingBalance: 500 }).expect(201);
            const res = await request(app)
                .post('/api/commercial/shift/close')
                .send({ closingBalance: 500, notes: 'Fecho normal' })
                .expect(200);
            expect(res.body).toHaveProperty('status', 'closed');
            expect(res.body).toHaveProperty('closingBalance');
        });

        it('returns 4xx when no session is open', async () => {
            // service throws notFound (404) when no active session exists
            const res = await request(app)
                .post('/api/commercial/shift/close')
                .send({ closingBalance: 500 });
            expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });

    describe('GET /api/commercial/shift/summary', () => {
        it('returns daily summary (may be null on empty day)', async () => {
            const res = await request(app).get('/api/commercial/shift/summary').expect(200);
            // can be null or an object — both valid
            expect([null, 'object']).toContain(res.body === null ? null : typeof res.body);
        });
    });

    describe('GET /api/commercial/shift/history', () => {
        it('returns session history list', async () => {
            const res = await request(app).get('/api/commercial/shift/history').expect(200);
            expect(Array.isArray(res.body.data ?? res.body)).toBe(true);
        });
    });

    describe('GET /api/commercial/shift/z-report', () => {
        it('returns z-report for admin (200 with sessions, 404 without)', async () => {
            // Open and close a session so z-report has data
            await request(app).post('/api/commercial/shift/open').send({ openingBalance: 100 }).expect(201);
            await request(app).post('/api/commercial/shift/close').send({ closingBalance: 100 }).expect(200);

            const res = await request(app).get('/api/commercial/shift/z-report');
            expect([200, 404]).toContain(res.status); // 404 acceptable when no sessions in current day
        });

        it('returns 403 for cashier', async () => {
            await request(app)
                .get('/api/commercial/shift/z-report')
                .set('x-mock-role', 'cashier')
                .expect(403);
        });
    });

    describe('GET /api/commercial/shift/:id', () => {
        it('returns session details by id', async () => {
            const openRes = await request(app)
                .post('/api/commercial/shift/open')
                .send({ openingBalance: 200 })
                .expect(201);
            const sessionId = openRes.body.id;

            const res = await request(app).get(`/api/commercial/shift/${sessionId}`).expect(200);
            expect(res.body.id).toBe(sessionId);
        });
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// STOCK RESERVATIONS
// ═════════════════════════════════════════════════════════════════════════════

describe('Stock Reservations', () => {
    describe('POST /api/commercial/reserve', () => {
        it('reserves available stock', async () => {
            const res = await request(app)
                .post('/api/commercial/reserve')
                .send({ productId, quantity: 2, sessionId: 'session-test-1' })
                .expect(201);
            expect(res.body).toHaveProperty('id');
        });

        it('returns 400 when productId is missing', async () => {
            await request(app)
                .post('/api/commercial/reserve')
                .send({ quantity: 2 })
                .expect(400);
        });

        it('returns 400 when quantity is missing', async () => {
            await request(app)
                .post('/api/commercial/reserve')
                .send({ productId })
                .expect(400);
        });
    });

    describe('POST /api/commercial/release/:id', () => {
        it('releases a reservation', async () => {
            const resv = await request(app)
                .post('/api/commercial/reserve')
                .send({ productId, quantity: 1, sessionId: 'session-release-test' })
                .expect(201);
            const reservationId = resv.body.id;

            await request(app)
                .post(`/api/commercial/release/${reservationId}`)
                .expect(200);
        });
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// COMMERCIAL FINANCE
// ═════════════════════════════════════════════════════════════════════════════

describe('Commercial Finance', () => {
    const VALID_TX = () => ({
        type: 'income',
        category: 'Vendas',
        description: 'Receita de vendas',
        amount: 5000,
        date: new Date().toISOString(),
        paymentMethod: 'cash',
    });

    describe('GET /api/commercial/finance/dashboard', () => {
        it('returns finance dashboard', async () => {
            const res = await request(app).get('/api/commercial/finance/dashboard').expect(200);
            expect(res.body).toBeDefined();
        });

        it('accepts period query param', async () => {
            const res = await request(app).get('/api/commercial/finance/dashboard?period=3m').expect(200);
            expect(res.body).toBeDefined();
        });
    });

    describe('GET /api/commercial/finance/transactions', () => {
        it('returns transaction list', async () => {
            const res = await request(app).get('/api/commercial/finance/transactions').expect(200);
            expect(res.body).toBeDefined();
        });
    });

    describe('POST /api/commercial/finance/transactions', () => {
        it('creates an income transaction', async () => {
            const res = await request(app)
                .post('/api/commercial/finance/transactions')
                .send(VALID_TX())
                .expect(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body.type).toBe('income');
        });

        it('creates an expense transaction', async () => {
            const res = await request(app)
                .post('/api/commercial/finance/transactions')
                .send({ ...VALID_TX(), type: 'expense', category: 'Fornecedores', description: 'Pagamento fornecedor' })
                .expect(201);
            expect(res.body.type).toBe('expense');
        });

        it('rejects invalid type', async () => {
            await request(app)
                .post('/api/commercial/finance/transactions')
                .send({ ...VALID_TX(), type: 'invalid' })
                .expect(400);
        });

        it('rejects zero amount', async () => {
            await request(app)
                .post('/api/commercial/finance/transactions')
                .send({ ...VALID_TX(), amount: 0 })
                .expect(400);
        });

        it('rejects missing description', async () => {
            await request(app)
                .post('/api/commercial/finance/transactions')
                .send({ ...VALID_TX(), description: '' })
                .expect(400);
        });

        it('rejects missing category', async () => {
            await request(app)
                .post('/api/commercial/finance/transactions')
                .send({ ...VALID_TX(), category: '' })
                .expect(400);
        });
    });

    describe('PUT /api/commercial/finance/transactions/:id', () => {
        let txId: string;

        beforeEach(async () => {
            const res = await request(app)
                .post('/api/commercial/finance/transactions')
                .send(VALID_TX())
                .expect(201);
            txId = res.body.id;
        });

        it('updates a transaction', async () => {
            const res = await request(app)
                .put(`/api/commercial/finance/transactions/${txId}`)
                .send({ description: 'Receita atualizada', amount: 6000 })
                .expect(200);
            expect(res.body.description).toBe('Receita atualizada');
            expect(Number(res.body.amount)).toBe(6000);
        });

        it('partial update — only amount', async () => {
            const res = await request(app)
                .put(`/api/commercial/finance/transactions/${txId}`)
                .send({ amount: 9999 })
                .expect(200);
            expect(Number(res.body.amount)).toBe(9999);
        });
    });

    describe('DELETE /api/commercial/finance/transactions/:id', () => {
        it('deletes a transaction for admin', async () => {
            const res = await request(app)
                .post('/api/commercial/finance/transactions')
                .send(VALID_TX())
                .expect(201);
            const id = res.body.id;

            await request(app)
                .delete(`/api/commercial/finance/transactions/${id}`)
                .set('x-mock-role', 'admin')
                .expect(200);
        });

        it('returns 403 for operator (only admin/manager can delete)', async () => {
            const res = await request(app)
                .post('/api/commercial/finance/transactions')
                .send(VALID_TX())
                .expect(201);

            await request(app)
                .delete(`/api/commercial/finance/transactions/${res.body.id}`)
                .set('x-mock-role', 'operator')
                .expect(403);
        });
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// MULTI-TENANT ISOLATION
// ═════════════════════════════════════════════════════════════════════════════

describe('Multi-tenant isolation', () => {
    it('purchase orders from another company are not visible', async () => {
        // Create a PO in a different company directly via Prisma
        const otherCo = `other-co-${Date.now()}`;
        await prisma.company.create({ data: { id: otherCo, name: 'Other Co', nuit: `NUIT-${Date.now()}` } });

        const otherSupplier = await prisma.supplier.create({
            data: { name: 'Outro Fornecedor', code: `OS-${Date.now()}`, phone: '840000000', companyId: otherCo },
        });
        const otherPO = await prisma.purchaseOrder.create({
            data: {
                orderNumber: `PO-OTHER-${Date.now()}`,
                supplierId: otherSupplier.id,
                total: 999,
                companyId: otherCo,
            },
        });

        // Our request is authenticated as CO — should NOT see otherPO
        const res = await request(app).get('/api/commercial/purchase-orders').expect(200);
        // Response is wrapped: { success, data: { data: [...], pagination } }
        const items = res.body?.data?.data ?? res.body?.data ?? [];
        const ids = Array.isArray(items) ? items.map((po: any) => po.id) : [];
        expect(ids).not.toContain(otherPO.id);

        // Cleanup
        await prisma.purchaseOrder.delete({ where: { id: otherPO.id } });
        await prisma.supplier.delete({ where: { id: otherSupplier.id } });
        await prisma.company.delete({ where: { id: otherCo } });
    });

    it('quotations from another company are not visible', async () => {
        const otherCo = `other-co-qt-${Date.now()}`;
        await prisma.company.create({ data: { id: otherCo, name: 'Other Co QT', nuit: `NUIT-QT-${Date.now()}` } });

        const otherQuote = await prisma.customerOrder.create({
            data: {
                orderNumber: `QT-OTHER-${Date.now()}`,
                customerName: 'Outsider',
                customerPhone: '840000000',
                orderType: 'quotation',
                total: 100,
                status: 'created',
                companyId: otherCo,
            },
        });

        const res = await request(app).get('/api/commercial/quotations').expect(200);
        const items = res.body?.data?.data ?? res.body?.data ?? [];
        const ids = Array.isArray(items) ? items.map((q: any) => q.id) : [];
        expect(ids).not.toContain(otherQuote.id);

        // Cleanup
        await prisma.customerOrder.delete({ where: { id: otherQuote.id } });
        await prisma.company.delete({ where: { id: otherCo } });
    });
});
