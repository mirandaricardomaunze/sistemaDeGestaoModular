import { prisma } from '../../lib/prisma';
import { stockService } from '../stockService';
import { ResultHandler } from '../../utils/result';

export class CommercialReservationService {

    async reserveItem(params: { productId: string; quantity: number; sessionId?: string; companyId: string }) {
        const { productId, quantity, sessionId, companyId } = params;
        await stockService.validateAvailability(productId, quantity, companyId);

        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 15);

        return prisma.$transaction(async (tx) => {
            await tx.product.update({ where: { id: productId }, data: { reservedStock: { increment: quantity } } });
            return tx.stockReservation.create({ data: { productId, quantity, sessionId, companyId, expiresAt } });
        });
    }

    async releaseItem(reservationId: string, companyId: string) {
        const reservation = await prisma.stockReservation.findFirst({ where: { id: reservationId, companyId } });
        if (!reservation) return ResultHandler.success(true);

        return prisma.$transaction(async (tx) => {
            await tx.product.update({ where: { id: reservation.productId }, data: { reservedStock: { decrement: reservation.quantity } } });
            await tx.stockReservation.delete({ where: { id: reservationId } });
            return true;
        });
    }

    async cleanupExpiredReservations() {
        const expired = await prisma.stockReservation.findMany({ where: { expiresAt: { lt: new Date() } } });
        if (expired.length === 0) return;

        // Aggregate decrements by productId to minimise DB round-trips
        const byProduct: Record<string, number> = {};
        for (const res of expired) {
            byProduct[res.productId] = (byProduct[res.productId] || 0) + res.quantity;
        }

        await prisma.$transaction(async (tx) => {
            await Promise.all([
                ...Object.entries(byProduct).map(([productId, qty]) =>
                    tx.product.update({ where: { id: productId }, data: { reservedStock: { decrement: qty } } })
                ),
                tx.stockReservation.deleteMany({ where: { id: { in: expired.map((e: any) => e.id) } } })
            ]);
        });
    }
}

export const commercialReservationService = new CommercialReservationService();
