import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    HiOutlineTrash,
    HiOutlineSearch,
    HiOutlineCheck,
    HiOutlineX
} from 'react-icons/hi';
import { Modal, Button, Input, Select, Card } from '../ui';
import { useSuppliers, useProducts } from '../../hooks/useData';
import { formatCurrency } from '../../utils/helpers';
import type { PurchaseOrderItem } from '../../types';
import { suppliersAPI } from '../../services/api';
import toast from 'react-hot-toast';

const purchaseOrderSchema = z.object({
    supplierId: z.string().min(1, 'Fornecedor é obrigatório'),
    items: z.array(z.object({
        productId: z.string().min(1, 'Produto é obrigatório'),
        quantity: z.number().min(1, 'Quantidade mínima é 1'),
        unitCost: z.number().min(0, 'Custo não pode ser negativo'),
    })).min(1, 'Adicione pelo menos um item'),
    notes: z.string().optional(),
    expectedDeliveryDate: z.string().optional(),
});

type PurchaseOrderFormData = z.infer<typeof purchaseOrderSchema>;

interface CreatePurchaseOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function CreatePurchaseOrderModal({ isOpen, onClose }: CreatePurchaseOrderModalProps) {
    const { suppliers: suppliersData } = useSuppliers();
    const { products: productsData } = useProducts();
    const suppliers = Array.isArray(suppliersData) ? suppliersData : [];
    const products = Array.isArray(productsData) ? productsData : [];
    const [searchTerm, setSearchTerm] = useState('');

    const {
        register,
        control,
        handleSubmit,
        watch,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<PurchaseOrderFormData>({
        resolver: zodResolver(purchaseOrderSchema),
        defaultValues: {
            items: [],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'items',
    });

    const watchedItems = watch('items');

    // Calculate totals
    const totalAmount = watchedItems?.reduce((sum, item) => { // Calculate total without memo for simplicity in modal
        return sum + ((item.quantity || 0) * (item.unitCost || 0));
    }, 0) || 0;

    // Filter products for search
    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.code.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 5); // Limit to 5 suggestions

    const handleAddItem = (productId: string) => {
        const product = products.find(p => p.id === productId);
        if (product) {
            append({
                productId: product.id,
                quantity: 1,
                unitCost: product.costPrice || 0,
            });
            setSearchTerm(''); // Clear search after adding
        }
    };

    const onSubmit = async (data: PurchaseOrderFormData) => {
        const supplier = suppliers.find(s => s.id === data.supplierId);
        if (!supplier) return;

        // Map items to include product names for display
        const orderItems: PurchaseOrderItem[] = data.items.map(item => {
            const product = products.find(p => p.id === item.productId);
            return {
                id: crypto.randomUUID(),
                productId: item.productId,
                productName: product?.name || 'Unknown Product',
                quantity: item.quantity,
                receivedQty: 0,
                unitCost: item.unitCost,
                total: item.quantity * item.unitCost,
            };
        });



        try {
            await suppliersAPI.createPurchaseOrder(supplier.id, {
                items: orderItems.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    unitCost: item.unitCost
                })),
                expectedDeliveryDate: data.expectedDeliveryDate,
                notes: data.notes
            });

            toast.success(`Encomenda criada com sucesso!`);
            handleClose();
            // Trigger refresh in parent if needed (would require a callback prop, but for now just close)
            window.location.reload(); // Simple refresh for now
        } catch (error) {
            console.error('Error creating purchase order:', error);
            toast.error('Erro ao criar encomenda');
        }
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="Nova Encomenda a Fornecedor"
            size="xl"
        >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Supplier Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                        label="Fornecedor *"
                        options={[
                            { value: '', label: 'Selecione um fornecedor' },
                            ...suppliers.filter(s => s.isActive).map(s => ({
                                value: s.id,
                                label: s.name
                            }))
                        ]}
                        {...register('supplierId')}
                        error={errors.supplierId?.message}
                    />
                    <Input
                        label="Data Prevista de Entrega"
                        type="date"
                        {...register('expectedDeliveryDate')}
                    />
                </div>

                {/* Product Search & Add */}
                <Card padding="sm" className="bg-gray-50 dark:bg-dark-800">
                    <div className="mb-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Adicionar Produtos
                        </label>
                        <div className="relative mt-1">
                            <Input
                                placeholder="Buscar produto por nome ou código..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                leftIcon={<HiOutlineSearch className="w-5 h-5" />}
                            />
                            {searchTerm && (
                                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-dark-700 rounded-md shadow-lg border border-gray-200 dark:border-dark-600 max-h-60 overflow-auto">
                                    {filteredProducts.length > 0 ? (
                                        filteredProducts.map(product => (
                                            <button
                                                key={product.id}
                                                type="button"
                                                onClick={() => handleAddItem(product.id)}
                                                className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-dark-600 flex justify-between items-center"
                                            >
                                                <span>{product.name}</span>
                                                <span className="text-sm text-gray-500">
                                                    Estoque: {product.currentStock} | Custo: {formatCurrency(product.costPrice)}
                                                </span>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="px-4 py-2 text-gray-500 text-sm">
                                            Nenhum produto encontrado
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </Card>

                {/* Items List */}
                <div className="space-y-3">
                    {fields.map((field, index) => {
                        const productId = watchedItems[index]?.productId;
                        const product = products.find(p => p.id === productId);

                        return (
                            <div key={field.id} className="flex gap-4 items-end bg-white dark:bg-dark-900 p-3 rounded-lg border border-gray-200 dark:border-dark-700">
                                <div className="flex-1">
                                    <label className="text-xs text-gray-500 mb-1 block">Produto</label>
                                    <p className="font-medium text-gray-900 dark:text-white truncate">
                                        {product?.name}
                                    </p>
                                    <input
                                        type="hidden"
                                        {...register(`items.${index}.productId`)}
                                    />
                                </div>
                                <div className="w-24">
                                    <Input
                                        label="Qtd"
                                        type="number"
                                        min="1"
                                        {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                                    />
                                </div>
                                <div className="w-32">
                                    <Input
                                        label="Custo Unit."
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        {...register(`items.${index}.unitCost`, { valueAsNumber: true })}
                                    />
                                </div>
                                <div className="w-32 pb-3 text-right">
                                    <p className="text-xs text-gray-500">Total</p>
                                    <p className="font-semibold text-gray-900 dark:text-white">
                                        {formatCurrency((watchedItems[index]?.quantity || 0) * (watchedItems[index]?.unitCost || 0))}
                                    </p>
                                </div>
                                <div className="pb-1">
                                    <button
                                        type="button"
                                        onClick={() => remove(index)}
                                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                    >
                                        <HiOutlineTrash className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {fields.length === 0 && (
                        <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 dark:border-dark-700 rounded-lg">
                            Nenhum item adicionado à encomenda.
                        </div>
                    )}
                    {errors.items && (
                        <p className="text-sm text-red-500">{errors.items.message}</p>
                    )}
                </div>

                {/* Footer Totals & Notes */}
                <div className="flex flex-col md:flex-row gap-6 pt-4 border-t border-gray-200 dark:border-dark-700">
                    <div className="flex-1">
                        <Input
                            label="Observações"
                            {...register('notes')}
                            placeholder="Notas para o fornecedor ou internas..."
                        />
                    </div>
                    <div className="w-full md:w-64 bg-gray-50 dark:bg-dark-800 p-4 rounded-xl">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-600 dark:text-gray-400">Total Itens</span>
                            <span className="font-semibold">{watchedItems?.length || 0}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-dark-600">
                            <span className="text-lg font-bold text-gray-900 dark:text-white">Total</span>
                            <span className="text-xl font-bold text-primary-600">
                                {formatCurrency(totalAmount)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-dark-700">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={handleClose}
                        leftIcon={<HiOutlineX className="w-4 h-4" />}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        isLoading={isSubmitting}
                        leftIcon={<HiOutlineCheck className="w-4 h-4" />}
                    >
                        Criar Encomenda
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
