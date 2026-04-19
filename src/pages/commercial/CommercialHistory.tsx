import { useState } from 'react';
import { 
    HiOutlineMagnifyingGlass, 
    HiOutlineEye, 
    HiOutlineTrash, 
    HiOutlineArrowPath,
    HiOutlineTicket,
    HiOutlineExclamationTriangle
} from 'react-icons/hi2';
import { Card, Button, Input, Badge, TableContainer, Pagination, Modal, PageHeader } from '../../components/ui';
import { useSales } from '../../hooks/useSales';
import { formatCurrency, cn } from '../../utils/helpers';
import { format, parseISO } from 'date-fns';
import { CommercialReceiptModal, type ReceiptData } from '../../components/commercial/pos/CommercialReceiptModal';

export default function CommercialHistory() {
    const [page, setPage] = useState(1);
    const [pageSize] = useState(12);
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

    const { sales, pagination, isLoading, error, refetch, voidSale } = useSales({
        search,
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
        } catch (err) {
            // Error handled in hook
        } finally {
            setIsVoiding(false);
        }
    };

    return (
        <div className="space-y-4 animate-fade-in pb-10">
            <PageHeader 
                title="Vendas Realizadas"
                subtitle="Consulte, reimprima recibos ou anule transações comerciais"
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
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="md:col-span-2">
                            <Input 
                                label="Filtros Rápidos"
                                placeholder="Nº Recibo, Nome do Cliente ou Código..." 
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                leftIcon={<HiOutlineMagnifyingGlass className="w-5 h-5 text-gray-400" />}
                                className="bg-white dark:bg-dark-900 border-none shadow-sm h-10 text-sm font-medium"
                            />
                        </div>
                        <div>
                            <Input 
                                type="date" 
                                label="Início" 
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="bg-white dark:bg-dark-900 border-none shadow-sm h-10 text-sm"
                            />
                        </div>
                        <div>
                            <Input 
                                type="date" 
                                label="Fim" 
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="bg-white dark:bg-dark-900 border-none shadow-sm h-10 text-sm"
                            />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Table / Error State - High Density */}
            <Card padding="none" className="border-none shadow-xl shadow-blue-500/5 bg-white dark:bg-dark-900 group">
                <TableContainer 
                    isLoading={isLoading} 
                    isEmpty={!isLoading && sales.length === 0 && !error}
                >
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="text-[10px] text-gray-400 border-b border-gray-100 dark:border-dark-700 bg-gray-50/50 dark:bg-dark-900/50 uppercase tracking-[0.2em] font-black">
                                <th className="px-6 py-4 text-left">Recibo / Referência</th>
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
                                    "hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all duration-200 group",
                                    sale.status === 'voided' && "bg-red-50/20 dark:bg-red-900/5"
                                )}>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-black font-mono text-gray-900 dark:text-white text-xs tracking-tight group-hover:text-blue-600 transition-colors">
                                                {sale.receiptNumber || `SALE-${sale.id.slice(-6)}`}
                                            </span>
                                                <span className="text-[9px] text-gray-400 font-mono uppercase truncate w-24">
                                                    {sale.paymentRef && !sale.paymentRef.startsWith('[') ? sale.paymentRef : ''}
                                                </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-gray-700 dark:text-gray-300">
                                                {format(parseISO(sale.createdAt), 'dd/MM/yyyy')}
                                            </span>
                                            <span className="text-[9px] text-gray-400 font-black uppercase tracking-wider">
                                                {format(parseISO(sale.createdAt), 'HH:mm')}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-black text-gray-800 dark:text-gray-200 text-xs uppercase tracking-tight truncate max-w-[140px]">
                                                {sale.customer?.name || 'Consumidor Geral'}
                                            </span>
                                            <span className="text-[9px] text-gray-500 font-medium">#{sale.id.slice(-4).toUpperCase()}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="font-black text-gray-900 dark:text-white text-base tracking-tighter">
                                                {formatCurrency(sale.total)}
                                            </span>
                                            <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{sale.items?.length || 0} Itens</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <Badge variant="gray" size="sm" className="font-black text-[9px] uppercase tracking-widest bg-gray-100 dark:bg-dark-800 px-3 py-1 border-none">
                                            {getPaymentMethodLabel(sale.paymentMethod, sale.paymentRef)}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {sale.status === 'voided' ? (
                                            <Badge variant="danger" className="text-[9px] font-black uppercase px-2 py-0.5 border-none bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                                ANULADA
                                            </Badge>
                                        ) : (
                                            <Badge variant="success" className="text-[9px] font-black uppercase px-2 py-0.5 border-none bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                CONCLUÍDA
                                            </Badge>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 pr-10">
                                        <div className="flex items-center justify-end gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => handleViewReceipt(sale)}
                                                className="p-2 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-all shadow-sm hover:shadow-blue-500/20 shadow-transparent active:scale-90"
                                                title="Reimprimir Recibo"
                                            >
                                                <HiOutlineEye className="w-4 h-4" />
                                            </button>
                                            {sale.status !== 'voided' && (
                                                <button 
                                                    onClick={() => handleOpenVoidModal(sale)}
                                                    className="p-2 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all shadow-sm hover:shadow-red-500/20 shadow-transparent active:scale-95"
                                                    title="Anular Venda"
                                                >
                                                    <HiOutlineTrash className="w-4 h-4" />
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
                    <div className="px-6 py-4 bg-gray-50/50 dark:bg-dark-900/50 border-t border-gray-100 dark:border-dark-700">
                        <Pagination 
                            currentPage={page}
                            totalItems={pagination.total}
                            itemsPerPage={pageSize}
                            onPageChange={setPage}
                        />
                    </div>
                )}
            </Card>

            {/* Void Modal - Premium Redesign */}
            <Modal
                isOpen={showVoidModal}
                onClose={() => !isVoiding && setShowVoidModal(false)}
                title="Protocolo de Anulação"
                size="md"
            >
                <div className="space-y-6">
                    <div className="bg-red-50 dark:bg-red-900/10 p-5 rounded-lg border border-red-100 dark:border-red-800/30 flex gap-4 text-red-700 dark:text-red-400">
                        <div className="w-12 h-12 rounded-lg bg-red-100 dark:bg-red-900/20 flex items-center justify-center shrink-0">
                            <HiOutlineExclamationTriangle className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                            <p className="font-black text-sm uppercase tracking-tighter mb-1">Acção Crítica e Irreversível</p>
                            <p className="text-xs leading-relaxed opacity-80">
                                Ao confirmar, o sistema ir **devolver automaticamente os itens ao stock** e estornar o valor financeiro do historial de caixa. Este registo ficar marcado como anulado para fins de auditoria.
                            </p>
                        </div>
                    </div>

                    <div className="relative group">
                        <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 block mb-2 uppercase tracking-widest pl-1">
                            Motivo Justificativo
                        </label>
                        <textarea
                            value={voidReason}
                            onChange={e => setVoidReason(e.target.value)}
                            rows={3}
                            placeholder="Descreva detalhadamente o motivo (ex: Erro de digitação, Devolução do cliente...)"
                            className="w-full px-5 py-4 rounded-lg border-2 border-gray-100 dark:border-dark-700 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 focus:outline-none bg-gray-50 dark:bg-dark-800 text-gray-900 dark:text-white text-sm transition-all resize-none font-medium"
                        />
                    </div>

                    <div className="flex gap-3">
                        <Button 
                            variant="ghost" 
                            className="flex-1 rounded-lg font-black uppercase text-[10px] tracking-widest" 
                            onClick={() => setShowVoidModal(false)}
                            disabled={isVoiding}
                        >
                            Abortar
                        </Button>
                        <Button 
                            variant="danger" 
                            className="flex-1 rounded-lg font-black uppercase text-[10px] tracking-widest shadow-lg shadow-red-500/20"
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
