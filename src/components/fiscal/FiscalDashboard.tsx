import { useMemo } from 'react';
import {
    HiOutlineDocumentText,
    HiOutlineCash,
    HiOutlineUsers,
    HiOutlineLibrary,
    HiOutlineClipboardCheck,
    HiOutlineExclamation,
    HiOutlineCalendar,
    HiOutlineTrendingUp,
    HiOutlineTruck,
} from 'react-icons/hi';
import { useFiscalStore } from '../../stores/useFiscalStore';
import { Card, Badge } from '../ui';
import { formatCurrency } from '../../utils/helpers';
import { formatPeriod, getCurrentFiscalPeriod } from '../../utils/fiscalCalculations';

export default function FiscalDashboard() {
    const { getDashboardMetrics, retentions, fiscalReports, deadlines, logisticsMetrics } = useFiscalStore();

    const metrics = useMemo(() => getDashboardMetrics(), [retentions, fiscalReports, deadlines, logisticsMetrics]);
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
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Painel Fiscal
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Período atual: <span className="font-medium">{formatPeriod(currentPeriod)}</span>
                    </p>
                </div>

                {/* Compliance Status */}
                <div className={`px-4 py-2 rounded-xl font-medium flex items-center gap-2 ${getComplianceColor(metrics.complianceStatus)}`}>
                    <HiOutlineClipboardCheck className="w-5 h-5" />
                    {getComplianceLabel(metrics.complianceStatus)}
                </div>
            </div>

            {/* Current Month Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* IVA Card */}
                <Card padding="md" className="relative overflow-hidden">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">IVA a Pagar</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                {formatCurrency(metrics.currentMonth.ivaPayable)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Este mês
                            </p>
                        </div>
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                            <HiOutlineDocumentText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500"></div>
                </Card>

                {/* INSS Card */}
                <Card padding="md" className="relative overflow-hidden">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">INSS Total</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                {formatCurrency(metrics.currentMonth.inssEmployee + metrics.currentMonth.inssEmployer)}
                            </p>
                            <div className="flex gap-2 mt-1">
                                <span className="text-xs text-gray-500">
                                    Trab: {formatCurrency(metrics.currentMonth.inssEmployee)}
                                </span>
                                <span className="text-xs text-gray-500">
                                    Emp: {formatCurrency(metrics.currentMonth.inssEmployer)}
                                </span>
                            </div>
                        </div>
                        <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                            <HiOutlineUsers className="w-6 h-6 text-green-600 dark:text-green-400" />
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-green-500"></div>
                </Card>

                {/* IRPS Card */}
                <Card padding="md" className="relative overflow-hidden">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">IRPS Retido</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                {formatCurrency(metrics.currentMonth.irtRetained)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Este mês
                            </p>
                        </div>
                        <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                            <HiOutlineCash className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-500"></div>
                </Card>

                {/* Withholding Card */}
                <Card padding="md" className="relative overflow-hidden">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Retenções Fonte</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                {formatCurrency(metrics.currentMonth.withholdingTotal)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Fornecedores
                            </p>
                        </div>
                        <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                            <HiOutlineLibrary className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-500"></div>
                </Card>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* YTD Summary */}
                <Card padding="md">
                    <div className="flex items-center gap-2 mb-4">
                        <HiOutlineTrendingUp className="w-5 h-5 text-primary-500" />
                        <h3 className="font-semibold text-gray-900 dark:text-white">
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
                <Card padding="md">
                    <div className="flex items-center gap-2 mb-4">
                        <HiOutlineCalendar className="w-5 h-5 text-primary-500" />
                        <h3 className="font-semibold text-gray-900 dark:text-white">
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
                                const daysUntilDue = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
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
                        <Card padding="md" className="bg-green-50/50 dark:bg-green-900/5 border-green-100 dark:border-green-900/20">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-green-700 dark:text-green-400">Receita Logística</span>
                                <HiOutlineTrendingUp className="w-5 h-5 text-green-500" />
                            </div>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">
                                {formatCurrency(metrics.logisticsMetrics.income)}
                            </p>
                            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                {metrics.logisticsMetrics.count} transações registadas
                            </p>
                        </Card>

                        <Card padding="md" className="bg-red-50/50 dark:bg-red-900/5 border-red-100 dark:border-red-900/20">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-red-700 dark:text-red-400">Custos de Manutenção</span>
                                <div className="group relative">
                                    <HiOutlineExclamation className="w-5 h-5 text-red-500 cursor-help" />
                                    <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                        Custos sincronizados automaticamente do módulo de logística
                                    </div>
                                </div>
                            </div>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">
                                {formatCurrency(metrics.logisticsMetrics.maintenanceCosts)}
                            </p>
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                Dedução automática de manutenção
                            </p>
                        </Card>

                        <Card padding="md" className="bg-blue-50/50 dark:bg-blue-900/5 border-blue-100 dark:border-blue-900/20">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Lucro Operacional</span>
                                <HiOutlineTrendingUp className="w-5 h-5 text-blue-500" />
                            </div>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">
                                {formatCurrency(metrics.logisticsMetrics.profit)}
                            </p>
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                Margem antes de impostos
                            </p>
                        </Card>
                    </div>
                </div>
            )}

            {/* Recent Retentions */}
            <Card padding="md">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <HiOutlineDocumentText className="w-5 h-5 text-primary-500" />
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                            Retenções Recentes
                        </h3>
                    </div>
                    <Badge variant="gray">{metrics.recentRetentions.length} registos</Badge>
                </div>

                {metrics.recentRetentions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <HiOutlineDocumentText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Nenhuma retenção registada</p>
                        <p className="text-sm mt-1">As retenções aparecerão aqui após o processamento de faturas e salários</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-700">
                            <thead>
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Documento</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Entidade</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Valor Base</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Retido</th>
                                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
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
                )}
            </Card>

            {/* Info Banner */}
            <Card padding="md" className="bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 border-primary-100 dark:border-primary-800">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-white dark:bg-dark-800 rounded-xl shadow-sm">
                        <HiOutlineExclamation className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                            Lembre-se dos Prazos Fiscais
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Os impostos devem ser declarados e pagos até ao <strong>dia 20 de cada mês</strong> referente ao mês anterior.
                            Atrasos podem resultar em multas e juros de mora.
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
}
