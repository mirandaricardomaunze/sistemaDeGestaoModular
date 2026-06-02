import { Prisma, MovementType } from '@prisma/client';
import { basePrisma } from '../../lib/prismaBase';

type DecimalLike = Prisma.Decimal | number | string;

function toNumber(value: DecimalLike): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return Number(value);
    return Number(value.toString());
}

/**
 * Decimal-safe equality. Tolerates a 0.0001 epsilon to absorb ULP noise from
 * Prisma.Decimal ↔ number conversions in tests.
 */
export function expectDecimalEqual(actual: DecimalLike, expected: DecimalLike, epsilon = 0.0001): void {
    const a = toNumber(actual);
    const e = toNumber(expected);
    if (Math.abs(a - e) > epsilon) {
        throw new Error(`Expected ${e} ± ${epsilon}, got ${a}`);
    }
}

/**
 * Asserts that exactly one StockMovement matching the given filter exists.
 * Useful for verifying side effects after a sale/transfer/purchase.
 */
export async function expectStockMovement(filter: {
    productId: string;
    quantity: number;
    movementType: MovementType;
    productBatchId?: string;
    companyId?: string;
}): Promise<void> {
    const movements = await basePrisma.stockMovement.findMany({
        where: {
            productId: filter.productId,
            quantity: filter.quantity,
            movementType: filter.movementType,
            ...(filter.productBatchId ? { productBatchId: filter.productBatchId } : {}),
            ...(filter.companyId ? { companyId: filter.companyId } : {}),
        },
    });
    if (movements.length === 0) {
        throw new Error(
            `Expected a stock movement matching ${JSON.stringify(filter)}, found none.`,
        );
    }
    if (movements.length > 1) {
        throw new Error(
            `Expected exactly one stock movement matching ${JSON.stringify(filter)}, found ${movements.length}.`,
        );
    }
}
