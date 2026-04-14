import { logger } from '../utils/logger';
﻿import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    HiOutlinePlus,
    HiOutlineMagnifyingGlass,
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlineTruck,
    HiOutlinePhone,
    HiOutlineMail,
    HiOutlineCurrencyDollar,
    HiOutlineUserCircle,
    HiOutlineCheck,
    HiOutlineXMark,
    HiOutlineArrowPath
} from 'react-icons/hi2';
import { Card, Button, Input, Select, Modal, Badge, Pagination, TableContainer, PageHeader } from '../components/ui';
import { StatCard } from '../components/common/ModuleMetricCard';
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

interface SuppliersProps {
    hideHeader?: boolean;
}

export default function Suppliers({ hideHeader = false }: SuppliersProps) {
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
            logger.error('Error saving supplier:', err);
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
                logger.error('Error deleting supplier:', err);
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
            {!hideHeader && (
                <PageHeader 
                    title="Gestão de Fornecedores"
                    subtitle="Controlo de Entidades, Contactos e Encomendas de Compra"
                    icon={<HiOutlineTruck />}
                    actions={
                        <>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="font-black text-[10px] uppercase tracking-widest text-gray-400 hover:text-blue-600"
                                leftIcon={<HiOutlineArrowPath className="w-4 h-4" />} 
                                onClick={() => refetch()}
                            >
                                Actualizar
                            </Button>
                            {activeTab === 'directory' && (
                                <>
                                    <ExportSuppliersButton data={suppliers} />
                                    <Button 
                                        size="sm"
                                        className="font-black text-[10px] uppercase tracking-widest"
                                        onClick={() => setShowFormModal(true)}
                                        leftIcon={<HiOutlinePlus className="w-4 h-4" />}
                                    >
                                        Novo Fornecedor
                                    </Button>
                                </>
                            )}
                        </>
                    }
                    tabs={
                        <div className="flex flex-wrap -mb-px">
                            {[
                                { id: 'directory', label: 'Diretório', icon: <HiOutlineTruck className="w-5 h-5" /> },
                                { id: 'orders', label: 'Encomendas', icon: <HiOutlineCurrencyDollar className="w-5 h-5" /> }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 px-2 md:px-6 py-4 text-xs md:text-sm font-black border-b-2 transition-all whitespace-nowrap uppercase tracking-widest",
                                        activeTab === tab.id
                                            ? "border-primary-500 text-primary-600 dark:text-primary-400"
                                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:hover:text-gray-300 dark:hover:border-dark-600"
                                    )}
                                >
                                    <span className="shrink-0">{tab.icon}</span>
                                    <span className="hidden sm:inline-block">{tab.label}</span>
                                    <span className="sm:hidden text-[10px]">{tab.label.substring(0, 3)}...</span>
                                </button>
                            ))}
                        </div>
                    }
                />
                {activeTab === 'directory' ? (
                <>
                    {/* Metrics Layer - Standardized */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard 
                            label="Total Fornecedores"
                            value={metrics.total}
                            icon={<HiOutlineTruck className="w-6 h-6" />}
                            color="primary"
                        />
                        <StatCard 
                            label="Total Compras"
                            value={formatCurrency(metrics.totalPurchases)}
                            icon={<HiOutlineCurrencyDollar className="w-6 h-6" />}
                            color="green"
                            sublabel="Volume total de aquisições"
                        />
                        <StatCard 
                            label="Saldo Pendente"
                            value={formatCurrency(metrics.totalBalance)}
                            icon={<HiOutlineCurrencyDollar className="w-6 h-6" />}
                            color="yellow"
                            sublabel="Total em dívida a fornecedores"
                        />
                        <StatCard 
                            label="Fornecedores Activos"
                            value={metrics.active}
                            icon={<HiOutlineTruck className="w-6 h-6" />}
                            color="blue"
                        />
                    </div>

                    {/* Filters Bar - High Density */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                        <Card padding="md" className="md:col-span-12 border-none shadow-none bg-gray-100/50 dark:bg-dark-800/50">
                            <div className="flex items-center gap-3">
                                <div className="relative flex-1">
                                    <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 z-10" />
                                    <Input
                                        placeholder="Buscar fornecedores por nome, NUIT ou contacto..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="pl-10 bg-white dark:bg-dark-900 border-none shadow-sm h-10 text-sm font-medium"
                                    />
                                </div>
                            </div>
                        </Card>
                    </div>

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
