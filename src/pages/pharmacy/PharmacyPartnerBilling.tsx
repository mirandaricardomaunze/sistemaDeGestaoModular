import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Input, Badge, LoadingSpinner, Pagination } from '../../components/ui';
import {
    HiOutlineDocumentText, HiOutlinePlus, HiOutlineCurrencyDollar,
    HiOutlineCheck, HiOutlineOfficeBuilding
} from 'react-icons/hi';
import { pharmacyAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { formatDate, formatCurrency } from '../../utils/helpers';

const STATUS_MAP: Record<string, { label: string; variant: any }> = {
    pending: { label: 'Pendente', variant: 'warning' },
    sent: { label: 'Enviada', variant: 'info' },
    partial: { label: 'Parcial', variant: 'warning' },
    paid: { label: 'Pago', variant: 'success' },
    overdue: { label: 'Vencida', variant: 'danger' },
    cancelled: { label: 'Cancelada', variant: 'default' }
};

export default function PharmacyPartnerBilling() {
    const queryClient = useQueryClient();
    const [showGenerate, setShowGenerate] = useState(false);
    const [showPayment, setShowPayment] = useState<any>(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [generateForm, setGenerateForm] = useState({
        partnerId: '',
        periodStart: '',
        periodEnd: '',
        dueDate: ''
    });

    const { data: invoicesData, isLoading } = useQuery({
        queryKey: ['pharmacy', 'partner-invoices', statusFilter, page],
        queryFn: () => pharmacyAPI.getPartnerInvoices({ status: statusFilter || undefined, page, limit: 20 })
    });

    const { data: partnersRaw } = useQuery({
        queryKey: ['pharmacy', 'partners'],
        queryFn: () => pharmacyAPI.getPartners({ isActive: true })
    });
    const partners = Array.isArray(partnersRaw) ? partnersRaw : [];

    const generateMutation = useMutation({
        mutationFn: () => pharmacyAPI.generatePartnerInvoice(generateForm),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pharmacy', 'partner-invoices'] });
            setShowGenerate(false);
            setGenerateForm({ partnerId: '', periodStart: '', periodEnd: '', dueDate: '' });
            toast.success('Fatura gerada com sucesso');
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao gerar fatura')
    });

    const paymentMutation = useMutation({
        mutationFn: () => pharmacyAPI.registerPartnerPayment(showPayment.id, Number(paymentAmount)),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pharmacy', 'partner-invoices'] });
            setShowPayment(null);
            setPaymentAmount('');
            toast.success('Pagamento registado');
        },
        onError: () => toast.error('Erro ao registar pagamento')
    });

    const invoices = invoicesData?.data || [];

    // Summary
    const totalPending = invoices.filter((i: any) => i.status === 'pending' || i.status === 'partial').reduce((s: number, i: any) => s + (Number(i.totalAmount) - Number(i.paidAmount)), 0);
    const totalOverdue = invoices.filter((i: any) => i.status === 'overdue').reduce((s: number, i: any) => s + Number(i.totalAmount), 0);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Faturação a Parceiros</h1>
                    <p className="text-gray-500 dark:text-gray-400">Faturas a seguradoras e convénios pela cobertura de medicamentos</p>
                </div>
                <Button onClick={() => setShowGenerate(true)} leftIcon={<HiOutlinePlus className="w-4 h-4" />}>Gerar Fatura</Button>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card padding="md" className="text-center">
                    <p className="text-sm text-gray-500">Total a Receber</p>
                    <p className="text-2xl font-black text-amber-600">{formatCurrency(totalPending)}</p>
                </Card>
                <Card padding="md" className="text-center">
                    <p className="text-sm text-gray-500">Vencidas</p>
                    <p className="text-2xl font-black text-red-600">{formatCurrency(totalOverdue)}</p>
                </Card>
                <Card padding="md" className="text-center">
                    <p className="text-sm text-gray-500">Total de Faturas</p>
                    <p className="text-2xl font-black">{invoicesData?.pagination?.total || 0}</p>
                </Card>
            </div>

            {/* Generate Form */}
            {showGenerate && (
                <Card padding="md" className="border-2 border-primary-200 dark:border-primary-800">
                    <h3 className="font-bold mb-4">Gerar Fatura para Parceiro</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Parceiro *</label>
                            <select className="w-full rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                value={generateForm.partnerId} onChange={e => setGenerateForm(f => ({ ...f, partnerId: e.target.value }))}>
                                <option value="">Seleccionar parceiro...</option>
                                {partners.map((p: any) => <option key={p.id} value={p.id}>{p.name} ({p.coveragePercentage}%)</option>)}
                            </select>
                        </div>
                        <Input label="Data de Vencimento" type="date" value={generateForm.dueDate} onChange={e => setGenerateForm(f => ({ ...f, dueDate: e.target.value }))} />
                        <Input label="Período de Início *" type="date" value={generateForm.periodStart} onChange={e => setGenerateForm(f => ({ ...f, periodStart: e.target.value }))} />
                        <Input label="Período de Fim *" type="date" value={generateForm.periodEnd} onChange={e => setGenerateForm(f => ({ ...f, periodEnd: e.target.value }))} />
                    </div>
                    <p className="text-sm text-gray-500 mb-4">O sistema ir agregar automaticamente os valores de cobertura de todas as vendas do período seleccionado para este parceiro.</p>
                    <div className="flex gap-2">
                        <Button onClick={() => generateMutation.mutate()} isLoading={generateMutation.isPending} leftIcon={<HiOutlineDocumentText className="w-4 h-4" />}>Gerar Fatura</Button>
                        <Button variant="outline" onClick={() => setShowGenerate(false)}>Cancelar</Button>
                    </div>
                </Card>
            )}

            {/* Status Filter */}
            <div className="flex gap-2 flex-wrap">
                {['', 'pending', 'sent', 'partial', 'paid', 'overdue'].map(s => (
                    <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === s ? 'bg-primary-600 text-white' : 'bg-white dark:bg-dark-800 border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                        {s === '' ? 'Todas' : STATUS_MAP[s]?.label}
                    </button>
                ))}
            </div>

            {/* Invoices Table */}
            <Card padding="none">
                {isLoading ? <div className="p-8 flex justify-center"><LoadingSpinner /></div> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-dark-700 border-b dark:border-dark-600">
                                <tr>
                                    {['Fatura', 'Parceiro', 'Período', 'Total', 'Pago', 'Em Falta', 'Vencimento', 'Estado', ''].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-dark-700">
                                {invoices.length === 0 ? (
                                    <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Nenhuma fatura encontrada</td></tr>
                                ) : invoices.map((inv: any) => {
                                    const remaining = Number(inv.totalAmount) - Number(inv.paidAmount);
                                    return (
                                        <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-dark-700">
                                            <td className="px-4 py-3 font-mono text-xs font-bold">{inv.invoiceNumber}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <HiOutlineOfficeBuilding className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                                    <span className="font-medium">{inv.partner?.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gray-500">{formatDate(inv.periodStart)} a {formatDate(inv.periodEnd)}</td>
                                            <td className="px-4 py-3 font-semibold">{formatCurrency(Number(inv.totalAmount))}</td>
                                            <td className="px-4 py-3 text-green-600">{formatCurrency(Number(inv.paidAmount))}</td>
                                            <td className="px-4 py-3 font-bold text-amber-600">{formatCurrency(remaining)}</td>
                                            <td className="px-4 py-3 text-xs">{inv.dueDate ? formatDate(inv.dueDate) : ''}</td>
                                            <td className="px-4 py-3">
                                                <Badge variant={STATUS_MAP[inv.status]?.variant || 'default'}>{STATUS_MAP[inv.status]?.label}</Badge>
                                            </td>
                                            <td className="px-4 py-3">
                                                {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                                                    <Button size="sm" variant="outline" onClick={() => { setShowPayment(inv); setPaymentAmount(remaining.toFixed(2)); }} leftIcon={<HiOutlineCurrencyDollar className="w-3 h-3" />}>
                                                        Pagar
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
                {invoicesData?.pagination?.total > 0 && (
                    <div className="px-4 pb-2">
                        <Pagination
                            currentPage={page}
                            totalItems={invoicesData.pagination.total}
                            itemsPerPage={20}
                            onPageChange={(p) => { setPage(p); }}
                        />
                    </div>
                )}
            </Card>

            {/* Payment Modal */}
            {showPayment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <Card className="w-full max-w-md p-6">
                        <h3 className="font-bold text-lg mb-1">Registar Pagamento</h3>
                        <p className="text-sm text-gray-500 mb-4">{showPayment.partner?.name} a {showPayment.invoiceNumber}</p>
                        <div className="flex justify-between text-sm mb-4 p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
                            <span>Total da Fatura:</span><span className="font-bold">{formatCurrency(Number(showPayment.totalAmount))}</span>
                        </div>
                        <Input label="Valor do Pagamento (MT)" type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} min={0} className="mb-4" />
                        <div className="flex gap-2">
                            <Button onClick={() => paymentMutation.mutate()} isLoading={paymentMutation.isPending} leftIcon={<HiOutlineCheck className="w-4 h-4" />}>Confirmar Pagamento</Button>
                            <Button variant="outline" onClick={() => setShowPayment(null)}>Cancelar</Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
