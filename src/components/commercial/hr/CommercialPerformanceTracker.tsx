import { useMemo, useState } from 'react';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartTooltip,
    Legend
} from 'recharts';
import {
    HiOutlineChartBar,
    HiOutlineTrophy,
    HiOutlineUserGroup,
    HiOutlineArrowTrendingUp,
    HiOutlineStar,
    HiOutlinePlus,
    HiOutlineBuildingStorefront,
    HiOutlineCalendarDays
} from 'react-icons/hi2';
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Select } from '../../ui';
import { LoadingOverlay } from '../../ui/Loading';
import { useSalesTargets, useSalesTargetsSummary } from '../../../hooks/useSalesTargets';
import { useWarehouses } from '../../../hooks/useWarehouses';
import { SalesTargetModal } from './SalesTargetModal';
import { formatCurrency } from '../../../utils/helpers';
import type { SalesTarget } from '../../../services/api';

const PERIOD_LABEL: Record<SalesTarget['type'], string> = {
    DAILY: 'Diária',
    WEEKLY: 'Semanal',
    MONTHLY: 'Mensal'
};

export function CommercialPerformanceTracker() {
    const [warehouseFilter, setWarehouseFilter] = useState<string>('');
    const [periodFilter, setPeriodFilter] = useState<'' | SalesTarget['type']>('');

    const { targets, isLoading } = useSalesTargets({
        warehouseId: warehouseFilter || undefined,
    });
    const { data: summary } = useSalesTargetsSummary();
    const { warehouses } = useWarehouses();

    const [selectedTarget, setSelectedTarget] = useState<SalesTarget | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const filteredTargets = useMemo(() => {
        if (!periodFilter) return targets;
        return targets.filter((t: SalesTarget) => t.type === periodFilter);
    }, [targets, periodFilter]);

    if (isLoading) {
        return (
            <div className="relative min-h-[400px]">
                <LoadingOverlay
                    fullScreen={false}
                    message="A processar dados de performance..."
                    subtext="Inteligência Comercial em tempo real"
                />
            </div>
        );
    }

    const chartData = filteredTargets.map((t: SalesTarget) => ({
        name: [t.employee?.name, t.warehouse?.code].filter(Boolean).join(' · ') || 'Global',
        ventas: t.current || 0,
        meta: Number(t.value),
        progress: t.progress || 0
    }));

    const handleAdd = () => {
        setSelectedTarget(null);
        setIsModalOpen(true);
    };

    const handleEdit = (target: SalesTarget) => {
        setSelectedTarget(target);
        setIsModalOpen(true);
    };

    const activeWarehouses = (warehouses || []).filter(w => w.isActive !== false);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-wrap gap-4 justify-between items-end">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2 uppercase tracking-tighter">
                        <HiOutlineChartBar className="text-primary-500" />
                        Performance Comercial
                    </h2>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mt-1">
                        Metas diárias · semanais · mensais — por operador e filial
                    </p>
                </div>
                <div className="flex gap-2 items-end">
                    <Select
                        label="Filial"
                        value={warehouseFilter}
                        onChange={(e) => setWarehouseFilter(e.target.value)}
                        options={[
                            { value: '', label: 'Todas as filiais' },
                            ...activeWarehouses.map(w => ({ value: w.id, label: `${w.code} — ${w.name}` }))
                        ]}
                    />
                    <Select
                        label="Período"
                        value={periodFilter}
                        onChange={(e) => setPeriodFilter(e.target.value as '' | SalesTarget['type'])}
                        options={[
                            { value: '', label: 'Todos os períodos' },
                            { value: 'DAILY', label: 'Diária' },
                            { value: 'WEEKLY', label: 'Semanal' },
                            { value: 'MONTHLY', label: 'Mensal' },
                        ]}
                    />
                    <Button
                        variant="primary"
                        size="sm"
                        leftIcon={<HiOutlinePlus />}
                        onClick={handleAdd}
                    >
                        Nova Meta
                    </Button>
                </div>
            </div>

            {summary && summary.totals.count > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card variant="glass" className="p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Meta</p>
                        <p className="text-lg font-black text-gray-900 dark:text-white mt-1">{formatCurrency(summary.totals.target)}</p>
                    </Card>
                    <Card variant="glass" className="p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Realizado</p>
                        <p className="text-lg font-black text-emerald-600 mt-1">{formatCurrency(summary.totals.actual)}</p>
                    </Card>
                    <Card variant="glass" className="p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Progresso Global</p>
                        <p className={`text-lg font-black mt-1 ${summary.totals.progress >= 100 ? 'text-emerald-600' : 'text-primary-600'}`}>
                            {summary.totals.progress}%
                        </p>
                    </Card>
                    <Card variant="glass" className="p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Metas Activas</p>
                        <p className="text-lg font-black text-gray-900 dark:text-white mt-1">{summary.totals.count}</p>
                    </Card>
                </div>
            )}

            {filteredTargets.length === 0 ? (
                <Card variant="glass" className="p-12 text-center flex flex-col items-center border-dashed border-2">
                    <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-dark-700 flex items-center justify-center mb-4">
                        <HiOutlineChartBar className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nenhuma meta configurada</h3>
                    <p className="text-gray-500 mb-6 max-w-sm">
                        {warehouseFilter || periodFilter
                            ? 'Não há metas para o filtro seleccionado. Ajusta os filtros ou cria uma nova meta.'
                            : 'Comece por configurar metas diárias, semanais ou mensais para a equipa comercial.'}
                    </p>
                    <Button variant="outline" onClick={handleAdd}>Configurar Meta</Button>
                </Card>
            ) : (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card variant="glass" className="lg:col-span-2 p-6 overflow-visible">
                            <h4 className="font-black text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-6 flex items-center gap-2">
                                <HiOutlineArrowTrendingUp className="text-primary-500 w-4 h-4" />
                                Vendas vs Metas
                            </h4>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.05} />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                        <RechartTooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px', background: 'rgba(255, 255, 255, 0.9)' }}
                                            formatter={(value) => formatCurrency(Number(value))}
                                        />
                                        <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 700, paddingTop: '20px', textTransform: 'uppercase', letterSpacing: '0.05em' }} />
                                        <Bar dataKey="ventas" name="Vendas Atuais" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="meta" name="Meta Estipulada" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>

                        <Card variant="glass" className="p-6">
                            <h4 className="font-black text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-6 flex items-center gap-2">
                                <HiOutlineTrophy className="text-yellow-500 w-4 h-4" />
                                Top Performers
                            </h4>
                            <div className="space-y-4">
                                {[...filteredTargets].sort((a, b) => (b.current || 0) - (a.current || 0)).slice(0, 3).map((item, idx) => (
                                    <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-dark-900/50 border border-gray-100 dark:border-dark-700/50 transition-all hover:scale-[1.02] cursor-pointer group" onClick={() => handleEdit(item)}>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-[10px] text-white shadow-lg transition-transform group-hover:rotate-12
                                            ${idx === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-600' : idx === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-500' : 'bg-gradient-to-br from-orange-400 to-red-600'}`}>
                                            {idx + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-black text-[11px] text-gray-900 dark:text-white uppercase tracking-wider truncate">{item.employee?.name || 'Equipa Global'}</p>
                                            <p className="text-[10px] font-bold text-gray-400 truncate">
                                                {item.warehouse?.name || 'Todas as filiais'} · {formatCurrency(item.current || 0)}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <Badge variant={item.progress && item.progress >= 100 ? "success" : "warning"} size="sm" className="font-black">
                                                {item.progress}%
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-8 p-4 bg-primary-50 dark:bg-primary-900/10 rounded-xl border border-primary-100 dark:border-primary-800/30">
                                <div className="flex items-center gap-2 text-primary-700 dark:text-primary-400 font-black text-[10px] uppercase tracking-widest mb-2">
                                    <HiOutlineStar />
                                    <span>IA Insight Premium</span>
                                </div>
                                <p className="text-[11px] text-primary-600 dark:text-primary-300 leading-relaxed font-medium">
                                    O desempenho médio é de <strong>{Math.round(filteredTargets.reduce((acc: number, t: SalesTarget) => acc + (t.progress || 0), 0) / (filteredTargets.length || 1))}%</strong>.
                                    Considere ajustar as metas diárias para optimizar o fluxo de caixa vespertino.
                                </p>
                            </div>
                        </Card>
                    </div>

                    {summary && (summary.byWarehouse.length > 0 || summary.byType.length > 0) && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card variant="glass" className="p-6">
                                <h4 className="font-black text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-4 flex items-center gap-2">
                                    <HiOutlineBuildingStorefront className="text-primary-500 w-4 h-4" />
                                    Comparativo por Filial
                                </h4>
                                <div className="space-y-3">
                                    {summary.byWarehouse.map((w) => (
                                        <div key={w.warehouseId ?? 'global'} className="space-y-1.5">
                                            <div className="flex justify-between items-center text-[11px]">
                                                <span className="font-black uppercase tracking-wider text-gray-700 dark:text-gray-200 truncate">{w.warehouseName}</span>
                                                <span className="font-bold text-gray-500 dark:text-gray-400">
                                                    {formatCurrency(w.actual)} / {formatCurrency(w.target)}
                                                </span>
                                            </div>
                                            <div className="w-full h-2 bg-gray-100 dark:bg-dark-900/50 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-700 ${w.progress >= 100 ? 'bg-emerald-500' : 'bg-primary-500'}`}
                                                    style={{ width: `${Math.min(100, w.progress)}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between text-[9px] font-black uppercase tracking-widest">
                                                <span className="text-gray-400">{w.count} {w.count === 1 ? 'meta' : 'metas'}</span>
                                                <span className={w.progress >= 100 ? 'text-emerald-500' : 'text-primary-500'}>{w.progress}%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Card>

                            <Card variant="glass" className="p-6">
                                <h4 className="font-black text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-4 flex items-center gap-2">
                                    <HiOutlineCalendarDays className="text-primary-500 w-4 h-4" />
                                    Comparativo por Período
                                </h4>
                                <div className="space-y-3">
                                    {summary.byType.filter(b => b.count > 0).map((b) => (
                                        <div key={b.type} className="space-y-1.5">
                                            <div className="flex justify-between items-center text-[11px]">
                                                <span className="font-black uppercase tracking-wider text-gray-700 dark:text-gray-200">{PERIOD_LABEL[b.type]}</span>
                                                <span className="font-bold text-gray-500 dark:text-gray-400">
                                                    {formatCurrency(b.actual)} / {formatCurrency(b.target)}
                                                </span>
                                            </div>
                                            <div className="w-full h-2 bg-gray-100 dark:bg-dark-900/50 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-700 ${b.progress >= 100 ? 'bg-emerald-500' : 'bg-primary-500'}`}
                                                    style={{ width: `${Math.min(100, b.progress)}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between text-[9px] font-black uppercase tracking-widest">
                                                <span className="text-gray-400">{b.count} {b.count === 1 ? 'meta' : 'metas'}</span>
                                                <span className={b.progress >= 100 ? 'text-emerald-500' : 'text-primary-500'}>{b.progress}%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {filteredTargets.map((item: SalesTarget) => (
                            <Card key={item.id} variant="glass" className="p-5 hover:shadow-xl transition-all group cursor-pointer" onClick={() => handleEdit(item)}>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-2.5 bg-primary-100/50 dark:bg-primary-900/30 rounded-xl text-primary-600 group-hover:scale-110 transition-transform">
                                        <HiOutlineUserGroup className="w-5 h-5" />
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <Badge variant={item.progress && item.progress >= 100 ? 'success' : 'info'} size="sm" className="font-black tracking-widest text-[9px]">
                                            {PERIOD_LABEL[item.type].toUpperCase()}
                                        </Badge>
                                        {item.warehouse && (
                                            <Badge variant="gray" size="sm" className="font-black tracking-widest text-[9px]">
                                                {item.warehouse.code}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <h5 className="font-black text-xs text-gray-900 dark:text-white uppercase tracking-widest mb-1 truncate">
                                    {item.employee?.name || 'Equipa Global'}
                                </h5>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3 truncate">
                                    {item.warehouse?.name || 'Todas as filiais'}
                                </p>
                                <p className="text-[10px] font-black text-gray-400 uppercase mb-5 tracking-tighter">
                                    {formatCurrency(item.current || 0)} <span className="mx-1 text-gray-300">/</span> {formatCurrency(Number(item.value))}
                                </p>
                                <div className="space-y-2.5">
                                    <div className="flex justify-between text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">
                                        <span>Progresso</span>
                                        <span className={item.progress && item.progress >= 100 ? 'text-emerald-500' : 'text-primary-500'}>{item.progress}%</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-gray-100 dark:bg-dark-900/50 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-1000 ${item.progress && item.progress >= 100 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-primary-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]'}`}
                                            style={{ width: `${Math.min(100, item.progress || 0)}%` }}
                                        />
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </>
            )}

            <SalesTargetModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setSelectedTarget(null); }}
                target={selectedTarget}
            />
        </div>
    );
}
