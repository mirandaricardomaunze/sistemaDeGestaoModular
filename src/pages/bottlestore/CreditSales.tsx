import { useState, useEffect } from 'react';
import { Card, Button, Input, Badge, Modal, Select, LoadingSpinner, EmptyState } from '../../components/ui';
import {
    HiOutlineCreditCard,
    HiOutlineRefresh,
    HiOutlineCash,
    HiOutlineUser,
    HiOutlineDocumentText,
    HiOutlineExclamation
} from 'react-icons/hi';
import { bottleStoreAPI } from '../../services/api/bottle-store.api';
import Pagination from '../../components/ui/Pagination';
import { formatCurrency, formatDateTime, formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';

export default function CreditSales() {
    // State
    const [sales, setSales] = useState<any[]>([]);
    const [debtors, setDebtors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [total, setTotal] = useState(0);
    const [totalOutstanding, setTotalOutstanding] = useState(0);
    const [statusFilter, setStatusFilter] = useState('');

    // Payment modal
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [selectedSale, setSelectedSale] = useState<any>(null);
    const [paymentData, setPaymentData] = useState({
        amount: '',
        paymentMethod: 'cash',
        reference: '',
        notes: ''
    });
    const [submitting, setSubmitting] = useState(false);

    // Detail modal
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [saleDetail, setSaleDetail] = useState<any>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Tabs
    const [activeTab, setActiveTab] = useState<'sales' | 'debtors'>('sales');

    // Fetch credit sales
    const fetchCreditSales = async () => {
        setLoading(true);
        try {
            const res = await bottleStoreAPI.getCreditSales({
                page,
                limit: pageSize,
                status: statusFilter || undefined
            });
            setSales(res.data || []);
            setTotal(res.total || 0);
        } catch (error) {
            toast.error('Erro ao carregar vendas a crédito');
        } finally {
            setLoading(false);
        }
    };

    // Fetch debtors
    const fetchDebtors = async () => {
        try {
            const res = await bottleStoreAPI.getDebtorsReport();
            setDebtors(res.debtors || []);
            setTotalOutstanding(res.totalOutstanding || 0);
        } catch (error) {
            console.error('Error fetching debtors:', error);
        }
    };

    useEffect(() => {
        fetchCreditSales();
        fetchDebtors();
    }, [page, pageSize, statusFilter]);

    // Open payment modal
    const openPaymentModal = (sale: any) => {
        setSelectedSale(sale);
        setPaymentData({
            amount: sale.remainingBalance?.toString() || '',
            paymentMethod: 'cash',
            reference: '',
            notes: ''
        });
        setPaymentModalOpen(true);
    };

    // Handle payment
    const handlePayment = async () => {
        if (!paymentData.amount || parseFloat(paymentData.amount) <= 0) {
            toast.error('Informe um valor válido');
            return;
        }
        if (parseFloat(paymentData.amount) > selectedSale.remainingBalance) {
            toast.error(`Valor máximo: ${formatCurrency(selectedSale.remainingBalance)}`);
            return;
        }

        setSubmitting(true);
        try {
            await bottleStoreAPI.registerCreditPayment({
                saleId: selectedSale.id,
                amount: parseFloat(paymentData.amount),
                paymentMethod: paymentData.paymentMethod,
                reference: paymentData.reference || undefined,
                notes: paymentData.notes || undefined
            });
            toast.success('Pagamento registrado com sucesso!');
            setPaymentModalOpen(false);
            setSelectedSale(null);
            fetchCreditSales();
            fetchDebtors();
        } catch (error: any) {
            toast.error(error.message || 'Erro ao registrar pagamento');
        } finally {
            setSubmitting(false);
        }
    };

    // View sale detail
    const viewSaleDetail = async (saleId: string) => {
        setLoadingDetail(true);
        setDetailModalOpen(true);
        try {
            const res = await bottleStoreAPI.getCreditPaymentHistory(saleId);
            setSaleDetail(res);
        } catch (error) {
            toast.error('Erro ao carregar detalhes');
            setDetailModalOpen(false);
        } finally {
            setLoadingDetail(false);
        }
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Vendas a Crédito
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        Gestão de contas a receber e pagamentos
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" onClick={() => { fetchCreditSales(); fetchDebtors(); }}>
                        <HiOutlineRefresh className="w-4 h-4 mr-2" />
                        Atualizar
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-red-100 text-sm">Total a Receber</p>
                            <p className="text-3xl font-bold">{formatCurrency(totalOutstanding)}</p>
                            <p className="text-red-200 text-xs mt-1">{debtors.length} devedores</p>
                        </div>
                        <HiOutlineExclamation className="w-12 h-12 text-red-200 opacity-75" />
                    </div>
                </Card>
                <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-amber-100 text-sm">Vendas Pendentes</p>
                            <p className="text-3xl font-bold">{sales.filter(s => !s.isPaid).length}</p>
                            <p className="text-amber-200 text-xs mt-1">aguardando pagamento</p>
                        </div>
                        <HiOutlineDocumentText className="w-12 h-12 text-amber-200 opacity-75" />
                    </div>
                </Card>
                <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-green-100 text-sm">Total em Crédito</p>
                            <p className="text-3xl font-bold">{total}</p>
                            <p className="text-green-200 text-xs mt-1">vendas a crédito</p>
                        </div>
                        <HiOutlineCreditCard className="w-12 h-12 text-green-200 opacity-75" />
                    </div>
                </Card>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200 dark:border-dark-700">
                <button
                    onClick={() => setActiveTab('sales')}
                    className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'sales'
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Vendas a Crédito
                </button>
                <button
                    onClick={() => setActiveTab('debtors')}
                    className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'debtors'
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Devedores ({debtors.length})
                </button>
            </div>

            {/* Sales Tab */}
            {activeTab === 'sales' && (
                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Lista de Vendas a Crédito
                        </h3>
                        <Select
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                            options={[
                                { value: '', label: 'Todos os status' },
                                { value: 'pending', label: 'Não pagas' },
                                { value: 'partial', label: 'Parcialmente pagas' }
                            ]}
                        />
                    </div>

                    {loading ? (
                        <div className="py-12 flex justify-center">
                            <LoadingSpinner size="lg" />
                        </div>
                    ) : sales.length === 0 ? (
                        <EmptyState
                            icon={<HiOutlineCreditCard className="w-12 h-12 text-gray-300" />}
                            title="Nenhuma venda a crédito"
                            description="As vendas a crédito aparecerão aqui"
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b dark:border-dark-700">
                                        <th className="text-left py-3 px-4 font-medium text-gray-500">Recibo</th>
                                        <th className="text-left py-3 px-4 font-medium text-gray-500">Data</th>
                                        <th className="text-left py-3 px-4 font-medium text-gray-500">Cliente</th>
                                        <th className="text-right py-3 px-4 font-medium text-gray-500">Total</th>
                                        <th className="text-right py-3 px-4 font-medium text-gray-500">Pago</th>
                                        <th className="text-right py-3 px-4 font-medium text-gray-500">Saldo</th>
                                        <th className="text-center py-3 px-4 font-medium text-gray-500">Status</th>
                                        <th className="text-right py-3 px-4 font-medium text-gray-500">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sales.map((sale: any) => (
                                        <tr key={sale.id} className="border-b dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-800">
                                            <td className="py-3 px-4 font-mono text-sm">
                                                {sale.receiptNumber}
                                            </td>
                                            <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                                                {formatDate(sale.createdAt)}
                                            </td>
                                            <td className="py-3 px-4">
                                                <div>
                                                    <p className="font-medium text-gray-900 dark:text-white">
                                                        {sale.customer?.name || 'Sem cliente'}
                                                    </p>
                                                    {sale.customer?.phone && (
                                                        <p className="text-xs text-gray-500">{sale.customer.phone}</p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-right font-medium">
                                                {formatCurrency(Number(sale.total))}
                                            </td>
                                            <td className="py-3 px-4 text-right text-green-600">
                                                {formatCurrency(Number(sale.paidAmount))}
                                            </td>
                                            <td className="py-3 px-4 text-right font-bold text-red-600">
                                                {formatCurrency(sale.remainingBalance)}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <Badge variant={
                                                    sale.isPaid ? 'success' :
                                                        Number(sale.paidAmount) > 0 ? 'warning' : 'danger'
                                                }>
                                                    {sale.isPaid ? 'Pago' :
                                                        Number(sale.paidAmount) > 0 ? 'Parcial' : 'Pendente'}
                                                </Badge>
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => viewSaleDetail(sale.id)}
                                                    >
                                                        Ver
                                                    </Button>
                                                    {!sale.isPaid && (
                                                        <Button
                                                            variant="primary"
                                                            size="sm"
                                                            onClick={() => openPaymentModal(sale)}
                                                        >
                                                            <HiOutlineCash className="w-4 h-4 mr-1" />
                                                            Pagar
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {total > pageSize && (
                        <div className="mt-4 flex justify-between items-center">
                            <Select
                                value={pageSize.toString()}
                                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                                options={[
                                    { value: '10', label: '10 por página' },
                                    { value: '20', label: '20 por página' },
                                    { value: '50', label: '50 por página' }
                                ]}
                            />
                            <Pagination
                                currentPage={page}
                                totalItems={total}
                                itemsPerPage={pageSize}
                                onPageChange={setPage}
                            />
                        </div>
                    )}
                </Card>
            )}

            {/* Debtors Tab */}
            {activeTab === 'debtors' && (
                <Card>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Relatório de Devedores
                    </h3>

                    {debtors.length === 0 ? (
                        <EmptyState
                            icon={<HiOutlineUser className="w-12 h-12 text-gray-300" />}
                            title="Nenhum devedor"
                            description="Não há clientes com dívidas pendentes"
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b dark:border-dark-700">
                                        <th className="text-left py-3 px-4 font-medium text-gray-500">Cliente</th>
                                        <th className="text-left py-3 px-4 font-medium text-gray-500">Telefone</th>
                                        <th className="text-center py-3 px-4 font-medium text-gray-500">Vendas</th>
                                        <th className="text-right py-3 px-4 font-medium text-gray-500">Total Crédito</th>
                                        <th className="text-right py-3 px-4 font-medium text-gray-500">Total Pago</th>
                                        <th className="text-right py-3 px-4 font-medium text-gray-500">Saldo Devedor</th>
                                        <th className="text-left py-3 px-4 font-medium text-gray-500">Dívida Mais Antiga</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {debtors.map((debtor: any) => (
                                        <tr key={debtor.id} className="border-b dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-800">
                                            <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">
                                                {debtor.name}
                                            </td>
                                            <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                                                {debtor.phone || '-'}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <Badge variant="info">{debtor.salesCount}</Badge>
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                {formatCurrency(debtor.totalCredit)}
                                            </td>
                                            <td className="py-3 px-4 text-right text-green-600">
                                                {formatCurrency(debtor.totalPaid)}
                                            </td>
                                            <td className="py-3 px-4 text-right font-bold text-red-600">
                                                {formatCurrency(debtor.outstanding)}
                                            </td>
                                            <td className="py-3 px-4 text-gray-500">
                                                {debtor.oldestDebt ? formatDate(debtor.oldestDebt) : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-gray-50 dark:bg-dark-800 font-bold">
                                        <td colSpan={5} className="py-3 px-4 text-right">
                                            Total a Receber:
                                        </td>
                                        <td className="py-3 px-4 text-right text-red-600 text-lg">
                                            {formatCurrency(totalOutstanding)}
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </Card>
            )}

            {/* Payment Modal */}
            <Modal
                isOpen={paymentModalOpen}
                onClose={() => setPaymentModalOpen(false)}
                title="Registrar Pagamento"
                size="md"
            >
                {selectedSale && (
                    <div className="space-y-4">
                        <div className="p-4 bg-gray-50 dark:bg-dark-800 rounded-lg">
                            <p className="text-sm text-gray-500">Recibo: {selectedSale.receiptNumber}</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">
                                {selectedSale.customer?.name || 'Consumidor Final'}
                            </p>
                            <div className="flex justify-between mt-2">
                                <span className="text-gray-500">Saldo devedor:</span>
                                <span className="font-bold text-red-600">
                                    {formatCurrency(selectedSale.remainingBalance)}
                                </span>
                            </div>
                        </div>

                        <Input
                            label="Valor do Pagamento (MT) *"
                            type="number"
                            step="0.01"
                            max={selectedSale.remainingBalance}
                            value={paymentData.amount}
                            onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                            placeholder="0.00"
                        />

                        <Select
                            label="Método de Pagamento"
                            value={paymentData.paymentMethod}
                            onChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.target.value })}
                            options={[
                                { value: 'cash', label: 'Dinheiro' },
                                { value: 'mpesa', label: 'M-Pesa' },
                                { value: 'emola', label: 'E-Mola' },
                                { value: 'card', label: 'Cartão' },
                                { value: 'transfer', label: 'Transferência' }
                            ]}
                        />

                        {['mpesa', 'emola', 'transfer'].includes(paymentData.paymentMethod) && (
                            <Input
                                label="Referência da Transação"
                                value={paymentData.reference}
                                onChange={(e) => setPaymentData({ ...paymentData, reference: e.target.value })}
                                placeholder="Ex: MP123456789"
                            />
                        )}

                        <Input
                            label="Observações (opcional)"
                            value={paymentData.notes}
                            onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                            placeholder="Notas adicionais..."
                        />

                        <div className="flex gap-3 pt-4">
                            <Button variant="ghost" fullWidth onClick={() => setPaymentModalOpen(false)}>
                                Cancelar
                            </Button>
                            <Button fullWidth onClick={handlePayment} isLoading={submitting}>
                                Confirmar Pagamento
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Detail Modal */}
            <Modal
                isOpen={detailModalOpen}
                onClose={() => setDetailModalOpen(false)}
                title="Detalhes da Venda"
                size="lg"
            >
                {loadingDetail ? (
                    <div className="py-12 flex justify-center">
                        <LoadingSpinner size="lg" />
                    </div>
                ) : saleDetail && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-gray-500">Recibo</p>
                                <p className="font-medium">{saleDetail.sale.receiptNumber}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Data</p>
                                <p className="font-medium">{formatDateTime(saleDetail.sale.createdAt)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Cliente</p>
                                <p className="font-medium">{saleDetail.sale.customer?.name || 'Consumidor Final'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Status</p>
                                <Badge variant={saleDetail.isPaid ? 'success' : 'warning'}>
                                    {saleDetail.isPaid ? 'Pago' : 'Pendente'}
                                </Badge>
                            </div>
                        </div>

                        <div className="border-t dark:border-dark-700 pt-4">
                            <p className="font-medium mb-2">Itens</p>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b dark:border-dark-700">
                                        <th className="text-left py-2">Produto</th>
                                        <th className="text-center py-2">Qtd</th>
                                        <th className="text-right py-2">Preço</th>
                                        <th className="text-right py-2">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {saleDetail.sale.items?.map((item: any, i: number) => (
                                        <tr key={i} className="border-b dark:border-dark-700">
                                            <td className="py-2">{item.product?.name || 'Produto'}</td>
                                            <td className="py-2 text-center">{item.quantity}</td>
                                            <td className="py-2 text-right">{formatCurrency(Number(item.unitPrice))}</td>
                                            <td className="py-2 text-right">{formatCurrency(Number(item.total))}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-between p-3 bg-gray-50 dark:bg-dark-800 rounded-lg">
                            <div>
                                <p className="text-sm text-gray-500">Total</p>
                                <p className="text-xl font-bold">{formatCurrency(Number(saleDetail.sale.total))}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Pago</p>
                                <p className="text-xl font-bold text-green-600">{formatCurrency(saleDetail.totalPaid)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Saldo</p>
                                <p className="text-xl font-bold text-red-600">{formatCurrency(saleDetail.remaining)}</p>
                            </div>
                        </div>

                        {saleDetail.payments?.length > 0 && (
                            <div className="border-t dark:border-dark-700 pt-4">
                                <p className="font-medium mb-2">Histórico de Pagamentos</p>
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b dark:border-dark-700">
                                            <th className="text-left py-2">Data</th>
                                            <th className="text-left py-2">Método</th>
                                            <th className="text-right py-2">Valor</th>
                                            <th className="text-left py-2">Recebido Por</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {saleDetail.payments.map((payment: any) => (
                                            <tr key={payment.id} className="border-b dark:border-dark-700">
                                                <td className="py-2">{formatDateTime(payment.paidAt)}</td>
                                                <td className="py-2">
                                                    <Badge>
                                                        {payment.paymentMethod === 'cash' ? 'Dinheiro' :
                                                            payment.paymentMethod === 'mpesa' ? 'M-Pesa' :
                                                                payment.paymentMethod === 'emola' ? 'E-Mola' :
                                                                    payment.paymentMethod}
                                                    </Badge>
                                                </td>
                                                <td className="py-2 text-right font-medium text-green-600">
                                                    {formatCurrency(Number(payment.amount))}
                                                </td>
                                                <td className="py-2 text-gray-500">{payment.receivedBy}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="pt-4">
                            <Button variant="ghost" onClick={() => setDetailModalOpen(false)}>
                                Fechar
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
