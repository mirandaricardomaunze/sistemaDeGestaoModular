/**
 * Public API Routes for Online Reservations
 * NO AUTHENTICATION REQUIRED - For website integration
 * 
 * Endpoints:
 * - GET /api/public/rooms/available - Get available rooms for date range
 * - GET /api/public/rooms/:id - Get room details
 * - POST /api/public/reservations - Create a reservation
 * - GET /api/public/reservations/:code - Check reservation status
 */

import { Router } from 'express';
import { prisma } from '../index';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Rate Limiting - Prevent abuse
const reservationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Max 10 reservation attempts per IP per window
    message: { message: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const queryLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // Max 60 queries per minute per IP
    message: { message: 'Muitas requisições. Aguarde e tente novamente.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Helper: Generate confirmation code
const generateConfirmationCode = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding similar chars (I,1,O,0)
    let code = 'RES-';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

// Helper: Calculate nights between dates
const calculateNights = (checkIn: Date, checkOut: Date): number => {
    const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// ============================================================================
// GET /rooms/available - Get available rooms for a date range
// ============================================================================
router.get('/rooms/available', queryLimiter, async (req, res) => {
    try {
        const { checkIn, checkOut, guests, type } = req.query;

        if (!checkIn || !checkOut) {
            return res.status(400).json({
                message: 'Data de check-in e check-out são obrigatórias',
                example: '?checkIn=2024-01-15&checkOut=2024-01-18'
            });
        }

        const checkInDate = new Date(checkIn as string + 'T12:00:00');
        const checkOutDate = new Date(checkOut as string + 'T12:00:00');

        // Validate dates - compare date strings to avoid timezone issues
        const todayStr = new Date().toISOString().split('T')[0];

        if ((checkIn as string) < todayStr) {
            return res.status(400).json({ message: 'Data de check-in não pode ser no passado' });
        }

        if (checkOutDate <= checkInDate) {
            return res.status(400).json({ message: 'Data de check-out deve ser posterior ao check-in' });
        }

        // Find rooms that DON'T have overlapping bookings
        const occupiedRoomIds = await prisma.booking.findMany({
            where: {
                status: { in: ['checked_in', 'confirmed', 'pending'] },
                OR: [
                    {
                        // Booking starts before our checkout and ends after our checkin
                        checkIn: { lt: checkOutDate },
                        expectedCheckout: { gt: checkInDate }
                    },
                    {
                        // Booking starts within our range
                        checkIn: { gte: checkInDate, lt: checkOutDate }
                    }
                ]
            },
            select: { roomId: true }
        });

        const occupiedIds = occupiedRoomIds.map(b => b.roomId);

        // Build room query
        const roomWhere: any = {
            status: { in: ['available', 'dirty'] }, // Dirty rooms can be cleaned before arrival
            id: { notIn: occupiedIds }
        };

        // Filter by type if specified
        if (type && ['single', 'double', 'twin', 'suite', 'family'].includes(type as string)) {
            roomWhere.type = type as string;
        }

        const rooms = await prisma.room.findMany({
            where: roomWhere,
            select: {
                id: true,
                number: true,
                type: true,
                price: true,
                priceNoMeal: true,
                priceBreakfast: true,
                priceHalfBoard: true,
                priceFullBoard: true,
                notes: true
            },
            orderBy: { number: 'asc' }
        });

        // Calculate total price for each room
        const nights = calculateNights(checkInDate, checkOutDate);
        const roomsWithPricing = rooms.map(room => ({
            ...room,
            nights,
            pricing: {
                noMeal: {
                    perNight: Number(room.priceNoMeal || room.price),
                    total: Number(room.priceNoMeal || room.price) * nights
                },
                breakfast: {
                    perNight: Number(room.priceBreakfast || room.price),
                    total: Number(room.priceBreakfast || room.price) * nights
                },
                halfBoard: {
                    perNight: Number(room.priceHalfBoard || room.price),
                    total: Number(room.priceHalfBoard || room.price) * nights
                },
                fullBoard: {
                    perNight: Number(room.priceFullBoard || room.price),
                    total: Number(room.priceFullBoard || room.price) * nights
                }
            }
        }));

        // Filter by capacity if guests specified
        let filteredRooms = roomsWithPricing;
        if (guests) {
            const guestCount = parseInt(guests as string);
            const capacityMap: Record<string, number> = {
                'single': 1,
                'double': 2,
                'twin': 2,
                'suite': 3,
                'family': 4
            };
            filteredRooms = roomsWithPricing.filter(room =>
                (capacityMap[room.type] || 2) >= guestCount
            );
        }

        res.json({
            checkIn: checkIn,
            checkOut: checkOut,
            nights,
            availableRooms: filteredRooms.length,
            rooms: filteredRooms
        });

    } catch (error: any) {
        console.error('Error fetching available rooms:', error);
        res.status(500).json({ message: 'Erro ao verificar disponibilidade' });
    }
});

// ============================================================================
// GET /rooms/:id - Get single room details
// ============================================================================
router.get('/rooms/:id', queryLimiter, async (req, res) => {
    try {
        const room = await prisma.room.findUnique({
            where: { id: req.params.id },
            select: {
                id: true,
                number: true,
                type: true,
                price: true,
                priceNoMeal: true,
                priceBreakfast: true,
                priceHalfBoard: true,
                priceFullBoard: true,
                notes: true
            }
        });

        if (!room) {
            return res.status(404).json({ message: 'Quarto não encontrado' });
        }

        res.json(room);
    } catch (error: any) {
        console.error('Error fetching room:', error);
        res.status(500).json({ message: 'Erro ao buscar quarto' });
    }
});

// ============================================================================
// GET /room-types - Get available room types with pricing
// ============================================================================
router.get('/room-types', queryLimiter, async (req, res) => {
    try {
        const rooms = await prisma.room.findMany({
            where: { status: { in: ['available', 'dirty', 'occupied'] } },
            select: {
                type: true,
                price: true,
                priceNoMeal: true,
                priceBreakfast: true,
                priceHalfBoard: true,
                priceFullBoard: true
            }
        });

        // Group by type and get min price
        const typeMap = new Map<string, any>();
        for (const room of rooms) {
            if (!typeMap.has(room.type)) {
                typeMap.set(room.type, {
                    type: room.type,
                    minPrice: Number(room.price),
                    count: 1,
                    priceNoMeal: Number(room.priceNoMeal || room.price),
                    priceBreakfast: Number(room.priceBreakfast || room.price),
                    priceHalfBoard: Number(room.priceHalfBoard || room.price),
                    priceFullBoard: Number(room.priceFullBoard || room.price)
                });
            } else {
                const existing = typeMap.get(room.type);
                existing.count++;
                existing.minPrice = Math.min(existing.minPrice, Number(room.price));
            }
        }

        const typeLabels: Record<string, string> = {
            'single': 'Quarto Individual',
            'double': 'Quarto Duplo',
            'twin': 'Quarto Twin',
            'suite': 'Suite',
            'family': 'Quarto Familiar'
        };

        const capacityMap: Record<string, number> = {
            'single': 1,
            'double': 2,
            'twin': 2,
            'suite': 3,
            'family': 4
        };

        const roomTypes = Array.from(typeMap.values()).map(t => ({
            ...t,
            label: typeLabels[t.type] || t.type,
            capacity: capacityMap[t.type] || 2
        }));

        res.json(roomTypes);
    } catch (error: any) {
        console.error('Error fetching room types:', error);
        res.status(500).json({ message: 'Erro ao buscar tipos de quarto' });
    }
});

// ============================================================================
// POST /reservations - Create a new reservation
// ============================================================================
router.post('/reservations', reservationLimiter, async (req, res) => {
    try {
        const {
            roomId,
            customerName,
            guestCount,
            email,
            phone,
            checkIn,
            checkOut,
            mealPlan,
            notes,
            specialRequests
        } = req.body;

        // Validation
        if (!roomId || !customerName || !checkIn || !checkOut) {
            return res.status(400).json({
                message: 'Campos obrigatórios: roomId, customerName, checkIn, checkOut'
            });
        }

        if (!email && !phone) {
            return res.status(400).json({
                message: 'É necessário fornecer email ou telefone para contacto'
            });
        }

        const checkInDate = new Date(checkIn + 'T12:00:00');
        const checkOutDate = new Date(checkOut + 'T12:00:00');

        // Validate dates - compare date strings to avoid timezone issues
        const todayStr = new Date().toISOString().split('T')[0];

        if (checkIn < todayStr) {
            return res.status(400).json({ message: 'Data de check-in não pode ser no passado' });
        }

        if (checkOutDate <= checkInDate) {
            return res.status(400).json({ message: 'Data de check-out deve ser posterior ao check-in' });
        }

        // Check room exists
        const room = await prisma.room.findUnique({ where: { id: roomId } });
        if (!room) {
            return res.status(404).json({ message: 'Quarto não encontrado' });
        }

        // Check availability
        const existingBooking = await prisma.booking.findFirst({
            where: {
                roomId,
                status: { in: ['checked_in', 'confirmed', 'pending'] },
                OR: [
                    {
                        checkIn: { lt: checkOutDate },
                        expectedCheckout: { gt: checkInDate }
                    },
                    {
                        checkIn: { gte: checkInDate, lt: checkOutDate }
                    }
                ]
            }
        });

        if (existingBooking) {
            return res.status(409).json({
                message: 'Quarto não disponível para as datas selecionadas'
            });
        }

        // Calculate price
        const nights = calculateNights(checkInDate, checkOutDate);
        let pricePerNight: number;

        switch (mealPlan) {
            case 'breakfast':
                pricePerNight = Number(room.priceBreakfast || room.price);
                break;
            case 'half_board':
                pricePerNight = Number(room.priceHalfBoard || room.price);
                break;
            case 'full_board':
                pricePerNight = Number(room.priceFullBoard || room.price);
                break;
            default:
                pricePerNight = Number(room.priceNoMeal || room.price);
        }

        const totalPrice = pricePerNight * nights;
        const confirmationCode = generateConfirmationCode();

        // Create booking
        const booking = await prisma.booking.create({
            data: {
                roomId,
                customerName,
                guestCount: parseInt(guestCount) || 1,
                guestPhone: phone,
                checkIn: checkInDate,
                expectedCheckout: checkOutDate,
                totalPrice,
                mealPlan: mealPlan || 'none',
                status: 'confirmed', // Auto-confirmed for online bookings
                notes: [
                    notes,
                    specialRequests ? `Pedidos especiais: ${specialRequests}` : null,
                    email ? `Email: ${email}` : null,
                    `Código: ${confirmationCode}`
                ].filter(Boolean).join('\n')
            },
            include: {
                room: {
                    select: { number: true, type: true }
                }
            }
        });

        // Response for website
        res.status(201).json({
            success: true,
            message: 'Reserva criada com sucesso!',
            confirmationCode,
            reservation: {
                id: booking.id,
                confirmationCode,
                room: {
                    number: booking.room.number,
                    type: booking.room.type
                },
                guest: {
                    name: customerName,
                    count: booking.guestCount
                },
                dates: {
                    checkIn: checkIn,
                    checkOut: checkOut,
                    nights
                },
                pricing: {
                    mealPlan: mealPlan || 'none',
                    mealPlanLabel: getMealPlanLabel(mealPlan || 'none'),
                    pricePerNight,
                    totalPrice,
                    currency: 'MZN'
                },
                contact: {
                    email: email || null,
                    phone: phone || null
                }
            }
        });

    } catch (error: any) {
        console.error('Error creating reservation:', error);
        res.status(500).json({ message: 'Erro ao criar reserva. Tente novamente.' });
    }
});

// ============================================================================
// GET /reservations/:code - Check reservation status by confirmation code
// ============================================================================
router.get('/reservations/:code', queryLimiter, async (req, res) => {
    try {
        const code = req.params.code.toUpperCase();

        // Search for booking with code in notes
        const booking = await prisma.booking.findFirst({
            where: {
                notes: { contains: code }
            },
            include: {
                room: {
                    select: { number: true, type: true }
                }
            }
        });

        if (!booking) {
            return res.status(404).json({ message: 'Reserva não encontrada' });
        }

        const statusLabels: Record<string, string> = {
            'pending': 'Pendente',
            'confirmed': 'Confirmada',
            'checked_in': 'Check-in Realizado',
            'checked_out': 'Concluída',
            'cancelled': 'Cancelada',
            'no_show': 'Não Compareceu'
        };

        res.json({
            confirmationCode: code,
            status: booking.status,
            statusLabel: statusLabels[booking.status] || booking.status,
            room: {
                number: booking.room.number,
                type: booking.room.type
            },
            guest: {
                name: booking.customerName,
                count: booking.guestCount
            },
            dates: {
                checkIn: booking.checkIn.toISOString().split('T')[0],
                checkOut: booking.expectedCheckout?.toISOString().split('T')[0] || null
            }
        });

    } catch (error: any) {
        console.error('Error checking reservation:', error);
        res.status(500).json({ message: 'Erro ao verificar reserva' });
    }
});

// ============================================================================
// DELETE /reservations/:code - Cancel a reservation
// ============================================================================
router.delete('/reservations/:code', reservationLimiter, async (req, res) => {
    try {
        const code = req.params.code.toUpperCase();
        const { reason } = req.body;

        // Find booking
        const booking = await prisma.booking.findFirst({
            where: {
                notes: { contains: code },
                status: { in: ['pending', 'confirmed'] } // Can only cancel pending/confirmed
            }
        });

        if (!booking) {
            return res.status(404).json({
                message: 'Reserva não encontrada ou não pode ser cancelada'
            });
        }

        // Check if cancellation is allowed (at least 24h before check-in)
        const checkInDate = new Date(booking.checkIn);
        const now = new Date();
        const hoursUntilCheckIn = (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (hoursUntilCheckIn < 24) {
            return res.status(400).json({
                message: 'Cancelamento deve ser feito com pelo menos 24 horas de antecedência'
            });
        }

        // Update booking
        await prisma.booking.update({
            where: { id: booking.id },
            data: {
                status: 'cancelled',
                notes: booking.notes + `\n[CANCELADO] ${new Date().toISOString()}${reason ? ': ' + reason : ''}`
            }
        });

        res.json({
            success: true,
            message: 'Reserva cancelada com sucesso',
            confirmationCode: code
        });

    } catch (error: any) {
        console.error('Error cancelling reservation:', error);
        res.status(500).json({ message: 'Erro ao cancelar reserva' });
    }
});

// Helper function
function getMealPlanLabel(plan: string): string {
    switch (plan) {
        case 'none': return 'Sem Refeições';
        case 'breakfast': return 'Pequeno-Almoço (BB)';
        case 'half_board': return 'Meia Pensão (HB)';
        case 'full_board': return 'Pensão Completa (FB)';
        default: return plan;
    }
}

export default router;
