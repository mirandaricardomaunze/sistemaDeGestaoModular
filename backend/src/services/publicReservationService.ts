import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';

export class PublicReservationService {
    async listAvailableRooms(params: any) {
        const { checkIn, checkOut, guests, type, companyId } = params;
        if (!companyId) throw ApiError.badRequest('companyId is required');
        if (!checkIn || !checkOut) throw ApiError.badRequest('Datas de check-in e check-out são obrigatórias');

        const checkInDate = new Date(checkIn + 'T12:00:00');
        const checkOutDate = new Date(checkOut + 'T12:00:00');
        if (checkOutDate <= checkInDate) throw ApiError.badRequest('Data de check-out deve ser posterior ao check-in');

        const occupiedRoomIds = await prisma.booking.findMany({
            where: {
                room: { companyId },
                status: { in: ['checked_in', 'confirmed', 'pending'] },
                OR: [{ checkIn: { lt: checkOutDate }, expectedCheckout: { gt: checkInDate } }, { checkIn: { gte: checkInDate, lt: checkOutDate } }]
            },
            select: { roomId: true }
        });

        const roomWhere: any = { companyId, status: { in: ['available', 'dirty'] }, id: { notIn: occupiedRoomIds.map(b => b.roomId) } };
        if (type) roomWhere.type = type;

        const rooms = await prisma.room.findMany({ where: roomWhere, orderBy: { number: 'asc' } });
        const nights = Math.ceil(Math.abs(checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

        return {
            checkIn, checkOut, nights,
            rooms: rooms.map(room => ({
                ...room, nights,
                pricing: {
                    noMeal: { total: Number(room.priceNoMeal || room.price) * nights },
                    breakfast: { total: Number(room.priceBreakfast || room.price) * nights },
                    halfBoard: { total: Number(room.priceHalfBoard || room.price) * nights },
                    fullBoard: { total: Number(room.priceFullBoard || room.price) * nights }
                }
            }))
        };
    }

    async createReservation(data: any) {
        const { roomId, companyId, customerName, checkIn, checkOut, mealPlan } = data;
        if (!companyId || !roomId || !customerName || !checkIn || !checkOut) throw ApiError.badRequest('Campos obrigatórios ausentes');

        const checkInDate = new Date(checkIn + 'T12:00:00');
        const checkOutDate = new Date(checkOut + 'T12:00:00');

        const room = await prisma.room.findFirst({ where: { id: roomId, companyId } });
        if (!room) throw ApiError.notFound('Quarto não encontrado');

        const nights = Math.ceil(Math.abs(checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
        const pricePerNight = mealPlan === 'breakfast' ? Number(room.priceBreakfast || room.price) : Number(room.priceNoMeal || room.price);

        const booking = await prisma.booking.create({
            data: {
                roomId, companyId, customerName, checkIn: checkInDate, expectedCheckout: checkOutDate,
                totalPrice: pricePerNight * nights, mealPlan: mealPlan || 'none', status: 'confirmed'
            }
        });

        return { success: true, reservationId: booking.id };
    }
}

export const publicReservationService = new PublicReservationService();
