import React, { useState, useMemo } from 'react';
import { Input, Badge, Pagination } from '../../ui';
import { HiOutlineSearch, HiOutlinePlus } from 'react-icons/hi';

interface CommercialProductGridProps {
    searchInputRef: React.RefObject<HTMLInputElement | null>;
    posSearch: string;
    setPosSearch: (v: string) => void;
    filteredProducts: any[];
    allProducts: any[];
    posPagination: any;
    addToCart: (product: any, qty?: number) => void;
    handleBarcodeSearch: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export function CommercialProductGrid({
    searchInputRef,
    posSearch,
    setPosSearch,
    filteredProducts,
    allProducts,
    posPagination,
    addToCart,
    handleBarcodeSearch
}: CommercialProductGridProps) {

    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [qtyModalProduct, setQtyModalProduct] = useState<any>(null);
    const [qtyInput, setQtyInput] = useState('1');

    // Derive categories from all in-stock products
    const categories = useMemo(() => {
        const cats = new Set<string>();
        allProducts.forEach((p: any) => {
            if (p.currentStock > 0 && p.category) cats.add(p.category);
        });
        return ['all', ...Array.from(cats).sort()];
    }, [allProducts]);

    // Apply category filter on top of existing search filter
    const displayProducts = useMemo(() => {
        if (selectedCategory === 'all') return filteredProducts;
        return filteredProducts.filter((p: any) => p.category === selectedCategory);
    }, [filteredProducts, selectedCategory]);

    // Keep pagination in sync with filtered list
    const paginatedItems = useMemo(() => {
        const page = posPagination.currentPage - 1;
        const size = posPagination.itemsPerPage;
        return displayProducts.slice(page * size, (page + 1) * size);
    }, [displayProducts, posPagination.currentPage, posPagination.itemsPerPage]);

    const handleProductClick = (product: any) => {
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
        <div className="lg:col-span-2 space-y-4">
            {/* Search */}
            <div className="bg-white dark:bg-dark-900 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-dark-700 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-600 opacity-0 group-focus-within:opacity-100 transition-opacity" />
                <Input
                    ref={searchInputRef}
                    placeholder="Escaneie o código de barras ou busque por código/nome..."
                    value={posSearch}
                    onChange={(e) => setPosSearch(e.target.value)}
                    onKeyDown={handleBarcodeSearch}
                    leftIcon={<HiOutlineSearch className="w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />}
                    autoFocus
                    className="text-lg py-3 bg-gray-50/50 dark:bg-dark-800 border-none group-focus-within:bg-white dark:group-focus-within:bg-dark-900 transition-all font-medium"
                />

                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-3 overflow-hidden">
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1.5 font-black uppercase tracking-widest leading-none">
                        <HiOutlinePlus className="w-2.5 h-2.5 text-amber-500 animate-pulse" />
                        Clique para escolher quantidade
                    </p>
                    <div className="flex gap-2 text-[9px] md:text-[10px]">
                        {[['F2', 'Busca'], ['F4', 'Pagar'], ['F8', 'Gaveta'], ['ESC', 'Limpar']].map(([key, label]) => (
                            <div key={key} className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 dark:bg-dark-800 border border-gray-200/50 dark:border-dark-700 rounded-lg shadow-sm">
                                <kbd className="font-black text-blue-600 dark:text-blue-400 uppercase leading-none">{key}</kbd>
                                <span className="text-gray-500 dark:text-gray-500 uppercase tracking-tighter font-black leading-none">{label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Category Filter */}
            {categories.length > 1 && (
                <div className="flex gap-2 flex-wrap pb-1">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => { setSelectedCategory(cat); posPagination.setCurrentPage(1); }}
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap active:scale-95 ${selectedCategory === cat
                                ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20'
                                : 'bg-white dark:bg-dark-900 text-gray-500 dark:text-gray-400 border-gray-100 dark:border-dark-700 hover:border-blue-300 dark:hover:border-blue-700 shadow-sm'}`}
                        >
                            {cat === 'all' ? `TODOS (${filteredProducts.length})` : cat}
                        </button>
                    ))}
                </div>
            )}

            {/* Product Grid */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[calc(100vh-16rem)] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-dark-700 pb-10">
                {paginatedItems.map((product: any) => (
                    <div
                        key={product.id}
                        className="p-4 cursor-pointer bg-white dark:bg-dark-900 border border-gray-100 dark:border-dark-700/50 rounded-lg hover:border-blue-500/50 hover:shadow-[0_20px_40px_rgba(59,130,246,0.12)] transition-all duration-300 flex flex-col min-h-[140px] group relative overflow-hidden"
                        onClick={() => handleProductClick(product)}
                    >
                        <div className="flex-1 relative z-10">
                            <p className="font-black text-base text-gray-900 dark:text-white truncate mb-1 group-hover:text-blue-600 transition-colors leading-tight tracking-tight">
                                {product.name}
                            </p>
                            <div className="flex items-center gap-1.5 opacity-60">
                                <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest truncate">
                                    {product.code || 'PROD-0000'}
                                </span>
                                {product.category && (
                                    <>
                                        <span className="w-1 h-1 bg-gray-300 dark:bg-dark-600 rounded-full" />
                                        <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest truncate">{product.category}</span>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="mt-4 flex items-end justify-between relative z-10">
                            <div className="flex flex-col">
                                <span className="text-xl font-black text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform duration-300 origin-left block leading-none tracking-tighter shadow-blue-500/5">
                                    {Number(product.price).toLocaleString()} <span className="text-[10px] font-black opacity-40">MTn</span>
                                </span>
                            </div>

                            <div className="flex flex-col items-end gap-1.5">
                                <Badge
                                    variant={(product.currentStock || 0) > 10 ? 'success' : 'warning'}
                                    className="text-[9px] px-2 py-0.5 font-black uppercase tracking-widest bg-gray-50 dark:bg-dark-800 text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-dark-700 rounded-lg group-hover:border-blue-500/20 group-hover:bg-blue-50/50 dark:group-hover:bg-blue-900/10 transition-all shadow-sm"
                                >
                                    {product.currentStock || 0} ESTOQUE
                                </Badge>
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase shadow-lg shadow-blue-500/20 active:scale-90 transition-transform">
                                        <HiOutlinePlus className="w-3.5 h-3.5" />
                                        ADD
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 group-hover:scale-110 transition-all duration-700" />
                    </div>
                ))}

                {displayProducts.length === 0 && (
                    <div className="col-span-full py-20 text-center flex flex-col items-center gap-4">
                        <div className="w-20 h-20 bg-gray-50 dark:bg-dark-800 rounded-full flex items-center justify-center">
                            <HiOutlineSearch className="w-10 h-10 text-gray-300 dark:text-dark-600" />
                        </div>
                        <div>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">Nenhum produto encontrado</p>
                            <p className="text-sm text-gray-500">Tente pesquisar por outro nome ou código</p>
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
                            <input
                                type="number"
                                value={qtyInput}
                                onChange={e => setQtyInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') confirmQty(); if (e.key === 'Escape') setQtyModalProduct(null); }}
                                min="1"
                                max={qtyModalProduct.currentStock}
                                autoFocus
                                className="w-full px-4 py-3 text-3xl font-black text-center rounded-lg border-2 border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none bg-white dark:bg-dark-900 text-gray-900 dark:text-white"
                            />
                            <div className="flex gap-2 mt-2">
                                {[1, 2, 5, 10].map(q => (
                                    <button
                                        key={q}
                                        onClick={() => setQtyInput(String(q))}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-black border-2 transition-all ${qtyInput === String(q) ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 dark:bg-dark-700 text-gray-500 border-transparent'}`}
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setQtyModalProduct(null)}
                                className="flex-1 py-2.5 rounded-lg border-2 border-gray-200 dark:border-dark-600 text-gray-500 font-black text-sm uppercase transition-colors hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmQty}
                                className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-black text-sm uppercase flex items-center justify-center gap-1 transition-colors shadow-lg shadow-blue-500/20"
                            >
                                <HiOutlinePlus className="w-4 h-4" />
                                Adicionar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
