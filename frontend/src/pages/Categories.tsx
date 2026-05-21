import { logger } from '../utils/logger';
import { useState, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    HiOutlinePlus,
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlineTag,
    HiOutlineSwatch,
    HiOutlineCube,
    HiOutlineArrowPath,
} from 'react-icons/hi2';
import { Button, Input, Modal, usePagination, LoadingSpinner, PageHeader, SmartTable } from '../components/ui';
import { MetricCard } from '../components/common/ModuleMetricCard';
import { cn } from '../utils/helpers';
import type { Category } from '../types';
import { useCategories } from '../hooks/useData';
import { PAGE_SIZE } from '../utils/constants';

// Validation Schema
const categorySchema = z.object({
    name: z.string().min(2, 'Nome é obrigatório'),
    description: z.string().optional(),
    color: z.string().optional(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

// Predefined colors
const colorOptions = [
    { value: '#3b82f6', label: 'Azul' },
    { value: '#22c55e', label: 'Verde' },
    { value: '#f59e0b', label: 'Amarelo' },
    { value: '#ef4444', label: 'Vermelho' },
    { value: '#8b5cf6', label: 'Roxo' },
    { value: '#ec4899', label: 'Rosa' },
    { value: '#06b6d4', label: 'Ciano' },
    { value: '#f97316', label: 'Laranja' },
    { value: '#6b7280', label: 'Cinza' },
    { value: '#84cc16', label: 'Lima' },
];

interface CategoriesProps {
    hideHeader?: boolean;
    originModule?: string;
}

export default function Categories({ hideHeader = false, originModule }: CategoriesProps) {
    // Use API hook for real data
    const {
        categories,
        isLoading,
        error,
        refetch,
        addCategory,
        updateCategory,
        deleteCategory
    } = useCategories(originModule);

    const [search, setSearch] = useState('');
    const [showFormModal, setShowFormModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
    const [selectedColor, setSelectedColor] = useState('#3b82f6');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<CategoryFormData>({
        resolver: zodResolver(categorySchema) as never,
        defaultValues: {
            name: '',
            description: '',
            color: '#3b82f6',
        },
    });

    // Metrics
    const metrics = useMemo(() => {
        const total = categories.length;
        const active = categories.filter((c) => c.isActive).length;
        const totalProducts = categories.reduce((sum, c) => sum + (c.productCount || 0), 0);
        return { total, active, totalProducts };
    }, [categories]);

    // Filtered categories
    const filteredCategories = useMemo(() => {
        return categories.filter((c) => {
            const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
                c.code.toLowerCase().includes(search.toLowerCase()) ||
                (c.description && c.description.toLowerCase().includes(search.toLowerCase()));
            return matchesSearch;
        });
    }, [categories, search]);

    // Pagination
    const {
        currentPage,
        setCurrentPage,
        itemsPerPage,
        setItemsPerPage,
        paginatedItems: paginatedCategories,
        totalItems,
    } = usePagination(filteredCategories, PAGE_SIZE);

    const onSubmit = async (data: CategoryFormData) => {
        setIsSubmitting(true);
        try {
            if (editingCategory) {
                await updateCategory(editingCategory.id, {
                    name: data.name,
                    description: data.description || undefined,
                    color: selectedColor,
                });
            } else {
                await addCategory({
                    name: data.name,
                    description: data.description || undefined,
                    color: selectedColor,
                    // Pass originModule if creating for a specific module
                    ...(originModule ? { originModule } : {})
                });
            }
            closeFormModal();
        } catch (err) {
            logger.error('Error saving category:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (category: Category) => {
        setEditingCategory(category);
        setSelectedColor(category.color || '#3b82f6');
        reset({
            name: category.name,
            description: category.description || '',
            color: category.color || '#3b82f6',
        });
        setShowFormModal(true);
    };

    const handleDelete = async () => {
        if (categoryToDelete) {
            setIsSubmitting(true);
            try {
                await deleteCategory(categoryToDelete.id);
                setDeleteModalOpen(false);
                setCategoryToDelete(null);
            } catch (err) {
                logger.error('Error deleting category:', err);
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    const closeFormModal = () => {
        setShowFormModal(false);
        setEditingCategory(null);
        setSelectedColor('#3b82f6');
        reset();
    };

    // Module name for labels
    const moduleName = originModule === 'pharmacy' ? 'Farmácia' : '';

    const categoryColumns: ColumnDef<Category, unknown>[] = [
        {
            accessorKey: 'code',
            header: 'Codigo',
            cell: ({ row }) => (
                <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                    {row.original.code}
                </span>
            ),
        },
        {
            accessorKey: 'name',
            header: 'Nome',
            cell: ({ row }) => (
                <div className="flex items-center gap-3">
                    <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${row.original.color}20` }}
                    >
                        <HiOutlineTag
                            className="w-4 h-4"
                            style={{ color: row.original.color }}
                        />
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">
                        {row.original.name}
                    </span>
                </div>
            ),
        },
        {
            accessorKey: 'description',
            header: 'Descricao',
            cell: ({ row }) => (
                <span className="block max-w-xs truncate text-sm text-gray-600 dark:text-gray-400">
                    {row.original.description || '-'}
                </span>
            ),
        },
        {
            accessorKey: 'productCount',
            header: 'Produtos',
            cell: ({ row }) => (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                    {row.original.productCount || 0}
                </span>
            ),
        },
        {
            accessorKey: 'color',
            header: 'Cor',
            cell: ({ row }) => (
                <div
                    className="w-6 h-6 rounded-full mx-auto border-2 border-white dark:border-dark-600 shadow-sm"
                    style={{ backgroundColor: row.original.color }}
                    title={colorOptions.find((c) => c.value === row.original.color)?.label || 'Cor'}
                />
            ),
        },
        {
            accessorKey: 'isActive',
            header: 'Status',
            cell: ({ row }) => (
                <span className={cn(
                    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                    row.original.isActive
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                )}>
                    {row.original.isActive ? 'Activa' : 'Inactiva'}
                </span>
            ),
        },
        {
            id: 'actions',
            header: () => <span className="block text-right">Accoes</span>,
            cell: ({ row }) => (
                <div className="flex gap-2 justify-end">
                    <Button variant="ghost"
                        onClick={() => handleEdit(row.original)}
                        className="p-2 rounded-lg bg-blue-50/50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all border border-blue-100/50 dark:border-blue-500/20 shadow-sm"
                        title="Editar"
                    >
                        <HiOutlinePencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost"
                        onClick={() => {
                            setCategoryToDelete(row.original);
                            setDeleteModalOpen(true);
                        }}
                        className="p-2 rounded-lg bg-red-50/50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all border border-red-100/50 dark:border-red-500/20 shadow-sm"
                        title="Excluir"
                    >
                        <HiOutlineTrash className="w-4 h-4" />
                    </Button>
                </div>
            ),
        },
    ];

    // Loading state
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <p className="text-red-500">{error}</p>
                <Button onClick={() => refetch()}>
                    <HiOutlineArrowPath className="w-5 h-5 mr-2" />
                    Tentar Novamente
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {!hideHeader && (
                <PageHeader
                    title={`Categorias ${moduleName}`}
                    subtitle={`Gestão de categorias de produtos ${moduleName ? 'da ' + moduleName : ''}`}
                    icon={<HiOutlineTag className="text-primary-600 dark:text-primary-400" />}
                    actions={
                        <Button 
                            size="sm"
                            className="font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary-500/20"
                            onClick={() => setShowFormModal(true)} 
                            leftIcon={<HiOutlinePlus className="w-4 h-4" />}
                        >
                            Nova Categoria
                        </Button>
                    }
                />
            )}

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricCard
                    label="Total Categorias"
                    value={metrics.total}
                    color="primary"
                    icon={<HiOutlineTag className="w-5 h-5" />}
                />
                <MetricCard
                    label="Categorias Activas"
                    value={metrics.active}
                    color="success"
                    icon={<HiOutlineTag className="w-5 h-5" />}
                    badge={<span className="text-[9px] font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-tight">Em Uso</span>}
                />
                <MetricCard
                    label="Total Produtos"
                    value={metrics.totalProducts}
                    color="blue"
                    icon={<HiOutlineCube className="w-5 h-5" />}
                />
            </div>

            {/* Category Table */}
            <SmartTable
                data={paginatedCategories}
                columns={categoryColumns}
                search={{
                    value: search,
                    onChange: setSearch,
                    placeholder: 'Buscar categorias...',
                }}
                pagination={{
                    currentPage,
                    totalItems,
                    itemsPerPage,
                    onPageChange: setCurrentPage,
                    onItemsPerPageChange: setItemsPerPage,
                }}
                onRefresh={() => refetch()}
                emptyTitle="Nenhuma categoria encontrada"
                emptyDescription="Tente ajustar a busca ou crie uma nova categoria."
                onEmptyAction={() => setShowFormModal(true)}
                emptyActionLabel="Nova Categoria"
                minHeight="420px"
            />

            {/* Category Form Modal */}
            <Modal
                isOpen={showFormModal}
                onClose={closeFormModal}
                title={editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
                size="md"
            >
                <form onSubmit={handleSubmit(onSubmit as never)} className="space-y-6">
                    <Input
                        label="Nome da Categoria *"
                        {...register('name')}
                        error={errors.name?.message}
                        placeholder="Ex: Electrónicos"
                    />

                    <Input
                        label="Descrição"
                        {...register('description')}
                        placeholder="Descrição da categoria"
                    />

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            <HiOutlineSwatch className="w-4 h-4 inline mr-1 text-primary-500" />
                            Cor da Categoria
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {colorOptions.map((color) => (
                                <Button variant="ghost"
                                    key={color.value}
                                    type="button"
                                    onClick={() => setSelectedColor(color.value)}
                                    className={cn(
                                        'w-10 h-10 rounded-lg transition-all',
                                        selectedColor === color.value
                                            ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-dark-800'
                                            : 'hover:scale-110'
                                    )}
                                    style={{ backgroundColor: color.value }}
                                    title={color.label}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-dark-700">
                        <Button type="button" variant="ghost" onClick={closeFormModal} disabled={isSubmitting}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Salvando...' : editingCategory ? 'Actualizar' : 'Criar Categoria'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                title="Confirmar Exclusão"
                size="sm"
            >
                <div className="space-y-4">
                    <p className="text-gray-600 dark:text-gray-300">
                        Tem certeza que deseja excluir a categoria <strong>{categoryToDelete?.name}</strong>?
                    </p>
                    {categoryToDelete && (categoryToDelete.productCount || 0) > 0 && (
                        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                            <p className="text-sm text-yellow-700 dark:text-yellow-400">
                                � ️ Esta categoria possui {categoryToDelete.productCount} produtos associados.
                            </p>
                        </div>
                    )}
                    <div className="flex gap-3 justify-end">
                        <Button variant="ghost" onClick={() => setDeleteModalOpen(false)} disabled={isSubmitting}>
                            Cancelar
                        </Button>
                        <Button variant="danger" onClick={handleDelete} disabled={isSubmitting}>
                            {isSubmitting ? 'Excluindo...' : 'Excluir'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
