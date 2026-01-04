import { useState, useEffect } from 'react';
import { HiOutlineX, HiOutlineCheck } from 'react-icons/hi';
import { Input, Select, Textarea, Button } from '../../../components/ui';
import { hospitalityAPI } from '../../../services/api';
import { toast } from 'react-hot-toast';

// Expense categories
export const expenseCategories = [
    { value: 'cleaning', label: 'Limpeza' },
    { value: 'maintenance', label: 'Manutenção' },
    { value: 'utilities', label: 'Utilities (Água, Luz)' },
    { value: 'salaries', label: 'Salários' },
    { value: 'supplies', label: 'Suprimentos' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'insurance', label: 'Seguros' },
    { value: 'taxes', label: 'Impostos' },
    { value: 'other', label: 'Outros' },
];

// Expense status options
export const expenseStatusOptions = [
    { value: 'pending', label: 'Pendente' },
    { value: 'completed', label: 'Pago' },
    { value: 'cancelled', label: 'Cancelado' },
];

// Payment methods
export const paymentMethods = [
    { value: 'cash', label: 'Dinheiro' },
    { value: 'card', label: 'Cartão' },
    { value: 'transfer', label: 'Transferência' },
    { value: 'check', label: 'Cheque' },
    { value: 'other', label: 'Outro' },
];

interface ExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    expense: any | null;
}

export function ExpenseModal({ isOpen, onClose, onSave, expense }: ExpenseModalProps) {
    const [formData, setFormData] = useState({
        category: '',
        description: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        dueDate: '',
        status: 'pending',
        paymentMethod: '',
        reference: '',
        notes: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (expense) {
            setFormData({
                category: expense.category || '',
                description: expense.description || '',
                amount: expense.amount?.toString() || '',
                date: expense.date ? new Date(expense.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                dueDate: expense.dueDate ? new Date(expense.dueDate).toISOString().split('T')[0] : '',
                status: expense.status || 'pending',
                paymentMethod: expense.paymentMethod || '',
                reference: expense.reference || '',
                notes: expense.notes || '',
            });
        } else {
            setFormData({
                category: '',
                description: '',
                amount: '',
                date: new Date().toISOString().split('T')[0],
                dueDate: '',
                status: 'pending',
                paymentMethod: '',
                reference: '',
                notes: '',
            });
        }
    }, [expense]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!formData.category || !formData.description || !formData.amount) {
            toast.error('Por favor, preencha todos os campos obrigatórios');
            return;
        }

        if (parseFloat(formData.amount) <= 0) {
            toast.error('O valor deve ser maior que zero');
            return;
        }

        setIsSubmitting(true);
        try {
            const data = {
                ...formData,
                amount: parseFloat(formData.amount),
                date: formData.date || new Date().toISOString(),
                dueDate: formData.dueDate || null,
            };

            if (expense) {
                await hospitalityAPI.updateExpense(expense.id, data);
                toast.success('Despesa atualizada com sucesso!');
            } else {
                await hospitalityAPI.createExpense(data);
                toast.success('Despesa criada com sucesso!');
            }

            onSave();
            onClose();
        } catch (error: any) {
            console.error('Error saving expense:', error);
            toast.error(error.response?.data?.message || 'Erro ao salvar despesa');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4">
                <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose} />

                <div className="relative bg-white dark:bg-dark-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                    <div className="sticky top-0 bg-white dark:bg-dark-800 border-b border-gray-200 dark:border-dark-600 px-6 py-4 flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                            {expense ? 'Editar Despesa' : 'Nova Despesa'}
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                            <HiOutlineX className="w-6 h-6" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Category */}
                            <Select
                                label="Categoria"
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                options={expenseCategories}
                                placeholder="Selecione..."
                                required
                            />

                            {/* Amount */}
                            <Input
                                type="number"
                                step="0.01"
                                label="Valor"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                required
                            />
                        </div>

                        {/* Description */}
                        <Input
                            type="text"
                            label="Descrição"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            required
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Date */}
                            <Input
                                type="date"
                                label="Data"
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            />

                            {/* Due Date */}
                            <Input
                                type="date"
                                label="Data de Vencimento"
                                value={formData.dueDate}
                                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Status */}
                            <Select
                                label="Status"
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                options={expenseStatusOptions}
                            />

                            {/* Payment Method */}
                            <Select
                                label="Método de Pagamento"
                                value={formData.paymentMethod}
                                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                                options={paymentMethods}
                                placeholder="Selecione..."
                            />
                        </div>

                        {/* Reference */}
                        <Input
                            type="text"
                            label="Referência"
                            value={formData.reference}
                            onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                            placeholder="Número da fatura, recibo, etc."
                        />

                        {/* Notes */}
                        <Textarea
                            label="Notas"
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows={3}
                            placeholder="Informações adicionais..."
                        />

                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-dark-600">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={onClose}
                                disabled={isSubmitting}
                                leftIcon={<HiOutlineX className="w-4 h-4" />}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                isLoading={isSubmitting}
                                leftIcon={<HiOutlineCheck className="w-4 h-4" />}
                            >
                                {expense ? 'Atualizar' : 'Criar'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
