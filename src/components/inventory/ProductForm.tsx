import { logger } from '../../utils/logger';
import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Modal, Input, Select } from '../ui';
import type { Product, ProductCategory } from '../../types';
import { useCategories } from '../../hooks/useCategories';
import ProductValiditiesSection from './ProductValiditiesSection';

import { useSuppliers } from '../../hooks/useData';
import { productsAPI } from '../../services/api';
import toast from 'react-hot-toast';


// Validation Schema
const productSchema = z.object({
    code: z.string().min(1, 'Código é obrigatório'),
    sku: z.string().optional(),
    barcode: z.string().optional(),
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
    description: z.string().optional(),
    category: z.string().min(1, 'Categoria é obrigatória'),
    price: z.coerce.number().min(0.01, 'Preço deve ser maior que zero'),
    costPrice: z.coerce.number().min(0, 'Preço de custo não pode ser negativo'),
    currentStock: z.coerce.number().min(0, 'Estoque não pode ser negativo'),
    minStock: z.coerce.number().min(0, 'Estoque mínimo não pode ser negativo'),
    unit: z.string().min(1, 'Unidade é obrigatória'),
    supplierId: z.string().optional(),
    location: z.string().optional(),
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
    const { categories, isLoading: categoriesLoading } = useCategories();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [margin, setMargin] = useState(0);
    const isEditing = !!product;

    const {
        register,
        handleSubmit,
        reset,
        watch,
        formState: { errors },
    } = useForm<ProductFormData>({
        resolver: zodResolver(productSchema) as never,
        defaultValues: {
            code: '',
            sku: '',
            barcode: '',
            name: '',
            description: '',
            category: '',
            price: 0,
            costPrice: 0,
            currentStock: 0,
            minStock: 5,
            unit: 'un',
            supplierId: '',
            location: '',
            isReturnable: false,
            returnPrice: 0,
            packSize: 1,
        },
    });

    const watchedPrice = watch('price');
    const watchedCostPrice = watch('costPrice');

    const calcMargin = useCallback((price: number, cost: number) => {
        if (!price || price <= 0 || !cost || cost <= 0) return 0;
        return ((price - cost) / price) * 100;
    }, []);

    useEffect(() => {
        setMargin(calcMargin(Number(watchedPrice), Number(watchedCostPrice)));
    }, [watchedPrice, watchedCostPrice, calcMargin]);

    // Reset form when product changes
    useEffect(() => {
        if (product) {
            reset({
                code: product.code,
                sku: product.sku || '',
                barcode: product.barcode || '',
                name: product.name,
                description: product.description || '',
                category: product.categoryId || product.category,
                price: product.price,
                costPrice: product.costPrice,
                currentStock: product.currentStock,
                minStock: product.minStock,
                unit: product.unit,
                supplierId: product.supplierId || '',
                location: product.location || '',
                isReturnable: product.isReturnable || false,
                returnPrice: product.returnPrice || 0,
                packSize: product.packSize || 1,
            });
        } else {
            reset({
                code: `PROD-${Date.now().toString().slice(-6)}`,
                sku: '',
                barcode: '',
                name: '',
                description: '',
                category: categories[0]?.id || '',
                price: 0,
                costPrice: 0,
                currentStock: 0,
                minStock: 5,
                unit: 'un',
                supplierId: '',
                location: '',
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
                sku: data.sku || undefined,
                barcode: data.barcode || undefined,
                name: data.name,
                description: data.description || undefined,
                category: 'other' as ProductCategory,
                categoryId: data.category || undefined,
                price: data.price,
                costPrice: data.costPrice,
                currentStock: data.currentStock,
                minStock: data.minStock,
                unit: data.unit,
                supplierId: data.supplierId || undefined,
                location: data.location || undefined,
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
            logger.error('Error saving product:', error);
            // Error toast is already handled by the API interceptor
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    const categoryOptions = categories.map(c => ({
        value: c.id,
        label: c.name,
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
            size="xl"
        >
            <form onSubmit={handleSubmit(onSubmit as never)} className="space-y-6">
                {/* Identification */}
                <div>
                    <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-4">Informação de Identidade</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Input
                            label="Código Interno *"
                            {...register('code')}
                            error={errors.code?.message}
                            placeholder="PROD-001"
                        />
                        <Input
                            label="Referência (SKU)"
                            {...register('sku')}
                            placeholder="REF-0001"
                            autoFocus={!isEditing}
                        />
                        <Input
                            label="Cód. Barras (EAN)"
                            {...register('barcode')}
                            placeholder="Use o scanner..."
                        />
                        <Input
                            label="Nome *"
                            {...register('name')}
                            error={errors.name?.message}
                            placeholder="Nome do produto"
                        />
                    </div>
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
                        options={[
                            { value: '', label: categoriesLoading ? 'A carregar...' : categoryOptions.length === 0 ? 'Sem categorias - crie primeiro' : 'Selecione uma categoria' },
                            ...categoryOptions,
                        ]}
                        {...register('category')}
                        error={errors.category?.message}
                        disabled={categoriesLoading}
                    />
                    <Select
                        label="Unidade *"
                        options={unitOptions}
                        {...register('unit')}
                        error={errors.unit?.message}
                    />
                </div>

                {/* Prices + Margin */}
                <div>
                    <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-4">Estrutura de Preços & Margens</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
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
                        <div className={`flex flex-col items-center justify-center h-[72px] rounded-lg border-2 transition-all duration-300 ${
                            margin >= 30 ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/10' :
                            margin >= 10 ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/10' :
                            margin > 0  ? 'border-red-400 bg-red-50 dark:bg-red-900/10' :
                            'border-gray-200 bg-gray-50 dark:bg-dark-700'
                        }`}>
                            <span className="text-[9px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest">Margem Lucro</span>
                            <span className={`text-2xl font-black tracking-tighter ${
                                margin >= 30 ? 'text-primary-600' :
                                margin >= 10 ? 'text-amber-600' :
                                margin > 0  ? 'text-red-600' :
                                'text-gray-400'
                            }`}>
                                {margin > 0 ? `${margin.toFixed(1)}%` : ''}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Stock */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {isEditing ? (
                        <div className="relative">
                            <Input
                                label="Estoque Atual"
                                type="number"
                                {...register('currentStock')}
                                error={errors.currentStock?.message}
                                readOnly
                                className="bg-gray-50 dark:bg-dark-700/50 cursor-not-allowed opacity-80"
                            />
                            <div className="absolute -top-1 -right-1 group">
                                <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-gray-800 text-white text-[10px] rounded shadow-lg w-48 z-10">
                                    Para ajustar o stock, utilize a aba de "Lotes & Validades" ou "Movimentos".
                                </div>
                                <span className="w-4 h-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center cursor-help">
                                    <span className="text-[10px] font-bold text-amber-600">!</span>
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 bg-primary-50 dark:bg-primary-900/10 rounded-lg border border-primary-100 dark:border-primary-900/30 flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center shrink-0">
                                <span className="text-primary-600 font-bold">i</span>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-primary-900 dark:text-primary-100">Controlo de Inventário Profissional</p>
                                <p className="text-[11px] text-primary-700 dark:text-primary-400 leading-tight mt-0.5">
                                    O stock inicial será **zero**. Após cadastrar o produto, adicione quantidades reais através de **Lotes** (com validade e preço de custo) para garantir a rastreabilidade total.
                                </p>
                            </div>
                        </div>
                    )}
                    <Input
                        label="Estoque Mínimo (Alerta)"
                        type="number"
                        {...register('minStock')}
                        error={errors.minStock?.message}
                        placeholder="5"
                    />
                </div>

                {/* Additional Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                        label="Fornecedor"
                        options={supplierOptions}
                        {...register('supplierId')}
                    />
                    <Input
                        label="Localização"
                        {...register('location')}
                        placeholder="A-01-02"
                    />
                </div>

                {/* Validades - only shown when editing an existing product */}
                {isEditing && product && (
                    <div className="p-4 bg-gray-50 dark:bg-dark-700/50 rounded-lg border border-gray-200 dark:border-dark-600">
                        <ProductValiditiesSection productId={product.id} />
                    </div>
                )}
                {!isEditing && (
                    <p className="text-xs text-gray-400 italic">
                        Após criar o produto poder adicionar as suas validades (lotes com datas de expiração).
                    </p>
                )}

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
