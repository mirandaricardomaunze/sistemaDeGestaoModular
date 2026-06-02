import { useState, useMemo, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
    HiOutlineBanknotes, HiOutlineCheck, HiOutlineXMark, HiOutlinePlus,
    HiOutlineTrash
} from 'react-icons/hi2';
import { formatCurrency, cn } from '../../../utils/helpers';
import { Button, Input } from '../../ui';

// ──-Icons ──────────────────────────────────────────────────────────────────-
function PhoneIcon({ className }: { className?: string }) {
    return (
        <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 8.25h3" />
        </svg>
    );
}
function CardIcon({ className }: { className?: string }) {
    return (
        <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
        </svg>
    );
}
function DocumentIcon({ className }: { className?: string }) {
    return (
        <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
    );
}

// ──-Types ──────────────────────────────────────────────────────────────────-
export type PaymentMethodType = 'cash' | 'mpesa' | 'emola' | 'card' | 'credit';

export interface PaymentEntry {
    method: PaymentMethodType;
    amount: number;
    reference?: string;
}

interface PaymentCustomer {
    id: string;
    name: string;
    phone?: string;
    code?: string;
}

interface CommercialPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (payments: PaymentEntry[], isCredit: boolean, creditDueDays: number) => void;
    cartTotal: number;
    cartSubtotal: number;
    cartDiscount: number;
    cartTax: number;
    ivaRate: number;
    customerName: string;
    selectedCustomer: PaymentCustomer | null;
    isLoading?: boolean;
}

const METHOD_CONFIG: Record<PaymentMethodType, { label: string; color: string; bg: string; border: string; icon: ReactNode }> = {
    cash: {
        label: 'Dinheiro', color: 'text-green-700 dark:text-green-400',
        bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-500',
        icon: <HiOutlineBanknotes className="w-5 h-5" />
    },
    mpesa: {
        label: 'M-Pesa', color: 'text-red-700 dark:text-red-400',
        bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-500',
        icon: <PhoneIcon className="w-5 h-5" />
    },
    emola: {
        label: 'E-Mola', color: 'text-orange-700 dark:text-orange-400',
        bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-500',
        icon: <PhoneIcon className="w-5 h-5" />
    },
    card: {
        label: 'Cartão/TPA', color: 'text-blue-700 dark:text-blue-400',
        bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-500',
        icon: <CardIcon className="w-5 h-5" />
    },
    credit: {
        label: 'A Crédito', color: 'text-amber-700 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-500',
        icon: <DocumentIcon className="w-5 h-5" />
    },
};

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

// ──-Component ──────────────────────────────────────────────────────────────-
export function CommercialPaymentModal({
    isOpen, onClose, onConfirm,
    cartTotal, cartSubtotal, cartDiscount, cartTax, ivaRate,
    customerName, selectedCustomer,
    isLoading = false
}: CommercialPaymentModalProps) {

    const [payments, setPayments] = useState<PaymentEntry[]>([{ method: 'cash', amount: cartTotal, reference: '' }]);
    const [isCredit, setIsCredit] = useState(false);
    const [creditDueDays, setCreditDueDays] = useState(30);

    // Reset state every time modal opens with fresh cart total
    useEffect(() => {
        if (isOpen) {
            setPayments([{ method: 'cash', amount: cartTotal, reference: '' }]);
            setIsCredit(false);
            setCreditDueDays(30);
        }
    }, [isOpen, cartTotal]);

    const totalPaid = useMemo(() => payments.reduce((s, p) => s + (Number(p.amount) || 0), 0), [payments]);
    const change = useMemo(() => Math.max(0, totalPaid - cartTotal), [totalPaid, cartTotal]);
    const remaining = useMemo(() => Math.max(0, cartTotal - totalPaid), [totalPaid, cartTotal]);
    const isFullyPaid = totalPaid >= cartTotal || isCredit;

    const addPayment = (method: PaymentMethodType) => {
        const existsIdx = payments.findIndex(p => p.method === method);
        if (existsIdx >= 0) return;
        setPayments(prev => [...prev, { method, amount: remaining, reference: '' }]);
    };

    const removePayment = (idx: number) => {
        if (payments.length <= 1) return;
        setPayments(prev => prev.filter((_, i) => i !== idx));
    };

    const updatePayment = <K extends keyof PaymentEntry>(idx: number, field: K, value: PaymentEntry[K]) => {
        setPayments(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
    };

    const setQuickAmount = (idx: number, amount: number) => {
        updatePayment(idx, 'amount', amount);
    };

    const handleCredit = () => {
        setIsCredit(v => {
            if (!v) setPayments([{ method: 'credit', amount: 0, reference: '' }]);
            else setPayments([{ method: 'cash', amount: cartTotal, reference: '' }]);
            return !v;
        });
    };

    const handleConfirm = useCallback(() => {
        if (!isFullyPaid) return;
        onConfirm(payments, isCredit, creditDueDays);
    }, [creditDueDays, isCredit, isFullyPaid, onConfirm, payments]);

    // Enter key confirms payment
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Enter' && isFullyPaid) handleConfirm();
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, isFullyPaid, handleConfirm, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative z-10 flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl dark:bg-[#111214] sm:mx-4 sm:h-auto sm:max-h-[90vh] sm:max-w-xl sm:rounded-2xl sm:border sm:border-slate-200 sm:dark:border-white/5">
                {/* Header - Modern Style */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-3 flex-shrink-0 relative overflow-hidden pt-[max(env(safe-area-inset-top),1rem)] sm:pt-5">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16" />
                    <div className="relative z-10 min-w-0">
                        <h2 className="text-white font-black text-lg sm:text-xl uppercase tracking-normal italic">PAGAMENTO</h2>
                        <p className="text-white/60 text-[10px] font-bold uppercase tracking-[0.2em] mt-1 italic">
                            {selectedCustomer?.name || customerName || 'Consumidor Geral'}
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        className="p-2.5 rounded-xl text-white hover:bg-white/10 active:scale-90 relative z-10"
                    >
                        <HiOutlineXMark className="w-5 h-5" />
                    </Button>
                </div>

                <div className="overflow-y-auto flex-1">
                    {/* Summary Section - High Contrast */}
                    <div className="px-4 sm:px-6 py-4 sm:py-6 bg-slate-50/50 dark:bg-black/40 border-b border-slate-200 dark:border-white/5">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 text-center">
                            <div className="space-y-1">
                                <p className="text-[10px] uppercase font-black text-slate-400 dark:text-white/20 tracking-[0.2em]">Subtotal</p>
                                <p className="font-black text-slate-900 dark:text-white text-sm tracking-tight">{formatCurrency(cartSubtotal)}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] uppercase font-black text-slate-400 dark:text-white/20 tracking-[0.2em]">IVA ({ivaRate}%)</p>
                                <p className="font-black text-slate-900 dark:text-white text-sm tracking-tight">{formatCurrency(cartTax)}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] uppercase font-black text-slate-400 dark:text-white/20 tracking-[0.2em]">Poupas</p>
                                <p className="font-black text-rose-500 text-sm tracking-tight">- {formatCurrency(cartDiscount)}</p>
                            </div>
                        </div>
                        <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-slate-200 dark:border-white/5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 dark:text-white/30 italic">Total Final</span>
                            <span className="text-3xl sm:text-4xl font-black text-blue-600 dark:text-blue-400 italic tracking-normal sm:tracking-tighter drop-shadow-[0_0_15px_rgba(96,165,250,0.3)] break-words">
                                {formatCurrency(cartTotal)}
                            </span>
                        </div>
                    </div>

                    {/* Credit toggle - Modern Style */}
                    <div className="px-4 sm:px-6 pt-4 sm:pt-6">
                        <Button
                            variant="ghost"
                            onClick={handleCredit}
                            className={cn(
                                "w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-300",
                                isCredit
                                    ? "bg-amber-500/10 border-amber-500/50 text-amber-600 dark:text-amber-500 shadow-lg shadow-amber-500/5"
                                    : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-400 dark:text-white/40 hover:border-amber-500/30 hover:text-amber-600 dark:hover:text-white"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <DocumentIcon className="w-5 h-5" />
                                <span className="text-[11px] font-black uppercase tracking-[0.2em] italic">Venda a Crédito</span>
                            </div>
                            <div className={cn(
                                "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                                isCredit ? "bg-amber-500 border-amber-500" : "border-white/10"
                            )}>
                                {isCredit && <HiOutlineCheck className="w-4 h-4 text-black font-black" />}
                            </div>
                        </Button>

                        {isCredit && (
                            <div className="mt-4 flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:gap-4">
                                <p className="text-[10px] text-slate-400 dark:text-white/30 font-black uppercase tracking-widest italic">Vence em</p>
                                <div className="grid grid-cols-2 gap-2 sm:flex">
                                    {[15, 30, 45, 60].map(d => (
                                        <Button
                                            key={d}
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setCreditDueDays(d)}
                                            className={cn(
                                                "px-4 py-1.5 rounded-xl text-[10px] font-black border transition-all uppercase tracking-widest",
                                                creditDueDays === d
                                                    ? "bg-amber-500 text-black border-amber-500"
                                                    : "bg-white/5 text-white/40 border-transparent hover:bg-white/10"
                                            )}
                                        >
                                            {d}d
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Payment methods - Tech Style */}
                    {!isCredit && (
                        <div className="px-4 sm:px-6 pt-4 sm:pt-6 space-y-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-white/20 italic">Métodos Adicionais</p>
                                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                                    {(['cash', 'mpesa', 'emola', 'card'] as PaymentMethodType[]).map(m => {
                                        const conf = METHOD_CONFIG[m];
                                        const active = payments.some(p => p.method === m);
                                        return (
                                            <Button
                                                key={m}
                                                onClick={() => addPayment(m)}
                                                disabled={active}
                                                variant="ghost"
                                                size="sm"
                                                className={cn(
                                                    "h-9 px-3 rounded-xl text-[9px] font-black uppercase border tracking-widest",
                                                    active
                                                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 opacity-50 cursor-default"
                                                        : "bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-white/30 border-transparent hover:border-slate-200 dark:border-white/10 hover:text-slate-900 dark:hover:text-white"
                                                )}
                                            >
                                                {!active && <HiOutlinePlus className="w-3 h-3" />}
                                                {conf.label}
                                            </Button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="space-y-3">
                                {payments.filter(p => p.method !== 'credit').map((payment, idx) => {
                                    const conf = METHOD_CONFIG[payment.method];
                                    return (
                                        <div key={idx} className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-2xl p-4 space-y-4 relative group/item shadow-sm">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex min-w-0 items-center gap-3 text-slate-900 dark:text-white font-black text-[11px] uppercase tracking-widest sm:tracking-[0.2em] italic">
                                                    <div className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-blue-600 dark:text-blue-400">
                                                        {conf.icon}
                                                    </div>
                                                    {conf.label}
                                                </div>
                                                {payments.length > 1 && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => removePayment(idx)}
                                                        className="p-2 rounded-xl hover:bg-rose-500/20 text-slate-300 dark:text-white/20 hover:text-rose-500 active:scale-95"
                                                    >
                                                        <HiOutlineTrash className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>

                                            <div className="flex gap-4 items-center">
                                                <div className="relative flex-1">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-white/20 tracking-widest">MTN</span>
                                                    <Input
                                                        type="number"
                                                        value={payment.amount || ''}
                                                        onChange={e => updatePayment(idx, 'amount', Number(e.target.value))}
                                                        className="w-full pl-14 pr-4 py-3 text-right text-xl font-black rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-black/40 text-slate-900 dark:text-white focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </div>

                                            {/* Quick amounts for cash */}
                                            {payment.method === 'cash' && (
                                                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => updatePayment(idx, 'amount', cartTotal)}
                                                        className="px-4 py-2 bg-blue-600/10 border border-blue-500/20 rounded-xl text-[9px] font-black text-blue-400 hover:bg-blue-600 hover:text-white uppercase tracking-widest active:scale-95"
                                                    >
                                                        Valor Exato
                                                    </Button>
                                                    {QUICK_AMOUNTS.filter(a => a >= cartTotal - 1).slice(0, 4).map(a => (
                                                        <Button
                                                            key={a}
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setQuickAmount(idx, a)}
                                                            className="px-4 py-2 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl text-[9px] font-black text-slate-500 dark:text-white/30 hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-900 dark:hover:text-white uppercase tracking-widest active:scale-95"
                                                        >
                                                            {a.toLocaleString()}
                                                        </Button>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Reference input */}
                                            {(payment.method === 'mpesa' || payment.method === 'emola' || payment.method === 'card') && (
                                                <Input
                                                    type="text"
                                                    value={payment.reference || ''}
                                                    onChange={e => updatePayment(idx, 'reference', e.target.value)}
                                                    placeholder="Referência da transação..."
                                                    className="w-full px-4 py-2 text-[11px] rounded-xl border border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-black/20 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/20 focus:border-blue-500/30 transition-all font-medium uppercase tracking-wider shadow-sm"
                                                />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Change / Remaining */}
                    {!isCredit && (
                        <div className="px-4 sm:px-6 py-4 space-y-2">
                            {remaining > 0.01 && (
                                <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                                    <span className="text-xs font-black uppercase tracking-widest text-red-600">Em falta</span>
                                    <span className="text-lg font-black text-red-600">- {formatCurrency(remaining)}</span>
                                </div>
                            )}
                            {change > 0.01 && (
                                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                    <span className="text-xs font-black uppercase tracking-widest text-green-700 dark:text-green-400">Troco</span>
                                    <span className="text-2xl font-black text-green-700 dark:text-green-400">{formatCurrency(change)}</span>
                                </div>
                            )}
                            {Math.abs(totalPaid - cartTotal) < 0.01 && (
                                <div className="flex items-center justify-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                    <HiOutlineCheck className="w-4 h-4 text-blue-600 mr-2" />
                                    <span className="text-xs font-black uppercase tracking-widest text-blue-600">Valor exato</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Actions - Premium Modern Look */}
                <div className="px-4 sm:px-6 py-4 sm:py-6 bg-slate-50 dark:bg-[#0a0b0d] border-t border-slate-200 dark:border-white/5 flex flex-col gap-3 flex-shrink-0 sm:flex-row pb-[max(env(safe-area-inset-bottom),1rem)] sm:pb-6">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="flex-1 py-4 rounded-2xl border border-slate-200 dark:border-white/10 text-slate-400 dark:text-white/40 font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white active:scale-95 italic"
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!isFullyPaid}
                        isLoading={isLoading}
                        className={cn(
                            "flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all shadow-2xl h-14 italic",
                            isFullyPaid 
                                ? "bg-blue-600 text-white hover:bg-blue-500 shadow-blue-500/20 hover:-translate-y-1 active:scale-95" 
                                : "bg-slate-100 dark:bg-white/5 text-slate-300 dark:text-white/10 border border-slate-200 dark:border-white/5 cursor-not-allowed"
                        )}
                    >
                        <HiOutlineCheck className="w-5 h-5" />
                        {isCredit ? 'Confirmar Crédito' : 'Finalizar Venda'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
