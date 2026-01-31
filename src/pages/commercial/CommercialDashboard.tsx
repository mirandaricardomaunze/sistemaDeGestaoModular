import { useMemo } from 'react';
import {
    HiOutlineCurrencyDollar,
    HiOutlineTrendingUp,
    HiOutlineShoppingCart,
    HiOutlineCube,
    HiOutlineTrendingDown
} from 'react-icons/hi';
import { Card, Badge, Button } from '../../components/ui';
import { formatCurrency, cn } from '../../utils/helpers';
import { useDashboard } from '../../hooks/useDashboard';
import { useSmartInsights } from '../../hooks/useSmartInsights';
import { SmartInsightCard } from '../../components/common/SmartInsightCard';
import { HiOutlineLightBulb } from 'react-icons/hi';

export default function CommercialDashboard() {
    const { stats, salesChart, isLoading } = useDashboard();
    const { insights } = useSmartInsights();

    const metrics = useMemo(() => {
        const totalRevenue = stats?.commercialRevenue || 0;
        const totalProfit = stats?.totalProfit || 0;
        const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

        return {
            totalRevenue,
            totalProfit,
            margin,
            salesGrowth: stats?.monthlyGrowth || 0,
            todaySales: stats?.todaySales || 0,
            lowStock: stats?.lowStockCount || 0
        };
    }, [stats]);

    if (isLoading) {
        return <div className="animate-pulse space-y-4">
            <div className="h-32 bg-gray-200 dark:bg-dark-700 rounded-xl" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="h-24 bg-gray-200 dark:bg-dark-700 rounded-xl" />
                <div className="h-24 bg-gray-200 dark:bg-dark-700 rounded-xl" />
                <div className="h-24 bg-gray-200 dark:bg-dark-700 rounded-xl" />
            </div>
        </div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Painel Comercial</h2>
                    <p className="text-sm text-gray-500">Métricas de performance e vendas comerciais</p>
                </div>
                <Badge variant="success" className="px-4 py-1">
                    Operação Online
                </Badge>
            </div>

            {/* Smart Insights / Intelligent Advisor */}
            {insights.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <HiOutlineLightBulb className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Conselheiro Inteligente</h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Tendências comerciais e gestão de stock</p>
                        </div>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hidden">
                        {insights.map((insight) => (
                            <SmartInsightCard key={insight.id} insight={insight} className="min-w-[320px] max-w-[400px] flex-shrink-0" />
                        ))}
                    </div>
                </div>
            )}

            {/* Main Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card padding="lg" className="relative overflow-hidden border-l-4 border-l-primary-500">
                    <div className="relative z-10">
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Faturação do Mês (🛍️)</p>
                        <div className="flex items-end gap-2 mt-1">
                            <span className="text-3xl font-bold text-gray-900 dark:text-white">
                                {formatCurrency(metrics.totalRevenue)}
                            </span>
                            <div className={cn(
                                "flex items-center text-xs font-bold mb-1",
                                metrics.salesGrowth >= 0 ? "text-green-500" : "text-red-500"
                            )}>
                                {metrics.salesGrowth >= 0 ? <HiOutlineTrendingUp className="w-4 h-4" /> : <HiOutlineTrendingDown className="w-4 h-4" />}
                                {Math.abs(metrics.salesGrowth)}%
                            </div>
                        </div>
                    </div>
                    <HiOutlineCurrencyDollar className="absolute right-[-10px] bottom-[-10px] w-24 h-24 text-primary-500/5 rotate-12" />
                </Card>

                <Card padding="lg" className="relative overflow-hidden border-l-4 border-l-green-500">
                    <div className="relative z-10">
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Lucro Bruto Comercial</p>
                        <div className="flex items-end gap-2 mt-1">
                            <span className="text-3xl font-bold text-gray-900 dark:text-white">
                                {formatCurrency(metrics.totalProfit)}
                            </span>
                            <Badge variant="success" size="sm" className="mb-1">
                                {metrics.margin.toFixed(1)}% Margem
                            </Badge>
                        </div>
                    </div>
                    <HiOutlineTrendingUp className="absolute right-[-10px] bottom-[-10px] w-24 h-24 text-green-500/5 rotate-12" />
                </Card>

                <Card padding="lg" className="relative overflow-hidden border-l-4 border-l-orange-500">
                    <div className="relative z-10">
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Vendas Hoje</p>
                        <div className="mt-1">
                            <span className="text-3xl font-bold text-gray-900 dark:text-white">
                                {formatCurrency(metrics.todaySales)}
                            </span>
                        </div>
                    </div>
                    <HiOutlineShoppingCart className="absolute right-[-10px] bottom-[-10px] w-24 h-24 text-orange-500/5 rotate-12" />
                </Card>
            </div>

            {/* Charts & Secondary Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card padding="lg">
                    <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <HiOutlineTrendingUp className="text-primary-500" />
                        Tendência de Vendas (Diário)
                    </h3>
                    <div className="h-64 flex items-end gap-2 pt-4">
                        {salesChart.slice(-7).map((item, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                                <div
                                    className="w-full bg-primary-100 dark:bg-primary-900/20 group-hover:bg-primary-500 transition-colors rounded-t-lg relative"
                                    style={{ height: `${Math.max(10, (item.value / (Math.max(...salesChart.map(s => s.value)) || 1)) * 100)}%` }}
                                >
                                    <div className="absolute top-[-25px] left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                        {formatCurrency(item.value)}
                                    </div>
                                </div>
                                <span className="text-[10px] text-gray-400 uppercase font-medium">{item.date}</span>
                            </div>
                        ))}
                    </div>
                </Card>

                <div className="space-y-6">
                    <Card padding="lg" className="bg-gradient-to-br from-dark-800 to-dark-900 text-white border-0">
                        <h3 className="font-bold mb-4 flex items-center gap-2 text-primary-400">
                            <HiOutlineCube />
                            Alertas de Inventário Comercial
                        </h3>
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                            <div>
                                <p className="text-sm text-gray-400">Produtos com Stock Baixo</p>
                                <p className="text-2xl font-bold">{metrics.lowStock}</p>
                            </div>
                            <Button size="sm" variant="primary" className="bg-primary-500 hover:bg-primary-600">
                                Ver Stock
                            </Button>
                        </div>
                    </Card>

                    <Card padding="lg">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-4">Métricas de Eficiência</h3>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-500">Aproveitamento de Margem</span>
                                    <span className="font-bold text-gray-900 dark:text-white">{metrics.margin.toFixed(0)}%</span>
                                </div>
                                <div className="h-2 bg-gray-100 dark:bg-dark-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary-500 rounded-full"
                                        style={{ width: `${Math.min(100, metrics.margin * 2)}%` }}
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-500">Crescimento Mensal</span>
                                    <span className="font-bold text-green-500">{metrics.salesGrowth}%</span>
                                </div>
                                <div className="h-2 bg-gray-100 dark:bg-dark-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-green-500 rounded-full"
                                        style={{ width: `${Math.min(100, metrics.salesGrowth + 20)}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
