import React, { useState } from 'react';
import { formatCurrency } from '../../../utils/helpers';
import { HiOutlineX, HiOutlineCheck, HiOutlineCash, HiOutlineLogin, HiOutlineLogout } from 'react-icons/hi';

interface CommercialCashMovementModalProps {
    isOpen: boolean;
    type: 'cash_in' | 'cash_out';
    onConfirm: (amount: number, reason: string) => void;
    onClose: () => void;
}

export function CommercialCashMovementModal({ isOpen, type, onConfirm, onClose }: CommercialCashMovementModalProps) {
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');

    if (!isOpen) return null;

    const handleConfirm = () => {
        const numAmount = Number(amount);
        if (isNaN(numAmount) || numAmount <= 0) return;
        if (!reason.trim()) return;
        onConfirm(numAmount, reason);
        setAmount('');
        setReason('');
    };

    const isCashIn = type === 'cash_in';

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 w-full max-w-md mx-4 bg-white dark:bg-dark-800 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className={`px-6 py-4 flex items-center justify-between ${isCashIn ? 'bg-indigo-600' : 'bg-orange-600'}`}>
                    <div className="flex items-center gap-3">
                        {isCashIn ? <HiOutlineLogin className="w-6 h-6 text-white" /> : <HiOutlineLogout className="w-6 h-6 text-white" />}
                        <h2 className="text-white font-black text-lg uppercase tracking-tight">
                            {isCashIn ? 'Suprimento (Entrada)' : 'Sangria (Saída)'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors">
                        <HiOutlineX className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Amount input */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-2 flex items-center gap-1.5">
                            <HiOutlineCash className="w-3.5 h-3.5" />
                            Valor da Operação (MTn)
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-400 text-sm">MTn</span>
                            <input
                                type="number"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                placeholder="0.00"
                                autoFocus
                                className="w-full pl-14 pr-4 py-4 text-right text-3xl font-black rounded-xl border-2 border-gray-200 dark:border-dark-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none bg-white dark:bg-dark-900 text-gray-900 dark:text-white"
                            />
                        </div>
                    </div>

                    {/* Reason input */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-2">
                            Justificação / Motivo
                        </label>
                        <textarea
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            rows={3}
                            placeholder={isCashIn ? "Ex: Fundo extra para trocos..." : "Ex: Pagamento de fornecedor secundário..."}
                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-dark-600 focus:border-blue-500 focus:outline-none bg-white dark:bg-dark-900 text-gray-900 dark:text-white text-sm"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 rounded-xl border-2 border-gray-200 dark:border-dark-600 text-gray-600 dark:text-gray-400 font-black text-sm uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={!amount || !reason.trim()}
                            className={`flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 text-white shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isCashIn ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20' : 'bg-orange-600 hover:bg-orange-700 shadow-orange-500/20'}`}
                        >
                            <HiOutlineCheck className="w-5 h-5" />
                            Confirmar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
