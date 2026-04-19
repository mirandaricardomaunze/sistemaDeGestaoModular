import { logger } from '../../utils/logger';
import { useState, useMemo } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    createColumnHelper,
    type SortingState,
} from '@tanstack/react-table';
import {
    HiOutlineMagnifyingGlass,
    HiOutlinePencilSquare,
    HiOutlineTrash,
    HiOutlinePlus,
    HiOutlineEnvelope,
    HiOutlinePhone,
    HiOutlineArrowPath,
} from 'react-icons/hi2';
import { useEmployees } from '../../hooks/useData';
import { Button, Card, Input, Select, Modal, Badge, Pagination, DataTable } from '../ui';
import { ExportEmployeesButton } from '../common/ExportButton';
import { formatCurrency, cn } from '../../utils/helpers';
import { roleLabels } from '../../utils/constants';
import type { Employee, EmployeeRole } from '../../types';

import toast from 'react-hot-toast';

const columnHelper = createColumnHelper<Employee>();

interface EmployeeListProps {
    onEdit?: (employee: Employee) => void;
    onAddEmployee?: () => void;
    department?: string;
    hideHeader?: boolean;
}

export default function EmployeeList({ onEdit, onAddEmployee, department, hideHeader: _hideHeader }: EmployeeListProps) {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [selectedRole, setSelectedRole] = useState<EmployeeRole | 'all'>('all');
    const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'inactive'>('all');

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [employeeToToggle, setEmployeeToToggle] = useState<Employee | null>(null);

    // Use API hooks with pagination and filters
    const { employees: employeesData, pagination, isLoading, refetch, updateEmployee } = useEmployees({
        search: globalFilter,
        role: selectedRole === 'all' ? undefined : selectedRole,
        department,
        isActive: selectedStatus === 'all' ? undefined : (selectedStatus === 'active'),
        page,
        limit: pageSize,
        sortBy: sorting[0]?.id || 'name',
        sortOrder: sorting[0]?.desc ? 'desc' : 'asc'
    });
    const employees = Array.isArray(employeesData) ? employeesData : [];

    const handleToggleStatus = (employee: Employee) => {
        setEmployeeToToggle(employee);
        setDeleteModalOpen(true);
    };

    const confirmToggleStatus = async () => {
        if (employeeToToggle) {
            try {
                await updateEmployee(employeeToToggle.id, { isActive: !employeeToToggle.isActive });
                toast.success(
                    employeeToToggle.isActive
                        ? 'Funcionário desativado!'
                        : 'Funcionário ativado!'
                );
                setDeleteModalOpen(false);
                setEmployeeToToggle(null);
            } catch (error) {
                logger.error('Error toggling employee status:', error);
                toast.error('Erro ao alterar status do funcionário');
            }
        }
    };

    const getRoleBadgeVariant = (role: EmployeeRole) => {
        const variants: Record<EmployeeRole, 'primary' | 'success' | 'warning' | 'info' | 'gray' | 'danger'> = {
            super_admin: 'danger',
            admin: 'primary',
            manager: 'success',
            operator: 'info',
            cashier: 'warning',
            stock_keeper: 'gray',
        };
        return variants[role];
    };

    const columns = useMemo(
        () => [
            columnHelper.accessor('name', {
                header: 'Colaborador',
                cell: (info) => (
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                                {info.getValue()
                                    .split(' ')
                                    .map((n) => n[0])
                                    .slice(0, 2)
                                    .join('')}
                            </span>
                        </div>
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">{info.getValue()}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{info.row.original.code}</p>
                        </div>
                    </div>
                ),
            }),
            columnHelper.accessor('role', {
                header: 'Cargo',
                cell: (info) => (
                    <Badge variant={getRoleBadgeVariant(info.getValue())} size="sm">
                        {roleLabels[info.getValue()]}
                    </Badge>
                ),
            }),
            columnHelper.accessor('department', {
                header: 'Departamento',
                cell: (info) => (
                    <span className="text-sm text-gray-600 dark:text-gray-400">{info.getValue()}</span>
                ),
            }),
            columnHelper.display({
                id: 'contact',
                header: 'Contacto',
                cell: ({ row }) => (
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium tracking-tight">
                            <HiOutlineEnvelope className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                            <span className="truncate max-w-[150px] font-medium">{row.original.email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium tracking-tight">
                            <HiOutlinePhone className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                            <span className="font-medium">{row.original.phone}</span>
                        </div>
                    </div>
                ),
            }),
            columnHelper.accessor('salary', {
                header: 'Salário',
                cell: (info) => (
                    <span className="font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(info.getValue())}
                    </span>
                ),
            }),
            columnHelper.accessor('isActive', {
                header: 'Status',
                cell: (info) => (
                    <Badge variant={info.getValue() ? 'success' : 'gray'} size="sm">
                        {info.getValue() ? 'Ativo' : 'Inativo'}
                    </Badge>
                ),
            }),
            columnHelper.display({
                id: 'actions',
                header: 'Ações',
                cell: ({ row }) => (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => onEdit?.(row.original)}
                            className="p-2 rounded-lg bg-slate-50 dark:bg-dark-700 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-slate-400 hover:text-primary-600 transition-all border border-slate-100 dark:border-dark-600 hover:border-primary-200"
                            title="Editar"
                        >
                            <HiOutlinePencilSquare className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => handleToggleStatus(row.original)}
                            className={cn(
                                "p-2 rounded-lg transition-all border",
                                row.original.isActive 
                                    ? "bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 text-red-400 hover:text-red-600 hover:bg-red-50" 
                                    : "bg-green-50/50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30 text-green-400 hover:text-green-600 hover:bg-green-50"
                            )}
                            title={row.original.isActive ? 'Desativar' : 'Ativar'}
                        >
                            <HiOutlineTrash className="w-4 h-4" />
                        </button>
                    </div>
                ),
            }),
        ],
        [onEdit]
    );

    const table = useReactTable({
        data: employees,
        columns,
        state: {
            sorting,
            globalFilter,
        },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        manualPagination: true,
        manualFiltering: true,
        manualSorting: true,
    });

    const roleOptions = [
        { value: 'all', label: 'Todos os cargos' },
        ...Object.entries(roleLabels).map(([value, label]) => ({ value, label })),
    ];

    const statusOptions = [
        { value: 'all', label: 'Todos o status' },
        { value: 'active', label: 'Ativos' },
        { value: 'inactive', label: 'Inativos' },
    ];

    // Loading and Empty logic handled by DataTable

    return (
        <div className="space-y-4">
            {/* Filters */}
            <Card padding="md">
                <div className="flex flex-col lg:flex-row gap-4">
                    <div className="flex-1">
                        <Input
                            placeholder="Buscar colaboradores..."
                            value={globalFilter ?? ''}
                            onChange={(e) => setGlobalFilter(e.target.value)}
                            leftIcon={<HiOutlineMagnifyingGlass className="w-5 h-5" />}
                        />
                    </div>
                    <div className="w-full lg:w-48">
                        <Select
                            options={roleOptions}
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value as EmployeeRole | 'all')}
                        />
                    </div>
                    <div className="w-full lg:w-40">
                        <Select
                            options={statusOptions}
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value as 'all' | 'active' | 'inactive')}
                        />
                    </div>
                    <Button
                        variant="ghost"
                        onClick={() => refetch()}
                        leftIcon={<HiOutlineArrowPath className="w-5 h-5" />}
                        className="font-bold text-[11px] uppercase tracking-widest"
                    >
                        Atualizar
                    </Button>
                    <ExportEmployeesButton data={employees} />
                    <Button 
                        leftIcon={<HiOutlinePlus className="w-5 h-5" />} 
                        onClick={onAddEmployee}
                        className="shadow-lg shadow-primary-500/20 font-black text-[11px] uppercase tracking-widest px-6"
                    >
                        Admitir Colaborador
                    </Button>
                </div>
            </Card>

            {/* Table */}
            <Card padding="none" className="overflow-hidden border border-slate-100 dark:border-dark-700">
                <DataTable
                    table={table}
                    isLoading={isLoading}
                    isEmpty={employees.length === 0}
                    emptyTitle="Nenhum colaborador encontrado"
                    emptyDescription="Tente ajustar sua busca ou adicione um novo colaborador."
                    onEmptyAction={onAddEmployee}
                    emptyActionLabel="Adicionar Colaborador"
                    minHeight="450px"
                />
            </Card>

            {/* Pagination */}
            <div className="px-6 pb-4">
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
                    showInfo={true}
                    showItemsPerPage={true}
                />
            </div>

            {/* Toggle Status Modal */}
            <Modal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                title={employeeToToggle?.isActive ? 'Desativar Funcionário' : 'Ativar Funcionário'}
                size="sm"
            >
                <div className="space-y-4">
                    <p className="text-gray-600 dark:text-gray-300">
                        {employeeToToggle?.isActive
                            ? 'Tem certeza que deseja desativar o funcionário '
                            : 'Tem certeza que deseja ativar o funcionário '}
                        <strong className="text-gray-900 dark:text-white">
                            {employeeToToggle?.name}
                        </strong>
                        ?
                    </p>
                    <div className="flex gap-3 justify-end">
                        <Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button
                            variant={employeeToToggle?.isActive ? 'danger' : 'primary'}
                            onClick={confirmToggleStatus}
                        >
                            {employeeToToggle?.isActive ? 'Desativar' : 'Ativar'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

