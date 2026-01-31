import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    HiOutlinePlus,
    HiOutlineSearch,
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlineTruck,
    HiOutlinePhone,
    HiOutlineMail,
    HiOutlineCurrencyDollar,
    HiOutlineUserCircle,
    HiOutlineCheck,
    HiOutlineX
} from 'react-icons/hi';
import { Card, Button, Input, Select, Modal, Badge, Pagination, TableContainer } from '../components/ui';
import { formatCurrency, cn } from '../utils/helpers';
import type { Supplier } from '../types';
import { useSuppliers } from '../hooks/useData';
import { SupplierOrderManager } from '../components/suppliers';
import { ExportSuppliersButton } from '../components/common/ExportButton';

// Validation Schema
const supplierSchema = z.object({
    name: z.string().min(2, 'Nome é obrigatório'),
    tradeName: z.string().optional(),
    nuit: z.string().optional(),
    email: z.string().email('Email inválido').optional().or(z.literal('')),
    phone: z.string().min(9, 'Telefone inválido'),
    phone2: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    province: z.string().optional(),
    contactPerson: z.string().optional(),
    paymentTerms: z.string().optional(),
    notes: z.string().optional(),
});

type SupplierFormData = z.infer<typeof supplierSchema>;

const provinceOptions = [
    { value: 'Maputo Cidade', label: 'Maputo Cidade' },
    { value: 'Maputo Província', label: 'Maputo Província' },
    { value: 'Gaza', label: 'Gaza' },
    { value: 'Inhambane', label: 'Inhambane' },
    { value: 'Sofala', label: 'Sofala' },
    { value: 'Manica', label: 'Manica' },
    { value: 'Tete', label: 'Tete' },
    { value: 'Zambézia', label: 'Zambézia' },
    { value: 'Nampula', label: 'Nampula' },
    { value: 'Niassa', label: 'Niassa' },
    { value: 'Cabo Delgado', label: 'Cabo Delgado' },
];

const paymentTermsOptions = [
    { value: 'immediate', label: 'Pagamento Imediato' },
    { value: '15days', label: '15 Dias' },
    { value: '30days', label: '30 Dias' },
    { value: '45days', label: '45 Dias' },
    { value: '60days', label: '60 Dias' },
    { value: '90days', label: '90 Dias' },
];

export default function Suppliers() {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [search, setSearch] = useState('');

    // Use API hook for real data with pagination
    const {
        suppliers,
        pagination,
        isLoading,
        error,
        refetch,
        addSupplier,
        updateSupplier,
        deleteSupplier
    } = useSuppliers({
        search,
        page,
        limit: pageSize,
    });

    const [showFormModal, setShowFormModal] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
    const [activeTab, setActiveTab] = useState<'directory' | 'orders'>('directory');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { t } = useTranslation();

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<SupplierFormData>({
        resolver: zodResolver(supplierSchema),
        defaultValues: {
            name: '',
            tradeName: '',
            nuit: '',
            email: '',
            phone: '',
            phone2: '',
            address: '',
            city: '',
            province: '',
            contactPerson: '',
            paymentTerms: '30days',
            notes: '',
        },
    });

    // Metrics
    const metrics = useMemo(() => {
        const total = pagination?.total || suppliers.length;
        const active = suppliers.filter((s) => s.isActive).length;
        const totalPurchases = suppliers.reduce((sum, s) => sum + (s.totalPurchases || 0), 0);
        const totalBalance = suppliers.reduce((sum, s) => sum + (s.currentBalance || 0), 0);
        return { total, active, totalPurchases, totalBalance };
    }, [suppliers, pagination?.total]);

    const onSubmit = async (data: SupplierFormData) => {
        setIsSubmitting(true);
        try {
            if (editingSupplier) {
                await updateSupplier(editingSupplier.id, {
                    name: data.name,
                    tradeName: data.tradeName || undefined,
                    nuit: data.nuit || undefined,
                    email: data.email || undefined,
                    phone: data.phone,
                    phone2: data.phone2 || undefined,
                    address: data.address || undefined,
                    city: data.city || undefined,
                    province: data.province || undefined,
                    contactPerson: data.contactPerson || undefined,
                    paymentTerms: data.paymentTerms || undefined,
                    notes: data.notes || undefined,
                });
            } else {
                await addSupplier({
                    name: data.name,
                    tradeName: data.tradeName || undefined,
                    nuit: data.nuit || undefined,
                    email: data.email || undefined,
                    phone: data.phone,
                    phone2: data.phone2 || undefined,
                    address: data.address || undefined,
                    city: data.city || undefined,
                    province: data.province || undefined,
                    contactPerson: data.contactPerson || undefined,
                    paymentTerms: data.paymentTerms || undefined,
                    notes: data.notes || undefined,
                });
            }
            closeFormModal();
        } catch (err) {
            console.error('Error saving supplier:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (supplier: Supplier) => {
        setEditingSupplier(supplier);
        reset({
            name: supplier.name,
            tradeName: supplier.tradeName || '',
            nuit: supplier.nuit || '',
            email: supplier.email || '',
            phone: supplier.phone,
            phone2: supplier.phone2 || '',
            address: supplier.address || '',
            city: supplier.city || '',
            province: supplier.province || '',
            contactPerson: supplier.contactPerson || '',
            paymentTerms: supplier.paymentTerms || '30days',
            notes: supplier.notes || '',
        });
        setShowFormModal(true);
    };

    const handleDelete = async () => {
        if (supplierToDelete) {
            setIsSubmitting(true);
            try {
                await deleteSupplier(supplierToDelete.id);
                setDeleteModalOpen(false);
                setSupplierToDelete(null);
            } catch (err) {
                console.error('Error deleting supplier:', err);
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    const closeFormModal = () => {
        setShowFormModal(false);
        setEditingSupplier(null);
        reset();
    };

    // Loading and error states handled by TableContainer

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('suppliers.title')}</h1>
                    <p className="text-gray-500 dark:text-gray-400">{t('suppliers.description')}</p>
                </div>
                {activeTab === 'directory' && (
                    <div className="flex gap-2">
                        <ExportSuppliersButton data={suppliers} />
                        <Button onClick={() => setShowFormModal(true)}>
                            <HiOutlinePlus className="w-5 h-5 mr-2" />
                            {t('suppliers.newSupplier')}
                        </Button>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-dark-700">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setActiveTab('directory')}
                        className={cn(
                            'whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors',
                            activeTab === 'directory'
                                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                        )}
                    >
                        Diretório
                    </button>
                    <button
                        onClick={() => setActiveTab('orders')}
                        className={cn(
                            'whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors',
                            activeTab === 'orders'
                                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                        )}
                    >
                        Encomendas
                    </button>
                </nav>
            </div>

            {activeTab === 'directory' ? (
                <>
                    {/* Metrics */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                        <Card padding="md" className="border-l-4 border-l-primary-500">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                    <HiOutlineTruck className="w-6 h-6 text-primary-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Total Fornecedores</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{metrics.total}</p>
                                </div>
                            </div>
                        </Card>

                        <Card padding="md" className="border-l-4 border-l-green-500">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                    <HiOutlineCurrencyDollar className="w-6 h-6 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Total Compras</p>
                                    <p className="text-lg font-bold text-green-600">{formatCurrency(metrics.totalPurchases)}</p>
                                </div>
                            </div>
                        </Card>

                        <Card padding="md" className="border-l-4 border-l-yellow-500">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                                    <HiOutlineCurrencyDollar className="w-6 h-6 text-yellow-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Saldo Pendente</p>
                                    <p className="text-lg font-bold text-yellow-600">{formatCurrency(metrics.totalBalance)}</p>
                                </div>
                            </div>
                        </Card>

                        <Card padding="md" className="border-l-4 border-l-blue-500">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                    <HiOutlineTruck className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Activos</p>
                                    <p className="text-2xl font-bold text-blue-600">{metrics.active}</p>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Filters */}
                    <Card padding="md">
                        <div className="flex-1">
                            <Input
                                placeholder="Buscar fornecedores..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                leftIcon={<HiOutlineSearch className="w-5 h-5" />}
                            />
                        </div>
                    </Card>

                    {/* Supplier List */}
                    <Card padding="none">
                        <TableContainer
                            isLoading={isLoading}
                            isEmpty={suppliers.length === 0}
                            isError={!!error}
                            errorMessage={error || undefined}
                            onRetry={() => refetch()}
                            emptyTitle="Nenhum fornecedor encontrado"
                            emptyDescription="Tente ajustar sua busca ou adicione um novo fornecedor."
                            onEmptyAction={() => setShowFormModal(true)}
                            emptyActionLabel="Adicionar Fornecedor"
                            minHeight="450px"
                        >
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-700">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-dark-800">
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Fornecedor</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Contacto</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Pessoa de Contacto</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Prazo Pagamento</th>
                                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Total Compras</th>
                                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Saldo</th>
                                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                                    {suppliers.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                                Nenhum fornecedor encontrado
                                            </td>
                                        </tr>
                                    ) : (
                                        suppliers.map((supplier) => (
                                            <tr key={supplier.id} className="bg-white dark:bg-dark-900 hover:bg-gray-50 dark:hover:bg-dark-800">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                                            <HiOutlineTruck className="w-5 h-5 text-primary-600" />
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-gray-900 dark:text-white">{supplier.name}</p>
                                                            <p className="text-xs text-gray-500">
                                                                {supplier.code} {supplier.nuit && `• NUIT: ${supplier.nuit}`}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                                                            <HiOutlinePhone className="w-4 h-4" />
                                                            <span>{supplier.phone}</span>
                                                        </div>
                                                        {supplier.email && (
                                                            <div className="flex items-center gap-1 text-sm text-gray-500">
                                                                <HiOutlineMail className="w-4 h-4" />
                                                                <span className="truncate max-w-[150px]">{supplier.email}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {supplier.contactPerson ? (
                                                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                                            <HiOutlineUserCircle className="w-4 h-4" />
                                                            <span>{supplier.contactPerson}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Badge variant="info">
                                                        {paymentTermsOptions.find((p) => p.value === supplier.paymentTerms)?.label || '-'}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4 text-right font-semibold text-green-600">
                                                    {formatCurrency(supplier.totalPurchases)}
                                                </td>
                                                <td className="px-6 py-4 text-right font-semibold text-yellow-600">
                                                    {formatCurrency(supplier.currentBalance)}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex justify-center gap-1">
                                                        <button
                                                            onClick={() => handleEdit(supplier)}
                                                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-500 hover:text-primary-600"
                                                            title="Editar"
                                                        >
                                                            <HiOutlinePencil className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setSupplierToDelete(supplier);
                                                                setDeleteModalOpen(true);
                                                            }}
                                                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-500 hover:text-red-600"
                                                            title="Excluir"
                                                        >
                                                            <HiOutlineTrash className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </TableContainer>
                    </Card>

                    <div className="px-6 py-4">
                        <Pagination
                            currentPage={page}
                            totalItems={pagination?.total || 0}
                            itemsPerPage={pageSize}
                            onPageChange={setPage}
                            onItemsPerPageChange={(size) => {
                                setPageSize(size);
                                setPage(1);
                            }}
                            itemsPerPageOptions={[5, 10, 25, 50]}
                        />
                    </div>
                </>
            ) : (
                <SupplierOrderManager />
            )}

            {/* Supplier Form Modal */}
            <Modal
                isOpen={showFormModal}
                onClose={closeFormModal}
                title={editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}
                size="lg"
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Nome da Empresa *"
                            {...register('name')}
                            error={errors.name?.message}
                            placeholder="Nome legal da empresa"
                        />
                        <Input
                            label="Nome Comercial"
                            {...register('tradeName')}
                            placeholder="Nome Comercial"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="NUIT"
                            {...register('nuit')}
                            placeholder="Número de Identificação Tributária"
                        />
                        <Input
                            label="Pessoa de Contacto"
                            {...register('contactPerson')}
                            placeholder="Nome do responsável"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Telefone Principal *"
                            {...register('phone')}
                            error={errors.phone?.message}
                            placeholder="+258 21 000 000"
                        />
                        <Input
                            label="Telefone Secundário"
                            {...register('phone2')}
                            placeholder="+258 84 000 0000"
                        />
                    </div>

                    <Input
                        label="Email"
                        type="email"
                        {...register('email')}
                        error={errors.email?.message}
                        placeholder="email@empresa.co.mz"
                    />

                    <Input
                        label="Endereço"
                        {...register('address')}
                        placeholder="Rua, número, bairro"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Input label="Cidade" {...register('city')} placeholder="Cidade" />
                        <Select
                            label="Província"
                            options={[{ value: '', label: 'Selecione...' }, ...provinceOptions]}
                            {...register('province')}
                        />
                        <Select
                            label="Prazo de Pagamento"
                            options={paymentTermsOptions}
                            {...register('paymentTerms')}
                        />
                    </div>

                    <Input label="Observações" {...register('notes')} placeholder="Notas adicionais" />

                    <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-dark-700">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={closeFormModal}
                            disabled={isSubmitting}
                            leftIcon={<HiOutlineX className="w-4 h-4" />}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            leftIcon={<HiOutlineCheck className="w-4 h-4" />}
                        >
                            {isSubmitting ? 'Salvando...' : editingSupplier ? 'Actualizar' : 'Criar Fornecedor'}
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
                        Tem certeza que deseja excluir o fornecedor <strong>{supplierToDelete?.name}</strong>?
                    </p>
                    <div className="flex gap-3 justify-end">
                        <Button
                            variant="ghost"
                            onClick={() => setDeleteModalOpen(false)}
                            disabled={isSubmitting}
                            leftIcon={<HiOutlineX className="w-4 h-4" />}
                        >
                            Cancelar
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleDelete}
                            disabled={isSubmitting}
                            leftIcon={<HiOutlineTrash className="w-4 h-4" />}
                        >
                            {isSubmitting ? 'Excluindo...' : 'Excluir'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
