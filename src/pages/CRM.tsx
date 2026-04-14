/**
 * CRM Page
 * Página principal do CRM com funil de vendas e campanhas
 */

import { useState } from 'react';
import {
    HiOutlineChartBar,
    HiOutlineTag,
    HiOutlineUserGroup,
    HiOutlineCog,
    HiOutlineHome,
    HiOutlineArrowPath,
    HiOutlinePlus,
    HiOutlineUsers,
    HiOutlinePresentationChartBar
} from 'react-icons/hi2';
import SalesFunnel from '../components/crm/SalesFunnel';
import CampaignManager from '../components/crm/CampaignManager';
import CRMDashboard from '../components/crm/CRMDashboard';
import { Card, Button, PageHeader } from '../components/ui';
import { MetricCard } from '../components/common/ModuleMetricCard';
import { cn } from '../utils/helpers';
import { useCRMStore } from '../stores/useCRMStore';
import { useCampaigns } from '../hooks/useData';
import { formatCurrency } from '../utils/helpers';

type CRMTab = 'dashboard' | 'funnel' | 'campaigns' | 'customers' | 'settings';

export default function CRM() {
    const [activeTab, setActiveTab] = useState<CRMTab>('dashboard');
    const { opportunities, stages, getFunnelMetrics } = useCRMStore();
    const { campaigns: campaignsData } = useCampaigns();

    const metrics = getFunnelMetrics();
    const activeCampaigns = (campaignsData || []).filter((c: any) => c.status === 'active');
    const openOpportunities = opportunities.filter(o =>
        !stages.find(s => s.id === o.stageId)?.isClosedStage
    );

    const tabs = [
        { id: 'dashboard' as const, label: 'Estatísticas', icon: <HiOutlineHome className="w-5 h-5" /> },
        { id: 'funnel' as const, label: 'Funil de Vendas', icon: <HiOutlineChartBar className="w-5 h-5" /> },
        { id: 'campaigns' as const, label: 'Campanhas', icon: <HiOutlineTag className="w-5 h-5" /> },
        { id: 'customers' as const, label: 'Segmentação', icon: <HiOutlineUserGroup className="w-5 h-5" /> },
        { id: 'settings' as const, label: 'Configuração', icon: <HiOutlineCog className="w-5 h-5" /> },
    ];

    return (
        <div className="space-y-6">
            <PageHeader 
                title="CRM & Marketing"
                subtitle="Gestão de Clientes, Oportunidades e Campanhas"
                icon={<HiOutlinePresentationChartBar />}
                actions={
                    <>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="font-black text-[10px] uppercase tracking-widest text-gray-400 hover:text-blue-600"
                            leftIcon={<HiOutlineArrowPath className="w-5 h-5" />}
                        >
                            Actualizar
                        </Button>
                        {activeTab === 'funnel' && (
                            <Button 
                                size="sm" 
                                className="font-black text-[10px] uppercase tracking-widest"
                                leftIcon={<HiOutlinePlus className="w-5 h-5" />}
                            >
                                Nova Oportunidade
                            </Button>
                        )}
                    </>
                }
                tabs={
                    <div className="flex flex-wrap -mb-px">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as CRMTab)}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 px-2 md:px-6 py-4 text-xs md:text-sm font-black border-b-2 transition-all whitespace-nowrap uppercase tracking-widest",
                                    activeTab === tab.id
                                        ? "border-primary-500 text-primary-600 dark:text-primary-400"
                                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:hover:text-gray-300 dark:hover:border-dark-600"
                                )}
                            >
                                <span className="shrink-0">{tab.icon}</span>
                                <span className="hidden sm:inline-block">{tab.label}</span>
                                <span className="sm:hidden text-[10px]">{tab.label.substring(0, 3)}...</span>
                            </button>
                        ))}
                    </div>
                }
            />

            {/* Quick Stats - Using Shared MetricCard */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard 
                    label="Pipeline Total"
                    value={formatCurrency(metrics.totalValue)}
                    icon={<HiOutlineChartBar className="w-6 h-6" />}
                    color="primary"
                />
                <MetricCard 
                    label="Taxa de Conversão"
                    value={`${metrics.winRate}%`}
                    icon={<HiOutlineChartBar className="w-6 h-6" />}
                    color="green"
                />
                <MetricCard 
                    label="Oportunidades"
                    value={openOpportunities.length}
                    icon={<HiOutlineUserGroup className="w-6 h-6" />}
                    color="blue"
                />
                <MetricCard 
                    label="Campanhas Activas"
                    value={activeCampaigns.length}
                    icon={<HiOutlineTag className="w-6 h-6" />}
                    color="orange"
                />
            </div>


            {/* Tab Content */}
            <div className="min-h-[500px]">
                {activeTab === 'dashboard' && <CRMDashboard />}
                {activeTab === 'funnel' && <SalesFunnel />}
                {activeTab === 'campaigns' && <CampaignManager />}
                {activeTab === 'customers' && (
                    <Card padding="lg" className="text-center">
                        <HiOutlineUserGroup className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            Segmentação de Clientes
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-4">
                            Configure segmentos de clientes baseados em comportamento, compras e dados demográficos.
                        </p>
                        <p className="text-sm text-gray-400">
                            Esta funcionalidade está disponível nas campanhas promocionais.
                        </p>
                    </Card>
                )}
                {activeTab === 'settings' && (
                    <div className="space-y-6">
                        <Card padding="md">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                Configuração do Funil
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400 mb-4">
                                Configure as etapas do funil de vendas de acordo com o seu processo comercial.
                            </p>

                            <div className="space-y-2">
                                {stages.sort((a, b) => a.order - b.order).map((stage) => (
                                    <div
                                        key={stage.id}
                                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-800 rounded-lg"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-4 h-4 rounded-full"
                                                style={{ backgroundColor: stage.color }}
                                            />
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-white">
                                                    {stage.name}
                                                </p>
                                                {stage.description && (
                                                    <p className="text-sm text-gray-500">{stage.description}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {stage.isClosedStage && (
                                                <span className={`text-xs px-2 py-1 rounded ${stage.isWonStage
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {stage.isWonStage ? 'Ganho' : 'Perdido'}
                                                </span>
                                            )}
                                            {stage.autoMoveOnInvoice && (
                                                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                                                    Auto-fatura
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        <Card padding="md" className="bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
                            <div className="flex items-start gap-3">
                                <HiOutlineCog className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
                                        Automação Configurada
                                    </h4>
                                    <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                                        <li>• Quando uma fatura é emitida para um cliente com oportunidade aberta, a oportunidade é automaticamente movida para "Fechado Ganho"</li>
                                        <li>• Os descontos de campanhas ativas são aplicados automaticamente no PDV</li>
                                        <li>• O histórico de interações é mantido para cada oportunidade</li>
                                    </ul>
                                </div>
                            </div>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}
