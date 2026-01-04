import { HiOutlineTrendingUp, HiOutlineTrendingDown, HiOutlineCurrencyDollar, HiOutlineDocumentReport } from 'react-icons/hi';
import { Card } from '../../../components/ui';
import { formatCurrency } from '../../../utils/helpers';

interface FinanceSummaryCardsProps {
    summary: {
        totalRevenue: number;
        totalExpenses: number;
        netProfit: number;
        profitMargin: number;
    };
    pendingExpenses: number;
}

export function FinanceSummaryCards({ summary, pendingExpenses }: FinanceSummaryCardsProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Total Revenue */}
            <Card padding="md" className="border-l-4 border-l-green-500">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <HiOutlineTrendingUp className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Receitas Totais</p>
                        <p className="text-2xl font-bold text-green-600">
                            {formatCurrency(summary.totalRevenue)}
                        </p>
                    </div>
                </div>
            </Card>

            {/* Total Expenses */}
            <Card padding="md" className="border-l-4 border-l-red-500">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <HiOutlineTrendingDown className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Despesas Totais</p>
                        <p className="text-2xl font-bold text-red-600">
                            {formatCurrency(summary.totalExpenses)}
                        </p>
                    </div>
                </div>
            </Card>

            {/* Net Profit */}
            <Card padding="md" className="border-l-4 border-l-blue-500">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <HiOutlineCurrencyDollar className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Lucro Líquido</p>
                        <p className="text-2xl font-bold text-blue-600">
                            {formatCurrency(summary.netProfit)}
                        </p>
                    </div>
                </div>
            </Card>

            {/* Profit Margin */}
            <Card padding="md" className="border-l-4 border-l-purple-500">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <HiOutlineDocumentReport className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Margem de Lucro</p>
                        <p className="text-2xl font-bold text-purple-600">
                            {summary.profitMargin.toFixed(1)}%
                        </p>
                    </div>
                </div>
            </Card>

            {/* Pending Expenses */}
            <Card padding="md" className="border-l-4 border-l-yellow-500">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                        <HiOutlineTrendingDown className="w-6 h-6 text-yellow-600" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Pendentes</p>
                        <p className="text-2xl font-bold text-yellow-600">
                            {formatCurrency(pendingExpenses)}
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
}
