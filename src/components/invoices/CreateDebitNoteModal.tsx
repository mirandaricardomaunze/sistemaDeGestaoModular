import { logger } from '../../utils/logger';
import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { HiOutlineMagnifyingGlass, HiOutlinePlus, HiOutlineTrash } from 'react-icons/hi2';
import { Modal, Button, Input } from '../ui';
import { formatCurrency } from '../../utils/helpers';
import type { Invoice, DebitNote } from '../../types';
import { invoicesAPI } from '../../services/api';
import toast from 'react-hot-toast';

interface CreateDebitNoteModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoices: Invoice[];
    onCreate: (debitNote: DebitNote) => void;
}

const REASON_PRESETS = [
    'Juros de mora',
    'Multa contratual',
    'Despesas de transporte',
    'CorrecÃ§Ã£o de preÃ§o',
    'Acerto cambial',
    'Outros encargos',
];

const debitNoteFormSchema = z.object({
    invoiceId: z.string().min(1, 'Selecione uma fatura'),
    reason: z.string().min(3, 'Motivo obrigatÃ³rio (mÃ­nimo 3 caracteres)').max(500),
    notes: z.string().max(500).optional(),
    items: z
        .array(
            z.object({
                description: z.string().min(1, 'DescriÃ§Ã£o obrigatÃ³ria'),
                quantity: z.number().positive('Qtd > 0'),
                unitPrice: z.number().positive('PreÃ§o > 0'),
            }),
        )
        .min(1, 'Adicione pelo menos uma linha'),
});

type FormData = z.infer<typeof debitNoteFormSchema>;

export default function CreateDebitNoteModal({
    isOpen,
    onClose,
    invoices,
    onCreate,
}: CreateDebitNoteModalProps) {
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        reset,
        control,
        formState: { errors },
    } = useForm<FormData>({
        resolver: zodResolver(debitNoteFormSchema),
        defaultValues: {
            invoiceId: '',
            reason: '',
            notes: '',
            items: [{ description: '', quantity: 1, unitPrice: 0 }],
        },
    });

    const { fields, append, remove } = useFieldArray({ control, name: 'items' });
    const watchItems = watch('items');

    const availableInvoices = invoices.filter(
        (inv) =>
            inv.status !== 'cancelled' &&
            inv.status !== 'draft' &&
            (inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                inv.customerName.toLowerCase().includes(searchTerm.toLowerCase())),
    );

    const handlePickInvoice = (inv: Invoice) => {
        setSelectedInvoice(inv);
        setValue('invoiceId', inv.id);
    };

    const clearInvoice = () => {
        setSelectedInvoice(null);
        setValue('invoiceId', '');
    };

    const total = (watchItems || []).reduce(
        (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
        0,
    );

    const onSubmit = async (data: FormData) => {
        if (!selectedInvoice) return;
        setSubmitting(true);
        try {
            const items = data.items.map((it) => ({
                description: it.description,
                quantity: Number(it.quantity),
                unitPrice: Number(it.unitPrice),
                total: Number(it.quantity) * Number(it.unitPrice),
            }));
            const result = await invoicesAPI.createDebitNote({
                originalInvoiceId: selectedInvoice.id,
                customerName: selectedInvoice.customerName,
                items,
                reason: data.reason,
                notes: data.notes || undefined,
            });
            onCreate(result);
            toast.success('Nota de DÃ©bito emitida com sucesso!');
            handleClose();
        } catch (error) {
            logger.error('Error creating debit note:', error);
            toast.error('Erro ao emitir nota de dÃ©bito');
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        reset();
        setSelectedInvoice(null);
        setSearchTerm('');
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Emitir Nota de DÃ©bito" size="lg">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Invoice selector */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Fatura Original
                    </label>
                    {!selectedInvoice ? (
                        <div className="space-y-2">
                            <Input
                                placeholder="Buscar por nÃºmero ou cliente..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                leftIcon={<HiOutlineMagnifyingGlass className="w-5 h-5" />}
                            />
                            <div className="max-h-48 overflow-y-auto border rounded-lg divide-y dark:border-gray-700">
                                {availableInvoices.length === 0 ? (
                                    <p className="p-3 text-sm text-gray-500 text-center">
                                        Nenhuma fatura encontrada.
                                    </p>
                                ) : (
                                    availableInvoices.map((inv) => (
                                        <div
                                            key={inv.id}
                                            onClick={() => handlePickInvoice(inv)}
                                            className="p-3 hover:bg-gray-50 dark:hover:bg-dark-700 cursor-pointer flex justify-between items-center"
                                        >
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-white">
                                                    {inv.invoiceNumber}
                                                </p>
                                                <p className="text-sm text-gray-500">{inv.customerName}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-medium text-gray-900 dark:text-white">
                                                    {formatCurrency(inv.total)}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {new Date(inv.issueDate).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            {errors.invoiceId && (
                                <p className="text-red-500 text-sm">{errors.invoiceId.message}</p>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800 rounded-lg">
                            <div>
                                <p className="font-bold text-amber-900 dark:text-amber-100">
                                    {selectedInvoice.invoiceNumber}
                                </p>
                                <p className="text-sm text-amber-700 dark:text-amber-300">
                                    {selectedInvoice.customerName} â€” {formatCurrency(selectedInvoice.total)}
                                </p>
                            </div>
                            <Button size="sm" variant="ghost" onClick={clearInvoice}>
                                Trocar
                            </Button>
                        </div>
                    )}
                </div>

                {selectedInvoice && (
                    <>
                        {/* Reason */}
                        <div className="space-y-2">
                            <Input
                                label="Motivo do DÃ©bito"
                                {...register('reason')}
                                placeholder="Ex: Juros de mora 30 dias"
                                error={errors.reason?.message}
                            />
                            <div className="flex flex-wrap gap-2">
                                {REASON_PRESETS.map((preset) => (
                                    <Button variant="ghost"
                                        key={preset}
                                        type="button"
                                        onClick={() => setValue('reason', preset)}
                                        className="text-xs px-2.5 py-1 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-dark-700 dark:hover:bg-dark-600 text-gray-700 dark:text-gray-300"
                                    >
                                        {preset}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Items */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="font-medium text-gray-900 dark:text-white">
                                    Linhas a Cobrar
                                </h4>
                                <Button
                                    type="button"
                                    size="xs"
                                    variant="outline"
                                    onClick={() => append({ description: '', quantity: 1, unitPrice: 0 })}
                                >
                                    <HiOutlinePlus className="w-4 h-4 mr-1" />
                                    Linha
                                </Button>
                            </div>
                            <div className="border rounded-lg overflow-hidden dark:border-gray-700">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-dark-800 text-gray-500 uppercase text-xs">
                                        <tr>
                                            <th className="px-3 py-2 text-left">DescriÃ§Ã£o</th>
                                            <th className="px-3 py-2 text-right w-20">Qtd</th>
                                            <th className="px-3 py-2 text-right w-32">PreÃ§o Unit.</th>
                                            <th className="px-3 py-2 text-right w-32">Total</th>
                                            <th className="px-3 py-2 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                                        {fields.map((field, index) => {
                                            const qty = Number(watchItems?.[index]?.quantity) || 0;
                                            const price = Number(watchItems?.[index]?.unitPrice) || 0;
                                            const lineTotal = qty * price;
                                            return (
                                                <tr key={field.id}>
                                                    <td className="px-3 py-2">
                                                        <input
                                                            {...register(`items.${index}.description` as const)}
                                                            placeholder="DescriÃ§Ã£o do encargo"
                                                            className="w-full bg-transparent border border-gray-200 dark:border-dark-600 rounded px-2 py-1 text-sm"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            {...register(`items.${index}.quantity` as const, {
                                                                valueAsNumber: true,
                                                            })}
                                                            className="w-full text-right bg-transparent border border-gray-200 dark:border-dark-600 rounded px-2 py-1 text-sm"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            {...register(`items.${index}.unitPrice` as const, {
                                                                valueAsNumber: true,
                                                            })}
                                                            className="w-full text-right bg-transparent border border-gray-200 dark:border-dark-600 rounded px-2 py-1 text-sm"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-white">
                                                        {formatCurrency(lineTotal)}
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        <Button variant="ghost"
                                                            type="button"
                                                            onClick={() => fields.length > 1 && remove(index)}
                                                            disabled={fields.length === 1}
                                                            className="text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                                                            title="Remover linha"
                                                        >
                                                            <HiOutlineTrash className="w-4 h-4" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {errors.items && (
                                <p className="text-red-500 text-sm">
                                    {errors.items.message || 'Verifique as linhas'}
                                </p>
                            )}
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                ObservaÃ§Ãµes (opcional)
                            </label>
                            <textarea
                                {...register('notes')}
                                rows={2}
                                className="w-full mt-1 rounded-lg border border-gray-200 dark:border-dark-600 bg-transparent px-3 py-2 text-sm"
                                placeholder="Detalhes adicionais"
                            />
                        </div>

                        {/* Summary */}
                        <div className="flex justify-end p-4 bg-gray-50 dark:bg-dark-800 rounded-lg">
                            <div className="text-right">
                                <p className="text-sm text-gray-500">Total a Cobrar (s/ IVA)</p>
                                <p className="text-2xl font-bold text-amber-600">
                                    +{formatCurrency(total)}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    IVA serÃ¡ aplicado conforme a fatura original
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button type="button" variant="outline" className="flex-1" onClick={handleClose}>
                                Cancelar
                            </Button>
                            <Button type="submit" className="flex-1" disabled={submitting}>
                                {submitting ? 'A emitir...' : 'Gerar Nota de DÃ©bito'}
                            </Button>
                        </div>
                    </>
                )}
            </form>
        </Modal>
    );
}
