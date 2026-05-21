import React, { useState, useMemo, useCallback } from 'react';
import { Button, Input, Pagination, Select } from '../../ui';
import { HiOutlineMagnifyingGlass, HiOutlinePlus } from 'react-icons/hi2';
import { cn, formatCurrency } from '../../../utils/helpers';
import { categoryLabels } from '../../../utils/constants';
import { useCategories } from '../../../hooks/useCategories';

export interface CommercialPOSProduct {
    id: string;
    code: string;
    name: string;
    price: number | string;
    currentStock: number;
    packSize?: number | string;
    barcode?: string;
    sku?: string;
    unit?: string;
    category?: string;
    categoryId?: string;
    warehouseStocks?: Array<{ warehouseId: string; quantity: number }>;
}

interface ProductGridPagination {
    currentPage: number;
    itemsPerPage: number;
    setCurrentPage: (page: number) => void;
    setItemsPerPage: (size: number) => void;
}

interface CommercialProductGridProps {
    searchInputRef: React.RefObject<HTMLInputElement | null>;
    posSearch: string;
    setPosSearch: (v: string) => void;
    filteredProducts: CommercialPOSProduct[];
    allProducts: CommercialPOSProduct[];
    posPagination: ProductGridPagination;
    addToCart: (product: CommercialPOSProduct, qty?: number) => void;
    handleBarcodeSearch: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    processingActions?: Record<string, boolean>;
}

export function CommercialProductGrid({
    searchInputRef,
    posSearch,
    setPosSearch,
    filteredProducts,
    allProducts,
    posPagination,
    addToCart,
    handleBarcodeSearch,
    processingActions = {}
}: CommercialProductGridProps) {

    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [qtyModalProduct, setQtyModalProduct] = useState<CommercialPOSProduct | null>(null);
    const [qtyInput, setQtyInput] = useState('1');
    const { categories: sysCategories } = useCategories();

    const getCategoryName = useCallback((p: CommercialPOSProduct) => {
        if (p.categoryId) {
            const found = sysCategories.find((c) => c.id === p.categoryId);
            if (found) return found.name;
        }
        return p.category ? (categoryLabels as Record<string, string>)[p.category] || p.category : '';
    }, [sysCategories]);

    // Derive categories from all in-stock products
    const categories = useMemo(() => {
        const cats = new Set<string>();
        allProducts.forEach((p) => {
            if (Number(p.currentStock) > 0) {
                const catName = getCategoryName(p);
                if (catName) cats.add(catName);
            }
        });
        return ['all', ...Array.from(cats).sort()];
    }, [allProducts, getCategoryName]);

    // Apply category filter on top of existing search filter
    const displayProducts = useMemo(() => {
        if (selectedCategory === 'all') return filteredProducts;
        return filteredProducts.filter((p) => getCategoryName(p) === selectedCategory);
    }, [filteredProducts, selectedCategory, getCategoryName]);

    // Keep pagination in sync with filtered list
    const paginatedItems = useMemo(() => {
        const page = posPagination.currentPage - 1;
        const size = posPagination.itemsPerPage;
        return displayProducts.slice(page * size, (page + 1) * size);
    }, [displayProducts, posPagination.currentPage, posPagination.itemsPerPage]);

    const handleProductClick = (product: CommercialPOSProduct) => {
        setQtyModalProduct(product);
        setQtyInput('1');
    };

    const confirmQty = () => {
        if (!qtyModalProduct) return;
        const qty = parseInt(qtyInput, 10);
        if (!qty || qty <= 0) return;
        addToCart(qtyModalProduct, qty);
        setQtyModalProduct(null);
    };

    return (
        <div className="lg:col-span-3 space-y-6">
            {/* Search - Re-styled for Dark/Gamer look */}
            {/* Search - Professional & Clean */}
            <div className="bg-white dark:bg-[#111214] border border-slate-200 dark:border-white/5 rounded-2xl p-5 shadow-sm relative overflow-hidden group">
                <div className="relative z-10 space-y-4">
                    <Input
                        ref={searchInputRef}
                        placeholder="Busque por produto, código ou código de barras..."
                        value={posSearch}
                        onChange={(e) => setPosSearch(e.target.value)}
                        onKeyDown={handleBarcodeSearch}
                        leftIcon={<HiOutlineMagnifyingGlass className="w-5 h-5 text-slate-400 dark:text-white/20 group-focus-within:text-blue-500 transition-colors" />}
                        autoFocus
                        size="lg"
                        className="bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-white/5 focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/5 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/20 font-medium h-12 rounded-xl transition-all"
                    />

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <p className="text-[10px] text-slate-400 dark:text-white/30 flex items-center gap-2 font-bold uppercase tracking-wider">
                            <HiOutlinePlus className="w-3 h-3 text-blue-500/50" />
                            Selecione um produto para adicionar
                        </p>
                        <div className="flex gap-2 flex-wrap justify-center">
                            {[['F2', 'Busca'], ['F4', 'Pagar'], ['ESC', 'Limpar']].map(([key, label]) => (
                                <div key={key} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/5 rounded-lg hover:border-white/10 transition-all cursor-default">
                                    <kbd className="font-bold text-blue-600 dark:text-blue-400 uppercase text-[10px]">{key}</kbd>
                                    <span className="text-[9px] text-slate-400 dark:text-white/40 uppercase font-bold tracking-wider">{label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

                <div className="pb-4">
                    <Select
                        options={categories.map(cat => ({
                            label: cat === 'all' ? `Todas as Categorias (${filteredProducts.length})` : cat,
                            value: cat
                        }))}
                        value={selectedCategory}
                        onChange={(e) => { setSelectedCategory(e.target.value); posPagination.setCurrentPage(1); }}
                        placeholder="Filtrar por Categoria"
                    />
                </div>

            {/* Product Grid - Premium Dark Style */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-5 max-h-[calc(100vh-10rem)] overflow-y-auto pr-3 scrollbar-none pb-10">
                {paginatedItems.map((product) => {
                    const isProcessing = processingActions[product.id];
                    const stock = Number(product.currentStock) || 0;
                    const stockTone = stock > 20
                        ? 'text-emerald-400 bg-emerald-500/5 border-emerald-500/10'
                        : stock > 5
                            ? 'text-amber-400 bg-amber-500/5 border-amber-500/10'
                            : 'text-rose-400 bg-rose-500/5 border-rose-500/10';
                    return (
                        <div
                            key={product.id}
                            className={cn(
                                "p-6 cursor-pointer bg-white dark:bg-[#111214] border border-slate-200 dark:border-white/5 rounded-2xl hover:border-blue-500/30 dark:hover:border-white/20 transition-all flex flex-col items-center text-center min-h-[160px] group relative shadow-sm hover:shadow-md",
                                isProcessing && "opacity-70"
                            )}
                            onClick={() => !isProcessing && handleProductClick(product)}
                        >
                            <div className="flex-1 space-y-1 w-full">
                                <p className="font-bold text-base text-slate-900 dark:text-white truncate leading-tight tracking-tight">
                                    {product.name}
                                </p>
                                <div className="flex items-center justify-center gap-2">
                                    <span className="text-[9px] font-bold text-slate-400 dark:text-white/20 uppercase tracking-wider">
                                        {product.sku || product.barcode || 'S/ REF'}
                                    </span>
                                    {product.category && (
                                        <>
                                            <span className="w-1 h-1 bg-white/10 rounded-full" />
                                            <span className="text-[9px] font-bold text-slate-400 dark:text-white/20 uppercase tracking-wider">{getCategoryName(product)}</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="mt-4 flex flex-col items-center gap-3 w-full">
                                <span className="text-xl font-bold text-slate-900 dark:text-white tracking-tight block leading-none">
                                    {formatCurrency(Number(product.price))}
                                </span>

                                <div className="flex flex-col items-center gap-3">
                                    <span className={cn(
                                        "inline-flex items-center gap-1.5 text-[8px] px-3 py-1 font-bold uppercase tracking-wider border rounded-md",
                                        stockTone
                                    )}>
                                        {stock} EM STOCK
                                    </span>
                                    
                                    <div className={cn(
                                        "transition-all duration-300",
                                        isProcessing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                    )}>
                                        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold uppercase shadow-lg shadow-blue-500/10">
                                            {isProcessing ? (
                                                <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                            ) : (
                                                <HiOutlinePlus className="w-4 h-4" />
                                            )}
                                            {isProcessing ? 'A PROCESSAR' : 'Adicionar'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {displayProducts.length === 0 && (
                    <div className="col-span-full py-20 text-center flex flex-col items-center gap-4">
                        <div className="w-20 h-20 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-dark-800 dark:to-dark-900 rounded-full flex items-center justify-center ring-1 ring-gray-200/50 dark:ring-dark-700 shadow-inner">
                            <HiOutlineMagnifyingGlass className="w-10 h-10 text-gray-300 dark:text-dark-600" />
                        </div>
                        <div>
                            <p className="text-lg font-black text-gray-900 dark:text-white tracking-tight">Nenhum produto encontrado</p>
                            <p className="text-sm text-gray-500 mt-0.5">Tente pesquisar por outro nome ou código</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {displayProducts.length > 0 && (
                <div className="pt-2">
                    <Pagination
                        currentPage={posPagination.currentPage}
                        totalItems={displayProducts.length}
                        itemsPerPage={posPagination.itemsPerPage}
                        onPageChange={posPagination.setCurrentPage}
                        onItemsPerPageChange={posPagination.setItemsPerPage}
                        itemsPerPageOptions={[12, 24, 48]}
                        showInfo={false}
                        className="mt-0"
                    />
                </div>
            )}

            {/* Quantity Input Modal */}
            {qtyModalProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setQtyModalProduct(null)} />
                    <div className="relative z-10 bg-white dark:bg-dark-800 rounded-lg shadow-2xl p-6 w-72 flex flex-col gap-4">
                        <div>
                            <h3 className="font-black text-gray-900 dark:text-white text-base truncate">{qtyModalProduct.name}</h3>
                            <p className="text-xs text-gray-400 mt-0.5">
                                Stock: <span className="font-bold text-green-600">{qtyModalProduct.currentStock} un.</span>
                                &nbsp;·&nbsp;
                                <span className="font-bold text-blue-600">{Number(qtyModalProduct.price).toLocaleString()} MTn</span>
                            </p>
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1.5">Quantidade</label>
                            <Input
                                type="number"
                                value={qtyInput}
                                onChange={e => setQtyInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') confirmQty(); if (e.key === 'Escape') setQtyModalProduct(null); }}
                                min="1"
                                max={qtyModalProduct.currentStock}
                                autoFocus
                                size="lg"
                                className="h-16 text-3xl font-black text-center rounded-lg border-2 border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-dark-900 text-gray-900 dark:text-white"
                            />
                            <div className="flex gap-2 mt-2">
                                {[1, 2, 5, 10].map(q => (
                                    <Button
                                        key={q}
                                        variant={qtyInput === String(q) ? 'primary' : 'ghost'}
                                        size="xs"
                                        onClick={() => setQtyInput(String(q))}
                                        className="flex-1"
                                    >
                                        {q}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setQtyModalProduct(null)}
                                className="flex-1"
                            >
                                Cancelar
                            </Button>
                            <Button
                                variant="primary"
                                onClick={confirmQty}
                                className="flex-1"
                                leftIcon={<HiOutlinePlus className="w-4 h-4" />}
                            >
                                Adicionar
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
