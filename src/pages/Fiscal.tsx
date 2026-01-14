import { useState } from 'react';
import {
    HiOutlineChartPie,
    HiOutlineCog,
    HiOutlineDocumentReport,
    HiOutlineClipboardCheck,
    HiOutlineCalendar,
} from 'react-icons/hi';
import FiscalDashboard from '../components/fiscal/FiscalDashboard';
import TaxConfigManager from '../components/fiscal/TaxConfigManager';
import FiscalReportGenerator from '../components/fiscal/FiscalReportGenerator';
import FiscalAuditLog from '../components/fiscal/FiscalAuditLog';
import DeadlineManager from '../components/fiscal/DeadlineManager';
import { useStore } from '../stores/useStore';
import { Badge } from '../components/ui';

type FiscalTab = 'dashboard' | 'config' | 'reports' | 'audit' | 'deadlines';

const tabs: { id: FiscalTab; label: string; icon: typeof HiOutlineChartPie }[] = [
    { id: 'dashboard', label: 'Painel', icon: HiOutlineChartPie },
    { id: 'config', label: 'Configuração', icon: HiOutlineCog },
    { id: 'reports', label: 'Relatórios', icon: HiOutlineDocumentReport },
    { id: 'deadlines', label: 'Prazos', icon: HiOutlineCalendar },
    { id: 'audit', label: 'Auditoria', icon: HiOutlineClipboardCheck },
];

export default function Fiscal() {
    const [activeTab, setActiveTab] = useState<FiscalTab>('dashboard');
    const { companySettings } = useStore();

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
            case 'audit':
                return <FiscalAuditLog />;
            default:
                return <FiscalDashboard />;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        Gestão Fiscal
                        <Badge variant="outline" className="text-sm font-medium">
                            {companySettings.tradeName || companySettings.companyName}
                        </Badge>
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Impostos, retenções, relatórios e conformidade fiscal
                    </p>
                </div>
            </div>

            {/* Tabs Navigation */}
            <div className="border-b border-gray-200 dark:border-dark-700">
                <nav className="flex gap-1 overflow-x-auto pb-px">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${isActive
                                    ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/10 rounded-t-lg'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-800 rounded-t-lg'
                                    }`}
                            >
                                <Icon className="w-5 h-5" />
                                {tab.label}
                            </button>
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
