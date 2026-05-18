import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ResultHandler } from '../../utils/result';
import { cacheService } from '../cacheService';

const DASHBOARD_CACHE_TTL = 120;

export class AnalyticsService {
    // ── Dashboard ─────────────────────────────────────────────────────────────

    async getDashboard(companyId: string) {
        const cacheKey = `logistics:dashboard:${companyId}`;
        const cached = cacheService.get(cacheKey);
        if (cached) return ResultHandler.success(cached);

        const todayStart = new Date(new Date().setHours(0, 0, 0, 0));

        const [
            vehicles, drivers, routes, deliveries, parcels, recentDeliveries,
            pendingDeliveries, inTransitDeliveries, deliveredToday,
            availableVehicles, availableDrivers,
            pickupRevenue, deliveryRevenue, deliveriesByProvince, pendingParcels
        ] = await Promise.all([
            prisma.vehicle.count({ where: { companyId } }),
            prisma.driver.count({ where: { companyId } }),
            prisma.deliveryRoute.count({ where: { companyId } }),
            prisma.delivery.count({ where: { companyId } }),
            prisma.parcel.count({ where: { companyId } }),
            prisma.delivery.findMany({
                where: { companyId }, take: 5, orderBy: { createdAt: 'desc' },
                include: { driver: true, vehicle: true, route: true }
            }),
            prisma.delivery.count({ where: { companyId, status: 'pending' } }),
            prisma.delivery.count({ where: { companyId, status: 'in_transit' } }),
            prisma.delivery.count({ where: { companyId, status: 'delivered', deliveredDate: { gte: todayStart } } }),
            prisma.vehicle.count({ where: { companyId, status: 'available' } }),
            prisma.driver.count({ where: { companyId, status: 'available' } }),
            prisma.transaction.aggregate({ where: { companyId, module: 'logistics', type: 'income', parcelId: { not: null } }, _sum: { amount: true } }),
            prisma.transaction.aggregate({ where: { companyId, module: 'logistics', type: 'income', deliveryId: { not: null } }, _sum: { amount: true } }),
            prisma.delivery.groupBy({ by: ['province'], where: { companyId, province: { not: null } }, _count: { id: true } }),
            prisma.parcel.count({ where: { companyId, status: { in: ['received', 'awaiting_pickup'] } } }),
        ]);

        const result = {
            totals: { vehicles, drivers, routes, deliveries, parcels },
            stats: {
                pendingDeliveries, inTransitDeliveries, deliveredToday,
                availableVehicles, availableDrivers, pendingParcels,
                pickupRevenue: Number(pickupRevenue._sum?.amount || 0),
                deliveryRevenue: Number(deliveryRevenue._sum?.amount || 0),
                deliveriesByProvince: deliveriesByProvince.map(p => ({ province: p.province, count: p._count.id }))
            },
            recentDeliveries
        };

        cacheService.set(cacheKey, result, DASHBOARD_CACHE_TTL);
        return ResultHandler.success(result);
    }

    // ── Reports ───────────────────────────────────────────────────────────────

    async getReportsSummary(companyId: string, query: { startDate?: string; endDate?: string }) {
        const { startDate, endDate } = query;
        const where: Prisma.DeliveryWhereInput = { companyId };
        if (startDate || endDate) {
            const dateFilter: Prisma.DateTimeFilter = {};
            if (startDate) dateFilter.gte = new Date(startDate);
            if (endDate) dateFilter.lte = new Date(endDate + 'T23:59:59.999Z');
            where.createdAt = dateFilter;
        }

        const [total, delivered, failed, pending, inTransit, revenueAgg, avgTimeData, statusGroups,
               driverGroups, routeCountGroups, routeRevenueGroups] = await Promise.all([
            prisma.delivery.count({ where }),
            prisma.delivery.count({ where: { ...where, status: 'delivered' } }),
            prisma.delivery.count({ where: { ...where, status: 'failed' } }),
            prisma.delivery.count({ where: { ...where, status: 'pending' } }),
            prisma.delivery.count({ where: { ...where, status: 'in_transit' } }),
            prisma.delivery.aggregate({ where: { ...where, isPaid: true }, _sum: { shippingCost: true } }),
            prisma.delivery.findMany({
                where: { ...where, status: 'delivered', deliveredDate: { not: null } },
                select: { createdAt: true, deliveredDate: true }
            }),
            prisma.delivery.groupBy({ by: ['status'], where, _count: { id: true } }),
            prisma.delivery.groupBy({
                by: ['driverId', 'status'],
                where: { ...where, driverId: { not: null } },
                _count: { id: true }
            }),
            prisma.delivery.groupBy({
                by: ['routeId'],
                where: { ...where, routeId: { not: null } },
                _count: { id: true }
            }),
            prisma.delivery.groupBy({
                by: ['routeId'],
                where: { ...where, routeId: { not: null }, isPaid: true },
                _sum: { shippingCost: true }
            }),
        ]);

        const avgDeliveryHours = avgTimeData.length > 0
            ? avgTimeData.reduce((sum, d) => sum + (new Date(d.deliveredDate!).getTime() - new Date(d.createdAt).getTime()) / 3600000, 0) / avgTimeData.length
            : 0;

        const driverIds = [...new Set(driverGroups.map(g => g.driverId).filter(Boolean))] as string[];
        const driverNames = await prisma.driver.findMany({ where: { id: { in: driverIds } }, select: { id: true, name: true } });
        const driverNameMap = new Map(driverNames.map(d => [d.id, d.name]));

        const driverStatsMap: Record<string, { name: string; total: number; delivered: number; failed: number }> = {};
        for (const g of driverGroups) {
            if (!g.driverId) continue;
            if (!driverStatsMap[g.driverId]) driverStatsMap[g.driverId] = { name: driverNameMap.get(g.driverId) || '', total: 0, delivered: 0, failed: 0 };
            driverStatsMap[g.driverId].total += g._count.id;
            if (g.status === 'delivered') driverStatsMap[g.driverId].delivered += g._count.id;
            if (g.status === 'failed') driverStatsMap[g.driverId].failed += g._count.id;
        }
        const driverPerformance = Object.values(driverStatsMap)
            .map(ds => ({ ...ds, successRate: ds.total > 0 ? (ds.delivered / ds.total) * 100 : 0 }))
            .sort((a, b) => b.total - a.total).slice(0, 10);

        const routeIds = [...new Set(routeCountGroups.map(g => g.routeId).filter(Boolean))] as string[];
        const routeNames = await prisma.deliveryRoute.findMany({ where: { id: { in: routeIds } }, select: { id: true, name: true } });
        const routeNameMap = new Map(routeNames.map(r => [r.id, r.name]));
        const revenueMap = new Map(routeRevenueGroups.map(g => [g.routeId, Number(g._sum?.shippingCost || 0)]));

        const routeUsage = routeCountGroups
            .map(g => ({ name: routeNameMap.get(g.routeId!) || '', count: g._count.id, revenue: revenueMap.get(g.routeId!) || 0 }))
            .sort((a, b) => b.count - a.count).slice(0, 10);

        return ResultHandler.success({
            summary: {
                total, delivered, failed, pending, inTransit,
                successRate: total > 0 ? (delivered / total) * 100 : 0,
                totalRevenue: Number(revenueAgg._sum?.shippingCost || 0),
                avgDeliveryHours
            },
            statusDistribution: statusGroups.map(g => ({ status: g.status, count: g._count.id })),
            driverPerformance,
            routeUsage
        });
    }
}
