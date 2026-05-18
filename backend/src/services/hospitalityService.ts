import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { ResultHandler } from '../utils/result';
import { parseFields } from '../utils/pagination';

type Nullable<T> = T | null | undefined;

type RoomInput = {
    number: string;
    type: string;
    pricePerNight?: Nullable<number>;
    price?: Nullable<number>;
    priceBreakfast?: Nullable<number>;
    priceHalfBoard?: Nullable<number>;
    priceFullBoard?: Nullable<number>;
    priceNoMeal?: Nullable<number>;
    notes?: Nullable<string>;
    description?: Nullable<string>;
    floor?: Nullable<number>;
    capacity?: Nullable<number>;
    name?: Nullable<string>;
    amenities?: Nullable<string[]>;
    images?: Nullable<string[]>;
    isActive?: boolean;
};

type CheckInInput = {
    roomId: string;
    guestName?: Nullable<string>;
    customerName?: Nullable<string>;
    guestEmail?: Nullable<string>;
    guestCount?: number | string;
    checkIn: string | Date;
    checkOut?: string | Date | null;
    mealPlan?: string;
    [key: string]: unknown;
};

const ROOM_FIELDS = [
    'id', 'number', 'type', 'status', 'price',
    'priceBreakfast', 'priceHalfBoard', 'priceFullBoard', 'priceNoMeal',
    'notes', 'createdAt', 'updatedAt'
] as const;
const BOOKING_FIELDS = [
    'id', 'checkIn', 'checkOut', 'status', 'totalAmount',
    'guestName', 'guestPhone', 'roomId', 'createdAt'
] as const;

export class HospitalityService {

    // ============================================================================
    // ROOMS MANAGEMENT
    // ============================================================================

    async getRooms(companyId: string, filters: { status?: string; type?: string; search?: string; page?: number; limit?: number; fields?: string }) {
        const { status, type, search, page = 1, limit = 100 } = filters;
        const skip = (page - 1) * limit;

        const where: Prisma.RoomWhereInput = { companyId };
        if (status && status !== 'all') where.status = status as Prisma.RoomWhereInput['status'];
        if (type && type !== 'all') where.type = type as Prisma.RoomWhereInput['type'];
        if (search) {
            where.number = { contains: search, mode: 'insensitive' };
        }

        const projection = parseFields(filters.fields, ROOM_FIELDS);
        const baseArgs = { where, orderBy: { number: 'asc' as const }, skip, take: limit };
        const findArgs: Prisma.RoomFindManyArgs = projection
            ? { ...baseArgs, select: projection as Prisma.RoomSelect }
            : {
                ...baseArgs,
                include: {
                    bookings: {
                        where: { status: 'checked_in' },
                        include: {
                            consumptions: {
                                include: { product: { select: { id: true, name: true, code: true, price: true } } }
                            }
                        },
                        orderBy: { checkIn: 'desc' },
                        take: 1
                    }
                }
            };

        const [rooms, total, allRooms] = await Promise.all([
            prisma.room.findMany(findArgs),
            prisma.room.count({ where }),
            prisma.room.groupBy({
                by: ['status'],
                where: { companyId },
                _count: true
            })
        ]);

        const metrics = {
            available: allRooms.find(r => r.status === 'available')?._count || 0,
            occupied: allRooms.find(r => r.status === 'occupied')?._count || 0,
            dirty: allRooms.find(r => r.status === 'dirty')?._count || 0,
            maintenance: allRooms.find(r => r.status === 'maintenance')?._count || 0,
            total: allRooms.reduce((acc, curr) => acc + curr._count, 0)
        };

        return ResultHandler.success({
            data: rooms,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            },
            metrics
        });
    }

    async createRoom(companyId: string, data: RoomInput) {
        const { pricePerNight, floor: _floor, capacity: _capacity, name: _name, description, amenities: _amenities, images: _images, isActive: _isActive, ...rest } = data;
        const room = await prisma.room.create({
            data: {
                number: rest.number,
                type: rest.type as Prisma.RoomUncheckedCreateInput['type'],
                price: pricePerNight ?? rest.price ?? 0,
                notes: description ?? rest.notes,
                priceBreakfast: rest.priceBreakfast,
                priceHalfBoard: rest.priceHalfBoard,
                priceFullBoard: rest.priceFullBoard,
                priceNoMeal: rest.priceNoMeal,
                status: 'available',
                companyId,
            }
        });
        return ResultHandler.success(room, 'Quarto criado com sucesso');
    }

    async updateRoom(companyId: string, roomId: string, data: Partial<RoomInput>) {
        const { pricePerNight, floor: _floor, capacity: _capacity, name: _name, description, amenities: _amenities, images: _images, isActive: _isActive, ...rest } = data;
        const updateData: Prisma.RoomUncheckedUpdateInput = { ...rest } as Prisma.RoomUncheckedUpdateInput;
        if (pricePerNight !== undefined && pricePerNight !== null) updateData.price = pricePerNight;
        if (description !== undefined && description !== null) updateData.notes = description;
        const updated = await prisma.room.update({
            where: { id: roomId, companyId },
            data: updateData,
        });
        return ResultHandler.success(updated, 'Quarto actualizado');
    }

    async deleteRoom(companyId: string, roomId: string) {
        const deleted = await prisma.room.delete({
            where: { id: roomId, companyId }
        });
        return ResultHandler.success(deleted, 'Quarto removido');
    }

    // ============================================================================
    // BOOKINGS OPERATIONS
    // ============================================================================

    async getBookings(companyId: string, filters: { status?: string; search?: string; page?: number; limit?: number; fields?: string }) {
        const { status, search, page = 1, limit = 10 } = filters;
        const skip = (page - 1) * limit;

        const where: Prisma.BookingWhereInput = { room: { companyId } };
        if (status && status !== 'all') {
            where.status = status as Prisma.BookingWhereInput['status'];
        }

        if (search && typeof search === 'string') {
            const term = search.trim();
            if (term) {
                where.OR = [
                    { customerName: { contains: term, mode: 'insensitive' } },
                    { guestPhone: { contains: term, mode: 'insensitive' } },
                    { guestDocumentNumber: { contains: term, mode: 'insensitive' } },
                    { room: { number: { contains: term, mode: 'insensitive' } } }
                ];
            }
        }

        const projection = parseFields(filters.fields, BOOKING_FIELDS);
        const baseArgs = { where, orderBy: { checkIn: 'desc' as const }, skip, take: limit };
        const findArgs: Prisma.BookingFindManyArgs = projection
            ? { ...baseArgs, select: projection as Prisma.BookingSelect }
            : {
                ...baseArgs,
                include: {
                    room: true,
                    consumptions: {
                        include: { product: { select: { id: true, name: true, code: true, price: true } } }
                    }
                }
            };

        const [bookings, total] = await Promise.all([
            prisma.booking.findMany(findArgs),
            prisma.booking.count({ where })
        ]);

        return ResultHandler.success({
            data: bookings,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    }

    async checkIn(companyId: string, data: CheckInInput) {
        return prisma.$transaction(async (tx) => {
            const room = await tx.room.findUnique({ where: { id: data.roomId, companyId } });
            if (!room || room.status !== 'available') {
                throw ApiError.badRequest('Quarto não disponível para ocupação');
            }

            // ====================================================================
            // AUTHORITATIVE CALCULATION
            // Ignore frontend totalPrice and use DB prices from room configuration
            // ====================================================================
            let finalPrice = Number(room.price);
            const mealPlan = data.mealPlan || 'none';

            switch (mealPlan) {
                case 'none': finalPrice = Number(room.priceNoMeal || room.price); break;
                case 'breakfast': finalPrice = Number(room.priceBreakfast || room.price); break;
                case 'half_board': finalPrice = Number(room.priceHalfBoard || room.price); break;
                case 'full_board': finalPrice = Number(room.priceFullBoard || room.price); break;
            }

            const { guestName, guestEmail: _guestEmail, ...rest } = data;
            const guestCountRaw = (rest as { guestCount?: number | string }).guestCount;
            const booking = await tx.booking.create({
                data: {
                    ...(rest as Prisma.BookingUncheckedCreateInput),
                    customerName: (rest as { customerName?: string }).customerName ?? guestName ?? '',
                    guestCount: parseInt(String(guestCountRaw ?? 1)) || 1,
                    checkIn: new Date(rest.checkIn),
                    checkOut: rest.checkOut ? new Date(rest.checkOut) : null,
                    expectedCheckout: rest.checkOut ? new Date(rest.checkOut) : null,
                    totalPrice: finalPrice,
                    status: 'checked_in',
                    companyId
                },
                include: { room: true }
            });

            await tx.room.update({
                where: { id: data.roomId },
                data: { status: 'occupied' }
            });

            return ResultHandler.success(booking, 'Check-in realizado com sucesso');
        });
    }

    async checkout(companyId: string, bookingId: string, userId: string, sessionId?: string) {
        return prisma.$transaction(async (tx) => {
            // ====================================================================
            // OPERATIONAL PREREQUISITE: CASH SESSION
            // ====================================================================
            if (!sessionId) {
                throw ApiError.badRequest('Sessão de caixa é obrigatória para processar check-outs');
            }
            const session = await tx.cashSession.findFirst({
                where: { id: sessionId, companyId, status: 'open' }
            });
            if (!session) {
                throw ApiError.badRequest('Sessão de caixa não encontrada ou já encerrada');
            }

            const booking = await tx.booking.findUnique({
                where: { id: bookingId },
                include: { room: true, consumptions: true }
            });
            if (!booking || booking.room.companyId !== companyId) throw ApiError.notFound('Reserva não encontrada');

            const updatedBooking = await tx.booking.update({
                where: { id: bookingId },
                data: { status: 'checked_out', checkOut: new Date() }
            });

            await tx.room.update({
                where: { id: booking.roomId },
                data: { status: 'dirty' }
            });

            await tx.housekeepingTask.create({
                data: {
                    roomId: booking.roomId,
                    type: 'checkout_cleaning',
                    status: 'pending',
                    priority: 2,
                    notes: `Check-out: ${booking.customerName}`,
                    companyId
                }
            });

            // 💰 Global Transaction Record
            const roomBill = Number(booking.totalPrice);
            const consumptionBill = booking.consumptions.reduce((acc, c) => acc + Number(c.total), 0);
            const totalBill = Math.round((roomBill + consumptionBill) * 100) / 100;

            await tx.transaction.create({
                data: {
                    type: 'income',
                    category: 'hospitality',
                    description: `Check-out Hotel: Quarto ${booking.room.number} - ${booking.customerName}`,
                    amount: totalBill,
                    date: new Date(),
                    status: 'completed',
                    paymentMethod: 'cash',
                    reference: booking.id,
                    module: 'hospitality',
                    companyId,
                    bookingId,
                    roomId: booking.roomId
                }
            });

            return ResultHandler.success({ updatedBooking, totalBill }, 'Check-out realizado com sucesso');
        });
    }

    // ============================================================================
    // HOUSEKEEPING
    // ============================================================================

    async getHousekeepingTasks(companyId: string, filters: { status?: string; date?: string }) {
        const { status, date } = filters;
        const where: Prisma.HousekeepingTaskWhereInput = { companyId };

        if (status && status !== 'all') where.status = status as Prisma.HousekeepingTaskWhereInput['status'];
        if (date) {
            const start = new Date(date); start.setHours(0, 0, 0, 0);
            const end = new Date(start); end.setDate(end.getDate() + 1);
            where.createdAt = { gte: start, lt: end };
        }

        const tasks = await prisma.housekeepingTask.findMany({
            where,
            include: { room: { select: { id: true, number: true, type: true, status: true } } },
            orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }]
        });

        return ResultHandler.success(tasks);
    }
}

export const hospitalityService = new HospitalityService();
