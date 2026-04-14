import React, { useState, useMemo, useEffect } from 'react';
import {
    HiOutlineCash, HiOutlineCheck, HiOutlineX, HiOutlinePlus,
    HiOutlineTrash
} from 'react-icons/hi';
import { formatCurrency } from '../../../utils/helpers';

// ─── Icons ───────────────────────────────────────────────────────────────────
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

// ─── Types ───────────────────────────────────────────────────────────────────
export type PaymentMethodType = 'cash' | 'mpesa' | 'card' | 'credit';

export interface PaymentEntry {
    method: PaymentMethodType;
    amount: number;
    reference?: string;
}

interface CommercialPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (payments: PaymentEntry[], isCredit: boolean, creditDueDays: number) => void;
    cartTotal: number;
    cartSubtotal: number;
    cartDiscount: number;
    cartTax: number;
    customerName: string;
    selectedCustomer: any;
}

const METHOD_CONFIG: Record<PaymentMethodType, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
    cash: {
        label: 'Dinheiro', color: 'text-green-700 dark:text-green-400',
        bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-500',
        icon: <HiOutlineCash className="w-5 h-5" />
    },
    mpesa: {
        label: 'M-Pesa', color: 'text-red-700 dark:text-red-400',
        bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-500',
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

// ─── Component ───────────────────────────────────────────────────────────────
export function CommercialPaymentModal({
    isOpen, onClose, onConfirm,
    cartTotal, cartSubtotal, cartDiscount, cartTax,
    customerName, selectedCustomer
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

    const updatePayment = (idx: number, field: keyof PaymentEntry, value: any) => {
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

    const handleConfirm = () => {
        if (!isFullyPaid) return;
        onConfirm(payments, isCredit, creditDueDays);
    };

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
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative z-10 w-full max-w-xl mx-4 bg-white dark:bg-dark-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-blue-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
                    <div>
                        <h2 className="text-white font-black text-lg uppercase tracking-tight">Pagamento</h2>
                        <p className="text-blue-200 text-xs mt-0.5">
                            {selectedCustomer?.name || customerName || 'Consumidor Geral'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors">
                        <HiOutlineX className="w-5 h-5" />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1">
                    {/* Summary */}
                    <div className="px-6 py-4 bg-gray-50 dark:bg-dark-900/50 border-b dark:border-dark-700">
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <p className="text-[10px] uppercase font-black text-gray-400 tracking-widest mb-1">Subtotal</p>
                                <p className="font-bold text-gray-700 dark:text-gray-300 text-sm">{formatCurrency(cartSubtotal)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-black text-gray-400 tracking-widest mb-1">IVA (16%)</p>
                                <p className="font-bold text-gray-700 dark:text-gray-300 text-sm">{formatCurrency(cartTax)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-black text-gray-400 tracking-widest mb-1">Desconto</p>
                                <p className="font-bold text-red-500 text-sm">− {formatCurrency(cartDiscount)}</p>
                            </div>
                        </div>
                        <div className="mt-3 pt-3 border-t dark:border-dark-700 flex items-center justify-between">
                            <span className="text-sm font-black uppercase tracking-widest text-gray-500">Total a Pagar</span>
                            <span className="text-3xl font-black text-blue-600 dark:text-blue-400">{formatCurrency(cartTotal)}</span>
                        </div>
                    </div>

                    {/* Credit toggle */}
                    <div className="px-6 pt-4">
                        <button
                            onClick={handleCredit}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${isCredit
                                ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                                : 'border-gray-100 dark:border-dark-700 bg-gray-50 dark:bg-dark-900 text-gray-500 hover:border-amber-300'}`}
                        >
                            <div className="flex items-center gap-2">
                                <DocumentIcon className="w-4 h-4" />
                                <span className="text-xs font-black uppercase tracking-widest">Venda a Crédito / Fiado</span>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isCredit ? 'bg-amber-500 border-amber-500' : 'border-gray-300'}`}>
                                {isCredit && <HiOutlineCheck className="w-3 h-3 text-white" />}
                            </div>
                        </button>

                        {isCredit && (
                            <div className="mt-2 flex items-center gap-3 px-1">
                                <p className="text-xs text-gray-500 font-medium whitespace-nowrap">Vence em</p>
                                <div className="flex gap-2">
                                    {[15, 30, 45, 60].map(d => (
                                        <button
                                            key={d}
                                            onClick={() => setCreditDueDays(d)}
                                            className={`px-3 py-1 rounded-lg text-xs font-black border transition-all ${creditDueDays === d
                                                ? 'bg-amber-500 text-white border-amber-500'
                                                : 'bg-gray-100 dark:bg-dark-700 text-gray-500 border-transparent'}`}
                                        >
                                            {d}d
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Payment lines */}
                    {!isCredit && (
                        <div className="px-6 pt-4 space-y-3">
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Métodos de Pagamento</p>
                                <div className="flex gap-1">
                                    {(['cash', 'mpesa', 'card'] as PaymentMethodType[]).map(m => {
                                        const conf = METHOD_CONFIG[m];
                                        const active = payments.some(p => p.method === m);
                                        return (
                                            <button
                                                key={m}
                                                onClick={() => addPayment(m)}
                                                disabled={active}
                                                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase border transition-all ${active
                                                    ? `${conf.bg} ${conf.color} ${conf.border} border opacity-60`
                                                    : 'bg-gray-100 dark:bg-dark-700 text-gray-400 border-transparent hover:border-gray-300'}`}
                                            >
                                                {!active && <HiOutlinePlus className="w-3 h-3" />}
                                                {conf.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {payments.filter(p => p.method !== 'credit').map((payment, idx) => {
                                const conf = METHOD_CONFIG[payment.method];
                                return (
                                    <div key={idx} className={`p-3 rounded-xl border-2 ${conf.border} ${conf.bg} space-y-2`}>
                                        <div className="flex items-center justify-between">
                                            <div className={`flex items-center gap-2 ${conf.color} font-black text-xs uppercase tracking-wider`}>
                                                {conf.icon}
                                                {conf.label}
                                            </div>
                                            {payments.length > 1 && (
                                                <button onClick={() => removePayment(idx)} className="text-gray-400 hover:text-red-500 transition-colors">
                                                    <HiOutlineTrash className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex gap-2 items-center">
                                            <div className="relative flex-1">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400">MTn</span>
                                                <input
                                                    type="number"
                                                    value={payment.amount || ''}
                                                    onChange={e => updatePayment(idx, 'amount', Number(e.target.value))}
                                                    className="w-full pl-11 pr-3 py-2 text-right text-lg font-black rounded-lg border dark:border-dark-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>

                                        {/* Quick amounts for cash */}
                                        {payment.method === 'cash' && (
                                            <div className="flex flex-wrap gap-1.5">
                                                <button
                                                    onClick={() => updatePayment(idx, 'amount', cartTotal)}
                                                    className="px-2 py-0.5 bg-white dark:bg-dark-700 border dark:border-dark-600 rounded text-[10px] font-black text-green-600 hover:bg-green-50 transition-colors"
                                                >
                                                    Exato
                                                </button>
                                                {QUICK_AMOUNTS.filter(a => a >= cartTotal - 1).slice(0, 5).map(a => (
                                                    <button
                                                        key={a}
                                                        onClick={() => setQuickAmount(idx, a)}
                                                        className="px-2 py-0.5 bg-white dark:bg-dark-700 border dark:border-dark-600 rounded text-[10px] font-black text-gray-600 hover:bg-gray-50 transition-colors"
                                                    >
                                                        {a.toLocaleString()}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Reference for M-Pesa / Card */}
                                        {(payment.method === 'mpesa' || payment.method === 'card') && (
                                            <input
                                                type="text"
                                                value={payment.reference || ''}
                                                onChange={e => updatePayment(idx, 'reference', e.target.value)}
                                                placeholder={payment.method === 'mpesa' ? 'Referência M-Pesa (ex: BC12345)...' : 'Nº aprovação cartão...'}
                                                className="w-full px-3 py-1.5 text-xs rounded-lg border dark:border-dark-600 bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-300 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Change / Remaining */}
                    {!isCredit && (
                        <div className="px-6 py-4 space-y-2">
                            {remaining > 0.01 && (
                                <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                                    <span className="text-xs font-black uppercase tracking-widest text-red-600">Em falta</span>
                                    <span className="text-lg font-black text-red-600">− {formatCurrency(remaining)}</span>
                                </div>
                            )}
                            {change > 0.01 && (
                                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                                    <span className="text-xs font-black uppercase tracking-widest text-green-700 dark:text-green-400">Troco</span>
                                    <span className="text-2xl font-black text-green-700 dark:text-green-400">{formatCurrency(change)}</span>
                                </div>
                            )}
                            {Math.abs(totalPaid - cartTotal) < 0.01 && (
                                <div className="flex items-center justify-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                                    <HiOutlineCheck className="w-4 h-4 text-blue-600 mr-2" />
                                    <span className="text-xs font-black uppercase tracking-widest text-blue-600">Valor exato</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t dark:border-dark-700 flex gap-3 flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl border-2 border-gray-200 dark:border-dark-600 text-gray-600 dark:text-gray-400 font-black text-sm uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!isFullyPaid}
                        className={`flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg ${isFullyPaid
                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
                            : 'bg-gray-100 dark:bg-dark-700 text-gray-400 cursor-not-allowed shadow-none'}`}
                    >
                        <HiOutlineCheck className="w-5 h-5" />
                        {isCredit ? 'Confirmar Crédito' : 'Confirmar Pagamento'}
                    </button>
                </div>
            </div>
        </div>
    );
}
