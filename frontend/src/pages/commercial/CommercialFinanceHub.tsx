import { useSearchParams } from 'react-router-dom';
import { Button, PageHeader } from '../../components/ui';
import CommercialFinance from './CommercialFinance';
import AccountsReceivable from './AccountsReceivable';
import CommercialReturns from './CommercialReturns';
import CommercialDebitNotes from './CommercialDebitNotes';
import {
    HiOutlineCurrencyDollar,
    HiOutlineChartBar,
    HiOutlineDocumentText,
    HiOutlineArrowPathRoundedSquare,
    HiOutlineArrowTrendingUp,
} from 'react-icons/hi2';
import { cn } from '../../utils/helpers';

const TABS = [
    {
        id: 'overview',
        label: 'Fluxo de Caixa',
        shortLabel: 'Fluxo',
        icon: HiOutlineChartBar,
        subtitle: 'Gestão de receitas, despesas e margens operacionais'
    },
    {
        id: 'receivables',
        label: 'Contas a Receber',
        shortLabel: 'Receber',
        icon: HiOutlineDocumentText,
        subtitle: 'Controle de faturas em aberto e dívidas de clientes'
    },
    {
        id: 'returns',
        label: 'Devolucoes',
        shortLabel: 'Devoluções',
        icon: HiOutlineArrowPathRoundedSquare,
        subtitle: 'Notas de credito, devolucoes parciais e reposicao de stock'
    },
    {
        id: 'debit-notes',
        label: 'Notas de Débito',
        shortLabel: 'Débitos',
        icon: HiOutlineArrowTrendingUp,
        subtitle: 'Cobrança de juros, multas e correcções de valor sobre faturas',
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
            <div className="flex gap-1 overflow-x-auto overscroll-x-contain rounded-2xl border border-slate-200/90 bg-slate-100/80 p-1 shadow-inner scrollbar-none dark:border-white/10 dark:bg-dark-700/50">
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <Button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    "min-w-max flex-1 justify-center rounded-xl text-[10px] font-black uppercase tracking-widest lg:min-w-[9rem] lg:justify-start lg:px-4",
                                    isActive
                                        ? "bg-white text-primary-700 shadow-sm dark:bg-dark-600 dark:text-primary-400"
                                        : "text-slate-600 hover:text-slate-950 dark:hover:text-gray-300"
                                )}
                                leftIcon={<Icon className={cn("w-4 h-4", !isActive && "text-primary-500 opacity-50")} />}
                            >
                                <span className="hidden truncate text-left lg:inline">{tab.label}</span>
                            </Button>
                        );
                    })}
            </div>

            {/* Tab Content */}
            <div className="animate-fade-in transition-all duration-300">
                {activeTab === 'overview' && <CommercialFinance />}
                {activeTab === 'receivables' && <AccountsReceivable />}
                {activeTab === 'returns' && <CommercialReturns hideHeader />}
                {activeTab === 'debit-notes' && <CommercialDebitNotes hideHeader />}
            </div>
        </div>
    );
}
