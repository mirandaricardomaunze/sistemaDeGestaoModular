/**
 * Pharmacy Reports
 * 
 * Professional reporting page for pharmacy module with:
 * - Advanced date and category filters
 * - Interactive charts (sales trends, top medications, stock analysis)
 * - Report export (PDF, Excel)
 * - Professional print layout
 */

import { useState, useMemo } from 'react';
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
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
import {
    HiOutlineDocumentReport,
    HiOutlineDownload,
    HiOutlineCalendar,
    HiOutlineTrendingUp,
    HiOutlineCurrencyDollar,
    HiOutlineBeaker,
    HiOutlineCube,
    HiOutlineFilter,
    HiOutlinePrinter,
    HiOutlineChartBar,
    HiOutlineTable,
} from 'react-icons/hi';
import { Card, Button, Input, Select, Badge, LoadingSpinner, TableContainer } from '../../components/ui';
import { usePharmacy } from '../../hooks/usePharmacy';
import { formatCurrency, formatDate, cn } from '../../utils/helpers';
import { useStore } from '../../stores/useStore';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';


// Report types
type ReportType = 'sales' | 'stock' | 'profitability' | 'medications';

export default function PharmacyReports() {
    const { companySettings } = useStore();

    // Filters
    const [period, setPeriod] = useState({ start: '', end: '' });
    const [reportType, setReportType] = useState<ReportType>('sales');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [viewMode, setViewMode] = useState<'charts' | 'table'>('charts');

    // State for on-demand loading
    const [isReportGenerated, setIsReportGenerated] = useState(false);
    const [reportData, setReportData] = useState<{ sales: any[], medications: any[] }>({ sales: [], medications: [] });
    const [isGenerating, setIsGenerating] = useState(false);

    // Only load minimal medication data initially for stock distribution
    const { medications: initialMedications, isLoading: isMedsLoading } = usePharmacy({ limit: 100 });

    // Function to generate report with server-side filtering
    const handleGenerateReport = async () => {
        setIsGenerating(true);
        try {
            // Import the API directly
            const { pharmacyAPI } = await import('../../services/api');

            // Fetch sales with server-side date filtering
            const salesResponse = await pharmacyAPI.getSales({
                startDate: period.start || undefined,
                endDate: period.end || undefined,
                limit: 500
            });

            // Fetch medications (limited for performance)
            const medsResponse = await pharmacyAPI.getMedications({ limit: 500 });

            const salesData = Array.isArray(salesResponse) ? salesResponse : (salesResponse.data || []);
            const medsData = medsResponse.data || [];

            setReportData({ sales: salesData, medications: medsData });
            setIsReportGenerated(true);
            toast.success(`Relatório gerado! ${salesData.length} vendas carregadas.`);
        } catch (error: any) {
            toast.error('Erro ao gerar relatório: ' + (error.message || 'Erro desconhecido'));
        } finally {
            setIsGenerating(false);
        }
    };

    // Use generated data or initial data
    const medications = isReportGenerated ? reportData.medications : initialMedications;
    const sales = reportData.sales;
    const isLoading = isMedsLoading || isGenerating;

    // Filter sales by period (client-side refinement if needed)
    const filteredSales = useMemo(() => {
        if (!isReportGenerated) return [];
        return sales.filter((sale: any) => {
            const saleDate = new Date(sale.createdAt);
            const start = period.start ? new Date(period.start) : null;
            const end = period.end ? new Date(period.end) : null;
            if (start && saleDate < start) return false;
            if (end && saleDate > end) return false;
            return true;
        });
    }, [sales, period, isReportGenerated]);

    // Sales metrics
    const salesMetrics = useMemo(() => {
        let totalRevenue = 0;
        let totalCost = 0;
        let totalItems = 0;

        filteredSales.forEach((sale: any) => {
            sale.items?.forEach((item: any) => {
                const med = medications.find((m: any) => m.productId === item.batch?.medication?.productId);
                if (med) {
                    totalRevenue += item.quantity * (item.unitPrice || med.product.price);
                    totalCost += item.quantity * (item.batch?.costPrice || med.product.costPrice || 0);
                    totalItems += item.quantity;
                }
            });
        });

        return {
            totalRevenue,
            totalCost,
            totalProfit: totalRevenue - totalCost,
            margin: totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0,
            totalTransactions: filteredSales.length,
            totalItems,
            avgTicket: filteredSales.length > 0 ? totalRevenue / filteredSales.length : 0
        };
    }, [filteredSales, medications]);

    // Daily sales chart data
    const dailySalesData = useMemo(() => {
        const dailyMap: Record<string, { date: string; revenue: number; transactions: number }> = {};

        filteredSales.forEach((sale: any) => {
            const dateKey = formatDate(sale.createdAt);
            if (!dailyMap[dateKey]) {
                dailyMap[dateKey] = { date: dateKey, revenue: 0, transactions: 0 };
            }
            dailyMap[dateKey].transactions++;
            sale.items?.forEach((item: any) => {
                const med = medications.find((m: any) => m.productId === item.batch?.medication?.productId);
                if (med) {
                    dailyMap[dateKey].revenue += item.quantity * (item.unitPrice || med.product.price);
                }
            });
        });

        return Object.values(dailyMap).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [filteredSales, medications]);

    // Top medications by sales
    const topMedications = useMemo(() => {
        const medMap: Record<string, { name: string; qty: number; revenue: number }> = {};

        filteredSales.forEach((sale: any) => {
            sale.items?.forEach((item: any) => {
                const med = medications.find((m: any) => m.productId === item.batch?.medication?.productId);
                if (med) {
                    const id = med.id;
                    if (!medMap[id]) {
                        medMap[id] = { name: med.product.name, qty: 0, revenue: 0 };
                    }
                    medMap[id].qty += item.quantity;
                    medMap[id].revenue += item.quantity * (item.unitPrice || med.product.price);
                }
            });
        });

        return Object.values(medMap)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);
    }, [filteredSales, medications]);

    // Stock status distribution
    const stockDistribution = useMemo(() => {
        let normal = 0, low = 0, critical = 0, expired = 0;

        medications.forEach((med: any) => {
            if (med.totalStock === 0) critical++;
            else if (med.isLowStock) low++;
            else normal++;
            // Check expiry
            if (med.nearestExpiry && new Date(med.nearestExpiry) < new Date()) expired++;
        });

        return [
            { name: 'Normal', value: normal, color: '#22c55e' },
            { name: 'Baixo', value: low, color: '#f59e0b' },
            { name: 'Crítico', value: critical, color: '#ef4444' },
            { name: 'Expirado', value: expired, color: '#6b7280' },
        ].filter(d => d.value > 0);
    }, [medications]);

    // Category breakdown
    const categoryBreakdown = useMemo(() => {
        const catMap: Record<string, number> = {};

        medications.forEach((med: any) => {
            const cat = med.pharmaceuticalForm || 'Outros';
            catMap[cat] = (catMap[cat] || 0) + 1;
        });

        return Object.entries(catMap).map(([name, value]) => ({ name, value })).slice(0, 8);
    }, [medications]);

    // Profitability by medication
    const profitabilityData = useMemo(() => {
        const profitMap: Record<string, { name: string; revenue: number; cost: number; profit: number; margin: number }> = {};

        filteredSales.forEach((sale: any) => {
            sale.items?.forEach((item: any) => {
                const med = medications.find((m: any) => m.productId === item.batch?.medication?.productId);
                if (med) {
                    const id = med.id;
                    if (!profitMap[id]) {
                        profitMap[id] = { name: med.product.name, revenue: 0, cost: 0, profit: 0, margin: 0 };
                    }
                    const itemRevenue = item.quantity * (item.unitPrice || med.product.price);
                    const itemCost = item.quantity * (item.batch?.costPrice || med.product.costPrice || 0);
                    profitMap[id].revenue += itemRevenue;
                    profitMap[id].cost += itemCost;
                    profitMap[id].profit += (itemRevenue - itemCost);
                }
            });
        });

        return Object.values(profitMap)
            .map(d => ({ ...d, margin: d.revenue > 0 ? (d.profit / d.revenue) * 100 : 0 }))
            .sort((a, b) => b.profit - a.profit)
            .slice(0, 15);
    }, [filteredSales, medications]);

    // Export handlers
    const handleExportPDF = () => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        const date = new Date().toLocaleDateString('pt-PT');

        // Header
        doc.setFontSize(14);
        doc.text(companySettings?.companyName || 'Farmácia', pageWidth / 2, 15, { align: 'center' });
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`NUIT: ${companySettings?.taxId || ''} | ${companySettings?.address || ''}`, pageWidth / 2, 21, { align: 'center' });

        doc.setFontSize(18);
        doc.setTextColor(0);
        doc.text(`Relatório de ${reportType === 'sales' ? 'Vendas' : reportType === 'stock' ? 'Stock' : reportType === 'profitability' ? 'Lucratividade' : 'Medicamentos'}`, 14, 35);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Período: ${period.start || 'Início'} a ${period.end || 'Fim'} | Gerado em: ${date}`, 14, 42);

        // Summary metrics
        doc.setFontSize(11);
        doc.setTextColor(0);
        doc.text('Resumo:', 14, 55);
        doc.setFontSize(9);
        doc.text(`Receita Total: ${formatCurrency(salesMetrics.totalRevenue)}`, 14, 62);
        doc.text(`Lucro Total: ${formatCurrency(salesMetrics.totalProfit)}`, 80, 62);
        doc.text(`Margem: ${salesMetrics.margin.toFixed(1)}%`, 140, 62);
        doc.text(`Transacções: ${salesMetrics.totalTransactions}`, 14, 68);
        doc.text(`Itens Vendidos: ${salesMetrics.totalItems}`, 80, 68);
        doc.text(`Ticket Médio: ${formatCurrency(salesMetrics.avgTicket)}`, 140, 68);

        // Table
        if (reportType === 'sales' || reportType === 'profitability') {
            const tableData = profitabilityData.map(d => [
                d.name,
                formatCurrency(d.revenue),
                formatCurrency(d.cost),
                formatCurrency(d.profit),
                `${d.margin.toFixed(1)}%`
            ]);

            autoTable(doc, {
                startY: 78,
                head: [['Medicamento', 'Receita', 'Custo', 'Lucro', 'Margem']],
                body: tableData,
                theme: 'grid',
                headStyles: { fillColor: [99, 102, 241] },
                styles: { fontSize: 8 },
            });
        } else if (reportType === 'stock') {
            const tableData = medications.slice(0, 30).map((med: any) => [
                med.product.name,
                med.totalStock.toString(),
                med.isLowStock ? 'Baixo' : 'Normal',
                med.nearestExpiry ? formatDate(med.nearestExpiry) : '-',
                formatCurrency(med.product.price)
            ]);

            autoTable(doc, {
                startY: 78,
                head: [['Medicamento', 'Stock', 'Estado', 'Validade', 'Preço']],
                body: tableData,
                theme: 'grid',
                headStyles: { fillColor: [34, 197, 94] },
                styles: { fontSize: 8 },
            });
        }

        doc.save(`relatorio_farmacia_${reportType}_${new Date().toISOString().split('T')[0]}.pdf`);
        toast.success('Relatório PDF exportado com sucesso!');
    };

    const handleExportExcel = () => {
        let data: any[];

        if (reportType === 'sales' || reportType === 'profitability') {
            data = profitabilityData.map(d => ({
                'Medicamento': d.name,
                'Receita': d.revenue,
                'Custo': d.cost,
                'Lucro': d.profit,
                'Margem (%)': d.margin.toFixed(1)
            }));
        } else if (reportType === 'stock') {
            data = medications.map((med: any) => ({
                'Medicamento': med.product.name,
                'DCI': med.dci,
                'Stock': med.totalStock,
                'Estado': med.isLowStock ? 'Baixo' : 'Normal',
                'Validade': med.nearestExpiry ? formatDate(med.nearestExpiry) : '-',
                'Preço': med.product.price
            }));
        } else {
            data = topMedications.map(d => ({
                'Medicamento': d.name,
                'Quantidade': d.qty,
                'Receita': d.revenue
            }));
        }

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
        XLSX.writeFile(wb, `relatorio_farmacia_${reportType}_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success('Relatório Excel exportado com sucesso!');
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-6 print:space-y-4">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-gray-200 dark:border-dark-700 print:hidden">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <HiOutlineDocumentReport className="w-7 h-7 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Relatórios de Farmácia</h1>
                        <p className="text-sm text-gray-500">Análises detalhadas, gráficos e exportação profissional</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" leftIcon={<HiOutlinePrinter className="w-4 h-4" />} onClick={handlePrint}>
                        Imprimir
                    </Button>
                    <Button variant="outline" size="sm" leftIcon={<HiOutlineDownload className="w-4 h-4" />} onClick={handleExportExcel}>
                        Excel
                    </Button>
                    <Button variant="primary" size="sm" leftIcon={<HiOutlineDownload className="w-4 h-4" />} onClick={handleExportPDF}>
                        PDF
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card className="p-4 print:hidden">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                        <HiOutlineFilter className="w-5 h-5 text-gray-400" />
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Filtros:</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <HiOutlineCalendar className="w-4 h-4 text-gray-400" />
                        <Input
                            type="date"
                            value={period.start}
                            onChange={e => setPeriod({ ...period, start: e.target.value })}
                            className="w-36"
                        />
                        <span className="text-gray-400">até</span>
                        <Input
                            type="date"
                            value={period.end}
                            onChange={e => setPeriod({ ...period, end: e.target.value })}
                            className="w-36"
                        />
                    </div>

                    <Select
                        value={reportType}
                        onChange={e => setReportType(e.target.value as ReportType)}
                        className="w-44"
                        options={[
                            { value: 'sales', label: 'Vendas' },
                            { value: 'stock', label: 'Stock' },
                            { value: 'profitability', label: 'Lucratividade' },
                            { value: 'medications', label: 'Top Medicamentos' },
                        ]}
                    />

                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-dark-700 rounded-lg p-1">
                        <button
                            onClick={() => setViewMode('charts')}
                            className={cn(
                                "p-2 rounded-md transition-colors",
                                viewMode === 'charts' ? "bg-white dark:bg-dark-600 shadow" : "hover:bg-gray-200 dark:hover:bg-dark-600"
                            )}
                        >
                            <HiOutlineChartBar className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            className={cn(
                                "p-2 rounded-md transition-colors",
                                viewMode === 'table' ? "bg-white dark:bg-dark-600 shadow" : "hover:bg-gray-200 dark:hover:bg-dark-600"
                            )}
                        >
                            <HiOutlineTable className="w-4 h-4" />
                        </button>
                    </div>

                    <Button
                        variant="primary"
                        size="sm"
                        onClick={handleGenerateReport}
                        disabled={isGenerating}
                        leftIcon={isGenerating ? undefined : <HiOutlineChartBar className="w-4 h-4" />}
                    >
                        {isGenerating ? 'A gerar...' : 'Gerar Relatório'}
                    </Button>

                    {isLoading && <LoadingSpinner size="sm" />}
                </div>
            </Card>

            {/* Message when report not generated yet */}
            {!isReportGenerated && !isGenerating && (
                <Card className="p-8 text-center">
                    <HiOutlineDocumentReport className="w-16 h-16 mx-auto text-gray-300 dark:text-dark-600 mb-4" />
                    <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-2">
                        Selecione um Período e Gere o Relatório
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        Para melhor performance, os dados são carregados apenas quando clica em "Gerar Relatório".
                        <br />Selecione as datas de início e fim para filtrar os resultados.
                    </p>
                    <Button variant="primary" onClick={handleGenerateReport} leftIcon={<HiOutlineChartBar className="w-5 h-5" />}>
                        Gerar Relatório Agora
                    </Button>
                </Card>
            )}

            {/* Only show content when report is generated */}
            {isReportGenerated && (
                <>
                    {/* KPI Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4">
                        <Card className="p-5 border-l-4 border-indigo-500">
                            <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Receita Total</p>
                            <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">
                                {formatCurrency(salesMetrics.totalRevenue)}
                            </p>
                            <p className="text-xs text-gray-500">{salesMetrics.totalTransactions} transacções</p>
                        </Card>
                        <Card className="p-5 border-l-4 border-emerald-500">
                            <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Lucro Bruto</p>
                            <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">
                                {formatCurrency(salesMetrics.totalProfit)}
                            </p>
                            <p className="text-xs text-gray-500">Margem: {salesMetrics.margin.toFixed(1)}%</p>
                        </Card>
                        <Card className="p-5 border-l-4 border-amber-500">
                            <p className="text-xs font-bold uppercase tracking-wider text-amber-600">Ticket Médio</p>
                            <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">
                                {formatCurrency(salesMetrics.avgTicket)}
                            </p>
                            <p className="text-xs text-gray-500">{salesMetrics.totalItems} itens vendidos</p>
                        </Card>
                        <Card className="p-5 border-l-4 border-purple-500">
                            <p className="text-xs font-bold uppercase tracking-wider text-purple-600">Medicamentos</p>
                            <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">
                                {medications.length}
                            </p>
                            <p className="text-xs text-gray-500">{medications.filter((m: any) => m.isLowStock).length} em stock baixo</p>
                        </Card>
                    </div>

                    {/* Charts / Table View */}
                    {viewMode === 'charts' ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-2">
                            {/* Sales Trend Chart */}
                            <Card className="p-6">
                                <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                    <HiOutlineTrendingUp className="w-5 h-5 text-indigo-500" />
                                    Evolução de Vendas
                                </h3>
                                <div className="h-72">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={dailySalesData}>
                                            <defs>
                                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                                            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                            <Tooltip formatter={(value: any) => formatCurrency(value)} />
                                            <Area type="monotone" dataKey="revenue" stroke="#6366f1" fillOpacity={1} fill="url(#colorRevenue)" name="Receita" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>

                            {/* Top Medications Bar Chart */}
                            <Card className="p-6">
                                <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                    <HiOutlineBeaker className="w-5 h-5 text-emerald-500" />
                                    Top Medicamentos
                                </h3>
                                <div className="h-72">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={topMedications.slice(0, 7)} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                            <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={100} />
                                            <Tooltip formatter={(value: any) => formatCurrency(value)} />
                                            <Bar dataKey="revenue" fill="#22c55e" radius={[0, 4, 4, 0]} name="Receita" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>

                            {/* Stock Distribution Pie */}
                            <Card className="p-6">
                                <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                    <HiOutlineCube className="w-5 h-5 text-amber-500" />
                                    Distribuição de Stock
                                </h3>
                                <div className="h-72">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={stockDistribution}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={100}
                                                paddingAngle={2}
                                                dataKey="value"
                                                label={({ name, value }) => `${name}: ${value}`}
                                            >
                                                {stockDistribution.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Legend />
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>

                            {/* Profitability Chart */}
                            <Card className="p-6">
                                <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                    <HiOutlineCurrencyDollar className="w-5 h-5 text-purple-500" />
                                    Lucratividade por Medicamento
                                </h3>
                                <div className="h-72">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={profitabilityData.slice(0, 8)}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                            <XAxis dataKey="name" tick={{ fontSize: 8 }} interval={0} angle={-20} textAnchor="end" height={60} />
                                            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                            <Tooltip formatter={(value: any) => formatCurrency(value)} />
                                            <Legend />
                                            <Bar dataKey="revenue" fill="#6366f1" name="Receita" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="profit" fill="#22c55e" name="Lucro" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>
                        </div>
                    ) : (
                        /* Table View */
                        <Card className="p-0 overflow-hidden">
                            <TableContainer
                                isLoading={isLoading}
                                isEmpty={profitabilityData.length === 0}
                                emptyTitle="Nenhum dado encontrado"
                                emptyDescription="Ajuste os filtros para visualizar dados."
                                minHeight="600px"
                            >
                                <table className="w-full">
                                    <thead className="bg-gray-50 dark:bg-dark-700">
                                        <tr className="text-xs text-gray-500 uppercase">
                                            <th className="px-6 py-3 text-left">Medicamento</th>
                                            <th className="px-6 py-3 text-right">Receita</th>
                                            <th className="px-6 py-3 text-right">Custo</th>
                                            <th className="px-6 py-3 text-right">Lucro</th>
                                            <th className="px-6 py-3 text-center">Margem</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-dark-700">
                                        {profitabilityData.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{item.name}</td>
                                                <td className="px-6 py-4 text-right text-gray-700 dark:text-gray-300">{formatCurrency(item.revenue)}</td>
                                                <td className="px-6 py-4 text-right text-gray-500">{formatCurrency(item.cost)}</td>
                                                <td className="px-6 py-4 text-right font-bold text-emerald-600">{formatCurrency(item.profit)}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <Badge variant={item.margin > 30 ? 'success' : item.margin > 15 ? 'warning' : 'danger'}>
                                                        {item.margin.toFixed(1)}%
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </TableContainer>
                        </Card>
                    )}

                    {/* Print Header (hidden on screen) */}
                    <div className="hidden print:block">
                        <div className="text-center mb-8">
                            <h1 className="text-2xl font-bold">{companySettings?.companyName || 'Farmácia'}</h1>
                            <p className="text-sm text-gray-500">NUIT: {companySettings?.taxId} | {companySettings?.address}</p>
                            <h2 className="text-xl font-bold mt-4">Relatório de Farmácia</h2>
                            <p className="text-sm">Período: {period.start || 'Início'} a {period.end || 'Fim'}</p>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

