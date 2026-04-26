/**
 * Pharmacy Reports
 *
 * Relatórios avançados: Vendas, Lucratividade, Stock, Top Clientes, Fornecedores.
 */

import { useState, useMemo } from 'react';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
    HiOutlineDocumentChartBar as HiOutlineDocumentReport, HiOutlineArrowDownTray as HiOutlineDownload, HiOutlineArrowTrendingUp as HiOutlineTrendingUp,
    HiOutlineCurrencyDollar, HiOutlineCube, HiOutlinePrinter,
    HiOutlineChartBar, HiOutlineTableCells as HiOutlineTable, HiOutlineUsers, HiOutlineTruck,
} from 'react-icons/hi2';
import { Card, Button, Input, LoadingSpinner, TableContainer, PageHeader } from '../../components/ui';
import Pagination from '../../components/ui/Pagination';
import { formatCurrency, formatDate, cn } from '../../utils/helpers';
import { useStore } from '../../stores/useStore';
import { generatePharmacySalesReport, generatePharmacyStockReport } from '../../utils/documentGenerator';
import toast from 'react-hot-toast';

type ReportType = 'sales' | 'stock' | 'profitability' | 'top-customers' | 'suppliers';

const REPORT_OPTIONS = [
    { value: 'sales', label: 'Vendas', icon: HiOutlineCurrencyDollar },
    { value: 'profitability', label: 'Lucratividade', icon: HiOutlineTrendingUp },
    { value: 'stock', label: 'Stock', icon: HiOutlineCube },
    { value: 'top-customers', label: 'Top Clientes', icon: HiOutlineUsers },
    { value: 'suppliers', label: 'Fornecedores', icon: HiOutlineTruck },
];

const COLORS = ['#0d9488', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function PharmacyReports() {
    const { companySettings } = useStore();

    const [period, setPeriod] = useState({ start: '', end: '' });
    const [reportType, setReportType] = useState<ReportType>('sales');
    const [viewMode, setViewMode] = useState<'charts' | 'table'>('charts');
    const [isReportGenerated, setIsReportGenerated] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [page, setPage] = useState(1);
    const [limit] = useState(50);

    const [reportData, setReportData] = useState<{
        sales: any[];
        medications: any[];
        customers: any[];
        suppliers: any[];
        summary?: any;
        pagination?: any;
    }>({ sales: [], medications: [], customers: [], suppliers: [] });

    const handleGenerateReport = async (targetPage = 1) => {
        setIsGenerating(true);
        try {
            const { pharmacyAPI } = await import('../../services/api');

            if (reportType === 'sales' || reportType === 'profitability') {
                const response = await pharmacyAPI.getSalesReport({
                    startDate: period.start || undefined,
                    endDate: period.end || undefined,
                    page: targetPage,
                    limit
                });
                setReportData(prev => ({
                    ...prev,
                    sales: response.data || [],
                    summary: response.summary,
                    pagination: response.pagination
                }));
            } else if (reportType === 'stock') {
                const response = await pharmacyAPI.getStockReport({ page: targetPage, limit });
                setReportData(prev => ({
                    ...prev,
                    medications: response.data || [],
                    summary: response.summary,
                    pagination: response.pagination
                }));
            } else if (reportType === 'top-customers') {
                const data = await pharmacyAPI.getTopCustomersReport({
                    startDate: period.start || undefined,
                    endDate: period.end || undefined,
                    limit: 20
                });
                setReportData(prev => ({ ...prev, customers: data || [] }));
            } else if (reportType === 'suppliers') {
                const data = await pharmacyAPI.getSuppliersReport();
                setReportData(prev => ({ ...prev, suppliers: data || [] }));
            }

            setIsReportGenerated(true);
            setPage(targetPage);
            toast.success('Relatório gerado!');
        } catch (error: any) {
            toast.error('Erro ao gerar relatório: ' + (error.message || 'Erro desconhecido'));
        } finally {
            setIsGenerating(false);
        }
    };

    // -------------------------------------------------------------------------
    // Computed chart data
    // -------------------------------------------------------------------------

    const dailySalesData = useMemo(() => {
        const map: Record<string, { date: string; revenue: number; profit: number; transactions: number }> = {};
        reportData.sales.forEach((s: any) => {
            const key = formatDate(s.createdAt);
            if (!map[key]) map[key] = { date: key, revenue: 0, profit: 0, transactions: 0 };
            map[key].revenue += Number(s.total || 0);
            map[key].profit += Number(s.profit || 0);
            map[key].transactions++;
        });
        return Object.values(map).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [reportData.sales]);

    const paymentMethodData = useMemo(() => {
        if (!reportData.summary?.byPaymentMethod) return [];
        return reportData.summary.byPaymentMethod.map((p: any) => ({
            name: p.paymentMethod?.toUpperCase() || 'Outro',
            value: Number(p._sum?.total || 0)
        }));
    }, [reportData.summary]);

    const stockDistribution = useMemo(() => {
        let normal = 0, low = 0, critical = 0, expired = 0;
        reportData.medications.forEach((m: any) => {
            if (m.totalStock === 0) critical++;
            else if (m.isLowStock) low++;
            else normal++;
            if (m.daysToExpiry !== null && m.daysToExpiry <= 0) expired++;
        });
        return [
            { name: 'Normal', value: normal, color: '#22c55e' },
            { name: 'Baixo', value: low, color: '#f59e0b' },
            { name: 'Crítico', value: critical, color: '#ef4444' },
            { name: 'Expirado', value: expired, color: '#6b7280' },
        ].filter(d => d.value > 0);
    }, [reportData.medications]);

    const summary = reportData.summary || {};

    const handleExport = (type: 'pdf' | 'excel') => {
        if (!isReportGenerated) { toast.error('Gere o relatório antes de exportar!'); return; }
        const periodLabel = `${period.start || 'Início'} a ${period.end || 'Fim'}`;
        if (type === 'pdf') {
            if (reportType === 'sales' || reportType === 'profitability') {
                generatePharmacySalesReport(reportData.sales, periodLabel, companySettings);
            } else if (reportType === 'stock') {
                generatePharmacyStockReport(
                    { items: reportData.medications, summary: reportData.summary },
                    companySettings
                );
            }
            toast.success('PDF gerado!');
        } else {
            // CSV export
            let rows: string[][] = [];
            let filename = 'relatorio';
            if (reportType === 'sales' || reportType === 'profitability') {
                filename = `vendas_${period.start || 'inicio'}_${period.end || 'fim'}`;
                rows = [
                    ['Nº Recibo', 'Data', 'Cliente', 'Método Pagamento', 'Total', 'Lucro'],
                    ...reportData.sales.map((s: any) => [
                        s.receiptNumber || s.id?.slice(-8) || '',
                        s.createdAt ? s.createdAt.slice(0, 10) : '',
                        s.customer?.name || 'Balcão',
                        s.paymentMethod || '',
                        String(Number(s.total || 0).toFixed(2)),
                        String(Number(s.profit || 0).toFixed(2)),
                    ])
                ];
            } else if (reportType === 'stock') {
                filename = `stock_${new Date().toISOString().slice(0, 10)}`;
                rows = [
                    ['Código', 'Medicamento', 'Categoria', 'Stock Total', 'Stock Mínimo', 'Stock Baixo'],
                    ...reportData.medications.map((m: any) => [
                        m.code || '',
                        m.name || '',
                        m.category?.name || '',
                        String(m.totalStock ?? 0),
                        String(m.minimumStock ?? 0),
                        m.isLowStock ? 'Sim' : 'Não',
                    ])
                ];
            } else if (reportType === 'top-customers') {
                filename = `top_clientes_${new Date().toISOString().slice(0, 10)}`;
                rows = [
                    ['Cliente', 'Total Compras', 'Nº Visitas', 'Última Compra'],
                    ...reportData.customers.map((c: any) => [
                        c.name || '',
                        String(Number(c.totalSpent || 0).toFixed(2)),
                        String(c.visitCount || 0),
                        c.lastPurchase ? c.lastPurchase.slice(0, 10) : '',
                    ])
                ];
            } else if (reportType === 'suppliers') {
                filename = `fornecedores_${new Date().toISOString().slice(0, 10)}`;
                rows = [
                    ['Fornecedor', 'Total Compras', 'Nº Encomendas', 'Última Encomenda'],
                    ...reportData.suppliers.map((s: any) => [
                        s.name || '',
                        String(Number(s.totalPurchases || 0).toFixed(2)),
                        String(s.orderCount || 0),
                        s.lastOrder ? s.lastOrder.slice(0, 10) : '',
                    ])
                ];
            }
            if (rows.length > 0) {
                const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '')}"`).join(',')).join('\n');
                const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `${filename}.csv`; a.click();
                URL.revokeObjectURL(url);
                toast.success('CSV exportado!');
            } else {
                toast.error('Sem dados para exportar.');
            }
        }
    };

    return (
        <div className="space-y-6 print:space-y-4">
            {/* Header */}
            <div className="print:hidden">
                <PageHeader
                    title="Relatórios de Farmácia"
                    subtitle="Vendas, Lucratividade, Stock, Clientes e Fornecedores"
                    icon={<HiOutlineDocumentReport />}
                    className="mb-4"
                    actions={
                        <>
                            <Button variant="ghost" className="bg-gray-50/50 dark:bg-dark-700 text-gray-500 hover:text-teal-600 font-black text-[10px] uppercase tracking-widest" size="sm" leftIcon={<HiOutlinePrinter className="w-4 h-4" />} onClick={() => window.print()}>Imprimir</Button>
                            <Button variant="ghost" className="bg-emerald-50/50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-500/20 shadow-sm font-black text-[10px] uppercase tracking-widest" size="sm" leftIcon={<HiOutlineDownload className="w-4 h-4" />} onClick={() => handleExport('excel')}>Excel</Button>
                            <Button variant="primary" className="bg-teal-500 hover:bg-teal-600 shadow-lg shadow-teal-500/20 font-black text-[10px] uppercase tracking-widest" size="sm" leftIcon={<HiOutlineDownload className="w-4 h-4" />} onClick={() => handleExport('pdf')}>PDF</Button>
                        </>
                    }
                />
            </div>

            {/* Filters */}
            <Card className="p-4 print:hidden">
                <div className="flex flex-wrap items-center gap-3">
                    <Input type="date" value={period.start} onChange={e => setPeriod({ ...period, start: e.target.value })} className="w-36" />
                    <span className="text-gray-400">até</span>
                    <Input type="date" value={period.end} onChange={e => setPeriod({ ...period, end: e.target.value })} className="w-36" />

                    {/* Report type selector */}
                    <div className="flex gap-1 flex-wrap">
                        {REPORT_OPTIONS.map(opt => {
                            const Icon = opt.icon;
                            return (
                                <button
                                    key={opt.value}
                                    onClick={() => { setReportType(opt.value as ReportType); setIsReportGenerated(false); }}
                                    className={cn(
                                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm',
                                        reportType === opt.value
                                            ? 'bg-teal-500 text-white border-teal-500 shadow-teal-500/20 scale-105'
                                            : 'bg-white dark:bg-dark-800 text-gray-500 dark:text-gray-400 border-gray-100 dark:border-dark-700 hover:border-teal-400'
                                    )}
                                >
                                    <Icon className="w-4 h-4" />
                                    {opt.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* View toggle */}
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-dark-700 rounded-lg p-1 ml-auto">
                        <button onClick={() => setViewMode('charts')} className={cn('p-2 rounded-md', viewMode === 'charts' ? 'bg-white dark:bg-dark-600 shadow' : 'hover:bg-gray-200')}>
                            <HiOutlineChartBar className="w-4 h-4" />
                        </button>
                        <button onClick={() => setViewMode('table')} className={cn('p-2 rounded-md', viewMode === 'table' ? 'bg-white dark:bg-dark-600 shadow' : 'hover:bg-gray-200')}>
                            <HiOutlineTable className="w-4 h-4" />
                        </button>
                    </div>

                    <Button variant="primary" onClick={() => handleGenerateReport(1)} disabled={isGenerating}>
                        {isGenerating ? <><LoadingSpinner size="sm" /> A gerar...</> : 'Gerar Relatório'}
                    </Button>
                </div>
            </Card>

            {/* Empty state */}
            {!isReportGenerated && !isGenerating && (
                <Card className="p-12 text-center">
                    <HiOutlineDocumentReport className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-bold mb-2 text-gray-700 dark:text-gray-300">Selecione o tipo de relatório e clique em Gerar</h3>
                    <p className="text-gray-500 text-sm mb-6">Vendas, Lucratividade, Stock, Top Clientes ou Fornecedores</p>
                    <Button variant="primary" onClick={() => handleGenerateReport(1)}>Gerar Agora</Button>
                </Card>
            )}

            {/* ================================================================
                SALES / PROFITABILITY
                ================================================================ */}
            {isReportGenerated && (reportType === 'sales' || reportType === 'profitability') && (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card padding="md" className="bg-teal-100/40 dark:bg-teal-900/20 border border-teal-200/50 dark:border-teal-800/30 shadow-card-strong transition-all hover:scale-[1.02] overflow-hidden group">
                            <div className="flex items-center gap-4 relative z-10">
                                <div className="w-10 h-10 rounded-xl bg-teal-200/60 dark:bg-teal-900/40 border border-teal-500/20 flex items-center justify-center text-teal-700 dark:text-teal-300 font-black shadow-inner group-hover:scale-110 transition-transform">
                                    <HiOutlineCurrencyDollar className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-teal-600/70 dark:text-teal-400/60">Receita Total</p>
                                    <p className="text-xl font-black text-teal-900 dark:text-white leading-none mt-1">{formatCurrency(summary.totalRevenue || 0)}</p>
                                </div>
                            </div>
                        </Card>
                        <Card padding="md" className="bg-emerald-100/40 dark:bg-emerald-900/20 border border-emerald-200/50 dark:border-emerald-800/30 shadow-card-strong transition-all hover:scale-[1.02] overflow-hidden group">
                            <div className="flex items-center gap-4 relative z-10">
                                <div className="w-10 h-10 rounded-xl bg-emerald-200/60 dark:bg-emerald-900/40 border border-emerald-500/20 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-black shadow-inner group-hover:scale-110 transition-transform">
                                    <HiOutlineTrendingUp className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600/70 dark:text-emerald-400/60">Lucro Bruto</p>
                                    <p className="text-xl font-black text-emerald-700 dark:text-white leading-none mt-1">{formatCurrency(summary.totalProfit || 0)}</p>
                                </div>
                            </div>
                        </Card>
                        <Card padding="md" className="bg-blue-100/40 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-800/30 shadow-card-strong transition-all hover:scale-[1.02] overflow-hidden group">
                            <div className="flex items-center gap-4 relative z-10">
                                <div className="w-10 h-10 rounded-xl bg-blue-200/60 dark:bg-blue-900/40 border border-blue-500/20 flex items-center justify-center text-blue-700 dark:text-blue-300 font-black shadow-inner group-hover:scale-110 transition-transform">
                                    <HiOutlineChartBar className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-600/70 dark:text-blue-400/60">Margem Média</p>
                                    <p className="text-xl font-black text-blue-900 dark:text-white leading-none mt-1">{(summary.margin || 0).toFixed(1)}%</p>
                                </div>
                            </div>
                        </Card>
                        <Card padding="md" className="bg-purple-100/40 dark:bg-purple-900/20 border border-purple-200/50 dark:border-purple-800/30 shadow-card-strong transition-all hover:scale-[1.02] overflow-hidden group">
                            <div className="flex items-center gap-4 relative z-10">
                                <div className="w-10 h-10 rounded-xl bg-purple-200/60 dark:bg-purple-900/40 border border-purple-500/20 flex items-center justify-center text-purple-700 dark:text-purple-300 font-black shadow-inner group-hover:scale-110 transition-transform">
                                    <HiOutlineTable className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-purple-600/70 dark:text-purple-400/60">Ticket Médio</p>
                                    <p className="text-xl font-black text-purple-900 dark:text-white leading-none mt-1">{formatCurrency(summary.avgTicket || 0)}</p>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {viewMode === 'charts' ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Revenue & Profit trend */}
                            <Card className="p-6">
                                <h3 className="font-bold mb-4">Receita vs Lucro (por dia)</h3>
                                <ResponsiveContainer width="100%" height={280}>
                                    <AreaChart data={dailySalesData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 11 }} />
                                        <Tooltip formatter={(v: any) => formatCurrency(v)} />
                                        <Legend />
                                        <Area type="monotone" dataKey="revenue" name="Receita" stroke="#0d9488" fill="#0d9488" fillOpacity={0.1} />
                                        <Area type="monotone" dataKey="profit" name="Lucro" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </Card>

                            {/* Payment methods */}
                            <Card className="p-6">
                                <h3 className="font-bold mb-4">Por Método de Pagamento</h3>
                                <ResponsiveContainer width="100%" height={280}>
                                    <PieChart>
                                        <Pie data={paymentMethodData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                                            {paymentMethodData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip formatter={(v: any) => formatCurrency(v)} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </Card>

                            {/* Daily transactions bar */}
                            <Card className="p-6 lg:col-span-2">
                                <h3 className="font-bold mb-4">Transaces por Dia</h3>
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={dailySalesData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 11 }} />
                                        <Tooltip />
                                        <Bar dataKey="transactions" name="Transaces" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </Card>
                        </div>
                    ) : (
                        <Card className="p-0 overflow-hidden">
                            <TableContainer isLoading={isGenerating} isEmpty={reportData.sales.length === 0}>
                                <table className="w-full">
                                    <thead className="bg-gray-50 dark:bg-dark-700">
                                        <tr className="text-xs text-gray-500 uppercase">
                                            <th className="px-4 py-3 text-left">Nº Venda</th>
                                            <th className="px-4 py-3 text-left">Data</th>
                                            <th className="px-4 py-3 text-left">Cliente</th>
                                            <th className="px-4 py-3 text-left">Pagamento</th>
                                            <th className="px-4 py-3 text-right">Receita</th>
                                            <th className="px-4 py-3 text-right">Custo</th>
                                            <th className="px-4 py-3 text-right">Lucro</th>
                                            <th className="px-4 py-3 text-right">Margem</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-dark-700">
                                        {reportData.sales.map((s: any) => (
                                            <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-dark-700">
                                                <td className="px-4 py-3 text-sm font-mono">{s.saleNumber}</td>
                                                <td className="px-4 py-3 text-sm">{formatDate(s.createdAt)}</td>
                                                <td className="px-4 py-3 text-sm">{s.customerName || ''}</td>
                                                <td className="px-4 py-3 text-sm uppercase">{s.paymentMethod}</td>
                                                <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(s.total)}</td>
                                                <td className="px-4 py-3 text-sm text-right text-gray-500">{formatCurrency(s.cost || 0)}</td>
                                                <td className="px-4 py-3 text-sm text-right text-emerald-600 font-medium">{formatCurrency(s.profit || 0)}</td>
                                                <td className="px-4 py-3 text-sm text-right">
                                                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-bold', (s.margin || 0) >= 20 ? 'bg-green-100 text-green-700' : (s.margin || 0) >= 10 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700')}>
                                                        {(s.margin || 0).toFixed(1)}%
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </TableContainer>
                            {reportData.pagination && (
                                <div className="p-4 border-t dark:border-dark-700">
                                    <Pagination currentPage={page} totalItems={reportData.pagination.total} itemsPerPage={limit} onPageChange={p => handleGenerateReport(p)} />
                                </div>
                            )}
                        </Card>
                    )}
                </>
            )}

            {/* ================================================================
                STOCK
                ================================================================ */}
            {isReportGenerated && reportType === 'stock' && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="p-5 border-l-4 border-blue-500">
                            <p className="text-xs font-bold uppercase text-blue-600">Total Produtos</p>
                            <p className="text-2xl font-black">{summary.totalProducts || 0}</p>
                        </Card>
                        <Card className="p-5 border-l-4 border-teal-500">
                            <p className="text-xs font-bold uppercase text-teal-600">Valor em Stock</p>
                            <p className="text-2xl font-black">{formatCurrency(summary.totalValue || 0)}</p>
                        </Card>
                        <Card className="p-5 border-l-4 border-orange-500">
                            <p className="text-xs font-bold uppercase text-orange-600">Stock Baixo</p>
                            <p className="text-2xl font-black">{summary.lowStockCount || 0}</p>
                        </Card>
                        <Card className="p-5 border-l-4 border-emerald-500">
                            <p className="text-xs font-bold uppercase text-emerald-600">Custo Total</p>
                            <p className="text-2xl font-black">{formatCurrency(summary.totalCost || 0)}</p>
                        </Card>
                    </div>

                    {viewMode === 'charts' ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card className="p-6">
                                <h3 className="font-bold mb-4">Distribuição de Stock</h3>
                                <ResponsiveContainer width="100%" height={280}>
                                    <PieChart>
                                        <Pie data={stockDistribution} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                                            {stockDistribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </Card>
                            <Card className="p-6">
                                <h3 className="font-bold mb-4">Top 10 por Valor em Stock</h3>
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={[...reportData.medications].sort((a: any, b: any) => b.totalValue - a.totalValue).slice(0, 10)} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 10 }} />
                                        <YAxis type="category" dataKey="product.name" width={120} tick={{ fontSize: 10 }} />
                                        <Tooltip formatter={(v: any) => formatCurrency(v)} />
                                        <Bar dataKey="totalValue" name="Valor" fill="#0d9488" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </Card>
                        </div>
                    ) : (
                        <Card className="p-0 overflow-hidden">
                            <TableContainer isLoading={isGenerating} isEmpty={reportData.medications.length === 0}>
                                <table className="w-full">
                                    <thead className="bg-gray-50 dark:bg-dark-700">
                                        <tr className="text-xs text-gray-500 uppercase">
                                            <th className="px-4 py-3 text-left">Medicamento</th>
                                            <th className="px-4 py-3 text-right">Stock</th>
                                            <th className="px-4 py-3 text-right">Mín.</th>
                                            <th className="px-4 py-3 text-right">Valor</th>
                                            <th className="px-4 py-3 text-right">Validade</th>
                                            <th className="px-4 py-3 text-center">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-dark-700">
                                        {reportData.medications.map((m: any) => (
                                            <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-dark-700">
                                                <td className="px-4 py-3 text-sm font-medium">{m.product?.name}</td>
                                                <td className="px-4 py-3 text-sm text-right">{m.totalStock}</td>
                                                <td className="px-4 py-3 text-sm text-right text-gray-500">{m.product?.minStock || 5}</td>
                                                <td className="px-4 py-3 text-sm text-right">{formatCurrency(m.totalValue || 0)}</td>
                                                <td className="px-4 py-3 text-sm text-right">
                                                    {m.daysToExpiry !== null ? (
                                                        <span className={cn('text-xs', m.daysToExpiry <= 30 ? 'text-red-600 font-bold' : m.daysToExpiry <= 90 ? 'text-orange-500' : 'text-gray-500')}>
                                                            {m.daysToExpiry <= 0 ? 'Expirado' : `${m.daysToExpiry}d`}
                                                        </span>
                                                    ) : ''}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-bold',
                                                        m.totalStock === 0 ? 'bg-red-100 text-red-700' :
                                                        m.isLowStock ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700')}>
                                                        {m.totalStock === 0 ? 'Sem Stock' : m.isLowStock ? 'Baixo' : 'Normal'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </TableContainer>
                        </Card>
                    )}
                </>
            )}

            {/* ================================================================
                TOP CUSTOMERS
                ================================================================ */}
            {isReportGenerated && reportType === 'top-customers' && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="p-5 border-l-4 border-blue-500">
                            <p className="text-xs font-bold uppercase text-blue-600">Clientes Únicos</p>
                            <p className="text-2xl font-black">{reportData.customers.length}</p>
                        </Card>
                        <Card className="p-5 border-l-4 border-teal-500">
                            <p className="text-xs font-bold uppercase text-teal-600">Top Cliente</p>
                            <p className="text-xl font-black truncate">{reportData.customers[0]?.customerName || ''}</p>
                        </Card>
                        <Card className="p-5 border-l-4 border-emerald-500">
                            <p className="text-xs font-bold uppercase text-emerald-600">Total Top 20</p>
                            <p className="text-2xl font-black">{formatCurrency(reportData.customers.reduce((s: number, c: any) => s + c.totalSpent, 0))}</p>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {viewMode === 'charts' && (
                            <Card className="p-6">
                                <h3 className="font-bold mb-4">Top 10 Clientes por Valor</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={reportData.customers.slice(0, 10)} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 10 }} />
                                        <YAxis type="category" dataKey="customerName" width={120} tick={{ fontSize: 10 }} />
                                        <Tooltip formatter={(v: any) => formatCurrency(v)} />
                                        <Bar dataKey="totalSpent" name="Total Gasto" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </Card>
                        )}

                        <Card className={cn('p-0 overflow-hidden', viewMode === 'charts' ? '' : 'lg:col-span-2')}>
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-dark-700">
                                    <tr className="text-xs text-gray-500 uppercase">
                                        <th className="px-4 py-3 text-center">#</th>
                                        <th className="px-4 py-3 text-left">Cliente</th>
                                        <th className="px-4 py-3 text-right">Transaces</th>
                                        <th className="px-4 py-3 text-right">Total Gasto</th>
                                        <th className="px-4 py-3 text-right">Ticket Médio</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-dark-700">
                                    {reportData.customers.map((c: any, idx: number) => (
                                        <tr key={c.customerId || idx} className="hover:bg-gray-50 dark:hover:bg-dark-700">
                                            <td className="px-4 py-3 text-center">
                                                <span className={cn('w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold text-white',
                                                    idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-amber-600' : 'bg-gray-200 text-gray-600')}>
                                                    {idx + 1}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm font-medium">{c.customerName || 'Cliente Balcão'}</td>
                                            <td className="px-4 py-3 text-sm text-right">{c.transactions}</td>
                                            <td className="px-4 py-3 text-sm text-right font-bold text-teal-600">{formatCurrency(c.totalSpent)}</td>
                                            <td className="px-4 py-3 text-sm text-right text-gray-500">{formatCurrency(c.transactions > 0 ? c.totalSpent / c.transactions : 0)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Card>
                    </div>
                </>
            )}

            {/* ================================================================
                SUPPLIERS
                ================================================================ */}
            {isReportGenerated && reportType === 'suppliers' && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="p-5 border-l-4 border-indigo-500">
                            <p className="text-xs font-bold uppercase text-indigo-600">Total Fornecedores</p>
                            <p className="text-2xl font-black">{reportData.suppliers.length}</p>
                        </Card>
                        <Card className="p-5 border-l-4 border-teal-500">
                            <p className="text-xs font-bold uppercase text-teal-600">Total Unidades</p>
                            <p className="text-2xl font-black">{reportData.suppliers.reduce((s: number, x: any) => s + x.totalUnits, 0)}</p>
                        </Card>
                        <Card className="p-5 border-l-4 border-orange-500">
                            <p className="text-xs font-bold uppercase text-orange-600">Total Custo Compras</p>
                            <p className="text-2xl font-black">{formatCurrency(reportData.suppliers.reduce((s: number, x: any) => s + x.totalCost, 0))}</p>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {viewMode === 'charts' && (
                            <Card className="p-6">
                                <h3 className="font-bold mb-4">Custo por Fornecedor</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={reportData.suppliers.slice(0, 8)} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 10 }} />
                                        <YAxis type="category" dataKey="supplier" width={120} tick={{ fontSize: 10 }} />
                                        <Tooltip formatter={(v: any) => formatCurrency(v)} />
                                        <Bar dataKey="totalCost" name="Custo Total" fill="#6366f1" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </Card>
                        )}

                        <Card className={cn('p-0 overflow-hidden', viewMode === 'charts' ? '' : 'lg:col-span-2')}>
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-dark-700">
                                    <tr className="text-xs text-gray-500 uppercase">
                                        <th className="px-4 py-3 text-left">Fornecedor</th>
                                        <th className="px-4 py-3 text-right">Lotes</th>
                                        <th className="px-4 py-3 text-right">Unidades</th>
                                        <th className="px-4 py-3 text-right">Custo Total</th>
                                        <th className="px-4 py-3 text-right">Medicamentos</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-dark-700">
                                    {reportData.suppliers.map((s: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-dark-700">
                                            <td className="px-4 py-3 text-sm font-medium">{s.supplier}</td>
                                            <td className="px-4 py-3 text-sm text-right">{s.totalBatches}</td>
                                            <td className="px-4 py-3 text-sm text-right">{s.totalUnits}</td>
                                            <td className="px-4 py-3 text-sm text-right font-bold text-indigo-600">{formatCurrency(s.totalCost)}</td>
                                            <td className="px-4 py-3 text-sm text-right">{s.medicationCount}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
}
