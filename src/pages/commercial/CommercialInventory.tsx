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
    return (
        <Card
            variant="glass"
            className={cn('p-5 transition-all duration-500 group relative overflow-hidden border-white/40 dark:border-dark-700/30',
                onClick && 'cursor-pointer hover:shadow-2xl hover:shadow-primary-500/10 hover:-translate-y-1'
            )}
            onClick={onClick}
        >
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/5 dark:bg-primary-400/5 rounded-bl-full pointer-events-none" />
            
            {alert && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    <span className="text-[8px] font-black text-red-500 uppercase tracking-tighter animate-pulse">Crítico</span>
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                </div>
            )}

            <div className="flex items-center gap-3 mb-3">
                <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-500 group-hover:rotate-12",
                    "bg-white/50 dark:bg-dark-900/50 backdrop-blur-sm shadow-sm border border-white/50 dark:border-dark-700/50",
                    color
                )}>
                    <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-black uppercase tracking-[0.2em]">{label}</span>
            </div>
            
            <div className="flex items-baseline gap-1">
                <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter leading-none group-hover:scale-105 transition-transform duration-500 origin-left">
                    {value}
                </p>
            </div>
            
            {sub && (
                <div className="mt-3 flex items-center gap-2">
                    <div className="h-px flex-1 bg-gray-100 dark:bg-dark-700" />
                    <p className="text-[9px] text-gray-400 font-bold italic whitespace-nowrap">{sub}</p>
                </div>
            )}
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
                icon={<HiOutlineCube />}
                actions={
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="font-black text-[10px] uppercase tracking-[0.2em] text-gray-400 hover:text-primary-600 hover:bg-primary-500/5 transition-all duration-300 rounded-lg"
                            leftIcon={<HiOutlineArrowPath className={cn("w-4 h-4", (basicLoading || advancedLoading) && "animate-spin")} />}
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
                            className="font-black text-[10px] uppercase tracking-[0.2em] border-gray-200 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-800 transition-all duration-300 rounded-lg"
                            leftIcon={<HiOutlinePrinter className="w-4 h-4 text-emerald-500" />}
                            onClick={() => setShowPrintReport(true)}
                        >
                            Imprimir
                        </Button>
                        <Button
                            size="sm"
                            className="font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-primary-500/20 hover:shadow-primary-500/40 transition-all duration-300 rounded-lg bg-gradient-to-r from-primary-600 to-indigo-600 border-none"
                            leftIcon={<HiOutlinePlus className="w-4 h-4" />}
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
                        <HiOutlineSquares2X2 className={cn("w-4 h-4 transition-transform group-hover:scale-110", activeTab === 'products' ? "text-primary-500" : "text-gray-300")} />
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
                        <HiOutlineClock className={cn("w-4 h-4 transition-transform group-hover:scale-110", activeTab === 'batches' ? "text-amber-500" : "text-gray-300")} />
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
                                    <HiOutlineShoppingCart className="w-5 h-5 text-primary-500" />
                                    <h2 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Foco de Reabastecimento</h2>
                                    <Badge variant="primary" size="sm">{reorderSuggestions.length}</Badge>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {reorderSuggestions.slice(0, 3).map(item => (
                                        <Card 
                                            key={item.id} 
                                            variant="premium" 
                                            padding="md" 
                                            className="bg-primary-50/50 dark:bg-primary-900/10 border-none hover:shadow-xl transition-all duration-300"
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="max-w-[70%]">
                                                    <h4 className="font-black text-xs text-gray-900 dark:text-white uppercase truncate tracking-tight">{item.name}</h4>
                                                    <p className="text-[9px] text-gray-400 mt-1 font-bold uppercase">Stock: <span className="text-gray-900 dark:text-white">{item.currentStock} {item.unit}</span></p>
                                                    <p className="text-[9px] text-primary-600 font-black mt-1 uppercase tracking-tighter">Sugerido: +{item.suggestedQty} {item.unit}</p>
                                                </div>
                                                <Badge variant={item.reason === 'Stock Crítico' ? 'danger' : 'warning'} size="sm">
                                                    {item.reason}
                                                </Badge>
                                            </div>
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
                        />
                    </>
                ) : (
                    <BatchManager />
                )}
            </div>
        </div>
    );
}
