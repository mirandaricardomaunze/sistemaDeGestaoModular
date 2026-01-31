import { useState, useEffect } from 'react';
import { Card, Button, Input, Badge, Modal, LoadingSpinner, EmptyState } from '../../components/ui';
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
import toast from 'react-hot-toast';

export default function CashRegister() {
    // State
    const [currentSession, setCurrentSession] = useState<any>(null);
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState<any[]>([]);

    // Modal states
    const [openModalOpen, setOpenModalOpen] = useState(false);
    const [closeModalOpen, setCloseModalOpen] = useState(false);
    const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
    const [depositModalOpen, setDepositModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form states
    const [openingBalance, setOpeningBalance] = useState('');
    const [closingBalance, setClosingBalance] = useState('');
    const [closingNotes, setClosingNotes] = useState('');
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [depositAmount, setDepositAmount] = useState('');

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
            console.error('Error fetching session:', error);
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
            console.error('Error fetching history:', error);
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
                ? 'bg-gradient-to-br from-green-500 to-green-600'
                : 'bg-gradient-to-br from-red-500 to-red-600'} text-white`}>
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
                                {history.map((session: any) => (
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
        </div>
    );
}
