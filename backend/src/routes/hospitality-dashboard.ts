/**
 * Hospitality Dashboard API Routes
 * Provides analytics, metrics, and chart data for the hotel/hospitality module
 */

import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate date range based on period parameter
 */
function getDateRange(period: string): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    switch (period) {
        case 'today':
            break;
        case '7d':
            startDate.setDate(startDate.getDate() - 7);
            break;
        case '1m':
            startDate.setMonth(startDate.getMonth() - 1);
            break;
        case '3m':
            startDate.setMonth(startDate.getMonth() - 3);
            break;
        case '6m':
            startDate.setMonth(startDate.getMonth() - 6);
            break;
        case '1y':
            startDate.setFullYear(startDate.getFullYear() - 1);
            break;
        default:
            startDate.setMonth(startDate.getMonth() - 1);
    }

    return { startDate, endDate };
}

// ============================================================================
// GET /api/hospitality/dashboard/summary
// Returns quick summary metrics for dashboard (simplified version of /metrics)
// ============================================================================

router.get('/summary', authenticate, async (req: AuthRequest, res) => {
    try {
        const companyId = req.companyId;
        if (!companyId) {
            return res.status(400).json({ error: 'Empresa não identificada' });
        }

        // Get today's date range
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        // Get this month's date range
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        // Total rooms
        const totalRooms = await prisma.room.count({
            where: { companyId }
        });

        // Occupied rooms
        const occupiedRooms = await prisma.room.count({
            where: {
                companyId,
                status: 'occupied'
            }
        });

        // Available rooms
        const availableRooms = await prisma.room.count({
            where: {
                companyId,
                status: 'available'
            }
        });

        // Occupancy rate
        const occupancyRate = totalRooms > 0
            ? Math.round((occupiedRooms / totalRooms) * 100)
            : 0;

        // Today's check-ins
        const todayCheckIns = await prisma.booking.count({
            where: {
                room: { companyId },
                checkIn: { gte: todayStart, lte: todayEnd }
            }
        });

        // Today's check-outs (pending)
        const todayCheckOuts = await prisma.booking.count({
            where: {
                room: { companyId },
                status: 'checked_in',
                expectedCheckout: { gte: todayStart, lte: todayEnd }
            }
        });

        const pendingCheckouts = todayCheckOuts;

        // Today's revenue
        const todayBookingsData = await prisma.booking.findMany({
            where: {
                room: { companyId },
                checkIn: { gte: todayStart, lte: todayEnd }
            },
            include: {
                consumptions: {
                    select: {
                        total: true
                    }
                }
            }
        });

        let todayRevenue = 0;
        todayBookingsData.forEach(booking => {
            todayRevenue += Number(booking.totalPrice) || 0;
            if (booking.consumptions && Array.isArray(booking.consumptions)) {
                booking.consumptions.forEach(c => {
                    todayRevenue += Number(c.total) || 0;
                });
            }
        });

        // Month revenue
        const monthBookingsData = await prisma.booking.findMany({
            where: {
                room: { companyId },
                checkIn: { gte: monthStart }
            },
            include: {
                consumptions: {
                    select: {
                        total: true
                    }
                }
            }
        });

        let monthRevenue = 0;
        monthBookingsData.forEach(booking => {
            monthRevenue += Number(booking.totalPrice) || 0;
            if (booking.consumptions && Array.isArray(booking.consumptions)) {
                booking.consumptions.forEach(c => {
                    monthRevenue += Number(c.total) || 0;
                });
            }
        });

        // Calculate monthly growth (compare current month with previous month)
        const previousMonthStart = new Date(monthStart);
        previousMonthStart.setMonth(previousMonthStart.getMonth() - 1);
        const previousMonthEnd = new Date(monthStart);
        previousMonthEnd.setDate(previousMonthEnd.getDate() - 1);
        previousMonthEnd.setHours(23, 59, 59, 999);

        const previousMonthBookings = await prisma.booking.findMany({
            where: {
                room: { companyId },
                checkIn: { gte: previousMonthStart, lte: previousMonthEnd }
            },
            include: {
                consumptions: {
                    select: { total: true }
                }
            }
        });

        let previousMonthRevenue = 0;
        previousMonthBookings.forEach(booking => {
            previousMonthRevenue += Number(booking.totalPrice) || 0;
            if (booking.consumptions && Array.isArray(booking.consumptions)) {
                booking.consumptions.forEach(c => {
                    previousMonthRevenue += Number(c.total) || 0;
                });
            }
        });

        const monthlyGrowth = previousMonthRevenue > 0
            ? Math.round(((monthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100)
            : 0;

        // Get revenue chart data (last 5 weeks)
        const fiveWeeksAgo = new Date();
        fiveWeeksAgo.setDate(fiveWeeksAgo.getDate() - 35);

        const revenueBookings = await prisma.booking.findMany({
            where: {
                room: { companyId },
                checkIn: { gte: fiveWeeksAgo }
            },
            include: {
                consumptions: {
                    select: { total: true }
                }
            },
            orderBy: { checkIn: 'asc' }
        });

        // Group by week
        const revenueByWeek: Record<string, number> = {};
        revenueBookings.forEach(booking => {
            const weekStart = new Date(booking.checkIn);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week
            const weekKey = weekStart.toISOString().split('T')[0];

            let revenue = Number(booking.totalPrice) || 0;
            if (booking.consumptions && Array.isArray(booking.consumptions)) {
                booking.consumptions.forEach(c => {
                    revenue += Number(c.total) || 0;
                });
            }

            revenueByWeek[weekKey] = (revenueByWeek[weekKey] || 0) + revenue;
        });

        const revenueChart = Object.entries(revenueByWeek)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-5)
            .map(([date, revenue]) => ({
                name: new Date(date).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' }),
                revenue
            }));

        // Get weekly revenue (last 7 days by day of week)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const weeklyBookings = await prisma.booking.findMany({
            where: {
                room: { companyId },
                checkIn: { gte: sevenDaysAgo }
            },
            include: {
                consumptions: {
                    select: { total: true }
                }
            }
        });

        const weeklyRevenue: Record<string, number> = {
            'Dom': 0, 'Seg': 0, 'Ter': 0, 'Qua': 0, 'Qui': 0, 'Sex': 0, 'Sab': 0
        };

        weeklyBookings.forEach(booking => {
            const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
            const dayName = dayNames[new Date(booking.checkIn).getDay()];

            let revenue = Number(booking.totalPrice) || 0;
            if (booking.consumptions && Array.isArray(booking.consumptions)) {
                booking.consumptions.forEach(c => {
                    revenue += Number(c.total) || 0;
                });
            }

            weeklyRevenue[dayName] += revenue;
        });

        const weeklyChart = Object.entries(weeklyRevenue).map(([name, value]) => ({
            name,
            value
        }));

        // Get room type distribution
        const rooms = await prisma.room.findMany({
            where: { companyId },
            select: { type: true }
        });

        const roomTypeCount: Record<string, number> = {};
        rooms.forEach(room => {
            const type = room.type || 'other';
            roomTypeCount[type] = (roomTypeCount[type] || 0) + 1;
        });

        const roomTypeData = Object.entries(roomTypeCount).map(([name, value]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            value
        }));

        res.json({
            totalRooms,
            occupiedRooms,
            availableRooms,
            occupancyRate,
            todayRevenue,
            monthRevenue,
            todayCheckIns,
            todayCheckOuts,
            pendingCheckouts,
            monthlyGrowth,
            // Chart data
            revenueChart,
            weeklyChart,
            roomTypeData
        });
    } catch (error) {
        console.error('Hospitality summary error:', error);
        res.status(500).json({ error: 'Erro ao buscar resumo de hotelaria' });
    }
});

// ============================================================================
// GET /api/hospitality/dashboard/recent-bookings
// Returns recent bookings for dashboard activity feed
// ============================================================================

router.get('/recent-bookings', authenticate, async (req: AuthRequest, res) => {
    try {
        const companyId = req.companyId;
        if (!companyId) {
            return res.status(400).json({ error: 'Empresa não identificada' });
        }

        const limit = parseInt(String(req.query.limit)) || 5;

        const recentBookings = await prisma.booking.findMany({
            where: {
                room: { companyId }
            },
            include: {
                room: {
                    select: {
                        number: true,
                        type: true
                    }
                }
            },
            orderBy: {
                checkIn: 'desc'
            },
            take: limit
        });

        const formattedBookings = recentBookings.map(booking => ({
            id: booking.id,
            customerName: booking.customerName,
            roomNumber: booking.room?.number || '—',
            roomType: booking.room?.type || '—',
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            status: booking.status,
            totalPrice: Number(booking.totalPrice) || 0,
            guestCount: booking.guestCount
        }));

        res.json(formattedBookings);
    } catch (error) {
        console.error('Recent bookings error:', error);
        res.status(500).json({ error: 'Erro ao buscar reservas recentes' });
    }
});

// ============================================================================
// GET /api/hospitality/dashboard/metrics
// Returns KPI metrics for the dashboard
// ============================================================================

router.get('/metrics', authenticate, async (req: AuthRequest, res) => {
    try {
        const companyId = req.companyId;
        if (!companyId) {
            return res.status(400).json({ error: 'Empresa não identificada' });
        }

        const period = String(req.query.period || '1m');
        const { startDate, endDate } = getDateRange(period);

        // Get today's date range
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        // Total rooms
        const totalRooms = await prisma.room.count({
            where: { companyId }
        });

        // Occupied rooms now
        const occupiedRooms = await prisma.room.count({
            where: {
                companyId,
                status: 'occupied'
            }
        });

        // Occupancy rate
        const occupancyRate = totalRooms > 0
            ? Math.round((occupiedRooms / totalRooms) * 100)
            : 0;

        // Total bookings in period
        const totalBookings = await prisma.booking.count({
            where: {
                room: { companyId },
                checkIn: { gte: startDate, lte: endDate }
            }
        });

        // Today's bookings
        const todayBookings = await prisma.booking.count({
            where: {
                room: { companyId },
                checkIn: { gte: todayStart, lte: todayEnd }
            }
        });

        // Revenue calculations (period)
        const periodBookings = await prisma.booking.findMany({
            where: {
                room: { companyId },
                checkIn: { gte: startDate, lte: endDate }
            },
            include: {
                consumptions: {
                    select: {
                        id: true,
                        total: true,
                        quantity: true,
                        unitPrice: true
                    }
                }
            }
        });

        let totalRevenue = 0;
        let consumptionRevenue = 0;
        periodBookings.forEach(booking => {
            totalRevenue += Number(booking.totalPrice) || 0;
            // Safe access to consumptions with optional chaining
            if (booking.consumptions && Array.isArray(booking.consumptions)) {
                booking.consumptions.forEach(c => {
                    consumptionRevenue += Number(c.total) || 0;
                });
            }
        });
        totalRevenue += consumptionRevenue;

        // Today's revenue
        const todayBookingsData = await prisma.booking.findMany({
            where: {
                room: { companyId },
                checkIn: { gte: todayStart, lte: todayEnd }
            },
            include: {
                consumptions: {
                    select: {
                        id: true,
                        total: true,
                        quantity: true,
                        unitPrice: true
                    }
                }
            }
        });

        let todayRevenue = 0;
        todayBookingsData.forEach(booking => {
            todayRevenue += Number(booking.totalPrice) || 0;
            // Safe access to consumptions with optional chaining
            if (booking.consumptions && Array.isArray(booking.consumptions)) {
                booking.consumptions.forEach(c => {
                    todayRevenue += Number(c.total) || 0;
                });
            }
        });

        // Average daily rate
        const avgDailyRate = totalBookings > 0
            ? Math.round(totalRevenue / totalBookings)
            : 0;

        // Checked out bookings
        const checkouts = await prisma.booking.count({
            where: {
                room: { companyId },
                status: 'checked_out',
                checkOut: { gte: startDate, lte: endDate }
            }
        });

        // Active guests (checked in)
        const activeGuests = await prisma.booking.aggregate({
            where: {
                room: { companyId },
                status: 'checked_in'
            },
            _sum: { guestCount: true }
        });

        res.json({
            totalRooms,
            occupiedRooms,
            occupancyRate,
            totalBookings,
            todayBookings,
            totalRevenue,
            todayRevenue,
            consumptionRevenue,
            avgDailyRate,
            checkouts,
            activeGuests: activeGuests._sum?.guestCount || 0,
            period
        });
    } catch (error) {
        console.error('Hospitality metrics error:', error);
        res.status(500).json({ error: 'Erro ao buscar métricas de hotelaria' });
    }
});

// ============================================================================
// GET /api/hospitality/dashboard/charts/revenue
// Returns revenue data for charts
// ============================================================================

router.get('/charts/revenue', authenticate, async (req: AuthRequest, res) => {
    try {
        const companyId = req.companyId;
        if (!companyId) {
            return res.status(400).json({ error: 'Empresa não identificada' });
        }

        const period = String(req.query.period || '1m');
        const { startDate, endDate } = getDateRange(period);

        const bookings = await prisma.booking.findMany({
            where: {
                room: { companyId },
                checkIn: { gte: startDate, lte: endDate }
            },
            include: { consumptions: true },
            orderBy: { checkIn: 'asc' }
        });

        // Group by date
        const grouped: Record<string, { revenue: number; consumption: number; bookings: number }> = {};

        bookings.forEach(booking => {
            const dateKey = booking.checkIn.toISOString().slice(0, 10);
            if (!grouped[dateKey]) {
                grouped[dateKey] = { revenue: 0, consumption: 0, bookings: 0 };
            }
            grouped[dateKey].revenue += Number(booking.totalPrice) || 0;
            grouped[dateKey].bookings += 1;
            booking.consumptions?.forEach(c => {
                grouped[dateKey].consumption += Number(c.total) || 0;
            });
        });

        const chartData = Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, data]) => ({
                date,
                revenue: data.revenue,
                consumption: data.consumption,
                total: data.revenue + data.consumption,
                bookings: data.bookings
            }));

        res.json(chartData);
    } catch (error) {
        console.error('Revenue chart error:', error);
        res.status(500).json({ error: 'Erro ao buscar dados de receita' });
    }
});

// ============================================================================
// GET /api/hospitality/dashboard/charts/occupancy
// Returns occupancy rate data over time
// ============================================================================

router.get('/charts/occupancy', authenticate, async (req: AuthRequest, res) => {
    try {
        const companyId = req.companyId;
        if (!companyId) {
            return res.status(400).json({ error: 'Empresa não identificada' });
        }

        const period = String(req.query.period || '1m');
        const { startDate, endDate } = getDateRange(period);

        const totalRooms = await prisma.room.count({
            where: { companyId }
        });

        const bookings = await prisma.booking.findMany({
            where: {
                room: { companyId },
                OR: [
                    { checkIn: { gte: startDate, lte: endDate } },
                    { checkOut: { gte: startDate, lte: endDate } }
                ]
            },
            orderBy: { checkIn: 'asc' }
        });

        // Calculate occupancy by date
        const grouped: Record<string, number> = {};
        const current = new Date(startDate);

        while (current <= endDate) {
            const dateKey = current.toISOString().slice(0, 10);
            const occupiedCount = bookings.filter(b => {
                const checkIn = new Date(b.checkIn);
                const checkOut = b.checkOut ? new Date(b.checkOut) : new Date();
                return checkIn <= current && checkOut >= current;
            }).length;

            grouped[dateKey] = totalRooms > 0
                ? Math.round((occupiedCount / totalRooms) * 100)
                : 0;

            current.setDate(current.getDate() + 1);
        }

        const chartData = Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, rate]) => ({ date, rate }));

        res.json(chartData);
    } catch (error) {
        console.error('Occupancy chart error:', error);
        res.status(500).json({ error: 'Erro ao buscar dados de ocupação' });
    }
});

// ============================================================================
// GET /api/hospitality/dashboard/charts/room-types
// Returns revenue breakdown by room type
// ============================================================================

router.get('/charts/room-types', authenticate, async (req: AuthRequest, res) => {
    try {
        const companyId = req.companyId;
        if (!companyId) {
            return res.status(400).json({ error: 'Empresa não identificada' });
        }

        const period = String(req.query.period || '1m');
        const { startDate, endDate } = getDateRange(period);

        const bookings = await prisma.booking.findMany({
            where: {
                room: { companyId },
                checkIn: { gte: startDate, lte: endDate }
            },
            include: { room: true }
        });

        const grouped: Record<string, { revenue: number; count: number }> = {};

        bookings.forEach(booking => {
            const type = booking.room?.type || 'Outro';
            if (!grouped[type]) {
                grouped[type] = { revenue: 0, count: 0 };
            }
            grouped[type].revenue += Number(booking.totalPrice) || 0;
            grouped[type].count += 1;
        });

        const chartData = Object.entries(grouped)
            .map(([type, data]) => ({
                name: type.charAt(0).toUpperCase() + type.slice(1),
                value: data.revenue,
                count: data.count
            }))
            .sort((a, b) => b.value - a.value);

        res.json(chartData);
    } catch (error) {
        console.error('Room types chart error:', error);
        res.status(500).json({ error: 'Erro ao buscar dados por tipo de quarto' });
    }
});

// ============================================================================
// GET /api/hospitality/dashboard/charts/consumption
// Returns top consumed products/services
// ============================================================================

router.get('/charts/consumption', authenticate, async (req: AuthRequest, res) => {
    try {
        const companyId = req.companyId;
        if (!companyId) {
            return res.status(400).json({ error: 'Empresa não identificada' });
        }

        const period = String(req.query.period || '1m');
        const { startDate, endDate } = getDateRange(period);
        const limit = parseInt(String(req.query.limit)) || 10;

        const consumptions = await prisma.bookingConsumption.findMany({
            where: {
                companyId,
                createdAt: { gte: startDate, lte: endDate }
            },
            include: {
                product: { select: { id: true, name: true, code: true, price: true } }
            }
        });

        const grouped: Record<string, { name: string; quantity: number; revenue: number }> = {};

        consumptions.forEach(c => {
            const productId = c.productId;
            if (!grouped[productId]) {
                grouped[productId] = {
                    name: c.product?.name || 'Produto Desconhecido',
                    quantity: 0,
                    revenue: 0
                };
            }
            grouped[productId].quantity += c.quantity;
            grouped[productId].revenue += Number(c.total) || 0;
        });

        const chartData = Object.values(grouped)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, limit);

        res.json(chartData);
    } catch (error) {
        console.error('Consumption chart error:', error);
        res.status(500).json({ error: 'Erro ao buscar dados de consumo' });
    }
});

// ============================================================================
// GET /api/hospitality/dashboard/reports
// Returns complete report data for export (PDF/Excel)
// ============================================================================

router.get('/reports', authenticate, async (req: AuthRequest, res) => {
    try {
        const companyId = req.companyId;
        if (!companyId) {
            return res.status(400).json({ error: 'Empresa não identificada' });
        }

        const period = String(req.query.period || '1m');
        const { startDate, endDate } = getDateRange(period);

        // Get all bookings in period with details
        const bookings = await prisma.booking.findMany({
            where: {
                room: { companyId },
                checkIn: { gte: startDate, lte: endDate }
            },
            include: {
                room: true,
                consumptions: {
                    include: {
                        product: { select: { id: true, name: true, code: true, price: true } }
                    }
                }
            },
            orderBy: { checkIn: 'desc' }
        });

        // Calculate totals
        let totalRoomRevenue = 0;
        let totalConsumptionRevenue = 0;
        let totalGuests = 0;

        const bookingsData = bookings.map(booking => {
            const roomRevenue = Number(booking.totalPrice) || 0;
            const consumptionTotal = booking.consumptions?.reduce((acc, c) => acc + (Number(c.total) || 0), 0) || 0;

            totalRoomRevenue += roomRevenue;
            totalConsumptionRevenue += consumptionTotal;
            totalGuests += booking.guestCount || 0;

            return {
                id: booking.id,
                checkIn: booking.checkIn,
                checkOut: booking.checkOut,
                roomNumber: booking.room?.number || '—',
                roomType: booking.room?.type || '—',
                customerName: booking.customerName,
                guestCount: booking.guestCount,
                status: booking.status,
                roomRevenue,
                consumptionTotal,
                totalRevenue: roomRevenue + consumptionTotal,
                consumptions: booking.consumptions?.map(c => ({
                    product: c.product?.name || 'Desconhecido',
                    quantity: c.quantity,
                    unitPrice: c.unitPrice,
                    total: c.total
                })) || []
            };
        });

        // Room statistics
        const rooms = await prisma.room.findMany({
            where: { companyId }
        });
        const roomStats = {
            total: rooms.length,
            available: rooms.filter(r => r.status === 'available').length,
            occupied: rooms.filter(r => r.status === 'occupied').length,
            maintenance: rooms.filter(r => r.status === 'maintenance').length,
            dirty: rooms.filter(r => r.status === 'dirty').length
        };

        res.json({
            period,
            startDate,
            endDate,
            summary: {
                totalBookings: bookings.length,
                totalGuests,
                totalRoomRevenue,
                totalConsumptionRevenue,
                totalRevenue: totalRoomRevenue + totalConsumptionRevenue,
                avgBookingValue: bookings.length > 0
                    ? Math.round((totalRoomRevenue + totalConsumptionRevenue) / bookings.length)
                    : 0,
                occupancyRate: roomStats.total > 0
                    ? Math.round((roomStats.occupied / roomStats.total) * 100)
                    : 0
            },
            roomStats,
            bookings: bookingsData
        });
    } catch (error) {
        console.error('Report data error:', error);
        res.status(500).json({ error: 'Erro ao gerar relatório' });
    }
});

export default router;
