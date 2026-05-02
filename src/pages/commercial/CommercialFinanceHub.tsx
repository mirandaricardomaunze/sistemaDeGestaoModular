import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/ui';
import CommercialFinance from './CommercialFinance';
import AccountsReceivable from './AccountsReceivable';
import {
    HiOutlineCurrencyDollar,
    HiOutlineChartBar,
    HiOutlineDocumentText,
} from 'react-icons/hi2';
import { cn } from '../../utils/helpers';

const TABS = [
    { 
        id: 'overview', 
        label: 'Fluxo de Caixa', 
        icon: HiOutlineChartBar,
        subtitle: 'Gestão de receitas, despesas e margens operacionais'
    },
    { 
        id: 'receivables', 
        label: 'Contas a Receber', 
        icon: HiOutlineDocumentText,
        subtitle: 'Controle de faturas em aberto e dívidas de clientes'
    },
] as const;

type TabId = typeof TABS[number]['id'];

export default function CommercialFinanceHub() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabId) || 'overview';

    const setActiveTab = (tab: TabId) => {
        setSearchParams({ tab });
    };

    const currentTabData = TABS.find(t => t.id === activeTab) || TABS[0];

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <PageHeader
                title="Gestão Financeira Comercial"
                subtitle={currentTabData.subtitle}
                icon={<HiOutlineCurrencyDollar className="text-primary-600 dark:text-primary-400" />}
            />

            {/* Premium Tab Navigation (Segmented Control style) */}
            <div className="flex p-1 bg-gray-100/80 dark:bg-dark-800/80 backdrop-blur-md rounded-xl border border-gray-200/50 dark:border-dark-700/50 shadow-inner overflow-x-auto scroller-hidden">
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex items-center gap-2 px-6 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex-1 justify-center whitespace-nowrap",
                                isActive
                                    ? "bg-white dark:bg-dark-700 text-primary-600 dark:text-white shadow-lg shadow-black/5 scale-[1.02]"
                                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            )}
                        >
                            <Icon className={cn("w-4 h-4", isActive ? "text-primary-600 dark:text-primary-400" : "opacity-50")} />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            <div className="animate-fade-in transition-all duration-300">
                {activeTab === 'overview' && <CommercialFinance />}
                {activeTab === 'receivables' && <AccountsReceivable />}
            </div>
        </div>
    );
}
