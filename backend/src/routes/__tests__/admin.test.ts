import request from 'supertest';
import { app } from '../../index';
import { prisma } from '../../lib/prisma';

const SUPER_ADMIN_ID = 'admin-test-super';
const REGULAR_USER_ID = 'admin-test-regular';
const COMPANY_ID = 'admin-test-co';

jest.mock('../../middleware/auth', () => {
    const original = jest.requireActual('../../middleware/auth');
    return {
        ...original,
        authenticate: (req: any, _res: any, next: any) => {
            // Role is set by each test via req headers trick or a mock store
            req.userId = req.headers['x-mock-user-id'] || SUPER_ADMIN_ID;
            req.companyId = req.headers['x-mock-company-id'] || COMPANY_ID;
            req.userRole = req.headers['x-mock-role'] || 'super_admin';
            req.userName = 'Test Admin';
            next();
        },
        authorize: () => (_req: any, _res: any, next: any) => next(),
        AuthRequest: {} as any,
    };
});

async function cleanup() {
    await prisma.auditLog.deleteMany({ where: { companyId: COMPANY_ID } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [SUPER_ADMIN_ID, REGULAR_USER_ID] } } }).catch(() => {});
    await prisma.company.deleteMany({ where: { id: COMPANY_ID } }).catch(() => {});
}

beforeAll(async () => {
    await cleanup();
    await prisma.company.create({ data: { id: COMPANY_ID, name: 'Admin Test Co', nuit: 'ADMIN-NUIT', status: 'active' } });
    await prisma.user.create({ data: { id: SUPER_ADMIN_ID, name: 'Super Admin', email: 'super@test.com', password: 'x', role: 'super_admin', companyId: COMPANY_ID, isActive: true } });
    await prisma.user.create({ data: { id: REGULAR_USER_ID, name: 'Regular', email: 'regular@test.com', password: 'x', role: 'operator', companyId: COMPANY_ID, isActive: true } });
});

afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
});

describe('GET /api/admin/stats (super_admin only)', () => {
    it('returns full stats for super_admin', async () => {
        const res = await request(app).get('/api/admin/stats').expect(200);
        expect(res.body).toHaveProperty('companies');
        expect(res.body.companies).toHaveProperty('total');
        expect(res.body.companies).toHaveProperty('active');
        expect(res.body).toHaveProperty('users');
        expect(res.body).toHaveProperty('sales');
        expect(res.body).toHaveProperty('modules');
        expect(res.body).toHaveProperty('recentActivity');
        expect(res.body).toHaveProperty('system');
    });

    it('returns 403 for non-super_admin', async () => {
        const res = await request(app)
            .get('/api/admin/stats')
            .set('x-mock-role', 'admin')
            .expect(403);
        expect(res.body).toHaveProperty('message');
    });
});

describe('GET /api/admin/companies', () => {
    it('returns paginated company list', async () => {
        const res = await request(app).get('/api/admin/companies').expect(200);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('pagination');
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('supports search filter', async () => {
        const res = await request(app).get('/api/admin/companies?search=Admin').expect(200);
        expect(res.body.data.some((c: any) => c.name.includes('Admin'))).toBe(true);
    });

    it('supports status filter', async () => {
        const res = await request(app).get('/api/admin/companies?status=active').expect(200);
        res.body.data.forEach((c: any) => expect(c.status).toBe('active'));
    });
});

describe('GET /api/admin/companies/:id', () => {
    it('returns full company detail', async () => {
        const res = await request(app).get(`/api/admin/companies/${COMPANY_ID}`).expect(200);
        expect(res.body.id).toBe(COMPANY_ID);
        expect(res.body).toHaveProperty('_count');
        expect(res.body).toHaveProperty('users');
    });

    it('returns 404 for unknown company', async () => {
        await request(app).get('/api/admin/companies/nonexistent-99').expect(404);
    });
});

describe('PATCH /api/admin/companies/:id/status', () => {
    it('changes company status to suspended', async () => {
        const res = await request(app)
            .patch(`/api/admin/companies/${COMPANY_ID}/status`)
            .send({ status: 'suspended' })
            .expect(200);
        expect(res.body.status).toBe('suspended');

        // Restore
        await request(app).patch(`/api/admin/companies/${COMPANY_ID}/status`).send({ status: 'active' });
    });

    it('rejects invalid status values', async () => {
        await request(app)
            .patch(`/api/admin/companies/${COMPANY_ID}/status`)
            .send({ status: 'hacked' })
            .expect(400);
    });
});

describe('GET /api/admin/users', () => {
    it('returns paginated user list', async () => {
        const res = await request(app).get('/api/admin/users').expect(200);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('pagination');
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('does not expose password or otp fields', async () => {
        const res = await request(app).get('/api/admin/users').expect(200);
        res.body.data.forEach((u: any) => {
            expect(u.password).toBeUndefined();
            expect(u.otp).toBeUndefined();
        });
    });
});

describe('PATCH /api/admin/users/:id/status', () => {
    it('deactivates a user', async () => {
        const res = await request(app)
            .patch(`/api/admin/users/${REGULAR_USER_ID}/status`)
            .send({ isActive: false })
            .expect(200);
        expect(res.body.isActive).toBe(false);

        // Restore
        await request(app).patch(`/api/admin/users/${REGULAR_USER_ID}/status`).send({ isActive: true });
    });
});

describe('GET /api/admin/activity', () => {
    it('returns paginated activity logs', async () => {
        const res = await request(app).get('/api/admin/activity').expect(200);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('pagination');
        expect(Array.isArray(res.body.data)).toBe(true);
    });
});

describe('GET /api/admin/system/health', () => {
    it('returns system health data', async () => {
        const res = await request(app).get('/api/admin/system/health').expect(200);
        expect(res.body.status).toBe('healthy');
        expect(res.body).toHaveProperty('database');
        expect(res.body).toHaveProperty('process');
        expect(res.body.process).toHaveProperty('uptime');
        expect(res.body.process).toHaveProperty('memoryMb');
        expect(res.body.process).toHaveProperty('nodeVersion');
    });
});

describe('GET /api/admin/revenue', () => {
    it('returns revenue data by company and by day', async () => {
        const res = await request(app).get('/api/admin/revenue?days=7').expect(200);
        expect(res.body).toHaveProperty('byCompany');
        expect(res.body).toHaveProperty('byDay');
        expect(res.body).toHaveProperty('period');
        expect(res.body.period.days).toBe(7);
    });
});
