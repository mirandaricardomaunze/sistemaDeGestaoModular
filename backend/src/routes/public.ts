import { Router } from 'express';
import { publicReservationService } from '../services/publicReservationService';
import { ApiError } from '../middleware/error.middleware';
import { rateLimiters } from '../middleware/rateLimit';

const router = Router();

router.get('/rooms/available', rateLimiters.read, async (req, res) => {
    res.json(await publicReservationService.listAvailableRooms(req.query));
});

router.post('/reservations', rateLimiters.write, async (req, res) => {
    res.status(201).json(await publicReservationService.createReservation(req.body));
});

export default router;
