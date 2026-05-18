import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { stockService } from '../stockService';
import { ResultHandler } from '../../utils/result';
import { invalidateCommercialCache } from './shared';

interface WarehouseReservedQuantityClient {
    warehouseStock: {
        updateMany(args: Prisma.WarehouseStockUpdateManyArgs): Promise<Prisma.BatchPayload>;
    };
}

export class CommercialReservationService {

    private async resolveWarehouseId(companyId: string, sessionId?: string, warehouseId?: string) {
        if (warehouseId) return warehouseId;
        if (!sessionId) return undefined;
        const session = await prisma.cashSession.findFirst({
            where: { id: sessionId, companyId },
            select: { warehouseId: true }
        });
        return session?.warehouseId || undefined;
    }

    private async updateWarehouseReservedQuantity(
        productId: string,
        companyId: string,
        quantity: number,
        warehouseId: string | undefined,
        tx: WarehouseReservedQuantityClient
    ) {
        if (!warehouseId || quantity === 0) return;
        await tx.warehouseStock.updateMany({
            where: { productId, companyId, warehouseId },
            data: { reservedQuantity: { increment: quantity } }
        });
    }

    async reserveItem(params: { productId: string; quantity: number; sessionId?: string; warehouseId?: string; companyId: string }) {
        const { productId, quantity, sessionId, companyId } = params;
        const warehouseId = await this.resolveWarehouseId(companyId, sessionId, params.warehouseId);
        await stockService.validateAvailability(productId, quantity, companyId, undefined, warehouseId);

        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 15);

        const reservation = await prisma.$transaction(async (tx) => {
            await tx.product.update({ where: { id: productId }, data: { reservedStock: { increment: quantity } } });
            await this.updateWarehouseReservedQuantity(productId, companyId, quantity, warehouseId, tx);
            return tx.stockReservation.create({ data: { productId, quantity, sessionId, companyId, expiresAt } });
        });
        invalidateCommercialCache(companyId);
        return reservation;
    }

    async releaseItem(reservationId: string, companyId: string) {
        const reservation = await prisma.stockReservation.findFirst({ where: { id: reservationId, companyId } });
        if (!reservation) return ResultHandler.success(true);
        const warehouseId = await this.resolveWarehouseId(companyId, reservation.sessionId || undefined);

        return prisma.$transaction(async (tx) => {
            await tx.product.update({ where: { id: reservation.productId }, data: { reservedStock: { decrement: reservation.quantity } } });
            await this.updateWarehouseReservedQuantity(reservation.productId, companyId, -reservation.quantity, warehouseId, tx);
            await tx.stockReservation.delete({ where: { id: reservationId } });
            return true;
        });
    }

    async releaseReservations(reservationIds: string[], companyId: string) {
        const uniqueIds = Array.from(new Set(reservationIds.filter(Boolean)));
        if (uniqueIds.length === 0) return ResultHandler.success(true);

        const reservations = await prisma.stockReservation.findMany({
            where: { id: { in: uniqueIds }, companyId }
        });
        if (reservations.length === 0) return ResultHandler.success(true);

        const sessions = await prisma.cashSession.findMany({
            where: { id: { in: reservations.map(r => r.sessionId).filter((id): id is string => !!id) }, companyId },
            select: { id: true, warehouseId: true }
        });
        const warehouseBySession = new Map(sessions.map(s => [s.id, s.warehouseId || undefined]));

        await prisma.$transaction(async (tx) => {
            for (const reservation of reservations) {
                await tx.product.update({
                    where: { id: reservation.productId },
                    data: { reservedStock: { decrement: reservation.quantity } }
                });
                await this.updateWarehouseReservedQuantity(
                    reservation.productId,
                    companyId,
                    -reservation.quantity,
                    reservation.sessionId ? warehouseBySession.get(reservation.sessionId) : undefined,
                    tx
                );
            }
            await tx.stockReservation.deleteMany({ where: { id: { in: reservations.map(r => r.id) }, companyId } });
        });

        invalidateCommercialCache(companyId);
        return ResultHandler.success(true);
    }

    async cleanupExpiredReservations() {
        const expired = await prisma.stockReservation.findMany({ where: { expiresAt: { lt: new Date() } } });
        if (expired.length === 0) return;

        // Aggregate decrements by productId to minimise DB round-trips
        const byProduct: Record<string, number> = {};
        for (const res of expired) {
            byProduct[res.productId] = (byProduct[res.productId] || 0) + res.quantity;
        }
        const sessionIds = expired.map(res => res.sessionId).filter((id): id is string => Boolean(id));
        const sessions = sessionIds.length > 0
            ? await prisma.cashSession.findMany({
                where: { id: { in: sessionIds } },
                select: { id: true, warehouseId: true }
            })
            : [];
        const warehouseBySession = new Map(sessions.map(session => [session.id, session.warehouseId || undefined]));

        await prisma.$transaction(async (tx) => {
            await Promise.all(Object.entries(byProduct).map(([productId, qty]) =>
                tx.product.update({ where: { id: productId }, data: { reservedStock: { decrement: qty } } })
            ));
            for (const res of expired) {
                const warehouseId = res.sessionId ? warehouseBySession.get(res.sessionId) : undefined;
                await this.updateWarehouseReservedQuantity(res.productId, res.companyId, -res.quantity, warehouseId, tx);
            }
            await tx.stockReservation.deleteMany({ where: { id: { in: expired.map(res => res.id) } } });
        });
    }
}

export const commercialReservationService = new CommercialReservationService();
