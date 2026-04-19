import { useState, useRef, useEffect, useCallback } from 'react';
import { HiOutlineSearch, HiOutlineX, HiOutlineUserCircle } from 'react-icons/hi';
import { Input, Badge } from '../ui';
import { cn } from '../../utils/helpers';
import { useDebounce } from '../../hooks/useDebounce';
import { customersAPI } from '../../services/api';

// ============================================================================
// CustomerSearchInput - Reusable customer picker with live search
//
// Usage:
//   <CustomerSearchInput onSelect={(c) => setCustomer(c)} />
//   <CustomerSearchInput label="Cliente" clearable selectedCustomer={customer} />
// ============================================================================

export interface CustomerOption {
    id: string;
    code: string;
    name: string;
    phone: string;
    email?: string | null;
    currentBalance: number;
    creditLimit?: number | null;
    loyaltyTier?: string | null;
    type: string;
}

interface CustomerSearchInputProps {
    onSelect: (customer: CustomerOption) => void;
    label?: string;
    placeholder?: string;
    selectedCustomer?: CustomerOption | null;
    clearable?: boolean;
    error?: string;
    className?: string;
    /** Input size */
    size?: 'sm' | 'md' | 'lg';
}

export function CustomerSearchInput({
    onSelect,
    label,
    placeholder = 'Pesquisar cliente por nome, código ou telefone...',
    selectedCustomer,
    clearable = true,
    error,
    className,
    size = 'md',
}: CustomerSearchInputProps) {
    const [query, setQuery]             = useState('');
    const [results, setResults]         = useState<CustomerOption[]>([]);
    const [isOpen, setIsOpen]           = useState(false);
    const [isLoading, setIsLoading]     = useState(false);
    const [highlightIdx, setHighlight]  = useState(0);

    const debouncedQuery = useDebounce(query, 280);
    const wrapperRef     = useRef<HTMLDivElement>(null);

    // ── Outside click ────────────────────────────────────────────────────────
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ── Fetch ────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!debouncedQuery.trim()) { setResults([]); setIsOpen(false); return; }

        let cancelled = false;
        setIsLoading(true);

        customersAPI
            .getAll({ search: debouncedQuery, limit: 10 })
            .then((res: any) => {
                if (cancelled) return;
                const items: CustomerOption[] = (res.data ?? res ?? []).map((c: any) => ({
                    id:             c.id,
                    code:           c.code,
                    name:           c.name,
                    phone:          c.phone,
                    email:          c.email,
                    currentBalance: Number(c.currentBalance ?? 0),
                    creditLimit:    c.creditLimit ? Number(c.creditLimit) : null,
                    loyaltyTier:    c.loyaltyTier,
                    type:           c.type ?? 'individual',
                }));
                setResults(items);
                setIsOpen(true);
                setHighlight(0);
            })
            .catch(() => setResults([]))
            .finally(() => { if (!cancelled) setIsLoading(false); });

        return () => { cancelled = true; };
    }, [debouncedQuery]);

    // ── Keyboard ────────────────────────────────────────────────────────────-
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (!isOpen || !results.length) return;
        if (e.key === 'ArrowDown')  { e.preventDefault(); setHighlight(i => Math.min(i + 1, results.length - 1)); }
        else if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlight(i => Math.max(i - 1, 0)); }
        else if (e.key === 'Enter') { e.preventDefault(); handleSelect(results[highlightIdx]); }
        else if (e.key === 'Escape')    { setIsOpen(false); }
    }, [isOpen, results, highlightIdx]);

    const handleSelect = useCallback((customer: CustomerOption) => {
        onSelect(customer);
        setQuery('');
        setResults([]);
        setIsOpen(false);
    }, [onSelect]);

    const handleClear = () => { setQuery(''); setResults([]); setIsOpen(false); };

    const hasDebt   = selectedCustomer && selectedCustomer.currentBalance > 0;
    const tierColor: Record<string, string> = {
        Bronze: 'text-orange-600',
        Silver: 'text-gray-400',
        Gold:   'text-yellow-500',
        VIP:    'text-purple-500',
    };

    return (
        <div ref={wrapperRef} className={cn('relative', className)}>
            {selectedCustomer && clearable ? (
                <div>
                    {label && (
                        <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            {label}
                        </span>
                    )}
                    <div className={cn(
                        "flex items-center gap-3 border-primary-500 bg-primary-50 dark:bg-primary-900/20 rounded-lg border",
                        size === 'sm' ? 'px-3 py-1.5' : 'px-3 py-2.5'
                    )}>
                        <HiOutlineUserCircle className={cn("text-primary-500 flex-shrink-0", size === 'sm' ? 'w-4 h-4' : 'w-5 h-5')} />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                    {selectedCustomer.name}
                                </p>
                                {selectedCustomer.loyaltyTier && (
                                    <span className={cn('text-xs font-bold', tierColor[selectedCustomer.loyaltyTier] ?? 'text-gray-500')}>
                                        {selectedCustomer.loyaltyTier}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-gray-500">
                                {selectedCustomer.phone}
                                {hasDebt && (
                                    <span className="ml-2 text-red-500 font-medium">
                                        · Dívida: {selectedCustomer.currentBalance.toFixed(2)} MT
                                    </span>
                                )}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleClear}
                            className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                        >
                            <HiOutlineX className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ) : (
                <Input
                    label={label}
                    size={size}
                    placeholder={placeholder}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => results.length > 0 && setIsOpen(true)}
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
                        <button type="button" onClick={handleClear} className="hover:text-gray-600 transition-colors">
                            <HiOutlineX className="w-4 h-4" />
                        </button>
                    ) : undefined}
                />
            )}

            {/* Dropdown */}
            {isOpen && results.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-lg shadow-xl overflow-hidden">
                    <ul className="max-h-56 overflow-y-auto py-1">
                        {results.map((customer, idx) => (
                            <li
                                key={customer.id}
                                onMouseEnter={() => setHighlight(idx)}
                                onMouseDown={e => { e.preventDefault(); handleSelect(customer); }}
                                className={cn(
                                    'flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors',
                                    idx === highlightIdx ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-dark-700'
                                )}
                            >
                                <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                                    <HiOutlineUserCircle className="w-5 h-5 text-primary-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                        {customer.name}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {customer.code} · {customer.phone}
                                    </p>
                                </div>
                                <div className="text-right flex-shrink-0 space-y-1">
                                    {customer.loyaltyTier && (
                                        <p className={cn('text-xs font-bold', tierColor[customer.loyaltyTier] ?? 'text-gray-500')}>
                                            {customer.loyaltyTier}
                                        </p>
                                    )}
                                    {customer.currentBalance > 0 && (
                                        <Badge variant="danger" size="sm">Dívida</Badge>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                    <div className="px-3 py-2 border-t border-gray-100 dark:border-dark-700 bg-gray-50 dark:bg-dark-900/50">
                        <p className="text-xs text-gray-400">→↔ navegar · Enter seleccionar</p>
                    </div>
                </div>
            )}

            {isOpen && !isLoading && results.length === 0 && query.trim() && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-lg shadow-xl px-4 py-6 text-center">
                    <HiOutlineUserCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Nenhum cliente encontrado</p>
                </div>
            )}
        </div>
    );
}
