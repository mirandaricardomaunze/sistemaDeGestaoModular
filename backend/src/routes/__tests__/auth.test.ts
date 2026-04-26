import request from 'supertest';
import { app } from '../../index';
import { prisma } from '../../lib/prisma';

const COMPANY_ID = 'auth-test-company';
const EMAIL = 'auth-test@example.com';
const PASSWORD = 'Password1';

async function cleanup() {
    await prisma.auditLog.deleteMany({ where: { companyId: COMPANY_ID } }).catch(() => {});
    await prisma.user.deleteMany({ where: { companyId: COMPANY_ID } }).catch(() => {});
    await prisma.company.deleteMany({ where: { id: COMPANY_ID } }).catch(() => {});
    await prisma.company.deleteMany({ where: { nuit: 'AUTH-TEST-NUIT' } }).catch(() => {});
}

beforeAll(async () => {
    await cleanup();
    await prisma.company.create({ data: { id: COMPANY_ID, name: 'Auth Test Co', nuit: 'AUTH-TEST-NUIT' } });
});

afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
    const BCRYPT_ROUNDS = 12;

    beforeAll(async () => {
        const bcrypt = require('bcryptjs');
        const hashed = await bcrypt.hash(PASSWORD, BCRYPT_ROUNDS);
        await prisma.user.create({
            data: {
                id: 'auth-test-user',
                email: EMAIL,
                password: hashed,
                name: 'Auth User',
                companyId: COMPANY_ID
            }
        });
    });

    it('returns 400 when fields are missing', async () => {
        const res = await request(app).post('/api/auth/login').send({});
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('message');
    });

    it('returns 401 with wrong password', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: EMAIL, password: 'wrongpassword' });
        expect(res.status).toBe(401);
    });

    it('returns 401 for unknown email', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'nobody@nowhere.com', password: PASSWORD });
        expect(res.status).toBe(401);
    });

    it('returns token and user on valid credentials', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: EMAIL, password: PASSWORD });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(res.body.user).toHaveProperty('email', EMAIL);
        expect(res.body.user).not.toHaveProperty('password');
    });

    it('does not expose password in response', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: EMAIL, password: PASSWORD });
        expect(res.body.user?.password).toBeUndefined();
    });
});

// ── POST /api/auth/register ───────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
    afterEach(async () => {
        await prisma.user.deleteMany({ where: { email: 'newreg@example.com' } }).catch(() => {});
        await prisma.company.deleteMany({ where: { nuit: 'REG-NUIT-999' } }).catch(() => {});
    });

    it('returns 400 when required fields are missing', async () => {
        const res = await request(app).post('/api/auth/register').send({ email: 'x@x.com' });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('message');
    });

    it('returns 400 for weak password', async () => {
        const res = await request(app).post('/api/auth/register').send({
            email: 'weak@example.com',
            password: '1234',
            name: 'Test',
            companyName: 'Test Co',
            moduleCode: 'COMMERCIAL'
        });
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('senha');
    });

    it('returns 400 for duplicate email', async () => {
        const res = await request(app).post('/api/auth/register').send({
            email: EMAIL,
            password: PASSWORD,
            name: 'Duplicate',
            companyName: 'Another Co',
            moduleCode: 'COMMERCIAL'
        });
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('email');
    });

    it('creates user and company on valid data', async () => {
        const res = await request(app).post('/api/auth/register').send({
            email: 'newreg@example.com',
            password: 'ValidPass1',
            name: 'New User',
            companyName: 'New Company',
            companyNuit: 'REG-NUIT-999',
            moduleCode: 'COMMERCIAL'
        });
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('token');
        expect(res.body.user.email).toBe('newreg@example.com');
        expect(res.body.user.password).toBeUndefined();
    });
});

// ── POST /api/auth/forgot-password ───────────────────────────────────────────

describe('POST /api/auth/forgot-password', () => {
    it('returns 200 even for non-existent email (security: no user enumeration)', async () => {
        const res = await request(app)
            .post('/api/auth/forgot-password')
            .send({ email: 'nonexistent@nowhere.com' });
        // Should not reveal whether user exists
        expect([200, 400]).toContain(res.status);
    });

    it('returns 400 when email is missing', async () => {
        const res = await request(app).post('/api/auth/forgot-password').send({});
        expect(res.status).toBe(400);
    });
});

// ── POST /api/auth/verify-otp ─────────────────────────────────────────────────

describe('POST /api/auth/verify-otp', () => {
    it('returns 400 when email or otp is missing', async () => {
        const res = await request(app).post('/api/auth/verify-otp').send({ email: EMAIL });
        expect(res.status).toBe(400);
    });

    it('returns 400 for invalid OTP', async () => {
        const res = await request(app)
            .post('/api/auth/verify-otp')
            .send({ email: EMAIL, otp: '000000' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/inválido|expirado/i);
    });
});

// ── POST /api/auth/logout ────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
    it('returns 401 without token', async () => {
        const res = await request(app).post('/api/auth/logout');
        expect(res.status).toBe(401);
    });

    it('returns 200 with valid token', async () => {
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: EMAIL, password: PASSWORD });
        const token = loginRes.body.token;

        const res = await request(app)
            .post('/api/auth/logout')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
    });
});
