import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { HiOutlineSearch, HiOutlineX, HiOutlineCube } from 'react-icons/hi';
import { Input, Badge } from '../ui';
import { formatCurrency, cn } from '../../utils/helpers';
import { useDebounce } from '../../hooks/useDebounce';
import { productsAPI } from '../../services/api';
import { logger } from '../../utils/logger';

// ============================================================================
// ProductSearchInput - Reusable product picker with live search
//
// Usage:
//   <ProductSearchInput onSelect={(p) => setProduct(p)} />
//   <ProductSearchInput originModule="commercial" placeholder="Pesquisar..." />
// ============================================================================

export interface ProductOption {
    id: string;
    code: string;
    name: string;
    price: number;
    costPrice: number;
    currentStock: number;
    unit: string;
    category: string;
    status: string;
}

interface ProductSearchInputProps {
    /** Called when the user selects a product */
    onSelect: (product: ProductOption) => void;
    /** Filter products by module (e.g. "commercial", "pharmacy") */
    originModule?: string;
    /** Input placeholder text */
    placeholder?: string;
    /** Show current stock in dropdown */
    showStock?: boolean;
    /** Label rendered above the input */
    label?: string;
    /** Pre-selected product to display */
    selectedProduct?: ProductOption | null;
    /** Allow clearing the selection */
    clearable?: boolean;
    /** Error message */
    error?: string;
    /** Extra CSS class for the wrapper */
    className?: string;
    /** Disable products with zero stock */
    requireStock?: boolean;
    /** Input size */
    size?: 'sm' | 'md' | 'lg';
}

export function ProductSearchInput({
    onSelect,
    originModule,
    placeholder = 'Pesquisar produto por nome, código ou barcode...',
    showStock = true,
    label,
    selectedProduct,
    clearable = true,
    error,
    className,
    requireStock = false,
    size = 'md',
}: ProductSearchInputProps) {
    const [query, setQuery]           = useState('');
    const [results, setResults]       = useState<ProductOption[]>([]);
    const [isOpen, setIsOpen]         = useState(false);
    const [isLoading, setIsLoading]   = useState(false);
    const [highlightIdx, setHighlight] = useState(0);

    const debouncedQuery = useDebounce(query, 280);
    const wrapperRef     = useRef<HTMLDivElement>(null);
    const inputRef       = useRef<HTMLInputElement>(null);
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

    // ── Position calculation ────────────────────────────────────────────────-
    useLayoutEffect(() => {
        if (!isOpen || !wrapperRef.current) return;

        const updatePosition = () => {
            const rect = wrapperRef.current!.getBoundingClientRect();
            setCoords({
                top: rect.bottom + window.scrollY,
                left: rect.left + window.scrollX,
                width: rect.width
            });
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOpen]);

    // ── Close on outside click ──────────────────────────────────────────────-
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ── Fetch results ──────────────────────────────────────────────────────────
    useEffect(() => {
        // Only fetch if open AND (has query OR results are empty)
        if (!isOpen && !debouncedQuery.trim()) return;

        let cancelled = false;
        setIsLoading(true);

        productsAPI
            .getAll({
                search: debouncedQuery || undefined,
                limit: 50, // Increased limit for better initial visibility
                // Relax filter: commercial module sees everything except specialized modules
                ...(originModule && originModule !== 'commercial' ? { origin_module: originModule } : {}),
            })
            .then((res: any) => {
                if (cancelled) return;
                const rawItems = Array.isArray(res) ? res : (res.data || []);
                const items: ProductOption[] = rawItems.map((p: any) => ({
                    id:           p.id,
                    code:         p.code,
                    name:         p.name,
                    price:        Number(p.price || 0),
                    costPrice:    Number(p.costPrice || 0),
                    currentStock: Number(p.currentStock || 0),
                    unit:         p.unit || 'un',
                    category:     p.category || 'other',
                    status:       p.status || 'in_stock',
                }));
                setResults(requireStock ? items.filter(p => p.currentStock > 0) : items);
                if (items.length > 0) {
                    setIsOpen(true);
                }
                setHighlight(0);
            })
            .catch((err) => {
                logger.error('Error fetching products in search:', err);
                toast.error('Erro ao pesquisar produtos');
                setResults([]);
            })
            .finally(() => { if (!cancelled) setIsLoading(false); });

        return () => { cancelled = true; };
    }, [debouncedQuery, originModule, requireStock, isOpen]);

    // ── Keyboard navigation ──────────────────────────────────────────────────
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (!isOpen || !results.length) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight(i => Math.min(i + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            handleSelect(results[highlightIdx]);
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    }, [isOpen, results, highlightIdx]);

    // ── Selection ────────────────────────────────────────────────────────────-
    const handleSelect = useCallback((product: ProductOption) => {
        onSelect(product);
        setQuery('');
        setResults([]);
        setIsOpen(false);
    }, [onSelect]);

    const handleClear = () => {
        setQuery('');
        setResults([]);
        setIsOpen(false);
        inputRef.current?.focus();
    };

    // ── Stock badge config ────────────────────────────────────────────────────
    const stockBadgeVariant = (stock: number, status: string) => {
        if (status === 'out_of_stock' || stock === 0) return 'danger'  as const;
        if (status === 'low_stock'    || stock <= 5)  return 'warning' as const;
        return 'success' as const;
    };

    return (
        <div ref={wrapperRef} className={cn('relative', className)}>
            {/* Selected product display */}
            {selectedProduct && clearable ? (
                <div>
                    {label && (
                        <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            {label}
                        </span>
                    )}
                    <div className={cn(
                        "flex items-center gap-2 border-primary-500 bg-primary-50 dark:bg-primary-900/20 rounded-lg border",
                        size === 'sm' ? 'px-3 py-1.5' : 'px-3 py-2.5'
                    )}>
                        <HiOutlineCube className={cn("text-primary-500 flex-shrink-0", size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {selectedProduct.name}
                            </p>
                            <p className="text-xs text-gray-500">
                                {selectedProduct.code} · {formatCurrency(selectedProduct.price)}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleClear}
                            className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                            title="Remover produto"
                        >
                            <HiOutlineX className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ) : (
                <Input
                    ref={inputRef}
                    label={label}
                    size={size}
                    placeholder={placeholder}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setIsOpen(true)}
                    autoComplete="off"
                    error={error}
                    leftIcon={
                        isLoading
                            ? <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                              </svg>
                            : <HiOutlineSearch className="w-4 h-4" />
                    }
                    rightIcon={query ? (
                        <button type="button" onClick={handleClear} className="hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                            <HiOutlineX className="w-4 h-4" />
                        </button>
                    ) : undefined}
                />
            )}

            {/* Dropdown via Portal */}
            {isOpen && (results.length > 0 || (query.trim() && !isLoading && results.length === 0)) && createPortal(
                <div 
                    style={{ 
                        position: 'absolute',
                        top: coords.top,
                        left: coords.left,
                        width: coords.width,
                        zIndex: 9999 
                    }}
                    className="mt-1 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200"
                >
                    {results.length > 0 ? (
                        <>
                            <ul className="max-h-64 overflow-y-auto py-1">
                                {results.map((product, idx) => {
                                    const outOfStock = product.currentStock === 0 || product.status === 'out_of_stock';
                                    const isHighlighted = idx === highlightIdx;

                                    return (
                                        <li
                                            key={product.id}
                                            onMouseEnter={() => setHighlight(idx)}
                                            onMouseDown={e => { e.preventDefault(); handleSelect(product); }}
                                            className={cn(
                                                'flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors',
                                                isHighlighted ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-dark-700',
                                                outOfStock && requireStock && 'opacity-50 cursor-not-allowed'
                                            )}
                                        >
                                            {/* Icon */}
                                            <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-dark-700 flex items-center justify-center flex-shrink-0">
                                                <HiOutlineCube className="w-4 h-4 text-gray-400" />
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                    {product.name}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    {product.code}
                                                    <span className="mx-1">·</span>
                                                    <span className="capitalize">{product.category}</span>
                                                </p>
                                            </div>

                                            {/* Price + stock */}
                                            <div className="text-right flex-shrink-0">
                                                <p className="text-sm font-bold text-gray-900 dark:text-white">
                                                    {formatCurrency(product.price)}
                                                </p>
                                                {showStock && (
                                                    <Badge variant={stockBadgeVariant(product.currentStock, product.status)} size="sm">
                                                        {product.currentStock} {product.unit}
                                                    </Badge>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                            <div className="px-3 py-2 border-t border-gray-100 dark:border-dark-700 bg-gray-50 dark:bg-dark-900/50">
                                <p className="text-xs text-gray-400 font-medium">
                                    →↔ navegar · Enter seleccionar · Esc fechar
                                </p>
                            </div>
                        </>
                    ) : (
                        <div className="px-4 py-8 text-center bg-white dark:bg-dark-800">
                            <HiOutlineCube className="w-10 h-10 text-gray-200 dark:text-dark-600 mx-auto mb-3" />
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Nenhum produto encontrado para "<strong>{query}</strong>"</p>
                        </div>
                    )}
                </div>,
                document.body
            )}
        </div>
    );
}
