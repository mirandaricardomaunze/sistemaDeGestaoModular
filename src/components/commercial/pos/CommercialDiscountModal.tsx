import { useState, useEffect, useMemo, useCallback } from 'react';
import { HiOutlineXMark, HiOutlineCheck, HiOutlineExclamationTriangle } from 'react-icons/hi2';
import { formatCurrency, cn } from '../../../utils/helpers';
import { useAuthStore } from '../../../stores/useAuthStore';
import { Button } from '../../ui/Button';

export type DiscountKind = 'percent' | 'amount';

export interface DiscountInfo {
    kind: DiscountKind;
    value: number;
    reason: string;
    appliedBy: string;
}

interface CommercialDiscountModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (discount: DiscountInfo | null) => void;
    scope: 'line' | 'global';
    productName?: string;
    baseAmount: number;
    currentDiscount?: DiscountInfo | null;
}

const REASONS = [
    'Cliente fiel',
    'Negociação comercial',
    'Produto avariado/danificado',
    'Promoção interna',
    'Erro de etiquetagem',
    'Compra em volume',
    'Outro',
];

const ROLE_LIMITS: Record<string, number> = {
    super_admin: 100,
    admin: 100,
    manager: 100,
    operator: 10,
    cashier: 10,
    stock_keeper: 5,
};

export function CommercialDiscountModal({
    isOpen, onClose, onConfirm,
    scope, productName, baseAmount, currentDiscount = null,
}: CommercialDiscountModalProps) {
    const { user } = useAuthStore();
    const role = (user?.role as string) || 'operator';
    const maxPct = ROLE_LIMITS[role] ?? 10;

    const [kind, setKind] = useState<DiscountKind>(currentDiscount?.kind || 'percent');
    const [value, setValue] = useState<string>(currentDiscount ? String(currentDiscount.value) : '');
    const [reason, setReason] = useState<string>(currentDiscount?.reason || '');
    const [customReason, setCustomReason] = useState<string>('');

    useEffect(() => {
        if (isOpen) {
            setKind(currentDiscount?.kind || 'percent');
            setValue(currentDiscount ? String(currentDiscount.value) : '');
            const r = currentDiscount?.reason || '';
            if (r && !REASONS.includes(r)) {
                setReason('Outro');
                setCustomReason(r);
            } else {
                setReason(r);
                setCustomReason('');
            }
        }
    }, [isOpen, currentDiscount]);

    const numericValue = Number(value) || 0;
    const effectivePct = useMemo(() => {
        if (baseAmount <= 0) return 0;
        return kind === 'percent' ? numericValue : (numericValue / baseAmount) * 100;
    }, [kind, numericValue, baseAmount]);

    const discountAmount = useMemo(() => {
        return kind === 'percent' ? (baseAmount * numericValue / 100) : numericValue;
    }, [kind, numericValue, baseAmount]);

    const exceedsLimit = effectivePct > maxPct + 0.001;
    const exceedsBase = discountAmount > baseAmount + 0.001;
    const finalReason = reason === 'Outro' ? customReason.trim() : reason;
    const valid = numericValue > 0 && !exceedsLimit && !exceedsBase && finalReason.length > 0;

    const handleConfirm = useCallback(() => {
        if (!valid) return;
        onConfirm({
            kind,
            value: numericValue,
            reason: finalReason,
            appliedBy: user?.name || user?.email || 'desconhecido',
        });
    }, [finalReason, kind, numericValue, onConfirm, user?.email, user?.name, valid]);

    const handleRemove = () => onConfirm(null);

    useEffect(() => {
        if (!isOpen) return;
        const h = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter' && valid) handleConfirm();
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [handleConfirm, isOpen, onClose, valid]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 w-full max-w-md mx-4 bg-[#111214] border border-white/5 rounded-2xl shadow-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-rose-600 to-rose-700 px-6 py-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-white font-bold text-lg uppercase tracking-tight">
                            {scope === 'line' ? 'Desconto em Item' : 'Desconto Global'}
                        </h2>
                        <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                            {productName || `Subtotal: ${formatCurrency(baseAmount)}`}
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        className="p-2 text-white hover:bg-white/10 active:scale-95"
                    >
                        <HiOutlineXMark className="w-5 h-5" />
                    </Button>
                </div>

                <div className="p-6 space-y-5">
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => setKind('percent')}
                            className={cn(
                                'flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all',
                                kind === 'percent'
                                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/50'
                                    : 'bg-white/5 text-white/40 border-white/5 hover:text-white'
                            )}
                        >
                            Percentagem (%)
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => setKind('amount')}
                            className={cn(
                                'flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all',
                                kind === 'amount'
                                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/50'
                                    : 'bg-white/5 text-white/40 border-white/5 hover:text-white'
                            )}
                        >
                            Valor (MTn)
                        </Button>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 block mb-2">
                            {kind === 'percent' ? 'Percentagem de desconto' : 'Valor do desconto'}
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                value={value}
                                onChange={e => setValue(e.target.value)}
                                min="0"
                                max={kind === 'percent' ? '100' : String(baseAmount)}
                                step="0.01"
                                autoFocus
                                placeholder="0"
                                className="w-full px-4 py-3 pr-16 text-2xl font-bold rounded-xl border border-white/10 bg-black/40 text-white focus:border-rose-500/50 focus:ring-4 focus:ring-rose-500/10"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-white/30">
                                {kind === 'percent' ? '%' : 'MTn'}
                            </span>
                        </div>

                        {kind === 'percent' && (
                            <div className="flex gap-2 mt-2">
                                {[5, 10, 15, 20].filter(p => p <= maxPct).map(p => (
                                    <Button
                                        key={p}
                                        variant="ghost"
                                        onClick={() => setValue(String(p))}
                                        className="flex-1 py-1.5 rounded-lg text-[11px] font-bold bg-white/5 hover:bg-rose-500/20 text-white/40 hover:text-rose-400 active:scale-95"
                                    >
                                        {p}%
                                    </Button>
                                ))}
                            </div>
                        )}

                        {numericValue > 0 && (
                            <div className="mt-3 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                                    Desconto aplicado
                                </span>
                                <span className="font-bold text-rose-400">
                                    -{formatCurrency(discountAmount)} ({effectivePct.toFixed(1)}%)
                                </span>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 block mb-2">
                            Motivo (obrigatório)
                        </label>
                        <select
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:border-rose-500/50 focus:ring-4 focus:ring-rose-500/10"
                        >
                            <option value="">— Selecione —</option>
                            {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        {reason === 'Outro' && (
                            <input
                                type="text"
                                value={customReason}
                                onChange={e => setCustomReason(e.target.value)}
                                placeholder="Especifique o motivo..."
                                maxLength={120}
                                className="w-full mt-2 px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:border-rose-500/50"
                            />
                        )}
                    </div>

                    {(exceedsLimit || exceedsBase) && (
                        <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                            <HiOutlineExclamationTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                            <div className="text-[11px] text-amber-300 font-medium leading-relaxed">
                                {exceedsBase ? (
                                    <>O desconto não pode exceder o valor base ({formatCurrency(baseAmount)}).</>
                                ) : (
                                    <>O seu perfil ({role}) permite no máximo <strong>{maxPct}%</strong> de desconto. Solicite a um gerente para aplicar mais.</>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="text-[10px] text-white/30 font-medium">
                        Aplicado por: <span className="text-white/60 font-bold">{user?.name || user?.email}</span>
                        {' · '}
                        Limite do perfil: <span className="text-white/60 font-bold">{maxPct}%</span>
                    </div>
                </div>

                <div className="px-6 py-4 bg-[#0a0b0d] border-t border-white/5 flex gap-3">
                    {currentDiscount && (
                        <Button
                            variant="ghost"
                            onClick={handleRemove}
                            className="px-4 py-3 rounded-xl border border-rose-500/30 text-rose-400 font-bold text-xs uppercase tracking-wider hover:bg-rose-500/10 active:scale-95"
                        >
                            Remover
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl border border-white/10 text-white/40 font-bold text-xs uppercase tracking-wider hover:bg-white/5 active:scale-95"
                    >
                        Cancelar
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={handleConfirm}
                        disabled={!valid}
                        className={cn(
                            'flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all',
                            valid
                                ? 'bg-rose-600 text-white hover:bg-rose-500 shadow-lg shadow-rose-500/20 active:scale-95'
                                : 'bg-white/5 text-white/20 cursor-not-allowed'
                        )}
                    >
                        <HiOutlineCheck className="w-4 h-4" />
                        Aplicar
                    </Button>
                </div>
            </div>
        </div>
    );
}
