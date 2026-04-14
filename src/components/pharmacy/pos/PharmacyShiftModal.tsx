import { useState } from 'react';
import { formatCurrency } from '../../../utils/helpers';
import { HiOutlineCheck, HiOutlineDocumentChartBar as HiOutlineDocumentReport } from 'react-icons/hi2';
import { HiOutlineXMark as HiOutlineX, HiOutlineBanknotes as HiOutlineCash, HiOutlineBuildingStorefront as HiOutlineHome } from 'react-icons/hi2';
import { useQuery } from '@tanstack/react-query';
import { warehousesAPI } from '../../../services/api';

export interface ShiftData {
    openedAt: Date;
    openingBalance: number;
    cashSales: number;
    mpesaSales: number;
    cardSales: number;
    creditSales: number;
    totalSales: number;
    saleCount: number;
    withdrawals: number;
    deposits: number;
}

interface PharmacyShiftModalProps {
    isOpen: boolean;
    mode: 'open' | 'close';
    shift: ShiftData | null;
    onOpenShift: (openingBalance: number, warehouseId?: string) => void;
    onCloseShift: (countedCash: number) => void;
    onClose: () => void;
}

export function PharmacyShiftModal({ isOpen, mode, shift, onOpenShift, onCloseShift, onClose }: PharmacyShiftModalProps) {
    const [amount, setAmount] = useState('');
    const [warehouseId, setWarehouseId] = useState('');

    const { data: warehouses = [] } = useQuery({
        queryKey: ['warehouses'],
        queryFn: async () => {
            const data = await warehousesAPI.getAll();
            return Array.isArray(data) ? data : (data?.data || []);
        },
        enabled: isOpen && mode === 'open',
    });

    if (!isOpen) return null;

    const expectedCash = shift ? Number(shift.openingBalance) + Number(shift.cashSales) + Number(shift.deposits) - Number(shift.withdrawals) : 0;
    const counted = Number(amount) || 0;
    const diff = counted - expectedCash;

    const handleConfirm = () => {
        if (mode === 'open') {
            onOpenShift(Number(amount) || 0, warehouseId || undefined);
        } else {
            onCloseShift(counted);
        }
        setAmount('');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 w-full max-w-md mx-4 bg-white dark:bg-dark-800 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className={`px-6 py-4 flex items-center justify-between ${mode === 'open' ? 'bg-teal-600' : 'bg-slate-700'}`}>
                    <div>
                        <h2 className="text-white font-black text-lg uppercase tracking-tight">
                            {mode === 'open' ? 'Abertura de Turno (Farmácia)' : 'Fecho de Turno (Farmácia)'}
                        </h2>
                        {shift && mode === 'close' && (
                            <p className="text-white/70 text-xs mt-0.5">
                                Aberto às {shift.openedAt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors">
                        <HiOutlineX className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Close shift: show sales report */}
                    {mode === 'close' && shift && (
                        <div className="bg-gray-50 dark:bg-dark-900 rounded-xl p-4 space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5 mb-3">
                                <HiOutlineDocumentReport className="w-3.5 h-3.5" />
                                Resumo do Turno
                            </p>
                            {[
                                { label: 'Vendas (Dinheiro)', value: shift.cashSales, color: 'text-teal-600' },
                                { label: 'Suprimentos (+)', value: shift.deposits, color: 'text-blue-600' },
                                { label: 'Sangrias (-)', value: shift.withdrawals, color: 'text-red-500' },
                                { label: 'Vendas (M-Pesa)', value: shift.mpesaSales, color: 'text-red-600' },
                                { label: 'Vendas (Cartão)', value: shift.cardSales, color: 'text-blue-600' },
                                { label: 'Vendas (Crédito)', value: shift.creditSales, color: 'text-amber-600' },
                            ].map(row => (
                                <div key={row.label} className="flex justify-between items-center text-xs">
                                    <span className="text-gray-500 font-medium">{row.label}</span>
                                    <span className={`font-black ${row.color}`}>{formatCurrency(row.value)}</span>
                                </div>
                            ))}
                            <div className="pt-2 border-t dark:border-dark-700 flex justify-between items-center">
                                <span className="text-sm font-black text-gray-700 dark:text-white uppercase tracking-wide">
                                    Total ({shift.saleCount} vendas)
                                </span>
                                <span className="text-lg font-black text-blue-600 dark:text-blue-400">{formatCurrency(shift.totalSales)}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs pt-1">
                                <span className="text-gray-400">Fundo inicial de caixa</span>
                                <span className="font-bold text-gray-500">{formatCurrency(shift.openingBalance)}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-400">Esperado físico em caixa</span>
                                <span className="font-black text-gray-700 dark:text-white">{formatCurrency(expectedCash)}</span>
                            </div>
                        </div>
                    )}

                    {/* Amount input */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-2 flex items-center gap-1.5">
                            <HiOutlineCash className="w-3.5 h-3.5" />
                            {mode === 'open' ? 'Fundo de Caixa Inicial (MTn)' : 'Contagem de Caixa (MTn)'}
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-400 text-sm">MTn</span>
                            <input
                                type="number"
                                min={0}
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); }}
                                placeholder="0.00"
                                autoFocus
                                className="w-full pl-14 pr-4 py-4 text-right text-3xl font-black rounded-xl border-2 border-gray-200 dark:border-dark-600 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none bg-white dark:bg-dark-900 text-gray-900 dark:text-white"
                            />
                        </div>

                        {/* Diff indicator */}
                        {mode === 'close' && counted > 0 && (
                            <div className={`mt-2 flex items-center justify-between px-3 py-2 rounded-lg text-xs font-black ${diff >= 0 ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600'}`}>
                                <span>{diff >= 0 ? 'Sobra' : 'Falta'}</span>
                                <span>{diff >= 0 ? '+' : ''}{formatCurrency(diff)}</span>
                            </div>
                        )}

                        {/* Quick amounts for opening */}
                        {mode === 'open' && (
                            <div className="flex gap-2 mt-2 flex-wrap">
                                {[1000, 2000, 5000, 10000].map(v => (
                                    <button
                                        key={v}
                                        onClick={() => setAmount(String(v))}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-black border-2 transition-all ${amount === String(v) ? 'bg-teal-600 text-white border-teal-600' : 'bg-gray-100 dark:bg-dark-700 text-gray-500 border-transparent hover:border-gray-300'}`}
                                    >
                                        {v.toLocaleString()}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Warehouse selection for opening */}
                    {mode === 'open' && warehouses.length > 0 && (
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-2 flex items-center gap-1.5">
                                <HiOutlineHome className="w-3.5 h-3.5" />
                                Armazém / Loja de Venda
                            </label>
                            <select
                                value={warehouseId}
                                onChange={e => setWarehouseId(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-dark-600 focus:border-teal-500 focus:outline-none bg-white dark:bg-dark-900 text-gray-900 dark:text-white text-sm font-bold"
                            >
                                <option value="">Seleccione o armazém...</option>
                                {warehouses.map((w: any) => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 rounded-xl border-2 border-gray-200 dark:border-dark-600 text-gray-600 dark:text-gray-400 font-black text-sm uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirm}
                            className={`flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 text-white shadow-lg transition-all ${mode === 'open' ? 'bg-teal-600 hover:bg-teal-700 shadow-teal-500/20' : 'bg-slate-700 hover:bg-slate-800 shadow-slate-500/20'}`}
                        >
                            <HiOutlineCheck className="w-5 h-5" />
                            {mode === 'open' ? 'Abrir Turno' : 'Fechar Turno'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
