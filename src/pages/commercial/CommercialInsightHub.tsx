import { lazy, Suspense, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

import {
    HiOutlinePresentationChartLine,
    HiOutlineDocumentChartBar,
    HiOutlineChartBar,
} from 'react-icons/hi2';
import { Skeleton } from '../../components/ui';
import { cn } from '../../utils/helpers';

const CommercialDashboard = lazy(() => import('./CommercialDashboard'));
const CommercialReports = lazy(() => import('./CommercialReports'));
const MarginAnalysis = lazy(() => import('./MarginAnalysis'));

const TABS = [
    {
        id: 'overview',
        label: 'Visão Geral',
        icon: HiOutlinePresentationChartLine,
        subtitle: 'Análise de performance, vendas e KPIs em tempo real',
    },
    {
        id: 'reports',
        label: 'Relatórios & IA',
        icon: HiOutlineDocumentChartBar,
        subtitle: 'Exploração de dados, auditoria de stock e previsões preditivas',
    },
    {
        id: 'margins',
        label: 'Margens & Lucro',
        icon: HiOutlineChartBar,
        subtitle: 'Análise de rentabilidade por produto, categoria e tendências',
    },
] as const;

type TabId = typeof TABS[number]['id'];

const PATH_TO_TAB: Array<[string, TabId]> = [
    ['/dashboard', 'overview'],
    ['/reports', 'reports'],
    ['/margins', 'margins'],
];

function TabFallback() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-10 w-1/4 rounded-lg" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
            <Skeleton className="h-80 rounded-xl" />
        </div>
    );
}

export default function CommercialInsightHub() {
    const [searchParams, setSearchParams] = useSearchParams();
    const { pathname } = useLocation();

    const activeTab: TabId = useMemo(() => {
        const tabParam = searchParams.get('tab') as TabId | null;
        if (tabParam && TABS.some(t => t.id === tabParam)) return tabParam;
        const fromPath = PATH_TO_TAB.find(([fragment]) => pathname.includes(fragment));
        return fromPath ? fromPath[1] : 'overview';
    }, [searchParams, pathname]);

    const setActiveTab = (tab: TabId) => {
        // Preserve other query params (warehouse, days, filters) when switching tabs.
        const next = new URLSearchParams(searchParams);
        next.set('tab', tab);
        setSearchParams(next);
    };

    const currentTabData = TABS.find(t => t.id === activeTab) ?? TABS[0];

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="mb-2">
                <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">
                    Gestão de Insights
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium italic mt-1">
                    {currentTabData.subtitle}
                </p>
            </div>

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

            {/* Tab Content (lazy-loaded — only the active tab is fetched) */}
            <div className="animate-fade-in transition-all duration-300">
                <Suspense fallback={<TabFallback />}>
                    {activeTab === 'overview' && <CommercialDashboard />}
                    {activeTab === 'reports' && <CommercialReports />}
                    {activeTab === 'margins' && <MarginAnalysis />}
                </Suspense>
            </div>
        </div>
    );
}
