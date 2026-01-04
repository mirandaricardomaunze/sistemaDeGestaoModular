import { useMemo } from 'react';
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
    Legend,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
} from 'recharts';
import { Card } from '../../../components/ui';
import { formatCurrency } from '../../../utils/helpers';

const CHART_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

interface ReportChartsProps {
    profitLossReport?: any;
    roomRevenueReport?: any;
    type: 'profit-loss' | 'room-revenue';
}

export function ReportCharts({ profitLossReport, roomRevenueReport, type }: ReportChartsProps) {
    const revenueData = useMemo(() => {
        if (!profitLossReport?.revenues?.byCategory) return [];
        return Object.entries(profitLossReport.revenues.byCategory).map(([category, data]: any) => ({
            name: category === 'accommodation' ? 'Hospedagem' : category === 'consumption' ? 'Consumos' : category,
            value: data.total
        }));
    }, [profitLossReport]);

    const expenseData = useMemo(() => {
        if (!profitLossReport?.expenses?.byCategory) return [];
        return Object.entries(profitLossReport.expenses.byCategory).map(([category, data]: any) => ({
            name: category,
            value: data.total
        }));
    }, [profitLossReport]);

    const comparisonData = useMemo(() => {
        if (!profitLossReport?.summary) return [];
        return [
            {
                name: 'Financeiro',
                Receitas: profitLossReport.summary.totalRevenue,
                Despesas: profitLossReport.summary.totalExpenses,
                Lucro: profitLossReport.summary.netProfit,
            }
        ];
    }, [profitLossReport]);

    const roomData = useMemo(() => {
        if (!roomRevenueReport?.rooms) return [];
        return roomRevenueReport.rooms.map((room: any) => ({
            name: `Qto ${room.roomNumber}`,
            receita: room.total
        })).slice(0, 10); // Show top 10 rooms
    }, [roomRevenueReport]);

    if (type === 'profit-loss' && profitLossReport) {
        return (
            <div className="space-y-6 mb-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Summary Comparison */}
                    <Card padding="md">
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wider">
                            Comparativo Geral
                        </h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={comparisonData}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-dark-700" />
                                    <XAxis dataKey="name" hide />
                                    <YAxis stroke="#94a3b8" />
                                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                                    <Legend />
                                    <Bar dataKey="Receitas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="Lucro" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    {/* Revenue Distribution */}
                    <Card padding="md">
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wider">
                            Distribuição de Receitas
                        </h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={revenueData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {revenueData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    {/* Expense Distribution */}
                    <Card padding="md">
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wider">
                            Distribuição de Despesas
                        </h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={expenseData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {expenseData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>
            </div>
        );
    }

    if (type === 'room-revenue' && roomRevenueReport) {
        return (
            <div className="mb-6">
                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={roomData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-dark-700" />
                            <XAxis dataKey="name" stroke="#94a3b8" />
                            <YAxis stroke="#94a3b8" />
                            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                            <Bar dataKey="receita" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    }

    return null;
}
