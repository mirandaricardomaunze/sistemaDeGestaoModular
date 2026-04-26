import { logger } from '../../utils/logger';
import { useState, useEffect } from 'react';
import { Card, Button, Input, Badge, Modal, LoadingSpinner, EmptyState, Pagination, usePagination } from '../../components/ui';
import {
    HiOutlineCash,
    HiOutlineRefresh,
    HiOutlineLockOpen,
    HiOutlineLockClosed,
    HiOutlineTrendingUp,
    HiOutlineMinus,
    HiOutlinePlus,
    HiOutlineDocumentReport
} from 'react-icons/hi';
import { bottleStoreAPI } from '../../services/api/bottle-store.api';
import { formatCurrency, formatDateTime } from '../../utils/helpers';
import { PrinterService } from '../../services/printer.service';
import toast from 'react-hot-toast';

export default function CashRegister() {
    // State
    const [currentSession, setCurrentSession] = useState<any>(null);
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState<any[]>([]);
    const { paginatedItems: pagedHistory, currentPage: histPage, setCurrentPage: setHistPage, totalItems: histTotal, itemsPerPage: histPerPage, setItemsPerPage: setHistPerPage } = usePagination(history, 10);

    // Modal states
    const [openModalOpen, setOpenModalOpen] = useState(false);
    const [closeModalOpen, setCloseModalOpen] = useState(false);
    const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
    const [depositModalOpen, setDepositModalOpen] = useState(false);
    const [zReportOpen, setZReportOpen] = useState(false);
    const [zReport, setZReport] = useState<any>(null);
    const [loadingZReport, setLoadingZReport] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form states
    const [openingBalance, setOpeningBalance] = useState('');
    const [closingBalance, setClosingBalance] = useState('');
    const [closingNotes, setClosingNotes] = useState('');
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [depositAmount, setDepositAmount] = useState('');

    const fetchZReport = async () => {
        setLoadingZReport(true);
        setZReportOpen(true);
        try {
            const report = await bottleStoreAPI.getZReport();
            setZReport(report);
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao gerar relatório Z');
            setZReportOpen(false);
        } finally {
            setLoadingZReport(false);
        }
    };

    const printZReport = () => {
        if (!zReport) return;
        const w = window.open('', '_blank');
        if (!w) return;
        const r = zReport;
        w.document.write(`<html><head><title>Relatório Z</title>
        <style>body{font-family:monospace;font-size:12px;margin:20px}h2{text-align:center}hr{border-top:1px dashed #000}
        table{width:100%}td{padding:2px 4px}td:last-child{text-align:right}.total{font-weight:bold}</style></head><body>
        <h2>${r.company?.name || 'GARRAFEIRA'}</h2>
        <p style="text-align:center">${r.company?.address || ''} | ${r.company?.phone || ''}</p>
        <hr/><h3>RELATÓRIO Z - FECHO DE TURNO</h3>
        <table>
            <tr><td>Turno:</td><td>${r.session?.id?.slice(-8)}</td></tr>
            <tr><td>Aberto por:</td><td>${r.session?.openedByName || '-'}</td></tr>
            <tr><td>Abertura:</td><td>${new Date(r.session?.openedAt).toLocaleString('pt-MZ')}</td></tr>
            ${r.session?.closedAt ? `<tr><td>Fecho:</td><td>${new Date(r.session.closedAt).toLocaleString('pt-MZ')}</td></tr>` : ''}
        </table><hr/>
        <h3>VENDAS POR MÉTODO</h3>
        <table>
            <tr><td>Dinheiro</td><td>${r.byMethod?.cash?.toFixed(2)} MT</td></tr>
            <tr><td>M-Pesa</td><td>${r.byMethod?.mpesa?.toFixed(2)} MT</td></tr>
            <tr><td>E-Mola</td><td>${r.byMethod?.emola?.toFixed(2)} MT</td></tr>
            <tr><td>Cartão</td><td>${r.byMethod?.card?.toFixed(2)} MT</td></tr>
            <tr><td>Crédito</td><td>${r.byMethod?.credit?.toFixed(2)} MT</td></tr>
            <tr class="total"><td>TOTAL</td><td>${r.totalSales?.toFixed(2)} MT</td></tr>
        </table><hr/>
        <h3>RECONCILIAÇÃO</h3>
        <table>
            <tr><td>Saldo inicial</td><td>${r.openingBalance?.toFixed(2)} MT</td></tr>
            <tr><td>+ Vendas (dinheiro)</td><td>${r.byMethod?.cash?.toFixed(2)} MT</td></tr>
            <tr><td>+ Depósitos</td><td>${r.totalDeposits?.toFixed(2)} MT</td></tr>
            <tr><td>- Levantamentos</td><td>${r.totalWithdrawals?.toFixed(2)} MT</td></tr>
            <tr class="total"><td>Saldo esperado</td><td>${r.expectedBalance?.toFixed(2)} MT</td></tr>
            ${r.closingBalance ? `<tr><td>Saldo contado</td><td>${r.closingBalance?.toFixed(2)} MT</td></tr>
            <tr class="total"><td>Diferença</td><td>${r.difference?.toFixed(2)} MT</td></tr>` : ''}
        </table><hr/>
        <h3>TOP PRODUTOS</h3>
        <table><tr><th style="text-align:left">Produto</th><th>Qtd</th><th>Total</th></tr>
        ${(r.topProducts || []).map((p: any) => `<tr><td>${p.name}</td><td style="text-align:right">${p.qty}</td><td style="text-align:right">${p.total?.toFixed(2)} MT</td></tr>`).join('')}
        </table><hr/>
        <p style="text-align:center;font-size:10px">Gerado em ${new Date(r.generatedAt).toLocaleString('pt-MZ')}</p>
        </body></html>`);
        w.document.close();
        w.print();
    };

    // Fetch current session
    const fetchCurrentSession = async () => {
        setLoading(true);
        try {
            const session = await bottleStoreAPI.getCurrentCashSession();
            setCurrentSession(session);

            if (session) {
                const summaryData = await bottleStoreAPI.getCashSessionSummary();
                setSummary(summaryData);
            }
        } catch (error) {
            logger.error('Error fetching session:', error);
        } finally {
            setLoading(false);
        }
    };

    // Fetch history
    const fetchHistory = async () => {
        try {
            const res = await bottleStoreAPI.getCashSessionHistory({ limit: 10 });
            setHistory(res.data || []);
        } catch (error) {
            logger.error('Error fetching history:', error);
        }
    };

    useEffect(() => {
        fetchCurrentSession();
        fetchHistory();
    }, []);

    // Open cash session
    const handleOpenSession = async () => {
        setSubmitting(true);
        try {
            await bottleStoreAPI.openCashSession(parseFloat(openingBalance) || 0);
            toast.success('Caixa aberto com sucesso!');
            setOpenModalOpen(false);
            setOpeningBalance('');
            fetchCurrentSession();
        } catch (error: any) {
            toast.error(error.message || 'Erro ao abrir caixa');
        } finally {
            setSubmitting(false);
        }
    };

    // Close cash session
    const handleCloseSession = async () => {
        if (!closingBalance) {
            toast.error('Informe o saldo final');
            return;
        }
        setSubmitting(true);
        try {
            await bottleStoreAPI.closeCashSession({
                actualBalance: parseFloat(closingBalance),
                notes: closingNotes
            });
            toast.success('Caixa fechado com sucesso!');
            setCloseModalOpen(false);
            setClosingBalance('');
            setClosingNotes('');
            fetchCurrentSession();
            fetchHistory();
        } catch (error: any) {
            toast.error(error.message || 'Erro ao fechar caixa');
        } finally {
            setSubmitting(false);
        }
    };

    // Withdrawal
    const handleWithdrawal = async () => {
        if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
            toast.error('Informe um valor válido');
            return;
        }
        setSubmitting(true);
        try {
            await bottleStoreAPI.registerCashWithdrawal(parseFloat(withdrawAmount));
            toast.success('Levantamento registrado!');
            setWithdrawModalOpen(false);
            setWithdrawAmount('');
            fetchCurrentSession();
        } catch (error: any) {
            toast.error(error.message || 'Erro ao registrar levantamento');
        } finally {
            setSubmitting(false);
        }
    };

    // Deposit
    const handleDeposit = async () => {
        if (!depositAmount || parseFloat(depositAmount) <= 0) {
            toast.error('Informe um valor válido');
            return;
        }
        setSubmitting(true);
        try {
            await bottleStoreAPI.registerCashDeposit(parseFloat(depositAmount));
            toast.success('Depósito registrado!');
            setDepositModalOpen(false);
            setDepositAmount('');
            fetchCurrentSession();
        } catch (error: any) {
            toast.error(error.message || 'Erro ao registrar depósito');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="p-6 flex justify-center items-center min-h-[400px]">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Controlo de Caixa
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        Gestão de abertura e fecho de caixa
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" onClick={fetchZReport}>
                        <HiOutlineDocumentReport className="w-4 h-4 mr-2" />
                        Relatório Z
                    </Button>
                    <Button variant="outline" onClick={fetchCurrentSession}>
                        <HiOutlineRefresh className="w-4 h-4 mr-2" />
                        Atualizar
                    </Button>
                    {!currentSession ? (
                        <Button onClick={() => setOpenModalOpen(true)}>
                            <HiOutlineLockOpen className="w-4 h-4 mr-2" />
                            Abrir Caixa
                        </Button>
                    ) : (
                        <>
                            <Button variant="outline" onClick={() => PrinterService.openDrawer()}>
                                <HiOutlineLockOpen className="w-4 h-4 mr-2" />
                                Abrir Gaveta
                            </Button>
                            <Button variant="outline" onClick={() => setWithdrawModalOpen(true)}>
                                <HiOutlineMinus className="w-4 h-4 mr-2" />
                                Levantamento
                            </Button>
                            <Button variant="outline" onClick={() => setDepositModalOpen(true)}>
                                <HiOutlinePlus className="w-4 h-4 mr-2" />
                                Depósito
                            </Button>
                            <Button variant="primary" onClick={() => setCloseModalOpen(true)}>
                                <HiOutlineLockClosed className="w-4 h-4 mr-2" />
                                Fechar Caixa
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Status Card */}
            <Card className={`${currentSession
                ? 'bg-green-600'
                : 'bg-red-600'} text-white`}>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-white/80 text-sm">Estado do Caixa</p>
                        <p className="text-3xl font-bold">
                            {currentSession ? 'ABERTO' : 'FECHADO'}
                        </p>
                        {currentSession && (
                            <p className="text-white/70 text-sm mt-1">
                                Aberto em {formatDateTime(currentSession.openedAt)} por {currentSession.openedBy}
                            </p>
                        )}
                    </div>
                    {currentSession ? (
                        <HiOutlineLockOpen className="w-16 h-16 text-white/50" />
                    ) : (
                        <HiOutlineLockClosed className="w-16 h-16 text-white/50" />
                    )}
                </div>
            </Card>

            {/* Session Summary */}
            {currentSession && summary && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                                <HiOutlineCash className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Saldo Inicial</p>
                                <p className="text-xl font-bold text-gray-900 dark:text-white">
                                    {formatCurrency(Number(currentSession.openingBalance))}
                                </p>
                            </div>
                        </div>
                    </Card>
                    <Card>
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-green-100 text-green-600 rounded-lg">
                                <HiOutlineTrendingUp className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Vendas do Dia</p>
                                <p className="text-xl font-bold text-green-600">
                                    {formatCurrency(summary.totalSales || 0)}
                                </p>
                                <p className="text-xs text-gray-400">{summary.salesCount || 0} vendas</p>
                            </div>
                        </div>
                    </Card>
                    <Card>
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-amber-100 text-amber-600 rounded-lg">
                                <HiOutlineMinus className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Levantamentos</p>
                                <p className="text-xl font-bold text-amber-600">
                                    {formatCurrency(Number(currentSession.withdrawals))}
                                </p>
                            </div>
                        </div>
                    </Card>
                    <Card>
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-purple-100 text-purple-600 rounded-lg">
                                <HiOutlinePlus className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Depósitos</p>
                                <p className="text-xl font-bold text-purple-600">
                                    {formatCurrency(Number(currentSession.deposits))}
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* Sales by Payment Method */}
            {currentSession && summary?.byPaymentMethod && (
                <Card>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Vendas por Método de Pagamento
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {[
                            { label: 'Dinheiro', value: summary.byPaymentMethod.cash, color: 'bg-green-500' },
                            { label: 'M-Pesa', value: summary.byPaymentMethod.mpesa, color: 'bg-red-500' },
                            { label: 'E-Mola', value: summary.byPaymentMethod.emola, color: 'bg-orange-500' },
                            { label: 'Cartão', value: summary.byPaymentMethod.card, color: 'bg-blue-500' },
                            { label: 'Crédito', value: summary.byPaymentMethod.credit, color: 'bg-purple-500' }
                        ].map((item, i) => (
                            <div key={i} className="p-4 bg-gray-50 dark:bg-dark-800 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                                    <span className="text-sm text-gray-500">{item.label}</span>
                                </div>
                                <p className="text-xl font-bold text-gray-900 dark:text-white">
                                    {formatCurrency(item.value || 0)}
                                </p>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* History */}
            <Card>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Histórico de Sessões Anteriores
                </h3>
                {history.length === 0 ? (
                    <EmptyState
                        icon={<HiOutlineDocumentReport className="w-12 h-12 text-gray-300" />}
                        title="Sem histórico"
                        description="Nenhuma sessão de caixa anterior encontrada"
                    />
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b dark:border-dark-700">
                                        <th className="text-left py-3 px-4 font-medium text-gray-500">Data</th>
                                        <th className="text-left py-3 px-4 font-medium text-gray-500">Operador</th>
                                        <th className="text-right py-3 px-4 font-medium text-gray-500">Abertura</th>
                                        <th className="text-right py-3 px-4 font-medium text-gray-500">Vendas</th>
                                        <th className="text-right py-3 px-4 font-medium text-gray-500">Fecho</th>
                                        <th className="text-right py-3 px-4 font-medium text-gray-500">Diferença</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedHistory.map((session: any) => (
                                        <tr key={session.id} className="border-b dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-800">
                                            <td className="py-3 px-4">{formatDateTime(session.closedAt)}</td>
                                            <td className="py-3 px-4">{session.openedBy}</td>
                                            <td className="py-3 px-4 text-right">{formatCurrency(Number(session.openingBalance))}</td>
                                            <td className="py-3 px-4 text-right text-green-600 font-medium">
                                                {formatCurrency(Number(session.totalSales))}
                                            </td>
                                            <td className="py-3 px-4 text-right">{formatCurrency(Number(session.closingBalance))}</td>
                                            <td className="py-3 px-4 text-right">
                                                <Badge variant={Number(session.difference) === 0 ? 'success' : Number(session.difference) > 0 ? 'primary' : 'danger'}>
                                                    {formatCurrency(Number(session.difference))}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <Pagination
                            currentPage={histPage}
                            totalItems={histTotal}
                            itemsPerPage={histPerPage}
                            onPageChange={setHistPage}
                            onItemsPerPageChange={setHistPerPage}
                            itemsPerPageOptions={[10, 20, 50]}
                        />
                    </>
                )}
            </Card>

            {/* Open Modal */}
            <Modal
                isOpen={openModalOpen}
                onClose={() => setOpenModalOpen(false)}
                title="Abrir Caixa"
            >
                <div className="space-y-4">
                    <Input
                        label="Saldo Inicial (MT)"
                        type="number"
                        step="0.01"
                        value={openingBalance}
                        onChange={(e) => setOpeningBalance(e.target.value)}
                        placeholder="0.00"
                    />
                    <div className="flex gap-3 pt-4">
                        <Button variant="ghost" fullWidth onClick={() => setOpenModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button fullWidth onClick={handleOpenSession} isLoading={submitting}>
                            Abrir Caixa
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Close Modal */}
            <Modal
                isOpen={closeModalOpen}
                onClose={() => setCloseModalOpen(false)}
                title="Fechar Caixa"
            >
                <div className="space-y-4">
                    {summary && (
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">Saldo Esperado (estimado):</p>
                            <p className="text-2xl font-bold text-blue-600">
                                {formatCurrency(
                                    Number(currentSession?.openingBalance || 0) +
                                    (summary.byPaymentMethod?.cash || 0) -
                                    Number(currentSession?.withdrawals || 0) +
                                    Number(currentSession?.deposits || 0)
                                )}
                            </p>
                        </div>
                    )}
                    <Input
                        label="Saldo Final Contado (MT) *"
                        type="number"
                        step="0.01"
                        value={closingBalance}
                        onChange={(e) => setClosingBalance(e.target.value)}
                        placeholder="Digite o valor contado..."
                    />
                    <Input
                        label="Observações (opcional)"
                        value={closingNotes}
                        onChange={(e) => setClosingNotes(e.target.value)}
                        placeholder="Notas sobre diferenças, etc..."
                    />
                    <div className="flex gap-3 pt-4">
                        <Button variant="ghost" fullWidth onClick={() => setCloseModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button fullWidth onClick={handleCloseSession} isLoading={submitting}>
                            Fechar Caixa
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Withdrawal Modal */}
            <Modal
                isOpen={withdrawModalOpen}
                onClose={() => setWithdrawModalOpen(false)}
                title="Registrar Levantamento"
            >
                <div className="space-y-4">
                    <Input
                        label="Valor do Levantamento (MT)"
                        type="number"
                        step="0.01"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder="0.00"
                    />
                    <div className="flex gap-3 pt-4">
                        <Button variant="ghost" fullWidth onClick={() => setWithdrawModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button fullWidth onClick={handleWithdrawal} isLoading={submitting}>
                            Confirmar Levantamento
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Deposit Modal */}
            <Modal
                isOpen={depositModalOpen}
                onClose={() => setDepositModalOpen(false)}
                title="Registrar Depósito"
            >
                <div className="space-y-4">
                    <Input
                        label="Valor do Depósito (MT)"
                        type="number"
                        step="0.01"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        placeholder="0.00"
                    />
                    <div className="flex gap-3 pt-4">
                        <Button variant="ghost" fullWidth onClick={() => setDepositModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button fullWidth onClick={handleDeposit} isLoading={submitting}>
                            Confirmar Depósito
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Z Report Modal */}
            <Modal
                isOpen={zReportOpen}
                onClose={() => setZReportOpen(false)}
                title="Relatório Z - Fecho de Turno"
                size="lg"
            >
                {loadingZReport ? (
                    <div className="flex justify-center items-center py-16">
                        <LoadingSpinner size="lg" />
                    </div>
                ) : zReport ? (
                    <div className="space-y-5 text-sm">
                        {/* Company header */}
                        <div className="text-center border-b pb-4 dark:border-dark-700">
                            <p className="text-lg font-bold">{zReport.company?.name}</p>
                            <p className="text-gray-500 text-xs">{zReport.company?.address} | {zReport.company?.phone}</p>
                            {zReport.company?.nuit && <p className="text-gray-500 text-xs">NUIT: {zReport.company.nuit}</p>}
                        </div>

                        {/* Session info */}
                        <div className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-dark-800 rounded-lg p-4">
                            <div><span className="text-gray-500">Turno:</span> <span className="font-mono font-bold">#{zReport.session?.id?.slice(-8)}</span></div>
                            <div><span className="text-gray-500">Operador:</span> {zReport.session?.openedByName || '-'}</div>
                            <div><span className="text-gray-500">Abertura:</span> {zReport.session?.openedAt ? new Date(zReport.session.openedAt).toLocaleString('pt-MZ') : '-'}</div>
                            <div><span className="text-gray-500">Fecho:</span> {zReport.session?.closedAt ? new Date(zReport.session.closedAt).toLocaleString('pt-MZ') : 'Em curso'}</div>
                            <div><span className="text-gray-500">Transaces:</span> <strong>{zReport.totalTransactions}</strong></div>
                            <div><span className="text-gray-500">IVA Total:</span> {formatCurrency(zReport.totalTax || 0)}</div>
                        </div>

                        {/* Sales by method */}
                        <div>
                            <h4 className="font-semibold mb-3">Vendas por Método de Pagamento</h4>
                            <div className="space-y-2">
                                {[
                                    { label: 'Dinheiro', value: zReport.byMethod?.cash, color: 'bg-green-500' },
                                    { label: 'M-Pesa', value: zReport.byMethod?.mpesa, color: 'bg-red-500' },
                                    { label: 'E-Mola', value: zReport.byMethod?.emola, color: 'bg-orange-500' },
                                    { label: 'Cartão', value: zReport.byMethod?.card, color: 'bg-blue-500' },
                                    { label: 'Crédito', value: zReport.byMethod?.credit, color: 'bg-purple-500' },
                                ].map((m, i) => (
                                    <div key={i} className="flex items-center justify-between py-1.5 border-b dark:border-dark-700 last:border-0">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${m.color}`} />
                                            <span className="text-gray-600 dark:text-gray-400">{m.label}</span>
                                        </div>
                                        <span className="font-semibold">{formatCurrency(m.value || 0)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between pt-2 font-bold text-base">
                                    <span>TOTAL VENDAS</span>
                                    <span className="text-green-600">{formatCurrency(zReport.totalSales || 0)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Cash reconciliation */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                            <h4 className="font-semibold mb-3 text-blue-800 dark:text-blue-300">Reconciliação de Caixa</h4>
                            <div className="space-y-1.5 text-sm">
                                <div className="flex justify-between"><span>Saldo inicial</span><span>{formatCurrency(zReport.openingBalance || 0)}</span></div>
                                <div className="flex justify-between text-green-600"><span>+ Vendas dinheiro</span><span>+{formatCurrency(zReport.byMethod?.cash || 0)}</span></div>
                                {zReport.totalDeposits > 0 && <div className="flex justify-between text-green-600"><span>+ Depósitos</span><span>+{formatCurrency(zReport.totalDeposits)}</span></div>}
                                {zReport.totalWithdrawals > 0 && <div className="flex justify-between text-red-500"><span>- Levantamentos</span><span>-{formatCurrency(zReport.totalWithdrawals)}</span></div>}
                                <div className="flex justify-between font-bold border-t pt-1.5 dark:border-blue-700"><span>Saldo esperado</span><span>{formatCurrency(zReport.expectedBalance || 0)}</span></div>
                                {zReport.closingBalance > 0 && <>
                                    <div className="flex justify-between"><span>Saldo contado</span><span>{formatCurrency(zReport.closingBalance)}</span></div>
                                    <div className={`flex justify-between font-bold ${zReport.difference === 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        <span>Diferença</span><span>{formatCurrency(zReport.difference || 0)}</span>
                                    </div>
                                </>}
                            </div>
                        </div>

                        {/* Top products */}
                        {zReport.topProducts?.length > 0 && (
                            <div>
                                <h4 className="font-semibold mb-3">Top Produtos Vendidos</h4>
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-gray-50 dark:bg-dark-800">
                                            <th className="text-left py-2 px-3">Produto</th>
                                            <th className="text-right py-2 px-3">Qtd</th>
                                            <th className="text-right py-2 px-3">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {zReport.topProducts.map((p: any, i: number) => (
                                            <tr key={i} className="border-b dark:border-dark-700">
                                                <td className="py-1.5 px-3">{p.name}</td>
                                                <td className="py-1.5 px-3 text-right">{p.qty}</td>
                                                <td className="py-1.5 px-3 text-right font-medium">{formatCurrency(p.total)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="flex gap-3 pt-2 border-t dark:border-dark-700">
                            <Button variant="ghost" fullWidth onClick={() => setZReportOpen(false)}>Fechar</Button>
                            <Button fullWidth onClick={printZReport}>
                                <HiOutlineDocumentReport className="w-4 h-4 mr-2" />
                                Imprimir Relatório Z
                            </Button>
                        </div>
                    </div>
                ) : null}
            </Modal>
        </div>
    );
}
