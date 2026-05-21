import { HiOutlineArrowTrendingUp, HiOutlineArrowTrendingDown, HiOutlineCurrencyDollar, HiOutlineDocumentChartBar } from 'react-icons/hi2';
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
            <Card padding="md" className="bg-green-100/40 dark:bg-green-900/20 border border-green-200/50 dark:border-green-800/30 shadow-card-strong transition-all hover:scale-[1.02] overflow-hidden group">
                <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 rounded-xl bg-green-200/60 dark:bg-green-900/40 text-green-700 dark:text-green-300 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                        <HiOutlineArrowTrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-green-600/70 dark:text-green-400/60">Receitas Totais</p>
                        <p className="text-2xl font-black text-green-900 dark:text-white leading-none mt-1">
                            {formatCurrency(summary.totalRevenue)}
                        </p>
                    </div>
                </div>
            </Card>

            {/* Total Expenses */}
            <Card padding="md" className="bg-red-100/40 dark:bg-red-900/20 border border-red-200/50 dark:border-red-800/30 shadow-card-strong transition-all hover:scale-[1.02] overflow-hidden group">
                <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 rounded-xl bg-red-200/60 dark:bg-red-900/40 text-red-700 dark:text-red-300 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                        <HiOutlineArrowTrendingDown className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-red-600/70 dark:text-red-400/60">Despesas Totais</p>
                        <p className="text-2xl font-black text-red-900 dark:text-white leading-none mt-1">
                            {formatCurrency(summary.totalExpenses)}
                        </p>
                    </div>
                </div>
            </Card>

            {/* Net Profit */}
            <Card padding="md" className="bg-blue-100/40 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-800/30 shadow-card-strong transition-all hover:scale-[1.02] overflow-hidden group">
                <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 rounded-xl bg-blue-200/60 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                        <HiOutlineCurrencyDollar className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-600/70 dark:text-blue-400/60">Lucro Líquido</p>
                        <p className="text-2xl font-black text-blue-900 dark:text-white leading-none mt-1">
                            {formatCurrency(summary.netProfit)}
                        </p>
                    </div>
                </div>
            </Card>

            {/* Profit Margin */}
            <Card padding="md" className="bg-purple-100/40 dark:bg-purple-900/20 border border-purple-200/50 dark:border-purple-800/30 shadow-card-strong transition-all hover:scale-[1.02] overflow-hidden group">
                <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 rounded-xl bg-purple-200/60 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                        <HiOutlineDocumentChartBar className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-purple-600/70 dark:text-purple-400/60">Margem de Lucro</p>
                        <p className="text-2xl font-black text-purple-900 dark:text-white leading-none mt-1">
                            {summary.profitMargin.toFixed(1)}%
                        </p>
                    </div>
                </div>
            </Card>

            {/* Pending Expenses */}
            <Card padding="md" className="bg-yellow-100/40 dark:bg-yellow-900/20 border border-yellow-200/50 dark:border-yellow-800/30 shadow-card-strong transition-all hover:scale-[1.02] overflow-hidden group">
                <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 rounded-xl bg-yellow-200/60 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                        <HiOutlineArrowTrendingDown className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-yellow-600/70 dark:text-yellow-400/60">Pendentes</p>
                        <p className="text-2xl font-black text-yellow-900 dark:text-white leading-none mt-1">
                            {formatCurrency(pendingExpenses)}
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
}
