import { useState, useEffect, useCallback } from 'react';
import { dashboardAPI, hospitalityAPI, pharmacyAPI, bottleStoreAPI } from '../services/api';
import { useTenant } from '../contexts/TenantContext';
import type { Sale, Alert } from '../types';

interface DashboardStats {
    totalSales: number;
    totalRevenue: number;
    totalProducts: number;
    totalCustomers: number;
    lowStockCount: number;
    pendingInvoices: number;
    todaySales: number;
    monthlyGrowth: number;
    totalProfit: number;
    // Multi-module specific
    hospitalityRevenue?: number;
    pharmacyRevenue?: number;
    bottleStoreRevenue?: number;
    commercialRevenue?: number;
}

interface TopProductItem {
    product: { id: string; name: string; code: string; category: string };
    quantity: number;
    revenue: number;
}

interface RecentActivityData {
    recentSales: Sale[];
    recentInvoices: Array<{ id: string; invoiceNumber: string; customerName: string; total: number; status: string; createdAt: string }>;
    recentAlerts: Alert[];
}

export function useDashboard() {
    const { hasModule } = useTenant();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [salesChart, setSalesChart] = useState<Array<{ date: string; value: number }>>([]);
    const [weeklyChart, setWeeklyChart] = useState<Array<{ date: string; value: number }>>([]);
    const [topProducts, setTopProducts] = useState<TopProductItem[]>([]);
    const [recentActivity, setRecentActivity] = useState<RecentActivityData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDashboard = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Core Commercial Dashboard Data
            const [statsData, chartData, weeklyChartData, topProductsData, activityData] = await Promise.all([
                dashboardAPI.getStats(),
                dashboardAPI.getSalesChart({ period: 'month' }),
                dashboardAPI.getSalesChart({ period: 'week' }),
                dashboardAPI.getTopProducts({ limit: 5 }),
                dashboardAPI.getRecentSales({ limit: 10 }),
            ]);

            // Optional Module Data (Consolidation)
            let hospitalityRevenue = 0;
            let hospitalityProfit = 0;
            let pharmacyRevenue = 0;
            let bottleStoreRevenue = 0;
            let bottleStoreProfit = 0;

            const modulePromises = [];
            if (hasModule('HOTEL')) {
                modulePromises.push(hospitalityAPI.getFinanceDashboard('month').then(d => {
                    hospitalityRevenue = Number(d?.summary?.totalRevenue || 0);
                    hospitalityProfit = Number(d?.summary?.grossProfit || 0);
                }));
            }
            if (hasModule('PHARMACY')) modulePromises.push(pharmacyAPI.getDashboardSummary().then(d => pharmacyRevenue = Number(d?.totalSales || 0)));
            if (hasModule('BOTTLE_STORE')) {
                modulePromises.push(bottleStoreAPI.getDashboard('1M').then(d => {
                    bottleStoreRevenue = Number(d?.revenue || 0);
                    bottleStoreProfit = Number(d?.profit || 0);
                }));
            }

            await Promise.all(modulePromises);

            const commercialRevenue = Number(statsData.monthSales?.total) || 0;
            const commercialProfit = Number(statsData.monthProfit) || 0;

            const consolidatedRevenue = commercialRevenue + hospitalityRevenue + pharmacyRevenue + bottleStoreRevenue;
            const consolidatedProfit = commercialProfit + hospitalityProfit + bottleStoreProfit;

            const mappedStats: DashboardStats = {
                totalSales: (statsData.monthSales?.count || 0),
                totalRevenue: consolidatedRevenue,
                totalProducts: statsData.totalProducts || 0,
                totalCustomers: statsData.totalCustomers || 0,
                lowStockCount: statsData.lowStockItems || 0,
                pendingInvoices: statsData.overdueInvoices || 0,
                todaySales: Number(statsData.todaySales?.total) || 0,
                monthlyGrowth: statsData.salesGrowth || 0,
                totalProfit: consolidatedProfit,
                hospitalityRevenue,
                pharmacyRevenue,
                bottleStoreRevenue,
                commercialRevenue
            };

            setStats(mappedStats);
            setSalesChart(chartData || []);
            setWeeklyChart(weeklyChartData || []);
            setTopProducts(topProductsData || []);
            setRecentActivity(activityData);
        } catch (err) {
            setError('Erro ao carregar dashboard');
            console.error('Error fetching dashboard:', err);
        } finally {
            setIsLoading(false);
        }
    }, [hasModule]);

    useEffect(() => {
        fetchDashboard();
    }, [fetchDashboard]);

    return {
        stats,
        salesChart,
        weeklyChart,
        topProducts,
        recentSales: recentActivity?.recentSales || [],
        recentActivity,
        isLoading,
        error,
        refetch: fetchDashboard,
    };
}
