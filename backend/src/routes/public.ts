import { Router } from 'express';
import { z } from 'zod';
import { publicReservationService } from '../services/publicReservationService';
import { rateLimiters } from '../middleware/rateLimit';
import { emailQueue, JOB_OPTIONS } from '../queues/emailQueue';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

const router = Router();
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const availableRoomsSchema = z.object({
    checkIn: z.string().regex(datePattern),
    checkOut: z.string().regex(datePattern),
    guests: z.coerce.number().int().min(1).max(50).optional(),
    type: z.string().trim().min(1).max(50).optional(),
    companyId: z.string().uuid(),
});

const reservationSchema = z.object({
    roomId: z.string().uuid(),
    companyId: z.string().uuid(),
    customerName: z.string().trim().min(2).max(160),
    customerEmail: z.string().trim().email().max(254).optional(),
    checkIn: z.string().regex(datePattern),
    checkOut: z.string().regex(datePattern),
    guestCount: z.coerce.number().int().min(1).max(50).optional(),
    mealPlan: z.enum(['none', 'breakfast', 'half_board', 'full_board']).optional(),
});

router.get('/rooms/available', rateLimiters.read, async (req, res) => {
    const query = availableRoomsSchema.parse(req.query);
    res.json(await publicReservationService.listAvailableRooms(query));
});

router.post('/reservations', rateLimiters.write, async (req, res) => {
    const data = reservationSchema.parse(req.body);
    const result = await publicReservationService.createReservation(data);

    if (emailQueue && data.customerEmail && result.reservationId) {
        const nights = Math.max(1, Math.ceil(
            (new Date(data.checkOut).getTime() - new Date(data.checkIn).getTime()) / 86_400_000
        ));
        const booking = await prisma.booking.findFirst({
            where: { id: result.reservationId, companyId: data.companyId },
            include: { room: { select: { number: true } } },
        });
        const company = await prisma.companySettings.findFirst({
            where: { companyId: data.companyId },
            select: { companyName: true },
        });
        if (booking) {
            await emailQueue.add('booking-confirmation', {
                email: data.customerEmail,
                guestName: data.customerName,
                reservationId: result.reservationId,
                roomNumber: booking.room.number,
                checkIn: booking.checkIn,
                checkOut: booking.expectedCheckout,
                nights,
                totalPrice: Number(booking.totalPrice),
                companyName: company?.companyName,
            }, JOB_OPTIONS).catch((error: unknown) => {
                logger.warn('Failed to enqueue public booking confirmation', {
                    reservationId: result.reservationId,
                    error,
                });
            });
        }
    }

    res.status(201).json(result);
});

export default router;
