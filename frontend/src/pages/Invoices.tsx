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
import { Card, Button, Input, Select, Modal, PageHeader, SmartTable } from '../components/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { MetricCard } from '../components/common/ModuleMetricCard';
import { SegmentedControl } from '../components/common/SegmentedControl';
import { InvoicePrintPreview, CreditNoteManager } from '../components/invoices';
import MobilePaymentModal from '../components/pos/MobilePaymentModal';
import { formatCurrency, generateId, cn } from '../utils/helpers';
import { ExportInvoicesButton } from '../components/common/ExportButton';
import type { Invoice, InvoiceStatus } from '../types';
import toast from 'react-hot-toast';
import { isDecimalUnit } from '../constants/unitOfMeasure';
import { PAGE_SIZE } from '../utils/constants';

// ── Local shapes for invoice-source items and product picks ────────────────
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
type ProductPick = { id: string; name: string; price: number; unit?: string };
type ApiValidationError = { path?: string; message?: string };

// Time period options
type TimePeriod = 'all' | '1m' | '3m' | '6m' | '1y';
const periodOptions: { value: TimePeriod; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: '1m', label: '1 Mês' },
    { value: '3m', label: '3 Meses' },
    { value: '6m', label: '6 Meses' },
    { value: '1y', label: '1 Ano' },
];

// Invoice Form Schema
const invoiceItemSchema = z.object({
    id: z.string(),
    productId: z.string().optional().nullable(),
    description: z.string().min(1, 'Descrição obrigatória'),
    quantity: z.coerce.number().min(0.001, 'Mínimo 0.001'),
    unitPrice: z.coerce.number().min(0.01, 'Preço inválido'),
    discount: z.coerce.number().min(0).default(0),
    total: z.number(),
    unit: z.string().optional().default('un'),
});

const invoiceSchema = z.object({
    orderId: z.string().optional(),
    orderNumber: z.string().optional(),
    warehouseId: z.string().optional(),
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

import { useInvoices, useProducts, useWarehouses } from '../hooks/useData';
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
    const [warehouseFilter, setWarehouseFilter] = useState<string>(searchParams.get('warehouseId') || 'all');

    const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
    const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('all');
    // Custom date overrides — when set, take priority over the period preset.
    const [customStartDate, setCustomStartDate] = useState<string>('');
    const [customEndDate, setCustomEndDate] = useState<string>('');

    // Get date range based on period
    const periodStartDate = useMemo(() => {
        const now = new Date();
        switch (selectedPeriod) {
            case 'all': return null;
            case '1m': return subDays(now, 30);
            case '3m': return subDays(now, 90);
            case '6m': return subDays(now, 180);
            case '1y': return subDays(now, 365);
        }
    }, [selectedPeriod]);

    // Effective dates passed to the API: custom values override the period preset.
    const effectiveStartDate = customStartDate
        ? new Date(customStartDate).toISOString()
        : periodStartDate?.toISOString();
    const effectiveEndDate = customEndDate
        ? new Date(customEndDate + 'T23:59:59').toISOString()
        : undefined;
    const hasCustomDates = Boolean(customStartDate || customEndDate);
    const { warehouses } = useWarehouses();
    const warehouseOptions = useMemo(() => [
        { value: 'all', label: 'Todos os Armazéns' },
        ...warehouses
            .filter((warehouse) => warehouse.isActive !== false)
            .map((warehouse) => ({
                value: warehouse.id,
                label: warehouse.code ? `${warehouse.name} (${warehouse.code})` : warehouse.name,
            })),
    ], [warehouses]);
    const hasActiveFilters = Boolean(search || statusFilter !== 'all' || warehouseFilter !== 'all' || selectedPeriod !== 'all' || hasCustomDates);

    useEffect(() => {
        const searchParam = searchParams.get('search');
        if (searchParam !== null) setSearch(searchParam);

        const statusParam = searchParams.get('status');
        if (statusParam !== null) setStatusFilter(statusParam);

        const warehouseParam = searchParams.get('warehouseId');
        if (warehouseParam !== null) setWarehouseFilter(warehouseParam);

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
        warehouseId: warehouseFilter === 'all' ? undefined : warehouseFilter,
        startDate: effectiveStartDate,
        endDate: effectiveEndDate,
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
            terms: 'Pagamento em at 30 dias após emissão.',
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
        { value: 'card', label: 'Cartão' },
        { value: 'transfer', label: 'Transferência' },
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

    const invoiceColumns = useMemo<ColumnDef<Invoice>[]>(() => [
        {
            id: 'invoiceNumber',
            header: 'Número',
            accessorKey: 'invoiceNumber',
            cell: ({ row }) => (
                <span className="font-mono font-medium text-gray-900 dark:text-white">
                    {row.original.invoiceNumber}
                </span>
            ),
        },
        {
            id: 'customer',
            header: 'Cliente',
            accessorKey: 'customerName',
            cell: ({ row }) => (
                <div>
                    <p className="font-medium text-gray-900 dark:text-white">{row.original.customerName}</p>
                    {row.original.customerEmail && <p className="text-xs text-gray-500">{row.original.customerEmail}</p>}
                </div>
            ),
        },
        {
            id: 'dueDate',
            header: 'Vencimento',
            accessorKey: 'dueDate',
            cell: ({ row }) => (
                <span className="text-gray-600 dark:text-gray-400">
                    {format(parseISO(row.original.dueDate), 'dd/MM/yyyy')}
                </span>
            ),
        },
        {
            id: 'total',
            header: () => <span className="block text-right">Total</span>,
            accessorKey: 'total',
            cell: ({ row }) => (
                <span className="block text-right font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(row.original.total)}
                </span>
            ),
        },
        {
            id: 'amountPaid',
            header: () => <span className="block text-right">Pago</span>,
            accessorKey: 'amountPaid',
            cell: ({ row }) => (
                <span className="block text-right text-green-600">
                    {formatCurrency(row.original.amountPaid)}
                </span>
            ),
        },
        {
            id: 'status',
            header: () => <span className="block text-center">Status</span>,
            accessorKey: 'status',
            cell: ({ row }) => {
                const inv = row.original;
                const cfg = statusConfig[inv.status.toLowerCase()];
                const hex = cfg?.hex || '#64748b';
                return (
                    <div className="text-center">
                        <span
                            className="px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                            style={{
                                backgroundColor: hex + '20',
                                color: hex,
                                border: `1px solid ${hex}40`,
                            }}
                        >
                            {cfg?.label || inv.status}
                        </span>
                    </div>
                );
            },
        },
        {
            id: 'actions',
            header: () => <span className="block text-center">Ações</span>,
            enableSorting: false,
            cell: ({ row }) => {
                const inv = row.original;
                const canSend = inv.status === 'draft';
                // Mirror the details-modal rule: anything that isn't paid or cancelled can receive a payment.
                // Includes 'draft' so the operator can register cash received before formally sending the invoice.
                const canPay = inv.status !== 'paid' && inv.status !== 'cancelled' && inv.amountDue > 0;
                return (
                    <div className="flex justify-center items-center gap-1.5">
                        <Button variant="ghost" onClick={() => handleViewInvoice(inv)} className="p-1.5 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg" title="Ver">
                            <HiOutlineEye className="w-4 h-4 text-gray-500" />
                        </Button>
                        <Button variant="ghost" onClick={() => handlePrintInvoice(inv)} className="p-1.5 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-lg" title="Imprimir">
                            <HiOutlinePrinter className="w-4 h-4 text-primary-500" />
                        </Button>
                        {canSend && (
                            <Button variant="ghost" onClick={() => handleSendInvoice(inv)} className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg" title="Enviar">
                                <HiOutlineEnvelope className="w-4 h-4 text-blue-500" />
                            </Button>
                        )}
                        {canPay && (
                            <>
                                <span className="w-px h-5 bg-gray-200 dark:bg-dark-600 mx-0.5" />
                                <Button
                                    onClick={() => {
                                        setSelectedInvoice(inv);
                                        resetPayment({ amount: inv.amountDue, method: 'pix', date: format(new Date(), 'yyyy-MM-dd') });
                                        setShowPaymentModal(true);
                                    }}
                                    className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest shadow-sm shadow-emerald-500/20"
                                    title={`Registar pagamento de ${formatCurrency(inv.amountDue)}`}
                                >
                                    <HiOutlineBanknotes className="w-3.5 h-3.5" />
                                    Pagar
                                    <span className="font-mono tabular-nums normal-case tracking-normal text-[10px] opacity-90">
                                        {formatCurrency(inv.amountDue)}
                                    </span>
                                </Button>
                            </>
                        )}
                    </div>
                );
            },
        },
    ], []);



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
                // Source items don't carry unit metadata yet — default to 'un'.
                // Once the upstream document (order/quote) propagates unit, swap this.
                unit: 'un',
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

            toast.success(`${source.type === 'pharmacy' ? 'Venda de Farmácia' : 'Encomenda'} ${source.number} carregada!`);
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
            unit: product.unit || 'un',
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
                    warehouseId: data.warehouseId || undefined,
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
                toast.error(`Erro de validação: ${errorDetails}`);
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
        const message = firstError?.message || firstError?.root?.message || 'Verifique os campos obrigatórios';
        toast.error(`Erro de validação: ${message}`);
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
        { id: 'credit_notes' as const, label: 'Notas de Crédito', icon: <HiOutlineBanknotes className="w-5 h-5" /> },
    ];

    return (
        <div className="space-y-6">
            <PageHeader 
                title={`Facturação & Crédito ${originModule === 'pharmacy' ? 'Farmácia' : ''}`}
                subtitle={`Gestão de Facturas ${originModule === 'pharmacy' ? 'da Farmácia' : ''}, Notas de Crédito e Fluxos de Recebimento`}
                icon={<HiOutlineDocumentText className="text-primary-600 dark:text-primary-400" />}
                actions={
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="w-full sm:w-auto flex items-center justify-center font-black text-[10px] uppercase tracking-widest text-gray-400 hover:text-blue-600"
                            leftIcon={<HiOutlineArrowPath className="w-5 h-5 text-primary-600 dark:text-primary-400" />} 
                            onClick={() => refetch()}
                        >
                            Actualizar
                        </Button>
                        <ExportInvoicesButton data={invoices} size="sm" className="w-full sm:w-auto" variant="outline" />
                        <Button 
                            size="sm" 
                            className="w-full sm:w-auto flex items-center justify-center font-black text-[10px] uppercase tracking-widest"
                            leftIcon={<HiOutlinePlus className="w-5 h-5" />} 
                            onClick={() => setShowFormModal(true)}
                        >
                            Nova Factura
                        </Button>
                    </div>
                }
                tabs={
                    <div className="flex w-full overflow-x-auto overscroll-x-contain p-1 bg-gray-100/80 dark:bg-dark-800/80 backdrop-blur-md rounded-xl border border-gray-200/50 dark:border-dark-700/50 shadow-inner scrollbar-none">
                        {tabs.map((tab) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <Button
                                    key={tab.id}
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setActiveTab(tab.id as 'invoices' | 'credit_notes')}
                                    className={cn(
                                        "flex-1 sm:flex-none justify-center sm:min-w-max px-6 text-[10px] font-black uppercase tracking-widest rounded-lg gap-2 transition-all duration-200",
                                        isActive
                                            ? "bg-white dark:bg-dark-700 text-primary-600 dark:text-white shadow-lg shadow-black/5 scale-[1.02]"
                                            : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                    )}
                                >
                                    <span className={cn("shrink-0", isActive ? "text-primary-600 dark:text-primary-400" : "opacity-55")}>
                                        {tab.icon}
                                    </span>
                                    <span>{tab.label}</span>
                                </Button>
                            );
                        })}
                    </div>
                }
            />

            <div className="min-h-[400px]">
                {activeTab === 'credit_notes' && <CreditNoteManager invoices={invoices} />}


                {activeTab === 'invoices' && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        {/* Period Filter for Invoices */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-dark-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-dark-700">
                            <SegmentedControl
                                options={periodOptions}
                                value={selectedPeriod}
                                onChange={(val) => {
                                    setSelectedPeriod(val as TimePeriod);
                                    setPage(1);
                                }}
                                size="sm"
                                className="w-full sm:w-auto"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

                        {/* Status Distribution Chart */}
                        <Card padding="md" className="overflow-visible">
                            <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                                <div className="flex-shrink-0 lg:w-1/3">
                                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Status das Faturas</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Distribuição no período seleccionado</p>
                                </div>
                                <div className="flex-1 flex flex-col sm:flex-row items-center gap-6">
                                    <div className="h-40 w-full sm:w-48 flex-shrink-0">
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
                                            <div className="h-full flex items-center justify-center text-gray-500 text-sm">Sem dados</div>
                                        )}
                                    </div>
                                    {statusDistribution.length > 0 && (
                                        <div className="flex-1 grid grid-cols-2 gap-2">
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
                                </div>
                            </div>
                        </Card>

                        {/* Invoice List (com filtros integrados no topo do card) */}
                        <SmartTable
                            data={invoices}
                            columns={invoiceColumns}
                            isLoading={isLoading}
                            isError={!!error}
                            errorMessage={error || undefined}
                            onRetry={() => refetch()}
                            emptyTitle="Nenhuma fatura encontrada"
                            emptyDescription="Tente ajustar sua busca ou crie uma nova fatura."
                            onEmptyAction={() => setShowFormModal(true)}
                            emptyActionLabel="Nova Fatura"
                            minHeight="450px"
                            search={{
                                value: search,
                                onChange: (value) => {
                                    setSearch(value);
                                    setPage(1);
                                },
                                placeholder: 'Buscar facturas por número ou cliente...',
                            }}
                            renderFilters={
                                <div className="contents">
                                    {/* Filters */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[180px_240px_160px_160px_auto] gap-3 items-end">
                                        <Select
                                            label="Status"
                                            options={statusOptions}
                                            value={statusFilter}
                                            onChange={(e) => {
                                                setStatusFilter(e.target.value);
                                                setPage(1);
                                            }}
                                            size="sm"
                                        />
                                        <Select
                                            label="Armazém"
                                            options={warehouseOptions}
                                            value={warehouseFilter}
                                            onChange={(e) => {
                                                setWarehouseFilter(e.target.value);
                                                setPage(1);
                                            }}
                                            size="sm"
                                        />
                                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 col-span-1 sm:col-span-2 xl:col-span-2">
                                            <Input
                                                label="De"
                                                type="date"
                                                value={customStartDate}
                                                onChange={(e) => {
                                                    setCustomStartDate(e.target.value);
                                                    setPage(1);
                                                }}
                                                size="sm"
                                            />
                                            <Input
                                                label="Até"
                                                type="date"
                                                value={customEndDate}
                                                onChange={(e) => {
                                                    setCustomEndDate(e.target.value);
                                                    setPage(1);
                                                }}
                                                size="sm"
                                            />
                                        </div>
                                        {hasActiveFilters && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setSearch('');
                                                    setStatusFilter('all');
                                                    setWarehouseFilter('all');
                                                    setCustomStartDate('');
                                                    setCustomEndDate('');
                                                    setSelectedPeriod('all');
                                                    setPage(1);
                                                }}
                                                className="w-full bg-white dark:bg-dark-800 text-[10px] font-black uppercase tracking-widest shadow-sm rounded-lg"
                                            >
                                                Limpar
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            }
                            pagination={{
                                currentPage: page,
                                totalItems,
                                itemsPerPage: pageSize,
                                onPageChange: setPage,
                                onItemsPerPageChange: (size) => {
                                    setPageSize(size);
                                    setPage(1);
                                },
                                itemsPerPageOptions: [5, 10, 25, 50],
                            }}
                        />

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
                                    {availableSources.length} disponíveis
                                </span>
                            </div>

                            <div className="relative" ref={sourceContainerRef}>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Pesquisar Encomenda / Venda</label>
                                <div className="relative">
                                    <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 z-10" />
                                    <Input
                                        placeholder="Pesquisar por número, cliente ou tipo..."
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
                                            <span className="italic">Criação Manual (Sem vínculo)</span>
                                        </Button>
                                        {filteredSources.length === 0 ? (
                                            <div className="p-6 text-center text-sm text-gray-500">
                                                {availableSources.length === 0
                                                    ? 'Nenhuma venda ou encomenda pendente de faturação encontrada.'
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
                                                                    {source.type === 'pharmacy' ? 'Farmácia' : 'Comercial'}
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
                                <p className="text-xs text-amber-600 mt-2 italic">Nenhuma venda ou encomenda pendente de faturação encontrada.</p>
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
                        <Select
                            label="Armazém"
                            options={[
                                { value: '', label: 'Nenhum (sem armazém)' },
                                ...warehouseOptions.filter(o => o.value !== 'all'),
                            ]}
                            {...register('warehouseId')}
                        />
                        <Input
                            label={lockedSource ? 'Desconto (da encomenda)' : 'Desconto'}
                            type="number"
                            step="0.01"
                            disabled={!!lockedSource}
                            {...register('discount')}
                        />
                        <Input
                            label={lockedSource ? `IVA (${lockedSource.taxRate}% — congelado)` : 'IVA'}
                            type="number"
                            step="0.01"
                            disabled={!!lockedSource}
                            {...register('tax')}
                        />
                    </div>
                    {lockedSource && (
                        <p className="text-xs text-amber-600 italic -mt-2">
                            Os valores foram herdados da {lockedSource.type === 'pharmacy' ? 'venda' : 'encomenda'}. Para alterar preços ou IVA, remova o vínculo acima.
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
                                <Button type="button" variant="outline" size="sm" onClick={() => append({ id: generateId(), description: '', quantity: 1, unitPrice: 0, discount: 0, total: 0, unit: 'un' })}>
                                    <HiOutlinePlus className="w-4 h-4 mr-1" />Item Manual
                                </Button>
                            )}
                        </div>

                        {/* Search Product Input */}
                        {!lockedSource && (
                        <div className="relative">
                            <Input
                                placeholder="esquisar produto no inventário por nome ou código..."
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
                                    <Input placeholder="Descrição" disabled={!!lockedSource} {...register(`items.${index}.description`)} />
                                </div>
                                <div className="col-span-2 relative">
                                    <Input type="number" step={isDecimalUnit(watchItems?.[index]?.unit || 'un') ? "any" : "1"} placeholder="Qtd" disabled={!!lockedSource} {...register(`items.${index}.quantity`)} onChange={() => updateItemTotal(index)} />
                                    {watchItems?.[index]?.unit && watchItems[index].unit !== 'un' && (
                                        <span className="absolute right-2 bottom-3 text-[10px] font-black text-gray-400 pointer-events-none uppercase">
                                            {watchItems[index].unit}
                                        </span>
                                    )}
                                </div>
                                <div className="col-span-2">
                                    <Input type="number" step="0.01" placeholder="Preço" disabled={!!lockedSource} {...register(`items.${index}.unitPrice`)} onChange={() => updateItemTotal(index)} />
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
