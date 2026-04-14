import { useState, useMemo } from 'react';
import {
    HiOutlineCheck,
    HiOutlineExclamation,
    HiOutlineCube,
    HiOutlineShieldCheck,
} from 'react-icons/hi';
import { Button, Modal, Card } from '../ui';
import { formatCurrency, cn } from '../../utils/helpers';
import type { Product } from '../../types';
import toast from 'react-hot-toast';

interface OrderItem {
    product: Product;
    quantity: number;
}

interface OrderCompletionModalProps {
    isOpen: boolean;
    onClose: () => void;
    orderNumber: string;
    items: OrderItem[];
    onComplete: (checkedItems: string[], notes: string) => void;
}

type CompletionStep = 'verification' | 'confirmation';

export default function OrderCompletionModal({
    isOpen,
    onClose,
    orderNumber,
    items,
    onComplete,
}: OrderCompletionModalProps) {
    const [step, setStep] = useState<CompletionStep>('verification');
    const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
    const [notes, setNotes] = useState('');

    const allItemsChecked = useMemo(() => {
        return items.every((item) => checkedItems.has(item.product.id));
    }, [items, checkedItems]);

    const toggleItem = (productId: string) => {
        const newChecked = new Set(checkedItems);
        if (newChecked.has(productId)) {
            newChecked.delete(productId);
        } else {
            newChecked.add(productId);
        }
        setCheckedItems(newChecked);
    };

    const handleCheckAll = () => {
        if (allItemsChecked) {
            setCheckedItems(new Set());
        } else {
            setCheckedItems(new Set(items.map((item) => item.product.id)));
        }
    };

    const handlePrepareFinalization = () => {
        if (!allItemsChecked) {
            toast.error('Verifique todos os itens antes de continuar');
            return;
        }
        setStep('confirmation');
    };

    const handleConfirmFinalization = () => {
        onComplete(Array.from(checkedItems), notes);
        toast.success('Encomenda finalizada com sucesso!');
        resetModal();
    };

    const resetModal = () => {
        setStep('verification');
        setCheckedItems(new Set());
        setNotes('');
        onClose();
    };

    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalValue = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

    return (
        <Modal
            isOpen={isOpen}
            onClose={resetModal}
            title={`Finalizar Encomenda #${orderNumber}`}
            size="lg"
        >
            {/* Step: Verification */}
            {step === 'verification' && (
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <HiOutlineCube className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900 dark:text-white">
                                    Verificação de Itens
                                </p>
                                <p className="text-sm text-gray-500">
                                    Marque cada item conforme for conferido
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleCheckAll}
                            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                        >
                            {allItemsChecked ? 'Desmarcar todos' : 'Marcar todos'}
                        </button>
                    </div>

                    {/* Items List */}
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {items.map((item) => {
                            const isChecked = checkedItems.has(item.product.id);
                            return (
                                <button
                                    key={item.product.id}
                                    onClick={() => toggleItem(item.product.id)}
                                    className={cn(
                                        'w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left',
                                        isChecked
                                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                            : 'border-gray-200 dark:border-dark-600 hover:border-gray-300'
                                    )}
                                >
                                    {/* Checkbox */}
                                    <div
                                        className={cn(
                                            'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
                                            isChecked
                                                ? 'bg-green-500 text-white'
                                                : 'bg-gray-100 dark:bg-dark-700'
                                        )}
                                    >
                                        {isChecked && <HiOutlineCheck className="w-5 h-5" />}
                                    </div>

                                    {/* Product Info */}
                                    <div className="flex-1">
                                        <p className={cn(
                                            'font-medium',
                                            isChecked
                                                ? 'text-green-700 dark:text-green-400'
                                                : 'text-gray-900 dark:text-white'
                                        )}>
                                            {item.product.name}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            Código: {item.product.code}
                                            {item.product.location && ` • Local: ${item.product.location}`}
                                        </p>
                                    </div>

                                    {/* Quantity */}
                                    <div className="text-right">
                                        <p className={cn(
                                            'text-2xl font-bold',
                                            isChecked ? 'text-green-600' : 'text-gray-900 dark:text-white'
                                        )}>
                                            {item.quantity}
                                        </p>
                                        <p className="text-xs text-gray-500">unidades</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Progress */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Progresso</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                                {checkedItems.size} de {items.length} itens verificados
                            </span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-green-500 rounded-full transition-all"
                                style={{ width: `${(checkedItems.size / items.length) * 100}%` }}
                            />
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            Observações Finais
                        </label>
                        <textarea
                            className="input min-h-[80px]"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Adicione observações sobre a separação..."
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-dark-700">
                        <Button variant="ghost" className="flex-1" onClick={resetModal}>
                            Cancelar
                        </Button>
                        <Button
                            className="flex-1"
                            onClick={handlePrepareFinalization}
                            disabled={!allItemsChecked}
                        >
                            Preparar Finalização
                        </Button>
                    </div>
                </div>
            )}

            {/* Step: Confirmation */}
            {step === 'confirmation' && (
                <div className="space-y-6">
                    {/* Info Banner */}
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                        <div className="flex items-start gap-3">
                            <HiOutlineExclamation className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold text-blue-800 dark:text-blue-400">
                                    Confirmação de Finalização
                                </p>
                                <p className="text-sm text-blue-700 dark:text-blue-500 mt-1">
                                    O estoque foi <strong>reservado</strong> no momento da criação da encomenda.
                                    A dedução efetiva do estoque ocorrerá apenas na facturação.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Summary */}
                    <Card padding="md">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                            Resumo da Encomenda
                        </h3>
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Número:</span>
                                <span className="font-bold text-gray-900 dark:text-white">
                                    #{orderNumber}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Total de itens:</span>
                                <span className="font-medium text-gray-900 dark:text-white">
                                    {items.length} produtos ({totalQuantity} unidades)
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Valor total:</span>
                                <span className="font-bold text-lg text-primary-600">
                                    {formatCurrency(totalValue)}
                                </span>
                            </div>
                            {notes && (
                                <div className="pt-3 border-t border-gray-200 dark:border-dark-700">
                                    <span className="text-gray-500 text-sm block mb-1">Observações:</span>
                                    <p className="text-gray-900 dark:text-white text-sm italic">
                                        "{notes}"
                                    </p>
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Stock Reservation Info */}
                    <Card padding="md">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                            Estoque Reservado
                        </h3>
                        <div className="space-y-2 max-h-[150px] overflow-y-auto">
                            {items.map((item) => (
                                <div
                                    key={item.product.id}
                                    className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-dark-700 last:border-0"
                                >
                                    <span className="text-sm text-gray-700 dark:text-gray-300">
                                        {item.product.name}
                                    </span>
                                    <span className="text-sm font-medium text-orange-600">
                                        {item.quantity} reservado(s)
                                    </span>
                                </div>
                            ))}
                        </div>
                    </Card>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-dark-700">
                        <Button variant="ghost" className="flex-1" onClick={() => setStep('verification')}>
                            Voltar
                        </Button>
                        <Button
                            className="flex-1 bg-green-600 hover:bg-green-700"
                            onClick={handleConfirmFinalization}
                        >
                            <HiOutlineShieldCheck className="w-5 h-5 mr-2" />
                            Confirmar Finalização
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}
