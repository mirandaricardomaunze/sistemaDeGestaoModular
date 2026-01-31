/**
 * PaymentConfirmModal.tsx
 * 
 * Modal for confirming salary payment with method selection and notes.
 * Integrates with the new generatePaymentConfirmation function.
 */

import { useState } from 'react';
import { HiOutlineX, HiOutlineCash, HiOutlineCreditCard, HiOutlineDocumentText, HiOutlineCheck } from 'react-icons/hi';
import { Button } from '../ui';
import { generatePaymentConfirmation } from '../../utils/documentGenerator';
import { useStore } from '../../stores/useStore';
import { formatCurrency } from '../../utils/helpers';
import type { PayrollRecord, Employee } from '../../types';
import toast from 'react-hot-toast';

interface PaymentConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    record: PayrollRecord & { employee: Employee };
    onConfirm: (paymentData: {
        method: 'bank_transfer' | 'cash' | 'check';
        notes?: string;
        generateReceipt: boolean;
    }) => Promise<void>;
}

const paymentMethods = [
    { id: 'bank_transfer' as const, label: 'Transferência Bancária', icon: HiOutlineCreditCard },
    { id: 'cash' as const, label: 'Dinheiro', icon: HiOutlineCash },
    { id: 'check' as const, label: 'Cheque', icon: HiOutlineDocumentText },
];

export default function PaymentConfirmModal({ isOpen, onClose, record, onConfirm }: PaymentConfirmModalProps) {
    const { companySettings } = useStore();
    const [selectedMethod, setSelectedMethod] = useState<'bank_transfer' | 'cash' | 'check'>('bank_transfer');
    const [notes, setNotes] = useState('');
    const [generateReceipt, setGenerateReceipt] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            await onConfirm({
                method: selectedMethod,
                notes: notes.trim() || undefined,
                generateReceipt
            });

            // Generate receipt PDF if requested
            if (generateReceipt) {
                generatePaymentConfirmation({
                    employee: {
                        name: record.employee.name,
                        code: record.employee.code,
                        role: record.employee.role,
                        department: record.employee.department,
                        nuit: record.employee.nuit,
                        socialSecurityNumber: record.employee.socialSecurityNumber,
                    },
                    payroll: {
                        month: record.month,
                        year: record.year,
                        baseSalary: record.baseSalary,
                        bonus: record.bonus,
                        allowances: record.allowances,
                        otAmount: record.otAmount,
                        inssDeduction: record.inssDeduction,
                        irtDeduction: record.irtDeduction,
                        advances: record.advances,
                        totalEarnings: record.totalEarnings,
                        totalDeductions: record.totalDeductions,
                        netSalary: record.netSalary,
                    },
                    payment: {
                        method: selectedMethod,
                        date: new Date(),
                        paidBy: 'Sistema',
                        notes: notes.trim() || undefined,
                    }
                }, companySettings);
                toast.success('Recibo de pagamento gerado!');
            }

            onClose();
        } catch (error) {
            console.error('Error confirming payment:', error);
            toast.error('Erro ao confirmar pagamento');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white dark:bg-dark-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/20 rounded-lg">
                                <HiOutlineCheck className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">Confirmar Pagamento</h2>
                                <p className="text-sm text-green-100">{record.employee.name}</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <HiOutlineX className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-5">
                    {/* Amount Summary */}
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
                        <p className="text-sm text-green-600 dark:text-green-400 font-medium">Valor a Pagar</p>
                        <p className="text-3xl font-bold text-green-700 dark:text-green-300">
                            {formatCurrency(record.netSalary)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {record.month}/{record.year}
                        </p>
                    </div>

                    {/* Payment Method Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Método de Pagamento
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {paymentMethods.map((method) => {
                                const Icon = method.icon;
                                return (
                                    <button
                                        key={method.id}
                                        type="button"
                                        onClick={() => setSelectedMethod(method.id)}
                                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${selectedMethod === method.id
                                                ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                                                : 'border-gray-200 dark:border-dark-600 hover:border-gray-300 dark:hover:border-dark-500 text-gray-600 dark:text-gray-400'
                                            }`}
                                    >
                                        <Icon className="w-6 h-6" />
                                        <span className="text-xs font-medium text-center">{method.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Observações (opcional)
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Ex: Pagamento referente ao mês de Janeiro..."
                            rows={2}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                        />
                    </div>

                    {/* Generate Receipt Option */}
                    <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-dark-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors">
                        <input
                            type="checkbox"
                            checked={generateReceipt}
                            onChange={(e) => setGenerateReceipt(e.target.checked)}
                            className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500"
                        />
                        <div className="flex-1">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Gerar Recibo de Pagamento
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Um PDF será gerado com os detalhes do pagamento
                            </p>
                        </div>
                        <HiOutlineDocumentText className="w-5 h-5 text-gray-400" />
                    </label>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 dark:bg-dark-700 border-t border-gray-200 dark:border-dark-600 flex justify-end gap-3">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="bg-green-600 hover:bg-green-700 text-white"
                    >
                        {isSubmitting ? (
                            <span className="flex items-center gap-2">
                                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Processando...
                            </span>
                        ) : (
                            <span className="flex items-center gap-2">
                                <HiOutlineCheck className="w-4 h-4" />
                                Confirmar Pagamento
                            </span>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
