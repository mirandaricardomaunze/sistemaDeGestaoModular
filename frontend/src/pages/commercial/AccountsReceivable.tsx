import { useState, useCallback, useMemo } from 'react';
import {
    HiOutlineCurrencyDollar, HiOutlineArrowPath, HiOutlineExclamationCircle,
    HiOutlineCheckCircle, HiOutlineClock, HiOutlineMagnifyingGlass,
} from 'react-icons/hi2';
import type { ColumnDef } from '@tanstack/react-table';
import { Card, Badge, Input, Select, PageHeader, Button, SmartTable } from '../../components/ui';
import { StatCard } from '../../components/common/ModuleMetricCard';
import { formatCurrency, cn } from '../../utils/helpers';
import { useAccountsReceivable } from '../../hooks/useCommercial';
import type { ReceivableInvoice } from '../../services/api/commercial.api';

// ── Types ────────────────────────────────────────────────────────────────────-

type FilterOption = 'all' | 'overdue' | 'pending';

const FILTER_OPTIONS: Array<{ value: FilterOption; label: string }> = [
    { value: 'all',     label: 'Todos'         },
    { value: 'pending', label: 'Pendentes'      },
    { value: 'overdue', label: 'Em Atraso'      },
];

const STATUS_CONFIG = {
    sent:    { label: 'Pendente',    variant: 'warning' as const, icon: HiOutlineClock             },
    partial: { label: 'Parcial',     variant: 'info'    as const, icon: HiOutlineCheckCircle       },
    overdue: { label: 'Em Atraso',   variant: 'danger'  as const, icon: HiOutlineExclamationCircle },
};


// ── Main Page ────────────────────────────────────────────────────────────────-

export default function AccountsReceivable() {
    const [filter, setFilter]   = useState<FilterOption>('all');
    const [search, setSearch]   = useState('');
    const [page, setPage]       = useState(1);

    const { data, isLoading, error, refetch } = useAccountsReceivable({
        filter,
        search: search || undefined,
        page,
        limit: 20,
    });

    const invoices   = data?.data ?? [];
    const summary    = data?.summary;
    const pagination = data?.pagination;

    const handleFilterChange = useCallback((val: FilterOption) => {
        setFilter(val);
        setPage(1);
    }, []);

    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        setPage(1);
    }, []);

    const columns = useMemo<ColumnDef<ReceivableInvoice>[]>(() => [
        {
            id: 'number',
            header: 'Fatura',
            accessorKey: 'number',
            cell: ({ row }) => {
                const inv = row.original;
                const issuedAt = inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('pt-MZ') : '';
                return (
                    <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{inv.number}</p>
                        <p className="text-xs text-gray-400">{issuedAt}</p>
                    </div>
                );
            },
        },
        {
            id: 'customer',
            header: 'Cliente',
            cell: ({ row }) => {
                const inv = row.original;
                const customerName = inv.customer?.name ?? inv.customerName ?? '';
                const customerPhone = inv.customer?.phone ?? inv.customerPhone ?? '';
                return (
                    <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{customerName}</p>
                        <p className="text-xs text-gray-400">{customerPhone}</p>
                    </div>
                );
            },
        },
        {
            id: 'dueDate',
            header: 'Vencimento',
            accessorKey: 'dueDate',
            cell: ({ row }) => {
                const inv = row.original;
                const dueAt = inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('pt-MZ') : '';
                return <span className="text-sm text-gray-600 dark:text-gray-300">{dueAt}</span>;
            },
        },
        {
            id: 'total',
            header: () => <span className="block text-right">Total</span>,
            accessorKey: 'total',
            cell: ({ row }) => (
                <div className="text-right">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{formatCurrency(row.original.total)}</p>
                    {row.original.amountPaid > 0 && (
                        <p className="text-xs text-green-500">{formatCurrency(row.original.amountPaid)} pago</p>
                    )}
                </div>
            ),
        },
        {
            id: 'amountDue',
            header: () => <span className="block text-right">Em Aberto</span>,
            accessorKey: 'amountDue',
            cell: ({ row }) => {
                const inv = row.original;
                const progress = inv.total > 0 ? (inv.amountPaid / inv.total) * 100 : 0;
                return (
                    <div className="text-right">
                        <p className="text-sm font-bold text-red-600 dark:text-red-400">{formatCurrency(inv.amountDue)}</p>
                        {inv.total > 0 && (
                            <div className="mt-1 h-1.5 w-20 ml-auto bg-gray-200 dark:bg-dark-600 rounded-full overflow-hidden">
                                <div className="h-full bg-green-400 rounded-full" style={{ width: `${Math.min(progress, 100)}%` }} />
                            </div>
                        )}
                    </div>
                );
            },
        },
        {
            id: 'status',
            header: () => <span className="block text-center">Estado</span>,
            accessorKey: 'status',
            cell: ({ row }) => {
                const inv = row.original;
                const cfg = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.sent;
                const Icon = cfg.icon;
                return (
                    <div className="text-center">
                        <Badge variant={cfg.variant} size="sm">
                            <Icon className="w-3 h-3 mr-1 inline-block" />
                            {cfg.label}
                        </Badge>
                        {inv.daysOverdue > 0 && (
                            <p className="text-xs text-red-400 mt-0.5">{inv.daysOverdue}d atraso</p>
                        )}
                    </div>
                );
            },
        },
    ], []);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Contas a Receber"
                subtitle="Gestão de cobranças e faturas pendentes de clientes"
                icon={<HiOutlineCurrencyDollar className="text-primary-600 dark:text-primary-400" />}
            />
            {/* Actions Bar */}
            <div className="flex flex-wrap items-center justify-stretch gap-3 bg-white/50 dark:bg-dark-900/50 p-2 rounded-xl border border-gray-100 dark:border-dark-700/50 sm:justify-end [&>*]:w-full sm:[&>*]:w-auto">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={refetch}
                    className="font-black text-[10px] uppercase tracking-widest text-slate-500 dark:text-gray-400 hover:text-primary-600 hover:scale-105 active:scale-95 transition-all"
                    leftIcon={<HiOutlineArrowPath className={cn("w-4 h-4 text-primary-600 dark:text-primary-400", isLoading && "animate-spin")} />}
                >
                    {isLoading ? 'Actualizando...' : 'Actualizar Tudo'}
                </Button>
            </div>

            {/* Summary KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Total a Receber"
                    value={formatCurrency(summary?.totalReceivable ?? 0)}
                    color="primary"
                    icon={<HiOutlineCurrencyDollar className="w-5 h-5" />}
                    sublabel={`${summary?.invoiceCount ?? 0} faturas`}
                />
                <StatCard
                    label="Em Atraso"
                    value={formatCurrency(summary?.overdueAmount ?? 0)}
                    color="danger"
                    icon={<HiOutlineExclamationCircle className="w-5 h-5" />}
                    sublabel={summary?.overdueCount ? `${summary.overdueCount} vencidas` : undefined}
                />
                <StatCard
                    label="Faturas Abertas"
                    value={String(summary?.invoiceCount ?? 0)}
                    color="warning"
                    icon={<HiOutlineClock className="w-5 h-5" />}
                />
                <StatCard
                    label="Taxa de Atraso"
                    value={
                        summary?.invoiceCount
                            ? `${Math.round(((summary.overdueCount ?? 0) / summary.invoiceCount) * 100)}%`
                            : '0%'
                    }
                    color="orange"
                    icon={<HiOutlineExclamationCircle className="w-5 h-5" />}
                    sublabel="Risco Churn"
                />
            </div>

            {/* Filters */}
            <Card padding="md">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_11rem]">
                    <div className="flex-1">
                        <Input
                            placeholder="Pesquisar por nº de fatura ou cliente..."
                            value={search}
                            onChange={handleSearchChange}
                            leftIcon={<HiOutlineMagnifyingGlass className="w-4 h-4" />}
                            size="sm"
                        />
                    </div>
                    <div className="w-full">
                        <Select
                            options={FILTER_OPTIONS}
                            value={filter}
                            onChange={e => handleFilterChange(e.target.value as FilterOption)}
                            size="sm"
                        />
                    </div>
                </div>
            </Card>

            {/* Table Area */}
            <SmartTable
                data={invoices}
                columns={columns}
                isLoading={isLoading}
                isError={Boolean(error)}
                errorMessage={typeof error === 'string' ? error : undefined}
                onRetry={refetch}
                hideToolbar
                emptyTitle="Sem faturas em aberto"
                emptyDescription="Todos os pagamentos estão em dia."
                minHeight="500px"
                pagination={pagination && pagination.totalPages > 1 ? {
                    currentPage: page,
                    totalItems: pagination.total,
                    itemsPerPage: pagination.limit,
                    onPageChange: setPage,
                } : undefined}
                mobileCardRender={(inv) => {
                    const cfg = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.sent;
                    const Icon = cfg.icon;
                    const progress = inv.total > 0 ? (inv.amountPaid / inv.total) * 100 : 0;
                    const issuedAt = inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('pt-MZ') : '';
                    const dueAt = inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('pt-MZ') : '';
                    const customerName = inv.customer?.name ?? inv.customerName ?? '';
                    const customerPhone = inv.customer?.phone ?? inv.customerPhone ?? '';

                    return (
                        <div className="bg-white dark:bg-dark-800 rounded-xl border border-slate-200/80 dark:border-white/10 p-4 shadow-sm space-y-4">
                            {/* Header */}
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex flex-col min-w-0">
                                    <span className="font-black text-sm text-gray-900 dark:text-white uppercase tracking-tight truncate">
                                        {inv.number}
                                    </span>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                                        Emissão: {issuedAt}
                                    </span>
                                </div>
                                <div className="shrink-0 flex flex-col items-end gap-1">
                                    <Badge variant={cfg.variant} size="sm" className="font-black text-[9px] uppercase tracking-widest px-2.5 py-0.5 rounded-full">
                                        <Icon className="w-3 h-3 mr-1 inline-block" />
                                        {cfg.label}
                                    </Badge>
                                    {inv.daysOverdue > 0 && (
                                        <span className="text-[9px] font-bold text-red-500 animate-pulse mt-0.5">
                                            {inv.daysOverdue}d atraso
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Customer Details */}
                            <div className="bg-gray-50 dark:bg-dark-900/50 p-3 rounded-lg border border-gray-100 dark:border-dark-700">
                                <p className="text-[9px] font-black uppercase text-gray-400 mb-1 tracking-widest">Cliente</p>
                                <p className="font-bold text-xs text-gray-700 dark:text-gray-300 uppercase">{customerName}</p>
                                {customerPhone && <p className="text-[10px] text-gray-500 font-medium mt-0.5">{customerPhone}</p>}
                            </div>

                            {/* Vencimento and Total progress */}
                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                    <p className="text-[9px] text-gray-400 uppercase font-bold mb-0.5">Vencimento</p>
                                    <span className="font-bold text-gray-700 dark:text-gray-300">{dueAt}</span>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] text-gray-400 uppercase font-bold mb-0.5">Valor Pago</p>
                                    <span className="font-black text-green-600 dark:text-green-400">{formatCurrency(inv.amountPaid)}</span>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-white/5">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Em Aberto</span>
                                    <span className="text-lg font-black text-red-600 dark:text-red-400 mt-0.5">
                                        {formatCurrency(inv.amountDue)}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total da Fatura</span>
                                    <p className="text-sm font-black text-gray-900 dark:text-white mt-0.5">{formatCurrency(inv.total)}</p>
                                </div>
                            </div>

                            {inv.total > 0 && (
                                <div className="h-1.5 w-full bg-gray-100 dark:bg-dark-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(progress, 100)}%` }} />
                                </div>
                            )}
                        </div>
                    );
                }}
            />
        </div>
    );
}
