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
    HiOutlineTruck,
    HiOutlinePhone,
    HiOutlineEnvelope,
    HiOutlineCurrencyDollar,
    HiOutlineUserCircle,
    HiOutlineCheck,
    HiOutlineXMark,
    HiOutlineArrowPath
} from 'react-icons/hi2';
import { Button, Input, Select, Modal, Badge, PageHeader, SmartTable } from '../components/ui';
import { MetricCard } from '../components/common/ModuleMetricCard';
import { formatCurrency, cn } from '../utils/helpers';
import type { Supplier } from '../types';
import { useSuppliers } from '../hooks/useData';
import { useDebounce } from '../hooks/useDebounce';
import { SupplierOrderManager } from '../components/suppliers';
import { ExportSuppliersButton } from '../components/common/ExportButton';
import { PAGE_SIZE } from '../utils/constants';

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
    originModule?: string;
}

export default function Suppliers({ hideHeader = false, originModule }: SuppliersProps) {
    const [page, setPage] = useState(1);
    const [pageSize] = useState(PAGE_SIZE);
    const [search, setSearch] = useState('');

    // Use API hook for real data with pagination
    const {
        suppliers,
        pagination,
        isLoading,
        refetch,
        addSupplier,
        updateSupplier,
        deleteSupplier
    } = useSuppliers({
        search: useDebounce(search, 350),
        page,
        limit: pageSize,
        originModule,
    });

    const [showFormModal, setShowFormModal] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
    const [activeTab, setActiveTab] = useState<'directory' | 'orders'>('directory');
    const [isSubmitting, setIsSubmitting] = useState(false);

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
                    ...(originModule ? { originModule } : {})
                } as any);
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

    // Module name for labels
    const moduleName = originModule === 'pharmacy' ? 'Farmácia' : '';

    const columns = useMemo<ColumnDef<any, any>[]>(() => [
        {
            accessorKey: 'name',
            header: 'Fornecedor',
            cell: ({ row }: any) => {
                const supplier = row.original;
                return (
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                            <HiOutlineTruck className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">{supplier.name}</p>
                            <p className="text-xs text-gray-500">
                                {supplier.code} {supplier.nuit && `• NUIT: ${supplier.nuit}`}
                            </p>
                        </div>
                    </div>
                );
            }
        },
        {
            accessorKey: 'phone',
            header: 'Contacto',
            cell: ({ row }: any) => {
                const supplier = row.original;
                return (
                    <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                            <HiOutlinePhone className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                            <span>{supplier.phone}</span>
                        </div>
                        {supplier.email && (
                            <div className="flex items-center gap-1 text-sm text-gray-500">
                                <HiOutlineEnvelope className="w-4 h-4 text-primary-500/70" />
                                <span className="truncate max-w-[150px]">{supplier.email}</span>
                            </div>
                        )}
                    </div>
                );
            }
        },
        {
            accessorKey: 'contactPerson',
            header: 'Pessoa de Contacto',
            cell: (info: any) => (
                info.getValue() ? (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <HiOutlineUserCircle className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                        <span>{info.getValue()}</span>
                    </div>
                ) : <span className="text-gray-400">-</span>
            )
        },
        {
            accessorKey: 'paymentTerms',
            header: 'Prazo Pagamento',
            cell: (info: any) => (
                <Badge variant="info">
                    {paymentTermsOptions.find((p) => p.value === info.getValue())?.label || '-'}
                </Badge>
            )
        },
        {
            accessorKey: 'totalPurchases',
            header: 'Total Compras',
            cell: (info: any) => (
                <span className="font-semibold text-green-600">
                    {formatCurrency(info.getValue())}
                </span>
            ),
            meta: { align: 'right' }
        },
        {
            accessorKey: 'currentBalance',
            header: 'Saldo',
            cell: (info: any) => (
                <span className="font-semibold text-yellow-600">
                    {formatCurrency(info.getValue())}
                </span>
            ),
            meta: { align: 'right' }
        },
        {
            id: 'actions',
            header: 'Ações',
            cell: ({ row }: any) => (
                <div className="flex justify-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(row.original)}
                        className="p-2 rounded-lg bg-blue-50/50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all border border-blue-100/50 dark:border-blue-500/20 shadow-sm"
                        title="Editar"
                    >
                        <HiOutlinePencil className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                             setSupplierToDelete(row.original);
                             setDeleteModalOpen(true);
                        }}
                        className="p-2 rounded-lg bg-red-50/50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all border border-red-100/50 dark:border-red-500/20 shadow-sm"
                        title="Excluir"
                    >
                        <HiOutlineTrash className="w-4 h-4" />
                    </Button>
                </div>
            ),
            meta: { align: 'center' }
        }
    ], []);

    return (
        <div className="space-y-6">
            {!hideHeader && (
                <PageHeader 
                    title={`Fornecedores ${moduleName}`}
                    subtitle={`Gestão de Entidades ${moduleName ? 'da ' + moduleName : ''} e Encomendas de Compra`}
                    icon={<HiOutlineTruck className="text-primary-600 dark:text-primary-400" />}
                    actions={
                        <>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="font-black text-[10px] uppercase tracking-widest text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10"
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
                        <nav className="flex gap-1">
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
                                            ? "border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/10 rounded-t-lg"
                                            : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-800 rounded-t-lg"
                                    )}
                                >
                                    <span className="shrink-0">{tab.icon}</span>
                                    <span className="hidden sm:inline-block">{tab.label}</span>
                                    <span className="sm:hidden text-[10px]">{tab.label.substring(0, 3)}...</span>
                                </button>
                            ))}
                        </nav>
                    }
                />
            )}
                {activeTab === 'directory' ? (
                <>
                    {/* Metrics Layer - Standardized */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <MetricCard 
                            label="Total Fornecedores"
                            value={metrics.total}
                            icon={<HiOutlineTruck className="w-5 h-5" />}
                            color="primary"
                        />
                        <MetricCard 
                            label="Total Compras"
                            value={formatCurrency(metrics.totalPurchases)}
                            icon={<HiOutlineCurrencyDollar className="w-5 h-5" />}
                            color="green"
                            badge={<span className="text-[9px] font-bold text-emerald-500 uppercase tracking-tight">Acumulado</span>}
                        />
                        <MetricCard 
                            label="Saldo Pendente"
                            value={formatCurrency(metrics.totalBalance)}
                            icon={<HiOutlineCurrencyDollar className="w-5 h-5" />}
                            color="yellow"
                            badge={<span className="text-[9px] font-bold text-amber-500 uppercase tracking-tight">A Pagar</span>}
                        />
                        <MetricCard 
                            label="Fornecedores Activos"
                            value={metrics.active}
                            icon={<HiOutlineTruck className="w-5 h-5" />}
                            color="blue"
                        />
                    </div>

                    <SmartTable
                        data={suppliers}
                        columns={columns}
                        isLoading={isLoading}
                        onRefresh={refetch}
                        search={{
                            value: search,
                            onChange: setSearch,
                            placeholder: "Buscar fornecedores por nome, NUIT ou contacto..."
                        }}
                        pagination={{
                            currentPage: page,
                            totalItems: pagination?.total || 0,
                            itemsPerPage: pageSize,
                            onPageChange: setPage
                        }}
                        exportConfig={{
                            filename: `fornecedores_${originModule || 'geral'}`,
                            title: `Relatório de Fornecedores - ${originModule ? (originModule === 'pharmacy' ? 'Farmácia' : originModule) : 'Geral'}`,
                            columns: [
                                { key: 'code', header: 'Código', width: 10 },
                                { key: 'name', header: 'Fornecedor', width: 30 },
                                { key: 'nuit', header: 'NUIT', width: 15 },
                                { key: 'phone', header: 'Telefone', width: 15 },
                                { key: 'email', header: 'Email', width: 25 },
                                { key: 'contactPerson', header: 'Pessoa de Contacto', width: 20 },
                                { key: 'paymentTerms', header: 'Prazo Pagamento', width: 15 },
                                { key: 'totalPurchases', header: 'Total Compras', format: 'currency', width: 15, align: 'right' },
                                { key: 'currentBalance', header: 'Saldo', format: 'currency', width: 15, align: 'right' }
                            ]
                        }}
                        emptyTitle="Nenhum fornecedor encontrado"
                        onEmptyAction={() => setShowFormModal(true)}
                        emptyActionLabel="Adicionar Fornecedor"
                    />
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
                            leftIcon={<HiOutlineXMark className="w-4 h-4" />}
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
                            leftIcon={<HiOutlineXMark className="w-4 h-4" />}
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
