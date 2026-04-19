import { useState } from 'react';
import { 
    HiOutlineMagnifyingGlass, 
    HiOutlineEye, 
    HiOutlineTrash, 
    HiOutlineExclamationTriangle, 
    HiOutlineCheckCircle, 
    HiOutlineXCircle,
    HiOutlineArrowPath,
    HiOutlineTicket
} from 'react-icons/hi2';
import { Card, Button, Input, Badge, TableContainer, Pagination, Modal, PageHeader } from '../../components/ui';
import { usePharmacySales } from '../../hooks/usePharmacySales';
import { formatCurrency, cn } from '../../utils/helpers';
import { format, parseISO } from 'date-fns';
import { CommercialReceiptModal, type ReceiptData } from '../../components/commercial/pos/CommercialReceiptModal';
import toast from 'react-hot-toast';

export default function PharmacyHistory() {
    const [page, setPage] = useState(1);
    const [pageSize] = useState(12);
    const [search, setSearch] = useState('');
    const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-01'));
    const [endDate, setEndDate] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const { sales, pagination, isLoading, error, refetch, voidSale } = usePharmacySales({
        search,
        startDate,
        endDate,
        status: statusFilter || undefined,
        page,
        limit: pageSize,
    });

    const [selectedSale, setSelectedSale] = useState<any | null>(null);
    const [showReceipt, setShowReceipt] = useState(false);
    const [showVoidModal, setShowVoidModal] = useState(false);
    const [voidReason, setVoidReason] = useState('');
    const [isVoiding, setIsVoiding] = useState(false);

    const handleViewReceipt = (sale: any) => {
        // Map Sale to ReceiptData
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
            payments: [{ method: sale.paymentMethod as any, amount: sale.amountPaid, reference: sale.paymentRef }],
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
            toast.success('Venda anulada com sucesso!');
        } catch (err) {
            // Error handled in hook
        } finally {
            setIsVoiding(false);
        }
    };

    const getPaymentMethodLabel = (method: string) => {
        const methods: Record<string, { label: string; color: string }> = {
            cash: { label: 'DINHEIRO', color: 'success' },
            card: { label: 'CARTÃO/pos', color: 'info' },
            transfer: { label: 'TRANSFERÊNCIA', color: 'primary' },
            mobile: { label: 'M-PESA/EMOLA', color: 'danger' },
            check: { label: 'CHEQUE', color: 'warning' },
            credit: { label: 'CRÉDITO', color: 'gray' },
            mixed: { label: 'MISTO', color: 'primary' }
        };

        // Check if it's JSON (mixed payment)
        if (method?.startsWith('[') || method?.includes('method')) {
            return { label: 'MISTO', color: 'primary' };
        }

        return methods[method?.toLowerCase()] || { label: method?.toUpperCase() || 'OUTRO', color: 'gray' };
    };

    return (
        <div className="space-y-6">
            <PageHeader 
                title="Histórico de Vendas"
                subtitle="Consulta e gestão de transações comerciais realizadas na farmácia"
                icon={<HiOutlineTicket />}
                actions={
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => refetch()} 
                        className="font-black text-[10px] uppercase tracking-widest text-gray-400 hover:text-blue-600"
                        leftIcon={<HiOutlineArrowPath className="w-4 h-4" />}
                    >
                        Actualizar
                    </Button>
                }
            />

            {/* Filters Bar - High Density */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <Card padding="md" className="md:col-span-12 border-none shadow-none bg-gray-100/50 dark:bg-dark-800/50">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                        <div className="md:col-span-2">
                            <Input
                                label="Filtros Rápidos"
                                placeholder="Nº Recibo, Nome do Paciente ou Código..."
                                value={search}
                                onChange={e => { setSearch(e.target.value); setPage(1); }}
                                leftIcon={<HiOutlineMagnifyingGlass className="w-5 h-5 text-gray-400" />}
                                className="bg-white dark:bg-dark-900 border-none shadow-sm h-10 text-sm font-medium"
                            />
                        </div>
                        <div>
                            <Input
                                type="date"
                                label="Início"
                                value={startDate}
                                onChange={e => { setStartDate(e.target.value); setPage(1); }}
                                className="bg-white dark:bg-dark-900 border-none shadow-sm h-10 text-sm"
                            />
                        </div>
                        <div>
                            <Input
                                type="date"
                                label="Fim"
                                value={endDate}
                                onChange={e => { setEndDate(e.target.value); setPage(1); }}
                                className="bg-white dark:bg-dark-900 border-none shadow-sm h-10 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 pl-1">Estado</label>
                            <select
                                value={statusFilter}
                                onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                                className="w-full h-10 px-3 bg-white dark:bg-dark-900 border-none shadow-sm rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
                            >
                                <option value="">Todos</option>
                                <option value="active">Activas</option>
                                <option value="voided">Anuladas</option>
                            </select>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Table Layer - High Density */}
            <Card padding="none" className="border-none shadow-xl shadow-blue-500/5 bg-white dark:bg-dark-900 group">
                <TableContainer
                    isLoading={isLoading}
                    isEmpty={sales.length === 0}
                    isError={!!error}
                    emptyTitle="Nenhuma venda encontrada"
                    emptyDescription="Ajuste os filtros ou realize novas vendas no PDV."
                >
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="text-[10px] text-gray-400 border-b border-gray-100 dark:border-dark-700 bg-gray-50/50 dark:bg-dark-900/50 uppercase tracking-[0.2em] font-black">
                                <th className="px-6 py-4 text-left">Referência</th>
                                <th className="px-6 py-4 text-left">Data & Hora</th>
                                <th className="px-6 py-4 text-left">Identificação</th>
                                <th className="px-6 py-4 text-right">Valor Total</th>
                                <th className="px-6 py-4 text-center">Método</th>
                                <th className="px-6 py-4 text-center">Status</th>
                                <th className="px-6 py-4 text-right pr-10">Gestão</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                            {sales.map((sale: any) => (
                                <tr key={sale.id} className={cn(
                                    "hover:bg-gray-50/50 dark:hover:bg-dark-700/30 transition-colors",
                                    sale.status === 'voided' && "opacity-60 bg-red-50/10"
                                )}>
                                    <td className="px-6 py-4 font-black font-mono text-gray-900 dark:text-white">
                                        {sale.receiptNumber || `SALE-${sale.id.slice(-6)}`}
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="font-bold text-gray-700 dark:text-gray-300">
                                            {format(parseISO(sale.createdAt), 'dd/MM/yyyy')}
                                        </p>
                                        <p className="text-[10px] text-gray-400">
                                            {format(parseISO(sale.createdAt), 'HH:mm')}
                                        </p>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-gray-600 dark:text-gray-400 capitalize">
                                        {sale.customer?.name || 'Consumidor Geral'}
                                    </td>
                                    <td className="px-6 py-4 text-right font-black text-blue-600 dark:text-blue-400">
                                        {formatCurrency(sale.total)}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <Badge variant={getPaymentMethodLabel(sale.paymentMethod).color as any} size="sm" className="text-[9px]">
                                            {getPaymentMethodLabel(sale.paymentMethod).label}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {sale.status === 'voided' ? (
                                            <Badge variant="danger" size="sm" className="inline-flex items-center gap-1">
                                                <HiOutlineXCircle className="w-3 h-3" /> ANULADA
                                            </Badge>
                                        ) : (
                                            <Badge variant="success" size="sm" className="inline-flex items-center gap-1">
                                                <HiOutlineCheckCircle className="w-3 h-3" /> ACTIVA
                                            </Badge>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <button 
                                                onClick={() => handleViewReceipt(sale)}
                                                className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                                                title="Ver Recibo"
                                            >
                                                <HiOutlineEye className="w-5 h-5" />
                                            </button>
                                            {sale.status !== 'voided' && (
                                                <button 
                                                    onClick={() => handleOpenVoidModal(sale)}
                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                                    title="Anular Venda"
                                                >
                                                    <HiOutlineTrash className="w-5 h-5" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </TableContainer>
                
                {pagination && pagination.totalPages > 1 && (
                    <div className="px-6 py-4 border-t dark:border-dark-700">
                        <Pagination 
                            currentPage={page}
                            totalItems={pagination.total}
                            itemsPerPage={pageSize}
                            onPageChange={setPage}
                        />
                    </div>
                )}
            </Card>

            {/* Void Modal */}
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
                            <p className="font-bold text-sm">Atenção!</p>
                            <p className="text-xs">
                                Anular esta venda ir devolver os itens ao stock e estornar o valor financeiro. 
                                Esta acção não pode ser revertida.
                            </p>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1.5 uppercase tracking-wide">
                            Motivo da Anulação
                        </label>
                        <textarea
                            value={voidReason}
                            onChange={e => setVoidReason(e.target.value)}
                            rows={3}
                            placeholder="Explique o motivo do cancelamento..."
                            className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-dark-600 focus:border-red-500 focus:outline-none bg-white dark:bg-dark-900 text-gray-900 dark:text-white text-sm"
                        />
                    </div>

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
                            Confirmar Anulação
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Receipt Modal */}
            <CommercialReceiptModal 
                isOpen={showReceipt}
                receipt={selectedSale}
                onClose={() => setShowReceipt(false)}
            />
        </div>
    );
}
