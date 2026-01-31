import { useEffect, useState } from 'react';
import { Card, Button } from '../../components/ui';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { HiOutlineDocumentDownload } from 'react-icons/hi';
import { format, parseISO } from 'date-fns';
import { bottleStoreAPI, exportAPI } from '../../services/api';
import { logger } from '../../utils';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/helpers';
import { useStore } from '../../stores/useStore';
import Pagination, { usePagination } from '../../components/ui/Pagination';
import toast from 'react-hot-toast';

export default function BottleStoreReports() {
    type ReportPeriod = 'today' | 'week' | 'month' | 'year' | 'custom';
    const [period, setPeriod] = useState<ReportPeriod>('month');
    const [startDate] = useState<string>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const [endDate] = useState<string>(new Date().toISOString().split('T')[0]);

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);

    const { companySettings } = useStore();

    useEffect(() => {
        const fetchReports = async () => {
            setLoading(true);
            try {
                const params: any = {
                    period,
                    page,
                    limit
                };
                if (period === 'custom') {
                    params.startDate = startDate;
                    params.endDate = endDate;
                }
                const result = await bottleStoreAPI.getReports(params);
                setData(result);
            } catch (error) {
                logger.error('Error fetching bottle store reports:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchReports();
    }, [period, startDate, endDate, page, limit]);

    const metrics = data?.summary || { totalSales: 0, totalTax: 0, avgTicket: 0, transactionCount: 0, totalItems: 0, totalProfit: 0 };
    const topProducts = (data?.topProducts || []) as { name: string; quantity: number; revenue: number; code?: string; total?: number }[];
    const salesList = data?.sales || [];
    const totalSalesItems = data?.pagination?.total || 0;

    // Process chart data from sales list
    const dailySalesData = (() => {
        // ... same logic for chart ...
        const dailyMap = new Map<string, { date: string; total: number; count: number }>();
        salesList.forEach((sale: any) => {
            const date = format(parseISO(sale.createdAt), 'dd/MM');
            const existing = dailyMap.get(date) || { date, total: 0, count: 0 };
            existing.total += Number(sale.total || 0);
            existing.count += 1;
            dailyMap.set(date, existing);
        });
        return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
    })();

    const topProductsPagination = usePagination(topProducts, 5);

    // Unified Export Handler (Backend-driven)
    const handleExport = async (type: 'pdf' | 'excel') => {
        // ... export logic ...
        const periodLabel = period === 'custom'
            ? `${formatDate(startDate, 'dd/MM/yyyy')} - ${formatDate(endDate, 'dd/MM/yyyy')}`
            : periodOptions.find(o => o.value === period)?.label || period;

        const columns = [
            { header: 'Item/Venda', key: 'name', width: 200 },
            { header: 'Qtd/Info', key: 'info', width: 100 },
            { header: 'Valor/Total', key: 'value', width: 120 }
        ];

        // Combine Top Products and Sales for a comprehensive report
        const dataRows = [
            { name: '--- PRODUTOS MAIS VENDIDOS ---', info: '', value: '' },
            ...topProducts.map(p => ({
                name: p.name,
                info: p.quantity.toString(),
                value: formatCurrency(p.revenue)
            })),
            { name: '', info: '', value: '' },
            { name: '--- ÚLTIMAS VENDAS ---', info: '', value: '' },
            ...salesList.map((s: any) => ({
                name: s.saleNumber || '#' + s.id?.slice(-6),
                info: format(parseISO(s.createdAt), 'dd/MM HH:mm'),
                value: formatCurrency(s.total)
            }))
        ];

        await exportAPI.export({
            type,
            title: 'GARRAFEIRA: Relatório de Vendas',
            subtitle: `Período: ${periodLabel} | Total: ${formatCurrency(metrics.totalSales)}`,
            columns,
            data: dataRows,
            filename: `Relatorio_Garrafeira_${new Date().getTime()}`
        });

        toast.success(`Relatório ${type.toUpperCase()} gerado com sucesso!`);
    };

    const handleExportPDF = () => handleExport('pdf');
    const handleExportExcel = () => handleExport('excel');

    const periodOptions = [
        { value: 'today', label: 'Hoje' },
        { value: 'week', label: 'Semana' },
        { value: 'month', label: 'Mês' },
        { value: 'year', label: 'Ano' },
        { value: 'custom', label: 'Personalizado' },
    ];

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 p-4 pb-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold dark:text-white">Relatórios</h2>
                    <p className="text-gray-500">Análise de vendas e produtos</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleExportExcel} leftIcon={<HiOutlineDocumentDownload className="w-4 h-4" />}>Gerar XLSX</Button>
                    <Button onClick={handleExportPDF} leftIcon={<HiOutlineDocumentDownload className="w-4 h-4" />}>PDF Profissional</Button>
                </div>
            </div>

            <Card padding="md">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex bg-gray-100 dark:bg-dark-900 p-1 rounded-lg">
                        {periodOptions.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => {
                                    setPeriod(opt.value as any);
                                    setPage(1);
                                }}
                                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${period === opt.value ? 'bg-white dark:bg-dark-700 text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-blue-600 text-white p-4">
                    <p className="text-xs uppercase font-bold opacity-80">Total Vendas</p>
                    <p className="text-2xl font-bold">{formatCurrency(metrics.totalSales)}</p>
                </Card>
                <Card className="bg-green-600 text-white p-4">
                    <p className="text-xs uppercase font-bold opacity-80">IVA (16%)</p>
                    <p className="text-2xl font-bold">{formatCurrency(metrics.totalTax)}</p>
                </Card>
                <Card className="bg-purple-600 text-white p-4">
                    <p className="text-xs uppercase font-bold opacity-80">Transações</p>
                    <p className="text-2xl font-bold">{metrics.transactionCount}</p>
                </Card>
                <Card className="bg-amber-600 text-white p-4">
                    <p className="text-xs uppercase font-bold opacity-80">Ticket Médio</p>
                    <p className="text-2xl font-bold">{formatCurrency(metrics.avgTicket)}</p>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card padding="md">
                    <h3 className="text-lg font-bold mb-4">Evolução de Vendas</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={dailySalesData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" />
                                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                <Tooltip />
                                <Area type="monotone" dataKey="total" stroke="#6366f1" fill="#6366f1" fillOpacity={0.1} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
                <Card padding="md">
                    <h3 className="text-lg font-bold mb-4">Produtos Mais Vendidos</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b dark:border-dark-700">
                                    <th className="text-left py-3 text-gray-500 uppercase text-[10px] font-bold">Produto</th>
                                    <th className="text-right py-3 text-gray-500 uppercase text-[10px] font-bold">Qtd</th>
                                    <th className="text-right py-3 text-gray-500 uppercase text-[10px] font-bold">Receita</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                                {topProductsPagination.paginatedItems.map((p, i) => (
                                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors">
                                        <td className="py-3 font-medium text-gray-900 dark:text-white">{p.name}</td>
                                        <td className="text-right py-3 text-gray-600 dark:text-gray-400">{p.quantity}</td>
                                        <td className="text-right py-3 font-bold text-gray-900 dark:text-white">{formatCurrency(p.revenue)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div >

            {/* Recent Sales Table */}
            < Card padding="none" >
                <div className="p-4 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
                    <h3 className="text-lg font-bold">Listagem de Vendas</h3>
                    <div className="text-xs text-gray-500">
                        {totalSalesItems} transações encontradas
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 dark:bg-dark-900/50 uppercase text-xs font-bold text-gray-500 dark:text-gray-400">
                            <tr>
                                <th className="px-6 py-4">Nº Venda</th>
                                <th className="px-6 py-4">Data/Hora</th>
                                <th className="px-6 py-4">Cliente</th>
                                <th className="px-6 py-4 text-right">IVA (16%)</th>
                                <th className="px-6 py-4 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                            {salesList.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                        Nenhuma venda registada no período selecionado.
                                    </td>
                                </tr>
                            ) : (
                                salesList.map((s: any) => (
                                    <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors">
                                        <td className="px-6 py-4 font-mono text-xs font-bold text-primary-600">
                                            {s.saleNumber || '#' + s.id.slice(-6)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-400">
                                            {formatDateTime(s.createdAt)}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                            {s.customer}
                                        </td>
                                        <td className="px-6 py-4 text-right text-gray-500">
                                            {formatCurrency(s.tax)}
                                        </td>
                                        <td className="px-6 py-4 text-right font-black text-gray-900 dark:text-white">
                                            {formatCurrency(s.total)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 border-t border-gray-100 dark:border-dark-700">
                    <Pagination
                        currentPage={page}
                        totalItems={totalSalesItems}
                        itemsPerPage={limit}
                        onPageChange={setPage}
                        onItemsPerPageChange={setLimit}
                    />
                </div>
            </Card >
        </div >
    );
}
