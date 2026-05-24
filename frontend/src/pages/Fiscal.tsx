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

type FiscalTab = 'dashboard' | 'config' | 'reports' | 'audit' | 'deadlines' | 'iva';

const tabs: { id: FiscalTab; label: string; icon: typeof HiOutlineChartPie }[] = [
    { id: 'dashboard', label: 'Painel', icon: HiOutlineChartPie },
    { id: 'config', label: 'Configuração', icon: HiOutlineCog },
    { id: 'reports', label: 'Relatórios', icon: HiOutlineDocumentChartBar },
    { id: 'deadlines', label: 'Prazos', icon: HiOutlineCalendar },
    { id: 'iva', label: 'IVA', icon: HiOutlineCurrencyDollar },
    { id: 'audit', label: 'Auditoria', icon: HiOutlineClipboardDocumentCheck },
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
                tabs={
                    <nav className="flex gap-1 overflow-x-auto pb-px">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <Button
                                    variant="ghost"
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap focus:ring-0 rounded-t-lg ${
                                        isActive
                                            ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/10'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-800'
                                    }`}
                                >
                                    <Icon className="w-5 h-5" />
                                    {tab.label}
                                </Button>
                            );
                        })}
                    </nav>
                }
            />

            {/* Tab Content */}
            <div className="min-h-[500px]">
                {renderTabContent()}
            </div>
        </div>
    );
}
