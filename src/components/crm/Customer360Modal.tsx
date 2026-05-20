import { Fragment, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { formatCurrency } from '../../utils/helpers';
import { 
    HiOutlineXMark, 
    HiOutlineBriefcase, 
    HiOutlineMapPin, 
    HiOutlinePhone, 
    HiOutlineEnvelope,
    HiOutlineStar,
    HiOutlineCurrencyDollar,
    HiOutlineShoppingCart,
    HiOutlineClock,
    HiOutlineExclamationCircle,
    HiOutlineReceiptPercent,
    HiOutlinePlusCircle
} from 'react-icons/hi2';
import type { Customer } from '../../types';
import { useSales } from '../../hooks/useSales';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customersAPI, type CustomerAccountPaymentRequest } from '../../services/api/customers.api';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { Button, Input, Select, Textarea } from '../ui';

interface Customer360ModalProps {
    isOpen: boolean;
    onClose: () => void;
    customer: Customer | null;
}

type PaymentTarget = {
    value: string;
    type: 'invoice' | 'credit_sale';
    id: string;
    label: string;
    outstanding: number;
};

const PAYMENT_METHOD_OPTIONS = [
    { value: 'cash', label: 'Dinheiro' },
    { value: 'mpesa', label: 'M-Pesa' },
    { value: 'emola', label: 'e-Mola' },
    { value: 'card', label: 'Cartao/TPA' },
    { value: 'transfer', label: 'Transferencia' },
    { value: 'check', label: 'Cheque' },
    { value: 'other', label: 'Outro' },
];

function getErrorMessage(error: unknown, fallback: string) {
    const apiError = error as { response?: { data?: { message?: string; error?: string } }; message?: string };
    return apiError.response?.data?.message || apiError.response?.data?.error || apiError.message || fallback;
}

export function Customer360Modal({ isOpen, onClose, customer }: Customer360ModalProps) {
    const queryClient = useQueryClient();
    const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false);
    const [paymentTarget, setPaymentTarget] = useState('');
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<CustomerAccountPaymentRequest['method']>('cash');
    const [paymentReference, setPaymentReference] = useState('');
    const [paymentNotes, setPaymentNotes] = useState('');
    const [paymentError, setPaymentError] = useState('');
    // Carrega o histórico dinamicamente se o modal abrir e houver cliente
    const { sales, isLoading } = useSales({ 
        customerId: customer?.id,
        limit: 5 // Last 5 sales for quick view
    });
    const accountQuery = useQuery({
        queryKey: ['customer-account', customer?.id],
        queryFn: () => customersAPI.getAccount(customer!.id),
        enabled: isOpen && Boolean(customer?.id),
    });

    const paymentTargets = useMemo<PaymentTarget[]>(() => {
        const account = accountQuery.data;
        if (!account) return [];

        const invoiceTargets = account.invoices
            .filter((invoice) => invoice.amountDue > 0)
            .map((invoice) => ({
                value: `invoice:${invoice.id}`,
                type: 'invoice' as const,
                id: invoice.id,
                label: `Fatura ${invoice.invoiceNumber} - ${formatCurrency(invoice.amountDue)}`,
                outstanding: invoice.amountDue,
            }));

        const creditSaleTargets = account.creditSales
            .filter((sale) => sale.amountDue > 0)
            .map((sale) => ({
                value: `credit_sale:${sale.id}`,
                type: 'credit_sale' as const,
                id: sale.id,
                label: `Venda ${sale.receiptNumber} - ${formatCurrency(sale.amountDue)}`,
                outstanding: sale.amountDue,
            }));

        return [...invoiceTargets, ...creditSaleTargets];
    }, [accountQuery.data]);

    const selectedPaymentTarget = paymentTargets.find((target) => target.value === paymentTarget);

    const resetPaymentForm = () => {
        setIsPaymentFormOpen(false);
        setPaymentTarget('');
        setPaymentAmount('');
        setPaymentMethod('cash');
        setPaymentReference('');
        setPaymentNotes('');
        setPaymentError('');
    };

    useEffect(() => {
        if (!isOpen) resetPaymentForm();
    }, [isOpen]);

    useEffect(() => {
        if (!isPaymentFormOpen || paymentTarget || paymentTargets.length === 0) return;
        setPaymentTarget(paymentTargets[0].value);
        setPaymentAmount(String(paymentTargets[0].outstanding));
    }, [isPaymentFormOpen, paymentTarget, paymentTargets]);

    const registerPaymentMutation = useMutation({
        mutationFn: (payload: CustomerAccountPaymentRequest) => {
            if (!customer?.id) throw new Error('Cliente nao selecionado');
            return customersAPI.registerAccountPayment(customer.id, payload);
        },
        onSuccess: async () => {
            toast.success('Pagamento registado com sucesso.');
            resetPaymentForm();
            await queryClient.invalidateQueries({ queryKey: ['customer-account', customer?.id] });
            await queryClient.invalidateQueries({ queryKey: ['sales'] });
            await queryClient.invalidateQueries({ queryKey: ['invoices'] });
        },
        onError: (error) => {
            setPaymentError(getErrorMessage(error, 'Nao foi possivel registar o pagamento.'));
        }
    });

    const handleTargetChange = (value: string) => {
        const nextTarget = paymentTargets.find((target) => target.value === value);
        setPaymentTarget(value);
        setPaymentAmount(nextTarget ? String(nextTarget.outstanding) : '');
        setPaymentError('');
    };

    const handlePaymentSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!selectedPaymentTarget) {
            setPaymentError('Selecione uma fatura ou venda a credito.');
            return;
        }

        const amount = Number(paymentAmount.replace(',', '.'));
        if (!Number.isFinite(amount) || amount <= 0) {
            setPaymentError('Informe um valor maior que zero.');
            return;
        }
        if (amount > selectedPaymentTarget.outstanding) {
            setPaymentError(`O valor nao pode exceder ${formatCurrency(selectedPaymentTarget.outstanding)}.`);
            return;
        }

        setPaymentError('');
        registerPaymentMutation.mutate({
            targetType: selectedPaymentTarget.type,
            targetId: selectedPaymentTarget.id,
            amount,
            method: paymentMethod,
            reference: paymentReference.trim() || null,
            notes: paymentNotes.trim() || null,
        });
    };

    if (!customer) return null;

    const isRisky = customer.currentBalance > 50000; // Mock: se o saldo devido > 50.000 MT, consideramos risco de dívida
    const isVIP = customer.totalPurchases > 100000;
    const customerInitials = (customer.name ?? '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map(part => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase() || '?';

    return (
        <>
        <Transition.Root show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                {/* Backdrop com glassmorphism */}
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0 backdrop-blur-none"
                    enterTo="opacity-100 backdrop-blur-md"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100 backdrop-blur-md"
                    leaveTo="opacity-0 backdrop-blur-none"
                >
                    <div className="fixed inset-0 bg-slate-900/60 transition-opacity" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto p-4 sm:p-6">
                    <div className="flex min-h-full items-center justify-center">
                            <Transition.Child
                                as={Fragment}
                                enter="ease-out duration-200"
                                enterFrom="opacity-0 translate-y-3 scale-95"
                                enterTo="opacity-100 translate-y-0 scale-100"
                                leave="ease-in duration-150"
                                leaveFrom="opacity-100 translate-y-0 scale-100"
                                leaveTo="opacity-0 translate-y-3 scale-95"
                            >
                                <Dialog.Panel className="pointer-events-auto w-full max-w-5xl">
                                    <div className="flex max-h-[92vh] flex-col overflow-hidden rounded-lg bg-white dark:bg-dark-900 shadow-2xl border border-slate-200 dark:border-dark-700">
                                        
                                        {/* Header do Perfil (Hero) */}
                                        <div className="relative flex-none px-6 py-7 sm:py-8 bg-gradient-to-br from-primary-900 to-primary-700 overflow-hidden">
                                            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 rounded-full bg-white/5 blur-3xl pointer-events-none" />

                                            <div className="relative flex items-start justify-between gap-4">
                                                <div className="flex min-w-0 flex-1 items-start gap-4 sm:gap-5">
                                                    <div className="flex-none w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-white/15 border border-white/25 flex items-center justify-center">
                                                        <span className="text-xl sm:text-2xl font-black text-white tracking-tight">
                                                            {customerInitials}
                                                        </span>
                                                    </div>
                                                    <div className="min-w-0 flex-1 space-y-2.5">
                                                        <h2 className="text-xl sm:text-2xl font-black text-white leading-snug break-words [overflow-wrap:anywhere]">
                                                            {customer.name}
                                                        </h2>
                                                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 text-white text-[10px] font-bold uppercase tracking-wider border border-white/15">
                                                                <HiOutlineBriefcase className="w-3 h-3" />
                                                                {customer.type === 'company' ? 'Empresa B2B' : 'Particular B2C'}
                                                            </span>
                                                            {isVIP && (
                                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/90 text-white text-[10px] font-bold uppercase tracking-wider">
                                                                    <HiOutlineStar className="w-3 h-3" />
                                                                    Conta VIP
                                                                </span>
                                                            )}
                                                            {isRisky && (
                                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/90 text-white text-[10px] font-bold uppercase tracking-wider">
                                                                    <HiOutlineExclamationCircle className="w-3 h-3" />
                                                                    Dívida Alta
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <Button variant="ghost"
                                                    type="button"
                                                    className="flex-none rounded-full bg-white/10 p-2 text-white/70 hover:bg-white/20 hover:text-white transition-all outline-none"
                                                    onClick={onClose}
                                                >
                                                    <span className="sr-only">Fechar painel</span>
                                                    <HiOutlineXMark className="h-5 w-5" aria-hidden="true" />
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Content Scrollable */}
                                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">

                                            {/* Conta financeira */}
                                            <div>
                                                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                                                        <HiOutlineCurrencyDollar className="w-5 h-5 text-primary-500" />
                                                        Conta do Cliente
                                                    </h3>
                                                    {accountQuery.data && accountQuery.data.summary.totalOutstanding > 0 && (
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="primary"
                                                            leftIcon={<HiOutlinePlusCircle className="w-4 h-4" />}
                                                            onClick={() => {
                                                                setIsPaymentFormOpen(true);
                                                                setPaymentError('');
                                                            }}
                                                        >
                                                            Registar pagamento
                                                        </Button>
                                                    )}
                                                </div>

                                                {accountQuery.isLoading ? (
                                                    <div className="p-6 text-center bg-slate-50 dark:bg-dark-800 rounded-lg border border-slate-100 dark:border-dark-700">
                                                        <div className="w-7 h-7 rounded-full border-4 border-primary-500 border-t-transparent animate-spin mx-auto mb-3"></div>
                                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Carregando conta...</p>
                                                    </div>
                                                ) : accountQuery.data ? (
                                                    <div className="space-y-4">
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-100 dark:border-red-900/40">
                                                                <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Total em divida</p>
                                                                <p className="text-lg font-black text-red-700 dark:text-red-300 mt-1">{formatCurrency(accountQuery.data.summary.totalOutstanding)}</p>
                                                            </div>
                                                            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 border border-orange-100 dark:border-orange-900/40">
                                                                <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Faturas</p>
                                                                <p className="text-lg font-black text-orange-700 dark:text-orange-300 mt-1">{formatCurrency(accountQuery.data.summary.invoiceDebt)}</p>
                                                            </div>
                                                            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-100 dark:border-amber-900/40">
                                                                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Credito POS</p>
                                                                <p className="text-lg font-black text-amber-700 dark:text-amber-300 mt-1">{formatCurrency(accountQuery.data.summary.creditSalesDebt)}</p>
                                                            </div>
                                                            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-100 dark:border-green-900/40">
                                                                <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">Pago em faturas</p>
                                                                <p className="text-lg font-black text-green-700 dark:text-green-300 mt-1">{formatCurrency(accountQuery.data.summary.invoicePaid)}</p>
                                                            </div>
                                                        </div>

                                                        {accountQuery.data.summary.overdueDebt > 0 && (
                                                            <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4">
                                                                <p className="text-sm font-black text-red-700 dark:text-red-300">
                                                                    {accountQuery.data.summary.overdueInvoiceCount} fatura(s) vencida(s): {formatCurrency(accountQuery.data.summary.overdueDebt)}
                                                                </p>
                                                            </div>
                                                        )}

                                                        <div className="bg-white dark:bg-dark-800 rounded-lg border border-slate-200 dark:border-dark-700 overflow-hidden">
                                                            <div className="px-4 py-3 border-b border-slate-100 dark:border-dark-700 flex items-center justify-between">
                                                                <p className="text-xs font-black uppercase tracking-widest text-slate-500">Faturas relacionadas</p>
                                                                <span className="text-[10px] font-bold text-slate-400">{accountQuery.data.summary.openInvoiceCount} em aberto</span>
                                                            </div>
                                                            {accountQuery.data.invoices.length === 0 ? (
                                                                <p className="p-4 text-sm text-slate-500">Sem faturas para este cliente.</p>
                                                            ) : (
                                                                <div className="divide-y divide-slate-100 dark:divide-dark-700">
                                                                    {accountQuery.data.invoices.slice(0, 6).map((invoice) => (
                                                                        <div key={invoice.id} className="p-4 flex items-center justify-between gap-4">
                                                                            <div className="min-w-0">
                                                                                <p className="text-sm font-black text-slate-900 dark:text-white">{invoice.invoiceNumber}</p>
                                                                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                                                    Vence: {new Date(invoice.dueDate).toLocaleDateString('pt-MZ')}
                                                                                </p>
                                                                                {(invoice.debitNotes.length > 0 || invoice.creditNotes.length > 0) && (
                                                                                    <p className="text-[10px] text-slate-400 mt-1">
                                                                                        {invoice.debitNotes.length} ND / {invoice.creditNotes.length} NC
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                            <div className="text-right shrink-0">
                                                                                <p className={`text-sm font-black ${invoice.amountDue > 0 ? 'text-red-600 dark:text-red-300' : 'text-green-600 dark:text-green-300'}`}>
                                                                                    {formatCurrency(invoice.amountDue)}
                                                                                </p>
                                                                                <span className={`inline-flex mt-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${invoice.isOverdue ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300' : 'bg-slate-100 text-slate-500 dark:bg-dark-700 dark:text-slate-300'}`}>
                                                                                    {invoice.isOverdue ? 'Vencida' : invoice.status}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {accountQuery.data.creditSales.some((sale) => sale.amountDue > 0) && (
                                                            <div className="bg-white dark:bg-dark-800 rounded-lg border border-slate-200 dark:border-dark-700 overflow-hidden">
                                                                <div className="px-4 py-3 border-b border-slate-100 dark:border-dark-700">
                                                                    <p className="text-xs font-black uppercase tracking-widest text-slate-500">Outras dividas / vendas a credito</p>
                                                                </div>
                                                                <div className="divide-y divide-slate-100 dark:divide-dark-700">
                                                                    {accountQuery.data.creditSales.filter((sale) => sale.amountDue > 0).slice(0, 5).map((sale) => (
                                                                        <div key={sale.id} className="p-4 flex items-center justify-between gap-4">
                                                                            <div>
                                                                                <p className="text-sm font-black text-slate-900 dark:text-white">{sale.receiptNumber}</p>
                                                                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                                                    {new Date(sale.createdAt).toLocaleDateString('pt-MZ')}
                                                                                </p>
                                                                            </div>
                                                                            <div className="text-right">
                                                                                <p className="text-sm font-black text-red-600 dark:text-red-300">{formatCurrency(sale.amountDue)}</p>
                                                                                <p className="text-[10px] text-slate-400">Pago: {formatCurrency(sale.paidAmount)}</p>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {accountQuery.data.recentPayments.length > 0 && (
                                                            <div className="bg-slate-50 dark:bg-dark-800 rounded-lg border border-slate-100 dark:border-dark-700 p-4">
                                                                <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Pagamentos recentes</p>
                                                                <div className="space-y-2">
                                                                    {accountQuery.data.recentPayments.slice(0, 4).map((payment) => (
                                                                        <div key={payment.id} className="flex items-center justify-between gap-3 text-sm">
                                                                            <span className="font-bold text-slate-700 dark:text-slate-200">{payment.invoice.invoiceNumber}</span>
                                                                            <span className="text-slate-500">{new Date(payment.date).toLocaleDateString('pt-MZ')}</span>
                                                                            <span className="font-black text-green-600 dark:text-green-300">{formatCurrency(payment.amount)}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="p-6 text-center bg-slate-50 dark:bg-dark-800 rounded-lg border border-slate-100 dark:border-dark-700">
                                                        <p className="text-sm text-slate-500">Nao foi possivel carregar a conta do cliente.</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Detalhes de Contacto */}
                                            <div>
                                                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                                                    <HiOutlineMapPin className="w-5 h-5 text-primary-500" />
                                                    Detalhes de Acesso
                                                </h3>
                                                <div className="bg-slate-50 dark:bg-dark-800 rounded-lg border border-slate-100 dark:border-dark-700 divide-y divide-slate-100 dark:divide-dark-700 overflow-hidden">
                                                    <div className="flex flex-col sm:flex-row items-start sm:items-center p-4">
                                                        <div className="w-32 flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 sm:mb-0">
                                                            <HiOutlinePhone className="w-4 h-4" /> Telefone
                                                        </div>
                                                        <div className="flex-1 text-sm font-bold text-slate-900 dark:text-white">
                                                            {customer.phone || ''}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col sm:flex-row items-start sm:items-center p-4">
                                                        <div className="w-32 flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 sm:mb-0">
                                                            <HiOutlineEnvelope className="w-4 h-4" /> Email
                                                        </div>
                                                        <div className="flex-1 text-sm font-bold text-slate-900 dark:text-white">
                                                            {customer.email || ''}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col sm:flex-row items-start sm:items-center p-4">
                                                        <div className="w-32 flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 sm:mb-0">
                                                            <HiOutlineMapPin className="w-4 h-4" /> Endereço
                                                        </div>
                                                        <div className="flex-1 text-sm font-bold text-slate-900 dark:text-white leading-relaxed">
                                                            {customer.address ? `${customer.address}, ${customer.city || ''} ${customer.province || ''}` : ''}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Histórico Recente */}
                                            <div>
                                                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                                                    <HiOutlineShoppingCart className="w-5 h-5 text-primary-500" />
                                                    Últimas interações
                                                </h3>
                                                
                                                {isLoading ? (
                                                    <div className="p-8 text-center bg-slate-50 dark:bg-dark-800 rounded-lg border border-slate-100 dark:border-dark-700">
                                                        <div className="w-8 h-8 rounded-full border-4 border-primary-500 border-t-transparent animate-spin mx-auto mb-3"></div>
                                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Carregando Histórico...</p>
                                                    </div>
                                                ) : sales && sales.length > 0 ? (
                                                    <div className="space-y-3">
                                                        {sales.map((sale) => (
                                                            <div key={sale.id} className="group relative bg-white dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-lg p-4 hover:border-primary-500 dark:hover:border-primary-500 transition-all flex items-center gap-4 shadow-sm hover:shadow-lg hover:shadow-primary-500/10 cursor-pointer">
                                                                <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-dark-900 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/30 transition-colors">
                                                                    <HiOutlineReceiptPercent className="w-5 h-5 text-slate-400 group-hover:text-primary-500" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                                                        {sale.receiptNumber || `SALE-${sale.id.slice(-6)}`}
                                                                    </p>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <HiOutlineClock className="w-3.5 h-3.5 text-slate-400" />
                                                                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                                                                            {format(parseISO(sale.createdAt), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right flex-shrink-0">
                                                                    <span className="block text-sm font-black text-primary-600 dark:text-primary-400">
                                                                        {formatCurrency(sale.total)}
                                                                    </span>
                                                                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                                                        sale.status === 'voided' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                                                                    }`}>
                                                                        {sale.status === 'voided' ? 'Anulado' : sale.paymentMethod}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="p-8 text-center bg-slate-50 dark:bg-dark-800 rounded-lg border border-slate-100 dark:border-dark-700">
                                                        <HiOutlineShoppingCart className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                                                        <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Nenhum histórico comercial.</p>
                                                        <p className="text-xs text-slate-500 mt-1">Este cliente ainda não efetuou compras no sistema.</p>
                                                    </div>
                                                )}
                                            </div>

                                        </div>
                                        
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition.Root>

        <Transition.Root show={isPaymentFormOpen && isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[60]" onClose={resetPaymentForm}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-200"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-150"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto p-4 sm:p-6">
                    <div className="flex min-h-full items-center justify-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-200"
                            enterFrom="opacity-0 translate-y-3 scale-95"
                            enterTo="opacity-100 translate-y-0 scale-100"
                            leave="ease-in duration-150"
                            leaveFrom="opacity-100 translate-y-0 scale-100"
                            leaveTo="opacity-0 translate-y-3 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-2xl rounded-lg bg-white dark:bg-dark-900 shadow-2xl border border-slate-200 dark:border-dark-700 overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-100 dark:border-dark-700 flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <Dialog.Title className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                            Registar pagamento
                                        </Dialog.Title>
                                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 break-words [overflow-wrap:anywhere]">
                                            {customer.name} · Saldo em aberto: {formatCurrency(accountQuery.data?.summary.totalOutstanding || 0)}
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="xs"
                                        className="flex-shrink-0 rounded-full p-2"
                                        onClick={resetPaymentForm}
                                    >
                                        <span className="sr-only">Fechar</span>
                                        <HiOutlineXMark className="h-5 w-5" />
                                    </Button>
                                </div>

                                <div className="p-5">
                                    {paymentTargets.length === 0 ? (
                                        <div className="rounded-lg border border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 p-4 text-sm font-bold text-slate-600 dark:text-slate-300">
                                            Nao ha faturas ou vendas a credito em aberto para liquidar neste cliente.
                                        </div>
                                    ) : (
                                        <form onSubmit={handlePaymentSubmit} className="space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                                                <Select
                                                    size="sm"
                                                    label="Documento"
                                                    value={paymentTarget}
                                                    onChange={(event) => handleTargetChange(event.target.value)}
                                                    options={paymentTargets.map((target) => ({
                                                        value: target.value,
                                                        label: target.label,
                                                    }))}
                                                />
                                                <Input
                                                    size="sm"
                                                    label="Valor pago"
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={paymentAmount}
                                                    onChange={(event) => {
                                                        setPaymentAmount(event.target.value);
                                                        setPaymentError('');
                                                    }}
                                                    helperText={selectedPaymentTarget ? `Saldo: ${formatCurrency(selectedPaymentTarget.outstanding)}` : undefined}
                                                />
                                                <Select
                                                    size="sm"
                                                    label="Metodo"
                                                    value={paymentMethod}
                                                    onChange={(event) => setPaymentMethod(event.target.value as CustomerAccountPaymentRequest['method'])}
                                                    options={PAYMENT_METHOD_OPTIONS}
                                                />
                                                <Input
                                                    size="sm"
                                                    label="Referencia"
                                                    value={paymentReference}
                                                    onChange={(event) => setPaymentReference(event.target.value)}
                                                    placeholder="Opcional"
                                                />
                                            </div>

                                            <Textarea
                                                label="Notas"
                                                value={paymentNotes}
                                                onChange={(event) => setPaymentNotes(event.target.value)}
                                                rows={3}
                                                placeholder="Observacoes internas"
                                            />

                                            {paymentError && (
                                                <p className="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm font-bold text-red-700 dark:text-red-300">
                                                    {paymentError}
                                                </p>
                                            )}

                                            <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-2">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={resetPaymentForm}
                                                    disabled={registerPaymentMutation.isPending}
                                                >
                                                    Cancelar
                                                </Button>
                                                <Button
                                                    type="submit"
                                                    size="sm"
                                                    variant="success"
                                                    isLoading={registerPaymentMutation.isPending}
                                                    loadingText="A registar..."
                                                >
                                                    Confirmar pagamento
                                                </Button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition.Root>
        </>
    );
}

