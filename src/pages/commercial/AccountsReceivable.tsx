import { useState, useCallback } from 'react';
import {
    HiOutlineCurrencyDollar, HiOutlineArrowPath, HiOutlineExclamationCircle,
    HiOutlineCheckCircle, HiOutlineClock, HiOutlineMagnifyingGlass,
} from 'react-icons/hi2';
import { Card, Badge, Input, Select, PageHeader, Button, Pagination, LoadingOverlay, SkeletonTable } from '../../components/ui';
import { StatCard } from '../../components/common/ModuleMetricCard';
import { formatCurrency, cn } from '../../utils/helpers';
import { useAccountsReceivable } from '../../hooks/useCommercial';

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


// ── Row ──────────────────────────────────────────────────────────────────────-

interface ReceivableRowProps {
    invoice: {
        id: string;
        number: string;
        customer?: { name: string; phone: string } | null;
        customerName?: string;
        customerPhone?: string;
        issueDate?: string;
        createdAt?: string;
        dueDate: string | null;
        total: number;
        amountPaid: number;
        amountDue: number;
        status: 'sent' | 'partial' | 'overdue';
        daysOverdue: number;
    };
}

function ReceivableRow({ invoice }: ReceivableRowProps) {
    const cfg        = STATUS_CONFIG[invoice.status] ?? STATUS_CONFIG.sent;
    const Icon       = cfg.icon;
    const customerName  = invoice.customer?.name  ?? invoice.customerName  ?? '';
    const customerPhone = invoice.customer?.phone ?? invoice.customerPhone ?? '';
    const dateStr    = invoice.issueDate ?? invoice.createdAt;
    const issuedAt   = dateStr ? new Date(dateStr).toLocaleDateString('pt-MZ') : '';
    const dueAt      = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('pt-MZ') : '';
    const progress   = invoice.total > 0 ? (invoice.amountPaid / invoice.total) * 100 : 0;

    return (
        <tr className="border-b border-gray-50 dark:border-dark-700 hover:bg-gray-50/50 dark:hover:bg-dark-700/30 transition-colors">
            <td className="py-3 px-4">
                <p className="text-sm font-bold text-gray-900 dark:text-white">{invoice.number}</p>
                <p className="text-xs text-gray-400">{issuedAt}</p>
            </td>
            <td className="py-3 px-4">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{customerName}</p>
                <p className="text-xs text-gray-400">{customerPhone}</p>
            </td>
            <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">{dueAt}</td>
            <td className="py-3 px-4 text-right">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{formatCurrency(invoice.total)}</p>
                {invoice.amountPaid > 0 && (
                    <p className="text-xs text-green-500">{formatCurrency(invoice.amountPaid)} pago</p>
                )}
            </td>
            <td className="py-3 px-4 text-right">
                <p className="text-sm font-bold text-red-600 dark:text-red-400">{formatCurrency(invoice.amountDue)}</p>
                {invoice.total > 0 && (
                    <div className="mt-1 h-1.5 w-20 ml-auto bg-gray-200 dark:bg-dark-600 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-green-400 rounded-full"
                            style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                    </div>
                )}
            </td>
            <td className="py-3 px-4 text-center">
                <Badge variant={cfg.variant} size="sm">
                    <Icon className="w-3 h-3 mr-1 inline-block" />
                    {cfg.label}
                </Badge>
                {invoice.daysOverdue > 0 && (
                    <p className="text-xs text-red-400 mt-0.5">{invoice.daysOverdue}d atraso</p>
                )}
            </td>
        </tr>
    );
}

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

    return (
        <div className="space-y-6">
            <PageHeader
                title="Contas a Receber"
                subtitle="Gestão de cobranças e faturas pendentes de clientes"
                icon={<HiOutlineCurrencyDollar className="text-primary-600 dark:text-primary-400" />}
            />
            {/* Actions Bar */}
            <div className="flex flex-wrap items-center justify-end gap-3 bg-white/50 dark:bg-dark-900/50 p-2 rounded-xl border border-gray-100 dark:border-dark-700/50">
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
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="flex-1">
                        <Input
                            placeholder="Pesquisar por nº de fatura ou cliente..."
                            value={search}
                            onChange={handleSearchChange}
                            leftIcon={<HiOutlineMagnifyingGlass className="w-4 h-4" />}
                            size="sm"
                        />
                    </div>
                    <div className="w-44">
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
            <Card padding="none" className="min-h-[500px] relative overflow-hidden">
                {isLoading && invoices.length === 0 ? (
                    <div className="p-6">
                        <SkeletonTable rows={10} columns={6} />
                    </div>
                ) : (
                    <>
                        {isLoading && (
                            <div className="absolute inset-0 z-20">
                                <LoadingOverlay 
                                    fullScreen={false} 
                                    message="A carregar contas a receber..." 
                                />
                            </div>
                        )}

                        {error ? (
                            <div className="p-8 text-center">
                                <HiOutlineExclamationCircle className="w-10 h-10 text-red-400 mx-auto mb-2" />
                                <p className="text-sm text-red-500">{error}</p>
                                <Button variant="ghost" size="sm" onClick={refetch} className="mt-2 text-sm text-primary-500 hover:underline">
                                    Tentar novamente
                                </Button>
                            </div>
                        ) : invoices.length === 0 ? (
                    <div className="p-16 text-center">
                        <HiOutlineCheckCircle className="w-12 h-12 text-green-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">Sem faturas em aberto</p>
                        <p className="text-xs text-gray-400 mt-1">Todos os pagamentos estáão em dia</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-dark-700/50 border-b border-gray-200 dark:border-dark-600">
                                <tr>
                                    {['Fatura', 'Cliente', 'Vencimento', 'Total', 'Em Aberto', 'Estado'].map(h => (
                                        <th
                                            key={h}
                                            className={cn(
                                                'py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider',
                                                ['Total', 'Em Aberto'].includes(h) ? 'text-right' : 'text-left',
                                                h === 'Estado' && 'text-center',
                                            )}
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.map(invoice => (
                                    <ReceivableRow key={invoice.id} invoice={invoice} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                    </>
                )}

                {pagination && pagination.totalPages > 1 && (
                    <div className="px-4 py-3 border-t border-gray-100 dark:border-dark-700">
                        <Pagination 
                            currentPage={page}
                            totalItems={pagination.total}
                            itemsPerPage={pagination.limit}
                            onPageChange={setPage}
                        />
                    </div>
                )}
            </Card>
        </div>
    );
}
