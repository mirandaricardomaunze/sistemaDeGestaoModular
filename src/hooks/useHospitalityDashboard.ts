/**
 * useHospitalityDashboard Hook
 * Custom hook for fetching hotel dashboard data with period filtering
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

// ============================================================================
// Types
// ============================================================================

export type DashboardPeriod = 'today' | '7d' | '1m' | '3m' | '6m' | '1y';

export interface HospitalityMetrics {
    totalRooms: number;
    occupiedRooms: number;
    occupancyRate: number;
    totalBookings: number;
    todayBookings: number;
    totalRevenue: number;
    todayRevenue: number;
    consumptionRevenue: number;
    avgDailyRate: number;
    checkouts: number;
    activeGuests: number;
    period: string;
}

export interface RevenueChartData {
    date: string;
    revenue: number;
    consumption: number;
    total: number;
    bookings: number;
}

export interface OccupancyChartData {
    date: string;
    rate: number;
}

export interface RoomTypeData {
    name: string;
    value: number;
    count: number;
}

export interface ConsumptionData {
    name: string;
    quantity: number;
    revenue: number;
}

export interface ReportBooking {
    id: string;
    checkIn: string;
    checkOut: string | null;
    roomNumber: string;
    roomType: string;
    customerName: string;
    guestCount: number;
    status: string;
    roomRevenue: number;
    consumptionTotal: number;
    totalRevenue: number;
    consumptions: {
        product: string;
        quantity: number;
        unitPrice: number;
        total: number;
    }[];
}

export interface ReportData {
    period: string;
    startDate: string;
    endDate: string;
    summary: {
        totalBookings: number;
        totalGuests: number;
        totalRoomRevenue: number;
        totalConsumptionRevenue: number;
        totalRevenue: number;
        avgBookingValue: number;
        occupancyRate: number;
    };
    roomStats: {
        total: number;
        available: number;
        occupied: number;
        maintenance: number;
        dirty: number;
    };
    bookings: ReportBooking[];
}

// ============================================================================
// Hook
// ============================================================================

export function useHospitalityDashboard(initialPeriod: DashboardPeriod = '1m') {
    const [period, setPeriod] = useState<DashboardPeriod>(initialPeriod);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Data states
    const [metrics, setMetrics] = useState<HospitalityMetrics | null>(null);
    const [revenueChart, setRevenueChart] = useState<RevenueChartData[]>([]);
    const [occupancyChart, setOccupancyChart] = useState<OccupancyChartData[]>([]);
    const [roomTypesChart, setRoomTypesChart] = useState<RoomTypeData[]>([]);
    const [consumptionChart, setConsumptionChart] = useState<ConsumptionData[]>([]);

    // Report loading state (separate since it's heavier)
    const [reportLoading, setReportLoading] = useState(false);
    const [reportData, setReportData] = useState<ReportData | null>(null);

    // Fetch all dashboard data
    const fetchDashboardData = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const [metricsRes, revenueRes, occupancyRes, roomTypesRes, consumptionRes] = await Promise.all([
                api.get(`/hospitality/dashboard/metrics?period=${period}`),
                api.get(`/hospitality/dashboard/charts/revenue?period=${period}`),
                api.get(`/hospitality/dashboard/charts/occupancy?period=${period}`),
                api.get(`/hospitality/dashboard/charts/room-types?period=${period}`),
                api.get(`/hospitality/dashboard/charts/consumption?period=${period}`)
            ]);

            setMetrics(metricsRes.data);
            setRevenueChart(revenueRes.data);
            setOccupancyChart(occupancyRes.data);
            setRoomTypesChart(roomTypesRes.data);
            setConsumptionChart(consumptionRes.data);
        } catch (err: unknown) {
            console.error('Dashboard fetch error:', err);
            setError(err.response?.data?.error || 'Erro ao carregar dashboard');
        } finally {
            setIsLoading(false);
        }
    }, [period]);

    // Fetch report data (called separately for export)
    const fetchReportData = useCallback(async () => {
        setReportLoading(true);
        try {
            const res = await api.get(`/hospitality/dashboard/reports?period=${period}`);
            setReportData(res.data);
            return res.data;
        } catch (err: unknown) {
            console.error('Report fetch error:', err);
            throw err;
        } finally {
            setReportLoading(false);
        }
    }, [period]);

    // Fetch on period change
    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    // Period options for UI
    const periodOptions: { value: DashboardPeriod; label: string }[] = [
        { value: 'today', label: 'Hoje' },
        { value: '7d', label: '7 Dias' },
        { value: '1m', label: '1 Mês' },
        { value: '3m', label: '3 Meses' },
        { value: '6m', label: '6 Meses' },
        { value: '1y', label: '1 Ano' }
    ];

    return {
        // State
        period,
        setPeriod,
        isLoading,
        error,

        // Data
        metrics,
        revenueChart,
        occupancyChart,
        roomTypesChart,
        consumptionChart,

        // Report
        reportLoading,
        reportData,
        fetchReportData,

        // Actions
        refetch: fetchDashboardData,
        periodOptions
    };
}

export default useHospitalityDashboard;
