import { useMemo, useState } from 'react';
import {
    HiOutlineDocumentText,
    HiOutlineBanknotes as HiOutlineCash,
    HiOutlineUsers,
    HiOutlineBuildingLibrary as HiOutlineLibrary,
    HiOutlineClipboardDocumentCheck as HiOutlineClipboardCheck,
    HiOutlineExclamationTriangle as HiOutlineExclamation,
    HiOutlineCalendarDays as HiOutlineCalendar,
    HiOutlineChartBar as HiOutlineTrendingUp,
    HiOutlineTruck,
} from 'react-icons/hi2';
import { useFiscalStore } from '../../stores/useFiscalStore';
import { Card, Badge } from '../ui';
import { formatCurrency } from '../../utils/helpers';
import { formatPeriod, getCurrentFiscalPeriod } from '../../utils/fiscalCalculations';

export default function FiscalDashboard() {
    const { getDashboardMetrics } = useFiscalStore();

    const [now] = useState(() => Date.now());
    const metrics = useMemo(() => getDashboardMetrics(), [getDashboardMetrics]);
    const currentPeriod = getCurrentFiscalPeriod();

    const getComplianceColor = (status: string) => {
        switch (status) {
            case 'compliant':
                return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
            case 'warning':
                return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
            case 'non_compliant':
                return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getComplianceLabel = (status: string) => {
        switch (status) {
            case 'compliant':
                return 'Em Conformidade';
            case 'warning':
                return 'Atenção Necessária';
            case 'non_compliant':
                return 'Não Conforme';
            default:
                return status;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">
                        Painel Fiscal
                    </h2>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1 italic">
                        Período atual: <span className="text-primary-600 font-black">{formatPeriod(currentPeriod)}</span>
                    </p>
                </div>

                {/* Compliance Status */}
                <div className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${getComplianceColor(metrics.complianceStatus)}`}>
                    <HiOutlineClipboardCheck className="w-5 h-5" />
                    {getComplianceLabel(metrics.complianceStatus)}
                </div>
            </div>

            {/* Current Month Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'IVA a Pagar', value: metrics.currentMonth.ivaPayable, sub: 'Este mês', icon: HiOutlineDocumentText,
                      cardBg: 'bg-blue-50/60 dark:bg-blue-950/30', cardBorder: 'border border-blue-200/70 dark:border-blue-800/40',
                      iconBg: 'bg-blue-100 dark:bg-blue-900/40', iconColor: 'text-blue-600 dark:text-blue-400', accent: 'bg-blue-500' },
                    { label: 'INSS Total', value: metrics.currentMonth.inssEmployee + metrics.currentMonth.inssEmployer,
                      sub: `Trab: ${formatCurrency(metrics.currentMonth.inssEmployee)} • Emp: ${formatCurrency(metrics.currentMonth.inssEmployer)}`,
                      icon: HiOutlineUsers,
                      cardBg: 'bg-emerald-50/60 dark:bg-emerald-950/30', cardBorder: 'border border-emerald-200/70 dark:border-emerald-800/40',
                      iconBg: 'bg-emerald-100 dark:bg-emerald-900/40', iconColor: 'text-emerald-600 dark:text-emerald-400', accent: 'bg-emerald-500' },
                    { label: 'IRPS Retido', value: metrics.currentMonth.irtRetained, sub: 'Este mês', icon: HiOutlineCash,
                      cardBg: 'bg-orange-50/60 dark:bg-orange-950/30', cardBorder: 'border border-orange-200/70 dark:border-orange-800/40',
                      iconBg: 'bg-orange-100 dark:bg-orange-900/40', iconColor: 'text-orange-600 dark:text-orange-400', accent: 'bg-orange-500' },
                    { label: 'Retenções Fonte', value: metrics.currentMonth.withholdingTotal, sub: 'Fornecedores', icon: HiOutlineLibrary,
                      cardBg: 'bg-purple-50/60 dark:bg-purple-950/30', cardBorder: 'border border-purple-200/70 dark:border-purple-800/40',
                      iconBg: 'bg-purple-100 dark:bg-purple-900/40', iconColor: 'text-purple-600 dark:text-purple-400', accent: 'bg-purple-500' },
                ].map((s, i) => (
                    <div key={i} className={`relative group overflow-hidden rounded-xl shadow-sm hover:shadow-md transition-all duration-300 ${s.cardBg} ${s.cardBorder}`}>
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className={`p-3 rounded-xl ${s.iconBg} ${s.iconColor} transition-transform group-hover:scale-110 duration-300`}>
                                    <s.icon className="w-6 h-6" />
                                </div>
                            </div>
                            <h3 className="text-gray-500 dark:text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1">{s.label}</h3>
                            <p className="text-2xl font-black tracking-tighter text-gray-900 dark:text-white mb-1 leading-none">{formatCurrency(s.value)}</p>
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">{s.sub}</p>
                        </div>
                        <div className={`absolute bottom-0 left-0 h-0.5 transition-all duration-500 group-hover:w-full w-8 ${s.accent}`} />
                    </div>
                ))}
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* YTD Summary */}
                <Card variant="glass" padding="md">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                            <HiOutlineTrendingUp className="w-5 h-5 text-primary-600" />
                        </div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-700 dark:text-gray-300">
                            Acumulado do Ano (YTD)
                        </h3>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-dark-800 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                <span className="text-gray-700 dark:text-gray-300">IVA Total</span>
                            </div>
                            <span className="font-bold text-gray-900 dark:text-white">
                                {formatCurrency(metrics.ytd.ivaTotal)}
                            </span>
                        </div>

                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-dark-800 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                <span className="text-gray-700 dark:text-gray-300">INSS Total</span>
                            </div>
                            <span className="font-bold text-gray-900 dark:text-white">
                                {formatCurrency(metrics.ytd.inssTotal)}
                            </span>
                        </div>

                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-dark-800 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                                <span className="text-gray-700 dark:text-gray-300">IRPS Total</span>
                            </div>
                            <span className="font-bold text-gray-900 dark:text-white">
                                {formatCurrency(metrics.ytd.irtTotal)}
                            </span>
                        </div>

                        <div className="border-t border-gray-200 dark:border-dark-700 pt-4 mt-4">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600 dark:text-gray-400">Relatórios Submetidos</span>
                                <Badge variant="primary">{metrics.ytd.reportsSubmitted}</Badge>
                            </div>
                            <div className="flex justify-between items-center mt-2">
                                <span className="text-gray-600 dark:text-gray-400">Relatórios Aceites</span>
                                <Badge variant="success">{metrics.ytd.reportsAccepted}</Badge>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Pending Deadlines */}
                <Card variant="glass" padding="md">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                            <HiOutlineCalendar className="w-5 h-5 text-amber-600" />
                        </div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-700 dark:text-gray-300">
                            Prazos Próximos
                        </h3>
                    </div>

                    {metrics.pendingDeadlines.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                            <HiOutlineClipboardCheck className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>Sem prazos pendentes</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {metrics.pendingDeadlines.map((deadline) => {
                                const dueDate = new Date(deadline.dueDate);
                                const daysUntilDue = Math.ceil((dueDate.getTime() - now) / (1000 * 60 * 60 * 24));
                                const isUrgent = daysUntilDue <= 3;

                                return (
                                    <div
                                        key={deadline.id}
                                        className={`p-3 rounded-lg border ${isUrgent
                                            ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10'
                                            : 'border-gray-200 bg-gray-50 dark:border-dark-700 dark:bg-dark-800'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className={`font-medium ${isUrgent
                                                    ? 'text-red-800 dark:text-red-400'
                                                    : 'text-gray-900 dark:text-white'
                                                    }`}>
                                                    {deadline.title}
                                                </p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                                    {deadline.description}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-sm font-medium ${isUrgent
                                                    ? 'text-red-600 dark:text-red-400'
                                                    : 'text-gray-600 dark:text-gray-400'
                                                    }`}>
                                                    {new Date(deadline.dueDate).toLocaleDateString('pt-MZ')}
                                                </p>
                                                <Badge variant={isUrgent ? 'danger' : 'warning'} size="sm">
                                                    {daysUntilDue} dias
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Card>
            </div>

            {/* Logistics Performance - Deep Integration Section */}
            {metrics.logisticsMetrics && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <HiOutlineTruck className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            Desempenho Logístico
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                            { label: 'Receita Logística', value: metrics.logisticsMetrics.income, sub: `${metrics.logisticsMetrics.count} transaces`, icon: HiOutlineTrendingUp, color: 'text-green-500', textColor: 'text-green-600', border: 'border-l-green-500' },
                            { label: 'Custos Manutenção', value: metrics.logisticsMetrics.maintenanceCosts, sub: 'Dedução automática', icon: HiOutlineExclamation, color: 'text-red-500', textColor: 'text-red-600', border: 'border-l-red-500' },
                            { label: 'Lucro Operacional', value: metrics.logisticsMetrics.profit, sub: 'Margem Bruta (EBIT)', icon: HiOutlineTrendingUp, color: 'text-blue-500', textColor: 'text-blue-600', border: 'border-l-blue-500' },
                        ].map((info, idx) => (
                            <Card key={idx} variant="glass" className={`p-5 border-l-4 ${info.border} group transition-all hover:scale-[1.02]`}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{info.label}</span>
                                    <info.icon className={`w-5 h-5 ${info.color}`} />
                                </div>
                                <p className="text-2xl font-black tracking-tighter text-gray-900 dark:text-white leading-none">
                                    {formatCurrency(info.value)}
                                </p>
                                <p className={`text-[9px] font-bold mt-1 uppercase tracking-tighter ${info.textColor}`}>
                                    {info.sub}
                                </p>
                            </Card>
                        ))}
            </div>
                </div>
            )}

            {/* Recent Retentions */}
            <Card variant="glass" padding="none" className="overflow-hidden border border-gray-100 dark:border-dark-700/50 shadow-xl">
                <div className="p-6 border-b border-gray-100 dark:border-dark-700/50 flex items-center justify-between bg-white/30 dark:bg-dark-900/30">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                            <HiOutlineDocumentText className="w-5 h-5 text-primary-600" />
                        </div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-700 dark:text-gray-300">
                            Retenções Recentes
                        </h3>
                    </div>
                    <Badge variant="gray" className="font-black text-[9px] uppercase tracking-widest">{metrics.recentRetentions.length} registos</Badge>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50/80 dark:bg-dark-800/80 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 dark:border-dark-700/50 whitespace-nowrap">
                                <th className="px-6 py-4 text-left font-black">Tipo</th>
                                <th className="px-6 py-4 text-left font-black">Documento</th>
                                <th className="px-6 py-4 text-left font-black">Entidade</th>
                                <th className="px-6 py-4 text-right font-black">Base Tributvel</th>
                                <th className="px-6 py-4 text-right font-black">Retido</th>
                                <th className="px-6 py-4 text-center font-black">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-dark-700/50">
                                {metrics.recentRetentions.slice(0, 5).map((retention) => (
                                    <tr key={retention.id} className="hover:bg-gray-50 dark:hover:bg-dark-800">
                                        <td className="px-4 py-3">
                                            <Badge variant="primary">
                                                {retention.type.toUpperCase().replace('_', ' ')}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-sm text-gray-900 dark:text-white">
                                            {retention.documentNumber}
                                        </td>
                                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                                            {retention.entityName}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-white">
                                            {formatCurrency(retention.baseAmount)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono font-bold text-primary-600 dark:text-primary-400">
                                            {formatCurrency(retention.retainedAmount)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <Badge
                                                variant={
                                                    retention.status === 'paid'
                                                        ? 'success'
                                                        : retention.status === 'applied'
                                                            ? 'primary'
                                                            : 'warning'
                                                }
                                            >
                                                {retention.status === 'pending' && 'Pendente'}
                                                {retention.status === 'applied' && 'Aplicado'}
                                                {retention.status === 'reported' && 'Reportado'}
                                                {retention.status === 'paid' && 'Pago'}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
            </Card>

            {/* Info Banner */}
            <Card padding="md" className="bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 border-primary-100 dark:border-primary-800">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-white dark:bg-dark-800 rounded-lg shadow-sm">
                        <HiOutlineExclamation className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                            Lembre-se dos Prazos Fiscais
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Os impostos devem ser declarados e pagos at ao <strong>dia 20 de cada mês</strong> referente ao mês anterior.
                            Atrasos podem resultar em multas e juros de mora.
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
}
