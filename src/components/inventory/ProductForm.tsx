import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Modal, Input, Select } from '../ui';
import { categoryLabels } from '../../utils/constants';
import type { Product, ProductCategory } from '../../types';

import { useSuppliers } from '../../hooks/useData';
import { productsAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { useStore } from '../../stores/useStore';
import { getBusinessConfig } from '../../config/businessFeatures';

// Validation Schema
const productSchema = z.object({
    code: z.string().min(1, 'Código é obrigatório'),
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
    description: z.string().optional(),
    category: z.string().min(1, 'Categoria é obrigatória'),
    price: z.coerce.number().min(0.01, 'Preço deve ser maior que zero'),
    costPrice: z.coerce.number().min(0, 'Preço de custo não pode ser negativo'),
    currentStock: z.coerce.number().min(0, 'Estoque não pode ser negativo'),
    minStock: z.coerce.number().min(0, 'Estoque mínimo não pode ser negativo'),
    unit: z.string().min(1, 'Unidade é obrigatória'),
    barcode: z.string().optional(),
    supplierId: z.string().optional(),
    location: z.string().optional(),
    batchNumber: z.string().optional(),
    expiryDate: z.string().optional(),
    isReturnable: z.boolean().optional(),
    returnPrice: z.coerce.number().min(0).optional(),
    packSize: z.coerce.number().min(1).optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductFormProps {
    isOpen: boolean;
    onClose: () => void;
    product?: Product | null;
    onSuccess?: () => void;
}

export default function ProductForm({ isOpen, onClose, product, onSuccess }: ProductFormProps) {
    const { suppliers } = useSuppliers();
    const { companySettings } = useStore();
    const businessConfig = getBusinessConfig(companySettings.businessType);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isEditing = !!product;

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<ProductFormData>({
        resolver: zodResolver(productSchema) as never,
        defaultValues: {
            code: '',
            name: '',
            description: '',
            category: 'other',
            price: 0,
            costPrice: 0,
            currentStock: 0,
            minStock: 5,
            unit: 'un',
            barcode: '',
            supplierId: '',
            location: '',
            batchNumber: '',
            expiryDate: '',
            isReturnable: false,
            returnPrice: 0,
            packSize: 1,
        },
    });

    // Reset form when product changes
    useEffect(() => {
        if (product) {
            reset({
                code: product.code,
                name: product.name,
                description: product.description || '',
                category: product.category,
                price: product.price,
                costPrice: product.costPrice,
                currentStock: product.currentStock,
                minStock: product.minStock,
                unit: product.unit,
                barcode: product.barcode || '',
                supplierId: product.supplierId || '',
                location: product.location || '',
                batchNumber: product.batchNumber || '',
                expiryDate: product.expiryDate || '',
                isReturnable: product.isReturnable || false,
                returnPrice: product.returnPrice || 0,
                packSize: product.packSize || 1,
            });
        } else {
            reset({
                code: `PROD-${Date.now().toString().slice(-6)}`,
                name: '',
                description: '',
                category: 'other',
                price: 0,
                costPrice: 0,
                currentStock: 0,
                minStock: 5,
                unit: 'un',
                barcode: '',
                supplierId: '',
                location: '',
                batchNumber: '',
                expiryDate: '',
                isReturnable: false,
                returnPrice: 0,
                packSize: 1,
            });
        }
    }, [product, reset]);

    const onSubmit = async (data: ProductFormData) => {
        setIsSubmitting(true);
        try {
            const productData = {
                code: data.code,
                name: data.name,
                description: data.description || undefined,
                category: data.category as ProductCategory,
                price: data.price,
                costPrice: data.costPrice,
                currentStock: data.currentStock,
                minStock: data.minStock,
                unit: data.unit,
                barcode: data.barcode || undefined,
                supplierId: data.supplierId || undefined,
                location: data.location || undefined,
                batchNumber: data.batchNumber || undefined,
                expiryDate: data.expiryDate || undefined,
                isReturnable: data.isReturnable,
                returnPrice: data.returnPrice,
                packSize: data.packSize,
            };

            if (isEditing && product) {
                await productsAPI.update(product.id, productData);
                toast.success('Produto atualizado com sucesso!');
            } else {
                await productsAPI.create(productData);
                toast.success('Produto cadastrado com sucesso!');
            }

            onSuccess?.();
            onClose();
        } catch (error) {
            console.error('Error saving product:', error);
            // Error toast is already handled by the API interceptor
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    const categoryOptions = Object.entries(categoryLabels).map(([value, label]) => ({
        value,
        label,
    }));

    const unitOptions = [
        { value: 'un', label: 'Unidade (un)' },
        { value: 'kg', label: 'Quilograma (kg)' },
        { value: 'g', label: 'Grama (g)' },
        { value: 'l', label: 'Litro (l)' },
        { value: 'ml', label: 'Mililitro (ml)' },
        { value: 'm', label: 'Metro (m)' },
        { value: 'cx', label: 'Caixa (cx)' },
        { value: 'pct', label: 'Pacote (pct)' },
    ];

    const supplierOptions = [
        { value: '', label: 'Selecione um fornecedor' },
        ...suppliers.map(s => ({
            value: s.id,
            label: `${s.name} (${s.code})`,
        })),
    ];

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={isEditing ? 'Editar Produto' : 'Novo Produto'}
            size="lg"
        >
            <form onSubmit={handleSubmit(onSubmit as never)} className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                        label="Código *"
                        {...register('code')}
                        error={errors.code?.message}
                        placeholder="PROD-001"
                    />
                    <Input
                        label="Nome *"
                        {...register('name')}
                        error={errors.name?.message}
                        placeholder="Nome do produto"
                    />
                </div>

                <Input
                    label="Descrição"
                    {...register('description')}
                    placeholder="Descrição do produto (opcional)"
                />

                {/* Category and Unit */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                        label="Categoria *"
                        options={categoryOptions}
                        {...register('category')}
                        error={errors.category?.message}
                    />
                    <Select
                        label="Unidade *"
                        options={unitOptions}
                        {...register('unit')}
                        error={errors.unit?.message}
                    />
                </div>

                {/* Prices */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                        label="Preço de Venda *"
                        type="number"
                        step="0.01"
                        {...register('price')}
                        error={errors.price?.message}
                        placeholder="0.00"
                    />
                    <Input
                        label="Preço de Custo"
                        type="number"
                        step="0.01"
                        {...register('costPrice')}
                        error={errors.costPrice?.message}
                        placeholder="0.00"
                    />
                </div>

                {/* Stock */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                        label="Estoque Atual *"
                        type="number"
                        {...register('currentStock')}
                        error={errors.currentStock?.message}
                        placeholder="0"
                    />
                    <Input
                        label="Estoque Mínimo"
                        type="number"
                        {...register('minStock')}
                        error={errors.minStock?.message}
                        placeholder="5"
                    />
                </div>

                {/* Additional Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                        label="Código de Barras"
                        {...register('barcode')}
                        placeholder="7891234567890"
                    />
                    <Select
                        label="Fornecedor"
                        options={supplierOptions}
                        {...register('supplierId')}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input
                        label="Localização"
                        {...register('location')}
                        placeholder="A-01-02"
                    />
                    {(businessConfig.features.batches || businessConfig.features.expiryDates) && (
                        <>
                            {businessConfig.features.batches && (
                                <Input
                                    label="Número do Lote"
                                    {...register('batchNumber')}
                                    placeholder="LOTE001"
                                />
                            )}
                            {businessConfig.features.expiryDates && (
                                <Input
                                    label="Data de Validade"
                                    type="date"
                                    {...register('expiryDate')}
                                />
                            )}
                        </>
                    )}
                </div>

                {/* Bottle Store Configuration */}
                <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-200 dark:border-amber-800">
                    <h3 className="text-sm font-bold text-amber-800 dark:text-amber-400 mb-3 flex items-center gap-2">
                        <span className="p-1 bg-amber-100 dark:bg-amber-800 rounded">Garrafeira</span>
                        Configurações de Vasilhame
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div className="flex items-center h-10">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                                    {...register('isReturnable')}
                                />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Produto Retornável?
                                </span>
                            </label>
                        </div>
                        <Input
                            label="Preço do Depósito (MT)"
                            type="number"
                            step="0.01"
                            {...register('returnPrice')}
                            placeholder="0.00"
                        />
                        <Input
                            label="Tamanho da Caixa/Pack"
                            type="number"
                            {...register('packSize')}
                            placeholder="1"
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-dark-700">
                    <Button type="button" variant="ghost" onClick={handleClose}>
                        Cancelar
                    </Button>
                    <Button type="submit" isLoading={isSubmitting}>
                        {isEditing ? 'Salvar Alterações' : 'Cadastrar Produto'}
                    </Button>
                </div>
            </form>
        </Modal >
    );
}
