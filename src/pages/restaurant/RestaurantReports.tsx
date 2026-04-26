import { useState, useMemo } from 'react';
import { Card, Button, Skeleton, Badge, Pagination, Input } from '../../components/ui';
import {
    HiOutlineRefresh, HiOutlineDocumentReport, HiOutlineCalendar,
    HiOutlineCash, HiOutlineShoppingCart, HiOutlineChartBar,
} from 'react-icons/hi';
import { HiOutlineCake, HiOutlineArrowDownTray as HiOutlineDocumentDownload } from 'react-icons/hi2';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useRestaurantReports } from '../../hooks/useRestaurant';
import { useStore } from '../../stores/useStore';
import { formatCurrency } from '../../utils/helpers';
import { cn } from '../../utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addProfessionalHeader } from '../../utils/documentGenerator';
import toast from 'react-hot-toast';

const CHART_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#6366f1', '#8b5cf6'];

// ============================================================================
// DATE PRESETS
// ============================================================================

type Preset = 'today' | 'week' | 'month' | 'custom';

function getPresetDates(p: Preset): { startDate: string; endDate: string } {
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().split('T')[0];

    if (p === 'today') return { startDate: fmt(today), endDate: fmt(today) };
    if (p === 'week') {
        const start = new Date(today); start.setDate(today.getDate() - 7);
        return { startDate: fmt(start), endDate: fmt(today) };
    }
    if (p === 'month') {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        return { startDate: fmt(start), endDate: fmt(today) };
    }
    return { startDate: '', endDate: '' };
}

export default function RestaurantReports() {
    const [preset, setPreset] = useState<Preset>('month');
    const [customDates, setCustomDates] = useState({ startDate: '', endDate: '' });
    const [page, setPage] = useState(1);

    const { companySettings } = useStore();
    const dates = preset === 'custom' ? customDates : getPresetDates(preset);
    const { data, isLoading, refetch } = useRestaurantReports({ ...dates, page, limit: 100 });

    const sales = data?.data || [];
    const summary = data?.summary || { totalRevenue: 0, totalOrders: 0, avgTicket: 0 };
    const pagination = data?.pagination;

    // Derived Data: Top Products
    const topProducts = useMemo(() => {
        const map: Record<string, { quantity: number; total: number }> = {};
        sales.forEach((s: any) => {
            s.items?.forEach((item: any) => {
                if (!map[item.name]) map[item.name] = { quantity: 0, total: 0 };
                map[item.name].quantity += item.quantity;
                map[item.name].total += item.quantity * item.unitPrice;
            });
        });
        return Object.entries(map)
            .map(([name, stats]) => ({ name, ...stats }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);
    }, [sales]);

    // Derived Data: Payment Methods
    const paymentMethodsData = useMemo(() => {
        const map: Record<string, number> = {};
        sales.forEach((s: any) => {
            map[s.paymentMethod] = (map[s.paymentMethod] || 0) + Number(s.total);
        });
        return Object.entries(map).map(([name, value]) => ({ 
            name: name.toUpperCase(), 
            value 
        }));
    }, [sales]);

    // Group by day for chart
    const chartData = useMemo(() => {
        const dayMap: Record<string, number> = {};
        sales.forEach((s: any) => {
            const day = new Date(s.createdAt).toLocaleDateString('pt-MZ', { day: '2-digit', month: '2-digit' });
            dayMap[day] = (dayMap[day] || 0) + Number(s.total);
        });
        return Object.entries(dayMap).map(([date, total]) => ({ date, total })).slice(-14);
    }, [sales]);

    const PRESETS: { value: Preset; label: string }[] = [
        { value: 'today', label: 'Hoje' },
        { value: 'week', label: '7 Dias' },
        { value: 'month', label: 'Este Mês' },
        { value: 'custom', label: 'Personalizado' },
    ];

    return (
        <div className="space-y-6 p-2">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Relatórios do Restaurante</h1>
                    <p className="text-gray-500 dark:text-gray-400">Análise de vendas e desempenho</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="ghost" onClick={() => { void refetch(); }} leftIcon={<HiOutlineRefresh className="w-5 h-5 text-primary-600 dark:text-primary-400" />}>Atualizar</Button>
                </div>
            </div>

            {/* Period Filter */}
            <Card padding="md">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex items-center gap-2 bg-gray-100 dark:bg-dark-700 rounded-lg p-1">
                        {PRESETS.map(p => (
                            <Button
                                key={p.value}
                                variant={preset === p.value ? 'primary' : 'ghost'}
                                onClick={() => { setPreset(p.value); setPage(1); }}
                                size="sm"
                                className={cn(
                                    'rounded-md transition-all',
                                    preset === p.value ? 'bg-white dark:bg-dark-800 text-red-600 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200/50'
                                )}
                            >
                                {p.label}
                            </Button>
                        ))}
                    </div>
                    {preset === 'custom' && (
                        <div className="flex items-center gap-2">
                            <HiOutlineCalendar className="w-5 h-5 text-gray-400" />
                            <Input
                                type="date"
                                size="sm"
                                className="w-auto"
                                value={customDates.startDate}
                                onChange={e => setCustomDates(p => ({ ...p, startDate: e.target.value }))}
                            />
                            <span className="text-gray-400">-</span>
                            <Input
                                type="date"
                                size="sm"
                                className="w-auto"
                                value={customDates.endDate}
                                onChange={e => setCustomDates(p => ({ ...p, endDate: e.target.value }))}
                            />
                        </div>
                    )}
                </div>
            </Card>

            {/* KPI Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                    { label: 'Receita Total', value: formatCurrency(summary.totalRevenue), icon: HiOutlineCash, color: 'red' },
                    { label: 'Total de Pedidos', value: summary.totalOrders, icon: HiOutlineShoppingCart, color: 'orange' },
                    { label: 'Ticket Médio', value: formatCurrency(summary.avgTicket), icon: HiOutlineChartBar, color: 'emerald' },
                ].map(({ label, value, icon: Icon, color }) => (
                    <Card 
                        key={label} 
                        padding="md"
                        className={cn(
                            'border shadow-card-strong transition-all hover:scale-[1.02] overflow-hidden group',
                            color === 'red' ? 'bg-red-100/40 border-red-200/50' :
                            color === 'orange' ? 'bg-orange-100/40 border-orange-200/50' :
                            'bg-emerald-100/40 border-emerald-200/50'
                        )}
                    >
                        <div className="flex items-center gap-4 relative z-10">
                            <div className={cn(
                                'w-12 h-12 rounded-xl flex items-center justify-center shadow-inner transition-transform group-hover:scale-110',
                                color === 'red' ? 'bg-red-200/60 text-red-700' :
                                color === 'orange' ? 'bg-orange-200/60 text-orange-700' :
                                'bg-emerald-200/60 text-emerald-700'
                            )}>
                                <Icon className="w-6 h-6" />
                            </div>
                            <div>
                                <p className={cn(
                                    'text-[10px] font-black uppercase tracking-widest',
                                    color === 'red' ? 'text-red-600/70' :
                                    color === 'orange' ? 'text-orange-600/70' :
                                    'text-emerald-600/70'
                                )}>{label}</p>
                                <p className={cn(
                                    'text-2xl font-black leading-none mt-1',
                                    color === 'red' ? 'text-red-900 dark:text-white' :
                                    color === 'orange' ? 'text-orange-900 dark:text-white' :
                                    'text-emerald-900 dark:text-white'
                                )}>{value}</p>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card padding="md" className="lg:col-span-2">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Vendas por Dia (Revenue)</h2>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-gray-200 dark:stroke-dark-700" />
                                <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `${v / 1000}k`} />
                                <Tooltip formatter={(v: any) => formatCurrency(v)} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }} />
                                <Bar dataKey="total" fill="#ef4444" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card padding="md">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Meios de Pagamento</h2>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie 
                                    data={paymentMethodsData} 
                                    cx="50%" cy="50%" 
                                    innerRadius={60} outerRadius={80} 
                                    paddingAngle={5} dataKey="value"
                                >
                                    {paymentMethodsData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(v: any) => formatCurrency(v)} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4 text-[10px] uppercase font-bold text-gray-400">
                        {paymentMethodsData.map((item, index) => (
                            <div key={item.name} className="flex items-center gap-1.5 truncate">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                                {item.name}
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Top Products & Sales List */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Top Products */}
                <Card padding="md" className="lg:col-span-1 border-none bg-primary-900 text-white shadow-xl shadow-primary-500/10">
                    <h2 className="text-lg font-black mb-6 uppercase tracking-widest text-primary-200">Best Sellers</h2>
                    <div className="space-y-6">
                        {topProducts.map((p, idx) => (
                            <div key={idx} className="flex justify-between items-center group">
                                <div className="min-w-0">
                                    <p className="text-sm font-bold truncate pr-3 group-hover:text-primary-300 transition-colors uppercase tracking-tight">{p.name}</p>
                                    <p className="text-[10px] text-primary-400 font-bold">{p.quantity} pedidos</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className="text-xs font-black">{formatCurrency(p.total)}</p>
                                </div>
                            </div>
                        ))}
                        {topProducts.length === 0 && <p className="text-xs opacity-50 text-center py-10">Sem vendas suficientes</p>}
                    </div>
                </Card>

                {/* Sales List */}
                <Card padding="md" className="lg:col-span-3">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Registo de Pedidos</h2>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleExportExcel} leftIcon={<HiOutlineDocumentDownload className="w-4 h-4 text-primary-600 dark:text-primary-400" />}>Gerar XLSX</Button>
                            <Button onClick={handleExportPDF} leftIcon={<HiOutlineDocumentDownload className="w-4 h-4 text-white" />}>PDF Profissional</Button>
                        </div>
                    </div>

                {isLoading ? (
                    <div className="space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} height={48} />)}</div>
                ) : sales.length === 0 ? (
                    <div className="text-center py-10">
                        <HiOutlineDocumentReport className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm">Sem pedidos no período seleccionado</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-dark-700">
                                    {['Nº Recibo', 'Mesa', 'Itens', 'Método', 'Total', 'Data'].map(h => (
                                        <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider pb-3 pr-4">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                                {sales.map((sale: any) => (
                                    <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                                        <td className="py-3 pr-4 font-mono text-xs text-gray-600 dark:text-gray-400">{sale.receiptNumber}</td>
                                        <td className="py-3 pr-4">
                                            {sale.table ? (
                                                <div className="flex items-center gap-1.5">
                                                    <HiOutlineCake className="w-4 h-4 text-red-500" />
                                                    <span>Mesa {sale.table.number}{sale.table.name ? ` "" ${sale.table.name}` : ''}</span>
                                                </div>
                                            ) : <span className="text-gray-400">Balcão</span>}
                                        </td>
                                        <td className="py-3 pr-4 text-gray-600 dark:text-gray-400">{sale.items?.length || 0} itens</td>
                                        <td className="py-3 pr-4">
                                            <Badge variant={sale.paymentMethod === 'cash' ? 'gray' : 'info'}>{sale.paymentMethod}</Badge>
                                        </td>
                                        <td className="py-3 pr-4 font-bold text-red-600">{formatCurrency(sale.total)}</td>
                                        <td className="py-3 text-gray-500 text-xs whitespace-nowrap">
                                            {new Date(sale.createdAt).toLocaleString('pt-MZ', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                    {pagination && pagination.total > 0 && (
                        <Pagination
                            currentPage={page}
                            totalItems={pagination.total}
                            itemsPerPage={100}
                            onPageChange={setPage}
                            className="mt-4"
                        />
                    )}
                </Card>
            </div>
        </div>
    );

    function handleExportExcel() {
        if (!sales.length) {
            toast.error('Sem dados para exportar');
            return;
        }
        const headers = ['Nº Recibo', 'Mesa', 'Itens', 'Método', 'Total', 'Data'];
        const rows = sales.map((s: any) => [
            s.receiptNumber,
            s.table ? `Mesa ${s.table.number}` : 'Balcão',
            s.items?.length || 0,
            s.paymentMethod?.toUpperCase() || '',
            Number(s.total).toFixed(2),
            new Date(s.createdAt).toLocaleDateString('pt-MZ'),
        ]);
        const csv = [headers, ...rows].map(r => r.join(';')).join('\n');
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `relatorio-restaurante-${new Date().getTime()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Ficheiro Excel (CSV) exportado');
    }

    function handleExportPDF() {
        if (!sales.length) {
            toast.error('Sem dados para exportar');
            return;
        }

        const doc = new jsPDF() as any;
        const periodStr = preset === 'custom' 
            ? `${customDates.startDate} a ${customDates.endDate}` 
            : PRESETS.find(p => p.value === preset)?.label || '';

        addProfessionalHeader(doc, 'Relatório de Restaurante', companySettings, periodStr);

        autoTable(doc, {
            startY: 45,
            head: [['Nº Recibo', 'Mesa', 'Método', 'Total', 'Data']],
            body: sales.map((s: any) => [
                s.receiptNumber,
                s.table ? `Mesa ${s.table.number}` : 'Balcão',
                s.paymentMethod.toUpperCase(),
                formatCurrency(s.total),
                new Date(s.createdAt).toLocaleDateString('pt-MZ')
            ]),
            styles: { fontSize: 8 },
            headStyles: { fillColor: [239, 68, 68] }, // red-500
        });

        const finalY = (doc as any).lastAutoTable.cursor.y + 15;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`TOTAL GERAL: ${formatCurrency(summary.totalRevenue)}`, doc.internal.pageSize.width - 15, finalY, { align: 'right' });

        doc.save(`relatorio-restaurante-${new Date().getTime()}.pdf`);
        toast.success('PDF gerado com sucesso');
    }
}
