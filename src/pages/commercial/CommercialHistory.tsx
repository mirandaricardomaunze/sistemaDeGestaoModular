import { Button, Input, Badge, Textarea, ConfirmationModal, SmartTable } from '../../components/ui';
import { useSales } from '../../hooks/useSales';
import { formatCurrency } from '../../utils/helpers';
import { PAGE_SIZE } from '../../utils/constants';
import { format, parseISO } from 'date-fns';
import { CommercialReceiptModal, type ReceiptData } from '../../components/commercial/pos/CommercialReceiptModal';
import { useDebounce } from '../../hooks/useDebounce';
import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { HiOutlineEye, HiOutlineTrash } from 'react-icons/hi2';

export default function CommercialHistory() {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGE_SIZE);
    const [search, setSearch] = useState('');
    const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-01'));
    const [endDate, setEndDate] = useState(''); // Empty end date means "up to now" by default
    
    const getPaymentMethodLabel = (method: string, ref?: string) => {
        if (ref && ref.startsWith('[') && ref.includes('method')) {
            try {
                const parsed = JSON.parse(ref);
                if (Array.isArray(parsed) && parsed.length > 1) return 'Misto';
            } catch (e) {}
        }

        const labels: Record<string, string> = {
            'cash': 'Dinheiro',
            'card': 'Cartão/pos',
            'mpesa': 'M-Pesa',
            'emola': 'E-Mola',
            'bank_transfer': 'Transferência',
            'credit': 'Conta Corrente',
            'pix': 'PIX/Digital'
        };
        return labels[method] || method.toUpperCase();
    };

    const debouncedSearch = useDebounce(search, 300);

    const { sales, pagination, isLoading, refetch, voidSale } = useSales({
        search: debouncedSearch || undefined,
        startDate,
        endDate,
        page,
        limit: pageSize,
        sortBy: 'createdAt',
        sortOrder: 'desc',
    });

    const [selectedSale, setSelectedSale] = useState<any | null>(null);
    const [showReceipt, setShowReceipt] = useState(false);
    const [showVoidModal, setShowVoidModal] = useState(false);
    const [voidReason, setVoidReason] = useState('');
    const [isVoiding, setIsVoiding] = useState(false);

    const handleViewReceipt = (sale: any) => {
        let parsedPayments = [{ method: sale.paymentMethod as any, amount: sale.amountPaid, reference: sale.paymentRef }];

        if (sale.paymentRef && sale.paymentRef.startsWith('[') && sale.paymentRef.includes('method')) {
            try {
                const arr = JSON.parse(sale.paymentRef);
                if (Array.isArray(arr) && arr.length > 0) {
                    parsedPayments = arr.map((p: any) => ({
                        method: p.method,
                        amount: p.amount,
                        reference: p.reference
                    }));
                }
            } catch (e) {}
        }

        const receiptData: ReceiptData = {
            saleNumber: sale.receiptNumber || `SALE-${sale.id.slice(-6)}`,
            date: new Date(sale.createdAt),
            customerName: sale.customer?.name || 'Consumidor Geral',
            customerPhone: sale.customer?.phone,
            items: sale.items.map((item: any) => ({
                name: item.product?.name || 'Produto',
                code: item.product?.code || '',
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discountPct: item.discount || 0,
                total: item.total
            })),
            subtotal: sale.subtotal,
            discount: sale.discount,
            tax: sale.tax,
            total: sale.total,
            payments: parsedPayments,
            change: sale.change || 0,
            isCredit: sale.paymentMethod === 'credit'
        };
        setSelectedSale(receiptData);
        setShowReceipt(true);
    };

    const handleOpenVoidModal = (sale: any) => {
        setSelectedSale(sale);
        setShowVoidModal(true);
    };

    const handleConfirmVoid = async () => {
        if (!selectedSale || !voidReason.trim()) return;
        setIsVoiding(true);
        try {
            await voidSale(selectedSale.id, voidReason);
            setShowVoidModal(false);
            setVoidReason('');
            refetch();
        } catch (err) {
            // Error handled in hook
        } finally {
            setIsVoiding(false);
        }
    };

    const columns = useMemo<ColumnDef<any, any>[]>(() => [
        {
            accessorKey: 'receiptNumber',
            header: 'Recibo / Referência',
            cell: ({ row }: any) => {
                const sale = row.original;
                return (
                    <div className="flex flex-col">
                        <span className="font-black font-mono text-gray-900 dark:text-white text-xs tracking-tight group-hover:text-blue-600 transition-colors">
                            {sale.receiptNumber || `SALE-${sale.id.slice(-6)}`}
                        </span>
                        <span className="text-[9px] text-gray-400 font-mono uppercase truncate w-24">
                            {sale.paymentRef && !sale.paymentRef.startsWith('[') ? sale.paymentRef : ''}
                        </span>
                    </div>
                );
            }
        },
        {
            accessorKey: 'createdAt',
            header: 'Data & Hora',
            cell: (info: any) => (
                <div className="flex flex-col">
                    <span className="font-bold text-gray-700 dark:text-gray-300">
                        {format(parseISO(info.getValue()), 'dd/MM/yyyy')}
                    </span>
                    <span className="text-[9px] text-gray-400 font-black uppercase tracking-wider">
                        {format(parseISO(info.getValue()), 'HH:mm')}
                    </span>
                </div>
            )
        },
        {
            accessorKey: 'customer.name',
            header: 'Identificação',
            cell: ({ row }: any) => (
                <div className="flex flex-col">
                    <span className="font-black text-gray-800 dark:text-gray-200 text-xs uppercase tracking-tight truncate max-w-[140px]">
                        {row.original.customer?.name || 'Consumidor Geral'}
                    </span>
                    <span className="text-[9px] text-gray-500 font-medium">#{row.original.id.slice(-4).toUpperCase()}</span>
                </div>
            )
        },
        {
            accessorKey: 'total',
            header: 'Valor Total',
            cell: (info: any) => (
                <div className="flex flex-col items-end">
                    <span className="font-black text-gray-900 dark:text-white text-base tracking-tighter">
                        {formatCurrency(info.getValue())}
                    </span>
                    <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{info.row.original.items?.length || 0} Itens</span>
                </div>
            )
        },
        {
            accessorKey: 'paymentMethod',
            header: 'Método',
            cell: (info: any) => (
                <Badge variant="gray" size="sm" className="font-black text-[9px] uppercase tracking-widest bg-gray-100 text-gray-700 dark:bg-dark-800 dark:text-gray-300 px-3 py-1 border-none">
                    {getPaymentMethodLabel(info.getValue(), info.row.original.paymentRef)}
                </Badge>
            )
        },
        {
            accessorKey: 'voidStatus',
            header: 'Status',
            cell: (info: any) => {
                const vs = info.getValue() ?? info.row.original.status;
                if (vs === 'voided') {
                    return (
                        <Badge variant="danger" className="text-[9px] font-black uppercase px-2 py-0.5 border-none bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            ANULADA
                        </Badge>
                    );
                }
                if (vs === 'pending_void') {
                    return (
                        <Badge variant="warning" className="text-[9px] font-black uppercase px-2 py-0.5 border-none bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            PEND. APROVAÇÃO
                        </Badge>
                    );
                }
                return (
                    <Badge variant="success" className="text-[9px] font-black uppercase px-2 py-0.5 border-none bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        CONCLUÍDA
                    </Badge>
                );
            }
        },
        {
            id: 'actions',
            header: 'Gestão',
            cell: ({ row }: any) => {
                const vs = row.original.voidStatus ?? row.original.status;
                const canRequestVoid = vs !== 'voided' && vs !== 'pending_void';
                return (
                    <div className="flex items-center justify-end gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" onClick={() => handleViewReceipt(row.original)} className="text-blue-600 hover:bg-blue-600 hover:text-white" title="Reimprimir Recibo">
                            <HiOutlineEye className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                        </Button>
                        {canRequestVoid && (
                            <Button variant="ghost" size="sm" onClick={() => handleOpenVoidModal(row.original)} className="text-red-500 hover:bg-red-500 hover:text-white" title="Solicitar Anulação">
                                <HiOutlineTrash className="w-4 h-4 text-red-500 dark:text-red-400" />
                            </Button>
                        )}
                    </div>
                );
            }
        }
    ], []);

    return (
        <div className="space-y-4 animate-fade-in pb-10">
            <SmartTable
                data={sales}
                columns={columns}
                isLoading={isLoading}
                search={{
                    value: search,
                    onChange: (val) => { setSearch(val); setPage(1); },
                    placeholder: "Nº Recibo, Nome do Cliente ou Código..."
                }}
                renderFilters={
                    <>
                        <div className="w-full lg:w-44">
                            <Input 
                                type="date" 
                                label="Início" 
                                value={startDate}
                                onChange={e => { setStartDate(e.target.value); setPage(1); }}
                                size="sm"
                            />
                        </div>
                        <div className="w-full lg:w-44">
                            <Input 
                                type="date" 
                                label="Fim" 
                                value={endDate}
                                onChange={e => { setEndDate(e.target.value); setPage(1); }}
                                size="sm"
                            />
                        </div>
                    </>
                }
                pagination={{
                    currentPage: page,
                    totalItems: pagination?.total || 0,
                    itemsPerPage: pageSize,
                    onPageChange: setPage,
                    onItemsPerPageChange: (size) => {
                        setPageSize(size);
                        setPage(1);
                    }
                }}
                onRefresh={refetch}
                exportConfig={{
                    filename: 'historico_vendas',
                    title: 'Relatório de Vendas',
                    orientation: 'landscape',
                    columns: [
                        { key: 'receiptNumber', header: 'Nº Recibo', width: 15 },
                        { key: 'createdAt', header: 'Data', format: 'datetime', width: 20 },
                        { key: 'customer.name', header: 'Cliente', width: 25 },
                        { key: 'total', header: 'Total', format: 'currency', width: 15, align: 'right' },
                        { key: 'paymentMethod', header: 'Pagamento', width: 15 },
                        { key: 'status', header: 'Estado', width: 12 }
                    ]
                }}
                emptyTitle="Nenhuma venda encontrada"
                emptyDescription="Ajuste os filtros de data ou pesquisa para encontrar registos."
            />

            {/* Void Request Modal -- step 1 of two-step flow */}
            <ConfirmationModal
                isOpen={showVoidModal}
                onClose={() => !isVoiding && setShowVoidModal(false)}
                onConfirm={handleConfirmVoid}
                title="Solicitar Anulação"
                message={`Pedir anulação da venda "${selectedSale?.receiptNumber || selectedSale?.id?.slice(-6)}"? A venda fica pendente até ser aprovada por um gestor — o stock só é devolvido após aprovação.`}
                confirmText="Enviar Pedido"
                cancelText="Cancelar"
                variant="danger"
                isLoading={isVoiding}
                disabled={voidReason.trim().length < 5}
            >
                <div className="mt-4">
                    <Textarea
                        label="Motivo Justificativo (mín. 5 caracteres)"
                        value={voidReason}
                        onChange={e => setVoidReason(e.target.value)}
                        rows={3}
                        placeholder="Descreva detalhadamente o motivo (ex: Erro de digitação, Devolução do cliente...)"
                    />
                </div>
            </ConfirmationModal>

            {/* Receipt Modal */}
            <CommercialReceiptModal 
                isOpen={showReceipt}
                receipt={selectedSale}
                onClose={() => setShowReceipt(false)}
            />
        </div>
    );
}
