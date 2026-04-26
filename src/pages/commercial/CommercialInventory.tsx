import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import InventoryTable from '../../components/inventory/InventoryTable';
import ProductForm from '../../components/inventory/ProductForm';
import InventoryPrintReport from '../../components/inventory/InventoryPrintReport';
import BatchManager from '../../components/inventory/BatchManager';
import { Button } from '../../components/ui';
import {
    HiOutlinePrinter,
    HiOutlineArrowPath,
    HiOutlinePlus,
    HiOutlineSquares2X2,
    HiOutlineClock,
    HiOutlineCube,
    HiOutlineShoppingCart,
    HiOutlineExclamationTriangle,
    HiOutlineCurrencyDollar,
    HiOutlineChartBar,
} from 'react-icons/hi2';
import { useCommercialAnalytics as useAdvancedAnalytics } from '../../hooks/useCommercialAnalytics';
import { useCommercialAnalytics as useBasicAnalytics } from '../../hooks/useCommercial';
import { Card, Badge, PageHeader } from '../../components/ui';
import { formatCurrency, cn } from '../../utils/helpers';
import type { Product } from '../../types';

// ── Mini stat card ──────────────────────────────────────────────────────────-

interface MiniStatProps {
    label: string;
    value: string;
    sub?: string;
    color: string;
    icon: React.ElementType;
    onClick?: () => void;
    alert?: boolean;
}

function MiniStat({ label, value, sub, color, icon: Icon, onClick, alert }: MiniStatProps) {
    const isPrimary = color.includes('primary');
    const isRed = color.includes('red');
    const isBlue = color.includes('blue');
    const isAmber = color.includes('amber');

    const bgClass = isPrimary ? 'bg-primary-100/40 border-primary-200/50' :
                    isRed ? 'bg-red-100/40 border-red-200/50' :
                    isBlue ? 'bg-blue-100/40 border-blue-200/50' :
                    'bg-amber-100/40 border-amber-200/50';

    const iconBgClass = isPrimary ? 'bg-primary-200/60 text-primary-700' :
                        isRed ? 'bg-red-200/60 text-red-700' :
                        isBlue ? 'bg-blue-200/60 text-blue-700' :
                        'bg-amber-200/60 text-amber-700';

    return (
        <Card
            variant="default"
            padding="none"
            className={cn('p-5 transition-all duration-500 group relative overflow-hidden h-full',
                onClick && 'cursor-pointer hover:scale-[1.02]',
                'border shadow-card-strong backdrop-blur-sm',
                bgClass
            )}
            onClick={onClick}
        >
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-current opacity-[0.03] rounded-full blur-2xl group-hover:opacity-[0.06] transition-opacity duration-500" />
            
            {alert && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20">
                    <span className="text-[8px] font-black text-red-500 dark:text-red-400 uppercase tracking-tighter animate-pulse">Crítico</span>
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                </div>
            )}
            
            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                    <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 shadow-inner",
                        iconBgClass
                    )}>
                        <Icon className="w-6 h-6" />
                    </div>
                    <div>
                        <span className={cn("text-[10px] font-black uppercase tracking-[0.2em]", isPrimary ? "text-primary-600/70" : isRed ? "text-red-600/70" : isBlue ? "text-blue-600/70" : "text-amber-600/70")}>{label}</span>
                        {sub && <p className="text-[9px] text-gray-500 dark:text-gray-500 font-bold italic mt-0.5">{sub}</p>}
                    </div>
                </div>
                
                <div className="flex items-baseline gap-1">
                    <p className={cn(
                        "text-2xl font-black tracking-tighter leading-none group-hover:scale-105 transition-transform duration-500 origin-left",
                        isPrimary && "text-primary-900 dark:text-white",
                        isRed && "text-red-900 dark:text-white",
                        isBlue && "text-blue-900 dark:text-white",
                        isAmber && "text-amber-900 dark:text-white"
                    )}>
                        {value}
                    </p>
                </div>
            </div>
            
            <div className={cn(
                "absolute bottom-0 left-0 h-1 transition-all duration-500 group-hover:w-full w-8",
                isPrimary && "bg-primary-500/30",
                isRed && "bg-red-500/30",
                isBlue && "bg-blue-500/30",
                isAmber && "bg-amber-500/30"
            )} />
        </Card>
    );
}

type InventoryTab = 'products' | 'batches';

export default function CommercialInventory() {
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<InventoryTab>('products');
    const [showProductForm, setShowProductForm] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [showPrintReport, setShowPrintReport] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [initialSearch, setInitialSearch] = useState(searchParams.get('search') || '');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [selectedStatus, setSelectedStatus] = useState<string>('all');
    const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');
    
    // Advanced Analytics (Reorder, ABC, Expiry)
    const { reorderSuggestions, nearExpiry, abcData, isLoading: advancedLoading } = useAdvancedAnalytics(90);
    
    // Basic Analytics (Inventory Value)
    const { data: basicAnalytics, isLoading: basicLoading, refetch: refetchBasic } = useBasicAnalytics();

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
        <div className="space-y-6">
            <PageHeader
                title="Inventário Comercial"
                subtitle="Gestão avançada de produtos, referências e valor de stock"
                icon={
                    <div className="relative">
                        <HiOutlineCube className="text-primary-600 dark:text-primary-400 relative z-10" />
                        <div className="absolute -inset-2 bg-primary-500/20 rounded-full blur-md animate-pulse pointer-events-none" />
                    </div>
                }
                actions={
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="font-black text-[10px] uppercase tracking-[0.2em] text-primary-600 dark:text-primary-400 hover:bg-primary-500/10 transition-all duration-300 rounded-lg group"
                            leftIcon={<HiOutlineArrowPath className={cn("w-4 h-4 transition-transform duration-500 group-hover:rotate-180", (basicLoading || advancedLoading) && "animate-spin")} />}
                            onClick={() => {
                                setRefreshKey(prev => prev + 1);
                                refetchBasic();
                            }}
                        >
                            Actualizar
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="font-black text-[10px] uppercase tracking-[0.2em] border-gray-200 dark:border-dark-700 hover:bg-emerald-50 dark:hover:bg-emerald-500/5 hover:border-emerald-200 dark:hover:border-emerald-500/20 transition-all duration-300 rounded-lg text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                            leftIcon={<HiOutlinePrinter className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />}
                            onClick={() => setShowPrintReport(true)}
                        >
                            Imprimir
                        </Button>
                        <Button
                            size="sm"
                            className="font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-primary-500/20 hover:shadow-primary-500/40 transition-all duration-300 rounded-lg bg-primary-600 text-white border-none"
                            leftIcon={<HiOutlinePlus className="w-4 h-4 text-white" />}
                            onClick={handleAddProduct}
                        >
                            Novo Produto
                        </Button>
                    </div>
                }
            />

            {/* Metrics Dashboard */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MiniStat
                    label="Valor em Inventário"
                    value={formatCurrency(metrics.inventoryValue)}
                    sub="Custo total de inventário"
                    color="text-primary-600"
                    icon={HiOutlineCurrencyDollar}
                />
                <MiniStat
                    label="Stock Crítico"
                    value={String(metrics.criticalItems)}
                    sub="Abaixo do nível mínimo"
                    color="text-red-500"
                    icon={HiOutlineExclamationTriangle}
                    alert={metrics.criticalItems > 0}
                />
                <MiniStat
                    label="Produtos Classe A"
                    value={String(metrics.classAItems)}
                    sub="80% da receita gerada"
                    color="text-blue-500"
                    icon={HiOutlineChartBar}
                />
                <MiniStat
                    label="Próximos do Fim"
                    value={String(metrics.expiryAlerts)}
                    sub="Vencimento em 30 dias"
                    color="text-amber-500"
                    icon={HiOutlineClock}
                    alert={metrics.expiryAlerts > 0}
                />
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-100 dark:border-dark-700">
                <nav className="flex gap-4">
                    <button
                        onClick={() => setActiveTab('products')}
                        className={cn(
                            "group flex items-center gap-2 py-4 text-xs font-black uppercase tracking-[0.2em] transition-all border-b-2",
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
                    </button>
                    <button
                        onClick={() => setActiveTab('batches')}
                        className={cn(
                            "group flex items-center gap-2 py-4 text-xs font-black uppercase tracking-[0.2em] transition-all border-b-2",
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
                        Lotes & Validades
                    </button>
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
                                            className="bg-primary-600 text-white border-none shadow-lg shadow-primary-500/20 hover:shadow-xl transition-all duration-300 relative overflow-hidden group/item"
                                        >
                                            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-full transition-transform group-hover/item:scale-110 pointer-events-none" />
                                            <div className="relative z-10">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h4 className="font-black text-xs uppercase tracking-tight truncate max-w-[70%]">{item.name}</h4>
                                                    <Badge variant="outline" className="bg-white/20 border-white/30 text-white dark:text-white dark:border-white/30" size="sm">
                                                        {item.reason}
                                                    </Badge>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] text-white/70 font-bold uppercase">Stock Atual: <span className="text-white">{item.currentStock} {item.unit}</span></p>
                                                    <p className="text-[10px] text-white/90 font-black font-mono uppercase tracking-tighter">Sugerido: <span className="text-white">+ {item.suggestedQty} {item.unit}</span></p>
                                                </div>
                                            </div>
                                            <div className="absolute bottom-0 left-0 h-1 bg-white/30 w-8" />
                                        </Card>
                                    ))}
                                    {reorderSuggestions.length > 3 && (
                                        <button className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-100 dark:border-dark-800 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-900 transition-all group">
                                            <p className="text-[10px] font-black text-gray-400 group-hover:text-primary-500 uppercase tracking-widest">+{reorderSuggestions.length - 3} outros</p>
                                            <p className="text-[9px] text-gray-300 font-bold italic">Ver catlogo completo</p>
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        <InventoryTable
                            key={`${refreshKey}-${initialSearch}`}
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
