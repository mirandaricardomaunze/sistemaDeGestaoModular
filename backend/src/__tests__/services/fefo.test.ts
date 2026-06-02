/**
 * FEFO allocation tests.
 *
 * Spec: docs/specs/2026-06-01-fefo-batch-selection.md
 * Harness: backend/src/test/ — see .agent/skills/test-harness/SKILL.md
 *
 * Coverage (per spec §8):
 *  - rateableSplit pure invariants
 *  - allocateFefo: single batch covers full quantity
 *  - allocateFefo: splits across multiple batches
 *  - allocateFefo: expired batch is consumed first
 *  - allocateFefo: NULL expiryDate batches sort last
 *  - allocateFefo: tie on expiryDate broken by receivedDate
 *  - allocateFefo: product with no batches → unallocatedQuantity = full
 *  - allocateFefo: warehouse scope respected (NULL warehouse included)
 */

import { rateableSplit, allocateFefo } from '../../services/commercial/fefo.service';
import { withTestTx } from '../../test/helpers/withTestTx';
import {
    createCompany,
    createProduct,
    createBatchSeries,
    createProductBatch,
} from '../../test/factories';

describe('rateableSplit', () => {
    it('returns zeros when amount is zero', () => {
        const parts = rateableSplit(0, [
            { batchId: 'a', quantity: 2 },
            { batchId: 'b', quantity: 3 },
        ]);
        expect(parts).toEqual([0, 0]);
    });

    it('returns empty array when no slices', () => {
        expect(rateableSplit(100, [])).toEqual([]);
    });

    it('splits proportionally to slice quantity with exact division', () => {
        // 10 across 2/3/5 → 2.00 / 3.00 / 5.00, sums to 10.00
        const parts = rateableSplit(10, [
            { batchId: 'a', quantity: 2 },
            { batchId: 'b', quantity: 3 },
            { batchId: 'c', quantity: 5 },
        ]);
        expect(parts).toEqual([2.00, 3.00, 5.00]);
        expect(parts.reduce((s, p) => s + p, 0)).toBeCloseTo(10, 2);
    });

    it('absorbs rounding residue in the last slice', () => {
        // 10 across 1/1/1 → 3.33 / 3.33 / 3.34 (last absorbs residue)
        const parts = rateableSplit(10, [
            { batchId: 'a', quantity: 1 },
            { batchId: 'b', quantity: 1 },
            { batchId: 'c', quantity: 1 },
        ]);
        expect(parts[0]).toBeCloseTo(3.33, 2);
        expect(parts[1]).toBeCloseTo(3.33, 2);
        expect(parts[2]).toBeCloseTo(3.34, 2);
        const sum = parts.reduce((s, p) => s + p, 0);
        expect(Math.round(sum * 100) / 100).toBe(10);
    });

    it('preserves invariant Σ(parts) === amount for any reasonable split', () => {
        const cases: Array<[number, number[]]> = [
            [7.77, [1, 2, 3]],
            [123.45, [5, 7, 11]],
            [0.03, [1, 1, 1]],
            [1000, [333, 333, 334]],
        ];
        for (const [amount, qtys] of cases) {
            const slices = qtys.map((q, i) => ({ batchId: `b${i}`, quantity: q }));
            const parts = rateableSplit(amount, slices);
            const sum = Math.round(parts.reduce((s, p) => s + p, 0) * 100) / 100;
            expect(sum).toBe(Math.round(amount * 100) / 100);
        }
    });
});

describe('allocateFefo', () => {
    it('allocates from a single batch when it covers the full quantity', async () => {
        await withTestTx(async (tx) => {
            const company = await createCompany({}, tx);
            const product = await createProduct(company.id, {}, tx);
            const [batch] = await createBatchSeries(
                company.id,
                product.id,
                [{ daysUntilExpiry: 30, quantity: 10 }],
                tx,
            );

            const plan = await allocateFefo(tx, company.id, product.id, 5);

            expect(plan.slices).toHaveLength(1);
            expect(plan.slices[0]).toEqual({ batchId: batch.id, quantity: 5 });
            expect(plan.unallocatedQuantity).toBe(0);
        });
    });

    it('splits across multiple batches when the oldest does not cover', async () => {
        await withTestTx(async (tx) => {
            const company = await createCompany({}, tx);
            const product = await createProduct(company.id, {}, tx);
            // Oldest first → only 2 units; rest must come from the next batch.
            const [oldBatch, newBatch] = await createBatchSeries(
                company.id,
                product.id,
                [
                    { daysUntilExpiry: 10, quantity: 2 },
                    { daysUntilExpiry: 60, quantity: 10 },
                ],
                tx,
            );

            const plan = await allocateFefo(tx, company.id, product.id, 5);

            expect(plan.slices).toEqual([
                { batchId: oldBatch.id, quantity: 2 },
                { batchId: newBatch.id, quantity: 3 },
            ]);
            expect(plan.unallocatedQuantity).toBe(0);
        });
    });

    it('consumes expired batches first (FEFO does not skip expired)', async () => {
        await withTestTx(async (tx) => {
            const company = await createCompany({}, tx);
            const product = await createProduct(company.id, {}, tx);
            const [expired, fresh] = await createBatchSeries(
                company.id,
                product.id,
                [
                    { daysUntilExpiry: -5, quantity: 10 },
                    { daysUntilExpiry: 30, quantity: 10 },
                ],
                tx,
            );

            const plan = await allocateFefo(tx, company.id, product.id, 3);

            expect(plan.slices).toHaveLength(1);
            expect(plan.slices[0].batchId).toBe(expired.id);
            expect(plan.slices[0].quantity).toBe(3);
            // sanity: would-have-been-fresh batch is untouched
            expect(plan.slices.find((s) => s.batchId === fresh.id)).toBeUndefined();
        });
    });

    it('sorts batches with expiryDate=NULL last (only used as fallback)', async () => {
        await withTestTx(async (tx) => {
            const company = await createCompany({}, tx);
            const product = await createProduct(company.id, {}, tx);
            const [dated, undated] = await createBatchSeries(
                company.id,
                product.id,
                [
                    { daysUntilExpiry: 30, quantity: 3 },
                    { daysUntilExpiry: null, quantity: 10 },
                ],
                tx,
            );

            const plan = await allocateFefo(tx, company.id, product.id, 5);

            expect(plan.slices).toEqual([
                { batchId: dated.id, quantity: 3 },
                { batchId: undated.id, quantity: 2 },
            ]);
        });
    });

    it('breaks ties on expiryDate by receivedDate ASC', async () => {
        await withTestTx(async (tx) => {
            const company = await createCompany({}, tx);
            const product = await createProduct(company.id, {}, tx);
            const sameExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

            const older = await createProductBatch(company.id, product.id, {
                expiryDate: sameExpiry,
                receivedDate: new Date('2026-01-01'),
                quantity: 4,
                batchNumber: `tie-older-${Date.now()}`,
            }, tx);
            const newer = await createProductBatch(company.id, product.id, {
                expiryDate: sameExpiry,
                receivedDate: new Date('2026-02-01'),
                quantity: 4,
                batchNumber: `tie-newer-${Date.now()}`,
            }, tx);

            const plan = await allocateFefo(tx, company.id, product.id, 6);

            expect(plan.slices[0].batchId).toBe(older.id);
            expect(plan.slices[0].quantity).toBe(4);
            expect(plan.slices[1].batchId).toBe(newer.id);
            expect(plan.slices[1].quantity).toBe(2);
        });
    });

    it('reports unallocatedQuantity when product has no batches', async () => {
        await withTestTx(async (tx) => {
            const company = await createCompany({}, tx);
            const product = await createProduct(company.id, {}, tx);

            const plan = await allocateFefo(tx, company.id, product.id, 5);

            expect(plan.slices).toEqual([]);
            expect(plan.unallocatedQuantity).toBe(5);
        });
    });

    it('reports unallocatedQuantity when batches do not cover full request', async () => {
        await withTestTx(async (tx) => {
            const company = await createCompany({}, tx);
            const product = await createProduct(company.id, {}, tx);
            await createBatchSeries(
                company.id,
                product.id,
                [{ daysUntilExpiry: 30, quantity: 2 }],
                tx,
            );

            const plan = await allocateFefo(tx, company.id, product.id, 5);

            expect(plan.slices).toHaveLength(1);
            expect(plan.slices[0].quantity).toBe(2);
            expect(plan.unallocatedQuantity).toBe(3);
        });
    });

    it('ignores depleted batches', async () => {
        await withTestTx(async (tx) => {
            const company = await createCompany({}, tx);
            const product = await createProduct(company.id, {}, tx);
            const [, _fresh] = await createBatchSeries(
                company.id,
                product.id,
                [
                    { daysUntilExpiry: 10, quantity: 0 },  // depleted by qty
                    { daysUntilExpiry: 30, quantity: 5 },
                ],
                tx,
            );
            // Also explicitly depleted by status
            await createProductBatch(company.id, product.id, {
                expiryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                quantity: 100,
                status: 'depleted',
                batchNumber: `depleted-${Date.now()}`,
            }, tx);

            const plan = await allocateFefo(tx, company.id, product.id, 3);

            expect(plan.slices).toHaveLength(1);
            expect(plan.slices[0].quantity).toBe(3);
            expect(plan.unallocatedQuantity).toBe(0);
        });
    });

    it('respects warehouseId filter, also including warehouse=NULL global stock', async () => {
        await withTestTx(async (tx) => {
            const company = await createCompany({}, tx);
            const product = await createProduct(company.id, {}, tx);
            const warehouseA = await tx.warehouse.create({
                data: {
                    code: `WH-A-${Date.now()}`,
                    name: 'A',
                    companyId: company.id,
                },
            });
            const warehouseB = await tx.warehouse.create({
                data: {
                    code: `WH-B-${Date.now()}`,
                    name: 'B',
                    companyId: company.id,
                },
            });

            const batchA = await createProductBatch(company.id, product.id, {
                warehouseId: warehouseA.id,
                expiryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
                quantity: 5,
                batchNumber: `wha-${Date.now()}`,
            }, tx);
            const batchB = await createProductBatch(company.id, product.id, {
                warehouseId: warehouseB.id,
                expiryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                quantity: 5,
                batchNumber: `whb-${Date.now()}`,
            }, tx);
            const batchGlobal = await createProductBatch(company.id, product.id, {
                warehouseId: null,
                expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                quantity: 5,
                batchNumber: `global-${Date.now()}`,
            }, tx);

            const plan = await allocateFefo(tx, company.id, product.id, 8, warehouseA.id);

            // Should include batchA (warehouse A) and batchGlobal (warehouse NULL),
            // ordered by expiryDate ASC: global (7d) then A (10d).
            // Should NOT include batchB (warehouse B).
            const batchIds = plan.slices.map((s) => s.batchId);
            expect(batchIds).toContain(batchA.id);
            expect(batchIds).toContain(batchGlobal.id);
            expect(batchIds).not.toContain(batchB.id);
        });
    });

    it('returns empty allocation when requested quantity is zero', async () => {
        await withTestTx(async (tx) => {
            const company = await createCompany({}, tx);
            const product = await createProduct(company.id, {}, tx);
            await createBatchSeries(
                company.id,
                product.id,
                [{ daysUntilExpiry: 30, quantity: 10 }],
                tx,
            );

            const plan = await allocateFefo(tx, company.id, product.id, 0);

            expect(plan.slices).toEqual([]);
            expect(plan.unallocatedQuantity).toBe(0);
        });
    });
});
