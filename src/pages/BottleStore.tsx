import { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { Card, Button, Input, Badge, LoadingSpinner, EmptyState, Modal, ConfirmationModal } from '../components/ui';
import ThermalReceiptPreview from '../components/pos/ThermalReceiptPreview';
import { useProducts, useSales, useCustomers } from '../hooks/useData';
import { useDebounce } from '../hooks/useDebounce';
import toast from 'react-hot-toast';
import {
    HiOutlineShoppingCart,
    HiOutlineSearch,
    HiOutlineCube,
    HiOutlineCash,
    HiOutlineChartBar,
    HiOutlineTrash,
    HiOutlineCalendar,
    HiOutlineTrendingUp,
    HiOutlineRefresh,
    HiOutlinePlus,
    HiOutlineMinus,
    HiOutlineUserCircle,
    HiOutlineX,
    HiOutlineDocumentDownload,
    HiOutlineDocumentReport
} from 'react-icons/hi';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from 'recharts';
import { salesAPI } from '../services/api';
import { subMonths, isAfter, format, parseISO, eachDayOfInterval, eachMonthOfInterval } from 'date-fns';
import Pagination, { usePagination } from '../components/ui/Pagination';
import { Select } from '../components/ui';
import { searchCustomersForPOS } from '../utils/crmIntegration';
import { formatCurrency } from '../utils/helpers';


// Types for Bottle Store
type TimeRange = '1M' | '2M' | '3M' | '6M' | '1Y';

export default function BottleStore() {
    const { pathname } = useLocation();

    // Determine view from path
    const getInitialView = () => {
        if (pathname.includes('/pos')) return 'pos';
        if (pathname.includes('/inventory')) return 'inventory';
        if (pathname.includes('/reports')) return 'reports';
        return 'dashboard'; // Default to dashboard as requested by user
    };

    const [view, setView] = useState<'pos' | 'dashboard' | 'inventory' | 'reports'>(getInitialView());

    // Update view when path changes (e.g. from sidebar)
    useEffect(() => {
        setView(getInitialView());
    }, [pathname]);

    // Pagination State
    const [prodPage, setProdPage] = useState(1);
    const [prodPageSize, setProdPageSize] = useState(20);

    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 500);
    const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');

    const {
        products,
        pagination: prodPagination,
        isLoading,
        refetch: refetchProducts
    } = useProducts({
        category: 'beverages',
        search: debouncedSearch,
        status: stockFilter === 'all' ? undefined : stockFilter,
        page: prodPage,
        limit: view === 'pos' ? 100 : prodPageSize // More items for POS view
    });

    const {
        sales,
        refetch: refetchSales
    } = useSales({
        limit: view === 'dashboard' || view === 'reports' ? 1000 : 100 // Need more for stats
    });

    const { customers } = useCustomers();

    // POS State
    const [cart, setCart] = useState<any[]>([]);
    const [customerMoney, setCustomerMoney] = useState('');
    const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
    const [processingSale, setProcessingSale] = useState(false);
    const [lastSale, setLastSale] = useState<any>(null);
    const [thermalPreviewOpen, setThermalPreviewOpen] = useState(false);
    const [clearCartModalOpen, setClearCartModalOpen] = useState(false);

    // Customer Selection State
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
    const [customerSearchQuery, setCustomerSearchQuery] = useState('');
    const [showCustomerSearch, setShowCustomerSearch] = useState(false);
    const customerDropdownRef = useRef<HTMLDivElement>(null);
    const productSearchRef = useRef<HTMLInputElement>(null);

    // Calculate customer purchase history
    const customerHistory = useMemo(() => {
        if (!selectedCustomer || !sales) return null;

        const customerSales = sales
            .filter(sale => sale.customerId === selectedCustomer.id)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5);

        const totalSpent = sales
            .filter(sale => sale.customerId === selectedCustomer.id)
            .reduce((sum, sale) => sum + Number(sale.total || 0), 0);

        return {
            recentPurchases: customerSales,
            totalSpent,
            purchaseCount: sales.filter(sale => sale.customerId === selectedCustomer.id).length
        };
    }, [selectedCustomer, sales]);

    const customerSearchResults = useMemo(() => {
        if (!customerSearchQuery || !showCustomerSearch) return [];
        return searchCustomersForPOS(customerSearchQuery, customers || []);
    }, [customerSearchQuery, customers, showCustomerSearch]);

    // Close customer dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
                setShowCustomerSearch(false);
            }
        };

        if (showCustomerSearch) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [showCustomerSearch]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // F2: Focus product search
            if (e.key === 'F2') {
                e.preventDefault();
                productSearchRef.current?.focus();
            }
            // F4: Open checkout if cart has items
            if (e.key === 'F4') {
                e.preventDefault();
                if (cart.length > 0) {
                    setIsCheckoutModalOpen(true);
                }
            }
            // ESC: Clear cart (with confirmation)
            if (e.key === 'Escape' && cart.length > 0 && !isCheckoutModalOpen) {
                setClearCartModalOpen(true);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [cart.length, isCheckoutModalOpen]);

    // Dashboard State
    const [dashboardRange, setDashboardRange] = useState<TimeRange>('1M');

    // Reports State
    type ReportPeriod = 'today' | 'week' | 'month' | 'year' | 'custom';
    const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('month');
    const [reportStartDate, setReportStartDate] = useState<string>(
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    );
    const [reportEndDate, setReportEndDate] = useState<string>(
        new Date().toISOString().split('T')[0]
    );

    // Filter only beverage/bottle products (redundant now as API filters, but kept for extra safety)
    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            if (p.category !== 'beverages') return false;
            return true;
        });
    }, [products]);

    const bottleProducts = filteredProducts;


    // Cart Logic
    const clearCart = () => {
        setCart([]);
        setSelectedCustomer(null);
        setCustomerSearchQuery('');
    };

    const addToCart = (product: any, mode: 'unit' | 'crate' = 'unit', withReturn: boolean = false) => {
        // CRITICAL: Validate stock before adding
        const quantityNeeded = mode === 'crate' ? (product.packSize || 1) : 1;
        const existing = cart.find(item => item.id === product.id && item.mode === mode && item.withReturn === withReturn);
        const currentCartQuantity = existing ? existing.quantity : 0;
        const totalUnitsNeeded = (currentCartQuantity + 1) * quantityNeeded;

        // Check if there's enough stock
        if (product.currentStock < totalUnitsNeeded) {
            toast.error(`Stock insuficiente! Disponível: ${product.currentStock} unidades`);
            return;
        }

        if (existing) {
            setCart(cart.map(item =>
                (item.id === product.id && item.mode === mode && item.withReturn === withReturn)
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ));
        } else {
            setCart([...cart, {
                ...product,
                quantity: 1,
                mode,
                withReturn,
                // Calculated Price Logic
                finalPrice: mode === 'crate'
                    ? (product.price * (product.packSize || 1)) - (withReturn ? (product.returnPrice * (product.packSize || 1)) : 0)
                    : product.price - (withReturn ? product.returnPrice : 0)
            }]);
        }
    };

    const removeFromCart = (index: number) => {
        setCart(cart.filter((_, i) => i !== index));
    };

    const calculateSubtotal = () => {
        return cart.reduce((acc, item) => acc + (item.finalPrice * item.quantity), 0);
    };

    const IVA_RATE = 0.16; // 16% IVA
    const subtotal = calculateSubtotal();
    const totalTax = subtotal * IVA_RATE;
    const totalWithTax = subtotal + totalTax;

    const calculateTotal = () => totalWithTax;

    const handleCheckout = async () => {
        setProcessingSale(true);
        try {
            // Transform cart to sale items format
            const saleItems = cart.map(item => {
                // If crate, we sell packSize * quantity units
                const quantity = item.mode === 'crate'
                    ? item.quantity * (item.packSize || 1)
                    : item.quantity;

                const unitPrice = item.finalPrice / (item.mode === 'crate' ? (item.packSize || 1) : 1);

                return {
                    productId: item.id,
                    quantity: quantity,
                    unitPrice: unitPrice,
                    discount: 0,
                    total: quantity * unitPrice
                };
            });

            const total = calculateTotal();

            const savedSale = await salesAPI.create({
                customerId: selectedCustomer?.id,
                items: saleItems,
                paymentMethod: 'cash', // Simplified for bottle store speed
                amountPaid: parseFloat(customerMoney) || total,
                subtotal: subtotal,
                total: total,
                tax: totalTax,
                notes: selectedCustomer ? `Cliente: ${selectedCustomer.name} (Garrafeira)` : 'Venda Garrafeira'
            });

            toast.success('Venda realizada!');
            setLastSale(savedSale);
            clearCart();
            setCustomerMoney('');
            setIsCheckoutModalOpen(false);
            setThermalPreviewOpen(true);
            refetchProducts();
            refetchSales();
        } catch (error) {
            toast.error('Erro ao processar venda');
        } finally {
            setProcessingSale(false);
        }
    };

    // Render Logic
    return (
        <div className="flex flex-col gap-4 p-4">
            {/* Header / Tabs */}
            <div className="flex justify-between items-center bg-white dark:bg-dark-800 p-4 rounded-xl shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-100 text-amber-600 rounded-lg">
                        <HiOutlineCube className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold dark:text-white">Garrafeira Profissional</h1>
                        <p className="text-xs text-gray-500">Gestão de Bebidas, Emasilhas e Caixas</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant={view === 'pos' ? 'primary' : 'ghost'}
                        onClick={() => setView('pos')}
                        leftIcon={<HiOutlineShoppingCart className="w-4 h-4" />}
                    >
                        POS / Venda
                    </Button>
                    <Button
                        variant={view === 'dashboard' ? 'primary' : 'ghost'}
                        onClick={() => setView('dashboard')}
                        leftIcon={<HiOutlineChartBar className="w-4 h-4" />}
                    >
                        Dashboard
                    </Button>
                    <Button
                        variant={view === 'inventory' ? 'primary' : 'ghost'}
                        onClick={() => setView('inventory')}
                        leftIcon={<HiOutlineSearch className="w-4 h-4" />}
                    >
                        Stock
                    </Button>
                    <Button
                        variant={view === 'reports' ? 'primary' : 'ghost'}
                        onClick={() => setView('reports')}
                        leftIcon={<HiOutlineDocumentReport className="w-4 h-4" />}
                    >
                        Relatórios
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            {view === 'pos' && (
                <div className="flex flex-col md:flex-row gap-6">
                    {/* Left Panel: Product Selection */}
                    <div className="flex-1 flex flex-col gap-4">
                        <Card padding="md" className="flex-shrink-0">
                            <Input
                                ref={productSearchRef}
                                placeholder="Escaneie o código ou busque bebida, marca..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                leftIcon={<HiOutlineSearch className="w-5 h-5 text-gray-400" />}
                                className="py-3 text-lg"
                                autoFocus
                            />
                            <div className="flex items-center justify-between mt-2">
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    💡 Busque por código, nome ou marca
                                </p>
                                <div className="flex gap-2 text-xs text-gray-500 dark:text-gray-400">
                                    <span><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-dark-700 rounded font-mono">F2</kbd> Busca</span>
                                    <span><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-dark-700 rounded font-mono">F4</kbd> Pagar</span>
                                    <span><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-dark-700 rounded font-mono">ESC</kbd> Limpar</span>
                                </div>
                            </div>
                        </Card>

                        <div className="pb-8">
                            {isLoading ? (
                                <div className="h-full flex items-center justify-center"><LoadingSpinner size="lg" /></div>
                            ) : bottleProducts.length === 0 ? (
                                <div className="h-full flex items-center justify-center">
                                    <EmptyState
                                        icon={<HiOutlineCube className="w-12 h-12 text-gray-300" />}
                                        title="Nenhum produto"
                                        description="Não encontramos bebidas com este critério."
                                    />
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                    {bottleProducts.map(product => (
                                        <BottleProductCard
                                            key={product.id}
                                            product={product}
                                            onAdd={addToCart}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Panel: Cart Sidebar */}
                    <div className="w-full md:w-[400px] flex flex-col gap-4">
                        <Card padding="none" className="flex flex-col">
                            {/* Cart Header */}
                            <div className="p-4 border-b border-gray-200 dark:border-dark-700">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                        Carrinho
                                    </h2>
                                    {cart.length > 0 && (
                                        <button
                                            onClick={clearCart}
                                            className="text-sm text-red-600 hover:text-red-700 dark:text-red-400"
                                        >
                                            Limpar
                                        </button>
                                    )}
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {cart.length} {cart.length === 1 ? 'item' : 'itens'}
                                </p>

                                {/* Customer Selection */}
                                <div className="mt-3 relative">
                                    {selectedCustomer ? (
                                        <div className="flex items-center justify-between p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <HiOutlineUserCircle className="w-5 h-5 text-primary-600" />
                                                <div>
                                                    <p className="text-sm font-medium text-primary-700 dark:text-primary-300">
                                                        {selectedCustomer.name}
                                                    </p>
                                                    <p className="text-xs text-primary-600 dark:text-primary-400">
                                                        {selectedCustomer.code}
                                                    </p>
                                                    {customerHistory && (
                                                        <div className="flex gap-2 mt-1">
                                                            <span className="text-[10px] px-1.5 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded font-medium">
                                                                {customerHistory.purchaseCount} compras
                                                            </span>
                                                            <span className="text-[10px] px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded font-medium">
                                                                Total: {formatCurrency(customerHistory.totalSpent)}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setSelectedCustomer(null);
                                                    setCustomerSearchQuery('');
                                                }}
                                                className="p-1 text-primary-400 hover:text-red-500"
                                            >
                                                <HiOutlineX className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="relative" ref={customerDropdownRef}>
                                            <Input
                                                placeholder="Selecionar cliente (opcional)..."
                                                value={customerSearchQuery}
                                                onChange={(e) => {
                                                    setCustomerSearchQuery(e.target.value);
                                                    setShowCustomerSearch(true);
                                                }}
                                                onFocus={() => setShowCustomerSearch(true)}
                                                leftIcon={<HiOutlineUserCircle className="w-5 h-5 text-gray-400" />}

                                            />
                                            {showCustomerSearch && customerSearchResults.length > 0 && (
                                                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-dark-800 rounded-lg shadow-lg border border-gray-200 dark:border-dark-700 max-h-48 overflow-y-auto">
                                                    {customerSearchResults.map((customer: any) => (
                                                        <button
                                                            key={customer.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedCustomer(customers?.find(c => c.id === customer.id) || null);
                                                                setShowCustomerSearch(false);
                                                                setCustomerSearchQuery('');
                                                            }}
                                                            className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-dark-700 flex items-center justify-between"
                                                        >
                                                            <div>
                                                                <p className="text-sm font-medium">{customer.name}</p>
                                                                <p className="text-xs text-gray-500">{customer.phone || 'Sem telefone'}</p>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            {showCustomerSearch && customerSearchQuery.length > 2 && customerSearchResults.length === 0 && (
                                                <div className="absolute z-20 w-full mt-2 p-4 bg-white dark:bg-dark-800 rounded-xl shadow-2xl border border-gray-100 dark:border-dark-700 text-center">
                                                    <p className="text-sm text-gray-500">Nenhum cliente encontrado</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-4 space-y-3">
                                {cart.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 px-6 py-12">
                                        <HiOutlineShoppingCart className="w-16 h-16 mb-4 opacity-50" />
                                        <p className="text-base font-medium mb-2">Carrinho vazio</p>
                                        <p className="text-sm text-center">Busque e adicione produtos</p>
                                    </div>
                                ) : (
                                    cart.map((item, index) => (
                                        <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-dark-700 rounded-xl">
                                            <div className="w-12 h-12 rounded-lg bg-white dark:bg-dark-600 flex items-center justify-center flex-shrink-0">
                                                <span className="text-xl">{item.mode === 'crate' ? '📦' : '🍾'}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                    {item.name}
                                                </p>
                                                <p className="text-sm text-primary-600 dark:text-primary-400">
                                                    {formatCurrency(item.finalPrice)}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => {
                                                        const newCart = [...cart];
                                                        if (newCart[index].quantity > 1) {
                                                            newCart[index].quantity--;
                                                            setCart(newCart);
                                                        } else {
                                                            removeFromCart(index);
                                                        }
                                                    }}
                                                    className="w-7 h-7 rounded-lg bg-gray-200 dark:bg-dark-600 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-dark-500 transition-colors"
                                                >
                                                    <HiOutlineMinus className="w-3 h-3" />
                                                </button>
                                                <span className="w-8 text-center font-medium text-gray-900 dark:text-white">
                                                    {item.quantity}
                                                </span>
                                                <button
                                                    onClick={() => {
                                                        const newCart = [...cart];
                                                        newCart[index].quantity++;
                                                        setCart(newCart);
                                                    }}
                                                    className="w-7 h-7 rounded-lg bg-gray-200 dark:bg-dark-600 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-dark-500 transition-colors"
                                                >
                                                    <HiOutlinePlus className="w-3 h-3" />
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => removeFromCart(index)}
                                                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                            >
                                                <HiOutlineTrash className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="p-4 border-t border-gray-200 dark:border-dark-700 space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
                                    <span className="text-gray-900 dark:text-white">{formatCurrency(subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500 dark:text-gray-400">IVA (16%)</span>
                                    <span className="text-gray-900 dark:text-white">{formatCurrency(totalTax)}</span>
                                </div>
                                <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200 dark:border-dark-700">
                                    <span className="text-gray-900 dark:text-white">Total</span>
                                    <span className="text-primary-600 dark:text-primary-400">{formatCurrency(totalWithTax)}</span>
                                </div>

                                <Button
                                    variant="primary"
                                    size="lg"
                                    className="w-full"
                                    onClick={() => setIsCheckoutModalOpen(true)}
                                    disabled={cart.length === 0}
                                >
                                    Finalizar Venda
                                </Button>
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {/* Receipt Preview Modal */}
            {lastSale && (
                <ThermalReceiptPreview
                    isOpen={thermalPreviewOpen}
                    onClose={() => {
                        setThermalPreviewOpen(false);
                    }}
                    sale={lastSale}
                />
            )}


            {/* Dashboard View */}
            {view === 'dashboard' && (
                <DashboardView
                    sales={sales}
                    products={products}
                    range={dashboardRange}
                    setRange={setDashboardRange}
                />
            )}


            {/* Inventory View - Placeholder */}
            {
                view === 'inventory' && (
                    <div className="flex flex-col gap-6 pb-8">
                        {/* Header */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Gestão de Stock</h2>
                                <p className="text-gray-500 dark:text-gray-400">Controlo de stock e depósitos.</p>
                            </div>
                            <Button
                                variant="ghost"
                                onClick={() => refetchProducts()}
                                leftIcon={<HiOutlineRefresh className="w-5 h-5" />}
                            >
                                Atualizar
                            </Button>
                        </div>

                        {/* Filters Card */}
                        <Card padding="md">
                            <div className="flex flex-col md:flex-row gap-4">
                                <div className="flex-1">
                                    <Input
                                        placeholder="Buscar por código, nome..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        leftIcon={<HiOutlineSearch className="w-5 h-5 text-gray-400" />}
                                    />
                                </div>
                                <div className="w-full md:w-64">
                                    <Select
                                        value={stockFilter}
                                        onChange={(e) => setStockFilter(e.target.value as any)}
                                        options={[
                                            { value: 'all', label: 'Todo Stock' },
                                            { value: 'low', label: 'Stock Baixo' },
                                            { value: 'out', label: 'Esgotado' }
                                        ]}
                                    />
                                </div>
                            </div>
                        </Card>

                        {/* Table Card */}
                        <Card padding="none">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 dark:bg-dark-900/50 uppercase text-xs font-bold text-gray-600 dark:text-gray-400">
                                        <tr>
                                            <th className="px-6 py-4 border-b dark:border-dark-700">Produto</th>
                                            <th className="px-6 py-4 border-b dark:border-dark-700">Stock</th>
                                            <th className="px-6 py-4 border-b dark:border-dark-700 text-right">Preço</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                                        {products.map(p => (
                                            <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-gray-900 dark:text-white">{p.name}</div>
                                                    <div className="text-xs text-mono text-gray-500">{p.code}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Badge
                                                        variant={p.currentStock <= 0 ? 'danger' : p.currentStock <= (p.minStock || 10) ? 'warning' : 'success'}
                                                    >
                                                        {p.currentStock} un
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4 text-right font-bold text-gray-900 dark:text-gray-100">
                                                    {formatCurrency(p.price)}
                                                </td>
                                            </tr>
                                        ))}
                                        {products.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                                    <EmptyState
                                                        icon={<HiOutlineCube className="w-12 h-12" />}
                                                        title="Nenhum produto encontrado"
                                                        description="Tente ajustar os seus filtros de pesquisa para encontrar o que procura."
                                                    />
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            <div className="px-6 py-6 bg-gray-50 dark:bg-dark-800/50">
                                <Pagination
                                    currentPage={prodPage}
                                    totalItems={prodPagination?.total || 0}
                                    itemsPerPage={prodPageSize}
                                    onPageChange={setProdPage}
                                    onItemsPerPageChange={(size) => {
                                        setProdPageSize(size);
                                        setProdPage(1);
                                    }}
                                    itemsPerPageOptions={[10, 20, 50]}
                                />
                            </div>
                        </Card>
                    </div>
                )
            }

            {/* Reports View */}
            {view === 'reports' && (
                <ReportsView
                    sales={sales}
                    products={products}
                    period={reportPeriod}
                    setPeriod={setReportPeriod}
                    startDate={reportStartDate}
                    setStartDate={setReportStartDate}
                    endDate={reportEndDate}
                    setEndDate={setReportEndDate}
                />
            )}

            {/* Checkout Modal */}
            <Modal
                isOpen={isCheckoutModalOpen}
                onClose={() => setIsCheckoutModalOpen(false)}
                title="Finalizar Venda"
                size="md"
            >
                <div className="space-y-6">
                    <div className="text-center py-6 bg-gray-50 dark:bg-dark-800 rounded-2xl border-2 border-primary-100 dark:border-primary-900/30">
                        <p className="text-xs text-gray-400 uppercase tracking-[0.2em] font-bold mb-1">Total Final com IVA (16%)</p>
                        <p className="text-5xl font-black text-primary-600 tracking-tighter">{formatCurrency(totalWithTax)}</p>
                        <div className="flex justify-center gap-4 mt-2 text-xs text-gray-500 font-medium">
                            <span>Subtotal: {formatCurrency(subtotal)}</span>
                            <span>IVA: {formatCurrency(totalTax)}</span>
                        </div>
                    </div>

                    <Input
                        label="Valor Recebido (Opcional)"
                        type="number"
                        placeholder="0.00"
                        value={customerMoney}
                        onChange={(e) => setCustomerMoney(e.target.value)}
                        className="text-lg"
                    />

                    {customerMoney && parseFloat(customerMoney) >= totalWithTax && (
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800/50 text-center animate-in fade-in zoom-in duration-300">
                            <p className="text-xs text-green-700 dark:text-green-300 font-bold uppercase tracking-wider mb-1">Troco a Devolver</p>
                            <p className="text-3xl font-black text-green-600 dark:text-green-400">
                                {formatCurrency(parseFloat(customerMoney) - totalWithTax)}
                            </p>
                        </div>
                    )}

                    <div className="flex gap-3 pt-4">
                        <Button
                            variant="ghost"
                            fullWidth
                            onClick={() => setIsCheckoutModalOpen(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            fullWidth
                            onClick={handleCheckout}
                            isLoading={processingSale}
                        >
                            Confirmar Venda
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Clear Cart Confirmation Modal */}
            <ConfirmationModal
                isOpen={clearCartModalOpen}
                onClose={() => setClearCartModalOpen(false)}
                onConfirm={() => {
                    clearCart();
                    setClearCartModalOpen(false);
                }}
                title="Limpar Carrinho?"
                message="Tem certeza que deseja remover todos os itens do carrinho? Esta ação não pode ser desfeita."
                confirmText="Sim, Limpar"
                cancelText="Cancelar"
                variant="warning"
            />
        </div >
    );
}

// Sub-component for Product Card - Redesigned to match POSInterface
function BottleProductCard({ product, onAdd }: { product: any, onAdd: (p: any, mode: 'unit' | 'crate', ret: boolean) => void }) {
    const isOut = product.currentStock <= 0;
    const isLow = product.currentStock <= (product.minStock || 10);

    return (
        <button
            onClick={() => onAdd(product, 'unit', false)}
            disabled={isOut}
            className={`p-3 rounded-xl border-2 text-left transition-all hover:shadow-lg group overflow-hidden ${isOut
                ? 'opacity-75 grayscale border-gray-200 dark:border-dark-700 cursor-not-allowed'
                : 'border-gray-200 dark:border-dark-600 hover:border-primary-500 dark:hover:border-primary-500 bg-white dark:bg-dark-800'
                }`}
        >
            {/* Product Image Placeholder */}
            <div className="w-full h-16 rounded-lg bg-gray-100 dark:bg-dark-700 flex items-center justify-center mb-2 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 transition-colors flex-shrink-0">
                <span className="text-2xl">🍾</span>
            </div>

            {/* Product Code */}
            <p className="text-xs text-primary-600 dark:text-primary-400 font-mono mb-1 truncate">
                {product.code}
            </p>

            {/* Product Name */}
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-1 line-clamp-2 break-words min-h-[2.5rem]">
                {product.name}
            </p>

            {/* Price and Stock Badge */}
            <div className="flex items-center justify-between gap-1 mt-2">
                <span className="text-sm font-bold text-primary-600 dark:text-primary-400 truncate">
                    {formatCurrency(product.price)}
                </span>
                <Badge variant={isOut ? 'danger' : isLow ? 'warning' : 'success'} size="sm">
                    {isOut ? 'OUT' : product.currentStock}
                </Badge>
            </div>

            {/* Pack Size Indicator */}
            {product.packSize > 1 && (
                <p className="text-[10px] text-gray-500 mt-1">
                    Caixa de {product.packSize} un
                </p>
            )}

            {/* Returnable Indicator */}
            {product.isReturnable && (
                <div className="mt-1 flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400">
                    <HiOutlineRefresh className="w-3 h-3" />
                    <span>Retornável</span>
                </div>
            )}
        </button>
    );
}

// Professional Dashboard Component
function DashboardView({ sales, products, range, setRange }: {
    sales: any[];
    products: any[];
    range: TimeRange;
    setRange: (r: TimeRange) => void;
}) {
    // 1. Filter Sales
    const filteredSales = useMemo(() => {
        const now = new Date();
        const cutoffDate = subMonths(now,
            range === '1M' ? 1 :
                range === '2M' ? 2 :
                    range === '3M' ? 3 :
                        range === '6M' ? 6 : 12
        );

        return sales.filter(s => isAfter(parseISO(s.createdAt), cutoffDate));
    }, [sales, range]);

    // 2. Aggregate Data for Charts
    const chartData = useMemo(() => {
        const data: Record<string, { date: string; amount: number; count: number }> = {};
        const now = new Date();

        // Create initial buckets to ensure continuous timeline
        // If range is large (>= 6M), group by month. Else by day.
        const byMonth = range === '6M' || range === '1Y';

        if (byMonth) {
            const months = eachMonthOfInterval({
                start: subMonths(now, range === '6M' ? 6 : 12),
                end: now
            });
            months.forEach(m => {
                const key = format(m, 'MM/yyyy');
                data[key] = { date: key, amount: 0, count: 0 };
            });
        } else {
            // Group by day for smaller ranges
            const days = eachDayOfInterval({
                start: subMonths(now, range === '1M' ? 1 : range === '2M' ? 2 : 3),
                end: now
            });
            days.forEach(d => {
                const key = format(d, 'dd/MM');
                data[key] = { date: key, amount: 0, count: 0 };
            });
        }

        // Fill data
        filteredSales.forEach(s => {
            const date = parseISO(s.createdAt);
            const key = format(date, byMonth ? 'MM/yyyy' : 'dd/MM');
            if (data[key]) {
                data[key].amount += Number(s.total);
                data[key].count += 1;
            }
        });

        return Object.values(data);
    }, [filteredSales, range]);

    const stats = useMemo(() => {
        const totalSales = filteredSales.reduce((acc, s) => acc + Number(s.total), 0);
        const totalTx = filteredSales.length;
        const avgTicket = totalTx > 0 ? totalSales / totalTx : 0;

        return { totalSales, totalTx, avgTicket };
    }, [filteredSales]);

    // 3. Aggregate Category Mix
    const categoryData = useMemo(() => {
        const counts: Record<string, number> = {};

        // Map product IDs to categories for fast lookup if not present in sale item
        const prodCategories: Record<string, string> = {};
        products.forEach(p => { prodCategories[p.id] = p.category; });

        filteredSales.forEach(s => {
            s.items?.forEach((item: any) => {
                const cat = item.product?.category || prodCategories[item.productId] || 'Other';
                counts[cat] = (counts[cat] || 0) + Number(item.total || 0);
            });
        });

        const COLORS = ['#F59E0B', '#EF4444', '#8B5CF6', '#10B981', '#3B82F6', '#EC4899'];

        const sortedData = Object.entries(counts)
            .map(([name, value], index) => ({
                name: name === 'beverages' ? 'Bebidas' :
                    name === 'food' ? 'Alimentação' :
                        name === 'other' ? 'Outros' :
                            name.charAt(0).toUpperCase() + name.slice(1),
                value,
                color: COLORS[index % COLORS.length]
            }))
            .sort((a, b) => b.value - a.value);

        return sortedData.length > 0 ? sortedData : [
            { name: 'Sem dados', value: 1, color: '#E5E7EB' }
        ];
    }, [filteredSales, products]);


    return (
        <div className="flex flex-col gap-6 pb-8">
            {/* Filter Bar */}
            <div className="flex justify-between items-center bg-white dark:bg-dark-800 p-3 rounded-xl shadow-sm border border-gray-100 dark:border-dark-700">
                <div className="flex items-center gap-2">
                    <HiOutlineCalendar className="w-5 h-5 text-gray-500" />
                    <span className="font-bold text-gray-700 dark:text-gray-300">Período de Análise</span>
                </div>
                <div className="flex bg-gray-100 dark:bg-dark-900 p-1 rounded-lg">
                    {(['1M', '2M', '3M', '6M', '1Y'] as TimeRange[]).map((r) => {
                        const labels: Record<TimeRange, string> = {
                            '1M': '1 Mês',
                            '2M': '2 Meses',
                            '3M': '3 Meses',
                            '6M': '6 Meses',
                            '1Y': '1 Ano'
                        };
                        return (
                            <button
                                key={r}
                                onClick={() => setRange(r)}
                                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${range === r
                                    ? 'bg-white dark:bg-dark-700 text-primary-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                            >
                                {labels[r]}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
                    <div className="flex flex-col">
                        <span className="text-blue-100 text-sm font-medium uppercase tracking-wider mb-1">Volume de Vendas</span>
                        <span className="text-3xl font-black">{stats.totalSales.toLocaleString()} MT</span>
                        <div className="mt-4 flex items-center gap-2 text-blue-100 text-sm">
                            <HiOutlineTrendingUp className="w-4 h-4" />
                            <span>No período selecionado ({range})</span>
                        </div>
                    </div>
                </Card>
                <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
                    <div className="flex flex-col">
                        <span className="text-purple-100 text-sm font-medium uppercase tracking-wider mb-1">Transações</span>
                        <span className="text-3xl font-black">{stats.totalTx}</span>
                        <div className="mt-4 flex items-center gap-2 text-purple-100 text-sm">
                            <HiOutlineShoppingCart className="w-4 h-4" />
                            <span>Vendas realizadas</span>
                        </div>
                    </div>
                </Card>
                <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0">
                    <div className="flex flex-col">
                        <span className="text-emerald-100 text-sm font-medium uppercase tracking-wider mb-1">Ticket Médio</span>
                        <span className="text-3xl font-black">{stats.avgTicket.toLocaleString(undefined, { maximumFractionDigits: 0 })} MT</span>
                        <div className="mt-4 flex items-center gap-2 text-emerald-100 text-sm">
                            <HiOutlineCash className="w-4 h-4" />
                            <span>Por venda</span>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="h-[400px] flex flex-col">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <HiOutlineChartBar className="w-5 h-5 text-primary-500" />
                        Evolução de Vendas
                    </h3>
                    <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis
                                    dataKey="date"
                                    stroke="#9CA3AF"
                                    tick={{ fontSize: 12 }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#9CA3AF"
                                    tick={{ fontSize: 12 }}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `${value / 1000}k`}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: any) => [`${(Number(value) || 0).toLocaleString()} MT`, 'Vendas']}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="amount"
                                    stroke="#3B82F6"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorSales)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card className="h-[400px] flex flex-col">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">

                        <HiOutlineCube className="w-5 h-5 text-purple-500" />
                        Mix de Vendas por Categoria
                    </h3>
                    <div className="flex-1 w-full min-h-0 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={categoryData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {categoryData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>
        </div>
    );
}

// Reports View Component
function ReportsView({ sales, products, period, setPeriod, startDate, setStartDate, endDate, setEndDate }: {
    sales: any[];
    products: any[];
    period: 'today' | 'week' | 'month' | 'year' | 'custom';
    setPeriod: (p: 'today' | 'week' | 'month' | 'year' | 'custom') => void;
    startDate: string;
    setStartDate: (d: string) => void;
    endDate: string;
    setEndDate: (d: string) => void;
}) {
    // Filter sales by period - only beverages (bottle store)
    const filteredSales = useMemo(() => {
        const now = new Date();
        let start: Date;
        let end: Date = new Date();

        switch (period) {
            case 'today':
                start = new Date(now.setHours(0, 0, 0, 0));
                break;
            case 'week':
                start = new Date(now);
                start.setDate(start.getDate() - 7);
                break;
            case 'month':
                start = new Date(now);
                start.setMonth(start.getMonth() - 1);
                break;
            case 'year':
                start = new Date(now);
                start.setFullYear(start.getFullYear() - 1);
                break;
            case 'custom':
                start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                break;
            default:
                start = new Date(0);
        }

        // Filter only sales with beverage items
        return sales.filter((sale) => {
            const saleDate = new Date(sale.createdAt);
            const hasBeverages = (sale.items || []).some((item: any) => {
                const product = products.find(p => p.id === (item.productId || item.product?.id));
                return product?.category === 'beverages';
            });
            return saleDate >= start && saleDate <= end && hasBeverages;
        });
    }, [sales, products, period, startDate, endDate]);

    // Calculate metrics
    const metrics = useMemo(() => {
        const totalSales = filteredSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
        const totalTax = filteredSales.reduce((sum, sale) => sum + Number(sale.tax || 0), 0);
        const avgTicket = filteredSales.length > 0 ? totalSales / filteredSales.length : 0;

        return {
            totalSales,
            totalTax,
            avgTicket,
            transactionCount: filteredSales.length,
        };
    }, [filteredSales]);

    // Daily sales data
    const dailySalesData = useMemo(() => {
        const dailyMap = new Map<string, { date: string; total: number; count: number }>();

        filteredSales.forEach((sale) => {
            const date = format(parseISO(sale.createdAt), 'dd/MM');
            const existing = dailyMap.get(date) || { date, total: 0, count: 0 };
            existing.total += Number(sale.total || 0);
            existing.count += 1;
            dailyMap.set(date, existing);
        });

        return Array.from(dailyMap.values()).slice(-14);
    }, [filteredSales]);

    // Payment method distribution
    const paymentMethodData = useMemo(() => {
        const methodMap = new Map<string, number>();

        filteredSales.forEach((sale) => {
            const count = methodMap.get(sale.paymentMethod) || 0;
            methodMap.set(sale.paymentMethod, count + Number(sale.total || 0));
        });

        const methodLabels: Record<string, string> = {
            cash: 'Dinheiro',
            card: 'Cartão',
            pix: 'M-Pesa',
            transfer: 'Transferência',
            credit: 'Crédito',
        };

        const data = Array.from(methodMap.entries()).map(([method, value]) => ({
            name: methodLabels[method] || method,
            value,
        }));

        return data.length > 0 ? data : [{ name: 'Sem dados', value: 1 }];
    }, [filteredSales]);

    const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

    // Top products
    const topProducts = useMemo(() => {
        const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();

        filteredSales.forEach((sale) => {
            (sale.items || []).forEach((item: any) => {
                const product = products.find(p => p.id === (item.productId || item.product?.id));
                if (product?.category !== 'beverages') return;

                const productId = item.productId || item.product?.id;
                const productName = item.productName || item.product?.name || product?.name || 'Produto';
                const quantity = item.quantity || 1;
                const revenue = Number(item.total) || (quantity * Number(item.unitPrice || item.price || 0));

                const existing = productMap.get(productId) || { name: productName, quantity: 0, revenue: 0 };
                existing.quantity += quantity;
                existing.revenue += revenue;
                productMap.set(productId, existing);
            });
        });

        return Array.from(productMap.values())
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);
    }, [filteredSales, products]);

    const topProductsPagination = usePagination(topProducts, 5);
    const salesPagination = usePagination(filteredSales, 10);

    // Generate PDF
    const generatePDF = () => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        let y = 20;

        // Header
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('RELATÓRIO DE VENDAS - GARRAFEIRA', pageWidth / 2, y, { align: 'center' });
        y += 10;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const periodLabels = { today: 'Hoje', week: 'Esta Semana', month: 'Este Mês', year: 'Este Ano', custom: 'Personalizado' };
        doc.text(`Período: ${periodLabels[period]}`, pageWidth / 2, y, { align: 'center' });
        y += 5;
        doc.text(`Data: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageWidth / 2, y, { align: 'center' });
        y += 15;

        // Metrics
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('RESUMO', 20, y);
        y += 10;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        const metricsData = [
            ['Total de Vendas:', formatCurrency(metrics.totalSales)],
            ['IVA Total (16%):', formatCurrency(metrics.totalTax)],
            ['Transações:', metrics.transactionCount.toString()],
            ['Ticket Médio:', formatCurrency(metrics.avgTicket)],
        ];

        metricsData.forEach(([label, value]) => {
            doc.text(label, 25, y);
            doc.text(value, 100, y);
            y += 7;
        });

        y += 10;

        // Top Products
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('PRODUTOS MAIS VENDIDOS', 20, y);
        y += 10;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Produto', 25, y);
        doc.text('Qtd', 120, y);
        doc.text('Receita', 150, y);
        y += 7;

        doc.setFont('helvetica', 'normal');
        topProducts.slice(0, 10).forEach((product) => {
            if (y > 270) {
                doc.addPage();
                y = 20;
            }
            doc.text(product.name.substring(0, 40), 25, y);
            doc.text(product.quantity.toString(), 120, y);
            doc.text(formatCurrency(product.revenue), 150, y);
            y += 6;
        });

        doc.save(`relatorio-garrafeira-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };

    // Generate CSV
    const generateCSV = () => {
        const headers = ['Data', 'Recibo', 'Método', 'IVA', 'Total'];
        const csvContent = [
            headers.join(','),
            ...filteredSales.map(sale => [
                format(parseISO(sale.createdAt), 'yyyy-MM-dd HH:mm'),
                sale.receiptNumber,
                sale.paymentMethod,
                sale.tax,
                sale.total
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `relatorio-garrafeira-${format(new Date(), 'yyyy-MM-dd')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const periodOptions = [
        { value: 'today' as const, label: 'Hoje' },
        { value: 'week' as const, label: 'Esta Semana' },
        { value: 'month' as const, label: 'Este Mês' },
        { value: 'year' as const, label: 'Este Ano' },
        { value: 'custom' as const, label: 'Personalizado' },
    ];

    return (
        <div className="flex flex-col gap-6 pb-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Relatórios de Vendas</h2>
                    <p className="text-gray-500 dark:text-gray-400">Análise de vendas da Garrafeira</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={generateCSV} leftIcon={<HiOutlineDocumentDownload className="w-4 h-4" />}>
                        Exportar CSV
                    </Button>
                    <Button onClick={generatePDF} leftIcon={<HiOutlineDocumentDownload className="w-4 h-4" />}>
                        Exportar PDF
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card padding="md">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Período:</span>
                        <div className="flex flex-wrap gap-1">
                            {periodOptions.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => setPeriod(option.value)}
                                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${period === option.value
                                        ? 'bg-primary-600 text-white'
                                        : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                                        }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {period === 'custom' && (
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800"
                            />
                            <span className="text-gray-500">até</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800"
                            />
                        </div>
                    )}
                </div>
            </Card>

            {/* Metrics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card padding="sm" className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                    <div className="flex flex-col">
                        <p className="text-xs text-white/80 uppercase font-bold tracking-wider mb-1">Total Vendas</p>
                        <p className="text-2xl font-bold">{formatCurrency(metrics.totalSales)}</p>
                    </div>
                </Card>

                <Card padding="sm" className="bg-gradient-to-br from-green-500 to-green-600 text-white">
                    <div className="flex flex-col">
                        <p className="text-xs text-white/80 uppercase font-bold tracking-wider mb-1">IVA (16%)</p>
                        <p className="text-2xl font-bold">{formatCurrency(metrics.totalTax)}</p>
                    </div>
                </Card>

                <Card padding="sm" className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                    <div className="flex flex-col">
                        <p className="text-xs text-white/80 uppercase font-bold tracking-wider mb-1">Transações</p>
                        <p className="text-2xl font-bold">{metrics.transactionCount}</p>
                    </div>
                </Card>

                <Card padding="sm" className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
                    <div className="flex flex-col">
                        <p className="text-xs text-white/80 uppercase font-bold tracking-wider mb-1">Ticket Médio</p>
                        <p className="text-2xl font-bold">{formatCurrency(metrics.avgTicket)}</p>
                    </div>
                </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card padding="md">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Evolução de Vendas
                    </h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={dailySalesData}>
                                <defs>
                                    <linearGradient id="colorSalesBottle" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                <Tooltip formatter={(value) => [formatCurrency(value as number), 'Total']} />
                                <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2} fill="url(#colorSalesBottle)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card padding="md">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Métodos de Pagamento
                    </h3>
                    <div className="h-72 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={paymentMethodData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={2}
                                    dataKey="value"
                                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                                >
                                    {paymentMethodData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>

            {/* Top Products Table */}
            <Card padding="md">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Produtos Mais Vendidos
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-dark-700">
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">#</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Produto</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Qtd.</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Receita</th>
                            </tr>
                        </thead>
                        <tbody>
                            {topProductsPagination.paginatedItems.map((product, index) => (
                                <tr key={index} className="border-b border-gray-100 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-700/50">
                                    <td className="py-3 px-4 text-sm text-gray-500">{(topProductsPagination.currentPage - 1) * topProductsPagination.itemsPerPage + index + 1}</td>
                                    <td className="py-3 px-4">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">{product.name}</p>
                                    </td>
                                    <td className="py-3 px-4 text-right text-sm text-gray-600 dark:text-gray-300">{product.quantity}</td>
                                    <td className="py-3 px-4 text-right text-sm font-medium text-gray-900 dark:text-white">
                                        {formatCurrency(product.revenue)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="px-6 py-6 bg-gray-50 dark:bg-dark-800/50">
                    <Pagination
                        currentPage={topProductsPagination.currentPage}
                        totalItems={topProductsPagination.totalItems}
                        itemsPerPage={topProductsPagination.itemsPerPage}
                        onPageChange={topProductsPagination.setCurrentPage}
                        onItemsPerPageChange={topProductsPagination.setItemsPerPage}
                        itemsPerPageOptions={[5, 10, 20]}
                    />
                </div>
            </Card>

            {/* Recent Sales Table */}
            <Card padding="md">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Vendas Recentes
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-dark-700">
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Recibo</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Data</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Pagamento</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">IVA</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {salesPagination.paginatedItems.map((sale) => (
                                <tr key={sale.id} className="border-b border-gray-100 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-700/50">
                                    <td className="py-3 px-4 text-sm font-mono text-primary-600 dark:text-primary-400">
                                        {sale.receiptNumber}
                                    </td>
                                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">
                                        {format(parseISO(sale.createdAt), 'dd/MM/yyyy HH:mm')}
                                    </td>
                                    <td className="py-3 px-4">
                                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300">
                                            {sale.paymentMethod === 'cash' && 'Dinheiro'}
                                            {sale.paymentMethod === 'card' && 'Cartão'}
                                            {sale.paymentMethod === 'pix' && 'M-Pesa'}
                                            {sale.paymentMethod === 'transfer' && 'Transferência'}
                                            {sale.paymentMethod === 'credit' && 'Crédito'}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-right text-sm text-gray-600 dark:text-gray-300">
                                        {formatCurrency(sale.tax)}
                                    </td>
                                    <td className="py-3 px-4 text-right text-sm font-medium text-gray-900 dark:text-white">
                                        {formatCurrency(sale.total)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="px-6 py-6 bg-gray-50 dark:bg-dark-800/50">
                    <Pagination
                        currentPage={salesPagination.currentPage}
                        totalItems={salesPagination.totalItems}
                        itemsPerPage={salesPagination.itemsPerPage}
                        onPageChange={salesPagination.setCurrentPage}
                        onItemsPerPageChange={salesPagination.setItemsPerPage}
                        itemsPerPageOptions={[5, 10, 20]}
                    />
                </div>
            </Card>
        </div>
    );
}
