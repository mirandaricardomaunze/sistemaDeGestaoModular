import request from 'supertest';
import { app } from '../../index';
import { prisma } from '../../lib/prisma';

jest.mock('../../middleware/auth', () => ({
    authenticate: (req: any, _res: any, next: any) => {
        req.userId = 'prod-test-user';
        req.companyId = 'prod-test-company';
        next();
    },
    authorize: () => (_req: any, _res: any, next: any) => next(),
    AuthRequest: {} as any
}));

const CID = 'prod-test-company';

async function cleanup() {
    await prisma.stockMovement.deleteMany({ where: { companyId: CID } }).catch(() => {});
    await prisma.alert.deleteMany({ where: { companyId: CID } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { companyId: CID } }).catch(() => {});
    await prisma.warehouseStock.deleteMany({ where: { warehouse: { companyId: CID } } }).catch(() => {});
    await prisma.product.deleteMany({ where: { companyId: CID } }).catch(() => {});
    await prisma.category.deleteMany({ where: { companyId: CID } }).catch(() => {});
    await prisma.user.deleteMany({ where: { companyId: CID } }).catch(() => {});
    await prisma.company.deleteMany({ where: { id: CID } }).catch(() => {});
}

let productId: string;

beforeAll(async () => {
    await cleanup();
    await prisma.company.create({ data: { id: CID, name: 'Products Test Co', nuit: 'PROD-NUIT-001' } });
    await prisma.user.create({
        data: { id: 'prod-test-user', email: 'prod@test.com', password: 'x', name: 'Prod User', companyId: CID }
    });
    const p = await prisma.product.create({
        data: { code: 'P-001', name: 'Initial Product', price: 50, costPrice: 25, currentStock: 100, companyId: CID }
    });
    productId = p.id;
});

afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
});

// ── GET /api/products ─────────────────────────────────────────────────────────

describe('GET /api/products', () => {
    it('returns paginated product list', async () => {
        const res = await request(app).get('/api/products').expect(200);
        expect(res.body).toHaveProperty('data');
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body).toHaveProperty('pagination');
    });

    it('supports search query', async () => {
        const res = await request(app).get('/api/products?search=Initial').expect(200);
        expect(res.body.data.some((p: any) => p.name.includes('Initial'))).toBe(true);
    });

    it('supports pagination params', async () => {
        const res = await request(app).get('/api/products?page=1&limit=5').expect(200);
        expect(res.body.pagination.page).toBe(1);
        expect(res.body.pagination.limit).toBeLessThanOrEqual(5);
    });
});

// ── GET /api/products/:id ─────────────────────────────────────────────────────

describe('GET /api/products/:id', () => {
    it('returns product by ID', async () => {
        const res = await request(app).get(`/api/products/${productId}`).expect(200);
        expect(res.body.id).toBe(productId);
        expect(res.body.name).toBe('Initial Product');
    });

    it('returns 404 for non-existent product', async () => {
        await request(app)
            .get('/api/products/00000000-0000-0000-0000-000000000000')
            .expect(404);
    });
});

// ── POST /api/products ────────────────────────────────────────────────────────

describe('POST /api/products', () => {
    it('creates product with valid data', async () => {
        const res = await request(app)
            .post('/api/products')
            .send({
                code: 'P-NEW-001',
                name: 'New Product',
                price: 100,
                costPrice: 60,
                currentStock: 50,
                minStock: 5,
                unit: 'un'
            })
            .expect(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body.name).toBe('New Product');
        // cleanup
        await prisma.product.delete({ where: { id: res.body.id } }).catch(() => {});
    });

    it('rejects missing required fields', async () => {
        const res = await request(app)
            .post('/api/products')
            .send({ name: 'No price product' })
            .expect(400);
        expect(res.body).toHaveProperty('message');
    });

    it('rejects negative price', async () => {
        const res = await request(app)
            .post('/api/products')
            .send({ code: 'BAD-1', name: 'Bad', price: -10, currentStock: 0 })
            .expect(400);
        expect(res.body).toHaveProperty('message');
    });
});

// ── PUT /api/products/:id ─────────────────────────────────────────────────────

describe('PUT /api/products/:id', () => {
    it('updates product name and price', async () => {
        const res = await request(app)
            .put(`/api/products/${productId}`)
            .send({ name: 'Updated Product', price: 75 })
            .expect(200);
        expect(res.body.name).toBe('Updated Product');
        expect(Number(res.body.price)).toBe(75);
    });

    it('returns 404 for non-existent product', async () => {
        await request(app)
            .put('/api/products/00000000-0000-0000-0000-000000000000')
            .send({ name: 'Ghost' })
            .expect(404);
    });
});

// ── POST /api/products/:id/adjust-stock ───────────────────────────────────────

describe('POST /api/products/:id/adjust-stock', () => {
    it('adds stock on positive adjustment', async () => {
        const before = await prisma.product.findUnique({ where: { id: productId }, select: { currentStock: true } });

        await request(app)
            .post(`/api/products/${productId}/adjust-stock`)
            .send({ quantity: 20, reason: 'restock', type: 'adjustment' })
            .expect(200);

        const after = await prisma.product.findUnique({ where: { id: productId }, select: { currentStock: true } });
        expect(Number(after!.currentStock)).toBe(Number(before!.currentStock) + 20);
    });

    it('decreases stock on negative adjustment', async () => {
        const before = await prisma.product.findUnique({ where: { id: productId }, select: { currentStock: true } });

        await request(app)
            .post(`/api/products/${productId}/adjust-stock`)
            .send({ quantity: -5, reason: 'correction', type: 'adjustment' })
            .expect(200);

        const after = await prisma.product.findUnique({ where: { id: productId }, select: { currentStock: true } });
        expect(Number(after!.currentStock)).toBe(Number(before!.currentStock) - 5);
    });

    it('rejects adjustment with missing quantity', async () => {
        const res = await request(app)
            .post(`/api/products/${productId}/adjust-stock`)
            .send({ reason: 'no quantity' })
            .expect(400);
        expect(res.body).toHaveProperty('message');
    });
});

// ── GET /api/products/alerts/low-stock ───────────────────────────────────────

describe('GET /api/products/alerts/low-stock', () => {
    it('returns low-stock product list', async () => {
        await prisma.product.update({ where: { id: productId }, data: { currentStock: 2, minStock: 10 } });
        const res = await request(app).get('/api/products/alerts/low-stock').expect(200);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.some((p: any) => p.id === productId)).toBe(true);
    });
});

// ── GET /api/products/stock-movements ────────────────────────────────────────

describe('GET /api/products/stock-movements', () => {
    it('returns movement history with pagination', async () => {
        const res = await request(app).get('/api/products/stock-movements').expect(200);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('pagination');
    });
});

// ── DELETE /api/products/:id ──────────────────────────────────────────────────

describe('DELETE /api/products/:id', () => {
    it('deletes a product', async () => {
        const p = await prisma.product.create({
            data: { code: 'DEL-001', name: 'To Delete', price: 10, currentStock: 0, companyId: CID }
        });
        await request(app).delete(`/api/products/${p.id}`).expect(200);
        const found = await prisma.product.findUnique({ where: { id: p.id } });
        expect(found).toBeNull();
    });

    it('returns 404 for non-existent product', async () => {
        await request(app)
            .delete('/api/products/00000000-0000-0000-0000-000000000000')
            .expect(404);
    });
});
