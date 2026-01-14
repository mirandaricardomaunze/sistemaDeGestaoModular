import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { HospitalityService } from '../services/hospitality.service';
import { createRoomSchema, updateRoomSchema, checkInSchema, formatZodError } from '../utils/validation';
import { ZodError } from 'zod';

const router = Router();
const hospitalityService = new HospitalityService(prisma);

// ============================================================================
// ROOMS CRUD
// ============================================================================

// GET /api/hospitality/rooms
router.get('/rooms', authenticate, async (req: AuthRequest, res) => {
    try {
        const companyId = req.companyId;
        if (!companyId) return res.status(400).json({ message: 'Empresa não identificada' });

        const result = await hospitalityService.getRooms(companyId, {
            status: req.query.status as string,
            type: req.query.type as string,
            search: req.query.search as string,
            page: parseInt(String(req.query.page)) || 1,
            limit: parseInt(String(req.query.limit)) || 100
        });

        res.json(result);
    } catch (error: any) {
        console.error('GET /rooms error:', error);
        res.status(500).json({ message: error.message });
    }
});

// POST /api/hospitality/rooms
router.post('/rooms', authenticate, async (req: AuthRequest, res) => {
    try {
        const companyId = req.companyId;
        if (!companyId) return res.status(400).json({ message: 'Empresa não identificada' });

        // Validate request body
        const validatedData = createRoomSchema.parse(req.body);

        const room = await hospitalityService.createRoom(companyId, validatedData);
        res.status(201).json(room);
    } catch (error: any) {
        if (error instanceof ZodError) {
            return res.status(400).json({
                message: 'Dados inválidos',
                details: formatZodError(error)
            });
        }
        console.error('POST /rooms error:', error);
        res.status(500).json({ message: error.message });
    }
});

// PUT /api/hospitality/rooms/:id
router.put('/rooms/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const companyId = req.companyId;
        if (!companyId) return res.status(400).json({ message: 'Empresa não identificada' });

        // Validate request body
        const validatedData = updateRoomSchema.parse(req.body);

        const room = await hospitalityService.updateRoom(companyId, req.params.id, validatedData);
        res.json(room);
    } catch (error: any) {
        if (error instanceof ZodError) {
            return res.status(400).json({
                message: 'Dados inválidos',
                details: formatZodError(error)
            });
        }
        console.error('PUT /rooms error:', error);
        res.status(500).json({ message: error.message });
    }
});

// DELETE /api/hospitality/rooms/:id
router.delete('/rooms/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const companyId = req.companyId;
        if (!companyId) return res.status(400).json({ message: 'Empresa não identificada' });

        await hospitalityService.deleteRoom(companyId, req.params.id);
        res.json({ message: 'Room deleted' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// ============================================================================
// BOOKINGS (Check-in / Check-out)
// ============================================================================

// GET /api/hospitality/bookings
router.get('/bookings', authenticate, async (req: AuthRequest, res) => {
    try {
        const companyId = req.companyId;
        if (!companyId) return res.status(400).json({ message: 'Empresa não identificada' });

        const result = await hospitalityService.getBookings(companyId, {
            status: req.query.status as string,
            page: parseInt(String(req.query.page)) || 1,
            limit: parseInt(String(req.query.limit)) || 10
        });

        res.json(result);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// POST /api/hospitality/bookings (Check-in)
router.post('/bookings', authenticate, async (req: AuthRequest, res) => {
    try {
        const companyId = req.companyId;
        if (!companyId) return res.status(400).json({ message: 'Empresa não identificada' });

        // Validate request body
        const validatedData = checkInSchema.parse(req.body);

        const result = await hospitalityService.checkIn(companyId, validatedData);
        res.status(201).json(result);
    } catch (error: any) {
        if (error instanceof ZodError) {
            return res.status(400).json({
                message: 'Dados inválidos',
                details: formatZodError(error)
            });
        }
        res.status(400).json({ message: error.message });
    }
});

// POST /api/hospitality/bookings/:id/consumptions
router.post('/bookings/:id/consumptions', authenticate, async (req: AuthRequest, res) => {
    try {
        const companyId = req.companyId;
        if (!companyId) {
            return res.status(400).json({ message: 'Empresa não identificada' });
        }

        const { productId, quantity } = req.body;
        const bookingId = req.params.id;

        const booking = await prisma.booking.findFirst({
            where: { id: bookingId, companyId },
            include: { room: true }
        });

        if (!booking || booking.status !== 'checked_in') {
            return res.status(400).json({ message: 'Booking not active or not found' });
        }

        const product = await prisma.product.findFirst({
            where: { id: productId, companyId }
        });
        if (!product) return res.status(404).json({ message: 'Product not found' });

        if (product.currentStock < quantity) {
            return res.status(400).json({ message: `Stock insuficiente. Disponível: ${product.currentStock}` });
        }

        const consumption = await prisma.$transaction(async (tx) => {
            // 1. Create consumption record
            const item = await tx.bookingConsumption.create({
                data: {
                    bookingId,
                    productId,
                    quantity,
                    unitPrice: product.price,
                    total: Number(product.price) * quantity,
                    companyId
                }
            });

            // 2. Reduce stock
            const balanceBefore = product.currentStock;
            const balanceAfter = balanceBefore - quantity;

            await tx.product.update({
                where: { id: productId },
                data: { currentStock: { decrement: quantity } }
            });

            // 2.5 Log Movement (Audit)
            await tx.stockMovement.create({
                data: {
                    productId,
                    movementType: 'sale',
                    quantity: -quantity,
                    balanceBefore,
                    balanceAfter,
                    reason: `Consumo: Quarto ${booking.room.number}`,
                    performedBy: (req as any).userName || 'Sistema',
                    companyId,
                    originModule: 'hospitality',
                    reference: bookingId,
                    referenceType: 'booking'
                }
            });

            // 3. Create financial transaction (revenue from consumption)
            await tx.transaction.create({
                data: {
                    type: 'income',
                    category: 'consumption',
                    description: `Consumo: ${product.name} - Quarto ${booking.room.number}`,
                    amount: Number(product.price) * quantity,
                    date: new Date(),
                    status: 'completed',
                    paymentMethod: 'cash',
                    companyId,
                    bookingId,
                    roomId: booking.roomId,
                    module: 'hospitality'
                }
            });

            return item;
        });

        res.status(201).json(consumption);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// PUT /api/hospitality/bookings/:id/checkout
router.put('/bookings/:id/checkout', authenticate, async (req: any, res) => {
    try {
        const companyId = (req as any).companyId;
        const booking = await prisma.booking.findFirst({
            where: { id: req.params.id, companyId },
            include: {
                room: true,
                consumptions: {
                    include: { product: true }
                }
            }
        });
        if (!booking) return res.status(404).json({ message: 'Booking not found' });

        const result = await prisma.$transaction(async (tx) => {
            // 1. Update booking status
            const updatedBooking = await tx.booking.update({
                where: { id: req.params.id },
                data: { status: 'checked_out', checkOut: new Date() }
            });

            // 2. Update room status to dirty
            await tx.room.update({
                where: { id: booking.roomId },
                data: { status: 'dirty' }
            });

            // 2.5 Create a housekeeping task for this room
            await tx.housekeepingTask.create({
                data: {
                    roomId: booking.roomId,
                    type: 'checkout_cleaning',
                    status: 'pending',
                    priority: 2, // Higher priority for checkout cleaning
                    notes: `Check-out: ${booking.customerName}`,
                    companyId: booking.room.companyId
                }
            });

            // 3. Create a Sale for this stay + consumptions
            let accommodationProduct = await tx.product.findFirst({
                where: {
                    name: { contains: 'Alojamento', mode: 'insensitive' },
                    companyId: booking.room.companyId
                }
            });

            if (!accommodationProduct) {
                accommodationProduct = await tx.product.create({
                    data: {
                        code: 'SERV-HOTEL',
                        name: 'Alojamento / Hospedagem',
                        category: 'other',
                        price: booking.totalPrice,
                        currentStock: 9999,
                        unit: 'un',
                        status: 'in_stock',
                        companyId: booking.room.companyId
                    }
                });
            }

            const consumptionTotal = booking.consumptions.reduce((acc, curr) => acc + Number(curr.total), 0);
            const subtotal = Number(booking.totalPrice) + consumptionTotal;
            const tax = subtotal * 0.16;
            const total = subtotal + tax;

            // Generate Receipt Number
            const docSeriesResult = await tx.$queryRaw<any[]>`
                SELECT * FROM document_series 
                WHERE prefix = 'FR' AND "isActive" = true AND "companyId" = ${booking.room.companyId}
                ORDER BY "createdAt" DESC 
                LIMIT 1 
                FOR UPDATE
            `;

            let docSeries = docSeriesResult[0];
            if (!docSeries) {
                docSeries = await tx.documentSeries.create({
                    data: {
                        code: `FR-${new Date().getFullYear()}`,
                        name: `Faturas Recibo ${new Date().getFullYear()}`,
                        prefix: 'FR',
                        series: 'A',
                        lastNumber: 0,
                        isActive: true,
                        companyId: booking.room.companyId
                    }
                });
            }
            const series = docSeries.series;
            const fiscalNumber = docSeries.lastNumber + 1;
            const receiptNumber = `FR ${series}/${String(fiscalNumber).padStart(4, '0')}`;

            await tx.documentSeries.update({
                where: { id: docSeries.id },
                data: { lastNumber: fiscalNumber }
            });

            // Hash Code
            const crypto = await import('crypto');
            const hashData = `${receiptNumber}|${new Date().toISOString()}|${total}|${fiscalNumber}`;
            const hashCode = crypto.createHash('sha256').update(hashData).digest('hex').substring(0, 4).toUpperCase();

            const saleItems = [
                {
                    productId: accommodationProduct.id,
                    quantity: 1,
                    unitPrice: booking.totalPrice,
                    discount: 0,
                    total: booking.totalPrice
                },
                ...booking.consumptions.map(c => ({
                    productId: c.productId,
                    quantity: c.quantity,
                    unitPrice: c.unitPrice,
                    discount: 0,
                    total: c.total
                }))
            ];

            const sale = await tx.sale.create({
                data: {
                    receiptNumber,
                    customerId: booking.customerId,
                    userId: (req as any).userId,
                    subtotal,
                    discount: 0,
                    tax,
                    total,
                    paymentMethod: 'cash',
                    amountPaid: total,
                    change: 0,
                    notes: `Check-out Hotel - Quarto ${booking.room.number}`,
                    series,
                    fiscalNumber,
                    hashCode,
                    companyId: booking.room.companyId,
                    items: {
                        create: saleItems
                    }
                }
            });

            // 4. Create financial transaction (revenue)
            await tx.transaction.create({
                data: {
                    type: 'income',
                    category: 'accommodation',
                    description: `Check-out: ${booking.customerName} - Quarto ${booking.room.number}`,
                    amount: total,
                    date: new Date(),
                    status: 'completed',
                    paymentMethod: 'cash',
                    reference: receiptNumber,
                    companyId: booking.room.companyId,
                    bookingId: booking.id,
                    roomId: booking.roomId,
                    module: 'hospitality'
                }
            });

            return { updatedBooking, sale };
        });

        res.json(result);
    } catch (error: any) {
        console.error('Checkout error:', error);
        res.status(500).json({ message: error.message });
    }
});

// ============================================================================
// TODAY'S CHECKOUTS (For notifications)
// ============================================================================

// GET /api/hospitality/bookings/today-checkouts
router.get('/bookings/today-checkouts', authenticate, async (req: AuthRequest, res) => {
    try {
        const companyId = req.companyId;
        if (!companyId) {
            return res.status(400).json({ message: 'Empresa não identificada' });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const checkouts = await prisma.booking.findMany({
            where: {
                room: { companyId },
                status: 'checked_in',
                expectedCheckout: {
                    gte: today,
                    lt: tomorrow
                }
            },
            include: {
                room: true,
                consumptions: {
                    include: { product: { select: { name: true } } }
                }
            },
            orderBy: { expectedCheckout: 'asc' }
        });

        res.json(checkouts);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// ============================================================================
// EXTEND STAY
// ============================================================================

// PUT /api/hospitality/bookings/:id/extend
router.put('/bookings/:id/extend', authenticate, async (req, res) => {
    try {
        const { newCheckoutDate, adjustPrice } = req.body;
        const booking = await prisma.booking.findFirst({
            where: { id: req.params.id, companyId: (req as any).companyId },
            include: { room: true }
        });

        if (!booking) return res.status(404).json({ message: 'Booking not found' });
        if (booking.status !== 'checked_in') {
            return res.status(400).json({ message: 'Booking is not active' });
        }

        const updateData: any = {
            expectedCheckout: new Date(newCheckoutDate)
        };

        // Optionally adjust price if extending changes total
        if (adjustPrice !== undefined) {
            updateData.totalPrice = adjustPrice;
        }

        const updatedBooking = await prisma.booking.update({
            where: { id: req.params.id },
            data: updateData,
            include: { room: true }
        });

        res.json(updatedBooking);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// ============================================================================
// DETAILED BOOKING INFO (Guest Profile)
// ============================================================================

// GET /api/hospitality/bookings/:id/details
router.get('/bookings/:id/details', authenticate, async (req, res) => {
    try {
        const companyId = (req as any).companyId;
        const booking = await prisma.booking.findFirst({
            where: { id: req.params.id, companyId },
            include: {
                room: true,
                consumptions: {
                    include: {
                        product: {
                            select: { id: true, name: true, code: true, price: true, unit: true }
                        }
                    },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!booking) return res.status(404).json({ message: 'Booking not found' });

        // Calculate nights stayed
        const checkInDate = new Date(booking.checkIn);
        const now = new Date();
        const nightsStayed = Math.ceil((now.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

        // Calculate consumption total
        const consumptionTotal = booking.consumptions.reduce((acc, c) => acc + Number(c.total), 0);

        res.json({
            ...booking,
            nightsStayed,
            consumptionTotal,
            grandTotal: Number(booking.totalPrice) + consumptionTotal
        });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// ============================================================================
// HOUSEKEEPING TASKS
// ============================================================================

// GET /api/hospitality/housekeeping
router.get('/housekeeping', authenticate, async (req: AuthRequest, res) => {
    try {
        const companyId = req.companyId;
        if (!companyId) return res.status(400).json({ message: 'Empresa não identificada' });

        const tasks = await hospitalityService.getHousekeepingTasks(companyId, {
            status: req.query.status as string,
            date: req.query.date as string
        });

        res.json(tasks);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// POST /api/hospitality/housekeeping
router.post('/housekeeping', authenticate, async (req: AuthRequest, res) => {
    try {
        const companyId = req.companyId;
        if (!companyId) {
            return res.status(400).json({ message: 'Empresa não identificada' });
        }

        const { roomId, type, priority, assignedTo, notes, scheduledAt } = req.body;

        const task = await prisma.housekeepingTask.create({
            data: {
                roomId,
                type: type || 'checkout_cleaning',
                priority: priority || 1,
                assignedTo,
                notes,
                scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
                status: 'pending',
                companyId
            },
            include: { room: true }
        });

        res.status(201).json(task);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// PUT /api/hospitality/housekeeping/:id
router.put('/housekeeping/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const companyId = req.companyId;
        if (!companyId) {
            return res.status(400).json({ message: 'Empresa não identificada' });
        }

        const { status, assignedTo, notes, priority } = req.body;

        const updateData: any = {};
        if (status) updateData.status = status;
        if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
        if (notes !== undefined) updateData.notes = notes;
        if (priority !== undefined) updateData.priority = priority;

        // Track status transitions
        if (status === 'in_progress' && !updateData.startedAt) {
            updateData.startedAt = new Date();
        }
        if (status === 'completed') {
            updateData.completedAt = new Date();

            // Mark room as available when housekeeping completes
            const task = await prisma.housekeepingTask.findFirst({
                where: { id: req.params.id, companyId }
            });
            if (task) {
                await prisma.room.updateMany({
                    where: { id: task.roomId, companyId },
                    data: { status: 'available' }
                });
            }
        }

        const updatedTask = await prisma.housekeepingTask.update({
            where: { id: req.params.id, companyId },
            data: updateData,
            include: { room: true }
        });

        res.json(updatedTask);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// DELETE /api/hospitality/housekeeping/:id
router.delete('/housekeeping/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const companyId = req.companyId;
        if (!companyId) {
            return res.status(400).json({ message: 'Empresa não identificada' });
        }

        await prisma.housekeepingTask.delete({ where: { id: req.params.id, companyId } });
        res.json({ message: 'Task deleted' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// ============================================================================
// CALENDAR VIEW
// ============================================================================

// GET /api/hospitality/calendar
router.get('/calendar', authenticate, async (req: AuthRequest, res) => {
    try {
        const companyId = req.companyId;
        if (!companyId) {
            return res.status(400).json({ message: 'Empresa não identificada' });
        }

        const { startDate, endDate } = req.query;

        // Default to current month if not specified
        const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const end = endDate ? new Date(endDate as string) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

        // Get all rooms
        const rooms = await prisma.room.findMany({
            where: { companyId },
            orderBy: { number: 'asc' },
            select: { id: true, number: true, type: true, status: true, price: true }
        });

        // Get all bookings that overlap with the date range
        const bookings = await prisma.booking.findMany({
            where: {
                room: { companyId },
                OR: [
                    // Booking starts within range
                    {
                        checkIn: {
                            gte: start,
                            lte: end
                        }
                    },
                    // Booking ends within range
                    {
                        expectedCheckout: {
                            gte: start,
                            lte: end
                        }
                    },
                    // Booking spans the entire range
                    {
                        checkIn: { lte: start },
                        expectedCheckout: { gte: end }
                    }
                ],
                status: { in: ['pending', 'confirmed', 'checked_in'] }
            },
            include: {
                room: { select: { number: true, type: true } }
            },
            orderBy: { checkIn: 'asc' }
        });

        res.json({
            rooms,
            bookings,
            dateRange: { start, end }
        });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// ============================================================================
// CREATE FUTURE RESERVATION
// ============================================================================

// POST /api/hospitality/reservations (Future booking)
router.post('/reservations', authenticate, async (req: AuthRequest, res) => {
    try {
        const companyId = req.companyId;
        if (!companyId) {
            return res.status(400).json({ message: 'Empresa não identificada' });
        }

        const {
            roomId,
            customerName,
            guestCount,
            guestDocumentType,
            guestDocumentNumber,
            guestNationality,
            guestPhone,
            checkIn,
            expectedCheckout,
            mealPlan,
            notes
        } = req.body;

        // Validate room availability for the dates
        const conflictingBooking = await prisma.booking.findFirst({
            where: {
                roomId,
                companyId,
                status: { in: ['pending', 'confirmed', 'checked_in'] },
                OR: [
                    {
                        checkIn: { lte: new Date(expectedCheckout) },
                        expectedCheckout: { gte: new Date(checkIn) }
                    }
                ]
            }
        });

        if (conflictingBooking) {
            return res.status(400).json({ message: 'Quarto já reservado para essas datas' });
        }

        const room = await prisma.room.findFirst({ where: { id: roomId, companyId } });
        if (!room) return res.status(404).json({ message: 'Quarto não encontrado' });

        // Calculate price based on meal plan
        let pricePerNight = Number(room.price);
        switch (mealPlan) {
            case 'none': pricePerNight = Number(room.priceNoMeal) || pricePerNight; break;
            case 'breakfast': pricePerNight = Number(room.priceBreakfast) || pricePerNight; break;
            case 'half_board': pricePerNight = Number(room.priceHalfBoard) || pricePerNight; break;
            case 'full_board': pricePerNight = Number(room.priceFullBoard) || pricePerNight; break;
        }

        // Calculate nights
        const nights = Math.ceil(
            (new Date(expectedCheckout).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)
        );
        const totalPrice = pricePerNight * nights;

        const reservation = await prisma.booking.create({
            data: {
                roomId,
                customerName,
                guestCount: parseInt(guestCount) || 1,
                guestDocumentType,
                guestDocumentNumber,
                guestNationality,
                guestPhone,
                checkIn: new Date(checkIn),
                expectedCheckout: new Date(expectedCheckout),
                totalPrice,
                mealPlan: mealPlan || 'none',
                status: 'confirmed', // Future reservation starts as confirmed
                notes,
                companyId
            },
            include: { room: true }
        });

        res.status(201).json(reservation);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Helper to seed some rooms
router.post('/rooms/seed', authenticate, async (req, res) => {
    try {
        const count = await prisma.room.count();
        if (count > 0) return res.status(400).json({ message: 'Rooms already exist' });

        const roomsData = [
            { number: '101', type: 'single', price: 1500, status: 'available' },
            { number: '102', type: 'double', price: 2500, status: 'available' },
            { number: '103', type: 'suite', price: 5000, status: 'available' },
            { number: '201', type: 'single', price: 1500, status: 'available' },
            { number: '202', type: 'double', price: 2500, status: 'available' },
            { number: '203', type: 'deluxe', price: 8000, status: 'available' },
        ];

        await prisma.room.createMany({ data: roomsData as any });
        res.json({ message: 'Rooms seeded successfully' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// ============================================================================
// DASHBOARD ROUTES (Sub-router)
// ============================================================================
import hospitalityDashboardRoutes from './hospitality-dashboard';
router.use('/dashboard', hospitalityDashboardRoutes);

export default router;
