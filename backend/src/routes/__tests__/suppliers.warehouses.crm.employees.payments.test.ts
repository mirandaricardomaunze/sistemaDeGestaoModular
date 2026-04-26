/**
 * Test suite covering 5 modules:
 *  - Suppliers  (/api/suppliers)
 *  - Warehouses (/api/warehouses)
 *  - CRM        (/api/crm)
 *  - Employees  (/api/employees)
 *  - Payments   (/api/payments)
 */

import request from 'supertest';
import { app } from '../../index';
import { prisma } from '../../lib/prisma';

// ── Auth mock ─────────────────────────────────────────────────────────────────

const CO  = 'multi-test-co';
const UID = 'multi-test-user';

jest.mock('../../middleware/auth', () => ({
    authenticate: (req: any, _res: any, next: any) => {
        req.userId    = req.headers['x-mock-uid']  || UID;
        req.companyId = req.headers['x-mock-co']   || CO;
        req.userRole  = req.headers['x-mock-role'] || 'admin';
        req.userName  = 'Test User';
        next();
    },
    authorize: (...roles: string[]) => (req: any, res: any, next: any) => {
        if (!roles.includes(req.userRole)) return res.status(403).json({ message: 'Acesso negado' });
        next();
    },
    AuthRequest: {} as any,
}));

jest.mock('../../lib/socket', () => ({
    initSocket: jest.fn().mockReturnValue({ on: jest.fn() }),
    emitToCompany: jest.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

// Result service wraps: { success, data: payload } where payload may be paginated { data, pagination }
const unwrap = (res: any) => res.body?.data ?? res.body;
const rows   = (res: any) => {
    const d = res.body?.data;
    return Array.isArray(d) ? d : (d?.data ?? res.body);
};

// ── Setup / Teardown ──────────────────────────────────────────────────────────

async function cleanup() {
    await prisma.interaction.deleteMany({ where: { opportunity: { companyId: CO } } }).catch(() => {});
    await prisma.stageHistory.deleteMany({ where: { opportunity: { companyId: CO } } }).catch(() => {});
    await prisma.opportunity.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.funnelStage.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.vacationRequest.deleteMany({ where: { employee: { companyId: CO } } }).catch(() => {});
    await prisma.attendanceRecord.deleteMany({ where: { employee: { companyId: CO } } }).catch(() => {});
    await prisma.payrollRecord.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.employee.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.mpesaTransaction.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.stockTransferItem.deleteMany({ where: { transfer: { companyId: CO } } }).catch(() => {});
    await prisma.stockTransfer.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.warehouseStock.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.warehouse.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { companyId: CO } } }).catch(() => {});
    await prisma.purchaseOrder.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.supplier.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.product.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { companyId: CO } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: UID } }).catch(() => {});
    await prisma.company.deleteMany({ where: { id: CO } }).catch(() => {});
}

beforeAll(async () => {
    await cleanup();
    await prisma.company.create({ data: { id: CO, name: 'Multi Test Co', nuit: `MULTI-${Date.now()}`, status: 'active' } });
    await prisma.user.create({ data: { id: UID, name: 'Admin', email: `adm-${Date.now()}@t.com`, password: 'x', role: 'admin', companyId: CO, isActive: true } });
});

afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
});

// =============================================================================
// SUPPLIERS
// =============================================================================

describe('Suppliers', () => {
    const VALID = { name: 'Fornecedor Teste', phone: '841000001' };

    describe('GET /api/suppliers', () => {
        it('returns paginated list', async () => {
            const res = await request(app).get('/api/suppliers').expect(200);
            expect(res.body).toHaveProperty('data');
            expect(res.body).toHaveProperty('pagination');
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        it('supports search query', async () => {
            const res = await request(app).get('/api/suppliers?search=Fornecedor').expect(200);
            expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    describe('POST /api/suppliers', () => {
        it('creates a supplier', async () => {
            const res = await request(app).post('/api/suppliers').send(VALID).expect(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body.name).toBe('Fornecedor Teste');
        });

        it('rejects name shorter than 2 chars', async () => {
            await request(app).post('/api/suppliers').send({ ...VALID, name: 'A' }).expect(400);
        });

        it('rejects invalid email format', async () => {
            await request(app).post('/api/suppliers').send({ ...VALID, email: 'not-an-email' }).expect(400);
        });
    });

    describe('Supplier lifecycle', () => {
        let supplierId: string;

        beforeEach(async () => {
            const res = await request(app).post('/api/suppliers').send({ name: `Sup-${Date.now()}`, phone: '841000002' }).expect(201);
            supplierId = res.body.id;
        });

        it('GET /api/suppliers/:id returns the supplier', async () => {
            const res = await request(app).get(`/api/suppliers/${supplierId}`).expect(200);
            expect(res.body.id).toBe(supplierId);
        });

        it('PUT /api/suppliers/:id updates the supplier', async () => {
            const res = await request(app).put(`/api/suppliers/${supplierId}`).send({ name: 'Atualizado' }).expect(200);
            expect(res.body.name).toBe('Atualizado');
        });

        it('DELETE /api/suppliers/:id removes the supplier', async () => {
            await request(app).delete(`/api/suppliers/${supplierId}`).expect(200);
        });

        it('returns 404 for unknown id', async () => {
            await request(app).get('/api/suppliers/nonexistent-sup-id').expect(404);
        });
    });

    describe('Multi-tenant isolation', () => {
        it('supplier from another company is not visible', async () => {
            const other = `other-sup-${Date.now()}`;
            await prisma.company.create({ data: { id: other, name: 'Other', nuit: `NUIT-${Date.now()}` } });
            const s = await prisma.supplier.create({ data: { name: 'Outsider', code: `OS-${Date.now()}`, phone: '800', companyId: other } });

            const res = await request(app).get('/api/suppliers').expect(200);
            expect(res.body.data.map((x: any) => x.id)).not.toContain(s.id);

            await prisma.supplier.delete({ where: { id: s.id } });
            await prisma.company.delete({ where: { id: other } });
        });
    });
});

// =============================================================================
// WAREHOUSES
// =============================================================================

describe('Warehouses', () => {
    let wh1Id: string;
    let wh2Id: string;
    let productId: string;

    beforeAll(async () => {
        const w1 = await prisma.warehouse.create({ data: { name: 'WH-1', code: `W1-${Date.now()}`, companyId: CO, isActive: true } });
        const w2 = await prisma.warehouse.create({ data: { name: 'WH-2', code: `W2-${Date.now()}`, companyId: CO, isActive: true } });
        wh1Id = w1.id; wh2Id = w2.id;

        const p = await prisma.product.create({ data: { name: 'Produto WH', code: `PWH-${Date.now()}`, price: 10, unit: 'un', companyId: CO, currentStock: 20 } });
        productId = p.id;

        await prisma.warehouseStock.create({ data: { productId, warehouseId: wh1Id, companyId: CO, quantity: 20 } });
    });

    describe('GET /api/warehouses', () => {
        it('returns warehouse list', async () => {
            const res = await request(app).get('/api/warehouses').expect(200);
            expect(Array.isArray(res.body)).toBe(true);
        });
    });

    describe('POST /api/warehouses', () => {
        it('creates a warehouse with auto-generated code', async () => {
            const res = await request(app).post('/api/warehouses').send({ name: 'Novo Armazém' }).expect(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body.name).toBe('Novo Armazém');
        });

        it('creates a warehouse with explicit code', async () => {
            const res = await request(app).post('/api/warehouses').send({ name: 'Armazém B', code: `CUST-${Date.now()}` }).expect(201);
            expect(res.body).toHaveProperty('id');
        });
    });

    describe('Warehouse lifecycle', () => {
        let whId: string;

        beforeEach(async () => {
            const res = await request(app).post('/api/warehouses').send({ name: 'Temp WH' }).expect(201);
            whId = res.body.id;
        });

        it('GET /api/warehouses/:id returns the warehouse', async () => {
            const res = await request(app).get(`/api/warehouses/${whId}`).expect(200);
            expect(res.body.id).toBe(whId);
        });

        it('PUT /api/warehouses/:id updates the warehouse', async () => {
            const res = await request(app).put(`/api/warehouses/${whId}`).send({ name: 'Updated WH' }).expect(200);
            expect(res.body.name).toBe('Updated WH');
        });

        it('DELETE /api/warehouses/:id deactivates empty warehouse', async () => {
            await request(app).delete(`/api/warehouses/${whId}`).expect(200);
        });

        it('returns 404 for unknown id', async () => {
            await request(app).get('/api/warehouses/nonexistent-wh-id').expect(404);
        });
    });

    describe('Stock Transfers', () => {
        it('GET /api/warehouses/transfers/all returns list', async () => {
            const res = await request(app).get('/api/warehouses/transfers/all').expect(200);
            const data = res.body?.data?.data ?? res.body?.data ?? res.body;
            expect(Array.isArray(data)).toBe(true);
        });

        it('POST /api/warehouses/transfers creates a transfer', async () => {
            const res = await request(app)
                .post('/api/warehouses/transfers')
                .send({
                    sourceWarehouseId: wh1Id,
                    targetWarehouseId: wh2Id,
                    items: [{ productId, quantity: 2 }],
                    responsible: 'Test User',
                    notes: 'Transferência de teste',
                })
                .expect(201);
            expect(res.body).toHaveProperty('id');
        });

        it('rejects transfer when source equals destination', async () => {
            await request(app)
                .post('/api/warehouses/transfers')
                .send({ sourceWarehouseId: wh1Id, targetWarehouseId: wh1Id, items: [{ productId, quantity: 1 }] })
                .expect(400);
        });
    });
});

// =============================================================================
// CRM
// =============================================================================

describe('CRM', () => {
    let stageId: string;
    let oppId: string;

    beforeAll(async () => {
        const stage = await prisma.funnelStage.create({
            data: { name: 'Prospeção', code: `STG-${Date.now()}`, type: 'lead', order: 1, color: '#3b82f6', companyId: CO },
        });
        stageId = stage.id;
    });

    describe('GET /api/crm/stages', () => {
        it('returns funnel stages list', async () => {
            const res = await request(app).get('/api/crm/stages').expect(200);
            expect(Array.isArray(res.body)).toBe(true);
        });
    });

    describe('POST /api/crm/stages', () => {
        it('creates a stage with required fields', async () => {
            const res = await request(app)
                .post('/api/crm/stages')
                .send({ name: 'Qualificação', code: `QUA-${Date.now()}`, type: 'qualified', order: 2, color: '#10b981' })
                .expect(201);
            expect(res.body).toHaveProperty('id');
        });

        it('returns 403 for operator', async () => {
            await request(app)
                .post('/api/crm/stages')
                .set('x-mock-role', 'operator')
                .send({ name: 'X', code: 'XX', type: 'lead', order: 9 })
                .expect(403);
        });
    });

    describe('Opportunities', () => {
        const OPP = () => ({
            title: 'Oportunidade Teste',
            stageId,
            stageType: 'lead',
            value: 5000,
            probability: 60,
            expectedCloseDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        });

        describe('GET /api/crm/opportunities', () => {
            it('returns paginated list', async () => {
                const res = await request(app).get('/api/crm/opportunities').expect(200);
                expect(Array.isArray(rows(res))).toBe(true);
            });
        });

        describe('POST /api/crm/opportunities', () => {
            it('creates an opportunity', async () => {
                const res = await request(app).post('/api/crm/opportunities').send(OPP()).expect(201);
                expect(res.body).toHaveProperty('id');
                oppId = res.body.id;
            });

            it('rejects missing title (omitted field)', async () => {
                // Route passes body directly to Prisma — omitting required `title` causes Prisma 400
                const { title: _, ...withoutTitle } = OPP();
                await request(app).post('/api/crm/opportunities').send(withoutTitle).expect(400);
            });

            it('rejects missing stageId', async () => {
                await request(app).post('/api/crm/opportunities').send({ ...OPP(), stageId: undefined }).expect(400);
            });
        });

        describe('GET /api/crm/opportunities/:id', () => {
            it('returns the opportunity', async () => {
                if (!oppId) { oppId = (await request(app).post('/api/crm/opportunities').send(OPP()).expect(201)).body.id; }
                const res = await request(app).get(`/api/crm/opportunities/${oppId}`).expect(200);
                expect(res.body.id).toBe(oppId);
            });

            it('returns 404 for unknown id', async () => {
                await request(app).get('/api/crm/opportunities/nonexistent-opp').expect(404);
            });
        });

        describe('PUT /api/crm/opportunities/:id', () => {
            it('updates the opportunity', async () => {
                if (!oppId) { oppId = (await request(app).post('/api/crm/opportunities').send(OPP()).expect(201)).body.id; }
                const res = await request(app).put(`/api/crm/opportunities/${oppId}`).send({ value: 8000 }).expect(200);
                expect(Number(res.body.value)).toBe(8000);
            });
        });

        describe('Interactions', () => {
            it('POST /api/crm/opportunities/:id/interactions creates an interaction', async () => {
                if (!oppId) { oppId = (await request(app).post('/api/crm/opportunities').send(OPP()).expect(201)).body.id; }
                const res = await request(app)
                    .post(`/api/crm/opportunities/${oppId}/interactions`)
                    .send({ type: 'call', notes: 'Chamada inicial' })
                    .expect(201);
                expect(res.body).toHaveProperty('id');
            });

            it('GET /api/crm/opportunities/:id/interactions returns list', async () => {
                if (!oppId) { oppId = (await request(app).post('/api/crm/opportunities').send(OPP()).expect(201)).body.id; }
                const res = await request(app).get(`/api/crm/opportunities/${oppId}/interactions`).expect(200);
                expect(Array.isArray(res.body)).toBe(true);
            });
        });
    });
});

// =============================================================================
// EMPLOYEES
// =============================================================================

describe('Employees', () => {
    describe('GET /api/employees', () => {
        it('returns paginated employee list for admin', async () => {
            const res = await request(app).get('/api/employees').expect(200);
            // service returns ResultHandler.success({ data: [...], pagination })
            // → { success: true, data: { data: [...], pagination: {...} } }
            expect(res.body).toHaveProperty('success', true);
            expect(Array.isArray(res.body.data?.data ?? res.body.data)).toBe(true);
        });

        it('returns 403 for cashier', async () => {
            await request(app).get('/api/employees').set('x-mock-role', 'cashier').expect(403);
        });
    });

    describe('Employee payroll & HR', () => {
        let empId: string;

        beforeAll(async () => {
            const emp = await prisma.employee.create({
                data: {
                    name: `Emp-${Date.now()}`,
                    email: `e-${Date.now()}@t.com`,
                    phone: '849999999',
                    role: 'operator',
                    hireDate: new Date(),
                    baseSalary: 12000,
                    code: `EMP-${Date.now()}`,
                    companyId: CO,
                },
            });
            empId = emp.id;
        });

        it('GET /api/employees/payroll returns list', async () => {
            const res = await request(app).get('/api/employees/payroll').expect(200);
            const data = rows(res);
            expect(Array.isArray(data)).toBe(true);
        });

        it('POST /api/employees/payroll creates a record', async () => {
            const now = new Date();
            const res = await request(app)
                .post('/api/employees/payroll')
                .send({
                    employeeId: empId,
                    month: now.getMonth() + 1,
                    year: now.getFullYear(),
                    baseSalary: 12000,
                    otHours: 0,
                    otAmount: 0,
                    bonus: 0,
                    allowances: 0,
                    inssDeduction: 360,
                    irtDeduction: 0,
                    advances: 0,
                    totalEarnings: 12000,
                    totalDeductions: 360,
                    netSalary: 11640,
                })
                .expect(200);
            expect(unwrap(res)).toHaveProperty('id');
        });

        it('GET /api/employees/vacations returns list', async () => {
            const res = await request(app).get('/api/employees/vacations').expect(200);
            expect(Array.isArray(rows(res))).toBe(true);
        });

        it('POST /api/employees/vacations creates a vacation request', async () => {
            const res = await request(app)
                .post('/api/employees/vacations')
                .send({
                    employeeId: empId,
                    startDate: new Date(Date.now() + 7 * 86400000).toISOString(),
                    endDate: new Date(Date.now() + 14 * 86400000).toISOString(),
                    days: 7,
                    notes: 'Férias anuais',
                })
                .expect(201);
            expect(unwrap(res)).toHaveProperty('id');
        });

        it('GET /api/employees/attendance returns paginated records', async () => {
            const res = await request(app).get('/api/employees/attendance').expect(200);
            // returns { success, data: { data, summary, pagination } }
            expect(res.body).toHaveProperty('success', true);
            const inner = res.body?.data?.data;
            expect(Array.isArray(inner)).toBe(true);
        });
    });

    describe('Commission rules', () => {
        it('GET /api/employees/commissions/rules returns list for admin', async () => {
            const res = await request(app).get('/api/employees/commissions/rules').expect(200);
            // returns ResultHandler.success(rules) → { success: true, data: [...] }
            expect(Array.isArray(unwrap(res))).toBe(true);
        });

        it('returns 403 for cashier', async () => {
            await request(app).get('/api/employees/commissions/rules').set('x-mock-role', 'cashier').expect(403);
        });
    });
});

// =============================================================================
// PAYMENTS (M-Pesa)
// =============================================================================

describe('Payments — M-Pesa', () => {
    describe('GET /api/payments/mpesa/status', () => {
        it('returns availability status', async () => {
            const res = await request(app).get('/api/payments/mpesa/status').expect(200);
            expect(res.body).toHaveProperty('available');
            expect(res.body).toHaveProperty('mode');
        });
    });

    describe('POST /api/payments/mpesa/initiate', () => {
        it('initiates payment in simulation mode', async () => {
            const res = await request(app)
                .post('/api/payments/mpesa/initiate')
                .send({ phone: '841234567', amount: 500, reference: `PAY-${Date.now()}`, module: 'pos' })
                .expect(200);
            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('transactionId');
        });

        it('rejects invalid phone (too short)', async () => {
            await request(app)
                .post('/api/payments/mpesa/initiate')
                .send({ phone: '123', amount: 100, reference: 'R1', module: 'pos' })
                .expect(400);
        });

        it('rejects negative amount', async () => {
            await request(app)
                .post('/api/payments/mpesa/initiate')
                .send({ phone: '841234567', amount: -50, reference: 'R2', module: 'pos' })
                .expect(400);
        });

        it('rejects invalid module', async () => {
            await request(app)
                .post('/api/payments/mpesa/initiate')
                .send({ phone: '841234567', amount: 100, reference: 'R3', module: 'invalid_module' })
                .expect(400);
        });
    });

    describe('GET /api/payments/mpesa/history', () => {
        it('returns paginated history', async () => {
            const res = await request(app).get('/api/payments/mpesa/history').expect(200);
            expect(res.body).toHaveProperty('data');
            expect(res.body).toHaveProperty('pagination');
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        it('filters by status', async () => {
            const res = await request(app).get('/api/payments/mpesa/history?status=completed').expect(200);
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        it('filters by module', async () => {
            const res = await request(app).get('/api/payments/mpesa/history?module=pos').expect(200);
            expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    describe('GET /api/payments/mpesa/transaction/:id', () => {
        let txId: string;

        beforeAll(async () => {
            const tx = await prisma.mpesaTransaction.create({
                data: { phone: '258841234567', amount: 200, reference: `REF-${Date.now()}`, module: 'pos', companyId: CO, status: 'completed', transactionId: `SIM-${Date.now()}` },
            });
            txId = tx.id;
        });

        it('returns the transaction', async () => {
            const res = await request(app).get(`/api/payments/mpesa/transaction/${txId}`).expect(200);
            expect(res.body.id).toBe(txId);
        });

        it('returns 404 for unknown id', async () => {
            await request(app).get('/api/payments/mpesa/transaction/nonexistent-tx').expect(404);
        });
    });

    describe('POST /api/payments/mpesa/transaction/:id/cancel', () => {
        it('cancels a pending transaction', async () => {
            const tx = await prisma.mpesaTransaction.create({
                data: { phone: '258841234567', amount: 100, reference: `REF-CANCEL-${Date.now()}`, module: 'pos', companyId: CO, status: 'pending' },
            });
            const res = await request(app).post(`/api/payments/mpesa/transaction/${tx.id}/cancel`).expect(200);
            expect(res.body.success).toBe(true);
        });

        it('returns 400 when trying to cancel a completed transaction', async () => {
            const tx = await prisma.mpesaTransaction.create({
                data: { phone: '258841234567', amount: 100, reference: `REF-DONE-${Date.now()}`, module: 'pos', companyId: CO, status: 'completed', transactionId: 'SIM-X' },
            });
            await request(app).post(`/api/payments/mpesa/transaction/${tx.id}/cancel`).expect(400);
        });
    });

    describe('POST /api/payments/mpesa/callback (public)', () => {
        it('processes a success callback', async () => {
            const ts = `MPESA-CB-${Date.now()}`;
            const tx = await prisma.mpesaTransaction.create({
                data: { phone: '258841234567', amount: 300, reference: `REF-CB-${Date.now()}`, module: 'invoice', companyId: CO, status: 'processing', transactionId: ts },
            });
            const res = await request(app)
                .post('/api/payments/mpesa/callback')
                .send({ transactionId: ts, status: 'success', amount: 300 })
                .expect(200);
            expect(res.body.ResultCode).toBe(0);
        });
    });
});
