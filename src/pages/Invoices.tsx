import { logger } from '../utils/logger';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    HiOutlinePlus,
    HiOutlineDocumentText,
    HiOutlineBanknotes,
    HiOutlineClock,
    HiOutlineCheck,
    HiOutlineExclamationTriangle,
    HiOutlineMagnifyingGlass,
    HiOutlineTrash,
    HiOutlineEye,
    HiOutlineEnvelope,
    HiOutlinePrinter,
    HiOutlineArrowPath,
    HiOutlineTag,
} from 'react-icons/hi2';
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
} from 'recharts';
import { format, parseISO, addDays, subDays } from 'date-fns';
import { Card, Button, Input, Select, Modal, Pagination, TableContainer, PageHeader } from '../components/ui';
import { MetricCard } from '../components/common/ModuleMetricCard';
import { InvoicePrintPreview, CreditNoteManager } from '../components/invoices';
import MobilePaymentModal from '../components/pos/MobilePaymentModal';
import { formatCurrency, generateId, cn } from '../utils/helpers';
import { ExportInvoicesButton } from '../components/common/ExportButton';
import type { Invoice, InvoiceStatus } from '../types';
import toast from 'react-hot-toast';
import { PAGE_SIZE } from '../utils/constants';

// â”€â”€ Local shapes for invoice-source items and product picks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type SourceItem = {
    productId?: string | null;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
};
type InvoiceSource = {
    id: string;
    number: string;
    type: 'pharmacy' | 'commercial' | string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    customerAddress?: string;
    status?: string;
    items: SourceItem[];
    subtotal?: number | string;
    discount?: number | string;
    taxRate?: number | string;
    taxAmount?: number | string;
    total: number | string;
};
type ProductPick = { id: string; name: string; price: number };
type ApiValidationError = { path?: string; message?: string };

// Time period options
type TimePeriod = '1m' | '3m' | '6m' | '1y';
const periodOptions: { value: TimePeriod; label: string }[] = [
    { value: '1m', label: '1 MÃªs' },
    { value: '3m', label: '3 Meses' },
    { value: '6m', label: '6 Meses' },
    { value: '1y', label: '1 Ano' },
];

// Invoice Form Schema
const invoiceItemSchema = z.object({
    id: z.string(),
    productId: z.string().optional().nullable(),
    description: z.string().min(1, 'DescriÃ§Ã£o obrigatÃ³ria'),
    quantity: z.coerce.number().min(1, 'MÃ­nimo 1'),
    unitPrice: z.coerce.number().min(0.01, 'PreÃ§o invÃ¡lido'),
    discount: z.coerce.number().min(0).default(0),
    total: z.number(),
});

const invoiceSchema = z.object({
    orderId: z.string().optional(),
    orderNumber: z.string().optional(),
    customerName: z.string().min(2, 'Nome obrigatÃ³rio'),
    customerEmail: z.string().email('Email invÃ¡lido').optional().or(z.literal('')),
    customerPhone: z.string().optional(),
    customerAddress: z.string().optional(),
    customerDocument: z.string().optional(),
    issueDate: z.string().min(1, 'Data obrigatÃ³ria'),
    dueDate: z.string().min(1, 'Vencimento obrigatÃ³rio'),
    items: z.array(invoiceItemSchema).min(1, 'Adicione pelo menos um item'),
    discount: z.coerce.number().min(0).default(0),
    tax: z.coerce.number().min(0).default(0),
    notes: z.string().optional(),
    terms: z.string().optional(),
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;

// Payment Schema
const paymentSchema = z.object({
    amount: z.coerce.number().min(0.01, 'Valor obrigatÃ³rio'),
    method: z.string().min(1, 'MÃ©todo obrigatÃ³rio'),
    date: z.string().min(1, 'Data obrigatÃ³ria'),
    reference: z.string().optional(),
    notes: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

const statusConfig: Record<string, { label: string; color: string; bgColor: string; hex: string }> = {
    draft: { label: 'RASCUNHO-VIOLET', color: 'text-violet-600', bgColor: 'bg-violet-100', hex: '#8b5cf6' },
    rascunho: { label: 'RASCUNHO-VIOLET', color: 'text-violet-600', bgColor: 'bg-violet-100', hex: '#8b5cf6' },
    sent: { label: 'Enviada', color: 'text-blue-600', bgColor: 'bg-blue-100', hex: '#3b82f6' },
    paid: { label: 'Paga', color: 'text-green-600', bgColor: 'bg-green-100', hex: '#22c55e' },
    partial: { label: 'Parcial', color: 'text-yellow-600', bgColor: 'bg-yellow-100', hex: '#f59e0b' },
    overdue: { label: 'Vencida', color: 'text-red-600', bgColor: 'bg-red-100', hex: '#ef4444' },
    cancelled: { label: 'Cancelada', color: 'text-pink-600', bgColor: 'bg-pink-100', hex: '#ec4899' },
};


// Sample orders are removed in favor of real data from the API

import { useInvoices, useProducts } from '../hooks/useData';
import { useDebounce } from '../hooks/useDebounce';

interface InvoicesProps {
    originModule?: string;
}

export default function Invoices({ originModule }: InvoicesProps) {
    const [searchParams] = useSearchParams();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGE_SIZE);
    const [search, setSearch] = useState(searchParams.get('search') || '');
    const debouncedSearch = useDebounce(search, 300);
    const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all');

    const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
    const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('1m');

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

    useEffect(() => {
        const searchParam = searchParams.get('search');
        if (searchParam !== null) setSearch(searchParam);

        const statusParam = searchParams.get('status');
        if (statusParam !== null) setStatusFilter(statusParam);

        // Auto-open modal if redirected from a specific sale/order
        const openParam = searchParams.get('open');
        if (openParam === 'true') {
            setShowFormModal(true);
            const orderId = searchParams.get('orderId');
            if (orderId) setPendingOrderId(orderId);
        }
    }, [searchParams]);

    // Use API hook for real data with pagination
    const {
        invoices,
        pagination,
        summary,
        isLoading,
        error,
        availableSources,
        refetch,
        fetchAvailableSources,
        createInvoice,
        updateInvoice,
        addPayment: registerInvoicePayment,
        getInvoiceById,
    } = useInvoices({
        search: debouncedSearch || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        startDate: periodStartDate?.toISOString(),
        page,
        limit: pageSize,
        originModule,
    });

    const [showFormModal, setShowFormModal] = useState(false);

    useEffect(() => {
        if (showFormModal) {
            fetchAvailableSources();
        }
    }, [showFormModal, fetchAvailableSources]);

    // Auto-select order when sources are loaded (coming from Orders page)
    useEffect(() => {
        if (pendingOrderId && availableSources.length > 0) {
            handleOrderSelect(pendingOrderId);
            setPendingOrderId(null);
        }
    }, [pendingOrderId, availableSources]);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [selectedOrderNumber, setSelectedOrderNumber] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'invoices' | 'credit_notes'>('invoices');
    const [showMpesaModal, setShowMpesaModal] = useState(false);
    const [mpesaAmount, setMpesaAmount] = useState(0);

    // Product Search State (server-side search, only fetches matches)
    const [productSearch, setProductSearch] = useState('');
    const [showProductResults, setShowProductResults] = useState(false);
    const debouncedProductSearch = useDebounce(productSearch, 300);
    const { products: searchedProducts } = useProducts({
        search: debouncedProductSearch || undefined,
        page: 1,
        limit: 8
    });

    const filteredProducts = useMemo(() => {
        if (!productSearch) return [];
        return searchedProducts || [];
    }, [searchedProducts, productSearch]);

    // Close product results when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setShowProductResults(false);
        if (showProductResults) {
            document.addEventListener('click', handleClickOutside);
        }
        return () => document.removeEventListener('click', handleClickOutside);
    }, [showProductResults]);

    // Source (Sale/Order) Search State for the searchable dropdown
    const [sourceSearch, setSourceSearch] = useState('');
    const [showSourceResults, setShowSourceResults] = useState(false);
    const sourceContainerRef = useRef<HTMLDivElement>(null);

    const filteredSources = useMemo(() => {
        const sources = availableSources as InvoiceSource[];
        const term = sourceSearch.trim().toLowerCase();
        if (!term) return sources;
        return sources.filter((s) => {
            return (
                (s.number || '').toLowerCase().includes(term) ||
                (s.customerName || '').toLowerCase().includes(term) ||
                (s.type || '').toLowerCase().includes(term)
            );
        });
    }, [availableSources, sourceSearch]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (sourceContainerRef.current && !sourceContainerRef.current.contains(e.target as Node)) {
                setShowSourceResults(false);
            }
        };
        if (showSourceResults) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showSourceResults]);



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
            terms: 'Pagamento em at 30 dias apÃ³s emissÃ£o.',
        },
    });

    const { fields, append, remove, replace } = useFieldArray({ control, name: 'items' });
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

    const paymentMethods = [
        { value: 'pix', label: 'PIX' },
        { value: 'cash', label: 'Dinheiro' },
        { value: 'card', label: 'CartÃ£o' },
        { value: 'transfer', label: 'TransferÃªncia' },
        { value: 'mpesa', label: 'M-Pesa' },
    ];

    // Calculate totals
    const calculateTotals = useMemo(() => {
        const subtotal = watchItems?.reduce((sum, item) => {
            const itemTotal = (item.quantity || 0) * (item.unitPrice || 0) - (item.discount || 0);
            return sum + itemTotal;
        }, 0) || 0;
        const total = subtotal - watchDiscount + watchTax;
        return { subtotal, total };
    }, [watchItems, watchDiscount, watchTax]);

    // Metrics (prefer server-side summary if available)
    const metrics = useMemo(() => {
        if (summary) {
            return { 
                total: summary.total, 
                received: summary.paid, 
                pending: summary.pending, 
                overdue: summary.overdue, 
                count: pagination?.total || invoices.length 
            };
        }
        
        // Fallback to client-side for immediate feedback or if summary is missing
        const total = invoices.reduce((sum, inv) => sum + inv.total, 0);
        const received = invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
        const pending = invoices.filter(inv => inv.status === 'sent' || inv.status === 'partial')
            .reduce((sum, inv) => sum + inv.amountDue, 0);
        const overdue = invoices.filter(inv => inv.status === 'overdue')
            .reduce((sum, inv) => sum + inv.amountDue, 0);
        return { total, received, pending, overdue, count: invoices.length };
    }, [invoices, summary, pagination?.total]);

    // Status distribution (based on current page)
    const statusDistribution = useMemo(() => {
        const dist: Record<string, number> = {};
        invoices.forEach(inv => {
            const statusKey = (inv.status || 'draft').toLowerCase();
            dist[statusKey] = (dist[statusKey] || 0) + 1;
        });
        return Object.entries(dist).map(([status, count]) => {
            const config = statusConfig[status as InvoiceStatus] || statusConfig.draft;
            return {
                name: config.label,
                value: count,
                color: config.hex,
            };
        });
    }, [invoices]);

    // Pagination logic (now server-side)
    const totalItems = pagination?.total || 0;



    const [lockedSource, setLockedSource] = useState<{
        type: 'pharmacy' | 'commercial';
        subtotal: number;
        discount: number;
        taxRate: number;
        taxAmount: number;
        total: number;
    } | null>(null);

    // Handle order/sale selection and auto-fill
    const handleOrderSelect = (sourceId: string) => {
        if (!sourceId) {
            setSelectedOrderNumber('');
            setValue('orderId', '');
            setValue('orderNumber', '');
            setValue('discount', 0);
            setValue('tax', 0);
            setLockedSource(null);
            return;
        }

        const source = (availableSources as InvoiceSource[]).find((s) => s.id === sourceId);
        if (source) {
            setSelectedOrderNumber(source.number);
            setValue('orderId', source.id);
            setValue('orderNumber', source.number);
            setValue('customerName', source.customerName || '');
            setValue('customerPhone', source.customerPhone || '');
            setValue('customerEmail', source.customerEmail || '');
            setValue('customerAddress', source.customerAddress || '');

            // Add source items (pre-tax line totals)
            const sourceItems = source.items.map((item) => ({
                id: generateId(),
                productId: item.productId || null,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: 0,
                total: item.total,
            }));
            replace(sourceItems);

            // Inherit IVA breakdown from the source. The form discount/tax inputs
            // mirror the contract; the totals card below shows the same numbers
            // the customer agreed to on the order.
            setValue('discount', Number(source.discount || 0));
            setValue('tax', Number(source.taxAmount || 0));

            setLockedSource({
                type: source.type as 'pharmacy' | 'commercial',
                subtotal: Number(source.subtotal || 0),
                discount: Number(source.discount || 0),
                taxRate: Number(source.taxRate || 0),
                taxAmount: Number(source.taxAmount || 0),
                total: Number(source.total || 0),
            });

            toast.success(`${source.type === 'pharmacy' ? 'Venda de FarmÃ¡cia' : 'Encomenda'} ${source.number} carregada!`);
        }
    };

    // availableSources comes from the hook now

    // Update item totals
    const updateItemTotal = (index: number) => {
        const items = watch('items');
        if (items[index]) {
            const total = (items[index].quantity || 0) * (items[index].unitPrice || 0) - (items[index].discount || 0);
            setValue(`items.${index}.total`, total);
        }
    };

    const handleAddProduct = (product: ProductPick) => {
        append({
            id: generateId(),
            productId: product.id,
            description: product.name,
            quantity: 1,
            unitPrice: product.price,
            discount: 0,
            total: product.price,
        });
        setProductSearch('');
        setShowProductResults(false);
        toast.success(`${product.name} adicionado!`);
    };

    // Auto-fill when availableSources matches the search param (for the "Gerar Fatura" flow)
    useEffect(() => {
        if (showFormModal && search && availableSources.length > 0 && !selectedOrderNumber) {
            const match = (availableSources as InvoiceSource[]).find((s) => s.number === search);
            if (match) {
                handleOrderSelect(match.id);
            }
        }
    }, [showFormModal, search, availableSources, selectedOrderNumber, handleOrderSelect]);

    const onSubmit = async (data: InvoiceFormData) => {
        try {
            // Calculate totals to send to backend
            const subtotal = data.items.reduce((sum, item) => {
                return sum + ((item.quantity || 0) * (item.unitPrice || 0) - (item.discount || 0));
            }, 0);
            const taxAmount = data.tax || 0;
            const discount = data.discount || 0;
            const total = subtotal - discount + taxAmount;

            // Map items to include calculated totals
            const mappedItems = data.items.map(item => ({
                productId: item.productId || undefined,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: item.discount || 0,
                total: (item.quantity || 0) * (item.unitPrice || 0) - (item.discount || 0),
            }));

            if (editingInvoice) {
                await updateInvoice(editingInvoice.id, {
                    ...data,
                });
            } else {
                await createInvoice({
                    orderId: data.orderId || undefined,
                    orderNumber: data.orderNumber || undefined,
                    customerName: data.customerName,
                    customerEmail: data.customerEmail || undefined,
                    customerPhone: data.customerPhone || undefined,
                    customerAddress: data.customerAddress || undefined,
                    customerNuit: data.customerDocument || undefined,
                    items: mappedItems,
                    subtotal,
                    discount,
                    taxAmount,
                    total,
                    dueDate: data.dueDate,
                    notes: data.notes || undefined,
                    paymentTerms: data.terms || undefined,
                });
            }
            closeFormModal();
        } catch (err) {
            const apiErr = err as Error & { response?: { status?: number; data?: { message?: string; error?: string; errors?: ApiValidationError[] } } };
            const responseData = apiErr?.response?.data;
            if (responseData?.errors && Array.isArray(responseData.errors)) {
                const errorDetails = responseData.errors.map((e) => `${e.path}: ${e.message}`).join(', ');
                toast.error(`Erro de validaÃ§Ã£o: ${errorDetails}`);
            } else {
                const message = responseData?.message || responseData?.error || apiErr?.message || 'Erro ao criar fatura';
                toast.error(message);
            }
            logger.error('Error saving invoice:', apiErr?.response?.data || err);
        }
    };

    // Show validation errors to the user
    type RHFFieldErrors = Record<string, { message?: string; root?: { message?: string } } | undefined>;
    const onFormError = (errors: RHFFieldErrors) => {
        const firstError = Object.values(errors).find((e) => e?.message || e?.root?.message);
        const message = firstError?.message || firstError?.root?.message || 'Verifique os campos obrigatÃ³rios';
        toast.error(`Erro de validaÃ§Ã£o: ${message}`);
        logger.error('Form validation errors:', errors);
    };

    // Submit payment
    const onSubmitPayment = async (data: PaymentFormData) => {
        if (!selectedInvoice) return;

        if (data.method === 'mpesa') {
            setMpesaAmount(data.amount);
            setShowPaymentModal(false);
            setShowMpesaModal(true);
            return;
        }

        try {
            await registerInvoicePayment(selectedInvoice.id, {
                amount: data.amount,
                method: data.method,
                reference: data.reference,
                notes: data.notes,
            });
            resetPayment();
        } catch (err) {
            logger.error('Error registering payment:', err);
        }
    };

    // Actions
    const handleSendInvoice = (invoice: Invoice) => {
        updateInvoice(invoice.id, { status: 'sent' });
        toast.success('Factura enviada!');
    };

    const closeFormModal = () => {
        setShowFormModal(false);
        setEditingInvoice(null);
        setSelectedOrderNumber('');
        setLockedSource(null);
        setSourceSearch('');
        reset();
    };

    // Handle view invoice (fetch full details)
    const handleViewInvoice = async (invoice: Invoice) => {
        if (!invoice.items || invoice.items.length === 0) {
            const fullInvoice = await getInvoiceById(invoice.id);
            if (fullInvoice) {
                setSelectedInvoice(fullInvoice);
            }
        } else {
            setSelectedInvoice(invoice);
        }
        setShowDetailsModal(true);
    };

    // Handle print invoice
    const handlePrintInvoice = async (invoice: Invoice) => {
        if (!invoice.items || invoice.items.length === 0) {
            const fullInvoice = await getInvoiceById(invoice.id);
            if (fullInvoice) {
                setSelectedInvoice(fullInvoice);
            }
        } else {
            setSelectedInvoice(invoice);
        }
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
        { id: 'credit_notes' as const, label: 'Notas de CrÃ©dito', icon: <HiOutlineBanknotes className="w-5 h-5" /> },
    ];

    return (
        <div className="space-y-6">
            <PageHeader 
                title={`FacturaÃ§Ã£o & CrÃ©dito ${originModule === 'pharmacy' ? 'FarmÃ¡cia' : ''}`}
                subtitle={`GestÃ£o de Facturas ${originModule === 'pharmacy' ? 'da FarmÃ¡cia' : ''}, Notas de CrÃ©dito e Fluxos de Recebimento`}
                icon={<HiOutlineDocumentText className="text-primary-600 dark:text-primary-400" />}
                actions={
                    <>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="font-black text-[10px] uppercase tracking-widest text-gray-400 hover:text-blue-600"
                            leftIcon={<HiOutlineArrowPath className="w-5 h-5 text-primary-600 dark:text-primary-400" />} 
                            onClick={() => refetch()}
                        >
                            Actualizar
                        </Button>
                        <ExportInvoicesButton data={invoices} size="sm" />
                        <Button 
                            size="sm" 
                            className="font-black text-[10px] uppercase tracking-widest"
                            leftIcon={<HiOutlinePlus className="w-5 h-5" />} 
                            onClick={() => setShowFormModal(true)}
                        >
                            Nova Factura
                        </Button>
                    </>
                }
                tabs={
                    <div className="flex flex-wrap -mb-px">
                        {tabs.map((tab) => (
                            <Button
                                key={tab.id}
                                variant="ghost"
                                onClick={() => setActiveTab(tab.id as 'invoices' | 'credit_notes')}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 px-2 md:px-6 py-4 text-xs md:text-sm font-black border-b-2 rounded-none whitespace-nowrap uppercase tracking-widest",
                                    activeTab === tab.id
                                        ? "border-primary-500 text-primary-600 dark:text-primary-400"
                                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:hover:text-gray-300 dark:hover:border-dark-600"
                                )}
                            >
                                <span className="shrink-0">{tab.icon}</span>
                                <span className="hidden sm:inline-block">{tab.label}</span>
                                <span className="sm:hidden text-[10px]">{tab.label.substring(0, 3)}...</span>
                            </Button>
                        ))}
                    </div>
                }
            />

            <div className="min-h-[400px]">
                {activeTab === 'credit_notes' && <CreditNoteManager invoices={invoices} />}


                {activeTab === 'invoices' && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        {/* Period Filter for Invoices */}
                        <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-dark-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-dark-700">
                            <div className="flex items-center gap-1 bg-gray-100 dark:bg-dark-700 rounded-lg p-1">
                                {periodOptions.map((option) => (
                                    <Button
                                        key={option.value}
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSelectedPeriod(option.value)}
                                        className={cn(
                                            'px-6 py-2 rounded-md text-xs font-bold uppercase tracking-widest active:scale-95',
                                            selectedPeriod === option.value
                                                ? 'bg-white dark:bg-dark-800 text-primary-600 shadow-sm hover:bg-white'
                                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                        )}
                                    >
                                        {option.label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <MetricCard 
                                label="Total Facturado"
                                value={formatCurrency(metrics.total)}
                                icon={<HiOutlineDocumentText className="w-5 h-5" />}
                                color="primary"
                            />
                            <MetricCard 
                                label="Total Recebido"
                                value={formatCurrency(metrics.received)}
                                icon={<HiOutlineCheck className="w-5 h-5" />}
                                color="green"
                            />
                            <MetricCard 
                                label="Valor Pendente"
                                value={formatCurrency(metrics.pending)}
                                icon={<HiOutlineClock className="w-5 h-5" />}
                                color="yellow"
                            />
                            <MetricCard 
                                label="Valor Vencido"
                                value={formatCurrency(metrics.overdue)}
                                icon={<HiOutlineExclamationTriangle className="w-5 h-5" />}
                                color="red"
                            />
                        </div>

                        {/* Chart & Filters */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <Card padding="md" className="overflow-visible">
                                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Status das Faturas</h3>
                                <div className="h-40">
                                    {statusDistribution.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={160}>
                                            <PieChart>
                                                <Pie data={statusDistribution} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value">
                                                    {statusDistribution.map((entry, index) => (
                                                        <Cell key={index} fill={entry.color} />
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
                                                    style={{ backgroundColor: item.color }}
                                                />
                                                <span className="text-gray-600 dark:text-gray-400 truncate">{item.name}: {item.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Card>

                            <Card padding="md" className="lg:col-span-2 bg-gray-100/50 dark:bg-dark-800/50 border-none shadow-none">
                                <div className="flex flex-col sm:flex-row gap-4 mb-2">
                                    <div className="flex-1 relative">
                                        <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 z-10" />
                                        <Input 
                                            placeholder="Buscar facturas por nÃºmero ou cliente..." 
                                            value={search} 
                                            onChange={(e) => setSearch(e.target.value)} 
                                            className="pl-10 bg-white dark:bg-dark-900 border-none shadow-sm h-11"
                                        />
                                    </div>
                                    <div className="w-full sm:w-48">
                                        <Select 
                                            options={statusOptions} 
                                            value={statusFilter} 
                                            onChange={(e) => setStatusFilter(e.target.value)} 
                                            className="h-11 bg-white dark:bg-dark-900 border-none shadow-sm"
                                        />
                                    </div>
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">
                                    {pagination?.total || invoices.length} facturas encontradas no perÃ­odo
                                </p>
                            </Card>
                        </div>

                        {/* Invoice List */}
                        <Card padding="none">
                            <TableContainer
                                isLoading={isLoading}
                                isEmpty={invoices.length === 0}
                                isError={!!error}
                                errorMessage={error || undefined}
                                onRetry={() => refetch()}
                                emptyTitle="Nenhuma fatura encontrada"
                                emptyDescription="Tente ajustar sua busca ou crie uma nova fatura."
                                onEmptyAction={() => setShowFormModal(true)}
                                emptyActionLabel="Nova Fatura"
                                minHeight="450px"
                            >
                                <table className="min-w-full divide-y divide-slate-200/60 dark:divide-dark-700/50">
                                    <thead className="bg-slate-50/50 dark:bg-dark-800">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500">NÃºmero</th>
                                            <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500">Cliente</th>
                                            <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500">Vencimento</th>
                                            <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-widest text-gray-500">Total</th>
                                            <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-widest text-gray-500">Pago</th>
                                            <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest text-gray-500">Status</th>
                                            <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest text-gray-500">AÃ§Ãµes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200/60 dark:divide-dark-700/50">
                                        {invoices.map((inv) => (
                                            <tr key={inv.id} className="hover:bg-primary-50/30 dark:hover:bg-primary-900/10 transition-colors">
                                                <td className="px-4 py-3 font-mono font-medium text-gray-900 dark:text-white">{inv.invoiceNumber}</td>
                                                <td className="px-4 py-3">
                                                    <p className="font-medium text-gray-900 dark:text-white">{inv.customerName}</p>
                                                    {inv.customerEmail && <p className="text-xs text-gray-500">{inv.customerEmail}</p>}
                                                </td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{format(parseISO(inv.dueDate), 'dd/MM/yyyy')}</td>
                                                <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">{formatCurrency(inv.total)}</td>
                                                <td className="px-4 py-3 text-right text-green-600">{formatCurrency(inv.amountPaid)}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span 
                                                        className="px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                                                        style={{ 
                                                            backgroundColor: statusConfig[inv.status.toLowerCase()]?.hex + '20' || '#e2e8f0', 
                                                            color: statusConfig[inv.status.toLowerCase()]?.hex || '#64748b',
                                                            border: `1px solid ${statusConfig[inv.status.toLowerCase()]?.hex}40`
                                                        }}
                                                    >
                                                        {statusConfig[inv.status.toLowerCase()]?.label || inv.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex justify-center gap-1">
                                                        <Button variant="ghost" onClick={() => handleViewInvoice(inv)} className="p-1.5 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors" title="Ver"><HiOutlineEye className="w-4 h-4 text-gray-500" /></Button>
                                                        <Button variant="ghost" onClick={() => handlePrintInvoice(inv)} className="p-1.5 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-lg transition-colors" title="Imprimir"><HiOutlinePrinter className="w-4 h-4 text-primary-500" /></Button>
                                                        {inv.status === 'draft' && <Button variant="ghost" onClick={() => handleSendInvoice(inv)} className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="Enviar"><HiOutlineEnvelope className="w-4 h-4 text-blue-500" /></Button>}
                                                        {(inv.status === 'sent' || inv.status === 'partial' || inv.status === 'overdue') && <Button variant="ghost" onClick={() => { setSelectedInvoice(inv); resetPayment({ amount: inv.amountDue, method: 'pix', date: format(new Date(), 'yyyy-MM-dd') }); setShowPaymentModal(true); }} className="p-1.5 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors" title="Pagamento"><HiOutlineBanknotes className="w-4 h-4 text-green-500" /></Button>}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </TableContainer>
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
                <form onSubmit={handleSubmit(onSubmit as never, onFormError)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                    {/* Source Selection */}
                    {!editingInvoice && (
                        <Card padding="md" className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-primary-700 dark:text-primary-300">Vincular Venda ou Encomenda</h4>
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary-500">
                                    {availableSources.length} disponÃ­veis
                                </span>
                            </div>

                            <div className="relative" ref={sourceContainerRef}>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Pesquisar Encomenda / Venda</label>
                                <div className="relative">
                                    <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 z-10" />
                                    <Input
                                        placeholder="Pesquisar por nÃºmero, cliente ou tipo..."
                                        value={sourceSearch}
                                        onChange={(e) => {
                                            setSourceSearch(e.target.value);
                                            setShowSourceResults(true);
                                        }}
                                        onFocus={() => setShowSourceResults(true)}
                                        className="pl-10 bg-white dark:bg-dark-900"
                                    />
                                    {selectedOrderNumber && (
                                        <Button variant="ghost"
                                            type="button"
                                            onClick={() => {
                                                handleOrderSelect('');
                                                setSourceSearch('');
                                            }}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-red-500 font-medium"
                                        >
                                            Limpar
                                        </Button>
                                    )}
                                </div>

                                {showSourceResults && (
                                    <div className="relative z-10 w-full mt-1 bg-white dark:bg-dark-800 rounded-lg shadow-lg border border-gray-200 dark:border-dark-700 max-h-72 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                                        <Button variant="ghost"
                                            type="button"
                                            onClick={() => {
                                                handleOrderSelect('');
                                                setSourceSearch('');
                                                setShowSourceResults(false);
                                            }}
                                            className="w-full text-left p-3 border-b border-gray-100 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-700 text-sm text-gray-600 dark:text-gray-300"
                                        >
                                            <span className="italic">CriaÃ§Ã£o Manual (Sem vÃ­nculo)</span>
                                        </Button>
                                        {filteredSources.length === 0 ? (
                                            <div className="p-6 text-center text-sm text-gray-500">
                                                {availableSources.length === 0
                                                    ? 'Nenhuma venda ou encomenda pendente de faturaÃ§Ã£o encontrada.'
                                                    : `Nenhum resultado para "${sourceSearch}"`}
                                            </div>
                                        ) : (
                                            <div className="p-2 space-y-1">
                                                {filteredSources.map((source) => (
                                                    <Button variant="ghost"
                                                        key={source.id}
                                                        type="button"
                                                        onClick={() => {
                                                            handleOrderSelect(source.id);
                                                            setSourceSearch('');
                                                            setShowSourceResults(false);
                                                        }}
                                                        className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 text-left transition-colors group"
                                                    >
                                                        <div className="flex flex-col min-w-0 flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className={cn(
                                                                    'text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded',
                                                                    source.type === 'pharmacy'
                                                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                                )}>
                                                                    {source.type === 'pharmacy' ? 'FarmÃ¡cia' : 'Comercial'}
                                                                </span>
                                                                <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">{source.number}</span>
                                                                {source.status && source.status !== 'completed' && (
                                                                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                                                        {source.status}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-sm text-gray-700 dark:text-gray-300 truncate mt-0.5">{source.customerName}</span>
                                                        </div>
                                                        <div className="text-right ml-3">
                                                            <span className="font-bold text-primary-600 dark:text-primary-400">{formatCurrency(Number(source.total))}</span>
                                                        </div>
                                                    </Button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {selectedOrderNumber && (
                                    <div className="mt-3 flex items-center gap-2 text-sm text-primary-700 dark:text-primary-300 bg-primary-100/50 dark:bg-primary-900/30 px-3 py-2 rounded-lg">
                                        <HiOutlineCheck className="w-4 h-4 flex-shrink-0" />
                                        <span className="font-medium">Fatura vinculada a:</span>
                                        <span className="font-mono font-bold">{selectedOrderNumber}</span>
                                    </div>
                                )}
                            </div>

                            {lockedSource && (
                                <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2 bg-white dark:bg-dark-900 rounded-lg p-3 border border-primary-200 dark:border-primary-800">
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest text-gray-400">Subtotal</p>
                                        <p className="font-bold text-gray-900 dark:text-white">{formatCurrency(lockedSource.subtotal)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest text-gray-400">Desconto</p>
                                        <p className="font-bold text-red-600">-{formatCurrency(lockedSource.discount)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest text-gray-400">IVA ({lockedSource.taxRate}%)</p>
                                        <p className="font-bold text-blue-600">+{formatCurrency(lockedSource.taxAmount)}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-[10px] uppercase tracking-widest text-gray-400">Total da Encomenda</p>
                                        <p className="font-bold text-primary-600 dark:text-primary-400 text-lg">{formatCurrency(lockedSource.total)}</p>
                                    </div>
                                </div>
                            )}

                            {availableSources.length === 0 && (
                                <p className="text-xs text-amber-600 mt-2 italic">Nenhuma venda ou encomenda pendente de faturaÃ§Ã£o encontrada.</p>
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
                        <Input label="EndereÃ§o" {...register('customerAddress')} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Input label="EmissÃ£o *" type="date" {...register('issueDate')} error={errors.issueDate?.message} />
                        <Input label="Vencimento *" type="date" {...register('dueDate')} error={errors.dueDate?.message} />
                        <Input
                            label={lockedSource ? 'Desconto (da encomenda)' : 'Desconto'}
                            type="number"
                            step="0.01"
                            disabled={!!lockedSource}
                            {...register('discount')}
                        />
                        <Input
                            label={lockedSource ? `IVA (${lockedSource.taxRate}% â€” congelado)` : 'IVA'}
                            type="number"
                            step="0.01"
                            disabled={!!lockedSource}
                            {...register('tax')}
                        />
                    </div>
                    {lockedSource && (
                        <p className="text-xs text-amber-600 italic -mt-2">
                            Os valores foram herdados da {lockedSource.type === 'pharmacy' ? 'venda' : 'encomenda'}. Para alterar preÃ§os ou IVA, remova o vÃ­nculo acima.
                        </p>
                    )}

                    {/* Items */}
                    <div className="border rounded-lg p-4 space-y-3 bg-gray-50 dark:bg-dark-800">
                        <div className="flex justify-between items-center px-1">
                            <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600">
                                    <HiOutlineTag className="w-5 h-5" />
                                </span>
                                Itens da Fatura
                                {lockedSource && (
                                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                        Herdado
                                    </span>
                                )}
                            </h4>
                            {!lockedSource && (
                                <Button type="button" variant="outline" size="sm" onClick={() => append({ id: generateId(), description: '', quantity: 1, unitPrice: 0, discount: 0, total: 0 })}>
                                    <HiOutlinePlus className="w-4 h-4 mr-1" />Item Manual
                                </Button>
                            )}
                        </div>

                        {/* Search Product Input */}
                        {!lockedSource && (
                        <div className="relative">
                            <Input
                                placeholder="esquisar produto no inventÃ¡rio por nome ou cÃ³digo..."
                                value={productSearch}
                                onChange={(e) => {
                                    setProductSearch(e.target.value);
                                    setShowProductResults(true);
                                }}
                                onFocus={() => setShowProductResults(true)}
                                className="bg-white dark:bg-dark-900"
                            />
                            {showProductResults && filteredProducts.length > 0 && (
                                <div className="absolute z-[100] w-full mt-1 bg-white dark:bg-dark-800 rounded-lg shadow-2xl border border-gray-200 dark:border-dark-700 max-h-60 overflow-y-auto overflow-x-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="p-2 space-y-1">
                                        {filteredProducts.map((p) => (
                                            <Button variant="ghost"
                                                key={p.id}
                                                type="button"
                                                onClick={() => handleAddProduct(p)}
                                                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 text-left transition-colors group"
                                            >
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-gray-900 dark:text-white group-hover:text-primary-600">{p.name}</span>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-xs font-mono text-gray-500 bg-gray-100 dark:bg-dark-700 px-1.5 py-0.5 rounded uppercase tracking-wider">{p.code}</span>
                                                        <span className="text-xs text-gray-400">Stock: {p.currentStock} {p.unit}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-bold text-primary-600 dark:text-primary-400">{formatCurrency(p.price)}</span>
                                                </div>
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {showProductResults && productSearch && filteredProducts.length === 0 && (
                                <div className="absolute z-[100] w-full mt-1 bg-white dark:bg-dark-800 rounded-lg shadow-xl border border-gray-200 dark:border-dark-700 p-8 text-center animate-in fade-in duration-200">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-dark-700 flex items-center justify-center text-gray-400">
                                            <HiOutlineMagnifyingGlass className="w-6 h-6" />
                                        </div>
                                        <p className="text-sm text-gray-500 font-medium">Nenhum produto encontrado "{productSearch}"</p>
                                    </div>
                                </div>
                            )}
                        </div>
                        )}
                        {fields.map((field, index) => (
                            <div key={field.id} className="grid grid-cols-12 gap-2 items-end">
                                <div className="col-span-5">
                                    <Input placeholder="DescriÃ§Ã£o" disabled={!!lockedSource} {...register(`items.${index}.description`)} />
                                </div>
                                <div className="col-span-2">
                                    <Input type="number" placeholder="Qtd" disabled={!!lockedSource} {...register(`items.${index}.quantity`)} onChange={() => updateItemTotal(index)} />
                                </div>
                                <div className="col-span-2">
                                    <Input type="number" step="0.01" placeholder="PreÃ§o" disabled={!!lockedSource} {...register(`items.${index}.unitPrice`)} onChange={() => updateItemTotal(index)} />
                                </div>
                                <div className="col-span-2">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(watchItems?.[index]?.total || 0)}</p>
                                </div>
                                <div className="col-span-1">
                                    {!lockedSource && fields.length > 1 && <Button variant="ghost" type="button" onClick={() => remove(index)} className="p-2 text-red-500 hover:bg-red-50 rounded"><HiOutlineTrash className="w-4 h-4" /></Button>}
                                </div>
                            </div>
                        ))}
                        <div className="pt-3 border-t flex justify-end gap-4">
                            <span className="text-gray-600">Subtotal: {formatCurrency(lockedSource ? lockedSource.subtotal : calculateTotals.subtotal)}</span>
                            <span className="font-bold text-gray-900 dark:text-white">Total: {formatCurrency(lockedSource ? lockedSource.total : calculateTotals.total)}</span>
                        </div>
                    </div>

                    <Input label="ObservaÃ§Ãµes" {...register('notes')} />
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
                        <Select label="MÃ©todo *" options={paymentMethods} {...registerPayment('method')} error={paymentErrors.method?.message} />
                    </div>
                    <Input label="Data *" type="date" {...registerPayment('date')} error={paymentErrors.date?.message} />
                    <Input label="ReferÃªncia" {...registerPayment('reference')} placeholder="NÂº transaÃ§Ã£o, comprovante..." />
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
                            <div><p className="text-gray-500">EmissÃ£o</p><p className="font-medium">{format(parseISO(selectedInvoice.issueDate), 'dd/MM/yyyy')}</p></div>
                            <div><p className="text-gray-500">Vencimento</p><p className="font-medium">{format(parseISO(selectedInvoice.dueDate), 'dd/MM/yyyy')}</p></div>
                            {selectedInvoice.paidDate && <div><p className="text-gray-500">Pago em</p><p className="font-medium text-green-600">{format(parseISO(selectedInvoice.paidDate), 'dd/MM/yyyy')}</p></div>}
                        </div>

                        <Card padding="sm" variant="glass">
                            <h4 className="font-medium mb-2">Itens</h4>
                            {(selectedInvoice.items || []).map((item, i) => (
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

                        {(selectedInvoice.payments || []).length > 0 && (
                            <Card padding="sm" variant="glass">
                                <h4 className="font-medium mb-2">Pagamentos</h4>
                                {(selectedInvoice.payments || []).map((p, i) => (
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
                                    <HiOutlineBanknotes className="w-4 h-4 mr-2" />Registrar Pagamento
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

            {/* M-Pesa Payment Modal */}
            <MobilePaymentModal
                isOpen={showMpesaModal}
                onClose={() => setShowMpesaModal(false)}
                amount={mpesaAmount}
                provider="mpesa"
                module="invoice"
                moduleReferenceId={selectedInvoice?.id}
                reference={selectedInvoice?.invoiceNumber}
                onConfirm={(phoneNumber) => {
                    if (selectedInvoice) {
                        registerInvoicePayment(selectedInvoice.id, {
                            amount: mpesaAmount,
                            method: 'mpesa',
                            reference: `MPESA-${phoneNumber}`,
                            notes: `Pagamento via M-Pesa (${phoneNumber})`,
                        });
                    }
                    setShowMpesaModal(false);
                    resetPayment();
                }}
            />
        </div>
    );
}
