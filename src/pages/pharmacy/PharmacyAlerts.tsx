/**
 * PharmacyAlerts
 *
 * Painel centralizado de alertas inteligentes da farmácia:
 * - Medicamentos sem stock / stock baixo
 * - Validades críticas e próximas
 * - Recalls activos
 * - Discrepâncias de narcóticos
 * - Receitas pendentes
 * - Sugestáões de reposição (reorder)
 */

import { useState, useEffect } from 'react';
import {
    HiOutlineExclamationCircle,
    HiOutlineExclamationTriangle as HiOutlineExclamation,
    HiOutlineInformationCircle,
    HiOutlineArrowPath as HiOutlineRefresh,
    HiOutlineShoppingCart,
    HiOutlineClipboardDocumentList as HiOutlineClipboardList,
    HiOutlineFunnel as HiOutlineFilter,
} from 'react-icons/hi2';
import { Card, Button, LoadingSpinner } from '../../components/ui';
import { cn, formatCurrency } from '../../utils/helpers';
import { pharmacyAPI } from '../../services/api';
import toast from 'react-hot-toast';

type Severity = 'critical' | 'warning' | 'info';
type AlertType = 'all' | 'critical' | 'warning' | 'info';

interface Alert {
    type: string;
    severity: Severity;
    title: string;
    message: string;
    [key: string]: any;
}

interface ReorderSuggestion {
    medicationId: string;
    productCode: string;
    productName: string;
    currentStock: number;
    reorderPoint: number;
    reorderQuantity: number;
    estimatedCost: number;
    urgency: 'critical' | 'high' | 'medium';
    supplier?: { name: string; email?: string; phone?: string } | null;
}

const SEVERITY_CONFIG: Record<Severity, { icon: any; bg: string; border: string; text: string; badge: string }> = {
    critical: {
        icon: HiOutlineExclamationCircle,
        bg: 'bg-red-50 dark:bg-red-900/20',
        border: 'border-red-400',
        text: 'text-red-700 dark:text-red-400',
        badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
    },
    warning: {
        icon: HiOutlineExclamation,
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        border: 'border-amber-400',
        text: 'text-amber-700 dark:text-amber-400',
        badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
    },
    info: {
        icon: HiOutlineInformationCircle,
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        border: 'border-blue-400',
        text: 'text-blue-700 dark:text-blue-400',
        badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
    }
};

const URGENCY_COLOR: Record<string, string> = {
    critical: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-yellow-100 text-yellow-700'
};

export default function PharmacyAlerts() {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [summary, setSummary] = useState({ critical: 0, warning: 0, info: 0, total: 0 });
    const [reorderSuggestions, setReorderSuggestions] = useState<ReorderSuggestion[]>([]);
    const [reorderTotal, setReorderTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [activeFilter, setActiveFilter] = useState<AlertType>('all');
    const [activeTab, setActiveTab] = useState<'alerts' | 'reorder'>('alerts');

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [alertsData, reorderData] = await Promise.all([
                pharmacyAPI.getAlerts(),
                pharmacyAPI.getReorderSuggestions()
            ]);
            setAlerts(alertsData.alerts || []);
            setSummary(alertsData.summary || { critical: 0, warning: 0, info: 0, total: 0 });
            setReorderSuggestions(reorderData.suggestions || []);
            setReorderTotal(reorderData.totalEstimatedCost || 0);
        } catch (err: any) {
            toast.error('Erro ao carregar alertas: ' + (err.message || 'Erro desconhecido'));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const filteredAlerts = activeFilter === 'all' ? alerts : alerts.filter(a => a.severity === activeFilter);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">Alertas Inteligentes</h1>
                    <p className="text-gray-500 dark:text-gray-400">Monitorização em tempo real da farmácia</p>
                </div>
                <Button
                    variant="ghost"
                    className="bg-emerald-50/50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-500/20 shadow-sm font-black text-[10px] uppercase tracking-widest"
                    leftIcon={<HiOutlineRefresh className="w-4 h-4" />}
                    onClick={loadData}
                    disabled={isLoading}
                >
                    {isLoading ? 'A carregar...' : 'Atualizar'}
                </Button>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card padding="md" className="bg-gray-100/40 dark:bg-gray-900/20 border border-gray-200/50 dark:border-gray-800/30 shadow-card-strong transition-all hover:scale-[1.02] overflow-hidden group">
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-10 h-10 rounded-xl bg-gray-200/60 dark:bg-gray-900/40 border border-gray-500/20 flex items-center justify-center text-gray-700 dark:text-gray-300 font-black shadow-inner group-hover:scale-110 transition-transform">
                            <HiOutlineInformationCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-600/70 dark:text-gray-400/60">Total</p>
                            <p className="text-xl font-black text-gray-900 dark:text-white leading-none mt-1">{summary.total}</p>
                        </div>
                    </div>
                </Card>
                <Card padding="md" className="bg-red-100/40 dark:bg-red-900/20 border border-red-200/50 dark:border-red-800/30 shadow-card-strong transition-all hover:scale-[1.02] overflow-hidden group">
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-10 h-10 rounded-xl bg-red-200/60 dark:bg-red-900/40 border border-red-500/20 flex items-center justify-center text-red-700 dark:text-red-300 font-black shadow-inner group-hover:scale-110 transition-transform">
                            <HiOutlineExclamationCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-red-600/70 dark:text-red-400/60">Críticos</p>
                            <p className="text-xl font-black text-red-900 dark:text-white leading-none mt-1">{summary.critical}</p>
                        </div>
                    </div>
                </Card>
                <Card padding="md" className="bg-amber-100/40 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-800/30 shadow-card-strong transition-all hover:scale-[1.02] overflow-hidden group">
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-10 h-10 rounded-xl bg-amber-200/60 dark:bg-amber-900/40 border border-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-300 font-black shadow-inner group-hover:scale-110 transition-transform">
                            <HiOutlineExclamation className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600/70 dark:text-amber-400/60">Avisos</p>
                            <p className="text-xl font-black text-amber-900 dark:text-white leading-none mt-1">{summary.warning}</p>
                        </div>
                    </div>
                </Card>
                <Card padding="md" className="bg-blue-100/40 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-800/30 shadow-card-strong transition-all hover:scale-[1.02] overflow-hidden group">
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-10 h-10 rounded-xl bg-blue-200/60 dark:bg-blue-900/40 border border-blue-500/20 flex items-center justify-center text-blue-700 dark:text-blue-300 font-black shadow-inner group-hover:scale-110 transition-transform">
                            <HiOutlineInformationCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-600/70 dark:text-blue-400/60">Info</p>
                            <p className="text-xl font-black text-blue-900 dark:text-white leading-none mt-1">{summary.info}</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Tab selector */}
            <div className="flex gap-2">
                <button
                    onClick={() => setActiveTab('alerts')}
                    className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm',
                        activeTab === 'alerts'
                            ? 'bg-emerald-500 text-white shadow-emerald-500/20 scale-105'
                            : 'bg-white dark:bg-dark-800 text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-dark-700 hover:border-emerald-400')}
                >
                    <HiOutlineClipboardList className="w-4 h-4" />
                    Alertas ({summary.total})
                </button>
                <button
                    onClick={() => setActiveTab('reorder')}
                    className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm',
                        activeTab === 'reorder'
                            ? 'bg-emerald-500 text-white shadow-emerald-500/20 scale-105'
                            : 'bg-white dark:bg-dark-800 text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-dark-700 hover:border-emerald-400')}
                >
                    <HiOutlineShoppingCart className="w-4 h-4" />
                    Reposição ({reorderSuggestions.length})
                </button>
            </div>

            {/* ALERTS TAB */}
            {activeTab === 'alerts' && (
                <div className="space-y-4">
                    {/* Filter */}
                    <div className="flex items-center gap-2">
                        <HiOutlineFilter className="w-4 h-4 text-gray-400" />
                        {(['all', 'critical', 'warning', 'info'] as AlertType[]).map(f => (
                            <button
                                key={f}
                                onClick={() => setActiveFilter(f)}
                                className={cn('px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm',
                                    activeFilter === f
                                        ? 'bg-teal-500 text-white shadow-teal-500/20'
                                        : 'bg-white dark:bg-dark-800 text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-dark-700 hover:border-teal-400')}
                            >
                                {f === 'all' ? 'Todos' : f === 'critical' ? 'Críticos' : f === 'warning' ? 'Avisos' : 'Info'}
                                {f !== 'all' && (
                                    <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-white/20">
                                        {f === 'critical' ? summary.critical : f === 'warning' ? summary.warning : summary.info}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {isLoading && (
                        <div className="flex justify-center py-12">
                            <LoadingSpinner size="lg" />
                        </div>
                    )}

                    {!isLoading && filteredAlerts.length === 0 && (
                        <Card className="p-12 text-center">
                            <HiOutlineInformationCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                            <p className="text-gray-500 font-medium">Sem alertas {activeFilter !== 'all' ? `do tipo "${activeFilter}"` : ''}</p>
                        </Card>
                    )}

                    <div className="space-y-2">
                        {filteredAlerts.map((alert, idx) => {
                            const cfg = SEVERITY_CONFIG[alert.severity];
                            const Icon = cfg.icon;
                            return (
                                <div key={idx} className={cn('flex items-start gap-3 p-4 rounded-lg border-l-4', cfg.bg, cfg.border)}>
                                    <Icon className={cn('w-5 h-5 mt-0.5 flex-shrink-0', cfg.text)} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', cfg.badge)}>
                                                {alert.title}
                                            </span>
                                            {alert.productName && (
                                                <span className="text-xs text-gray-500 truncate">{alert.productName}</span>
                                            )}
                                        </div>
                                        <p className={cn('text-sm mt-1', cfg.text)}>{alert.message}</p>
                                        {alert.expiryDate && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                Vence: {new Date(alert.expiryDate).toLocaleDateString('pt-MZ')}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* REORDER TAB */}
            {activeTab === 'reorder' && (
                <div className="space-y-4">
                    {/* Summary banner */}
                    <Card className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-indigo-700 dark:text-indigo-400">
                                    {reorderSuggestions.length} medicamento(s) abaixo do ponto de reposição
                                </p>
                                <p className="text-xs text-indigo-600 mt-0.5">
                                    Custo estimado total de reposição: <strong>{formatCurrency(reorderTotal)}</strong>
                                </p>
                            </div>
                            <HiOutlineShoppingCart className="w-8 h-8 text-indigo-400" />
                        </div>
                    </Card>

                    {isLoading && (
                        <div className="flex justify-center py-12">
                            <LoadingSpinner size="lg" />
                        </div>
                    )}

                    {!isLoading && reorderSuggestions.length === 0 && (
                        <Card className="p-12 text-center">
                            <HiOutlineShoppingCart className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                            <p className="text-gray-500 font-medium">Nenhuma sugestão de reposição</p>
                            <p className="text-gray-400 text-sm mt-1">Todos os medicamentos estáão acima do ponto de reposição</p>
                        </Card>
                    )}

                    <div className="space-y-3">
                        {reorderSuggestions.map(s => (
                            <Card key={s.medicationId} className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-gray-900 dark:text-white">{s.productName}</span>
                                            <span className="text-xs text-gray-400 font-mono">{s.productCode}</span>
                                            <span className={cn('text-xs px-2 py-0.5 rounded-full font-bold capitalize', URGENCY_COLOR[s.urgency] || 'bg-gray-100 text-gray-600')}>
                                                {s.urgency === 'critical' ? 'Urgente' : s.urgency === 'high' ? 'Alta' : 'Média'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                                            <span>Stock actual: <strong className="text-gray-900 dark:text-white">{s.currentStock}</strong></span>
                                            <span>Ponto reposição: <strong>{s.reorderPoint}</strong></span>
                                            <span>Qty sugerida: <strong className="text-teal-600">{s.reorderQuantity}</strong></span>
                                        </div>
                                        {s.supplier && (
                                            <div className="mt-2 text-xs text-gray-500">
                                                Fornecedor: <span className="font-medium text-gray-700 dark:text-gray-300">{s.supplier.name}</span>
                                                {s.supplier.phone && <> · {s.supplier.phone}</>}
                                                {s.supplier.email && <> · {s.supplier.email}</>}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-xs text-gray-500">Custo Estimado</p>
                                        <p className="text-lg font-black text-indigo-600">{formatCurrency(s.estimatedCost)}</p>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
