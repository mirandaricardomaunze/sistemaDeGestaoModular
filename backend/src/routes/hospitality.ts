import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { hospitalityService } from '../services/hospitalityService';
import { createRoomSchema, updateRoomSchema, checkInSchema, createHousekeepingTaskSchema } from '../validation';
import { ApiError } from '../middleware/error.middleware';
import { emitToModule } from '../lib/socket';
import { requireModule } from '../middleware/module';
import { emailQueue, JOB_OPTIONS } from '../queues/emailQueue';

const router = Router();
router.use(authenticate, requireModule('HOSPITALITY'));

const MANAGER_ROLES = ['super_admin', 'admin', 'manager'] as const;

// ============================================================================
// ROOMS CRUD
// ============================================================================

router.get('/rooms', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');

    const result = await hospitalityService.getRooms(req.companyId, {
        status: req.query.status as string,
        type: req.query.type as string,
        search: req.query.search as string,
        page: parseInt(String(req.query.page)) || 1,
        limit: parseInt(String(req.query.limit)) || 100
    });

    res.json(result);
});

router.post('/rooms', authenticate, authorize(...MANAGER_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const validatedData = createRoomSchema.parse(req.body);
    const room = await hospitalityService.createRoom(req.companyId, validatedData);
    res.status(201).json(room);
});

router.put('/rooms/:id', authenticate, authorize(...MANAGER_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const validatedData = updateRoomSchema.parse(req.body);
    const room = await hospitalityService.updateRoom(req.companyId, req.params.id, validatedData);
    res.json(room);
});

router.delete('/rooms/:id', authenticate, authorize(...MANAGER_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    await hospitalityService.deleteRoom(req.companyId, req.params.id);
    res.json({ message: 'Room deleted' });
});

// ============================================================================
// BOOKINGS (Check-in / Check-out)
// ============================================================================

router.get('/bookings', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');

    const result = await hospitalityService.getBookings(req.companyId, {
        status: req.query.status as string,
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        page: parseInt(String(req.query.page)) || 1,
        limit: parseInt(String(req.query.limit)) || 10
    });

    res.json(result);
});

router.post('/bookings', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const validatedData = checkInSchema.parse(req.body);
    const result = await hospitalityService.checkIn(req.companyId, validatedData);
    const booking = result.data;
    if (!booking) throw ApiError.internal('Falha ao criar reserva');

    // Socket Notification: Check-in performed
    emitToModule(req.companyId, 'hospitality', 'hospitality:checkin', {
        id: booking.id,
        roomNumber: booking.room.number,
        guestName: booking.customerName,
        timestamp: new Date()
    });

    // Send booking confirmation email if guest provided one. `guestEmail` comes
    // from the validated request body, not the Booking row (Booking has no email
    // column — the address is sent via the room/guest contact flow).
    const guestEmail = validatedData.guestEmail;
    if (emailQueue && guestEmail) {
        const expectedCheckout = booking.expectedCheckout ?? booking.checkOut ?? booking.checkIn;
        const nights = Math.max(1, Math.ceil(
            (new Date(expectedCheckout).getTime() - new Date(booking.checkIn).getTime()) / 86400000
        ));
        const company = await prisma.companySettings.findFirst({ where: { companyId: req.companyId }, select: { companyName: true } });
        await emailQueue.add('booking-confirmation', {
            email: guestEmail,
            guestName: booking.customerName,
            reservationId: booking.id,
            roomNumber: booking.room.number,
            checkIn: booking.checkIn,
            checkOut: expectedCheckout,
            nights,
            totalPrice: Number(booking.totalPrice),
            companyName: company?.companyName,
        }, JOB_OPTIONS).catch(() => {});
    }

    res.status(201).json(result);
});

router.post('/bookings/:id/consumptions', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');

    const { productId, quantity } = req.body;
    const bookingId = req.params.id;

    const booking = await prisma.booking.findFirst({
        where: { id: bookingId, companyId: req.companyId },
        include: { room: true }
    });

    if (!booking || booking.status !== 'checked_in') {
        throw ApiError.badRequest('Reserva não ativa ou não encontrada');
    }

    const product = await prisma.product.findFirst({
        where: { id: productId, companyId: req.companyId }
    });
    if (!product) throw ApiError.notFound('Produto não encontrado');

    if (Number(product.currentStock) < quantity) {
        throw ApiError.badRequest(`Stock insuficiente. Disponível: ${product.currentStock}`);
    }

    const consumption = await prisma.$transaction(async (tx) => {
        const item = await tx.bookingConsumption.create({
            data: {
                bookingId, productId, quantity, unitPrice: product.price,
                total: Number(product.price) * quantity, companyId: req.companyId!
            }
        });

        await tx.product.update({
            where: { id: productId },
            data: { currentStock: { decrement: quantity } }
        });

        await tx.stockMovement.create({
            data: {
                productId, movementType: 'sale', quantity: -quantity,
                balanceBefore: Number(product.currentStock), balanceAfter: Number(product.currentStock) - quantity,
                reason: `Consumo: Quarto ${booking.room.number}`,
                performedBy: req.userName || 'Sistema',
                companyId: req.companyId!, originModule: 'hospitality',
                reference: bookingId, referenceType: 'booking'
            }
        });

        await tx.transaction.create({
            data: {
                type: 'income', category: 'consumption',
                description: `Consumo: ${product.name} - Quarto ${booking.room.number}`,
                amount: Number(product.price) * quantity, date: new Date(),
                status: 'completed', paymentMethod: 'cash', companyId: req.companyId!,
                bookingId, roomId: booking.roomId, module: 'hospitality'
            }
        });

        return item;
    });

    res.status(201).json(consumption);
});

router.put('/bookings/:id/checkout', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const sessionId = req.body?.sessionId;
    const result = await hospitalityService.checkout(req.companyId, req.params.id, req.userId!, sessionId);

    // Socket Notification: Check-out performed
    emitToModule(req.companyId, 'hospitality', 'hospitality:checkout', {
        id: req.params.id,
        timestamp: new Date()
    });

    res.json(result);
});

router.get('/bookings/today-checkouts', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const checkouts = await prisma.booking.findMany({
        where: {
            room: { companyId: req.companyId },
            status: 'checked_in',
            expectedCheckout: { gte: today, lt: tomorrow }
        },
        include: { room: true, consumptions: { include: { product: { select: { name: true } } } } },
        orderBy: { expectedCheckout: 'asc' }
    });

    res.json(checkouts);
});

router.put('/bookings/:id/extend', authenticate, authorize(...MANAGER_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const { newCheckoutDate, adjustPrice } = req.body;

    const booking = await prisma.booking.findFirst({
        where: { id: req.params.id, companyId: req.companyId },
        include: { room: true }
    });

    if (!booking) throw ApiError.notFound('Reserva não encontrada');
    if (booking.status !== 'checked_in') throw ApiError.badRequest('Reserva não ativa');

    const updatedBooking = await prisma.booking.update({
        where: { id: req.params.id },
        data: {
            expectedCheckout: new Date(newCheckoutDate),
            ...(adjustPrice !== undefined && { totalPrice: adjustPrice })
        },
        include: { room: true }
    });

    res.json(updatedBooking);
});

router.get('/bookings/:id/details', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');

    const booking = await prisma.booking.findFirst({
        where: { id: req.params.id, companyId: req.companyId },
        include: {
            room: true,
            consumptions: {
                include: { product: { select: { id: true, name: true, code: true, price: true, unit: true } } },
                orderBy: { createdAt: 'desc' }
            }
        }
    });

    if (!booking) throw ApiError.notFound('Reserva não encontrada');

    const checkInDate = new Date(booking.checkIn);
    const now = new Date();
    const nightsStayed = Math.max(1, Math.ceil((now.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)));
    const consumptionTotal = booking.consumptions.reduce((acc, c) => acc + Number(c.total), 0);

    res.json({
        ...booking,
        nightsStayed,
        consumptionTotal,
        grandTotal: Number(booking.totalPrice) + consumptionTotal
    });
});

// ============================================================================
// HOUSEKEEPING TASKS
// ============================================================================

router.get('/housekeeping', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');

    const tasks = await hospitalityService.getHousekeepingTasks(req.companyId, {
        status: req.query.status as string,
        date: req.query.date as string
    });

    res.json(tasks);
});

router.post('/housekeeping', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const validated = createHousekeepingTaskSchema.parse(req.body);
    const { roomId, type, priority, assignedTo, notes, scheduledFor } = validated;

    const task = await prisma.housekeepingTask.create({
        data: {
            roomId,
            type,
            priority: typeof priority === 'number' ? priority : 1,
            assignedTo: assignedTo ?? null,
            notes: notes ?? null,
            scheduledAt: scheduledFor ? new Date(scheduledFor) : null,
            status: 'pending',
            companyId: req.companyId,
        },
        include: { room: true }
    });

    res.status(201).json(task);
});

router.put('/housekeeping/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const { status, assignedTo, notes, priority } = req.body;

    const task = await prisma.housekeepingTask.findFirst({
        where: { id: req.params.id, companyId: req.companyId }
    });
    if (!task) throw ApiError.notFound('Tarefa não encontrada');

    const updateData: Prisma.HousekeepingTaskUpdateInput = {};
    if (status) updateData.status = status as Prisma.HousekeepingTaskUpdateInput['status'];
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (notes !== undefined) updateData.notes = notes;
    if (priority !== undefined) updateData.priority = priority as Prisma.HousekeepingTaskUpdateInput['priority'];

    if (status === 'in_progress' && !task.startedAt) updateData.startedAt = new Date();
    if (status === 'completed') {
        updateData.completedAt = new Date();
        await prisma.room.updateMany({
            where: { id: task.roomId, companyId: req.companyId },
            data: { status: 'available' }
        });
    }

    const updatedTask = await prisma.housekeepingTask.update({
        where: { id: req.params.id },
        data: updateData,
        include: { room: true }
    });

    res.json(updatedTask);
});

router.delete('/housekeeping/:id', authenticate, authorize(...MANAGER_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const result = await prisma.housekeepingTask.deleteMany({ where: { id: req.params.id, companyId: req.companyId } });
    if (result.count === 0) throw ApiError.notFound('Tarefa não encontrada');
    res.json({ message: 'Task deleted' });
});

// ============================================================================
// CALENDAR & RESERVATIONS
// ============================================================================

router.get('/calendar', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate as string) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

    const [rooms, bookings] = await Promise.all([
        prisma.room.findMany({
            where: { companyId: req.companyId },
            orderBy: { number: 'asc' },
            select: { id: true, number: true, type: true, status: true, price: true }
        }),
        prisma.booking.findMany({
            where: {
                room: { companyId: req.companyId },
                OR: [
                    { checkIn: { gte: start, lte: end } },
                    { expectedCheckout: { gte: start, lte: end } },
                    { checkIn: { lte: start }, expectedCheckout: { gte: end } }
                ],
                status: { in: ['pending', 'confirmed', 'checked_in'] }
            },
            include: { room: { select: { number: true, type: true } } },
            orderBy: { checkIn: 'asc' }
        })
    ]);

    res.json({ rooms, bookings, dateRange: { start, end } });
});

router.post('/reservations', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const { roomId, checkIn, expectedCheckout, mealPlan } = req.body;

    const conflictingBooking = await prisma.booking.findFirst({
        where: {
            roomId, companyId: req.companyId,
            status: { in: ['pending', 'confirmed', 'checked_in'] },
            OR: [{ checkIn: { lte: new Date(expectedCheckout) }, expectedCheckout: { gte: new Date(checkIn) } }]
        }
    });

    if (conflictingBooking) throw ApiError.badRequest('Quarto já reservado para essas datas');

    const room = await prisma.room.findFirst({ where: { id: roomId, companyId: req.companyId } });
    if (!room) throw ApiError.notFound('Quarto não encontrado');

    let pricePerNight = Number(room.price);
    switch (mealPlan) {
        case 'none': pricePerNight = Number(room.priceNoMeal) || pricePerNight; break;
        case 'breakfast': pricePerNight = Number(room.priceBreakfast) || pricePerNight; break;
        case 'half_board': pricePerNight = Number(room.priceHalfBoard) || pricePerNight; break;
        case 'full_board': pricePerNight = Number(room.priceFullBoard) || pricePerNight; break;
    }

    const nights = Math.max(1, Math.ceil((new Date(expectedCheckout).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)));
    const totalPrice = pricePerNight * nights;

    const reservation = await prisma.booking.create({
        data: {
            ...req.body,
            guestCount: parseInt(req.body.guestCount) || 1,
            checkIn: new Date(checkIn),
            expectedCheckout: new Date(expectedCheckout),
            totalPrice,
            status: 'confirmed',
            companyId: req.companyId
        },
        include: { room: true }
    });

    res.status(201).json(reservation);
});

export default router;
