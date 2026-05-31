import { logger } from '../utils/logger';
import { useState, useMemo, useEffect } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    HiOutlinePlus,
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlineUser,
    HiOutlineBuildingOffice,
    HiOutlinePhone,
    HiOutlineEnvelope,
    HiOutlineCurrencyDollar,
    HiOutlineArrowPath,
    HiOutlineUsers,
    HiOutlineEye
} from 'react-icons/hi2';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { Badge, type BadgeVariant } from '../components/ui/Badge';
import { PageHeader } from '../components/ui/PageHeader';
import { SmartTable } from '../components/ui/SmartTable';
import { MetricCard } from '../components/common/ModuleMetricCard';
import { ExportCustomersButton } from '../components/common/ExportButton';
import { formatCurrency, cn } from '../utils/helpers';
import { PAGE_SIZE } from '../utils/constants';
import type { Customer, CustomerType } from '../types';
import { useCustomers } from '../hooks/useData';
import { useDebounce } from '../hooks/useDebounce';
import { Customer360Modal } from '../components/crm/Customer360Modal';

// Validation Schema
const customerSchema = z.object({
    name: z.string().min(2, 'Nome é obrigatório'),
    type: z.enum(['individual', 'company']),
    email: z.string().email('Email inválido').optional().or(z.literal('')),
    phone: z.string().min(9, 'Telefone inválido'),
    document: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    province: z.string().optional(),
    notes: z.string().optional(),
    creditLimit: z.coerce.number().min(0).optional(),
});

type CustomerFormData = z.infer<typeof customerSchema>;

const typeConfig: Record<CustomerType, { label: string; icon: typeof HiOutlineUser; color: BadgeVariant }> = {
    individual: { label: 'Pessoa Física', icon: HiOutlineUser, color: 'primary' },
    company: { label: 'Empresa', icon: HiOutlineBuildingOffice, color: 'info' },
};

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

interface CustomersProps {
    originModule?: string;
}

export default function Customers({ originModule }: CustomersProps) {
    const [searchParams] = useSearchParams();
    const [page, setPage] = useState(1);
    const [pageSize] = useState(PAGE_SIZE);
    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [typeFilter, setTypeFilter] = useState<CustomerType | 'all'>((searchParams.get('type') as CustomerType) || 'all');

    useEffect(() => {
        const searchParam = searchParams.get('search');
        if (searchParam !== null) setSearch(searchParam);

        const typeParam = searchParams.get('type');
        if (typeParam !== null) setTypeFilter(typeParam as CustomerType | 'all');
    }, [searchParams]);

    // Use API hook for real data with pagination
    const {
        customers,
        pagination,
        isLoading,
        error,
        refetch,
        addCustomer,
        updateCustomer,
        deleteCustomer
    } = useCustomers({
        search: useDebounce(search, 350),
        type: typeFilter === 'all' ? undefined : typeFilter,
        page,
        limit: pageSize,
        originModule,
    });
    useTranslation();

    const [showFormModal, setShowFormModal] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 360 Modal State
    const [show360Modal, setShow360Modal] = useState(false);
    const [customer360, setCustomer360] = useState<Customer | null>(null);

    const {
        register,
        handleSubmit,
        reset,
        watch,
        formState: { errors },
    } = useForm<CustomerFormData>({
        resolver: zodResolver(customerSchema) as never,
        defaultValues: {
            name: '',
            type: 'individual',
            email: '',
            phone: '',
            document: '',
            address: '',
            city: '',
            province: '',
            notes: '',
            creditLimit: 0,
        },
    });

    const selectedType = watch('type');

    // Metrics (Based on current page records for now)
    const metrics = useMemo(() => {
        const total = pagination?.total || customers.length;
        const active = customers.filter((c) => c.isActive).length;
        const individuals = customers.filter((c) => c.type === 'individual').length;
        const companies = customers.filter((c) => c.type === 'company').length;
        const totalPurchases = customers.reduce((sum, c) => sum + (c.totalPurchases || 0), 0);
        const totalBalance = customers.reduce((sum, c) => sum + (c.currentBalance || 0), 0);
        return { total, active, individuals, companies, totalPurchases, totalBalance };
    }, [customers, pagination?.total]);

    const onSubmit = async (data: CustomerFormData) => {
        setIsSubmitting(true);
        try {
            if (editingCustomer) {
                await updateCustomer(editingCustomer.id, {
                    name: data.name,
                    type: data.type,
                    email: data.email || undefined,
                    phone: data.phone,
                    document: data.document || undefined,
                    address: data.address || undefined,
                    city: data.city || undefined,
                    province: data.province || undefined,
                    notes: data.notes || undefined,
                    creditLimit: data.creditLimit || undefined,
                });
            } else {
                await addCustomer({
                    name: data.name,
                    type: data.type,
                    email: data.email || undefined,
                    phone: data.phone,
                    document: data.document || undefined,
                    address: data.address || undefined,
                    city: data.city || undefined,
                    province: data.province || undefined,
                    notes: data.notes || undefined,
                    creditLimit: data.creditLimit || undefined,
                });
            }
            closeFormModal();
        } catch (err) {
            logger.error('Error saving customer:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (customer: Customer) => {
        setEditingCustomer(customer);
        reset({
            name: customer.name,
            type: customer.type,
            email: customer.email || '',
            phone: customer.phone,
            document: customer.document || '',
            address: customer.address || '',
            city: customer.city || '',
            province: customer.province || '',
            notes: customer.notes || '',
            creditLimit: customer.creditLimit || 0,
        });
        setShowFormModal(true);
    };

    const handleDelete = async () => {
        if (customerToDelete) {
            setIsSubmitting(true);
            try {
                await deleteCustomer(customerToDelete.id);
                setDeleteModalOpen(false);
                setCustomerToDelete(null);
            } catch (err) {
                logger.error('Error deleting customer:', err);
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    const closeFormModal = () => {
        setShowFormModal(false);
        setEditingCustomer(null);
        reset();
    };

    const typeOptions = [
        { value: 'all', label: 'Todos os Tipos' },
        { value: 'individual', label: 'Pessoa Física' },
        { value: 'company', label: 'Empresa' },
    ];

    const customerColumns: ColumnDef<Customer, unknown>[] = [
        {
            accessorKey: 'name',
            header: 'Cliente',
            cell: ({ row }) => {
                const customer = row.original;
                const TypeIcon = typeConfig[customer.type].icon;

                return (
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                            <TypeIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div className="min-w-[160px]">
                            <p className="font-medium text-gray-900 dark:text-white whitespace-nowrap">{customer.name}</p>
                            <p className="text-xs text-gray-500 font-mono whitespace-nowrap">{customer.code}</p>
                        </div>
                    </div>
                );
            },
        },
        {
            accessorKey: 'type',
            header: 'Tipo',
            cell: ({ row }) => (
                <Badge variant={typeConfig[row.original.type].color}>
                    {typeConfig[row.original.type].label}
                </Badge>
            ),
        },
        {
            accessorKey: 'phone',
            header: 'Contacto',
            cell: ({ row }) => (
                <div className="space-y-1 min-w-[150px]">
                    <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        <HiOutlinePhone className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                        <span>{row.original.phone}</span>
                    </div>
                    {row.original.email && (
                        <div className="flex items-center gap-1 text-sm text-gray-500 whitespace-nowrap">
                            <HiOutlineEnvelope className="w-4 h-4 text-primary-500/70" />
                            <span className="truncate max-w-[150px]">{row.original.email}</span>
                        </div>
                    )}
                </div>
            ),
        },
        {
            accessorKey: 'city',
            header: 'Localizacao',
            cell: ({ row }) => {
                const customer = row.original;

                return (
                    <span className="text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {customer.city && customer.province
                            ? `${customer.city}, ${customer.province}`
                            : customer.city || customer.province || '-'}
                    </span>
                );
            },
        },
        {
            accessorKey: 'loyaltyPoints',
            header: 'Pontos',
            cell: ({ row }) => (
                <Badge variant="warning" size="sm">
                    {row.original.loyaltyPoints || 0} pts
                </Badge>
            ),
        },
        {
            accessorKey: 'totalPurchases',
            header: () => <span className="block text-right">Total Compras</span>,
            cell: ({ row }) => (
                <span className="block text-right font-semibold text-green-600">
                    {formatCurrency(row.original.totalPurchases)}
                </span>
            ),
        },
        {
            id: 'actions',
            header: () => <span className="block text-center">Acoes</span>,
            cell: ({ row }) => {
                const customer = row.original;

                return (
                    <div className="flex justify-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setCustomer360(customer);
                                setShow360Modal(true);
                            }}
                            className="p-2 rounded-lg bg-indigo-50/50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all border border-indigo-100/50 dark:border-indigo-500/20 shadow-sm"
                            title="Perfil 360"
                        >
                            <HiOutlineEye className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(customer)}
                            className="p-2 rounded-lg bg-blue-50/50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all border border-blue-100/50 dark:border-blue-500/20 shadow-sm"
                            title="Editar"
                        >
                            <HiOutlinePencil className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setCustomerToDelete(customer);
                                setDeleteModalOpen(true);
                            }}
                            className="p-2 rounded-lg bg-red-50/50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all border border-red-100/50 dark:border-red-500/20 shadow-sm"
                            title="Excluir"
                        >
                            <HiOutlineTrash className="w-4 h-4" />
                        </Button>
                    </div>
                );
            },
        },
    ];

    // Loading and error states handled by SmartTable

    return (
        <div className="space-y-6">
            <PageHeader 
                title={`Gestão de Clientes ${originModule === 'pharmacy' ? 'Farmácia' : ''}`}
                subtitle={`Controlo de Entidades ${originModule === 'pharmacy' ? 'da Farmácia' : ''}, Histórico de Vendas e CRM`}
                icon={<HiOutlineUsers className="text-primary-600 dark:text-primary-400" />}
                actions={
                    <>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="font-black text-[10px] uppercase tracking-widest text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10"
                            leftIcon={<HiOutlineArrowPath className="w-5 h-5" />} 
                            onClick={() => refetch()}
                        >
                            Actualizar
                        </Button>
                        <ExportCustomersButton data={customers} size="sm" className="w-full sm:w-auto" variant="outline" />
                        <Button 
                            size="sm" 
                            className="font-black text-[10px] uppercase tracking-widest"
                            leftIcon={<HiOutlinePlus className="w-5 h-5" />} 
                            onClick={() => setShowFormModal(true)}
                        >
                            Adicionar Cliente
                        </Button>
                    </>
                }
            />

            {/* Metrics Layer - Standardized */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard 
                    label="Total Clientes"
                    value={metrics.total}
                    icon={<HiOutlineUsers className="w-5 h-5" />}
                    color="primary"
                />
                <MetricCard 
                    label="Pessoas Físicas"
                    value={metrics.individuals}
                    icon={<HiOutlineUser className="w-5 h-5" />}
                    color="blue"
                />
                <MetricCard 
                    label="Empresas"
                    value={metrics.companies}
                    icon={<HiOutlineBuildingOffice className="w-5 h-5" />}
                    color="purple"
                />
                <MetricCard 
                    label="Total Compras"
                    value={formatCurrency(metrics.totalPurchases)}
                    icon={<HiOutlineCurrencyDollar className="w-5 h-5" />}
                    color="green"
                    badge={<span className="text-[9px] font-bold text-emerald-500 uppercase tracking-tight">CRM</span>}
                />
            </div>

            {/* Customer List */}
            <SmartTable
                data={customers}
                columns={customerColumns}
                isLoading={isLoading}
                isError={!!error}
                errorMessage={error || undefined}
                onRetry={() => refetch()}
                search={{
                    value: search,
                    onChange: (value) => {
                        setSearch(value);
                        setPage(1);
                    },
                    placeholder: 'Buscar clientes por nome, NUIT ou contacto...',
                }}
                renderFilters={
                    <div className="w-full lg:w-56">
                        <Select
                            options={typeOptions}
                            value={typeFilter}
                            onChange={(e) => {
                                setTypeFilter(e.target.value as CustomerType | 'all');
                                setPage(1);
                            }}
                            size="sm"
                            className="bg-white dark:bg-dark-800 font-black uppercase text-[10px] tracking-widest"
                        />
                    </div>
                }
                pagination={{
                    currentPage: page,
                    totalItems: pagination?.total || 0,
                    itemsPerPage: pageSize,
                    onPageChange: setPage,
                }}
                onRefresh={() => refetch()}
                emptyTitle="Nenhum cliente encontrado"
                emptyDescription="Tente ajustar sua busca ou adicione um novo cliente."
                onEmptyAction={() => setShowFormModal(true)}
                emptyActionLabel="Adicionar Cliente"
                minHeight="450px"
                mobileCardRender={(customer) => {
                    const TypeIcon = typeConfig[customer.type].icon;
                    return (
                        <div className="bg-white dark:bg-dark-800 rounded-xl border border-slate-200/80 dark:border-white/10 p-4 shadow-sm space-y-3">
                            {/* Header: Name + Code + Actions */}
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
                                        <TypeIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{customer.name}</p>
                                        <p className="text-[10px] text-gray-500 font-mono">{customer.code}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <Badge variant={typeConfig[customer.type].color} size="sm">
                                        {typeConfig[customer.type].label}
                                    </Badge>
                                </div>
                            </div>

                            {/* Contact Info */}
                            <div className="space-y-1.5 text-sm">
                                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                    <HiOutlinePhone className="w-4 h-4 text-primary-500 shrink-0" />
                                    <span>{customer.phone}</span>
                                </div>
                                {customer.email && (
                                    <div className="flex items-center gap-2 text-gray-500">
                                        <HiOutlineEnvelope className="w-4 h-4 text-primary-500/70 shrink-0" />
                                        <span className="truncate">{customer.email}</span>
                                    </div>
                                )}
                                {(customer.city || customer.province) && (
                                    <div className="flex items-center gap-2 text-gray-500">
                                        <span className="text-xs">📍</span>
                                        <span className="text-xs">
                                            {customer.city && customer.province
                                                ? `${customer.city}, ${customer.province}`
                                                : customer.city || customer.province}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Footer: Financial summary */}
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5">
                                <div>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Total Compras</p>
                                    <p className="text-sm font-bold text-green-600">{formatCurrency(customer.totalPurchases)}</p>
                                </div>
                                {customer.loyaltyPoints ? (
                                    <Badge variant="warning" size="sm">
                                        {customer.loyaltyPoints} pts
                                    </Badge>
                                ) : null}
                            </div>

                            {/* Actions - Full Width */}
                            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-white/5 w-full">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { setCustomer360(customer); setShow360Modal(true); }}
                                    className="flex-1 p-2 rounded-lg bg-indigo-50/50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-500/20 font-black tracking-widest text-[10px] uppercase"
                                >
                                    <HiOutlineEye className="w-4 h-4 mr-2" /> Perfil 360
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEdit(customer)}
                                    className="flex-1 p-2 rounded-lg bg-blue-50/50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100/50 dark:border-blue-500/20 font-black tracking-widest text-[10px] uppercase"
                                >
                                    <HiOutlinePencil className="w-4 h-4 mr-2" /> Editar
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { setCustomerToDelete(customer); setDeleteModalOpen(true); }}
                                    className="flex-1 p-2 rounded-lg bg-red-50/50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-100/50 dark:border-red-500/20 font-black tracking-widest text-[10px] uppercase"
                                >
                                    <HiOutlineTrash className="w-4 h-4 mr-2" /> Excluir
                                </Button>
                            </div>
                        </div>
                    );
                }}
            />

            {/* Customer Form Modal */}
            <Modal
                isOpen={showFormModal}
                onClose={closeFormModal}
                title={editingCustomer ? 'Editar Cliente' : 'Novo Cliente'}
                size="lg"
            >
                <form onSubmit={handleSubmit(onSubmit as never)} className="space-y-6">
                    {/* Type Selection */}
                    <div className="grid grid-cols-2 gap-4">
                        <label
                            className={cn(
                                'flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all',
                                selectedType === 'individual'
                                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                    : 'border-gray-200 dark:border-dark-600'
                            )}
                        >
                            <input type="radio" value="individual" {...register('type')} className="hidden" />
                            <HiOutlineUser className={cn(
                                'w-6 h-6',
                                selectedType === 'individual' ? 'text-primary-600' : 'text-gray-400'
                            )} />
                            <span className={cn(
                                'font-medium',
                                selectedType === 'individual' ? 'text-primary-600' : 'text-gray-600 dark:text-gray-400'
                            )}>
                                Pessoa Física
                            </span>
                        </label>
                        <label
                            className={cn(
                                'flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all',
                                selectedType === 'company'
                                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                    : 'border-gray-200 dark:border-dark-600'
                            )}
                        >
                            <input type="radio" value="company" {...register('type')} className="hidden" />
                            <HiOutlineBuildingOffice className={cn(
                                'w-6 h-6',
                                selectedType === 'company' ? 'text-purple-600' : 'text-gray-400'
                            )} />
                            <span className={cn(
                                'font-medium',
                                selectedType === 'company' ? 'text-purple-600' : 'text-gray-600 dark:text-gray-400'
                            )}>
                                Empresa
                            </span>
                        </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Nome *"
                            {...register('name')}
                            error={errors.name?.message}
                            placeholder={selectedType === 'company' ? 'Nome da empresa' : 'Nome completo'}
                        />
                        <Input
                            label={selectedType === 'company' ? 'NUIT' : 'BI/NUIT'}
                            {...register('document')}
                            placeholder="Número do documento"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Telefone *"
                            {...register('phone')}
                            error={errors.phone?.message}
                            placeholder="+258 84 000 0000"
                        />
                        <Input
                            label="Email"
                            type="email"
                            {...register('email')}
                            error={errors.email?.message}
                            placeholder="email@exemplo.com"
                        />
                    </div>

                    <Input
                        label="Endereço"
                        {...register('address')}
                        placeholder="Rua, número, bairro"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Cidade" {...register('city')} placeholder="Cidade" />
                        <Select
                            label="Província"
                            options={[{ value: '', label: 'Selecione...' }, ...provinceOptions]}
                            {...register('province')}
                        />
                    </div>

                    {selectedType === 'company' && (
                        <Input
                            label="Limite de Crédito"
                            type="number"
                            {...register('creditLimit')}
                            placeholder="0.00"
                        />
                    )}

                    <Input label="Observações" {...register('notes')} placeholder="Notas adicionais" />

                    <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-dark-700">
                        <Button type="button" variant="ghost" onClick={closeFormModal} disabled={isSubmitting}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Salvando...' : editingCustomer ? 'Actualizar' : 'Criar Cliente'}
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
                        Tem certeza que deseja excluir o cliente <strong>{customerToDelete?.name}</strong>?
                    </p>
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

            {/* Modal Perfil 360º */}
            <Customer360Modal 
                isOpen={show360Modal} 
                onClose={() => {
                    setShow360Modal(false);
                    setTimeout(() => setCustomer360(null), 300); // clear after animation
                }} 
                customer={customer360} 
            />
        </div >
    );
}
