import { Router } from 'express';
import { publicReservationService } from '../services/publicReservationService';
import { ApiError } from '../middleware/error.middleware';
import { rateLimiters } from '../middleware/rateLimit';
import { emailQueue, JOB_OPTIONS } from '../queues/emailQueue';
import { prisma } from '../lib/prisma';

const router = Router();

router.get('/rooms/available', rateLimiters.read, async (req, res) => {
    res.json(await publicReservationService.listAvailableRooms(req.query));
});

router.post('/reservations', rateLimiters.write, async (req, res) => {
    const result = await publicReservationService.createReservation(req.body);

    // Send booking confirmation if customer provided an email
    const { customerEmail, customerName, checkIn, checkOut, companyId } = req.body;
    if (emailQueue && customerEmail && result.reservationId) {
        const nights = Math.max(1, Math.ceil(
            (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000
        ));
        const booking = await prisma.booking.findUnique({
            where: { id: result.reservationId },
            include: { room: { select: { number: true } } }
        });
        const company = await prisma.companySettings.findFirst({ where: { companyId }, select: { companyName: true } });
        if (booking) {
            await emailQueue.add('booking-confirmation', {
                email: customerEmail,
                guestName: customerName || 'Hóspede',
                reservationId: result.reservationId,
                roomNumber: booking.room.number,
                checkIn: booking.checkIn,
                checkOut: booking.expectedCheckout,
                nights,
                totalPrice: Number(booking.totalPrice),
                companyName: company?.companyName,
            }, JOB_OPTIONS).catch(() => {});
        }
    }

    res.status(201).json(result);
});

export default router;
