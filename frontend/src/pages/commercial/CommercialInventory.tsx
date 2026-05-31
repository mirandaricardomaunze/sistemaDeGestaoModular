import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import InventoryTable from '../../components/inventory/InventoryTable';
import ProductForm from '../../components/inventory/ProductForm';
import InventoryPrintReport from '../../components/inventory/InventoryPrintReport';
import BatchManager from '../../components/inventory/BatchManager';
import { Button } from '../../components/ui';
import {
    HiOutlineArrowPath,
    HiOutlinePlus,
    HiOutlineSquares2X2,
    HiOutlineClock,
    HiOutlineCube,
    HiOutlineShoppingCart,
    HiOutlineExclamationTriangle,
    HiOutlineCurrencyDollar,
    HiOutlineChartBar,
    HiOutlinePrinter,
} from 'react-icons/hi2';
import { useDerivedCommercialAnalytics } from '../../hooks/useCommercialAnalytics';
import { useCommercialAnalytics } from '../../hooks/useCommercial';
import { Card, Badge, LoadingOverlay } from '../../components/ui';
import { MetricCard } from '../../components/common/ModuleMetricCard';
import { formatCurrency, cn } from '../../utils/helpers';
import { useBatches } from '../../hooks/useBatches';
import type { Product } from '../../types';


type InventoryTab = 'products' | 'batches';

export default function CommercialInventory() {
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<InventoryTab>('products');
    const [showProductForm, setShowProductForm] = useState(false);
    const [showPrintReport, setShowPrintReport] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [initialSearch, setInitialSearch] = useState(searchParams.get('search') || '');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [selectedStatus, setSelectedStatus] = useState<string>('all');
    const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');
    
    // Derived analytics (Reorder, ABC, Expiry) — computed client-side from products/customers/margins
    const { reorderSuggestions, nearExpiry, abcData, isLoading: advancedLoading } = useDerivedCommercialAnalytics(90);

    // Server-backed analytics (Inventory Value, COGS, turnover, POs)
    const { data: basicAnalytics, isLoading: basicLoading, refetch: refetchBasic } = useCommercialAnalytics();

    // Batches data
    useBatches({
        page: 1,
        limit: 1000
    });

    useEffect(() => {
        const search = searchParams.get('search');
        if (search) setInitialSearch(search);
    }, [searchParams]);

    const handleAddProduct = () => {
        setEditingProduct(null);
        setShowProductForm(true);
    };

    const handleEdit = (product: Product) => {
        setEditingProduct(product);
        setShowProductForm(true);
    };

    const handleCloseForm = () => {
        setShowProductForm(false);
        setEditingProduct(null);
    };

    const handleProductSuccess = useCallback(() => {
        setRefreshKey(prev => prev + 1);
        refetchBasic();
        handleCloseForm();
    }, [refetchBasic]);

    const metrics = useMemo(() => {
        const inventoryValue = basicAnalytics?.inventoryValue || 0;
        const criticalItems = reorderSuggestions.filter(p => p.reason === 'Stock Crítico').length;
        const classAItems = abcData.filter(p => p.classification === 'A').length;
        const expiryAlerts = nearExpiry.length;

        return { inventoryValue, criticalItems, classAItems, expiryAlerts };
    }, [basicAnalytics, reorderSuggestions, abcData, nearExpiry]);

    return (
        <div className="space-y-6 pb-12 relative min-h-screen">
            {/* Premium Loading Overlay for Background Refresh */}
            {(basicLoading || advancedLoading) && (
                <LoadingOverlay 
                    fullScreen={false} 
                    message="Sincronizando em Tempo Real" 
                />
            )}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-3 break-words">
                        <span className="w-10 h-10 rounded-2xl bg-primary-100 dark:bg-primary-500/15 border border-primary-200 dark:border-primary-500/25 flex items-center justify-center">
                            <HiOutlineCube className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                        </span>
                        Inventário Comercial
                    </h1>
                    <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mt-1 ml-1">
                        Gestão Avançada de Produtos e Valor de Stock
                    </p>
                </div>

                <div className="grid w-full grid-cols-2 gap-2 bg-white/40 dark:bg-dark-900/40 p-2 rounded-2xl border border-slate-200/60 dark:border-white/5 backdrop-blur-md sm:grid-cols-3 md:w-auto md:flex md:flex-wrap md:items-center md:gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setRefreshKey(prev => prev + 1);
                            refetchBasic();
                        }}
                        disabled={basicLoading || advancedLoading}
                        className="w-full h-11 sm:h-9"
                        leftIcon={<HiOutlineArrowPath className={cn("w-4 h-4 text-primary-600", (basicLoading || advancedLoading) && "animate-spin")} />}
                    >
                        Actualizar
                    </Button>

                    <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-11 sm:h-9"
                        leftIcon={<HiOutlinePrinter className="w-4 h-4" />}
                        onClick={() => setShowPrintReport(true)}
                    >
                        Relatório
                    </Button>

                    <Button
                        size="sm"
                        variant="primary"
                        className="w-full h-11 sm:h-9 col-span-2 sm:col-span-1"
                        leftIcon={<HiOutlinePlus className="w-4 h-4 text-white" />}
                        onClick={handleAddProduct}
                    >
                        Novo Produto
                    </Button>
                </div>
            </div>

            {/* Metrics Dashboard */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    label="Valor em Inventário"
                    value={formatCurrency(metrics.inventoryValue)}
                    color="primary"
                    icon={<HiOutlineCurrencyDollar className="w-5 h-5" />}
                    badge={<span className="text-[9px] font-bold text-primary-500 dark:text-primary-400 uppercase tracking-tight">Custo Total</span>}
                />
                <MetricCard
                    label="Stock Crítico"
                    value={String(metrics.criticalItems)}
                    color="red"
                    icon={<HiOutlineExclamationTriangle className="w-5 h-5" />}
                    badge={metrics.criticalItems > 0 ? (
                        <div className="flex items-center gap-1.5">
                            <span className="text-[8px] font-black text-red-500 dark:text-red-400 uppercase tracking-tighter animate-pulse">Crítico</span>
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                        </div>
                    ) : undefined}
                />
                <MetricCard
                    label="Produtos Classe A"
                    value={String(metrics.classAItems)}
                    color="blue"
                    icon={<HiOutlineChartBar className="w-5 h-5" />}
                    badge={<span className="text-[9px] font-bold text-blue-500 dark:text-blue-400 uppercase tracking-tight">Estratégico</span>}
                />
                <MetricCard
                    label="Próximos do Fim"
                    value={String(metrics.expiryAlerts)}
                    color="amber"
                    icon={<HiOutlineClock className="w-5 h-5" />}
                    badge={metrics.expiryAlerts > 0 ? (
                        <div className="flex items-center gap-1.5">
                            <span className="text-[8px] font-black text-amber-500 dark:text-amber-400 uppercase tracking-tighter">Vencimento</span>
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                        </div>
                    ) : undefined}
                />
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-100 dark:border-dark-700 overflow-hidden">
                <nav className="flex w-full gap-2 overflow-x-auto overscroll-x-contain scrollbar-none sm:gap-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveTab('products')}
                        className={cn(
                            "group flex flex-1 sm:flex-none justify-center sm:min-w-max items-center gap-2 py-4 text-xs font-black uppercase tracking-widest sm:tracking-[0.2em] border-b-2 rounded-none focus:ring-0",
                            activeTab === 'products'
                                ? "border-primary-500 text-primary-600"
                                : "border-transparent text-gray-400 hover:text-gray-600"
                        )}
                    >
                        <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300",
                            activeTab === 'products' ? "bg-primary-500 text-white shadow-lg shadow-primary-500/30" : "bg-primary-500/10 text-primary-400 dark:text-primary-500"
                        )}>
                            <HiOutlineSquares2X2 className={cn("w-4 h-4 transition-transform group-hover:scale-110")} />
                        </div>
                        Produtos
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveTab('batches')}
                        className={cn(
                            "group flex flex-1 sm:flex-none justify-center sm:min-w-max items-center gap-2 py-4 text-xs font-black uppercase tracking-widest sm:tracking-[0.2em] border-b-2 rounded-none focus:ring-0",
                            activeTab === 'batches'
                                ? "border-amber-500 text-amber-600"
                                : "border-transparent text-gray-400 hover:text-gray-600"
                        )}
                    >
                        <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300",
                            activeTab === 'batches' ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30" : "bg-amber-500/10 text-amber-400 dark:text-amber-500"
                        )}>
                            <HiOutlineClock className={cn("w-4 h-4 transition-transform group-hover:scale-110")} />
                        </div>
                        <span>
                            <span className="hidden sm:inline">Lotes & Validades</span>
                            <span className="inline sm:hidden">Lotes</span>
                        </span>
                    </Button>
                </nav>
            </div>

            {/* Tab Content */}
            <div className="min-h-[500px] space-y-6">
                {activeTab === 'products' ? (
                    <>
                        {/* Smart Reorder Suggestions - Focus Area */}
                        {reorderSuggestions.length > 0 && (
                            <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center">
                                        <HiOutlineShoppingCart className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                                    </div>
                                    <h2 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Foco de Reabastecimento</h2>
                                    <Badge variant="primary" size="sm" className="bg-primary-500/10 text-primary-600 border-none shadow-none">{reorderSuggestions.length}</Badge>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {reorderSuggestions.slice(0, 3).map(item => (
                                        <Card 
                                            key={item.id} 
                                            padding="md" 
                                            className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-primary-100/50 dark:border-primary-500/20 shadow-sm relative overflow-hidden"
                                        >
                                            <div className="absolute -right-4 -top-4 w-20 h-20 bg-primary-500/5 rounded-full blur-2xl" />
                                            <div className="relative z-10">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="w-9 h-9 rounded-lg bg-primary-100 dark:bg-primary-500/15 flex items-center justify-center text-primary-600 dark:text-primary-400">
                                                        <HiOutlineShoppingCart className="w-4.5 h-4.5" />
                                                    </div>
                                                    <Badge variant="outline" className="bg-primary-50/50 border-primary-100 text-primary-700 dark:bg-primary-500/10 dark:border-primary-500/20 dark:text-primary-400" size="sm">
                                                        {item.reason}
                                                    </Badge>
                                                </div>
                                                <h4 className="font-black text-xs uppercase tracking-tight truncate text-gray-900 dark:text-white mb-2">{item.name}</h4>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase">Stock Atual: <span className="text-gray-900 dark:text-white">{item.currentStock} {item.unit}</span></p>
                                                    <p className="text-[10px] text-primary-600 dark:text-primary-400 font-black font-mono uppercase tracking-tighter">Sugerido: <span className="">+ {item.suggestedQty} {item.unit}</span></p>
                                                </div>
                                            </div>
                                            <div className="absolute bottom-0 left-0 h-1 bg-primary-500/20 w-full" />
                                        </Card>
                                    ))}
                                    {reorderSuggestions.length > 3 && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setActiveTab('products')}
                                            className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-100 dark:border-dark-800 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-900 group w-full h-full"
                                        >
                                            <p className="text-[10px] font-black text-gray-400 group-hover:text-primary-500 uppercase tracking-widest">+{reorderSuggestions.length - 3} outros</p>
                                            <p className="text-[9px] text-gray-300 font-bold italic">Ver catálogo completo</p>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}

                        <InventoryTable
                            key={refreshKey}
                            onEdit={handleEdit}
                            onAddProduct={handleAddProduct}
                            initialSearch={initialSearch}
                            originModule="commercial"
                            // Controlled filters
                            category={selectedCategory}
                            onCategoryChange={setSelectedCategory}
                            status={selectedStatus}
                            onStatusChange={setSelectedStatus}
                            warehouse={selectedWarehouse}
                            onWarehouseChange={setSelectedWarehouse}
                            onSearchChange={setInitialSearch}
                        />
                        <ProductForm
                            isOpen={showProductForm}
                            onClose={handleCloseForm}
                            product={editingProduct}
                            onSuccess={handleProductSuccess}
                            originModule="commercial"
                        />
                        <InventoryPrintReport
                            isOpen={showPrintReport}
                            onClose={() => setShowPrintReport(false)}
                            category={selectedCategory === 'all' ? undefined : selectedCategory}
                            status={selectedStatus === 'all' ? undefined : selectedStatus}
                            warehouseId={selectedWarehouse === 'all' ? undefined : selectedWarehouse}
                            search={initialSearch}
                            originModule="commercial"
                        />
                    </>
                ) : (
                    <BatchManager />
                )}
            </div>

        </div>
    );
}
