import { useState, useEffect, useMemo } from 'react';
import { Card, Button, Badge, LoadingSpinner, Modal, Select, Input } from '../../components/ui';
import { useWarehouses, useProducts } from '../../hooks/useData';
import { warehousesAPI } from '../../services/api';
import {
    HiOutlineTruck,
    HiOutlineMapPin,
    HiOutlinePlus,
    HiOutlineTrash,
    HiOutlinePrinter,
    HiOutlineCube,
    HiOutlineArrowRight,
    HiOutlineChartBar,
    HiOutlineSquares2X2,
    HiOutlineFunnel,
    HiOutlineBanknotes,
    HiOutlineFlag,
    HiOutlineLightBulb
} from 'react-icons/hi2';
import { useLogisticsDashboard } from '../../hooks/useLogistics';
import { useSmartInsights } from '../../hooks/useSmartInsights';
import { SmartInsightCard } from '../../components/common/SmartInsightCard';
import toast from 'react-hot-toast';
import { generateGuiaRemessa } from '../../utils/documentGenerator';
import { useStore } from '../../stores/useStore';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from 'recharts';
import { subMonths, isAfter, startOfDay } from 'date-fns';
import { cn } from '../../utils/helpers';

type TimePeriod = 'today' | 'month' | '2months' | '3months' | 'year' | 'all';

export default function LogisticsDashboard() {
    const { companySettings } = useStore();
    const { warehouses, isLoading: isLoadingWarehouses } = useWarehouses();
    const { products } = useProducts();
    const { data: dashboard, isLoading: isLoadingDashboard } = useLogisticsDashboard();
    const { insights } = useSmartInsights();
    const [transfers, setTransfers] = useState<any[]>([]);
    const [isLoadingTransfers, setIsLoadingTransfers] = useState(true);
    const [period, setPeriod] = useState<TimePeriod>('all');

    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferData, setTransferData] = useState({
        sourceWarehouseId: '',
        targetWarehouseId: '',
        responsible: '',
        reason: '',
        items: [{ productId: '', quantity: 1 }]
    });

    const fetchTransfers = async () => {
        setIsLoadingTransfers(true);
        try {
            const data = await warehousesAPI.getTransfers();
            setTransfers(data);
        } catch (error) {
            console.error('Error fetching transfers:', error);
        } finally {
            setIsLoadingTransfers(false);
        }
    };

    useEffect(() => {
        fetchTransfers();
    }, []);

    const filteredTransfers = useMemo(() => {
        if (period === 'all') return transfers;

        const now = new Date();
        let startDate: Date;

        switch (period) {
            case 'today':
                startDate = startOfDay(now);
                break;
            case 'month':
                startDate = subMonths(now, 1);
                break;
            case '2months':
                startDate = subMonths(now, 2);
                break;
            case '3months':
                startDate = subMonths(now, 3);
                break;
            case 'year':
                startDate = subMonths(now, 12);
                break;
            default:
                return transfers;
        }

        return transfers.filter(tr => {
            const trDate = new Date(tr.date || tr.createdAt);
            return isAfter(trDate, startDate);
        });
    }, [transfers, period]);

    const handleCreateTransfer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (transferData.sourceWarehouseId === transferData.targetWarehouseId) {
            return toast.error('Origem e destino não podem ser iguais');
        }
        try {
            await warehousesAPI.createTransfer(transferData);
            toast.success('Transferência concluída com sucesso!');
            setIsTransferModalOpen(false);
            setTransferData({
                sourceWarehouseId: '',
                targetWarehouseId: '',
                responsible: '',
                reason: '',
                items: [{ productId: '', quantity: 1 }]
            });
            fetchTransfers();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao criar transferência');
        }
    };

    const addItem = () => {
        setTransferData({
            ...transferData,
            items: [...transferData.items, { productId: '', quantity: 1 }]
        });
    };

    const removeItem = (index: number) => {
        setTransferData({
            ...transferData,
            items: transferData.items.filter((_, i) => i !== index)
        });
    };

    const exportToExcel = () => {
        const data = filteredTransfers.map(tr => ({
            'Guia': tr.number,
            'Origem': tr.sourceWarehouse?.name,
            'Destino': tr.targetWarehouse?.name,
            'Estado': tr.status,
            'Responsável': tr.responsible,
            'Data': new Date(tr.date || tr.createdAt).toLocaleDateString(),
            'Total Itens': tr.items?.length
        }));
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Transferencias');
        XLSX.writeFile(workbook, `Logistica_Transferencias_${period}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const exportToPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(20);
        doc.setTextColor(40);
        doc.text(companySettings?.companyName || 'RELATÓRIO LOGÍSTICO', 14, 22);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Período: ${period === 'all' ? 'Todo Histórico' : period}`, 14, 30);
        doc.text(`Data de Emissão: ${new Date().toLocaleDateString()}`, 14, 35);

        const tableData = filteredTransfers.map(tr => [
            tr.number,
            tr.sourceWarehouse?.name || '-',
            tr.targetWarehouse?.name || '-',
            tr.status === 'completed' ? 'CONCLUÍDO' : 'PENDENTE',
            tr.responsible || '-',
            new Date(tr.date || tr.createdAt).toLocaleDateString(),
            tr.items?.length || 0
        ]);

        autoTable(doc, {
            startY: 45,
            head: [['Guia #', 'Origem', 'Destino', 'Estado', 'Responsável', 'Data', 'Itens']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [59, 130, 246] },
        });

        doc.save(`Logistica_Relatorio_${period}_${new Date().toISOString().split('T')[0]}.pdf`);
        toast.success('Relatório PDF gerado!');
    };

    const totalStock = warehouses.reduce((acc, w) => acc + ((w as any).totalItems || 0), 0);

    const transferStats = [
        { name: 'Seg', valor: 4 },
        { name: 'Ter', valor: 7 },
        { name: 'Qua', valor: 5 },
        { name: 'Qui', valor: 12 },
        { name: 'Sex', valor: 9 },
        { name: 'Sáb', valor: 3 },
        { name: 'Dom', valor: 1 },
    ];

    const pieData = warehouses.map(w => ({
        name: w.name,
        value: (w as any).totalItems || 50
    }));

    const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

    if (isLoadingWarehouses || isLoadingDashboard) return (
        <div className="flex flex-col items-center justify-center h-96 space-y-4">
            <LoadingSpinner size="xl" />
            <p className="text-gray-500 animate-pulse">Sincronizando Cadeia de Suprimentos...</p>
        </div>
    );

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            {/* Header Section */}
            <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-dark-800 p-8 shadow-sm border border-gray-200 dark:border-dark-700">
                <div className="absolute top-0 right-0 -m-8 opacity-[0.03] dark:opacity-[0.05]">
                    <HiOutlineTruck className="w-64 h-64 text-primary-900 rotate-12" />
                </div>

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="px-3 py-1 bg-primary-50 dark:bg-primary-900/20 rounded-full text-[10px] font-bold text-primary-700 dark:text-primary-400 uppercase tracking-widest border border-primary-100 dark:border-primary-800">Controle em Tempo Real</span>
                            <span className="flex h-2 w-2 rounded-full bg-primary-500 animate-pulse"></span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                            Logística e Cadeia de Suprimentos
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 text-lg max-w-2xl font-medium">
                            Monitoramento centralizado de armazéns, fluxo de mercadorias e transferências inteligentes.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-dark-900/50 p-1.5 rounded-2xl border border-gray-100 dark:border-dark-700 mr-2">
                            <HiOutlineFunnel className="w-4 h-4 text-gray-400 ml-2" />
                            <select
                                value={period}
                                onChange={(e) => setPeriod(e.target.value as TimePeriod)}
                                className="bg-transparent border-none text-xs font-bold text-gray-600 dark:text-gray-400 focus:ring-0 cursor-pointer outline-none"
                            >
                                <option value="today">Hoje</option>
                                <option value="month">Este Mês</option>
                                <option value="2months">Últimos 2 Meses</option>
                                <option value="3months">Últimos 3 Meses</option>
                                <option value="year">Este Ano</option>
                                <option value="all">Todo Histórico</option>
                            </select>
                        </div>

                        <Button
                            variant="outline"
                            className="bg-white/50 backdrop-blur-sm border-gray-200 dark:border-dark-700 rounded-2xl"
                            leftIcon={<HiOutlinePrinter className="w-5 h-5" />}
                            onClick={exportToPDF}
                        >
                            PDF
                        </Button>
                        <Button
                            variant="primary"
                            className="rounded-2xl shadow-lg shadow-primary-500/25"
                            leftIcon={<HiOutlinePlus className="w-5 h-5" />}
                            onClick={() => setIsTransferModalOpen(true)}
                        >
                            Nova Transferência
                        </Button>
                    </div>
                </div>
            </div>

            {/* Smart Insights / Intelligent Advisor */}
            {insights.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <HiOutlineLightBulb className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Conselheiro Inteligente</h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Otimização de rotas e logística detetada pela IA</p>
                        </div>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hidden">
                        {insights.map((insight) => (
                            <SmartInsightCard key={insight.id} insight={insight} className="min-w-[320px] max-w-[400px] flex-shrink-0" />
                        ))}
                    </div>
                </div>
            )}

            {/* KPI Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Stock Total', value: totalStock.toLocaleString(), icon: HiOutlineCube, color: 'blue', detail: 'Itens em rede' },
                    { label: 'Receita Pickups', value: `${(dashboard?.stats?.pickupRevenue || 0).toLocaleString()} MZN`, icon: HiOutlineBanknotes, color: 'emerald', detail: 'Total pickups' },
                    { label: 'Receita Entregas', value: `${(dashboard?.stats?.deliveryRevenue || 0).toLocaleString()} MZN`, icon: HiOutlineTruck, color: 'indigo', detail: 'Total envios' },
                    { label: 'Regiões', value: dashboard?.stats?.deliveriesByProvince?.length || 0, icon: HiOutlineFlag, color: 'amber', detail: 'Provincias' }
                ].map((kpi, i) => (
                    <Card key={i} className="relative group overflow-hidden border-none shadow-sm hover:shadow-md transition-all">
                        <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full bg-primary-500/5 group-hover:bg-primary-500/10 transition-colors`}></div>
                        <div className="flex items-start justify-between">
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1 truncate">{kpi.label}</p>
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white truncate">{kpi.value}</h3>
                                <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mt-2 truncate">{kpi.detail}</p>
                            </div>
                            <div className={`p-3 rounded-2xl bg-gray-50 dark:bg-dark-900/20 text-primary-600 dark:text-primary-400 flex-shrink-0`}>
                                <kpi.icon className="w-6 h-6" />
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Data Visualization Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="p-6 h-[400px] flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <HiOutlineChartBar className="text-primary-600 w-5 h-5" />
                            Fluxo de Mercadorias (7 Dias)
                        </h3>
                        <Badge variant="primary" size="sm">Volume de Transferências</Badge>
                    </div>
                    <div className="flex-1 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={transferStats}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Area type="monotone" dataKey="valor" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card className="p-6 h-[400px] flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <HiOutlineSquares2X2 className="text-indigo-600 w-5 h-5" />
                            Distribuição de Stock por Hub
                        </h3>
                    </div>
                    <div className="flex-1 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {pieData.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Warehouse Monitor */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <HiOutlineMapPin className="text-primary-600 w-6 h-6" />
                            Rede de Armazéns
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {warehouses.map((w, index) => (
                            <Card key={w.id} className="group hover:border-primary-500/30 transition-all cursor-pointer">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-dark-900/50 flex items-center justify-center group-hover:bg-primary-500 group-hover:text-white transition-all">
                                            <HiOutlineMapPin className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors uppercase tracking-tight">{w.name}</h3>
                                            <p className="text-xs text-gray-500 font-medium">{w.location || 'Local não definido'}</p>
                                        </div>
                                    </div>
                                    <Badge variant={w.isActive ? 'success' : 'danger'} className="rounded-lg px-3 py-1 font-bold">
                                        {w.isActive ? 'ONLINE' : 'OFFLINE'}
                                    </Badge>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between text-xs font-bold text-gray-400">
                                        <span>OCUPAÇÃO DE STOCK</span>
                                        <span>{Math.min(95, 20 + index * 15)}%</span>
                                    </div>
                                    <div className="w-full h-2 bg-gray-100 dark:bg-dark-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary-500 rounded-full transition-all duration-1000"
                                            style={{ width: `${Math.min(95, 20 + index * 15)}%` }}
                                        ></div>
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t dark:border-dark-700">
                                        <div className="text-center">
                                            <p className="text-[10px] text-gray-500 font-bold mb-1">CÓDIGO</p>
                                            <span className="text-sm font-mono font-bold">{w.code}</span>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-gray-500 font-bold mb-1">TOTAL ITENS</p>
                                            <span className="text-sm font-extrabold text-primary-600">{(w as any).totalItems || 0}</span>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>

                {/* Side Activity Feed */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <HiOutlineChartBar className="text-indigo-600 w-6 h-6" />
                            Actividade Recente
                        </h2>
                    </div>

                    <Card className="p-0 overflow-hidden border-none shadow-xl">
                        <div className="p-4 bg-gray-50 dark:bg-dark-900/50 border-b dark:border-dark-700 flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-500 tracking-widest">TRANSFERÊNCIAS LIVE</span>
                            <Badge variant="primary" size="sm">{filteredTransfers.length}</Badge>
                        </div>
                        <div className="max-h-[500px] overflow-y-auto scrollbar-hidden">
                            {isLoadingTransfers ? (
                                <div className="p-8 text-center"><LoadingSpinner /></div>
                            ) : filteredTransfers.length > 0 ? (
                                <div className="divide-y dark:divide-dark-700">
                                    {filteredTransfers.slice(0, 8).map((tr) => (
                                        <div key={tr.id} className="p-4 hover:bg-white dark:hover:bg-dark-700/50 transition-all group">
                                            <div className="flex items-start gap-3">
                                                <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${tr.status === 'completed' ? 'bg-green-500' : 'bg-amber-400'}`}></div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-sm font-bold text-primary-600 font-mono">{tr.number}</span>
                                                        <span className="text-[10px] font-bold text-gray-400">{new Date(tr.date || tr.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 font-medium">
                                                        <span className="truncate max-w-[80px] text-gray-900 dark:text-white font-bold">{tr.sourceWarehouse?.name?.split(' ')[0]}</span>
                                                        <HiOutlineArrowRight className="w-3 h-3 text-gray-400 group-hover:translate-x-1 transition-transform" />
                                                        <span className="truncate max-w-[80px] text-gray-900 dark:text-white font-bold">{tr.targetWarehouse?.name?.split(' ')[0]}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between mt-3">
                                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter flex items-center gap-1">
                                                            <HiOutlineSquares2X2 className="w-3 h-3" /> {tr.items?.length || 0} Itens
                                                        </span>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0"
                                                            onClick={() => generateGuiaRemessa(tr, companySettings)}
                                                        >
                                                            <HiOutlinePrinter className="w-4 h-4 text-primary-500" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-12 text-center text-gray-400 italic text-sm">Sem movimentos no período.</div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>

            {/* Modal de Nova Guias de Remessa */}
            <Modal
                isOpen={isTransferModalOpen}
                onClose={() => setIsTransferModalOpen(false)}
                title="Nova Transferência de Stock"
                size="lg"
            >
                <form onSubmit={handleCreateTransfer} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <Select
                            label="Armazém de Origem"
                            options={warehouses.map(w => ({ value: w.id, label: w.name }))}
                            value={transferData.sourceWarehouseId}
                            onChange={(e) => setTransferData({ ...transferData, sourceWarehouseId: e.target.value })}
                            required
                        />
                        <Select
                            label="Armazém de Destino"
                            options={warehouses.map(w => ({ value: w.id, label: w.name }))}
                            value={transferData.targetWarehouseId}
                            onChange={(e) => setTransferData({ ...transferData, targetWarehouseId: e.target.value })}
                            required
                        />
                    </div>

                    <div className="p-4 bg-gray-50 dark:bg-dark-900/50 rounded-2xl space-y-4 border dark:border-dark-700 shadow-inner">
                        <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-widest">Itens da Transferência</label>
                        {transferData.items.map((item, index) => (
                            <div key={index} className="flex gap-2 items-center bg-white dark:bg-dark-800 p-2 rounded-xl shadow-sm">
                                <div className="flex-1">
                                    <Select
                                        options={products.map(p => ({ value: p.id, label: `${p.name} (Disp: ${p.currentStock})` }))}
                                        value={item.productId}
                                        onChange={(e) => {
                                            const newItems = [...transferData.items];
                                            newItems[index].productId = e.target.value;
                                            setTransferData({ ...transferData, items: newItems });
                                        }}
                                        required
                                    />
                                </div>
                                <div className="w-24">
                                    <Input
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                        onChange={(e) => {
                                            const newItems = [...transferData.items];
                                            newItems[index].quantity = parseInt(e.target.value);
                                            setTransferData({ ...transferData, items: newItems });
                                        }}
                                        required
                                    />
                                </div>
                                <Button
                                    variant="ghost"
                                    className="p-2 text-red-500"
                                    onClick={() => removeItem(index)}
                                    disabled={transferData.items.length === 1}
                                >
                                    <HiOutlineTrash className="w-5 h-5" />
                                </Button>
                            </div>
                        ))}
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full border-dashed"
                            leftIcon={<HiOutlinePlus className="w-4 h-4" />}
                            onClick={addItem}
                        >
                            Adicionar Produto
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Responsável"
                            placeholder="Nome do responsável"
                            value={transferData.responsible}
                            onChange={(e) => setTransferData({ ...transferData, responsible: e.target.value })}
                            required
                        />
                        <Input
                            label="Motivo"
                            placeholder="Ex: Reposição de Stock"
                            value={transferData.reason}
                            onChange={(e) => setTransferData({ ...transferData, reason: e.target.value })}
                            required
                        />
                    </div>

                    <div className="flex gap-3 pt-4 border-t dark:border-dark-700 mt-6">
                        <Button variant="outline" className="flex-1" onClick={() => setIsTransferModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" className="flex-2 bg-primary-600 hover:bg-primary-700 text-white font-bold">
                            Registar Transferência
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
