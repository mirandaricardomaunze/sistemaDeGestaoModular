/**
 * FEFO (First-Expired, First-Out) batch allocation for the Commercial POS.
 *
 * Spec: docs/specs/2026-06-01-fefo-batch-selection.md
 * Skills: spec-driven, test-harness, multicore, clean-architecture
 *
 * This module is pure orchestration: it does NOT decrement stock, NOT write
 * SaleItems, NOT record movements. It returns an allocation plan
 * (which lot to consume how much of) so that salesService keeps owning the
 * transaction and the side effects stay co-located.
 */

import { Prisma } from '@prisma/client';
import type { ExtendedPrismaClient } from '../../lib/prisma';

type TxClient = Omit<
    ExtendedPrismaClient,
    '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export type BatchSelectionMode = 'none' | 'fefo' | 'manual';

export interface FefoAllocationSlice {
    batchId: string;
    quantity: number;
}

export interface FefoAllocation {
    productId: string;
    /** Slices in FEFO order (oldest expiry first). Empty array = no batches available. */
    slices: FefoAllocationSlice[];
    /** Quantity that could NOT be matched to any batch (fallback path). */
    unallocatedQuantity: number;
}

/**
 * Reads the FEFO opt-in flag from CompanySettings.
 * Defaults to 'none' (current behaviour) for any company without settings or
 * any value the runtime does not recognise.
 */
export async function getBatchSelectionMode(
    tx: TxClient,
    companyId: string,
): Promise<BatchSelectionMode> {
    // Read via raw SQL so this works the second the migration runs, without
    // waiting for `npx prisma generate` to refresh the generated types.
    // Once the client is regenerated, this can become a typed findFirst.
    const rows = await tx.$queryRaw<Array<{ batch_selection_mode: string | null }>>(
        Prisma.sql`SELECT "batch_selection_mode" FROM "company_settings" WHERE "companyId" = ${companyId} LIMIT 1`,
    );
    const raw = rows[0]?.batch_selection_mode;
    if (raw === 'fefo' || raw === 'manual') return raw;
    return 'none';
}

/**
 * Allocates a quantity of a product across its active batches, oldest expiry
 * first. Splits across multiple batches when the first batch does not cover
 * the full quantity. Batches with expiryDate=NULL are tried last.
 *
 * Sorting (deterministic): expiryDate ASC NULLS LAST, then receivedDate ASC,
 * then id ASC.
 *
 * Warehouse filter: when `warehouseId` is provided, only batches stored in
 * that warehouse are considered. Batches with `warehouseId=NULL` are treated
 * as global stock and ALSO included.
 *
 * @param tx          Prisma client (transaction recommended)
 * @param companyId   Tenant scope
 * @param productId   Product to allocate
 * @param quantity    Total units to allocate
 * @param warehouseId Optional warehouse scope
 */
export async function allocateFefo(
    tx: TxClient,
    companyId: string,
    productId: string,
    quantity: number,
    warehouseId?: string | null,
): Promise<FefoAllocation> {
    if (quantity <= 0) {
        return { productId, slices: [], unallocatedQuantity: 0 };
    }

    const batchWhere: Prisma.ProductBatchWhereInput = {
        productId,
        companyId,
        quantity: { gt: 0 },
        status: { not: 'depleted' },
    };
    if (warehouseId) {
        batchWhere.OR = [
            { warehouseId },
            { warehouseId: null },
        ];
    }

    const batches = await tx.productBatch.findMany({
        where: batchWhere,
        select: {
            id: true,
            quantity: true,
            expiryDate: true,
            receivedDate: true,
        },
        orderBy: [
            // Postgres treats NULL as greater than any value when ASC → NULL LAST naturally.
            { expiryDate: 'asc' },
            { receivedDate: 'asc' },
            { id: 'asc' },
        ],
    });

    const slices: FefoAllocationSlice[] = [];
    let remaining = quantity;

    for (const batch of batches) {
        if (remaining <= 0) break;
        const available = batch.quantity;
        if (available <= 0) continue;
        const take = Math.min(available, remaining);
        slices.push({ batchId: batch.id, quantity: take });
        remaining -= take;
    }

    return {
        productId,
        slices,
        unallocatedQuantity: Math.max(0, remaining),
    };
}

/**
 * Splits a money amount (e.g. line discount) proportionally to the quantities
 * in the slices. The last slice absorbs the rounding residue so the sum
 * exactly equals `amount` (rounded to 2 decimal places).
 *
 * Used so that a single POS line split into N SaleItems by FEFO still totals
 * the same as the original line.
 */
export function rateableSplit(amount: number, slices: FefoAllocationSlice[]): number[] {
    if (slices.length === 0 || amount === 0) {
        return slices.map(() => 0);
    }
    const totalQty = slices.reduce((s, sl) => s + sl.quantity, 0);
    if (totalQty <= 0) return slices.map(() => 0);

    const parts = slices.map((sl) =>
        Math.round((amount * sl.quantity / totalQty) * 100) / 100,
    );
    const sum = parts.reduce((s, p) => s + p, 0);
    const residue = Math.round((amount - sum) * 100) / 100;
    if (residue !== 0 && parts.length > 0) {
        parts[parts.length - 1] = Math.round((parts[parts.length - 1] + residue) * 100) / 100;
    }
    return parts;
}
