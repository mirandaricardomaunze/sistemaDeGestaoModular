import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader, Card, TableContainer, Badge, Button, LoadingSpinner } from '../../components/ui';
import { hospitalityAPI } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { 
    HiOutlineBanknotes, 
    HiOutlineArrowUpCircle, 
    HiOutlineArrowDownCircle, 
    HiOutlineArrowPath,
    HiOutlinePlus
} from 'react-icons/hi2';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function HotelFinance() {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [financeData, setFinanceData] = useState<any>(null);
    const [revenues, setRevenues] = useState<any[]>([]);
    const [expenses, setExpenses] = useState<any[]>([]);

    const loadFinanceData = useCallback(async () => {
        setLoading(true);
        try {
            const [summary, revs, exps] = await Promise.all([
                hospitalityAPI.getFinanceDashboard(),
                hospitalityAPI.getRevenues({ limit: 10 }),
                hospitalityAPI.getExpenses({ limit: 10 })
            ]);
            setFinanceData(summary);
            setRevenues(revs.data || []);
            setExpenses(exps.data || []);
        } catch (err) {
            console.error('Error loading finance data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadFinanceData();
    }, [loadFinanceData]);

    if (loading && !financeData) {
        return (
            <div className="flex items-center justify-center py-20">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title={t('hotel_module.finance.title')}
                subtitle={t('hotel_module.finance.revenue')}
                icon={<HiOutlineBanknotes />}
                actions={
                    <div className="flex gap-2">
                         <Button
                            variant="outline"
                            leftIcon={<HiOutlineArrowPath className="w-4 h-4" />}
                            onClick={loadFinanceData}
                        >
                            {t('common.refresh')}
                        </Button>
                        <Button
                            variant="primary"
                            leftIcon={<HiOutlinePlus className="w-4 h-4" />}
                        >
                            Nova Despesa
                        </Button>
                    </div>
                }
            />

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6 border-l-4 border-l-green-500">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-xl">
                            <HiOutlineArrowUpCircle className="w-8 h-8" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">{t('hotel_module.finance.revenue')}</p>
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white">
                                {formatCurrency(financeData?.totalRevenue || 0)}
                            </h3>
                        </div>
                    </div>
                </Card>

                <Card className="p-6 border-l-4 border-l-red-500">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl">
                            <HiOutlineArrowDownCircle className="w-8 h-8" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Despesas</p>
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white">
                                {formatCurrency(financeData?.totalExpenses || 0)}
                            </h3>
                        </div>
                    </div>
                </Card>

                <Card className="p-6 border-l-4 border-l-primary-500">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary-50 dark:bg-primary-900/20 text-primary-600 rounded-xl">
                            <HiOutlineBanknotes className="w-8 h-8" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Lucro Estimado</p>
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white">
                                {formatCurrency((financeData?.totalRevenue || 0) - (financeData?.totalExpenses || 0))}
                            </h3>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Chart Area */}
            <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight">Evolução Financeira</h3>
                </div>
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={financeData?.chartData || []}>
                            <defs>
                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                            <XAxis 
                                dataKey="date" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 12, fill: '#6B7280' }}
                            />
                            <YAxis 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 12, fill: '#6B7280' }}
                                tickFormatter={(value) => `${value/1000}k`}
                            />
                            <Tooltip 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                            />
                            <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Revenues */}
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight px-1">Receitas Recentes</h3>
                    <TableContainer
                        isLoading={false}
                        isEmpty={revenues.length === 0}
                    >
                        <Card padding="none" className="overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50/50 dark:bg-dark-800/50 border-b border-gray-100 dark:border-dark-700">
                                    <tr>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Hóspede</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                                    {revenues.slice(0, 5).map((rev) => (
                                        <tr key={rev.id}>
                                            <td className="px-4 py-3">
                                                <p className="text-sm font-bold text-gray-900 dark:text-white">{rev.customerName}</p>
                                                <p className="text-[10px] text-gray-500 uppercase">{formatDate(rev.date)}</p>
                                            </td>
                                            <td className="px-4 py-3 text-right font-black text-green-600">
                                                {formatCurrency(rev.amount)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Card>
                    </TableContainer>
                </div>

                 {/* Recent Expenses */}
                 <div className="space-y-4">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight px-1">Despesas Recentes</h3>
                    <TableContainer
                        isLoading={false}
                        isEmpty={expenses.length === 0}
                    >
                        <Card padding="none" className="overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50/50 dark:bg-dark-800/50 border-b border-gray-100 dark:border-dark-700">
                                    <tr>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Descrição</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                                    {expenses.slice(0, 5).map((exp) => (
                                        <tr key={exp.id}>
                                            <td className="px-4 py-3">
                                                <p className="text-sm font-bold text-gray-900 dark:text-white">{exp.description}</p>
                                                <Badge size="sm" variant="outline">{exp.category}</Badge>
                                            </td>
                                            <td className="px-4 py-3 text-right font-black text-red-600">
                                                -{formatCurrency(exp.amount)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Card>
                    </TableContainer>
                </div>
            </div>
        </div>
    );
}
