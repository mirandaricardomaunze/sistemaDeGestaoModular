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
    HiOutlineDocumentChartBar as HiOutlineDocumentChartBar, HiOutlineArrowDownTray as HiOutlineArrowDownTray, HiOutlineArrowTrendingUp as HiOutlineArrowTrendingUp,
    HiOutlineCurrencyDollar, HiOutlineCube, HiOutlinePrinter,
    HiOutlineChartBar, HiOutlineTableCells as HiOutlineTableCells, HiOutlineUsers, HiOutlineTruck,
    HiOutlineExclamationCircle,
} from 'react-icons/hi2';
import { Card, Button, LoadingSpinner, TableContainer, PageHeader } from '../../components/ui';
import { MetricCard } from '../../components/common/ModuleMetricCard';
import Pagination from '../../components/ui/Pagination';
import { formatCurrency, formatDate, cn } from '../../utils/helpers';
import { useStore } from '../../stores/useStore';
import { generatePharmacySalesReport, generatePharmacyStockReport } from '../../utils/documentGenerator';
import toast from 'react-hot-toast';

type ReportType = 'sales' | 'stock' | 'profitability' | 'top-customers' | 'suppliers';

// API response row shapes (only fields read by this view)
type SaleRow = {
    id: string;
    saleNumber?: string;
    receiptNumber?: string;
    createdAt: string;
    customerName?: string;
    customer?: { name?: string };
    paymentMethod?: string;
    total?: number | string;
    cost?: number | string;
    profit?: number | string;
    margin?: number;
};

type MedicationRow = {
    id: string;
    code?: string;
    name?: string;
    totalStock: number;
    totalValue?: number;
    isLowStock?: boolean;
    daysToExpiry: number | null;
    minimumStock?: number;
    product?: { name?: string; minStock?: number };
    category?: { name?: string };
};

type TopCustomerRow = {
    customerId?: string;
    customerName?: string;
    name?: string;
    totalSpent: number;
    visitCount?: number;
    transactions: number;
    lastPurchase?: string;
};

type SupplierRow = {
    supplier: string;
    name?: string;
    totalBatches: number;
    totalUnits: number;
    totalCost: number;
    medicationCount: number;
    totalPurchases?: number;
    orderCount?: number;
    lastOrder?: string;
};

type PaymentMethodAgg = {
    paymentMethod?: string;
    _sum?: { total?: number | string };
};

type ReportSummary = {
    totalRevenue?: number;
    totalProfit?: number;
    margin?: number;
    avgTicket?: number;
    totalProducts?: number;
    totalValue?: number;
    lowStockCount?: number;
    totalCost?: number;
    byPaymentMethod?: PaymentMethodAgg[];
};

type ReportPagination = { total: number; page: number; limit: number; totalPages: number };

const REPORT_OPTIONS = [
    { value: 'sales', label: 'Vendas', icon: HiOutlineCurrencyDollar },
    { value: 'profitability', label: 'Lucratividade', icon: HiOutlineArrowTrendingUp },
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
        sales: SaleRow[];
        medications: MedicationRow[];
        customers: TopCustomerRow[];
        suppliers: SupplierRow[];
        summary?: ReportSummary;
        pagination?: ReportPagination;
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
        } catch (error) {
            toast.error('Erro ao gerar relatório: ' + ((error as Error).message || 'Erro desconhecido'));
        } finally {
            setIsGenerating(false);
        }
    };

    // -------------------------------------------------------------------------
    // Computed chart data
    // -------------------------------------------------------------------------

    const dailySalesData = useMemo(() => {
        const map: Record<string, { date: string; revenue: number; profit: number; transactions: number }> = {};
        reportData.sales.forEach((s) => {
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
        return reportData.summary.byPaymentMethod.map((p: PaymentMethodAgg) => ({
            name: p.paymentMethod?.toUpperCase() || 'Outro',
            value: Number(p._sum?.total || 0)
        }));
    }, [reportData.summary]);

    const stockDistribution = useMemo(() => {
        let normal = 0, low = 0, critical = 0, expired = 0;
        reportData.medications.forEach((m) => {
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

    const handleExport = (type: 'pdf' | 'excel' | 'print') => {
        if (!isReportGenerated) { toast.error('Gere o relatório antes de exportar!'); return; }
        const periodLabel = `${period.start || 'Início'} a ${period.end || 'Fim'}`;
        if (type === 'pdf' || type === 'print') {
            const action = type === 'print' ? 'print' : 'save';
            if (reportType === 'sales' || reportType === 'profitability') {
                generatePharmacySalesReport(reportData.sales, periodLabel, {
                    name: companySettings.companyName,
                    companyName: companySettings.companyName,
                    address: companySettings.address,
                    phone: companySettings.phone,
                    email: companySettings.email,
                    logo: companySettings.logo,
                    nuit: companySettings.taxId,
                    taxId: companySettings.taxId
                }, action);
            } else if (reportType === 'stock') {
                generatePharmacyStockReport(
                    {
                        items: reportData.medications as unknown as Record<string, unknown>[],
                        summary: {
                            totalProducts: reportData.summary?.totalProducts ?? 0,
                            totalStock: reportData.medications.reduce((acc, m) => acc + (m.totalStock ?? 0), 0),
                            lowStockCount: reportData.summary?.lowStockCount ?? 0,
                            totalValue: reportData.summary?.totalValue ?? 0,
                            totalCost: reportData.summary?.totalCost ?? 0,
                        }
                    },
                    {
                        name: companySettings.companyName,
                        companyName: companySettings.companyName,
                        address: companySettings.address,
                        phone: companySettings.phone,
                        email: companySettings.email,
                        logo: companySettings.logo,
                        nuit: companySettings.taxId,
                        taxId: companySettings.taxId
                    },
                    action
                );
            }
            toast.success(type === 'print' ? 'A preparar impressão...' : 'PDF gerado!');
        } else {
            // CSV export
            let rows: string[][] = [];
            let filename = 'relatorio';
            if (reportType === 'sales' || reportType === 'profitability') {
                filename = `vendas_${period.start || 'inicio'}_${period.end || 'fim'}`;
                rows = [
                    ['Nº Recibo', 'Data', 'Cliente', 'Método Pagamento', 'Total', 'Lucro'],
                    ...reportData.sales.map((s) => [
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
                    ...reportData.medications.map((m) => [
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
                    ...reportData.customers.map((c) => [
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
                    ...reportData.suppliers.map((s) => [
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
                    icon={<HiOutlineDocumentChartBar />}
                    className="mb-4"
                    actions={
                        <>
                            <Button variant="ghost" className="bg-gray-50/50 dark:bg-dark-700 text-gray-500 hover:text-teal-600 font-black text-[10px] uppercase tracking-widest" size="sm" leftIcon={<HiOutlinePrinter className="w-4 h-4" />} onClick={() => handleExport('print')}>Imprimir</Button>
                            <Button variant="ghost" className="bg-emerald-50/50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-500/20 shadow-sm font-black text-[10px] uppercase tracking-widest" size="sm" leftIcon={<HiOutlineArrowDownTray className="w-4 h-4" />} onClick={() => handleExport('excel')}>Excel</Button>
                            <Button variant="primary" className="bg-teal-500 hover:bg-teal-600 shadow-lg shadow-teal-500/20 font-black text-[10px] uppercase tracking-widest" size="sm" leftIcon={<HiOutlineArrowDownTray className="w-4 h-4" />} onClick={() => handleExport('pdf')}>PDF</Button>
                        </>
                    }
                />
            </div>

            {/* Filters */}
            <Card className="p-4 print:hidden">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Period */}
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-dark-700/50 p-1.5 rounded-lg border border-gray-100 dark:border-dark-600 overflow-x-auto w-full lg:w-auto">
                        <input type="date" value={period.start} onChange={e => setPeriod({ ...period, start: e.target.value })} className="min-w-[120px] py-1.5 border-none bg-transparent shadow-none focus:ring-0 text-sm" />
                        <span className="text-[10px] font-black uppercase tracking-tighter text-gray-400 px-1">até</span>
                        <input type="date" value={period.end} onChange={e => setPeriod({ ...period, end: e.target.value })} className="min-w-[120px] py-1.5 border-none bg-transparent shadow-none focus:ring-0 text-sm" />
                    </div>

                    {/* Report type selector */}
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full lg:w-auto lg:flex-1">
                        {REPORT_OPTIONS.map(opt => {
                            const Icon = opt.icon;
                            return (
                                <Button variant="ghost"
                                    size="sm"
                                    key={opt.value}
                                    onClick={() => { setReportType(opt.value as ReportType); setIsReportGenerated(false); }}
                                    className={cn(
                                        'flex-1 items-center justify-center sm:justify-start gap-1.5 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm',
                                        reportType === opt.value
                                            ? 'bg-teal-500 text-white border-teal-500 shadow-teal-500/20 scale-105'
                                            : 'bg-white dark:bg-dark-800 text-gray-500 dark:text-gray-400 border-gray-100 dark:border-dark-700 hover:border-teal-400'
                                    )}
                                >
                                    <Icon className="w-4 h-4 shrink-0" />
                                    <span className="truncate">{opt.label}</span>
                                </Button>
                            );
                        })}
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-2 w-full lg:w-auto mt-2 lg:mt-0">
                        <div className="flex items-center gap-1 bg-gray-100 dark:bg-dark-700 rounded-lg p-1">
                            <Button variant="ghost" size="sm" onClick={() => setViewMode('charts')} className={cn('p-2 aspect-square rounded-md flex items-center justify-center', viewMode === 'charts' ? 'bg-white dark:bg-dark-600 shadow' : 'hover:bg-gray-200')}>
                                <HiOutlineChartBar className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setViewMode('table')} className={cn('p-2 aspect-square rounded-md flex items-center justify-center', viewMode === 'table' ? 'bg-white dark:bg-dark-600 shadow' : 'hover:bg-gray-200')}>
                                <HiOutlineTableCells className="w-4 h-4" />
                            </Button>
                        </div>

                        <Button variant="primary" size="sm" className="px-6 flex-1 lg:flex-none h-full" onClick={() => handleGenerateReport(1)} disabled={isGenerating}>
                            {isGenerating ? <><LoadingSpinner size="sm" /> A gerar...</> : 'Gerar Relatório'}
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Empty state */}
            {!isReportGenerated && !isGenerating && (
                <Card className="p-12 text-center">
                    <HiOutlineDocumentChartBar className="w-16 h-16 mx-auto text-gray-300 mb-4" />
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
                        <MetricCard
                            label="Receita Total"
                            value={summary.totalRevenue}
                            icon={<HiOutlineCurrencyDollar className="w-5 h-5" />}
                            color="teal"
                            isCurrency
                        />
                        <MetricCard
                            label="Lucro Bruto"
                            value={summary.totalProfit}
                            icon={<HiOutlineArrowTrendingUp className="w-5 h-5" />}
                            color="emerald"
                            isCurrency
                        />
                        <MetricCard
                            label="Margem Média"
                            value={`${(summary.margin || 0).toFixed(1)}%`}
                            icon={<HiOutlineChartBar className="w-5 h-5" />}
                            color="blue"
                        />
                        <MetricCard
                            label="Ticket Médio"
                            value={summary.avgTicket}
                            icon={<HiOutlineTableCells className="w-5 h-5" />}
                            color="purple"
                            isCurrency
                        />
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
                                        <Tooltip formatter={(v) => formatCurrency(Number(v))} />
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
                                            {paymentMethodData.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </Card>

                            {/* Daily transactions bar */}
                            <Card className="p-6 lg:col-span-2">
                                <h3 className="font-bold mb-4">Transações por Dia</h3>
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={dailySalesData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 11 }} />
                                        <Tooltip />
                                        <Bar dataKey="transactions" name="Transações" fill="#3b82f6" radius={[4, 4, 0, 0]} />
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
                                        {reportData.sales.map((s) => (
                                            <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-dark-700">
                                                <td className="px-4 py-3 text-sm font-mono">{s.saleNumber}</td>
                                                <td className="px-4 py-3 text-sm">{formatDate(s.createdAt)}</td>
                                                <td className="px-4 py-3 text-sm">{s.customerName || ''}</td>
                                                <td className="px-4 py-3 text-sm uppercase">{s.paymentMethod}</td>
                                                <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(Number(s.total ?? 0))}</td>
                                                <td className="px-4 py-3 text-sm text-right text-gray-500">{formatCurrency(Number(s.cost ?? 0))}</td>
                                                <td className="px-4 py-3 text-sm text-right text-emerald-600 font-medium">{formatCurrency(Number(s.profit ?? 0))}</td>
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
                                    <Pagination currentPage={page} totalItems={reportData.pagination.total} itemsPerPage={limit} onPageChange={(p: number) => handleGenerateReport(p)} />
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
                        <MetricCard
                            label="Total Produtos"
                            value={summary.totalProducts}
                            icon={<HiOutlineCube className="w-5 h-5" />}
                            color="blue"
                        />
                        <MetricCard
                            label="Valor em Stock"
                            value={summary.totalValue}
                            icon={<HiOutlineCurrencyDollar className="w-5 h-5" />}
                            color="teal"
                            isCurrency
                        />
                        <MetricCard
                            label="Stock Baixo"
                            value={summary.lowStockCount}
                            icon={<HiOutlineExclamationCircle className="w-5 h-5" />}
                            color="orange"
                        />
                        <MetricCard
                            label="Custo Total"
                            value={summary.totalCost}
                            icon={<HiOutlineArrowTrendingUp className="w-5 h-5" />}
                            color="emerald"
                            isCurrency
                        />
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
                                    <BarChart data={[...reportData.medications].sort((a, b) => (b.totalValue ?? 0) - (a.totalValue ?? 0)).slice(0, 10)} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 10 }} />
                                        <YAxis type="category" dataKey="product.name" width={120} tick={{ fontSize: 10 }} />
                                        <Tooltip formatter={(v) => formatCurrency(Number(v))} />
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
                                        {reportData.medications.map((m) => (
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
                        <MetricCard
                            label="Clientes Únicos"
                            value={reportData.customers.length}
                            icon={<HiOutlineUsers className="w-6 h-6" />}
                            color="blue"
                        />
                        <MetricCard
                            label="Top Cliente"
                            value={reportData.customers[0]?.customerName || '-'}
                            icon={<HiOutlineUsers className="w-6 h-6" />}
                            color="teal"
                        />
                        <MetricCard
                            label="Total Top 20"
                            value={reportData.customers.reduce((s, c) => s + c.totalSpent, 0)}
                            icon={<HiOutlineCurrencyDollar className="w-6 h-6" />}
                            color="emerald"
                            isCurrency
                        />
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
                                        <Tooltip formatter={(v) => formatCurrency(Number(v))} />
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
                                        <th className="px-4 py-3 text-right">Transações</th>
                                        <th className="px-4 py-3 text-right">Total Gasto</th>
                                        <th className="px-4 py-3 text-right">Ticket Médio</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-dark-700">
                                    {reportData.customers.map((c, idx: number) => (
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
                        <MetricCard
                            label="Total Fornecedores"
                            value={reportData.suppliers.length}
                            icon={<HiOutlineTruck className="w-6 h-6" />}
                            color="indigo"
                        />
                        <MetricCard
                            label="Total Unidades"
                            value={reportData.suppliers.reduce((s, x) => s + x.totalUnits, 0)}
                            icon={<HiOutlineCube className="w-6 h-6" />}
                            color="teal"
                        />
                        <MetricCard
                            label="Total Custo Compras"
                            value={reportData.suppliers.reduce((s, x) => s + x.totalCost, 0)}
                            icon={<HiOutlineCurrencyDollar className="w-6 h-6" />}
                            color="orange"
                            isCurrency
                        />
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
                                        <Tooltip formatter={(v) => formatCurrency(Number(v))} />
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
                                    {reportData.suppliers.map((s, idx: number) => (
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
