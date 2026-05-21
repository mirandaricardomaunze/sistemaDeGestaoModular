import { useState } from 'react';
import { formatCurrency, cn } from '../../../utils/helpers';
import { HiOutlineXMark, HiOutlineCheck, HiOutlineBanknotes, HiOutlineDocumentChartBar, HiOutlineHome } from 'react-icons/hi2';
import { Button } from '../../../components/ui/Button';
import { useQuery } from '@tanstack/react-query';
import { warehousesAPI } from '../../../services/api';

export interface ShiftData {
    openedAt: Date;
    openingBalance: number;
    cashSales: number;
    mpesaSales: number;
    emolaSales: number;
    cardSales: number;
    creditSales: number;
    totalSales: number;
    saleCount: number;
    withdrawals: number;
    deposits: number;
}

interface CommercialShiftModalProps {
    isOpen: boolean;
    mode: 'open' | 'close';
    shift: ShiftData | null;
    onOpenShift: (openingBalance: number, warehouseId?: string) => void;
    onCloseShift: (countedCash: number, notes?: string) => void;
    onClose: () => void;
    isLoading?: boolean;
}

interface ShiftWarehouse {
    id: string;
    name: string;
}

type WarehousesResponse = ShiftWarehouse[] | {
    data?: ShiftWarehouse[];
};

const getWarehouseRows = (response: WarehousesResponse): ShiftWarehouse[] => (
    Array.isArray(response) ? response : response.data ?? []
);

export function CommercialShiftModal({ isOpen, mode, shift, onOpenShift, onCloseShift, onClose, isLoading = false }: CommercialShiftModalProps) {
    const [amount, setAmount] = useState('');
    const [warehouseId, setWarehouseId] = useState('');
    const [notes, setNotes] = useState('');

    const { data: warehouses = [] } = useQuery<ShiftWarehouse[]>({
        queryKey: ['warehouses'],
        queryFn: async () => {
            const data = await warehousesAPI.getAll() as WarehousesResponse;
            return getWarehouseRows(data);
        },
        enabled: isOpen && mode === 'open',
    });

    if (!isOpen) return null;

    const expectedCash = shift ? Number(shift.openingBalance) + Number(shift.cashSales) + Number(shift.deposits) - Number(shift.withdrawals) : 0;
    const counted = Number(amount) || 0;
    const diff = counted - expectedCash;
    const hasAmount = amount.trim() !== '' && !isNaN(Number(amount));
    const needsNotes = mode === 'close' && hasAmount && Math.abs(diff) >= 0.01;
    const canConfirm = mode === 'open'
        ? hasAmount && Number(amount) >= 0
        : hasAmount && counted >= 0 && (!needsNotes || notes.trim().length >= 5);

    const handleConfirm = () => {
        if (isLoading) return;
        if (mode === 'open') {
            const balance = Number(amount);
            if (isNaN(balance) || balance < 0) return;
            onOpenShift(balance, warehouseId || undefined);
        } else {
            if (!canConfirm) return;
            onCloseShift(counted, notes.trim() || undefined);
        }
        setAmount('');
        setNotes('');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 w-full max-w-xl mx-4 bg-white dark:bg-[#111214] border border-slate-200 dark:border-white/5 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header - Premium Style */}
                <div className={cn(
                    "px-6 py-5 flex items-center justify-between relative overflow-hidden",
                    mode === 'open' ? 'bg-gradient-to-r from-emerald-600 to-emerald-700' : 'bg-gradient-to-r from-slate-600 to-slate-700'
                )}>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16" />
                    <div className="relative z-10">
                        <h2 className="text-white font-black text-xl uppercase tracking-tighter italic">
                            {mode === 'open' ? 'ABERTURA DE TURNO' : 'FECHO DE TURNO'}
                        </h2>
                        {shift && mode === 'close' && (
                            <p className="text-white/60 text-[10px] font-bold uppercase tracking-[0.2em] mt-1 italic">
                                Aberto às {shift.openedAt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        )}
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

                <div className="p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
                    {/* Close shift: show sales report - High Contrast */}
                    {mode === 'close' && shift && (
                        <div className="bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-2xl p-5 space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-white/20 flex items-center gap-2 mb-4 italic">
                                <HiOutlineDocumentChartBar className="w-4 h-4 text-blue-500" />
                                Resumo do Turno
                            </p>
                            {[
                                { label: 'Vendas (Dinheiro)', value: shift.cashSales, color: 'text-emerald-400' },
                                { label: 'Suprimentos (+)', value: shift.deposits, color: 'text-blue-400' },
                                { label: 'Sangrias (-)', value: shift.withdrawals, color: 'text-rose-500' },
                                { label: 'Vendas (M-Pesa)', value: shift.mpesaSales, color: 'text-rose-400' },
                                { label: 'Vendas (e-Mola)', value: shift.emolaSales, color: 'text-cyan-400' },
                                { label: 'Vendas (Cartão)', value: shift.cardSales, color: 'text-blue-400' },
                                { label: 'Vendas (Crédito)', value: shift.creditSales, color: 'text-amber-500' },
                            ].map(row => (
                                <div key={row.label} className="flex justify-between items-center text-[11px]">
                                    <span className="text-slate-500 dark:text-white/40 font-bold uppercase tracking-wider">{row.label}</span>
                                    <span className={`font-black tracking-tight ${row.color}`}>{formatCurrency(row.value)}</span>
                                </div>
                            ))}
                            <div className="pt-4 mt-2 border-t border-white/5 flex justify-between items-center">
                                <span className="text-xs font-black text-white/30 uppercase tracking-[0.2em] italic">
                                    Total ({shift.saleCount} vendas)
                                </span>
                                <span className="text-2xl font-black text-blue-400 italic tracking-tighter drop-shadow-[0_0_10px_rgba(96,165,250,0.3)]">
                                    {formatCurrency(shift.totalSales)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] pt-2 border-t border-white/5">
                                <span className="text-slate-400 dark:text-white/20 uppercase font-black tracking-widest italic">Esperado em caixa</span>
                                <span className="font-black text-slate-900 dark:text-white tracking-tight">{formatCurrency(expectedCash)}</span>
                            </div>
                        </div>
                    )}

                    {/* Amount input - Tech Style */}
                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 block flex items-center gap-2 italic">
                            <HiOutlineBanknotes className="w-4 h-4 text-blue-500" />
                            {mode === 'open' ? 'Fundo de Caixa Inicial' : 'Contagem de Caixa'}
                        </label>
                        <div className="relative">
                            <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-slate-300 dark:text-white/20 text-xs tracking-widest">MTN</span>
                            <input
                                type="number"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); }}
                                placeholder="0.00"
                                autoFocus
                                className="w-full pl-16 pr-6 py-5 text-right text-4xl font-black rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-black/40 text-slate-900 dark:text-white focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all tracking-tighter shadow-sm"
                            />
                        </div>

                        {/* Diff indicator */}
                        {mode === 'close' && hasAmount && (
                            <div className={cn(
                                "flex items-center justify-between px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                                Math.abs(diff) < 0.01
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                    : diff >= 0 
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                    : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                            )}>
                                <span>{Math.abs(diff) < 0.01 ? 'CAIXA CONFERIDO' : diff >= 0 ? 'SOBRA EM CAIXA' : 'FALTA EM CAIXA'}</span>
                                <span className="text-sm">{diff >= 0 ? '+' : ''}{formatCurrency(diff)}</span>
                            </div>
                        )}

                        {mode === 'close' && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-white/20 block italic">
                                    Observacoes do fecho {needsNotes ? <span className="text-rose-500">Obrigatorio</span> : null}
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder={needsNotes ? 'Informe o motivo da diferenca...' : 'Sem observacoes'}
                                    className="w-full min-h-24 px-4 py-3 rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-black/40 text-sm text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-white/20 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all resize-none"
                                />
                                {needsNotes && notes.trim().length < 5 && (
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500">
                                        Registe uma justificacao para concluir o fecho.
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Quick amounts for opening */}
                        {mode === 'open' && (
                            <div className="flex gap-2 flex-wrap">
                                {[1000, 2000, 5000, 10000].map(v => (
                                    <Button
                                        key={v}
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setAmount(String(v))}
                                        className={cn(
                                            "px-4 py-2 rounded-xl text-[10px] font-black border transition-all uppercase tracking-widest",
                                            amount === String(v)
                                                ? "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-600/20"
                                                : "bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-white/30 border-transparent hover:border-slate-200 dark:hover:border-white/10 hover:text-slate-900 dark:hover:text-white"
                                        )}
                                    >
                                        {v.toLocaleString()}
                                    </Button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Warehouse selection - Modern Select */}
                    {mode === 'open' && warehouses.length > 0 && (
                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 block flex items-center gap-2 italic">
                                <HiOutlineHome className="w-4 h-4 text-blue-500" />
                                Armazém de Venda
                            </label>
                            <select
                                value={warehouseId}
                                onChange={e => setWarehouseId(e.target.value)}
                                className="w-full px-5 py-4 rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-black/40 text-slate-900 dark:text-white focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all text-xs font-black uppercase tracking-widest cursor-pointer appearance-none shadow-sm"
                            >
                                <option value="" className="bg-[#111214]">Seleccione o armazém...</option>
                                {warehouses.map((w) => (
                                    <option key={w.id} value={w.id} className="bg-[#111214]">{w.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Actions - Premium Buttons */}
                    <div className="flex gap-4 pt-4">
                        <Button
                            variant="ghost"
                            onClick={onClose}
                            className="flex-1 py-4 rounded-2xl border border-white/10 text-white/40 font-black text-xs uppercase tracking-[0.2em] hover:bg-white/5 hover:text-white active:scale-95 italic"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            disabled={isLoading || !canConfirm}
                            isLoading={isLoading}
                            className={cn(
                                "flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all shadow-2xl h-14 italic",
                                !canConfirm
                                    ? "bg-slate-100 dark:bg-white/5 text-slate-300 dark:text-white/10 border border-slate-200 dark:border-white/5 cursor-not-allowed"
                                    : mode === 'open'
                                        ? "bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-500/20 hover:-translate-y-1 active:scale-95"
                                        : "bg-slate-700 text-white hover:bg-slate-600 shadow-slate-500/20 hover:-translate-y-1 active:scale-95"
                            )}
                        >
                            <HiOutlineCheck className="w-5 h-5" />
                            {mode === 'open' ? 'ABRIR TURNO' : 'FECHAR TURNO'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
