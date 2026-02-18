import { prisma } from '../lib/prisma';
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

        // Revenue logic
        const getRevenue = async (start: Date, end?: Date) => {
            const bookings = await prisma.booking.findMany({
                where: { room: { companyId }, checkIn: { gte: start, ...(end && { lte: end }) } },
                include: { consumptions: { select: { total: true } } }
            });
            return bookings.reduce((sum, b) => sum + Number(b.totalPrice) + b.consumptions.reduce((s, c) => s + Number(c.total), 0), 0);
        };

        const [todayRevenue, monthRevenue] = await Promise.all([
            getRevenue(todayStart, todayEnd),
            getRevenue(monthStart)
        ]);

        // Growth
        const prevMonthStart = new Date(monthStart); prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
        const prevMonthEnd = new Date(monthStart); prevMonthEnd.setDate(prevMonthEnd.getDate() - 1);
        const prevMonthRevenue = await getRevenue(prevMonthStart, prevMonthEnd);
        const monthlyGrowth = prevMonthRevenue > 0 ? Math.round(((monthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100) : 0;

        return { totalRooms, occupiedRooms, availableRooms, occupancyRate, todayRevenue, monthRevenue, todayCheckIns, todayCheckOuts, monthlyGrowth };
    }

    async getRecentBookings(companyId: string, limit: number = 5) {
        const bookings = await prisma.booking.findMany({
            where: { room: { companyId } },
            include: { room: { select: { number: true, type: true } } },
            orderBy: { checkIn: 'desc' },
            take: limit
        });
        return bookings.map(b => ({
            id: b.id, customerName: b.customerName, roomNumber: b.room?.number || '—',
            roomType: b.room?.type || '—', checkIn: b.checkIn, checkOut: b.checkOut,
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

        const getRevenueData = async (start: Date, end: Date) => {
            const bookings = await prisma.booking.findMany({
                where: { room: { companyId }, checkIn: { gte: start, lte: end } },
                include: { consumptions: { select: { total: true } } }
            });
            let accommodation = 0; let consumption = 0;
            bookings.forEach(b => {
                accommodation += Number(b.totalPrice);
                b.consumptions.forEach(c => consumption += Number(c.total));
            });
            return { accommodation, consumption, total: accommodation + consumption };
        };

        const [periodRevenue, todayRevenue] = await Promise.all([
            getRevenueData(startDate, endDate),
            getRevenueData(todayStart, todayEnd)
        ]);

        return {
            totalRooms, occupiedRooms, occupancyRate: totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0,
            totalBookings, todayBookings, totalRevenue: periodRevenue.total, todayRevenue: todayRevenue.total,
            consumptionRevenue: periodRevenue.consumption, avgDailyRate: totalBookings > 0 ? Math.round(periodRevenue.total / totalBookings) : 0,
            activeGuests: activeGuests._sum?.guestCount || 0, period
        };
    }

    async getRevenueChart(companyId: string, period: string) {
        const { startDate, endDate } = this.getDateRange(period);
        const bookings = await prisma.booking.findMany({
            where: { room: { companyId }, checkIn: { gte: startDate, lte: endDate } },
            include: { consumptions: true }, orderBy: { checkIn: 'asc' }
        });

        const grouped: Record<string, { revenue: number, consumption: number, bookings: number }> = {};
        bookings.forEach(b => {
            const dateKey = b.checkIn.toISOString().slice(0, 10);
            if (!grouped[dateKey]) grouped[dateKey] = { revenue: 0, consumption: 0, bookings: 0 };
            grouped[dateKey].revenue += Number(b.totalPrice);
            grouped[dateKey].bookings += 1;
            b.consumptions.forEach(c => grouped[dateKey].consumption += Number(c.total));
        });

        return Object.entries(grouped).map(([date, data]) => ({
            date, revenue: data.revenue, consumption: data.consumption, total: data.revenue + data.consumption, bookings: data.bookings
        }));
    }
}

export const hospitalityDashboardService = new HospitalityDashboardService();
