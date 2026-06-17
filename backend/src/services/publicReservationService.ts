import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';

export type PublicAvailableRoomsParams = {
    checkIn: string;
    checkOut: string;
    guests?: number;
    type?: string;
    companyId: string;
};

export type PublicMealPlan = 'none' | 'breakfast' | 'half_board' | 'full_board';

export type PublicReservationInput = {
    roomId: string;
    companyId: string;
    customerName: string;
    customerEmail?: string;
    checkIn: string;
    checkOut: string;
    guestCount?: number;
    mealPlan?: PublicMealPlan;
};

const ACTIVE_BOOKING_STATUSES = ['checked_in', 'confirmed', 'pending'] as const;
const MAX_PUBLIC_STAY_NIGHTS = 365;

function parseStay(checkIn: string, checkOut: string) {
    const checkInDate = new Date(`${checkIn}T12:00:00`);
    const checkOutDate = new Date(`${checkOut}T12:00:00`);
    if (!Number.isFinite(checkInDate.getTime()) || !Number.isFinite(checkOutDate.getTime())) {
        throw ApiError.badRequest('Datas de check-in e check-out invalidas');
    }
    if (checkOutDate <= checkInDate) {
        throw ApiError.badRequest('Data de check-out deve ser posterior ao check-in');
    }

    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / 86_400_000);
    if (nights > MAX_PUBLIC_STAY_NIGHTS) {
        throw ApiError.badRequest(`A reserva publica nao pode exceder ${MAX_PUBLIC_STAY_NIGHTS} noites`);
    }
    return { checkInDate, checkOutDate, nights };
}

async function requirePublicHospitalityCompany(companyId: string): Promise<void> {
    const company = await prisma.company.findFirst({
        where: {
            id: companyId,
            status: { in: ['active', 'trial'] },
            modules: { some: { moduleCode: 'HOSPITALITY', isActive: true } },
        },
        select: { id: true },
    });
    if (!company) throw ApiError.notFound('Hotel nao encontrado ou reservas indisponiveis');
}

export class PublicReservationService {
    async listAvailableRooms(params: PublicAvailableRoomsParams) {
        const { checkIn, checkOut, type, companyId } = params;
        await requirePublicHospitalityCompany(companyId);
        const { checkInDate, checkOutDate, nights } = parseStay(checkIn, checkOut);

        const occupiedRoomIds = await prisma.booking.findMany({
            where: {
                companyId,
                status: { in: [...ACTIVE_BOOKING_STATUSES] },
                checkIn: { lt: checkOutDate },
                expectedCheckout: { gt: checkInDate },
            },
            select: { roomId: true },
        });

        const roomWhere: Prisma.RoomWhereInput = {
            companyId,
            status: 'available',
            id: { notIn: occupiedRoomIds.map((booking) => booking.roomId) },
        };
        if (type) roomWhere.type = type as Prisma.RoomWhereInput['type'];
        const rooms = await prisma.room.findMany({
            where: roomWhere,
            orderBy: { number: 'asc' },
            select: {
                id: true,
                number: true,
                type: true,
                price: true,
                priceNoMeal: true,
                priceBreakfast: true,
                priceHalfBoard: true,
                priceFullBoard: true,
            },
        });

        return {
            checkIn,
            checkOut,
            nights,
            rooms: rooms.map((room) => ({
                id: room.id,
                number: room.number,
                type: room.type,
                nights,
                pricing: {
                    noMeal: { total: Number(room.priceNoMeal || room.price) * nights },
                    breakfast: { total: Number(room.priceBreakfast || room.price) * nights },
                    halfBoard: { total: Number(room.priceHalfBoard || room.price) * nights },
                    fullBoard: { total: Number(room.priceFullBoard || room.price) * nights },
                },
            })),
        };
    }

    async createReservation(data: PublicReservationInput) {
        const { roomId, companyId, customerName, checkIn, checkOut, guestCount, mealPlan = 'none' } = data;
        await requirePublicHospitalityCompany(companyId);
        const { checkInDate, checkOutDate, nights } = parseStay(checkIn, checkOut);

        const booking = await prisma.$transaction(async (tx) => {
            const room = await tx.room.findFirst({
                where: {
                    id: roomId,
                    companyId,
                    status: 'available',
                },
            });
            if (!room) throw ApiError.notFound('Quarto nao encontrado ou indisponivel');

            const conflict = await tx.booking.findFirst({
                where: {
                    companyId,
                    roomId,
                    status: { in: [...ACTIVE_BOOKING_STATUSES] },
                    checkIn: { lt: checkOutDate },
                    expectedCheckout: { gt: checkInDate },
                },
                select: { id: true },
            });
            if (conflict) throw ApiError.conflict('O quarto ja nao esta disponivel para estas datas');

            const prices: Record<PublicMealPlan, number> = {
                none: Number(room.priceNoMeal || room.price),
                breakfast: Number(room.priceBreakfast || room.price),
                half_board: Number(room.priceHalfBoard || room.price),
                full_board: Number(room.priceFullBoard || room.price),
            };

            return tx.booking.create({
                data: {
                    roomId,
                    companyId,
                    customerName,
                    guestCount: guestCount || 1,
                    checkIn: checkInDate,
                    expectedCheckout: checkOutDate,
                    totalPrice: prices[mealPlan] * nights,
                    mealPlan,
                    status: 'confirmed',
                },
                select: { id: true },
            });
        }, { isolationLevel: 'Serializable' });

        return { success: true, reservationId: booking.id };
    }
}

export const publicReservationService = new PublicReservationService();
