import { useState, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    HiOutlinePlus,
    HiOutlineDocumentText,
    HiOutlineCash,
    HiOutlineClock,
    HiOutlineCheck,
    HiOutlineExclamation,
    HiOutlineSearch,
    HiOutlineTrash,
    HiOutlineEye,
    HiOutlineMail,
    HiOutlinePrinter,
    HiOutlineRefresh,
    HiOutlineCalculator,
    HiOutlineChartBar,
    HiOutlineDocumentReport,
} from 'react-icons/hi';
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
} from 'recharts';
import { format, parseISO, isBefore, addDays, subDays } from 'date-fns';
import { Card, Button, Input, Select, Modal, Pagination, LoadingSpinner, EmptyState } from '../components/ui';
import { InvoicePrintPreview, CreditNoteManager } from '../components/invoices';
import { formatCurrency, generateId, cn } from '../utils/helpers';
import ModuleFiscalView from '../components/shared/ModuleFiscalView';
import type { Invoice, InvoicePayment, InvoiceStatus, PaymentMethod } from '../types';
import toast from 'react-hot-toast';

// Time period options
type TimePeriod = '1m' | '3m' | '6m' | '1y';
const periodOptions: { value: TimePeriod; label: string }[] = [
    { value: '1m', label: '1 Mês' },
    { value: '3m', label: '3 Meses' },
    { value: '6m', label: '6 Meses' },
    { value: '1y', label: '1 Ano' },
];

// Invoice Form Schema
const invoiceItemSchema = z.object({
    id: z.string(),
    description: z.string().min(1, 'Descrição obrigatória'),
    quantity: z.coerce.number().min(1, 'Mínimo 1'),
    unitPrice: z.coerce.number().min(0.01, 'Preço inválido'),
    discount: z.coerce.number().min(0).default(0),
    total: z.number(),
});

const invoiceSchema = z.object({
    orderNumber: z.string().min(1, 'Número da encomenda obrigatório'),
    customerName: z.string().min(2, 'Nome obrigatório'),
    customerEmail: z.string().email('Email inválido').optional().or(z.literal('')),
    customerPhone: z.string().optional(),
    customerAddress: z.string().optional(),
    customerDocument: z.string().optional(),
    issueDate: z.string().min(1, 'Data obrigatória'),
    dueDate: z.string().min(1, 'Vencimento obrigatório'),
    items: z.array(invoiceItemSchema).min(1, 'Adicione pelo menos um item'),
    discount: z.coerce.number().min(0).default(0),
    tax: z.coerce.number().min(0).default(0),
    notes: z.string().optional(),
    terms: z.string().optional(),
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;

// Payment Schema
const paymentSchema = z.object({
    amount: z.coerce.number().min(0.01, 'Valor obrigatório'),
    method: z.string().min(1, 'Método obrigatório'),
    date: z.string().min(1, 'Data obrigatória'),
    reference: z.string().optional(),
    notes: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

const statusConfig: Record<InvoiceStatus, { label: string; color: string; bgColor: string }> = {
    draft: { label: 'Rascunho', color: 'text-gray-600', bgColor: 'bg-gray-100' },
    sent: { label: 'Enviada', color: 'text-blue-600', bgColor: 'bg-blue-100' },
    paid: { label: 'Paga', color: 'text-green-600', bgColor: 'bg-green-100' },
    partial: { label: 'Parcial', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
    overdue: { label: 'Vencida', color: 'text-red-600', bgColor: 'bg-red-100' },
    cancelled: { label: 'Cancelada', color: 'text-gray-400', bgColor: 'bg-gray-50' },
};

const CHART_COLORS = ['#6b7280', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#9ca3af'];

// Sample orders for selection (in production, this would come from the store)
interface SampleOrder {
    id: string;
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    customerAddress?: string;
    total: number;
    status: string;
}

const sampleOrders: SampleOrder[] = [
    {
        id: '1',
        orderNumber: 'ENC-001',
        customerName: 'Maria Silva',
        customerPhone: '(11) 98765-4321',
        customerEmail: 'maria@email.com',
        total: 450.00,
        status: 'completed',
    },
    {
        id: '2',
        orderNumber: 'ENC-002',
        customerName: 'João Santos',
        customerPhone: '(11) 91234-5678',
        customerEmail: 'joao@empresa.com',
        total: 890.50,
        status: 'completed',
    },
    {
        id: '3',
        orderNumber: 'ENC-003',
        customerName: 'Ana Oliveira',
        customerPhone: '(11) 99887-6655',
        customerEmail: 'ana@gmail.com',
        total: 1250.00,
        status: 'separated',
    },
    {
        id: '4',
        orderNumber: 'ENC-004',
        customerName: 'Pedro Costa',
        customerPhone: '(11) 94567-8901',
        total: 320.00,
        status: 'completed',
    },
    {
        id: '5',
        orderNumber: 'ENC-005',
        customerName: 'Lucia Ferreira',
        customerPhone: '(11) 93456-7890',
        customerEmail: 'lucia@email.com',
        customerAddress: 'Rua das Flores, 123',
        total: 780.00,
        status: 'printed',
    },
];

import { useInvoices } from '../hooks/useData';

export default function Invoices() {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Use API hook for real data with pagination
    const {
        invoices,
        pagination,
        isLoading,
        error,
        createInvoice,
        updateInvoice,
        addPayment: registerInvoicePayment,
        cancelInvoice
    } = useInvoices({
        search,
        status: statusFilter === 'all' ? undefined : statusFilter,
        page,
        limit: pageSize,
    });

    const [showFormModal, setShowFormModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [selectedOrderNumber, setSelectedOrderNumber] = useState<string>('');
    const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('1m');
    const [activeTab, setActiveTab] = useState<'invoices' | 'credit_notes' | 'fiscal' | 'reports'>('invoices');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Get date range based on period
    const periodStartDate = useMemo(() => {
        const now = new Date();
        switch (selectedPeriod) {
            case '1m': return subDays(now, 30);
            case '3m': return subDays(now, 90);
            case '6m': return subDays(now, 180);
            case '1y': return subDays(now, 365);
        }
    }, [selectedPeriod]);

    // Filter invoices by selected period
    const periodInvoices = useMemo(() => {
        return invoices.filter((inv) => parseISO(inv.issueDate) >= periodStartDate);
    }, [invoices, periodStartDate]);

    // Invoice form
    const {
        register,
        handleSubmit,
        control,
        reset,
        watch,
        setValue,
        formState: { errors },
    } = useForm<InvoiceFormData>({
        resolver: zodResolver(invoiceSchema) as never,
        defaultValues: {
            orderNumber: '',
            customerName: '',
            customerEmail: '',
            customerPhone: '',
            customerAddress: '',
            customerDocument: '',
            issueDate: format(new Date(), 'yyyy-MM-dd'),
            dueDate: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
            items: [{ id: generateId(), description: '', quantity: 1, unitPrice: 0, discount: 0, total: 0 }],
            discount: 0,
            tax: 0,
            notes: '',
            terms: 'Pagamento em até 30 dias após emissão.',
        },
    });

    const { fields, append, remove } = useFieldArray({ control, name: 'items' });
    const watchItems = watch('items');
    const watchDiscount = watch('discount') || 0;
    const watchTax = watch('tax') || 0;

    // Payment form
    const {
        register: registerPayment,
        handleSubmit: handleSubmitPayment,
        reset: resetPayment,
        formState: { errors: paymentErrors },
    } = useForm<PaymentFormData>({
        resolver: zodResolver(paymentSchema) as never,
        defaultValues: {
            amount: 0,
            method: 'pix',
            date: format(new Date(), 'yyyy-MM-dd'),
            reference: '',
            notes: '',
        },
    });

    // Calculate totals
    const calculateTotals = useMemo(() => {
        const subtotal = watchItems?.reduce((sum, item) => {
            const itemTotal = (item.quantity || 0) * (item.unitPrice || 0) - (item.discount || 0);
            return sum + itemTotal;
        }, 0) || 0;
        const total = subtotal - watchDiscount + watchTax;
        return { subtotal, total };
    }, [watchItems, watchDiscount, watchTax]);

    // Metrics (based on period)
    const metrics = useMemo(() => {
        const total = periodInvoices.reduce((sum, inv) => sum + inv.total, 0);
        const received = periodInvoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
        const pending = periodInvoices.filter(inv => inv.status === 'sent' || inv.status === 'partial')
            .reduce((sum, inv) => sum + inv.amountDue, 0);
        const overdue = periodInvoices.filter(inv => inv.status === 'overdue')
            .reduce((sum, inv) => sum + inv.amountDue, 0);
        return { total, received, pending, overdue, count: periodInvoices.length };
    }, [periodInvoices]);

    // Status distribution (based on period)
    const statusDistribution = useMemo(() => {
        const dist: Record<string, number> = {};
        periodInvoices.forEach(inv => {
            dist[inv.status] = (dist[inv.status] || 0) + 1;
        });
        return Object.entries(dist).map(([status, count]) => ({
            name: statusConfig[status as InvoiceStatus]?.label || status,
            value: count,
        }));
    }, [periodInvoices]);

    // Filtered invoices (based on period + search + status)
    const filteredInvoices = useMemo(() => {
        return periodInvoices.filter(inv => {
            const matchesSearch = inv.customerName.toLowerCase().includes(search.toLowerCase()) ||
                inv.invoiceNumber.toLowerCase().includes(search.toLowerCase());
            const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [periodInvoices, search, statusFilter]);

    // Pagination logic (now server-side)
    const totalItems = pagination?.total || 0;

    // Generate invoice number from order number
    const generateInvoiceNumber = (orderNum?: string) => {
        if (orderNum) {
            // Extract the number from the order number and use it for the invoice
            const num = orderNum.replace('ENC-', '');
            return `FAT-${num}`;
        }
        const count = invoices.length + 1;
        return `FAT-${String(count).padStart(3, '0')}`;
    };

    // Handle order selection and auto-fill
    const handleOrderSelect = (orderNumber: string) => {
        setSelectedOrderNumber(orderNumber);
        setValue('orderNumber', orderNumber);

        const order = sampleOrders.find(o => o.orderNumber === orderNumber);
        if (order) {
            setValue('customerName', order.customerName);
            setValue('customerPhone', order.customerPhone || '');
            setValue('customerEmail', order.customerEmail || '');
            setValue('customerAddress', order.customerAddress || '');

            // Add order items (in production, these would come from the actual order)
            const orderItems = [{
                id: generateId(),
                description: `Produtos da ${order.orderNumber}`,
                quantity: 1,
                unitPrice: order.total,
                discount: 0,
                total: order.total,
            }];
            setValue('items', orderItems);

            toast.success(`Dados da encomenda ${order.orderNumber} carregados!`);
        }
    };

    // Get available orders (not yet invoiced)
    const availableOrders = useMemo(() => {
        const invoicedOrderNumbers = invoices
            .filter(inv => inv.orderNumber)
            .map(inv => inv.orderNumber);
        return sampleOrders.filter(order => !invoicedOrderNumbers.includes(order.orderNumber));
    }, [invoices]);

    // Update item totals
    const updateItemTotal = (index: number) => {
        const items = watch('items');
        if (items[index]) {
            const total = (items[index].quantity || 0) * (items[index].unitPrice || 0) - (items[index].discount || 0);
            setValue(`items.${index}.total`, total);
        }
    };

    // Submit invoice
    const onSubmit = async (data: InvoiceFormData) => {
        setIsSubmitting(true);
        try {
            if (editingInvoice) {
                await updateInvoice(editingInvoice.id, {
                    ...data,
                });
            } else {
                await createInvoice({
                    orderNumber: data.orderNumber,
                    customerName: data.customerName,
                    customerEmail: data.customerEmail || undefined,
                    customerPhone: data.customerPhone || undefined,
                    customerAddress: data.customerAddress || undefined,
                    customerDocument: data.customerDocument || undefined,
                    items: data.items,
                    discount: data.discount,
                    tax: data.tax,
                    issueDate: data.issueDate,
                    dueDate: data.dueDate,
                    notes: data.notes,
                    terms: data.terms,
                });
            }
            closeFormModal();
        } catch (err) {
            console.error('Error saving invoice:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Submit payment
    const onSubmitPayment = async (data: PaymentFormData) => {
        if (!selectedInvoice) return;
        setIsSubmitting(true);
        try {
            await registerInvoicePayment(selectedInvoice.id, {
                amount: data.amount,
                method: data.method as any,
                date: data.date,
                reference: data.reference,
                notes: data.notes,
            });
            setShowPaymentModal(false);
            resetPayment();
        } catch (err) {
            console.error('Error registering payment:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Actions
    const handleSendInvoice = (invoice: Invoice) => {
        setInvoices(prev => prev.map(inv => {
            if (inv.id === invoice.id) {
                const today = new Date();
                const dueDate = parseISO(inv.dueDate);
                const isOverdue = isBefore(dueDate, today) && inv.amountDue > 0;
                return { ...inv, status: isOverdue ? 'overdue' : 'sent', updatedAt: new Date().toISOString() };
            }
            return inv;
        }));
        toast.success('Fatura enviada!');
    };

    const closeFormModal = () => {
        setShowFormModal(false);
        setEditingInvoice(null);
        setSelectedOrderNumber('');
        reset();
    };

    // Handle print invoice
    const handlePrintInvoice = (invoice: Invoice) => {
        setSelectedInvoice(invoice);
        setShowPrintModal(true);
    };

    const statusOptions = [
        { value: 'all', label: 'Todos' },
        { value: 'draft', label: 'Rascunho' },
        { value: 'sent', label: 'Enviadas' },
        { value: 'paid', label: 'Pagas' },
        { value: 'partial', label: 'Parciais' },
        { value: 'overdue', label: 'Vencidas' },
    ];

    const tabs = [
        { id: 'invoices' as const, label: 'Faturas', icon: <HiOutlineDocumentText className="w-5 h-5" /> },
        { id: 'credit_notes' as const, label: 'Notas de Crédito', icon: <HiOutlineCash className="w-5 h-5" /> },
        { id: 'fiscal' as const, label: 'Fiscal', icon: <HiOutlineCalculator className="w-5 h-5" /> },
        { id: 'reports' as const, label: 'Relatórios', icon: <HiOutlineDocumentReport className="w-5 h-5" /> },
    ];

    return (
        <div className="space-y-6">
            {/* Header with Responsive Tabs */}
            <div className="bg-white dark:bg-dark-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Faturação & Crédito</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Gestão de Faturas, Notas de Crédito e Pagamentos</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Button variant="outline" size="sm" leftIcon={<HiOutlineRefresh className="w-5 h-5" />}>Actualizar</Button>
                        <Button size="sm" leftIcon={<HiOutlinePlus className="w-5 h-5" />} onClick={() => setShowFormModal(true)}>Nova Fatura</Button>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="mt-6 border-b border-gray-100 dark:border-dark-700">
                    <div className="flex overflow-x-auto no-scrollbar -mb-px">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap uppercase tracking-wider",
                                    activeTab === tab.id
                                        ? "border-primary-500 text-primary-600 dark:text-primary-400"
                                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:hover:text-gray-300 dark:hover:border-dark-600"
                                )}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="min-h-[400px]">
                {activeTab === 'credit_notes' && <CreditNoteManager invoices={invoices} />}

                {activeTab === 'fiscal' && <ModuleFiscalView module="invoices" title="Faturação & Fiscal" />}

                {activeTab === 'reports' && (
                    <Card padding="lg" className="flex flex-col items-center justify-center py-20 text-center">
                        <HiOutlineDocumentReport className="w-16 h-16 text-gray-300 mb-4" />
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tight">Relatórios de Faturação</h3>
                        <p className="text-gray-500 max-w-md">Análise profunda de vendas, impostos e dívidas de clientes.</p>
                    </Card>
                )}

                {activeTab === 'invoices' && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        {/* Period Filter for Invoices */}
                        <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-dark-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-dark-700">
                            <div className="flex items-center gap-1 bg-gray-100 dark:bg-dark-700 rounded-lg p-1">
                                {periodOptions.map((option) => (
                                    <button
                                        key={option.value}
                                        onClick={() => setSelectedPeriod(option.value)}
                                        className={cn(
                                            'px-6 py-2 rounded-md text-xs font-bold transition-all uppercase tracking-widest',
                                            selectedPeriod === option.value
                                                ? 'bg-white dark:bg-dark-800 text-primary-600 shadow-sm'
                                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                        )}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {/* Metrics */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                            <Card padding="md" className="border-l-4 border-l-primary-500 overflow-hidden">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs sm:text-sm text-gray-500 truncate">Total Faturado</p>
                                        <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
                                            {formatCurrency(metrics.total)}
                                        </p>
                                    </div>
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                                        <HiOutlineDocumentText className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600" />
                                    </div>
                                </div>
                            </Card>

                            <Card padding="md" className="border-l-4 border-l-green-500 overflow-hidden">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs sm:text-sm text-gray-500 truncate">Recebido</p>
                                        <p className="text-lg sm:text-xl font-bold text-green-600 truncate">
                                            {formatCurrency(metrics.received)}
                                        </p>
                                    </div>
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                                        <HiOutlineCheck className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                                    </div>
                                </div>
                            </Card>

                            <Card padding="md" className="border-l-4 border-l-yellow-500 overflow-hidden">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs sm:text-sm text-gray-500 truncate">Pendente</p>
                                        <p className="text-lg sm:text-xl font-bold text-yellow-600 truncate">
                                            {formatCurrency(metrics.pending)}
                                        </p>
                                    </div>
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center flex-shrink-0">
                                        <HiOutlineClock className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600" />
                                    </div>
                                </div>
                            </Card>

                            <Card padding="md" className="border-l-4 border-l-red-500 overflow-hidden">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs sm:text-sm text-gray-500 truncate">Vencido</p>
                                        <p className="text-lg sm:text-xl font-bold text-red-600 truncate">
                                            {formatCurrency(metrics.overdue)}
                                        </p>
                                    </div>
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                                        <HiOutlineExclamation className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
                                    </div>
                                </div>
                            </Card>
                        </div>

                        {/* Chart & Filters */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <Card padding="md" className="overflow-visible">
                                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Status das Faturas</h3>
                                <div className="h-40">
                                    {statusDistribution.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={statusDistribution} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value">
                                                    {statusDistribution.map((_, index) => (
                                                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-gray-500">Sem dados</div>
                                    )}
                                </div>
                                {/* Legend */}
                                {statusDistribution.length > 0 && (
                                    <div className="mt-4 grid grid-cols-2 gap-2">
                                        {statusDistribution.map((item, index) => (
                                            <div key={index} className="flex items-center gap-2 text-sm">
                                                <div
                                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                                                />
                                                <span className="text-gray-600 dark:text-gray-400 truncate">{item.name}: {item.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Card>

                            <Card padding="md" className="lg:col-span-2">
                                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                                    <div className="flex-1">
                                        <Input placeholder="Buscar faturas..." value={search} onChange={(e) => setSearch(e.target.value)} leftIcon={<HiOutlineSearch className="w-5 h-5" />} />
                                    </div>
                                    <div className="w-full sm:w-48">
                                        <Select options={statusOptions} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} />
                                    </div>
                                </div>
                                <p className="text-sm text-gray-500">{filteredInvoices.length} faturas encontradas</p>
                            </Card>
                        </div>

                        {/* Invoice List */}
                        <Card padding="none">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-700">
                                    <thead className="bg-gray-50 dark:bg-dark-800">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Número</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Vencimento</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Pago</th>
                                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                                        {invoices.length === 0 ? (
                                            <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">Nenhuma fatura encontrada</td></tr>
                                        ) : (
                                            invoices.map((inv) => (
                                                <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-dark-800">
                                                    <td className="px-4 py-3 font-mono font-medium text-gray-900 dark:text-white">{inv.invoiceNumber}</td>
                                                    <td className="px-4 py-3">
                                                        <p className="font-medium text-gray-900 dark:text-white">{inv.customerName}</p>
                                                        {inv.customerEmail && <p className="text-xs text-gray-500">{inv.customerEmail}</p>}
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{format(parseISO(inv.dueDate), 'dd/MM/yyyy')}</td>
                                                    <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">{formatCurrency(inv.total)}</td>
                                                    <td className="px-4 py-3 text-right text-green-600">{formatCurrency(inv.amountPaid)}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={cn('px-2 py-1 rounded-full text-xs font-medium', statusConfig[inv.status].bgColor, statusConfig[inv.status].color)}>
                                                            {statusConfig[inv.status].label}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex justify-center gap-1">
                                                            <button onClick={() => { setSelectedInvoice(inv); setShowDetailsModal(true); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-700 rounded" title="Ver"><HiOutlineEye className="w-4 h-4 text-gray-500" /></button>
                                                            <button onClick={() => handlePrintInvoice(inv)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-700 rounded" title="Imprimir"><HiOutlinePrinter className="w-4 h-4 text-primary-500" /></button>
                                                            {inv.status === 'draft' && <button onClick={() => handleSendInvoice(inv)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-700 rounded" title="Enviar"><HiOutlineMail className="w-4 h-4 text-blue-500" /></button>}
                                                            {(inv.status === 'sent' || inv.status === 'partial' || inv.status === 'overdue') && <button onClick={() => { setSelectedInvoice(inv); resetPayment({ amount: inv.amountDue, method: 'pix', date: format(new Date(), 'yyyy-MM-dd') }); setShowPaymentModal(true); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-700 rounded" title="Pagamento"><HiOutlineCash className="w-4 h-4 text-green-500" /></button>}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>

                        {/* Pagination */}
                        <div className="px-6 py-4">
                            <Pagination
                                currentPage={page}
                                totalItems={totalItems}
                                itemsPerPage={pageSize}
                                onPageChange={setPage}
                                onItemsPerPageChange={(size) => {
                                    setPageSize(size);
                                    setPage(1);
                                }}
                                itemsPerPageOptions={[5, 10, 25, 50]}
                            />
                        </div>

                    </div>
                )}
            </div>

            {/* Invoice Form Modal */}
            <Modal isOpen={showFormModal} onClose={closeFormModal} title={editingInvoice ? 'Editar Fatura' : 'Nova Fatura'} size="xl">
                <form onSubmit={handleSubmit(onSubmit as never)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                    {/* Order Selection */}
                    {!editingInvoice && (
                        <Card padding="md" className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800">
                            <h4 className="font-semibold text-primary-700 dark:text-primary-300 mb-3">Selecionar Encomenda</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Select
                                    label="Número da Encomenda *"
                                    options={[
                                        { value: '', label: 'Selecione uma encomenda...' },
                                        ...availableOrders.map(order => ({
                                            value: order.orderNumber,
                                            label: `${order.orderNumber} - ${order.customerName} (${formatCurrency(order.total)})`,
                                        })),
                                    ]}
                                    value={selectedOrderNumber}
                                    onChange={(e) => handleOrderSelect(e.target.value)}
                                    error={errors.orderNumber?.message}
                                />
                                <div className="flex items-end">
                                    {selectedOrderNumber && (
                                        <div className="text-sm text-primary-600 dark:text-primary-400">
                                            <p className="font-medium">Fatura será: FAT-{selectedOrderNumber.replace('ENC-', '')}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {availableOrders.length === 0 && (
                                <p className="text-sm text-amber-600 mt-2">Não há encomendas disponíveis para faturar.</p>
                            )}
                        </Card>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Cliente *" {...register('customerName')} error={errors.customerName?.message} />
                        <Input label="Email" type="email" {...register('customerEmail')} error={errors.customerEmail?.message} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Input label="Telefone" {...register('customerPhone')} />
                        <Input label="Documento (BI/NUIT)" {...register('customerDocument')} />
                        <Input label="Endereço" {...register('customerAddress')} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Input label="Emissão *" type="date" {...register('issueDate')} error={errors.issueDate?.message} />
                        <Input label="Vencimento *" type="date" {...register('dueDate')} error={errors.dueDate?.message} />
                        <Input label="Desconto" type="number" step="0.01" {...register('discount')} />
                        <Input label="Impostos" type="number" step="0.01" {...register('tax')} />
                    </div>

                    {/* Items */}
                    <div className="border rounded-lg p-4 space-y-3 bg-gray-50 dark:bg-dark-800">
                        <div className="flex justify-between items-center">
                            <h4 className="font-medium text-gray-900 dark:text-white">Itens</h4>
                            <Button type="button" variant="outline" size="sm" onClick={() => append({ id: generateId(), description: '', quantity: 1, unitPrice: 0, discount: 0, total: 0 })}>
                                <HiOutlinePlus className="w-4 h-4 mr-1" />Item
                            </Button>
                        </div>
                        {fields.map((field, index) => (
                            <div key={field.id} className="grid grid-cols-12 gap-2 items-end">
                                <div className="col-span-5">
                                    <Input placeholder="Descrição" {...register(`items.${index}.description`)} />
                                </div>
                                <div className="col-span-2">
                                    <Input type="number" placeholder="Qtd" {...register(`items.${index}.quantity`)} onChange={() => updateItemTotal(index)} />
                                </div>
                                <div className="col-span-2">
                                    <Input type="number" step="0.01" placeholder="Preço" {...register(`items.${index}.unitPrice`)} onChange={() => updateItemTotal(index)} />
                                </div>
                                <div className="col-span-2">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(watchItems?.[index]?.total || 0)}</p>
                                </div>
                                <div className="col-span-1">
                                    {fields.length > 1 && <button type="button" onClick={() => remove(index)} className="p-2 text-red-500 hover:bg-red-50 rounded"><HiOutlineTrash className="w-4 h-4" /></button>}
                                </div>
                            </div>
                        ))}
                        <div className="pt-3 border-t flex justify-end gap-4">
                            <span className="text-gray-600">Subtotal: {formatCurrency(calculateTotals.subtotal)}</span>
                            <span className="font-bold text-gray-900 dark:text-white">Total: {formatCurrency(calculateTotals.total)}</span>
                        </div>
                    </div>

                    <Input label="Observações" {...register('notes')} />
                    <Input label="Termos" {...register('terms')} />

                    <div className="flex gap-3 justify-end pt-4 border-t">
                        <Button type="button" variant="ghost" onClick={closeFormModal}>Cancelar</Button>
                        <Button type="submit">{editingInvoice ? 'Atualizar' : 'Criar Fatura'}</Button>
                    </div>
                </form>
            </Modal>

            {/* Payment Modal */}
            <Modal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="Registrar Pagamento" size="md">
                <form onSubmit={handleSubmitPayment(onSubmitPayment as never)} className="space-y-4">
                    <p className="text-sm text-gray-500">Fatura: <span className="font-medium text-gray-900 dark:text-white">{selectedInvoice?.invoiceNumber}</span></p>
                    <p className="text-sm text-gray-500">Valor pendente: <span className="font-medium text-red-600">{formatCurrency(selectedInvoice?.amountDue || 0)}</span></p>
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Valor *" type="number" step="0.01" {...registerPayment('amount')} error={paymentErrors.amount?.message} />
                        <Select label="Método *" options={paymentMethods} {...registerPayment('method')} error={paymentErrors.method?.message} />
                    </div>
                    <Input label="Data *" type="date" {...registerPayment('date')} error={paymentErrors.date?.message} />
                    <Input label="Referência" {...registerPayment('reference')} placeholder="Nº transação, comprovante..." />
                    <div className="flex gap-3 justify-end pt-4 border-t">
                        <Button type="button" variant="ghost" onClick={() => setShowPaymentModal(false)}>Cancelar</Button>
                        <Button type="submit">Registrar Pagamento</Button>
                    </div>
                </form>
            </Modal>

            {/* Details Modal */}
            <Modal isOpen={showDetailsModal} onClose={() => setShowDetailsModal(false)} title={`Fatura ${selectedInvoice?.invoiceNumber}`} size="lg">
                {selectedInvoice && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-gray-500">Cliente</p>
                                <p className="font-medium text-gray-900 dark:text-white">{selectedInvoice.customerName}</p>
                                {selectedInvoice.customerEmail && <p className="text-sm text-gray-500">{selectedInvoice.customerEmail}</p>}
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-gray-500">Status</p>
                                <span className={cn('px-2 py-1 rounded-full text-xs font-medium', statusConfig[selectedInvoice.status].bgColor, statusConfig[selectedInvoice.status].color)}>
                                    {statusConfig[selectedInvoice.status].label}
                                </span>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                            <div><p className="text-gray-500">Emissão</p><p className="font-medium">{format(parseISO(selectedInvoice.issueDate), 'dd/MM/yyyy')}</p></div>
                            <div><p className="text-gray-500">Vencimento</p><p className="font-medium">{format(parseISO(selectedInvoice.dueDate), 'dd/MM/yyyy')}</p></div>
                            {selectedInvoice.paidDate && <div><p className="text-gray-500">Pago em</p><p className="font-medium text-green-600">{format(parseISO(selectedInvoice.paidDate), 'dd/MM/yyyy')}</p></div>}
                        </div>

                        <Card padding="sm" variant="glass">
                            <h4 className="font-medium mb-2">Itens</h4>
                            {selectedInvoice.items.map((item, i) => (
                                <div key={i} className="flex justify-between text-sm py-1 border-b last:border-0">
                                    <span>{item.quantity}x {item.description}</span>
                                    <span className="font-medium">{formatCurrency(item.total)}</span>
                                </div>
                            ))}
                            <div className="pt-2 mt-2 border-t">
                                <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatCurrency(selectedInvoice.subtotal)}</span></div>
                                {selectedInvoice.discount > 0 && <div className="flex justify-between text-sm text-red-600"><span>Desconto</span><span>-{formatCurrency(selectedInvoice.discount)}</span></div>}
                                {selectedInvoice.tax > 0 && <div className="flex justify-between text-sm"><span>Impostos</span><span>+{formatCurrency(selectedInvoice.tax)}</span></div>}
                                <div className="flex justify-between font-bold mt-2"><span>Total</span><span>{formatCurrency(selectedInvoice.total)}</span></div>
                            </div>
                        </Card>

                        {selectedInvoice.payments.length > 0 && (
                            <Card padding="sm" variant="glass">
                                <h4 className="font-medium mb-2">Pagamentos</h4>
                                {selectedInvoice.payments.map((p, i) => (
                                    <div key={i} className="flex justify-between text-sm py-1 border-b last:border-0">
                                        <span>{format(parseISO(p.date), 'dd/MM/yyyy')} - {p.method.toUpperCase()}</span>
                                        <span className="font-medium text-green-600">{formatCurrency(p.amount)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between font-bold mt-2 pt-2 border-t">
                                    <span>Pago</span><span className="text-green-600">{formatCurrency(selectedInvoice.amountPaid)}</span>
                                </div>
                                {selectedInvoice.amountDue > 0 && (
                                    <div className="flex justify-between font-bold text-red-600">
                                        <span>Pendente</span><span>{formatCurrency(selectedInvoice.amountDue)}</span>
                                    </div>
                                )}
                            </Card>
                        )}

                        <div className="flex gap-3 justify-end pt-4 border-t">
                            <Button variant="ghost" onClick={() => setShowDetailsModal(false)}>Fechar</Button>
                            <Button variant="outline" onClick={() => { setShowDetailsModal(false); handlePrintInvoice(selectedInvoice); }}>
                                <HiOutlinePrinter className="w-4 h-4 mr-2" />Imprimir
                            </Button>
                            {selectedInvoice.status !== 'paid' && selectedInvoice.status !== 'cancelled' && (
                                <Button onClick={() => { setShowDetailsModal(false); resetPayment({ amount: selectedInvoice.amountDue, method: 'pix', date: format(new Date(), 'yyyy-MM-dd') }); setShowPaymentModal(true); }}>
                                    <HiOutlineCash className="w-4 h-4 mr-2" />Registrar Pagamento
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </Modal>

            {/* Print Preview Modal */}
            {selectedInvoice && (
                <InvoicePrintPreview
                    isOpen={showPrintModal}
                    onClose={() => {
                        setShowPrintModal(false);
                        setSelectedInvoice(null);
                    }}
                    invoice={selectedInvoice}
                />
            )}
        </div>
    );
}
