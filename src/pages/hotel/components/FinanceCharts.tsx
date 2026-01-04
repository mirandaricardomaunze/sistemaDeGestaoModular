import {
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';
import { Card } from '../../../components/ui';
import { formatCurrency } from '../../../utils/helpers';

const CHART_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

interface FinanceChartsProps {
    monthlyData: any[];
    categoryData: any[];
    expenseCategoryData: any[];
}

export function FinanceCharts({ monthlyData, categoryData, expenseCategoryData }: FinanceChartsProps) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Trend */}
            <Card padding="md">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                    Tendência Mensal
                </h2>
                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={monthlyData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-dark-700" />
                            <XAxis dataKey="month" stroke="#94a3b8" />
                            <YAxis stroke="#94a3b8" />
                            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                            <Legend />
                            <Area type="monotone" dataKey="receitas" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} />
                            <Area type="monotone" dataKey="despesas" stackId="2" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} />
                            <Area type="monotone" dataKey="lucro" stroke="#6366f1" fill="#6366f1" fillOpacity={0.8} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            {/* Revenue by Category */}
            <Card padding="md">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                    Receitas por Categoria
                </h2>
                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={categoryData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={100}
                                paddingAngle={4}
                                dataKey="value"
                            >
                                {categoryData.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            {/* Expense by Category */}
            {expenseCategoryData.length > 0 && (
                <Card padding="md" className="lg:col-span-2">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                        Despesas por Categoria
                    </h2>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={expenseCategoryData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={4}
                                    dataKey="value"
                                >
                                    {expenseCategoryData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            )}
        </div>
    );
}
