import { db, type ShiftFiscalReservation } from '../../db/offlineDB';

export interface AllocatedFiscalNumber {
    assignedFiscalNumber: number;
    assignedFiscalSeries: string;
    prefix: string;
    receiptNumber: string;
}

export async function saveShiftReservations(
    sessionId: string,
    fiscal: { seriesId: string; series: string; prefix: string; fromNumber: number; toNumber: number; nextNumber: number } | undefined,
    stock: Array<{ productId: string; quantity: number }> | undefined,
): Promise<void> {
    await db.transaction('rw', db.shiftFiscalReservation, db.shiftStockReservations, async () => {
        await db.shiftFiscalReservation.where('sessionId').equals(sessionId).delete();
        await db.shiftStockReservations.where('sessionId').equals(sessionId).delete();

        if (fiscal) {
            await db.shiftFiscalReservation.put({
                sessionId,
                seriesId: fiscal.seriesId,
                series: fiscal.series,
                prefix: fiscal.prefix,
                fromNumber: fiscal.fromNumber,
                toNumber: fiscal.toNumber,
                nextNumber: fiscal.nextNumber,
                openedAt: Date.now(),
            });
        }

        if (stock && stock.length > 0) {
            await db.shiftStockReservations.bulkAdd(
                stock.map(r => ({ sessionId, productId: r.productId, quantity: r.quantity }))
            );
        }
    });
}

export async function clearShiftReservations(sessionId: string): Promise<void> {
    await db.transaction('rw', db.shiftFiscalReservation, db.shiftStockReservations, async () => {
        await db.shiftFiscalReservation.where('sessionId').equals(sessionId).delete();
        await db.shiftStockReservations.where('sessionId').equals(sessionId).delete();
    });
}

export async function getFiscalReservation(sessionId: string): Promise<ShiftFiscalReservation | undefined> {
    return db.shiftFiscalReservation.get(sessionId);
}

/**
 * Atomically consume the next fiscal number from the session's block.
 * Returns null when the block is exhausted (caller must surface an error).
 */
export async function allocateNextFiscalNumber(sessionId: string): Promise<AllocatedFiscalNumber | null> {
    return db.transaction('rw', db.shiftFiscalReservation, async () => {
        const reservation = await db.shiftFiscalReservation.get(sessionId);
        if (!reservation) return null;
        if (reservation.nextNumber > reservation.toNumber) return null;

        const assigned = reservation.nextNumber;
        await db.shiftFiscalReservation.update(sessionId, { nextNumber: assigned + 1 });

        return {
            assignedFiscalNumber: assigned,
            assignedFiscalSeries: reservation.series,
            prefix: reservation.prefix,
            receiptNumber: `${reservation.prefix} ${reservation.series}/${String(assigned).padStart(4, '0')}`,
        };
    });
}

export interface OfflineAvailability {
    productId: string;
    available: number;
}

export async function getOfflineAvailability(sessionId: string, productId: string): Promise<number> {
    const reservation = await db.shiftStockReservations
        .where('[sessionId+productId]')
        .equals([sessionId, productId])
        .first();
    return reservation?.quantity ?? 0;
}

/**
 * Decrement reserved quantity for a product after a sale clears offline.
 * Returns the new remaining quantity; null when the reservation does not
 * exist for that product (caller must block the sale).
 */
export async function consumeOfflineStock(
    sessionId: string,
    productId: string,
    units: number,
): Promise<number | null> {
    return db.transaction('rw', db.shiftStockReservations, async () => {
        const reservation = await db.shiftStockReservations
            .where('[sessionId+productId]')
            .equals([sessionId, productId])
            .first();
        if (!reservation) return null;
        const remaining = reservation.quantity - units;
        if (remaining < 0) return null;
        if (reservation.id !== undefined) {
            await db.shiftStockReservations.update(reservation.id, { quantity: remaining });
        }
        return remaining;
    });
}
