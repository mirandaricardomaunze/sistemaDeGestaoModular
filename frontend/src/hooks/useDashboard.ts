import { logger } from '../utils/logger';
import { useState, useEffect, useCallback } from 'react';
import { dashboardAPI, hospitalityAPI, pharmacyAPI, bottleStoreAPI } from '../services/api';
import { useTenant } from '../contexts/TenantContext';
import type { Sale, Alert } from '../types';
import { socketService } from '../services/socketService';

const DASHBOARD_REFRESH_EVENT = 'dashboard:data-changed';
const DASHBOARD_REFRESH_STORAGE_KEY = 'dashboard:last-data-change';

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
    // Modules whose data failed to load — UI can flag the consolidated KPI
    // as partial instead of silently understating the total.
    failedModules?: string[];
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

export function useDashboard(warehouseId?: string) {
    const { hasModule } = useTenant();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [salesChart, setSalesChart] = useState<Array<{ date: string; value: number }>>([]);
    const [weeklyChart, setWeeklyChart] = useState<Array<{ date: string; value: number }>>([]);
    const [topProducts, setTopProducts] = useState<TopProductItem[]>([]);
    const [recentActivity, setRecentActivity] = useState<RecentActivityData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDashboard = useCallback(async (options?: { silent?: boolean }) => {
        const silent = options?.silent ?? false;
        if (!silent) setIsLoading(true);
        setError(null);
        try {
            // Core Commercial Dashboard Data
            const [statsData, chartData, weeklyChartData, topProductsData, activityData] = await Promise.all([
                dashboardAPI.getStats({ warehouseId }),
                dashboardAPI.getSalesChart({ period: 'month', warehouseId }),
                dashboardAPI.getSalesChart({ period: 'week', warehouseId }),
                dashboardAPI.getTopProducts({ limit: 5, warehouseId }),
                dashboardAPI.getRecentSales({ limit: 10, warehouseId }),
            ]);

            // Optional Module Data (Consolidation)
            let hospitalityRevenue = 0;
            let hospitalityProfit = 0;
            let pharmacyRevenue = 0;
            let bottleStoreRevenue = 0;
            let bottleStoreProfit = 0;
            const failedModules: string[] = [];

            const modulePromises: Array<Promise<unknown>> = [];
            if (hasModule('HOTEL')) {
                modulePromises.push(
                    hospitalityAPI.getFinanceDashboard('month').then(d => {
                        hospitalityRevenue = Number(d?.summary?.totalRevenue || 0);
                        hospitalityProfit = Number(d?.summary?.grossProfit || 0);
                    }).catch(err => {
                        logger.warn('hospitality module failed in dashboard consolidation', err);
                        failedModules.push('HOTEL');
                    })
                );
            }
            if (hasModule('PHARMACY')) {
                modulePromises.push(
                    pharmacyAPI.getDashboardSummary().then(d => {
                        pharmacyRevenue = Number(d?.totalSales || 0);
                    }).catch(err => {
                        logger.warn('pharmacy module failed in dashboard consolidation', err);
                        failedModules.push('PHARMACY');
                    })
                );
            }
            if (hasModule('BOTTLE_STORE')) {
                modulePromises.push(
                    bottleStoreAPI.getDashboard('1M').then(d => {
                        bottleStoreRevenue = Number(d?.revenue || 0);
                        bottleStoreProfit = Number(d?.profit || 0);
                    }).catch(err => {
                        logger.warn('bottle store module failed in dashboard consolidation', err);
                        failedModules.push('BOTTLE_STORE');
                    })
                );
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
                commercialRevenue,
                failedModules: failedModules.length ? failedModules : undefined,
            };

            setStats(mappedStats);
            setSalesChart(chartData || []);
            setWeeklyChart(weeklyChartData || []);
            setTopProducts(topProductsData || []);
            setRecentActivity(activityData);
        } catch (err) {
            setError('Erro ao carregar dashboard');
            logger.error('Error fetching dashboard:', err);
        } finally {
            setIsLoading(false);
        }
    }, [hasModule, warehouseId]);

    useEffect(() => {
        fetchDashboard();
    }, [fetchDashboard]);

    useEffect(() => {
        const refreshSilently = () => fetchDashboard({ silent: true });
        const handleVisibilityChange = () => {
            if (!document.hidden) refreshSilently();
        };
        const handleStorage = (event: StorageEvent) => {
            if (event.key === DASHBOARD_REFRESH_STORAGE_KEY) refreshSilently();
        };

        const unsubscribers = [
            socketService.on('sale:created', refreshSilently),
            socketService.on('sale:voided', refreshSilently),
            socketService.on('product:stock-updated', refreshSilently),
            socketService.on('stock:low_stock_alert', refreshSilently),
        ];

        window.addEventListener(DASHBOARD_REFRESH_EVENT, refreshSilently);
        window.addEventListener('focus', refreshSilently);
        window.addEventListener('storage', handleStorage);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            unsubscribers.forEach(unsubscribe => unsubscribe());
            window.removeEventListener(DASHBOARD_REFRESH_EVENT, refreshSilently);
            window.removeEventListener('focus', refreshSilently);
            window.removeEventListener('storage', handleStorage);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
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
