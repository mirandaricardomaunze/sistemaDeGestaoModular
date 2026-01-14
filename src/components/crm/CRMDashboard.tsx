/**
 * CRM Dashboard Component
 * Painel de métricas e indicadores do CRM com gráficos de performance
 */

import { useMemo } from 'react';
import {
    HiOutlineTrendingUp,
    HiOutlineCurrencyDollar,
    HiOutlineUserGroup,
    HiOutlineChartBar,
    HiOutlineClock,
    HiOutlineCheckCircle,
    HiOutlineXCircle,
    HiOutlineLightningBolt,
    HiOutlineCalendar,
    HiOutlineChevronRight,
} from 'react-icons/hi';
import { Card, Badge, Pagination, usePagination } from '../ui';
import { formatCurrency } from '../../utils/helpers';
import { getFunnelDashboardData, getFollowUpAlerts, type FollowUpAlert } from '../../utils/crmIntegration';
import { useCampaigns } from '../../hooks/useData';

export default function CRMDashboard() {
    // Get campaigns from API
    const { campaigns: campaignsData } = useCampaigns();

    // Get dashboard data from CRM integration (funnel opportunities data)
    const dashboardData = useMemo(() => getFunnelDashboardData(), []);
    const followUpAlerts = useMemo(() => getFollowUpAlerts(), []);

    // Transform campaigns data and filter active
    const activeCampaigns = useMemo(() => {
        return (campaignsData || []).filter((c: any) => c.status === 'active').map((c: any) => ({
            ...c,
            discountType: c.discountType || 'percentage',
            discountValue: c.discountValue || 0,
            endDate: c.endDate,
            metrics: c.metrics || { ordersGenerated: 0 },
        }));
    }, [campaignsData]);

    // Pagination for Top Opportunities
    const {
        currentPage,
        setCurrentPage,
        itemsPerPage,
        setItemsPerPage,
        paginatedItems: paginatedOpportunities,
        totalItems,
    } = usePagination(dashboardData.topOpportunities, 5);

    // Format days overdue
    const formatDaysOverdue = (days: number): string => {
        if (days > 0) return `${days} dia${days > 1 ? 's' : ''} atrasado`;
        if (days === 0) return 'Hoje';
        return `Em ${Math.abs(days)} dia${Math.abs(days) > 1 ? 's' : ''}`;
    };

    // Get severity color
    const getSeverityColor = (severity: FollowUpAlert['severity']): string => {
        switch (severity) {
            case 'danger': return 'text-red-600 bg-red-50 dark:bg-red-900/20';
            case 'warning': return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20';
            case 'info': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
        }
    };

    return (
        <div className="space-y-6">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Pipeline Total */}
                <Card className="relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Valor em Pipeline</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {formatCurrency(dashboardData.pipelineTotal)}
                            </p>
                            <p className="text-sm text-gray-500">
                                {dashboardData.pipelineCount} oportunidades
                            </p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                            <HiOutlineCurrencyDollar className="w-6 h-6 text-primary-600" />
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-500 to-primary-600" />
                </Card>

                {/* Weighted Value */}
                <Card className="relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Valor Ponderado</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {formatCurrency(dashboardData.weightedPipeline)}
                            </p>
                            <p className="text-sm text-gray-500">
                                Ajustado por probabilidade
                            </p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <HiOutlineTrendingUp className="w-6 h-6 text-green-600" />
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-green-600" />
                </Card>

                {/* Win Rate */}
                <Card className="relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Taxa de Conversão</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {dashboardData.winRate.toFixed(1)}%
                            </p>
                            <p className="text-sm text-gray-500">
                                Média histórica
                            </p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <HiOutlineChartBar className="w-6 h-6 text-blue-600" />
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-blue-600" />
                </Card>

                {/* Avg Time to Close */}
                <Card className="relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Tempo Médio</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {dashboardData.avgTimeToClose} dias
                            </p>
                            <p className="text-sm text-gray-500">
                                Para fechar negócios
                            </p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                            <HiOutlineClock className="w-6 h-6 text-purple-600" />
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-purple-600" />
                </Card>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Funnel Visualization */}
                <div className="lg:col-span-2">
                    <Card>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Funil de Vendas
                            </h3>
                            <Badge variant="gray">
                                Últimos 30 dias
                            </Badge>
                        </div>

                        {/* Funnel Stages */}
                        <div className="space-y-3">
                            {dashboardData.stageData.map((stage, index) => (
                                <div key={stage.id} className="relative">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: stage.color }}
                                            />
                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                {stage.name}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm">
                                            <span className="text-gray-500">
                                                {stage.count} negócios
                                            </span>
                                            <span className="font-medium text-gray-900 dark:text-white">
                                                {formatCurrency(stage.value)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="h-8 bg-gray-100 dark:bg-dark-700 rounded-lg overflow-hidden relative">
                                        <div
                                            className="h-full rounded-lg transition-all duration-500 flex items-center justify-center"
                                            style={{
                                                width: `${Math.max(5, 100 - (index * 15))}%`,
                                                backgroundColor: stage.color,
                                                opacity: 0.8,
                                            }}
                                        >
                                            <span className="text-xs font-medium text-white">
                                                {stage.percentage.toFixed(0)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Trend Indicators */}
                        <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-gray-200 dark:border-dark-700">
                            <div className="text-center">
                                <div className="flex items-center justify-center gap-1 text-green-600">
                                    <HiOutlineCheckCircle className="w-5 h-5" />
                                    <span className="text-xl font-bold">{dashboardData.wonLast30Days}</span>
                                </div>
                                <p className="text-xs text-gray-500">Ganhos (30d)</p>
                            </div>
                            <div className="text-center">
                                <div className="flex items-center justify-center gap-1 text-red-600">
                                    <HiOutlineXCircle className="w-5 h-5" />
                                    <span className="text-xl font-bold">{dashboardData.lostLast30Days}</span>
                                </div>
                                <p className="text-xs text-gray-500">Perdidos (30d)</p>
                            </div>
                            <div className="text-center">
                                <div className="flex items-center justify-center gap-1 text-blue-600">
                                    <HiOutlineLightningBolt className="w-5 h-5" />
                                    <span className="text-xl font-bold">{dashboardData.newLast30Days}</span>
                                </div>
                                <p className="text-xs text-gray-500">Novos (30d)</p>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Follow-up Alerts */}
                <div className="space-y-6">
                    {/* Follow-up Alerts Card */}
                    <Card>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <HiOutlineCalendar className="w-5 h-5" />
                                Follow-ups Pendentes
                            </h3>
                            {followUpAlerts.length > 0 && (
                                <Badge variant="danger">{followUpAlerts.length}</Badge>
                            )}
                        </div>

                        {followUpAlerts.length === 0 ? (
                            <div className="text-center py-6 text-gray-500">
                                <HiOutlineCheckCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Nenhum follow-up pendente</p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-64 overflow-y-auto">
                                {followUpAlerts.slice(0, 5).map((alert) => (
                                    <div
                                        key={alert.id}
                                        className={`p-3 rounded-lg ${getSeverityColor(alert.severity)}`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <p className="text-sm font-medium truncate">
                                                    {alert.opportunityTitle}
                                                </p>
                                                <p className="text-xs opacity-75">
                                                    {alert.customerName}
                                                </p>
                                            </div>
                                            <Badge
                                                variant={
                                                    alert.severity === 'danger' ? 'danger' :
                                                        alert.severity === 'warning' ? 'warning' : 'info'
                                                }
                                                size="sm"
                                            >
                                                {formatDaysOverdue(alert.daysOverdue)}
                                            </Badge>
                                        </div>
                                        <p className="text-xs mt-1 opacity-75">
                                            📌 {alert.nextAction}
                                        </p>
                                    </div>
                                ))}
                                {followUpAlerts.length > 5 && (
                                    <button className="w-full text-sm text-primary-600 hover:text-primary-700 py-2 flex items-center justify-center gap-1">
                                        Ver todos ({followUpAlerts.length})
                                        <HiOutlineChevronRight className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        )}
                    </Card>

                    {/* Active Campaigns */}
                    <Card>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <HiOutlineLightningBolt className="w-5 h-5" />
                                Campanhas Ativas
                            </h3>
                            <Badge variant="success">{activeCampaigns.length}</Badge>
                        </div>

                        {activeCampaigns.length === 0 ? (
                            <div className="text-center py-6 text-gray-500">
                                <p className="text-sm">Nenhuma campanha ativa</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {activeCampaigns.slice(0, 3).map((campaign) => (
                                    <div
                                        key={campaign.id}
                                        className="p-3 bg-gray-50 dark:bg-dark-700 rounded-lg"
                                    >
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                {campaign.name}
                                            </p>
                                            <Badge variant="gray" size="sm">
                                                {campaign.discountType === 'percentage'
                                                    ? `${campaign.discountValue}%`
                                                    : formatCurrency(campaign.discountValue)
                                                }
                                            </Badge>
                                        </div>
                                        <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                                            <span>Até {new Date(campaign.endDate).toLocaleDateString('pt-MZ')}</span>
                                            <span>{campaign.metrics.ordersGenerated} usos</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>
            </div>

            {/* Top Opportunities */}
            <Card>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <HiOutlineUserGroup className="w-5 h-5" />
                        Top Oportunidades
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-dark-700">
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                                    Oportunidade
                                </th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                                    Cliente
                                </th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                                    Etapa
                                </th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">
                                    Valor
                                </th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">
                                    Prob.
                                </th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">
                                    Valor Ponderado
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedOpportunities.map((opp) => (
                                <tr
                                    key={opp.id}
                                    className="border-b border-gray-100 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-700"
                                >
                                    <td className="py-3 px-4">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                            {opp.title}
                                        </p>
                                    </td>
                                    <td className="py-3 px-4">
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            {opp.customerName}
                                        </p>
                                    </td>
                                    <td className="py-3 px-4">
                                        <Badge variant="gray" size="sm">
                                            {opp.stageName}
                                        </Badge>
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                            {formatCurrency(opp.value)}
                                        </p>
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            {opp.probability}%
                                        </p>
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <p className="text-sm font-medium text-primary-600">
                                            {formatCurrency(opp.value * opp.probability / 100)}
                                        </p>
                                    </td>
                                </tr>
                            ))}
                            {paginatedOpportunities.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center text-gray-500">
                                        Nenhuma oportunidade em aberto
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {dashboardData.topOpportunities.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-dark-700">
                        <Pagination
                            currentPage={currentPage}
                            totalItems={totalItems}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={setItemsPerPage}
                            itemsPerPageOptions={[5, 10, 20]}
                        />
                    </div>
                )}
            </Card>
        </div>
    );
}
