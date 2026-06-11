import { useState, useEffect } from 'react';
import {
    HiOutlineChartPie,
    HiOutlineCog,
    HiOutlineDocumentChartBar,
    HiOutlineClipboardDocumentCheck,
    HiOutlineCalendar,
    HiOutlineCurrencyDollar,
} from 'react-icons/hi2';
import FiscalDashboard from '../components/fiscal/FiscalDashboard';
import TaxConfigManager from '../components/fiscal/TaxConfigManager';
import FiscalReportGenerator from '../components/fiscal/FiscalReportGenerator';
import FiscalAuditLog from '../components/fiscal/FiscalAuditLog';
import DeadlineManager from '../components/fiscal/DeadlineManager';
import IvaManager from '../components/fiscal/IvaManager';
import { useStore } from '../stores/useStore';
import { useFiscalStore } from '../stores/useFiscalStore';
import { Badge, PageHeader } from '../components/ui';
import { Button } from '../components/ui/Button';
import { cn } from '../utils/helpers';

type FiscalTab = 'dashboard' | 'config' | 'reports' | 'audit' | 'deadlines' | 'iva';

const tabs: { id: FiscalTab; label: string; icon: typeof HiOutlineChartPie; color: string }[] = [
    { id: 'dashboard', label: 'Painel', icon: HiOutlineChartPie, color: 'text-blue-500' },
    { id: 'config', label: 'Configuração', icon: HiOutlineCog, color: 'text-slate-500' },
    { id: 'reports', label: 'Relatórios', icon: HiOutlineDocumentChartBar, color: 'text-indigo-500' },
    { id: 'deadlines', label: 'Prazos', icon: HiOutlineCalendar, color: 'text-amber-500' },
    { id: 'iva', label: 'IVA', icon: HiOutlineCurrencyDollar, color: 'text-emerald-500' },
    { id: 'audit', label: 'Auditoria', icon: HiOutlineClipboardDocumentCheck, color: 'text-violet-500' },
];

export default function Fiscal() {
    const [activeTab, setActiveTab] = useState<FiscalTab>('dashboard');
    const { companySettings } = useStore();
    const { retentions, deadlines, taxConfigs, loadFiscalDataFromDatabase } = useFiscalStore();

    // Auto-load: useAuthStore triggers this on login, but a deep-link with a
    // restored JWT may land here with the store still empty. Idempotent —
    // refetches only if all three core lists are empty.
    useEffect(() => {
        if (retentions.length === 0 && deadlines.length === 0 && taxConfigs.length === 0) {
            loadFiscalDataFromDatabase().catch(() => { /* errors are logged inside the store */ });
        }
    }, [retentions.length, deadlines.length, taxConfigs.length, loadFiscalDataFromDatabase]);

    const renderTabContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return <FiscalDashboard />;
            case 'config':
                return <TaxConfigManager />;
            case 'reports':
                return <FiscalReportGenerator />;
            case 'deadlines':
                return <DeadlineManager />;
            case 'iva':
                return <IvaManager />;
            case 'audit':
                return <FiscalAuditLog />;
            default:
                return <FiscalDashboard />;
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Área Fiscal"
                subtitle="Impostos, retenções na fonte, declarações e conformidade fiscal"
                icon={<HiOutlineDocumentChartBar />}
                actions={
                    <Badge variant="outline" className="text-sm font-medium">
                        {companySettings.tradeName || companySettings.companyName}
                    </Badge>
                }
            />

            <div className="w-full">
                <nav
                    role="tablist"
                    aria-label="Navegação da área fiscal"
                    className="flex gap-1 overflow-x-auto overscroll-x-contain rounded-2xl border border-slate-200/90 bg-slate-100/80 p-1 shadow-inner scrollbar-none dark:border-white/10 dark:bg-dark-700/50"
                >
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <Button
                                key={tab.id}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                variant="ghost"
                                size="sm"
                                onClick={() => setActiveTab(tab.id)}
                                leftIcon={<Icon className={cn('h-4 w-4', !isActive && `${tab.color} opacity-50`)} />}
                                className={cn(
                                    'min-w-max flex-1 justify-center rounded-xl text-[10px] font-black uppercase tracking-widest lg:min-w-[9rem] lg:justify-start lg:px-4',
                                    isActive
                                        ? 'bg-white text-primary-700 shadow-sm dark:bg-dark-600 dark:text-primary-400'
                                        : 'text-slate-600 hover:text-slate-950 dark:hover:text-gray-300'
                                )}
                            >
                                <span className="hidden truncate text-left lg:inline">{tab.label}</span>
                            </Button>
                        );
                    })}
                </nav>
            </div>

            {/* Tab Content */}
            <div className="min-h-[500px]">
                {renderTabContent()}
            </div>
        </div>
    );
}
