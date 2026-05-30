import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import {
    HiOutlineArrowPath,
    HiOutlineCheckCircle,
    HiOutlineExclamationTriangle,
    HiOutlineEye,
    HiOutlineTicket,
    HiOutlineTrash,
    HiOutlineXCircle,
} from 'react-icons/hi2';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { Badge, Button, Card, Input, Modal, PageHeader, Select, Textarea } from '../../components/ui';
import type { BadgeVariant } from '../../components/ui';
import { SmartTable } from '../../components/ui/SmartTable';
import { CommercialReceiptModal, type ReceiptData } from '../../components/commercial/pos/CommercialReceiptModal';
import type { PaymentMethodType } from '../../components/commercial/pos/CommercialPaymentModal';
import { useDebounce } from '../../hooks/useDebounce';
import { usePharmacySales } from '../../hooks/usePharmacySales';
import type { PharmacySale } from '../../types/pharmacy';
import { formatCurrency, cn } from '../../utils/helpers';

type PaymentLabel = {
    label: string;
    color: BadgeVariant;
};

const paymentMethodLabels: Record<string, PaymentLabel> = {
    cash: { label: 'DINHEIRO', color: 'success' },
    card: { label: 'CARTAO/POS', color: 'info' },
    transfer: { label: 'TRANSFERENCIA', color: 'primary' },
    mobile: { label: 'M-PESA/EMOLA', color: 'danger' },
    mpesa: { label: 'M-PESA', color: 'danger' },
    emola: { label: 'EMOLA', color: 'warning' },
    check: { label: 'CHEQUE', color: 'warning' },
    credit: { label: 'CREDITO', color: 'gray' },
    mixed: { label: 'MISTO', color: 'primary' },
};

const receiptMethodMap: Record<string, PaymentMethodType> = {
    cash: 'cash',
    card: 'card',
    mpesa: 'mpesa',
    emola: 'emola',
    mobile: 'mpesa',
    credit: 'credit',
};

const getPaymentMethodLabel = (method?: string): PaymentLabel => {
    if (method?.startsWith('[') || method?.includes('method')) {
        return paymentMethodLabels.mixed;
    }

    return paymentMethodLabels[method?.toLowerCase() || ''] || {
        label: method?.toUpperCase() || 'OUTRO',
        color: 'gray',
    };
};

const toReceiptPaymentMethod = (method?: string): PaymentMethodType => {
    if (!method) return 'cash';
    return receiptMethodMap[method.toLowerCase()] || 'cash';
};

export default function PharmacyHistory() {
    const [page, setPage] = useState(1);
    const [pageSize] = useState(12);
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 350);
    const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-01'));
    const [endDate, setEndDate] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null);
    const [saleToVoid, setSaleToVoid] = useState<PharmacySale | null>(null);
    const [showVoidModal, setShowVoidModal] = useState(false);
    const [voidReason, setVoidReason] = useState('');
    const [isVoiding, setIsVoiding] = useState(false);

    const { sales, pagination, isLoading, error, refetch, voidSale } = usePharmacySales({
        search: debouncedSearch,
        startDate,
        endDate,
        status: statusFilter || undefined,
        page,
        limit: pageSize,
    });

    const handleViewReceipt = (sale: PharmacySale) => {
        const receiptData: ReceiptData = {
            saleNumber: sale.receiptNumber || `SALE-${sale.id.slice(-6)}`,
            date: new Date(sale.createdAt),
            customerName: sale.customer?.name || 'Consumidor Geral',
            customerPhone: sale.customer?.phone,
            items: sale.items.map((item) => ({
                name: item.product?.name || 'Produto',
                code: item.product?.code || '',
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discountPct: item.discount || 0,
                total: item.total,
            })),
            subtotal: sale.subtotal,
            discount: sale.discount,
            tax: sale.tax,
            total: sale.total,
            payments: [{
                method: toReceiptPaymentMethod(sale.paymentMethod),
                amount: sale.amountPaid,
                reference: sale.paymentRef,
            }],
            change: sale.change || 0,
            isCredit: sale.paymentMethod === 'credit',
        };

        setSelectedReceipt(receiptData);
    };

    const handleOpenVoidModal = (sale: PharmacySale) => {
        setSaleToVoid(sale);
        setShowVoidModal(true);
    };

    const handleConfirmVoid = async () => {
        if (!saleToVoid || !voidReason.trim()) return;
        setIsVoiding(true);

        try {
            await voidSale(saleToVoid.id, voidReason);
            setShowVoidModal(false);
            setSaleToVoid(null);
            setVoidReason('');
            refetch();
            toast.success('Venda anulada com sucesso!');
        } finally {
            setIsVoiding(false);
        }
    };

    const saleColumns = useMemo<ColumnDef<PharmacySale, unknown>[]>(() => [
        {
            header: 'Referencia',
            cell: ({ row }) => (
                <span className="font-black font-mono text-gray-900 dark:text-white">
                    {row.original.receiptNumber || `SALE-${row.original.id.slice(-6)}`}
                </span>
            ),
        },
        {
            header: 'Data & Hora',
            cell: ({ row }) => (
                <div>
                    <p className="font-bold text-gray-700 dark:text-gray-300">
                        {format(parseISO(row.original.createdAt), 'dd/MM/yyyy')}
                    </p>
                    <p className="text-[10px] text-gray-400">
                        {format(parseISO(row.original.createdAt), 'HH:mm')}
                    </p>
                </div>
            ),
        },
        {
            header: 'Identificacao',
            cell: ({ row }) => (
                <span className="font-medium text-gray-600 dark:text-gray-400 capitalize">
                    {row.original.customer?.name || 'Consumidor Geral'}
                </span>
            ),
        },
        {
            header: 'Valor Total',
            cell: ({ row }) => (
                <div className="text-right font-black text-blue-600 dark:text-blue-400">
                    {formatCurrency(row.original.total)}
                </div>
            ),
        },
        {
            header: 'Metodo',
            cell: ({ row }) => {
                const method = getPaymentMethodLabel(row.original.paymentMethod);
                return (
                    <div className="text-center">
                        <Badge variant={method.color} size="sm" className="text-[9px]">
                            {method.label}
                        </Badge>
                    </div>
                );
            },
        },
        {
            header: 'Status',
            cell: ({ row }) => (
                <div className="text-center">
                    {row.original.status === 'voided' ? (
                        <Badge variant="danger" size="sm" className="inline-flex items-center gap-1">
                            <HiOutlineXCircle className="w-3 h-3" /> ANULADA
                        </Badge>
                    ) : (
                        <Badge variant="success" size="sm" className="inline-flex items-center gap-1">
                            <HiOutlineCheckCircle className="w-3 h-3" /> ACTIVA
                        </Badge>
                    )}
                </div>
            ),
        },
        {
            header: 'Gestao',
            cell: ({ row }) => (
                <div className="flex items-center justify-end gap-2">
                    <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleViewReceipt(row.original)}
                        className="h-9 w-9 px-0 text-gray-400 hover:text-blue-500"
                        title="Ver Recibo"
                    >
                        <HiOutlineEye className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    </Button>
                    {row.original.status !== 'voided' && (
                        <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => handleOpenVoidModal(row.original)}
                            className="h-9 w-9 px-0 text-gray-400 hover:text-red-500"
                            title="Anular Venda"
                        >
                            <HiOutlineTrash className="w-5 h-5 text-red-500 dark:text-red-400" />
                        </Button>
                    )}
                </div>
            ),
        },
    ], []);

    const renderMobileCard = (sale: PharmacySale) => {
        const method = getPaymentMethodLabel(sale.paymentMethod);
        return (
            <Card padding="sm" className="space-y-3">
                <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-gray-900 dark:text-white">
                        {sale.receiptNumber || `SALE-${sale.id.slice(-6)}`}
                    </span>
                    {sale.status === 'voided' ? (
                        <Badge variant="danger" size="sm" className="inline-flex items-center gap-1">
                            <HiOutlineXCircle className="w-3 h-3" /> ANULADA
                        </Badge>
                    ) : (
                        <Badge variant="success" size="sm" className="inline-flex items-center gap-1">
                            <HiOutlineCheckCircle className="w-3 h-3" /> ACTIVA
                        </Badge>
                    )}
                </div>

                <div className="flex justify-between items-start text-sm">
                    <div className="space-y-1 min-w-0 flex-1">
                        <p className="font-bold text-gray-800 dark:text-gray-200 capitalize truncate">
                            {sale.customer?.name || 'Consumidor Geral'}
                        </p>
                        <p className="text-xs text-gray-400">
                            {format(parseISO(sale.createdAt), 'dd/MM/yyyy HH:mm')}
                        </p>
                    </div>
                    <div className="text-right space-y-1 ml-4 flex-shrink-0">
                        <div className="font-black text-blue-600 dark:text-blue-400">
                            {formatCurrency(sale.total)}
                        </div>
                        <Badge variant={method.color} size="sm" className="text-[9px]">
                            {method.label}
                        </Badge>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-dark-800">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewReceipt(sale)}
                        className="flex-1 justify-center gap-2 h-10"
                    >
                        <HiOutlineEye className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                        Ver Recibo
                    </Button>
                    {sale.status !== 'voided' && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenVoidModal(sale)}
                            className="flex-1 justify-center gap-2 h-10 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                            <HiOutlineTrash className="w-4 h-4 text-red-500 dark:text-red-400" />
                            Anular
                        </Button>
                    )}
                </div>
            </Card>
        );
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Historico de Vendas"
                subtitle="Consulta e gestao de transaccoes comerciais realizadas na farmacia"
                icon={<HiOutlineTicket className="text-primary-600 dark:text-primary-400" />}
                actions={
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => refetch()}
                        className="font-black text-[10px] uppercase tracking-widest text-gray-400 hover:text-blue-600"
                        leftIcon={<HiOutlineArrowPath className="w-4 h-4 text-primary-600 dark:text-primary-400" />}
                    >
                        Actualizar
                    </Button>
                }
            />

            <SmartTable
                data={sales}
                columns={saleColumns}
                isLoading={isLoading}
                isError={!!error}
                errorMessage={error || undefined}
                onRetry={refetch}
                search={{
                    value: search,
                    onChange: (value) => {
                        setSearch(value);
                        setPage(1);
                    },
                    placeholder: 'No. Recibo, nome do paciente ou codigo...',
                }}
                renderFilters={(
                    <>
                        <div className="w-full sm:w-36">
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(event) => {
                                    setStartDate(event.target.value);
                                    setPage(1);
                                }}
                                className="bg-white dark:bg-dark-800"
                                size="sm"
                            />
                        </div>
                        <div className="w-full sm:w-36">
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(event) => {
                                    setEndDate(event.target.value);
                                    setPage(1);
                                }}
                                className="bg-white dark:bg-dark-800"
                                size="sm"
                            />
                        </div>
                        <div className="w-full sm:w-44">
                            <Select
                                value={statusFilter}
                                onChange={(event) => {
                                    setStatusFilter(event.target.value);
                                    setPage(1);
                                }}
                                options={[
                                    { value: '', label: 'Todos' },
                                    { value: 'active', label: 'Activas' },
                                    { value: 'voided', label: 'Anuladas' },
                                ]}
                                className="bg-white dark:bg-dark-800"
                                size="sm"
                            />
                        </div>
                    </>
                )}
                rowClassName={(sale) => cn(
                    'transition-colors',
                    sale.status === 'voided' && 'opacity-60 bg-red-50/10'
                )}
                pagination={pagination ? {
                    currentPage: page,
                    totalItems: pagination.total,
                    itemsPerPage: pageSize,
                    onPageChange: setPage,
                } : undefined}
                onRefresh={refetch}
                emptyTitle="Nenhuma venda encontrada"
                emptyDescription="Ajuste os filtros ou realize novas vendas no PDV."
                minHeight="500px"
                mobileCardRender={renderMobileCard}
            />

            <Modal
                isOpen={showVoidModal}
                onClose={() => !isVoiding && setShowVoidModal(false)}
                title="Anular Venda"
                size="md"
            >
                <div className="space-y-4">
                    <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800 flex gap-3 text-amber-700 dark:text-amber-400">
                        <HiOutlineExclamationTriangle className="w-6 h-6 flex-shrink-0" />
                        <div>
                            <p className="font-bold text-sm">Atencao!</p>
                            <p className="text-xs">
                                Anular esta venda vai devolver os itens ao stock e estornar o valor financeiro.
                                Esta acção não pode ser revertida.
                            </p>
                        </div>
                    </div>

                    <Textarea
                        label="Motivo da Anulacao"
                        value={voidReason}
                        onChange={(event) => setVoidReason(event.target.value)}
                        rows={3}
                        placeholder="Explique o motivo do cancelamento..."
                    />

                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => setShowVoidModal(false)}
                            disabled={isVoiding}
                        >
                            Voltar
                        </Button>
                        <Button
                            variant="danger"
                            className="flex-1"
                            onClick={handleConfirmVoid}
                            isLoading={isVoiding}
                            disabled={!voidReason.trim()}
                        >
                            Confirmar Anulacao
                        </Button>
                    </div>
                </div>
            </Modal>

            <CommercialReceiptModal
                isOpen={!!selectedReceipt}
                receipt={selectedReceipt}
                onClose={() => setSelectedReceipt(null)}
            />
        </div>
    );
}
