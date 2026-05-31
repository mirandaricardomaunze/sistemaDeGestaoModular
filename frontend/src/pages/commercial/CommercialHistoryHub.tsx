import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    HiOutlineClock,
    HiOutlineCalculator,
    HiOutlineArrowPathRoundedSquare,
    HiOutlineShieldCheck,
    HiOutlineNoSymbol,
} from 'react-icons/hi2';
import type { IconType } from 'react-icons';
import { Button, PageHeader } from '../../components/ui';
import { LoadingOverlay } from '../../components/ui/Loading';
import { cn } from '../../utils/helpers';
import { usePendingVoids } from '../../hooks/useSales';

const CommercialHistory = lazy(() => import('./CommercialHistory'));
const CommercialShiftHistory = lazy(() => import('./CommercialShiftHistory'));
const CommercialStockMovements = lazy(() => import('./CommercialStockMovements'));
const CommercialAuditLogs = lazy(() => import('./CommercialAuditLogs'));
const CommercialPendingVoids = lazy(() => import('./CommercialPendingVoids'));

type TabId = 'sales' | 'voids' | 'shifts' | 'stock' | 'audit';

const TABS: { id: TabId; label: string; icon: IconType }[] = [
    { id: 'sales', label: 'Vendas', icon: HiOutlineClock },
    { id: 'voids', label: 'Anulações Pendentes', icon: HiOutlineNoSymbol },
    { id: 'shifts', label: 'Turnos', icon: HiOutlineCalculator },
    { id: 'stock', label: 'Movimentos de Stock', icon: HiOutlineArrowPathRoundedSquare },
    { id: 'audit', label: 'Auditoria', icon: HiOutlineShieldCheck },
];

const isValidTab = (v: string | null): v is TabId =>
    v === 'sales' || v === 'voids' || v === 'shifts' || v === 'stock' || v === 'audit';

export default function CommercialHistoryHub() {
    const [searchParams, setSearchParams] = useSearchParams();
    const tabParam = searchParams.get('tab');
    const activeTab: TabId = isValidTab(tabParam) ? tabParam : 'sales';

    const handleTabChange = (tabId: TabId) => {
        searchParams.set('tab', tabId);
        setSearchParams(searchParams, { replace: true });
    };

    // Live count of pending void requests -- shown as a badge on the tab.
    const { data: pendingVoids } = usePendingVoids();
    const pendingCount = pendingVoids?.length ?? 0;

    const activeTabLabel = TABS.find(t => t.id === activeTab)?.label;

    return (
        <div className="space-y-6 animate-fade-in">
            <PageHeader 
                title="Centro de Histórico"
                subtitle={`Visualização unificada de ${activeTabLabel?.toLowerCase() || 'registos'} comerciais`}
                icon={<HiOutlineClock className="text-primary-600 dark:text-primary-400" />}
            />

            {/* Premium Segmented Tabs */}
            <div className="w-full overflow-x-auto overscroll-x-contain scrollbar-none pb-1">
                <div className="flex gap-1 bg-gray-100/50 dark:bg-dark-800/50 backdrop-blur-sm rounded-xl p-1.5 border border-gray-200 dark:border-dark-700 shadow-sm w-full min-w-[520px] sm:min-w-0">
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <Button
                                key={tab.id} 
                                onClick={() => handleTabChange(tab.id)}
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    'h-10 flex-1 rounded-lg text-xs sm:text-sm font-bold normal-case tracking-normal whitespace-nowrap flex items-center justify-center gap-1.5 px-2 sm:px-4 transition-all duration-200',
                                    isActive
                                        ? 'bg-white dark:bg-dark-700 text-primary-600 dark:text-primary-400 shadow-md transform scale-[1.02]'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-dark-700/30'
                                )}
                            >
                                <Icon className={cn(
                                    "w-4.5 h-4.5 flex-shrink-0 transition-transform duration-300",
                                    isActive ? "text-primary-600 dark:text-primary-400 scale-110" : "text-gray-400"
                                )} />
                                <span>
                                    {tab.id === 'sales' && 'Vendas'}
                                    {tab.id === 'voids' && (
                                        <>
                                            <span className="hidden sm:inline">Anulações Pendentes</span>
                                            <span className="inline sm:hidden">Anulações</span>
                                        </>
                                    )}
                                    {tab.id === 'shifts' && 'Turnos'}
                                    {tab.id === 'stock' && (
                                        <>
                                            <span className="hidden sm:inline">Movimentos de Stock</span>
                                            <span className="inline sm:hidden">Stock</span>
                                        </>
                                    )}
                                    {tab.id === 'audit' && 'Auditoria'}
                                </span>
                                {tab.id === 'voids' && pendingCount > 0 && (
                                    <span className="ml-0.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-[10px] font-black rounded-full bg-red-500 text-white animate-pulse">
                                        {pendingCount}
                                    </span>
                                )}
                            </Button>
                        );
                    })}
                </div>
            </div>

            <div className="min-h-[400px] relative">
                <Suspense fallback={<LoadingOverlay fullScreen={false} />}>
                    {activeTab === 'sales' && <CommercialHistory />}
                    {activeTab === 'voids' && <CommercialPendingVoids />}
                    {activeTab === 'shifts' && <CommercialShiftHistory />}
                    {activeTab === 'stock' && <CommercialStockMovements />}
                    {activeTab === 'audit' && <CommercialAuditLogs />}
                </Suspense>
            </div>
        </div>
    );
}
