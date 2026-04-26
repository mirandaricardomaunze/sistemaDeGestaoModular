import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/error.middleware';
import { prisma } from '../lib/prisma';
import { emitToCompany } from '../lib/socket';

const router = Router();

// ── List events ───────────────────────────────────────────────────────────────
router.get('/events', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');

    const { start, end, module: mod } = req.query as Record<string, string>;

    const where: any = { companyId: req.companyId };

    if (start || end) {
        where.startAt = {};
        if (start) where.startAt.gte = new Date(start);
        if (end)   where.startAt.lte = new Date(end);
    }
    if (mod) where.module = mod;

    const events = await prisma.calendarEvent.findMany({
        where,
        include: {
            createdBy: { select: { id: true, name: true, avatar: true } },
            attendees: { include: { user: { select: { id: true, name: true, avatar: true } } } },
        },
        orderBy: { startAt: 'asc' },
    });

    res.json(events);
});

// ── Get single event ──────────────────────────────────────────────────────────
router.get('/events/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');

    const event = await prisma.calendarEvent.findFirst({
        where: { id: req.params.id, companyId: req.companyId },
        include: {
            createdBy: { select: { id: true, name: true, avatar: true } },
            attendees: { include: { user: { select: { id: true, name: true, avatar: true } } } },
        },
    });

    if (!event) throw ApiError.notFound('Evento não encontrado');
    res.json(event);
});

// ── Create event ──────────────────────────────────────────────────────────────
router.post('/events', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    if (!req.userId)    throw ApiError.unauthorized('Utilizador não autenticado');

    const {
        title, description, startAt, endAt, allDay,
        module: mod, color, recurrence, recurrenceEnd,
        notifyBefore, attendeeIds,
    } = req.body;

    if (!title || !startAt || !endAt) {
        throw ApiError.badRequest('Título, data de início e data de fim são obrigatórios');
    }

    const event = await prisma.calendarEvent.create({
        data: {
            companyId: req.companyId,
            createdById: req.userId,
            title: title.trim(),
            description: description?.trim() || null,
            startAt: new Date(startAt),
            endAt: new Date(endAt),
            allDay: Boolean(allDay),
            module: mod || null,
            color: color || null,
            recurrence: recurrence || null,
            recurrenceEnd: recurrenceEnd ? new Date(recurrenceEnd) : null,
            notifyBefore: notifyBefore ? Number(notifyBefore) : null,
            attendees: attendeeIds?.length
                ? { create: (attendeeIds as string[]).map(userId => ({ userId, status: 'pending' })) }
                : undefined,
        },
        include: {
            createdBy: { select: { id: true, name: true, avatar: true } },
            attendees: { include: { user: { select: { id: true, name: true, avatar: true } } } },
        },
    });

    emitToCompany(req.companyId, 'calendar:event_created', { event });

    res.status(201).json(event);
});

// ── Update event ──────────────────────────────────────────────────────────────
router.patch('/events/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');

    const existing = await prisma.calendarEvent.findFirst({
        where: { id: req.params.id, companyId: req.companyId },
    });
    if (!existing) throw ApiError.notFound('Evento não encontrado');

    const {
        title, description, startAt, endAt, allDay,
        module: mod, color, recurrence, recurrenceEnd,
        notifyBefore, isCompleted,
    } = req.body;

    const event = await prisma.calendarEvent.update({
        where: { id: req.params.id },
        data: {
            ...(title       !== undefined && { title: title.trim() }),
            ...(description !== undefined && { description: description?.trim() || null }),
            ...(startAt     !== undefined && { startAt: new Date(startAt) }),
            ...(endAt       !== undefined && { endAt: new Date(endAt) }),
            ...(allDay      !== undefined && { allDay: Boolean(allDay) }),
            ...(mod         !== undefined && { module: mod || null }),
            ...(color       !== undefined && { color: color || null }),
            ...(recurrence  !== undefined && { recurrence: recurrence || null }),
            ...(recurrenceEnd !== undefined && { recurrenceEnd: recurrenceEnd ? new Date(recurrenceEnd) : null }),
            ...(notifyBefore !== undefined && { notifyBefore: notifyBefore ? Number(notifyBefore) : null }),
            ...(isCompleted !== undefined && { isCompleted: Boolean(isCompleted) }),
        },
        include: {
            createdBy: { select: { id: true, name: true, avatar: true } },
            attendees: { include: { user: { select: { id: true, name: true, avatar: true } } } },
        },
    });

    emitToCompany(req.companyId, 'calendar:event_updated', { event });

    res.json(event);
});

// ── Delete event ──────────────────────────────────────────────────────────────
router.delete('/events/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');

    const existing = await prisma.calendarEvent.findFirst({
        where: { id: req.params.id, companyId: req.companyId },
    });
    if (!existing) throw ApiError.notFound('Evento não encontrado');

    await prisma.calendarEvent.delete({ where: { id: req.params.id } });

    emitToCompany(req.companyId, 'calendar:event_deleted', { eventId: req.params.id });

    res.json({ success: true });
});

// ── RSVP (attendee response) ──────────────────────────────────────────────────
router.patch('/events/:id/rsvp', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    if (!req.userId)    throw ApiError.unauthorized('Utilizador não autenticado');

    const { status } = req.body;
    if (!['accepted', 'declined', 'pending'].includes(status)) {
        throw ApiError.badRequest('Status inválido');
    }

    const attendee = await prisma.calendarAttendee.upsert({
        where: { eventId_userId: { eventId: req.params.id, userId: req.userId } },
        update: { status },
        create: { eventId: req.params.id, userId: req.userId, status },
    });

    res.json(attendee);
});

// ── Upcoming events (for notification badge) ──────────────────────────────────
router.get('/upcoming', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');

    const now = new Date();
    const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const events = await prisma.calendarEvent.findMany({
        where: {
            companyId: req.companyId,
            isCompleted: false,
            startAt: { gte: now, lte: in24h },
        },
        select: { id: true, title: true, startAt: true, module: true, color: true },
        orderBy: { startAt: 'asc' },
        take: 10,
    });

    res.json(events);
});

export default router;
