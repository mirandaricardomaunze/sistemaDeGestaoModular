import { useState, useEffect } from 'react';
import { Card, Button, Input, Badge, Modal, Select, EmptyState, LoadingSpinner } from '../../components/ui';
import {
    HiOutlineRefresh,
    HiOutlinePlus,
    HiOutlineCube,
    HiOutlineArrowLeft,
    HiOutlineArrowRight,
    HiOutlineDownload,
    HiOutlinePrinter
} from 'react-icons/hi';
import { bottleStoreAPI } from '../../services/api/bottle-store.api';
import { useProducts, useCustomers } from '../../hooks/useData';
import Pagination from '../../components/ui/Pagination';
import { formatCurrency, formatDateTime } from '../../utils/helpers';
import toast from 'react-hot-toast';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';
import { useStore } from '../../stores/useStore';

export default function BottleReturns() {
    const { companySettings } = useStore();
    // State
    const [movements, setMovements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [total, setTotal] = useState(0);

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [modalType, setModalType] = useState<'deposit' | 'return'>('return');
    const [formData, setFormData] = useState({
        customerId: '',
        productId: '',
        quantity: 1,
        depositAmount: 0,
        refundAmount: 0,
        notes: ''
    });
    const [submitting, setSubmitting] = useState(false);

    // Hooks
    const { products } = useProducts({ category: 'beverages' });
    const { customers } = useCustomers();

    const returnableProducts = products.filter((p: any) => p.isReturnable);

    // Fetch movements
    const fetchMovements = async () => {
        setLoading(true);
        try {
            const res = await bottleStoreAPI.getBottleReturns({ page, limit: pageSize });
            setMovements(res.data || []);
            setTotal(res.total || 0);
        } catch (error) {
            toast.error('Erro ao carregar movimentos');
        } finally {
            setLoading(false);
        }
    };

    // Fetch summary
    const fetchSummary = async () => {
        try {
            const res = await bottleStoreAPI.getBottleReturnsSummary();
            setSummary(res || []);
        } catch (error) {
            console.error('Error fetching summary:', error);
        }
    };

    useEffect(() => {
        fetchMovements();
        fetchSummary();
    }, [page, pageSize]);

    // Handle form submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.productId) {
            toast.error('Selecione um produto');
            return;
        }

        setSubmitting(true);
        try {
            if (modalType === 'deposit') {
                await bottleStoreAPI.recordBottleDeposit({
                    customerId: formData.customerId || undefined,
                    productId: formData.productId,
                    quantity: formData.quantity,
                    depositAmount: formData.depositAmount,
                    notes: formData.notes
                });
                toast.success('Depósito de vasilhame registrado!');
            } else {
                await bottleStoreAPI.recordBottleReturn({
                    customerId: formData.customerId || undefined,
                    productId: formData.productId,
                    quantity: formData.quantity,
                    refundAmount: formData.refundAmount,
                    notes: formData.notes
                });
                toast.success('Devolução de vasilhame registrada!');
            }
            setModalOpen(false);
            setFormData({ customerId: '', productId: '', quantity: 1, depositAmount: 0, refundAmount: 0, notes: '' });
            fetchMovements();
            fetchSummary();
        } catch (error: any) {
            toast.error(error.message || 'Erro ao registrar');
        } finally {
            setSubmitting(false);
        }
    };

    const handleExportExcel = () => {
        exportToExcel({
            filename: 'movimentos_vasilhames',
            title: 'Movimentos de Vasilhames',
            companyName: companySettings.companyName,
            columns: [
                { key: 'createdAt', header: 'Data', format: 'datetime', width: 22 },
                { key: 'typeLabel', header: 'Tipo', width: 15 },
                { key: 'product.name', header: 'Produto', width: 30 },
                { key: 'customerName', header: 'Cliente', width: 20 },
                { key: 'quantity', header: 'Qtd', format: 'number', width: 10, align: 'center' },
                { key: 'value', header: 'Valor', format: 'currency', width: 15 },
                { key: 'performedBy', header: 'Operador', width: 20 },
            ],
            data: movements.map(m => ({
                ...m,
                value: m.depositPaid || m.depositRefunded || 0,
                typeLabel: m.type === 'deposit' ? 'Depósito' : m.type === 'return' ? 'Devolução' : 'Ajuste',
                customerName: m.customer?.name || 'Consumidor Final'
            }))
        });
    };

    const handleExportPDF = () => {
        exportToPDF({
            filename: 'movimentos_vasilhames',
            title: 'Movimentos de Vasilhames',
            companyName: companySettings.companyName,
            orientation: 'landscape',
            columns: [
                { key: 'createdAt', header: 'Data', format: 'datetime' },
                { key: 'typeLabel', header: 'Tipo' },
                { key: 'product.name', header: 'Produto' },
                { key: 'customerName', header: 'Cliente' },
                { key: 'quantity', header: 'Qtd', format: 'number', align: 'center' },
                { key: 'value', header: 'Valor', format: 'currency' },
                { key: 'performedBy', header: 'Operador' },
            ],
            data: movements.map(m => ({
                ...m,
                value: m.depositPaid || m.depositRefunded || 0,
                typeLabel: m.type === 'deposit' ? 'Depósito' : m.type === 'return' ? 'Devolução' : 'Ajuste',
                customerName: m.customer?.name || 'Consumidor Final'
            }))
        });
    };

    // Update price when product changes
    const handleProductChange = (productId: string) => {
        const product = returnableProducts.find((p: any) => p.id === productId);
        setFormData({
            ...formData,
            productId,
            depositAmount: product ? Number((product as any).returnPrice) * formData.quantity : 0,
            refundAmount: product ? Number((product as any).returnPrice) * formData.quantity : 0
        });
    };

    const totalInCirculation = summary.reduce((sum, s) => sum + (s.inCirculation || 0), 0);

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Gestão de Vasilhames
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        Controle de cascos e garrafas retornáveis
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" onClick={fetchMovements}>
                        <HiOutlineRefresh className="w-4 h-4 mr-2" />
                        Atualizar
                    </Button>
                    <Button variant="outline" onClick={() => { setModalType('deposit'); setModalOpen(true); }}>
                        <HiOutlineArrowRight className="w-4 h-4 mr-2" />
                        Registrar Depósito
                    </Button>
                    <Button onClick={() => { setModalType('return'); setModalOpen(true); }}>
                        <HiOutlineArrowLeft className="w-4 h-4 mr-2" />
                        Registrar Devolução
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-amber-100 text-sm">Total em Circulação</p>
                            <p className="text-3xl font-bold">{totalInCirculation}</p>
                            <p className="text-amber-200 text-xs mt-1">vasilhames com clientes</p>
                        </div>
                        <HiOutlineCube className="w-12 h-12 text-amber-200 opacity-75" />
                    </div>
                </Card>
                <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-green-100 text-sm">Produtos Retornáveis</p>
                            <p className="text-3xl font-bold">{returnableProducts.length}</p>
                            <p className="text-green-200 text-xs mt-1">tipos cadastrados</p>
                        </div>
                        <HiOutlineRefresh className="w-12 h-12 text-green-200 opacity-75" />
                    </div>
                </Card>
                <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-blue-100 text-sm">Movimentos Hoje</p>
                            <p className="text-3xl font-bold">{movements.filter(m =>
                                new Date(m.createdAt).toDateString() === new Date().toDateString()
                            ).length}</p>
                            <p className="text-blue-200 text-xs mt-1">depósitos e devoluções</p>
                        </div>
                        <HiOutlinePlus className="w-12 h-12 text-blue-200 opacity-75" />
                    </div>
                </Card>
            </div>

            {/* Summary by Product */}
            <Card>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Resumo por Produto
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b dark:border-dark-700">
                                <th className="text-left py-3 px-4 font-medium text-gray-500">Produto</th>
                                <th className="text-center py-3 px-4 font-medium text-gray-500">Depositados</th>
                                <th className="text-center py-3 px-4 font-medium text-gray-500">Devolvidos</th>
                                <th className="text-center py-3 px-4 font-medium text-gray-500">Em Circulação</th>
                                <th className="text-right py-3 px-4 font-medium text-gray-500">Valor Caução</th>
                            </tr>
                        </thead>
                        <tbody>
                            {summary.map((item: any) => (
                                <tr key={item.id} className="border-b dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-800">
                                    <td className="py-3 px-4">
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white">{item.name}</p>
                                            <p className="text-xs text-gray-500">{item.code}</p>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-center">{item.deposited}</td>
                                    <td className="py-3 px-4 text-center">{item.returned}</td>
                                    <td className="py-3 px-4 text-center">
                                        <Badge variant={item.inCirculation > 0 ? 'warning' : 'success'}>
                                            {item.inCirculation}
                                        </Badge>
                                    </td>
                                    <td className="py-3 px-4 text-right font-medium">
                                        {formatCurrency(Number(item.returnPrice))}
                                    </td>
                                </tr>
                            ))}
                            {summary.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-gray-500">
                                        Nenhum produto retornável cadastrado
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Movements History */}
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Histórico de Movimentos
                    </h3>
                    <div className="flex items-center gap-4">
                        <div className="flex bg-white dark:bg-dark-800 rounded-lg p-1 gap-1 border border-gray-200 dark:border-dark-700">
                            <Button variant="ghost" size="sm" onClick={handleExportExcel}>
                                <HiOutlineDownload className="w-4 h-4 mr-1 text-green-600" />
                                Excel
                            </Button>
                            <Button variant="ghost" size="sm" onClick={handleExportPDF}>
                                <HiOutlinePrinter className="w-4 h-4 mr-1 text-red-600" />
                                PDF
                            </Button>
                        </div>
                        <span className="text-sm text-gray-500">{total} movimentos</span>
                    </div>
                </div>

                {loading ? (
                    <div className="py-12 flex justify-center">
                        <LoadingSpinner size="lg" />
                    </div>
                ) : movements.length === 0 ? (
                    <EmptyState
                        icon={<HiOutlineRefresh className="w-12 h-12 text-gray-300" />}
                        title="Nenhum movimento"
                        description="Registre depósitos e devoluções de vasilhames"
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b dark:border-dark-700">
                                    <th className="text-left py-3 px-4 font-medium text-gray-500">Data</th>
                                    <th className="text-left py-3 px-4 font-medium text-gray-500">Tipo</th>
                                    <th className="text-left py-3 px-4 font-medium text-gray-500">Produto</th>
                                    <th className="text-left py-3 px-4 font-medium text-gray-500">Cliente</th>
                                    <th className="text-center py-3 px-4 font-medium text-gray-500">Qtd</th>
                                    <th className="text-right py-3 px-4 font-medium text-gray-500">Valor</th>
                                    <th className="text-left py-3 px-4 font-medium text-gray-500">Operador</th>
                                </tr>
                            </thead>
                            <tbody>
                                {movements.map((mov: any) => (
                                    <tr key={mov.id} className="border-b dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-800">
                                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                                            {formatDateTime(mov.createdAt)}
                                        </td>
                                        <td className="py-3 px-4">
                                            <Badge variant={mov.type === 'deposit' ? 'primary' : mov.type === 'return' ? 'success' : 'warning'}>
                                                {mov.type === 'deposit' ? 'Depósito' : mov.type === 'return' ? 'Devolução' : 'Ajuste'}
                                            </Badge>
                                        </td>
                                        <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">
                                            {mov.product?.name || '-'}
                                        </td>
                                        <td className="py-3 px-4">
                                            {mov.customer?.name || <span className="text-gray-400">Sem cliente</span>}
                                        </td>
                                        <td className="py-3 px-4 text-center font-medium">{mov.quantity}</td>
                                        <td className="py-3 px-4 text-right font-medium text-green-600">
                                            {formatCurrency(Number(mov.depositPaid || mov.depositRefunded || 0))}
                                        </td>
                                        <td className="py-3 px-4 text-gray-500">{mov.performedBy}</td>
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

            {/* Modal */}
            <Modal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title={modalType === 'deposit' ? 'Registrar Depósito de Vasilhame' : 'Registrar Devolução de Vasilhame'}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Select
                        label="Produto *"
                        value={formData.productId}
                        onChange={(e) => handleProductChange(e.target.value)}
                        options={[
                            { value: '', label: 'Selecione...' },
                            ...returnableProducts.map((p: any) => ({
                                value: p.id,
                                label: `${p.name} (${formatCurrency(p.returnPrice || 0)})`
                            }))
                        ]}
                    />

                    <Select
                        label="Cliente (opcional)"
                        value={formData.customerId}
                        onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                        options={[
                            { value: '', label: 'Consumidor final' },
                            ...customers.map((c: any) => ({ value: c.id, label: c.name }))
                        ]}
                    />

                    <Input
                        label="Quantidade"
                        type="number"
                        min={1}
                        value={formData.quantity}
                        onChange={(e) => {
                            const qty = Number(e.target.value);
                            const product = returnableProducts.find((p: any) => p.id === formData.productId);
                            const price = product ? Number((product as any).returnPrice) : 0;
                            setFormData({
                                ...formData,
                                quantity: qty,
                                depositAmount: price * qty,
                                refundAmount: price * qty
                            });
                        }}
                    />

                    <Input
                        label={modalType === 'deposit' ? 'Valor do Depósito (MT)' : 'Valor a Devolver (MT)'}
                        type="number"
                        step="0.01"
                        value={modalType === 'deposit' ? formData.depositAmount : formData.refundAmount}
                        onChange={(e) => setFormData({
                            ...formData,
                            [modalType === 'deposit' ? 'depositAmount' : 'refundAmount']: Number(e.target.value)
                        })}
                    />

                    <Input
                        label="Observações (opcional)"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Observações adicionais..."
                    />

                    <div className="flex gap-3 pt-4">
                        <Button variant="ghost" fullWidth onClick={() => setModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" fullWidth isLoading={submitting}>
                            {modalType === 'deposit' ? 'Registrar Depósito' : 'Registrar Devolução'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
