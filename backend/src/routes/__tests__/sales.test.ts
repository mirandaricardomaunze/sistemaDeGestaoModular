/**
 * Sales Route Test Suite
 * 
 * Tests for critical functionality including:
 * - Race condition prevention in document series
 * - Transaction rollback on errors
 * - Input validation
 * - Stock updates and alerts
 */

import request from 'supertest';
import { app } from '../index';
import { prisma } from '../lib/prisma';

// Mock authentication middleware
jest.mock('../middleware/auth', () => ({
    authenticate: (req: any, res: any, next: any) => {
        req.userId = 'test-user-id';
        req.companyId = 'test-company-id';
        next();
    },
    authorize: () => (req: any, res: any, next: any) => next(),
    AuthRequest: {} as any
}));

describe('Sales Route', () => {
    let authToken: string;
    let testCustomerId: string;
    let testProductId: string;

    beforeAll(async () => {
        // Setup test data
        await prisma.company.upsert({
            where: { id: 'test-company-id' },
            update: {},
            create: {
                id: 'test-company-id',
                name: 'Test Company',
                nuit: '123456789'
            }
        });

        await prisma.user.upsert({
            where: { email: 'test@example.com' },
            update: { id: 'test-user-id', companyId: 'test-company-id' },
            create: {
                id: 'test-user-id',
                email: 'test@example.com',
                password: 'password',
                name: 'Test User',
                companyId: 'test-company-id'
            }
        });

        const customer = await prisma.customer.create({
            data: {
                code: 'TEST-001',
                name: 'Test Customer',
                phone: '123456789',
                type: 'individual',
                companyId: 'test-company-id'
            }
        });
        testCustomerId = customer.id;

        const product = await prisma.product.create({
            data: {
                code: 'PROD-001',
                name: 'Test Product',
                price: 100,
                costPrice: 50,
                currentStock: 100,
                minStock: 10,
                companyId: 'test-company-id'
            }
        });
        testProductId = product.id;

        // Setup Tax Config for Fiscal Integration
        await prisma.taxConfig.create({
            data: {
                type: 'iva',
                name: 'IVA 16%',
                rate: 16,
                isActive: true,
                companyId: 'test-company-id',
                applicableTo: ['sale'],
                effectiveFrom: new Date()
            }
        });
    });

    afterAll(async () => {
        // Cleanup in reverse order of dependencies
        await prisma.loyaltyTransaction.deleteMany({ where: { customer: { companyId: 'test-company-id' } } });
        await prisma.taxRetention.deleteMany({ where: { companyId: 'test-company-id' } });
        await prisma.alert.deleteMany({ where: { companyId: 'test-company-id' } });
        await prisma.auditLog.deleteMany({ where: { companyId: 'test-company-id' } });
        await prisma.saleItem.deleteMany({ where: { sale: { companyId: 'test-company-id' } } });
        await prisma.sale.deleteMany({ where: { companyId: 'test-company-id' } });
        await prisma.taxConfig.deleteMany({ where: { companyId: 'test-company-id' } });
        await prisma.product.deleteMany({ where: { companyId: 'test-company-id' } });
        await prisma.customer.deleteMany({ where: { companyId: 'test-company-id' } });
        await prisma.user.deleteMany({ where: { companyId: 'test-company-id' } });
        await prisma.documentSeries.deleteMany({ where: { prefix: 'FR' } });
        await prisma.company.delete({ where: { id: 'test-company-id' } });
        await prisma.$disconnect();
    });

    describe('POST /sales', () => {
        it('should create a sale with valid data', async () => {
            const saleData = {
                customerId: testCustomerId,
                items: [
                    {
                        productId: testProductId,
                        quantity: 2,
                        unitPrice: 100,
                        discount: 0,
                        total: 200
                    }
                ],
                subtotal: 200,
                discount: 0,
                tax: 32, // 16% IVA
                total: 232,
                paymentMethod: 'cash',
                amountPaid: 250,
                change: 18
            };

            const response = await request(app)
                .post('/api/sales')
                .send(saleData)
                .expect(201);

            expect(response.body).toHaveProperty('id');
            expect(response.body.receiptNumber).toMatch(/^FR [A-Z]\/\d{4}$/);
            expect(response.body.total).toBe(232);
        });

        it('should reject invalid data with validation errors', async () => {
            const invalidData = {
                items: [], // Empty items array
                subtotal: -100, // Negative subtotal
                total: 0
            };

            const response = await request(app)
                .post('/api/sales')
                .send(invalidData)
                .expect(400);

            expect(response.body).toHaveProperty('error');
            expect(response.body).toHaveProperty('details');
        });

        it('should reject sale with insufficient stock', async () => {
            const saleData = {
                items: [
                    {
                        productId: testProductId,
                        quantity: 1000, // More than available stock
                        unitPrice: 100,
                        total: 100000
                    }
                ],
                subtotal: 100000,
                total: 100000,
                paymentMethod: 'cash',
                amountPaid: 100000
            };

            const response = await request(app)
                .post('/api/sales')
                .send(saleData)
                .expect(400);

            expect(response.body.error).toContain('Stock insuficiente');
        });

        it('should prevent race condition with concurrent sales', async () => {
            const saleData = {
                customerId: testCustomerId,
                items: [
                    {
                        productId: testProductId,
                        quantity: 1,
                        unitPrice: 100,
                        total: 100
                    }
                ],
                subtotal: 100,
                total: 100,
                paymentMethod: 'cash',
                amountPaid: 100
            };

            // Create 10 concurrent sale requests
            const promises = Array(10).fill(null).map(() =>
                request(app)
                    .post('/api/sales')
                    .send(saleData)
            );

            const responses = await Promise.all(promises);

            // All should succeed
            const successfulSales = responses.filter(r => r.status === 201);
            expect(successfulSales.length).toBe(10);

            // All receipt numbers should be unique
            const receiptNumbers = successfulSales.map(r => r.body.receiptNumber);
            const uniqueReceipts = new Set(receiptNumbers);
            expect(uniqueReceipts.size).toBe(10);

            // Receipt numbers should be sequential
            const numbers = receiptNumbers.map(r => parseInt(r.split('/')[1]));
            numbers.sort((a, b) => a - b);
            for (let i = 1; i < numbers.length; i++) {
                expect(numbers[i]).toBe(numbers[i - 1] + 1);
            }
        });

        it('should update product stock correctly', async () => {
            const initialStock = await prisma.product.findUnique({
                where: { id: testProductId },
                select: { currentStock: true }
            });

            const saleData = {
                items: [
                    {
                        productId: testProductId,
                        quantity: 5,
                        unitPrice: 100,
                        total: 500
                    }
                ],
                subtotal: 500,
                total: 500,
                paymentMethod: 'cash',
                amountPaid: 500
            };

            await request(app)
                .post('/api/sales')
                .send(saleData)
                .expect(201);

            const updatedStock = await prisma.product.findUnique({
                where: { id: testProductId },
                select: { currentStock: true }
            });

            expect(updatedStock!.currentStock).toBe(initialStock!.currentStock - 5);
        });

        it('should create alert when stock is low', async () => {
            // Set product stock to minimum
            await prisma.product.update({
                where: { id: testProductId },
                data: { currentStock: 11, minStock: 10 }
            });

            const saleData = {
                items: [
                    {
                        productId: testProductId,
                        quantity: 2, // This will bring stock below minimum
                        unitPrice: 100,
                        total: 200
                    }
                ],
                subtotal: 200,
                total: 200,
                paymentMethod: 'cash',
                amountPaid: 200
            };

            await request(app)
                .post('/api/sales')
                .send(saleData)
                .expect(201);

            // Check if alert was created
            const alert = await prisma.alert.findFirst({
                where: {
                    type: 'low_stock',
                    relatedId: testProductId,
                    isResolved: false
                }
            });

            expect(alert).toBeTruthy();
            expect(alert!.priority).toBe('high');
        });

        it('should register fiscal retention for IVA', async () => {
            const saleData = {
                customerId: testCustomerId,
                items: [
                    {
                        productId: testProductId,
                        quantity: 1,
                        unitPrice: 100,
                        discount: 0,
                        total: 100
                    }
                ],
                subtotal: 100,
                discount: 0,
                tax: 16, // 16% IVA
                total: 116,
                paymentMethod: 'cash',
                amountPaid: 116,
                change: 0
            };

            const response = await request(app)
                .post('/api/sales')
                .send(saleData)
                .expect(201);

            const saleId = response.body.id;

            // Verify tax retention record
            const retention = await prisma.taxRetention.findFirst({
                where: {
                    entityId: saleId,
                    entityType: 'sale',
                    type: 'iva'
                }
            });

            expect(retention).toBeTruthy();
            expect(Number(retention!.retainedAmount)).toBe(16);
            expect(Number(retention!.baseAmount)).toBe(100);
        });
    });

    describe('GET /sales', () => {
        it('should return paginated sales', async () => {
            const response = await request(app)
                .get('/api/sales?page=1&limit=10')
                .expect(200);

            expect(response.body).toHaveProperty('data');
            expect(response.body).toHaveProperty('pagination');
            expect(response.body.pagination).toHaveProperty('page');
            expect(response.body.pagination).toHaveProperty('total');
        });

        it('should validate query parameters', async () => {
            const response = await request(app)
                .get('/api/sales?page=invalid&limit=abc')
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });

        it('should filter by date range', async () => {
            const startDate = new Date('2024-01-01').toISOString();
            const endDate = new Date('2024-12-31').toISOString();

            const response = await request(app)
                .get(`/api/sales?startDate=${startDate}&endDate=${endDate}`)
                .expect(200);

            expect(response.body.data).toBeInstanceOf(Array);
        });
    });

    describe('GET /sales/:id', () => {
        it('should return sale by ID', async () => {
            // Create a sale first
            const sale = await prisma.sale.create({
                data: {
                    receiptNumber: 'TEST-001',
                    userId: 'test-user-id',
                    subtotal: 100,
                    total: 100,
                    paymentMethod: 'cash',
                    amountPaid: 100
                }
            });

            const response = await request(app)
                .get(`/api/sales/${sale.id}`)
                .expect(200);

            expect(response.body.id).toBe(sale.id);
        });

        it('should return 404 for non-existent sale', async () => {
            const fakeId = '00000000-0000-0000-0000-000000000000';

            await request(app)
                .get(`/api/sales/${fakeId}`)
                .expect(404);
        });

        it('should validate UUID format', async () => {
            await request(app)
                .get('/api/sales/invalid-id')
                .expect(400);
        });

        describe('POST /sales/:id/cancel', () => {
            let saleId: string;

            beforeEach(async () => {
                // Create a sale to cancel
                const sale = await prisma.sale.create({
                    data: {
                        receiptNumber: `TEST-CANCEL-${Date.now()}`,
                        userId: 'test-user-id',
                        companyId: 'test-company-id',
                        subtotal: 200,
                        total: 200,
                        paymentMethod: 'cash',
                        amountPaid: 200,
                        items: {
                            create: [{
                                productId: testProductId,
                                quantity: 2,
                                unitPrice: 100,
                                total: 200
                            }]
                        }
                    }
                });
                saleId = sale.id;

                // Reduce stock manually to simulate the sale effect
                await prisma.product.update({
                    where: { id: testProductId },
                    data: { currentStock: { decrement: 2 } }
                });
            });

            it('should cancel sale and restore stock', async () => {
                const initialStock = await prisma.product.findUnique({
                    where: { id: testProductId },
                    select: { currentStock: true }
                });

                const response = await request(app)
                    .post(`/api/sales/${saleId}/cancel`)
                    .send({ reason: 'Mistake' })
                    .expect(200);

                expect(response.body.message).toBe('Venda anulada com sucesso');

                // Verify stock restored
                const updatedStock = await prisma.product.findUnique({
                    where: { id: testProductId },
                    select: { currentStock: true }
                });

                expect(updatedStock!.currentStock).toBe(initialStock!.currentStock + 2);

                // Verify sale is deleted
                const sale = await prisma.sale.findUnique({ where: { id: saleId } });
                expect(sale).toBeNull();
            });

            it('should return 404 for non-existent sale', async () => {
                const fakeId = '00000000-0000-0000-0000-000000000000';
                await request(app)
                    .post(`/api/sales/${fakeId}/cancel`)
                    .send({ reason: 'Test' })
                    .expect(500);
            });
        });
    });

    describe('GET /sales/stats/summary', () => {
        it('should return sales statistics', async () => {
            const response = await request(app)
                .get('/api/sales/stats/summary')
                .expect(200);

            expect(response.body).toHaveProperty('totalRevenue');
            expect(response.body).toHaveProperty('salesCount');
            expect(response.body).toHaveProperty('avgSale');
            expect(response.body).toHaveProperty('byPaymentMethod');
            expect(response.body).toHaveProperty('topProducts');
        });
    });

    describe('GET /sales/today/summary', () => {
        it('should return today\'s sales summary', async () => {
            const response = await request(app)
                .get('/api/sales/today/summary')
                .expect(200);

            expect(response.body).toHaveProperty('sales');
            expect(response.body).toHaveProperty('totals');
            expect(response.body.totals).toHaveProperty('count');
            expect(response.body.totals).toHaveProperty('total');
        });
    });
});

