import { useEffect, useRef, useState } from 'react';
import { HiOutlineMagnifyingGlass, HiOutlineUser, HiOutlineXMark } from 'react-icons/hi2';
import { useCustomers } from '../../hooks/useData';
import { useDebounce } from '../../hooks/useDebounce';
import { cn } from '../../utils/helpers';
import type { Customer } from '../../types';

interface CustomerAutocompleteProps {
    selectedId: string | null;
    selectedName?: string | null;
    onSelect: (id: string | null, customer: Customer | null) => void;
    label?: string;
    placeholder?: string;
    walkInLabel?: string;
    className?: string;
    disabled?: boolean;
    type?: 'individual' | 'company' | string;
}

export default function CustomerAutocomplete({
    selectedId,
    selectedName,
    onSelect,
    label = 'Cliente',
    placeholder = 'Pesquisar cliente...',
    walkInLabel = 'Cliente Balcão',
    className = '',
    disabled = false,
    type
}: CustomerAutocompleteProps) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const debounced = useDebounce(query, 300);
    const containerRef = useRef<HTMLDivElement>(null);

    const { customers, isLoading } = useCustomers({
        search: debounced || undefined,
        type: type && type !== 'all' ? type : undefined,
        page: 1,
        limit: 10
    });

    useEffect(() => {
        const onClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        if (open) document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, [open]);

    const displayValue = selectedName || (selectedId ? '' : '');
    const showWalkInOption = !query.trim();

    const handlePick = (c: Customer | null) => {
        onSelect(c?.id || null, c);
        setQuery('');
        setOpen(false);
    };

    return (
        <div ref={containerRef} className={cn('relative', className)}>
            {label && (
                    <label className="block text-xs font-bold text-slate-700 dark:text-gray-300 mb-1">
                    {label}
                </label>
            )}

            {selectedId ? (
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-dark-600 bg-white dark:bg-dark-800 shadow-sm">
                    <div className="flex items-center gap-2 min-w-0">
                        <HiOutlineUser className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="text-sm font-semibold text-slate-950 dark:text-white truncate">
                            {displayValue || 'Cliente seleccionado'}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => handlePick(null)}
                        disabled={disabled}
                        className="p-1 rounded text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Limpar"
                    >
                        <HiOutlineXMark className="w-4 h-4" />
                    </button>
                </div>
            ) : (
                <div className="relative">
                    <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder={placeholder}
                        value={query}
                        disabled={disabled}
                        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                        onFocus={() => setOpen(true)}
                        className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-slate-950 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)]"
                    />
                </div>
            )}

            {open && !selectedId && (
                <div className="absolute z-30 mt-1 left-0 right-0 max-h-72 overflow-y-auto bg-white dark:bg-dark-800 border border-slate-300/70 dark:border-dark-700 rounded-lg shadow-card-hover">
                    {showWalkInOption && (
                        <button
                            type="button"
                            onClick={() => handlePick(null)}
                            className="w-full text-left px-3 py-2 text-sm font-semibold text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-dark-700 border-b border-slate-200 dark:border-dark-700"
                        >
                            {walkInLabel}
                        </button>
                    )}

                    {isLoading && (
                        <div className="px-3 py-3 text-xs text-slate-500 text-center">A pesquisar...</div>
                    )}

                    {!isLoading && customers.length === 0 && query.trim() && (
                        <div className="px-3 py-3 text-xs text-slate-500 text-center">
                            Nenhum cliente encontrado
                        </div>
                    )}

                    {!isLoading && customers.map((c: Customer) => (
                        <button
                            key={c.id}
                            type="button"
                            onClick={() => handlePick(c)}
                            className="w-full text-left px-3 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors flex items-center gap-2 border-b border-slate-100 dark:border-dark-700/50 last:border-b-0"
                        >
                            <HiOutlineUser className="w-4 h-4 text-emerald-500 shrink-0" />
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-slate-950 dark:text-white truncate">
                                    {c.name}
                                </div>
                                {(c.phone || c.email) && (
                                    <div className="text-[10px] text-slate-500 truncate">
                                        {c.phone}{c.phone && c.email ? ' · ' : ''}{c.email}
                                    </div>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
