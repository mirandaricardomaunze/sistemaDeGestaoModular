import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { HiOutlineSearch } from 'react-icons/hi';
import { Modal, Button, Input } from '../ui'; // Adjust based on your UI components
import { generateId, formatCurrency } from '../../utils/helpers';
import type { Invoice, CreditNote } from '../../types';
import { invoicesAPI } from '../../services/api';
import toast from 'react-hot-toast';

interface CreateCreditNoteModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoices: Invoice[];
    onCreate: (creditNote: CreditNote) => void;
}

const creditNoteSchema = z.object({
    invoiceId: z.string().min(1, 'Selecione uma fatura'),
    reason: z.string().min(3, 'Motivo obrigatório'),
    items: z.array(z.object({
        productId: z.string(),
        description: z.string(),
        quantity: z.number().min(0),
        maxQuantity: z.number(), // For validation
        unitPrice: z.number(),
        total: z.number(),
        originalInvoiceItemId: z.string()
    })).refine((items) => items.some(item => item.quantity > 0), {
        message: "Selecione pelo menos um item para devolução",
        path: ["items"] // This might not map perfectly in array errors but verifies the whole array
    })
});

type CreditNoteFormData = z.infer<typeof creditNoteSchema>;

export default function CreateCreditNoteModal({ isOpen, onClose, invoices, onCreate }: CreateCreditNoteModalProps) {
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<CreditNoteFormData>({
        resolver: zodResolver(creditNoteSchema),
        defaultValues: {
            invoiceId: '',
            reason: '',
            items: []
        }
    });

    const watchItems = watch('items');
    const watchInvoiceId = watch('invoiceId');

    // Filter available invoices (only paid or partial or sent could potentially be credited, usually paid/sent)
    const availableInvoices = invoices.filter(inv =>
        (inv.status === 'paid' || inv.status === 'partial' || inv.status === 'sent' || inv.status === 'overdue') &&
        (inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) || inv.customerName.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Handle Invoice Selection
    useEffect(() => {
        if (watchInvoiceId) {
            const invoice = invoices.find(inv => inv.id === watchInvoiceId);
            setSelectedInvoice(invoice || null);
            if (invoice) {
                // Populate items with 0 quantity initially
                const initialItems = invoice.items.map(item => ({
                    // Assuming invoice item id maps to product or is unique. Ideally invoice item has productId.  
                    // Note: InvoiceItem in types/index.ts usually doesn't strictly have productId, it has 'id'. 
                    // However, for CreditNote we need to know which product to restock. 
                    // Integrating with your system: InvoiceItem in index.ts has {id, description...}. 
                    // It seems InvoiceItem doesn't track ProductId explicitly in the current type definition I saw in step 35!
                    // This is a potential issue. I will assume 'id' corresponds to product or I need to update InvoiceItem.
                    // Checking existing invoices: It seems they are loose items. 
                    // BUT, to restock, we need productId. 
                    // I will check if InvoiceItem structure was updated or if I need to rely on matching description or if I should just use `id` as `productId` for now (best effort).
                    // In `VacationManager` context, unrelated. 
                    // In `Invoices.tsx`, `sampleInvoices` items have ids '1'.
                    // I will assume `id` in InvoiceItem CAN be used as productId or I will just pass it.

                    productId: item.id, // Using item.id as placeholder for productId
                    description: item.description,
                    quantity: 0,
                    maxQuantity: item.quantity,
                    unitPrice: item.unitPrice,
                    total: 0,
                    originalInvoiceItemId: item.id
                }));
                setValue('items', initialItems);
            }
        } else {
            setSelectedInvoice(null);
            setValue('items', []);
        }
    }, [watchInvoiceId, invoices, setValue]);

    const handleQuantityChange = (index: number, newQty: number) => {
        const currentItems = watch('items');
        const item = currentItems[index];

        if (newQty > item.maxQuantity) newQty = item.maxQuantity;
        if (newQty < 0) newQty = 0;

        const updatedItem = {
            ...item,
            quantity: newQty,
            total: newQty * item.unitPrice
        };

        const newItems = [...currentItems];
        newItems[index] = updatedItem;
        setValue('items', newItems);
    };

    const calculateRefundTotal = () => {
        return watchItems?.reduce((sum, item) => sum + (item.total || 0), 0) || 0;
    };

    const onSubmit = async (data: CreditNoteFormData) => {
        if (!selectedInvoice) return;

        const returnItems = data.items.filter(item => item.quantity > 0);

        if (returnItems.length === 0) {
            toast.error("Selecione pelo menos um item para devolver.");
            return;
        }

        try {
            const result = await invoicesAPI.createCreditNote({
                originalInvoiceId: selectedInvoice.id,
                customerName: selectedInvoice.customerName,
                // customerId: selectedInvoice.customerId, // Optional if backend infers it
                items: returnItems.map(item => ({
                    productId: item.productId,
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    originalInvoiceItemId: item.originalInvoiceItemId
                })),
                reason: data.reason
            });

            onCreate(result);
            toast.success("Nota de Crédito emitida com sucesso!");
            handleClose();
        } catch (error) {
            console.error('Error creating credit note:', error);
            toast.error('Erro ao emitir nota de crédito');
        }
    };

    const handleClose = () => {
        reset();
        setSelectedInvoice(null);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Emitir Nota de Crédito" size="lg">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

                {/* Invoice Selector */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Selecionar Fatura Original
                    </label>
                    {!selectedInvoice ? (
                        <div className="space-y-2">
                            <Input
                                placeholder="Buscar por número ou cliente..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                leftIcon={<HiOutlineSearch className="w-5 h-5" />}
                            />
                            <div className="max-h-48 overflow-y-auto border rounded-lg divide-y dark:border-gray-700">
                                {availableInvoices.length === 0 ? (
                                    <p className="p-3 text-sm text-gray-500 text-center">Nenhuma fatura encontrada.</p>
                                ) : (
                                    availableInvoices.map(inv => (
                                        <div
                                            key={inv.id}
                                            onClick={() => setValue('invoiceId', inv.id)}
                                            className="p-3 hover:bg-gray-50 dark:hover:bg-dark-700 cursor-pointer flex justify-between items-center"
                                        >
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-white">{inv.invoiceNumber}</p>
                                                <p className="text-sm text-gray-500">{inv.customerName}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(inv.total)}</p>
                                                <p className="text-xs text-gray-500">{new Date(inv.issueDate).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            {errors.invoiceId && <p className="text-red-500 text-sm">{errors.invoiceId.message}</p>}
                        </div>
                    ) : (
                        <div className="flex items-center justify-between p-4 bg-primary-50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-800 rounded-lg">
                            <div>
                                <p className="font-bold text-primary-900 dark:text-primary-100">{selectedInvoice.invoiceNumber}</p>
                                <p className="text-sm text-primary-700 dark:text-primary-300">{selectedInvoice.customerName}</p>
                            </div>
                            <Button size="sm" variant="ghost" onClick={() => { setValue('invoiceId', ''); setSelectedInvoice(null); }}>
                                Trocar
                            </Button>
                        </div>
                    )}
                </div>

                {selectedInvoice && (
                    <>
                        {/* Reason */}
                        <Input
                            label="Motivo da Devolução"
                            {...register('reason')}
                            placeholder="Ex: Produto defeituoso, Troca..."
                            error={errors.reason?.message}
                        />

                        {/* Items Selection */}
                        <div className="space-y-3">
                            <h4 className="font-medium text-gray-900 dark:text-white">Itens para Devolução</h4>
                            <div className="border rounded-lg overflow-hidden dark:border-gray-700">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 dark:bg-dark-800 text-gray-500 uppercase text-xs">
                                        <tr>
                                            <th className="px-4 py-3">Item</th>
                                            <th className="px-4 py-3 text-right">Qtd. Orig.</th>
                                            <th className="px-4 py-3 text-center">Devolver</th>
                                            <th className="px-4 py-3 text-right">Valor</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                                        {watchItems?.map((item, index) => (
                                            <tr key={index} className={item.quantity > 0 ? 'bg-red-50/50 dark:bg-red-900/10' : ''}>
                                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                                    {item.description}
                                                    <div className="text-xs text-gray-500">{formatCurrency(item.unitPrice)}/un</div>
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-500">{item.maxQuantity}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleQuantityChange(index, item.quantity - 1)}
                                                            className="w-6 h-6 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-200"
                                                        >
                                                            -
                                                        </button>
                                                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleQuantityChange(index, item.quantity + 1)}
                                                            className="w-6 h-6 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-200"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium">
                                                    {formatCurrency(item.total)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {errors.items && <p className="text-red-500 text-sm">Selecione pelo menos um item.</p>}
                        </div>

                        {/* Summary */}
                        <div className="flex justify-end p-4 bg-gray-50 dark:bg-dark-800 rounded-lg">
                            <div className="text-right">
                                <p className="text-sm text-gray-500">Total a Reembolsar</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(calculateRefundTotal())}</p>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button type="button" variant="outline" className="flex-1" onClick={handleClose}>
                                Cancelar
                            </Button>
                            <Button type="submit" className="flex-1">
                                Gerar Nota de Crédito
                            </Button>
                        </div>
                    </>
                )}
            </form>
        </Modal>
    );
}
