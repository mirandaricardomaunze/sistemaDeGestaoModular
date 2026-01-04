import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    HiOutlinePlus,
    HiOutlineSearch,
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlineTag,
    HiOutlineColorSwatch,
    HiOutlineCube,
    HiOutlineRefresh,
} from 'react-icons/hi';
import { Card, Button, Input, Modal, Pagination, usePagination, LoadingSpinner } from '../../components/ui';
import { cn } from '../../utils/helpers';
import type { Category } from '../../types';
import { useCategories } from '../../hooks/useData';

/**
 * PharmacyCategories Component
 * 
 * Complete category management system for pharmacy module.
 * Reuses the same data hooks and patterns as the commercial module
 * for consistency and maintainability.
 * 
 * Features:
 * - Metrics dashboard with KPIs
 * - Advanced search and filtering
 * - Pagination
 * - Color-coded categories
 * - Full CRUD operations with validation
 */

// Validation Schema
const categorySchema = z.object({
    name: z.string().min(2, 'Nome é obrigatório'),
    description: z.string().optional(),
    color: z.string().optional(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

// Predefined colors for pharmacy categories
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

export default function PharmacyCategories() {
    // Use API hook for real data
    const {
        categories,
        isLoading,
        error,
        refetch,
        addCategory,
        updateCategory,
        deleteCategory
    } = useCategories();

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
    } = usePagination(filteredCategories, 9);

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
                });
            }
            closeFormModal();
        } catch (err) {
            console.error('Error saving category:', err);
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
                console.error('Error deleting category:', err);
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
                    <HiOutlineRefresh className="w-5 h-5 mr-2" />
                    Tentar Novamente
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Categorias - Farmácia</h1>
                    <p className="text-gray-500 dark:text-gray-400">Gestão de categorias de produtos farmacêuticos</p>
                </div>
                <Button onClick={() => setShowFormModal(true)}>
                    <HiOutlinePlus className="w-5 h-5 mr-2" />
                    Nova Categoria
                </Button>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card padding="md" className="border-l-4 border-l-primary-500">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                            <HiOutlineTag className="w-6 h-6 text-primary-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Total Categorias</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{metrics.total}</p>
                        </div>
                    </div>
                </Card>

                <Card padding="md" className="border-l-4 border-l-green-500">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <HiOutlineTag className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Categorias Activas</p>
                            <p className="text-2xl font-bold text-green-600">{metrics.active}</p>
                        </div>
                    </div>
                </Card>

                <Card padding="md" className="border-l-4 border-l-blue-500">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <HiOutlineCube className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Total Produtos</p>
                            <p className="text-2xl font-bold text-blue-600">{metrics.totalProducts}</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Search */}
            <Card padding="md">
                <Input
                    placeholder="Buscar categorias..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    leftIcon={<HiOutlineSearch className="w-5 h-5" />}
                />
            </Card>

            {/* Category Table */}
            <Card padding="none">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-dark-700">
                            <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                <th className="px-6 py-4 font-medium">Código</th>
                                <th className="px-6 py-4 font-medium">Nome</th>
                                <th className="px-6 py-4 font-medium">Descrição</th>
                                <th className="px-6 py-4 font-medium text-center">Produtos</th>
                                <th className="px-6 py-4 font-medium text-center">Cor</th>
                                <th className="px-6 py-4 font-medium text-center">Status</th>
                                <th className="px-6 py-4 font-medium text-right">Acções</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                            {filteredCategories.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                        Nenhuma categoria encontrada
                                    </td>
                                </tr>
                            ) : paginatedCategories.map((category) => (
                                <tr
                                    key={category.id}
                                    className="hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors"
                                >
                                    <td className="px-6 py-4">
                                        <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                                            {category.code}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                                style={{ backgroundColor: `${category.color}20` }}
                                            >
                                                <HiOutlineTag
                                                    className="w-4 h-4"
                                                    style={{ color: category.color }}
                                                />
                                            </div>
                                            <span className="font-medium text-gray-900 dark:text-white">
                                                {category.name}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">
                                            {category.description || '-'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                            {category.productCount || 0}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div
                                            className="w-6 h-6 rounded-full mx-auto border-2 border-white dark:border-dark-600 shadow-sm"
                                            style={{ backgroundColor: category.color }}
                                            title={colorOptions.find((c) => c.value === category.color)?.label || 'Cor'}
                                        />
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={cn(
                                            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                                            category.isActive
                                                ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                        )}>
                                            {category.isActive ? 'Activa' : 'Inactiva'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-1 justify-end">
                                            <button
                                                onClick={() => handleEdit(category)}
                                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-600 text-gray-500 hover:text-primary-600 transition-colors"
                                                title="Editar"
                                            >
                                                <HiOutlinePencil className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setCategoryToDelete(category);
                                                    setDeleteModalOpen(true);
                                                }}
                                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-600 text-gray-500 hover:text-red-600 transition-colors"
                                                title="Excluir"
                                            >
                                                <HiOutlineTrash className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {/* Pagination */}
                <div className="px-6 py-4 border-t border-gray-100 dark:border-dark-700">
                    <Pagination
                        currentPage={currentPage}
                        totalItems={totalItems}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={setItemsPerPage}
                        itemsPerPageOptions={[10, 20, 50, 100]}
                    />
                </div>
            </Card>

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
                        placeholder="Ex: Medicamentos, Suplementos"
                    />

                    <Input
                        label="Descrição"
                        {...register('description')}
                        placeholder="Descrição da categoria"
                    />

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            <HiOutlineColorSwatch className="w-4 h-4 inline mr-1" />
                            Cor da Categoria
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {colorOptions.map((color) => (
                                <button
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
                                ⚠️ Esta categoria possui {categoryToDelete.productCount} produtos associados.
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
