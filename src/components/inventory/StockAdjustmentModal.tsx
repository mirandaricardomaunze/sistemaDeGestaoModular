import { useState, useEffect } from 'react';
import { HiOutlinePlus, HiOutlineMinus, HiOutlineViewList, HiOutlineCheck } from 'react-icons/hi';
import { Modal, Button, Input, Select, Textarea } from '../ui';
import { useWarehouses, useProducts } from '../../hooks/useData';
import type { Product } from '../../types';
import toast from 'react-hot-toast';
import { cn } from '../../utils/helpers';

interface StockAdjustmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product | null;
    onSuccess?: () => void;
}

type Operation = 'add' | 'subtract' | 'set';

export default function StockAdjustmentModal({ isOpen, onClose, product, onSuccess }: StockAdjustmentModalProps) {
    const { warehouses } = useWarehouses();
    const { updateStock } = useProducts();
    const [operation, setOperation] = useState<Operation>('add');
    const [quantity, setQuantity] = useState<number>(0);
    const [warehouseId, setWarehouseId] = useState<string>('');
    const [reason, setReason] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset form when modal opens or product changes
    useEffect(() => {
        if (isOpen && product) {
            setOperation('add');
            setQuantity(0);
            setReason('');
            // Set default warehouse if available
            if (warehouses.length > 0) {
                setWarehouseId(warehouses[0].id);
            }
        }
    }, [isOpen, product, warehouses]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!product) return;

        if (quantity <= 0 && operation !== 'set') {
            toast.error('A quantidade deve ser maior que zero');
            return;
        }

        setIsSubmitting(true);
        try {
            await updateStock(product.id, quantity, operation, warehouseId || undefined);
            toast.success('Stock atualizado com sucesso!');
            onSuccess?.();
            onClose();
        } catch (error) {
            console.error('Error updating stock:', error);
            // Error toast is handled by the hook/api
        } finally {
            setIsSubmitting(false);
        }
    };

    const operationOptions = [
        { id: 'add' as const, label: 'Entrada (+)', icon: <HiOutlinePlus />, color: 'text-green-600 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' },
        { id: 'subtract' as const, label: 'Saída (-)', icon: <HiOutlineMinus />, color: 'text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' },
        { id: 'set' as const, label: 'Definir (=)', icon: <HiOutlineViewList />, color: 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' },
    ];

    if (!product) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Ajuste de Stock Profissional"
            size="md"
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Product Info Summary */}
                <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-xl border border-gray-100 dark:border-dark-600">
                    <div className="flex justify-between items-start">
                        <div>
                            <h4 className="font-bold text-gray-900 dark:text-white">{product.name}</h4>
                            <p className="text-xs text-gray-500 font-mono mt-1">{product.code}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-gray-500 uppercase font-semibold">Stock Atual</p>
                            <p className="text-lg font-bold text-primary-600">{product.currentStock} {product.unit}</p>
                        </div>
                    </div>
                </div>

                {/* Operation Selector */}
                <div className="grid grid-cols-3 gap-3">
                    {operationOptions.map((op) => (
                        <button
                            key={op.id}
                            type="button"
                            onClick={() => setOperation(op.id)}
                            className={cn(
                                "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all",
                                operation === op.id
                                    ? op.color + " ring-2 ring-offset-2 ring-primary-500 dark:ring-offset-dark-800"
                                    : "border-gray-200 dark:border-dark-700 text-gray-500 hover:border-gray-300 dark:hover:border-dark-600"
                            )}
                        >
                            <span className="text-xl mb-1">{op.icon}</span>
                            <span className="text-xs font-bold uppercase tracking-wider">{op.label.split(' ')[0]}</span>
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                        label="Quantidade"
                        type="number"
                        min="0"
                        step="0.01"
                        value={quantity || ''}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        required
                        placeholder="0.00"
                        autoFocus
                    />
                    <Select
                        label="Armazém"
                        options={warehouses.map(w => ({ value: w.id, label: w.name }))}
                        value={warehouseId}
                        onChange={(e) => setWarehouseId(e.target.value)}
                        required
                    />
                </div>

                <Textarea
                    label="Motivo do Ajuste (Obrigatório)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                    placeholder="Ex: Compra de mercadoria, Quebra detectada, Inventário periódico..."
                    rows={3}
                />

                {/* Result Preview */}
                <div className="p-3 bg-gray-50 dark:bg-dark-900/50 rounded-lg flex justify-between items-center text-sm">
                    <span className="text-gray-500">Novo saldo previsto:</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                        {operation === 'add' ? product.currentStock + quantity :
                            operation === 'subtract' ? Math.max(0, product.currentStock - quantity) :
                                quantity} {product.unit}
                    </span>
                </div>

                {/* Actions */}
                <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-dark-700">
                    <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        isLoading={isSubmitting}
                        leftIcon={<HiOutlineCheck className="w-5 h-5" />}
                    >
                        Confirmar Ajuste
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
