import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { ApiError } from '../middleware/error.middleware';

export class HospitalityDashboardService {
    private getDateRange(period: string) {
        const endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        const startDate = new Date();
        startDate.setHours(0, 0, 0, 0);

        switch (period) {
            case 'today': break;
            case '7d': startDate.setDate(startDate.getDate() - 7); break;
            case '1m': startDate.setMonth(startDate.getMonth() - 1); break;
            case '3m': startDate.setMonth(startDate.getMonth() - 3); break;
            case '6m': startDate.setMonth(startDate.getMonth() - 6); break;
            case '1y': startDate.setFullYear(startDate.getFullYear() - 1); break;
            default: startDate.setMonth(startDate.getMonth() - 1);
        }
        return { startDate, endDate };
    }

    async getSummary(companyId: string) {
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
        const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

        const [totalRooms, occupiedRooms, availableRooms, todayCheckIns, todayCheckOuts] = await Promise.all([
            prisma.room.count({ where: { companyId } }),
            prisma.room.count({ where: { companyId, status: 'occupied' } }),
            prisma.room.count({ where: { companyId, status: 'available' } }),
            prisma.booking.count({ where: { room: { companyId }, checkIn: { gte: todayStart, lte: todayEnd } } }),
            prisma.booking.count({ where: { room: { companyId }, status: 'checked_in', expectedCheckout: { gte: todayStart, lte: todayEnd } } })
        ]);

        const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

        // Revenue logic -- aggregation pushed down to PostgreSQL
        const getRevenue = async (start: Date, end?: Date) => {
            const dateFilter = { room: { companyId }, checkIn: { gte: start, ...(end && { lte: end }) } };

            const nightsQuery = end
                ? prisma.$queryRaw<[{ total_nights: bigint }]>`
                    SELECT COALESCE(SUM(GREATEST(1, CEIL(
                        EXTRACT(EPOCH FROM (COALESCE(b."checkOut", b."expectedCheckout") - b."checkIn")) / 86400.0
                    ))), 0)::bigint AS total_nights
                    FROM bookings b
                    INNER JOIN rooms r ON r.id = b."roomId"
                    WHERE r."companyId" = ${companyId}
                      AND b."checkIn" >= ${start}
                      AND b."checkIn" <= ${end}`
                : prisma.$queryRaw<[{ total_nights: bigint }]>`
                    SELECT COALESCE(SUM(GREATEST(1, CEIL(
                        EXTRACT(EPOCH FROM (COALESCE(b."checkOut", b."expectedCheckout") - b."checkIn")) / 86400.0
                    ))), 0)::bigint AS total_nights
                    FROM bookings b
                    INNER JOIN rooms r ON r.id = b."roomId"
                    WHERE r."companyId" = ${companyId}
                      AND b."checkIn" >= ${start}`;

            const [aggBooking, aggConsumption, nightsResult] = await Promise.all([
                prisma.booking.aggregate({ where: dateFilter, _sum: { totalPrice: true } }),
                prisma.bookingConsumption.aggregate({ where: { booking: dateFilter }, _sum: { total: true } }),
                nightsQuery
            ]);

            const accommodation = Number(aggBooking._sum.totalPrice || 0);
            const consumption = Number(aggConsumption._sum.total || 0);
            const totalNightsSold = Number(nightsResult[0]?.total_nights || 0);
            return { total: accommodation + consumption, accommodation, totalNightsSold };
        };

        const [todayRevenueData, monthRevenueData] = await Promise.all([
            getRevenue(todayStart, todayEnd),
            getRevenue(monthStart)
        ]);

        const todayRevenue = todayRevenueData.total;
        const monthRevenue = monthRevenueData.total;

        // Growth
        const prevMonthStart = new Date(monthStart); prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
        const prevMonthEnd = new Date(monthStart); prevMonthEnd.setDate(prevMonthEnd.getDate() - 1);
        const prevMonthRevenueData = await getRevenue(prevMonthStart, prevMonthEnd);
        const prevMonthRevenue = prevMonthRevenueData.total;
        const monthlyGrowth = prevMonthRevenue > 0 ? Math.round(((monthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100) : 0;
        
        const daysInMonth = (new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)).getDate();
        const availableRoomNights = totalRooms * daysInMonth;
        
        const revpar = availableRoomNights > 0 ? Math.round(monthRevenueData.accommodation / availableRoomNights) : 0;
        const adr = monthRevenueData.totalNightsSold > 0 ? Math.round(monthRevenueData.accommodation / monthRevenueData.totalNightsSold) : 0;

        return { 
            totalRooms, occupiedRooms, availableRooms, occupancyRate, 
            todayRevenue, monthRevenue, todayCheckIns, todayCheckOuts, monthlyGrowth,
            revpar, adr
        };
    }

    async getRecentBookings(companyId: string, limit: number = 5) {
        const bookings = await prisma.booking.findMany({
            where: { room: { companyId } },
            include: { room: { select: { number: true, type: true } } },
            orderBy: { checkIn: 'desc' },
            take: limit
        });
        return bookings.map(b => ({
            id: b.id, customerName: b.customerName, roomNumber: b.room?.number || '--',
            roomType: b.room?.type || '--', checkIn: b.checkIn, checkOut: b.checkOut,
            status: b.status, totalPrice: Number(b.totalPrice) || 0, guestCount: b.guestCount
        }));
    }

    async getMetrics(companyId: string, period: string) {
        const { startDate, endDate } = this.getDateRange(period);
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

        const [totalRooms, occupiedRooms, totalBookings, todayBookings, activeGuests] = await Promise.all([
            prisma.room.count({ where: { companyId } }),
            prisma.room.count({ where: { companyId, status: 'occupied' } }),
            prisma.booking.count({ where: { room: { companyId }, checkIn: { gte: startDate, lte: endDate } } }),
            prisma.booking.count({ where: { room: { companyId }, checkIn: { gte: todayStart, lte: todayEnd } } }),
            prisma.booking.aggregate({ where: { room: { companyId }, status: 'checked_in' }, _sum: { guestCount: true } })
        ]);

        // Revenue data -- aggregation pushed down to PostgreSQL
        const getRevenueData = async (start: Date, end: Date) => {
            const dateFilter = { room: { companyId }, checkIn: { gte: start, lte: end } };

            const [aggBooking, aggConsumption, nightsResult] = await Promise.all([
                prisma.booking.aggregate({ where: dateFilter, _sum: { totalPrice: true } }),
                prisma.bookingConsumption.aggregate({ where: { booking: dateFilter }, _sum: { total: true } }),
                prisma.$queryRaw<[{ total_nights: bigint }]>`
                    SELECT COALESCE(SUM(GREATEST(1, CEIL(
                        EXTRACT(EPOCH FROM (COALESCE(b."checkOut", b."expectedCheckout") - b."checkIn")) / 86400.0
                    ))), 0)::bigint AS total_nights
                    FROM bookings b
                    INNER JOIN rooms r ON r.id = b."roomId"
                    WHERE r."companyId" = ${companyId}
                      AND b."checkIn" >= ${start}
                      AND b."checkIn" <= ${end}`
            ]);

            const accommodation = Number(aggBooking._sum.totalPrice || 0);
            const consumption = Number(aggConsumption._sum.total || 0);
            const totalNightsSold = Number(nightsResult[0]?.total_nights || 0);
            return { accommodation, consumption, total: accommodation + consumption, totalNightsSold };
        };

        const [periodRevenue, todayRevenue] = await Promise.all([
            getRevenueData(startDate, endDate),
            getRevenueData(todayStart, todayEnd)
        ]);

        const daysInPeriod = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)));
        const availableRoomNights = totalRooms * daysInPeriod;
        
        // ADR: Average Daily Rate = Total Room Revenue / Number of Rooms Sold
        const adr = periodRevenue.totalNightsSold > 0 ? Math.round(periodRevenue.accommodation / periodRevenue.totalNightsSold) : 0;
        
        // RevPAR: Revenue Per Available Room = Total Room Revenue / Total Available Rooms
        const revpar = availableRoomNights > 0 ? Math.round(periodRevenue.accommodation / availableRoomNights) : 0;
        
        // Actual Occupancy Rate for the period
        const periodOccupancyRate = availableRoomNights > 0 ? Math.round((periodRevenue.totalNightsSold / availableRoomNights) * 100) : 0;

        const availableRooms = totalRooms - occupiedRooms;

        return {
            totalRooms, occupiedRooms, availableRooms,
            occupancyRate: totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0,
            periodOccupancyRate,
            totalBookings, todayBookings, totalRevenue: periodRevenue.total, todayRevenue: todayRevenue.total,
            consumptionRevenue: periodRevenue.consumption, 
            avgDailyRate: adr, 
            revpar,
            activeGuests: activeGuests._sum?.guestCount || 0, period
        };
    }

    async getRevenueChart(companyId: string, period: string) {
        const { startDate, endDate } = this.getDateRange(period);

        type ChartRow = { date: Date; revenue: string; consumption: string; bookings: bigint };

        const rows = await prisma.$queryRaw<ChartRow[]>`
            SELECT
                DATE(b."checkIn")                        AS date,
                COALESCE(SUM(b."totalPrice"), 0)         AS revenue,
                COALESCE(SUM(bc_agg.consumption), 0)    AS consumption,
                COUNT(b.id)                             AS bookings
            FROM bookings b
            INNER JOIN rooms r ON r.id = b."roomId"
            LEFT JOIN (
                SELECT bc."bookingId", SUM(bc.total) AS consumption
                FROM booking_consumptions bc
                GROUP BY bc."bookingId"
            ) bc_agg ON bc_agg."bookingId" = b.id
            WHERE r."companyId" = ${companyId}
              AND b."checkIn" >= ${startDate}
              AND b."checkIn" <= ${endDate}
            GROUP BY DATE(b."checkIn")
            ORDER BY DATE(b."checkIn") ASC`;

        return rows.map(row => {
            const revenue = Number(row.revenue);
            const consumption = Number(row.consumption);
            return {
                date: row.date instanceof Date
                    ? row.date.toISOString().slice(0, 10)
                    : String(row.date).slice(0, 10),
                revenue,
                consumption,
                total: revenue + consumption,
                bookings: Number(row.bookings)
            };
        });
    }

    async getOccupancyChart(companyId: string, period: string) {
        const { startDate, endDate } = this.getDateRange(period);
        const totalRooms = await prisma.room.count({ where: { companyId } });
        if (totalRooms === 0) return [];

        // For occupancy history, we can generate a series of dates and check bookings for each
        const days: { date: string; rate: number }[] = [];
        const curr = new Date(startDate);
        while (curr <= endDate) {
            const dateStr = curr.toISOString().slice(0, 10);
            const startOfDay = new Date(curr); startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(curr); endOfDay.setHours(23, 59, 59, 999);

            const occupiedCount = await prisma.booking.count({
                where: {
                    room: { companyId },
                    checkIn: { lte: endOfDay },
                    OR: [
                        { checkOut: null, expectedCheckout: { gte: startOfDay } },
                        { checkOut: { gte: startOfDay } }
                    ]
                }
            });

            days.push({
                date: dateStr,
                rate: Math.min(100, Math.round((occupiedCount / totalRooms) * 100))
            });
            curr.setDate(curr.getDate() + 1);
        }
        return days;
    }

    async getRoomTypesChart(companyId: string, period: string) {
        const { startDate, endDate } = this.getDateRange(period);

        type TypeRow = { type: string; value: string; count: bigint };
        const rows = await prisma.$queryRaw<TypeRow[]>`
            SELECT
                r.type                      AS type,
                COALESCE(SUM(b."totalPrice"), 0) AS value,
                COUNT(b.id)                 AS count
            FROM bookings b
            INNER JOIN rooms r ON r.id = b."roomId"
            WHERE r."companyId" = ${companyId}
              AND b."checkIn" >= ${startDate}
              AND b."checkIn" <= ${endDate}
            GROUP BY r.type`;

        return rows.map(row => ({
            name: row.type,
            value: Number(row.value),
            count: Number(row.count)
        }));
    }

    async getConsumptionChart(companyId: string, period: string) {
        const { startDate, endDate } = this.getDateRange(period);

        type ConsumptionRow = { name: string; quantity: string; revenue: string };
        const rows = await prisma.$queryRaw<ConsumptionRow[]>`
            SELECT
                p.name                      AS name,
                SUM(bc.quantity)            AS quantity,
                SUM(bc.total)               AS revenue
            FROM booking_consumptions bc
            INNER JOIN products p ON p.id = bc."productId"
            INNER JOIN bookings b ON b.id = bc."bookingId"
            INNER JOIN rooms r ON r.id = b."roomId"
            WHERE r."companyId" = ${companyId}
              AND b."checkIn" >= ${startDate}
              AND b."checkIn" <= ${endDate}
            GROUP BY p.name
            ORDER BY revenue DESC
            LIMIT 5`;

        return rows.map(row => ({
            name: row.name,
            quantity: Number(row.quantity),
            revenue: Number(row.revenue)
        }));
    }

    async getReports(companyId: string, period: string) {
        const { startDate, endDate } = this.getDateRange(period);
        
        const [metrics, roomStats, bookingsRaw] = await Promise.all([
            this.getMetrics(companyId, period),
            prisma.room.groupBy({
                by: ['status'],
                where: { companyId },
                _count: { _all: true }
            }),
            prisma.booking.findMany({
                where: {
                    room: { companyId },
                    checkIn: { gte: startDate, lte: endDate }
                },
                include: {
                    room: true,
                    consumptions: {
                        include: { product: true }
                    }
                },
                orderBy: { checkIn: 'desc' }
            })
        ]);

        const stats = {
            total: metrics.totalRooms,
            available: metrics.availableRooms,
            occupied: metrics.occupiedRooms,
            maintenance: roomStats.find(s => s.status === 'maintenance')?._count._all || 0,
            dirty: roomStats.find(s => s.status === 'dirty')?._count._all || 0
        };

        const bookings = bookingsRaw.map(b => {
            const roomRevenue = Number(b.totalPrice);
            const consumptionTotal = b.consumptions.reduce((sum, c) => sum + Number(c.total), 0);
            return {
                id: b.id,
                checkIn: b.checkIn.toISOString(),
                checkOut: b.checkOut?.toISOString() || null,
                roomNumber: b.room.number,
                roomType: b.room.type,
                customerName: b.customerName,
                guestCount: b.guestCount,
                status: b.status,
                roomRevenue,
                consumptionTotal,
                totalRevenue: roomRevenue + consumptionTotal,
                consumptions: b.consumptions.map(c => ({
                    product: c.product.name,
                    quantity: c.quantity,
                    unitPrice: Number(c.unitPrice),
                    total: Number(c.total)
                }))
            };
        });

        return {
            period,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            summary: {
                totalBookings: metrics.totalBookings,
                totalGuests: metrics.activeGuests,
                totalRoomRevenue: bookings.reduce((sum, b) => sum + b.roomRevenue, 0),
                totalConsumptionRevenue: bookings.reduce((sum, b) => sum + b.consumptionTotal, 0),
                totalRevenue: bookings.reduce((sum, b) => sum + b.totalRevenue, 0),
                avgBookingValue: bookings.length > 0 ? bookings.reduce((sum, b) => sum + b.totalRevenue, 0) / bookings.length : 0,
                occupancyRate: metrics.occupancyRate
            },
            roomStats: stats,
            bookings
        };
    }
}

export const hospitalityDashboardService = new HospitalityDashboardService();
