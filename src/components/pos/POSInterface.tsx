import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
    HiOutlineSearch,
    HiOutlinePlus,
    HiOutlineMinus,
    HiOutlineTrash,
    HiOutlineCash,
    HiOutlineCreditCard,
    HiOutlineQrcode,
    HiOutlinePrinter,
    HiOutlineX,
    HiOutlineScale,
    HiOutlineLockOpen,
    HiOutlineLockClosed,
    HiOutlineUserCircle,
    HiOutlineTag,
} from 'react-icons/hi';
import MobilePaymentModal from './MobilePaymentModal';
import ThermalReceiptPreview from './ThermalReceiptPreview';
import A4InvoicePreview from './A4InvoicePreview';
import { useStore } from '../../stores/useStore';
import { Button, Card, Input, Modal, Badge } from '../ui';
import { formatCurrency } from '../../utils/helpers';
import { paymentMethodLabels } from '../../utils/constants';
import type { Product, PaymentMethod, Sale, Customer } from '../../types';

import toast from 'react-hot-toast';
import { calculatePOSDiscounts, recordCampaignUsages, searchCustomersForPOS, applyPromoCode, type AppliedCampaign } from '../../utils/crmIntegration';
import { useProducts, useCustomers, useSales, useAlerts } from '../../hooks/useData';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import type { KeyboardShortcut } from '../../hooks/useKeyboardShortcuts';
import { useCompanySettings } from '../../hooks/useCompanySettings';
import { useInvoiceTaxes } from '../../utils/fiscalIntegration';


export default function POSInterface() {
    // API hooks for data
    const { products, isLoading: isLoadingProducts, refetch: refetchProducts } = useProducts();
    const { customers, isLoading: isLoadingCustomers } = useCustomers();
    const { createSale } = useSales();
    const { refetch: refetchAlerts } = useAlerts();

    // Company settings for print configuration
    const { settings: companySettings } = useCompanySettings();

    // Local store for cart management
    const { cart, addToCart, removeFromCart, updateCartQuantity, clearCart, addSale } = useStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>('cash');
    const [amountPaid, setAmountPaid] = useState('');
    const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
    const [receiptModalOpen, setReceiptModalOpen] = useState(false);
    const [lastSale, setLastSale] = useState<Sale | null>(null);
    const [thermalPreviewOpen, setThermalPreviewOpen] = useState(false);
    const [a4PreviewOpen, setA4PreviewOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Customer Selection State
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [customerSearchQuery, setCustomerSearchQuery] = useState('');
    const [showCustomerSearch, setShowCustomerSearch] = useState(false);
    const [appliedCampaigns, setAppliedCampaigns] = useState<AppliedCampaign[]>([]);

    // Promo Code State
    const [promoCode, setPromoCode] = useState('');
    const [promoCodeApplied, setPromoCodeApplied] = useState(false);

    // Loyalty Points State
    const [redeemPoints, setRedeemPoints] = useState(false);
    const POINT_VALUE = 1; // 1 Point = 1.00 MT

    // Scale (Balança) state
    const [scaleModalOpen, setScaleModalOpen] = useState(false);
    const [scaleProduct, setScaleProduct] = useState<Product | null>(null);
    const [scaleWeight, setScaleWeight] = useState('');
    const [isSimulatingScale, setIsSimulatingScale] = useState(false);

    // Cash Drawer (Caixa de Dinheiro) state
    const [cashDrawerOpen, setCashDrawerOpen] = useState(false);
    const [cashDrawerBalance, setCashDrawerBalance] = useState(5000); // Initial float
    const [cashDrawerModalOpen, setCashDrawerModalOpen] = useState(false);
    const [cashOperation, setCashOperation] = useState<'add' | 'remove'>('add');
    const [cashAmount, setCashAmount] = useState('');

    // Mobile Payment State
    const [mobilePaymentModalOpen, setMobilePaymentModalOpen] = useState(false);
    const [mobilePaymentProvider, setMobilePaymentProvider] = useState<'mpesa' | 'emola'>('mpesa');
    const [customerPhone, setCustomerPhone] = useState('');

    // Optional Customer Name for Receipt
    const [customerName, setCustomerName] = useState('');

    // Refs for keyboard shortcuts
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Keyboard shortcuts for POS
    const shortcuts: KeyboardShortcut[] = useMemo(() => [
        {
            key: 'F2',
            action: () => {
                searchInputRef.current?.focus();
                toast('🔍 Foco na busca', { duration: 1000 });
            },
            description: 'Focar campo de busca',
        },
        {
            key: 'F4',
            action: () => {
                if (cart.length > 0) {
                    setCheckoutModalOpen(true);
                } else {
                    toast.error('Carrinho vazio!');
                }
            },
            description: 'Finalizar venda',
        },
        {
            key: 'F8',
            action: () => {
                if (cashDrawerOpen) {
                    setCashDrawerOpen(false);
                    toast.success('Gaveta fechada!', { icon: '🔒' });
                } else {
                    setCashDrawerOpen(true);
                    toast.success('Gaveta aberta!', { icon: '💰' });
                }
            },
            description: 'Abrir/Fechar gaveta',
        },
        {
            key: 'F9',
            action: () => {
                if (lastSale) {
                    // Use print setting to open correct preview
                    if (companySettings?.printerType === 'a4') {
                        setA4PreviewOpen(true);
                    } else {
                        setThermalPreviewOpen(true);
                    }
                    toast('🖨️ Último recibo', { duration: 1000 });
                } else {
                    toast.error('Nenhuma venda recente');
                }
            },
            description: 'Imprimir último recibo',
        },
        {
            key: 'Escape',
            action: () => {
                if (checkoutModalOpen) {
                    setCheckoutModalOpen(false);
                } else if (receiptModalOpen) {
                    setReceiptModalOpen(false);
                } else if (scaleModalOpen) {
                    setScaleModalOpen(false);
                } else if (cashDrawerModalOpen) {
                    setCashDrawerModalOpen(false);
                } else if (cart.length > 0) {
                    clearCart();
                    toast('🗑️ Carrinho limpo', { duration: 1500 });
                }
            },
            description: 'Cancelar/Limpar',
        },
    ], [cart, lastSale, checkoutModalOpen, receiptModalOpen, scaleModalOpen, cashDrawerModalOpen, cashDrawerOpen, clearCart]);

    useKeyboardShortcuts(shortcuts);

    // Filter products by search
    const filteredProducts = useMemo(() => {
        if (!searchQuery) return products.filter(p => p.currentStock > 0);
        const query = searchQuery.toLowerCase();
        return products.filter(
            (p) =>
                p.currentStock > 0 &&
                (p.code.toLowerCase().includes(query) ||
                    p.name.toLowerCase().includes(query) ||
                    p.barcode?.toLowerCase().includes(query))
        );
    }, [products, searchQuery]);

    // Customer search results
    const customerSearchResults = useMemo(() => {
        if (!customerSearchQuery || !showCustomerSearch) return [];
        return searchCustomersForPOS(customerSearchQuery, customers || []);
    }, [customerSearchQuery, customers, showCustomerSearch]);

    // Cart calculations with campaign discounts
    const cartSubtotal = useMemo(
        () => cart.reduce((sum, item) => sum + item.total, 0),
        [cart]
    );

    // Calculate campaign discounts when cart or customer changes
    useEffect(() => {
        if (cartSubtotal > 0) {
            const discountResult = calculatePOSDiscounts(
                selectedCustomer?.id || null,
                cartSubtotal,
                customers || []
            );
            setAppliedCampaigns(discountResult.appliedCampaigns);
        } else {
            setAppliedCampaigns([]);
        }
    }, [cartSubtotal, selectedCustomer, customers]);

    // Reset redeem points when customer changes
    useEffect(() => {
        setRedeemPoints(false);
    }, [selectedCustomer]);

    const campaignDiscount = useMemo(() =>
        appliedCampaigns.reduce((sum, c) => sum + c.calculatedDiscount, 0),
        [appliedCampaigns]
    );

    // Loyalty Calculations
    const customerPoints = selectedCustomer?.loyaltyPoints || 0;
    const maxRedeemablePoints = customerPoints;
    // Cap redemption to subtotal (can't redeem more than order value)
    const pointsToRedeem = redeemPoints ? Math.min(Math.floor(cartSubtotal - campaignDiscount), maxRedeemablePoints) : 0;
    const loyaltyDiscount = pointsToRedeem * POINT_VALUE;

    const { getIVARate } = useInvoiceTaxes();
    const IVA_RATE_VAL = getIVARate() / 100;
    const discountedSubtotal = Math.max(0, cartSubtotal - campaignDiscount - loyaltyDiscount);
    const cartTax = discountedSubtotal * IVA_RATE_VAL;
    const cartDiscount = campaignDiscount + loyaltyDiscount; // Total discount
    const cartTotal = discountedSubtotal + cartTax;
    const change = parseFloat(amountPaid || '0') - cartTotal;

    // Payment methods
    const paymentMethods: { id: PaymentMethod; label: string; icon: React.ReactNode }[] = [
        { id: 'cash', label: 'Dinheiro', icon: <HiOutlineCash className="w-6 h-6" /> },
        { id: 'card', label: 'Cartão', icon: <HiOutlineCreditCard className="w-6 h-6" /> },
        { id: 'pix', label: 'PIX', icon: <HiOutlineQrcode className="w-6 h-6" /> },
        { id: 'mpesa', label: 'M-Pesa', icon: <span className="font-bold text-red-600">M</span> },
        { id: 'emola', label: 'e-Mola', icon: <span className="font-bold text-orange-600">E</span> },
    ];

    const handleAddProduct = (product: Product) => {
        // Check if product is sold by weight
        if (product.unit === 'kg' || product.unit === 'g') {
            setScaleProduct(product);
            setScaleWeight('');
            setScaleModalOpen(true);
        } else {
            addToCart(product, 1);
            toast.success(`${product.name} adicionado`, {
                icon: '🛒',
                duration: 1500,
            });
        }
    };

    // Scale handlers
    const handleSimulateScale = () => {
        setIsSimulatingScale(true);
        // Simulate scale reading with random weight
        const simulatedWeight = (Math.random() * 2 + 0.1).toFixed(3);
        setTimeout(() => {
            setScaleWeight(simulatedWeight);
            setIsSimulatingScale(false);
            toast.success('Peso capturado da balança!', { icon: '⚖️' });
        }, 1500);
    };

    const handleAddWeightedProduct = () => {
        if (!scaleProduct || !scaleWeight) return;
        const weight = parseFloat(scaleWeight);
        if (weight <= 0) {
            toast.error('Peso inválido!');
            return;
        }
        addToCart(scaleProduct, weight);
        toast.success(`${scaleProduct.name} adicionado (${weight}kg)`, { icon: '⚖️' });
        setScaleModalOpen(false);
        setScaleProduct(null);
        setScaleWeight('');
    };

    // Cash drawer handlers
    const handleOpenCashDrawer = () => {
        setCashDrawerOpen(true);
        toast.success('Gaveta aberta!', { icon: '💰' });
        // In real implementation, this would send command to hardware
        // For example: window.electronAPI?.openCashDrawer()
    };

    const handleCloseCashDrawer = () => {
        setCashDrawerOpen(false);
        toast.success('Gaveta fechada!', { icon: '🔒' });
    };

    const handleCashOperation = () => {
        const amount = parseFloat(cashAmount);
        if (!amount || amount <= 0) {
            toast.error('Valor inválido!');
            return;
        }
        if (cashOperation === 'add') {
            setCashDrawerBalance(prev => prev + amount);
            toast.success(`+${formatCurrency(amount)} adicionado à gaveta`);
        } else {
            if (amount > cashDrawerBalance) {
                toast.error('Saldo insuficiente na gaveta!');
                return;
            }
            setCashDrawerBalance(prev => prev - amount);
            toast.success(`-${formatCurrency(amount)} retirado da gaveta`);
        }
        setCashAmount('');
        setCashDrawerModalOpen(false);
    };

    // Handle barcode scan - automatically add product when Enter is pressed
    const handleBarcodeSearch = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && searchQuery.trim()) {
            // Try to find product by exact barcode match first
            const productByBarcode = products.find(
                (p) => p.barcode?.toLowerCase() === searchQuery.trim().toLowerCase() && p.currentStock > 0
            );

            if (productByBarcode) {
                addToCart(productByBarcode, 1);
                toast.success(`${productByBarcode.name} adicionado via código de barras`, {
                    icon: '📷',
                    duration: 2000,
                });
                setSearchQuery('');
                return;
            }

            // Try exact code match
            const productByCode = products.find(
                (p) => p.code.toLowerCase() === searchQuery.trim().toLowerCase() && p.currentStock > 0
            );

            if (productByCode) {
                addToCart(productByCode, 1);
                toast.success(`${productByCode.name} adicionado`, {
                    icon: '🛒',
                    duration: 1500,
                });
                setSearchQuery('');
                return;
            }

            // If only one product matches the search, add it
            if (filteredProducts.length === 1) {
                addToCart(filteredProducts[0], 1);
                toast.success(`${filteredProducts[0].name} adicionado`, {
                    icon: '🛒',
                    duration: 1500,
                });
                setSearchQuery('');
                return;
            }

            // No exact match found
            if (filteredProducts.length === 0) {
                toast.error('Nenhum produto encontrado com este código', {
                    icon: '❌',
                    duration: 2000,
                });
            }
        }
    }, [searchQuery, products, filteredProducts, addToCart]);

    const handleQuantityChange = (productId: string, newQuantity: number) => {
        if (newQuantity < 1) {
            removeFromCart(productId);
        } else {
            updateCartQuantity(productId, newQuantity);
        }
    };

    const handleCheckout = () => {
        if (cart.length === 0) {
            toast.error('Carrinho vazio!');
            return;
        }
        setCheckoutModalOpen(true);
    };

    const handlePaymentMethodSelect = (method: PaymentMethod) => {
        setSelectedPayment(method);
        if (method === 'mpesa' || method === 'emola') {
            setMobilePaymentProvider(method);
            setMobilePaymentModalOpen(true);
        } else {
            setAmountPaid(cartTotal.toFixed(2));
        }
    };

    const handleMobilePaymentConfirm = (phone: string) => {
        setCustomerPhone(phone);
        setMobilePaymentModalOpen(false);
        setAmountPaid(cartTotal.toFixed(2));
        toast.success('Combinação de pagamento recebida');
    };

    const handleConfirmSale = async () => {
        const paymentAmount = parseFloat(amountPaid);

        if (isNaN(paymentAmount) || paymentAmount < cartTotal) {
            toast.error('Valor insuficiente');
            return;
        }

        setIsProcessing(true);
        try {
            // 🔒 MELHORIA 1: Validação de estoque em tempo real antes de processar venda
            // Refetch products to get latest stock levels
            await refetchProducts();

            // Validate stock for all cart items
            const stockIssues: Array<{ productName: string; available: number; requested: number }> = [];

            for (const cartItem of cart) {
                const currentProduct = products.find(p => p.id === cartItem.productId);
                if (!currentProduct) {
                    stockIssues.push({
                        productName: cartItem.product?.name || 'Produto desconhecido',
                        available: 0,
                        requested: cartItem.quantity
                    });
                } else if (currentProduct.currentStock < cartItem.quantity) {
                    stockIssues.push({
                        productName: currentProduct.name,
                        available: currentProduct.currentStock,
                        requested: cartItem.quantity
                    });
                }
            }

            // If there are stock issues, show detailed error and stop
            if (stockIssues.length > 0) {
                const errorMessage = stockIssues.map(issue =>
                    `${issue.productName}: solicitado ${issue.requested}, disponível ${issue.available}`
                ).join('\n');

                toast.error(
                    `Estoque insuficiente:\n${errorMessage}`,
                    { duration: 6000 }
                );
                setIsProcessing(false);
                return;
            }

            // Construct sale data with proper type conversion
            const saleData = {
                customerId: selectedCustomer?.id,
                items: cart.map(item => ({
                    productId: item.productId,
                    quantity: Number(item.quantity),
                    unitPrice: Number(item.unitPrice),
                    discount: Number(item.discount || 0),
                    total: Number(item.total)
                })),
                subtotal: Number(cartSubtotal),
                discount: Number(cartDiscount),
                tax: Number(cartTax),
                total: Number(cartTotal),
                paymentMethod: selectedPayment,
                amountPaid: Number(paymentAmount),
                change: Number(paymentAmount - cartTotal),
                redeemPoints: pointsToRedeem,
                notes: customerPhone
                    ? `Pagamento Móvel: ${customerPhone}`
                    : selectedCustomer
                        ? `Cliente: ${selectedCustomer.name}`
                        : customerName
                            ? `Cliente: ${customerName}`
                            : undefined,
            };

            const savedSale = await createSale(saleData);

            // Still add to local store for compatibility if needed, though savedSale is now the source of truth
            addSale(savedSale);
            setLastSale(savedSale);

            // Record campaign usages (works with or without customer)
            if (appliedCampaigns.length > 0) {
                recordCampaignUsages(
                    selectedCustomer?.id || 'anonymous',
                    selectedCustomer?.name || 'Cliente Avulso',
                    savedSale.total,
                    appliedCampaigns
                );
            }

            setCheckoutModalOpen(false);
            // Open preview based on print settings
            if (companySettings?.printerType === 'a4') {
                setA4PreviewOpen(true);
            } else {
                setThermalPreviewOpen(true);
            }
            clearCart();
            setAmountPaid('');
            setCustomerPhone('');
            setCustomerName('');
            setSelectedCustomer(null);
            setAppliedCampaigns([]);
            setPromoCode('');
            setPromoCodeApplied(false);

            // Open Cash Drawer if cash payment simulation
            if (selectedPayment === 'cash') {
                setCashDrawerBalance(prev => prev + cartTotal);
            }

            // Refetch data to update stock and alerts
            refetchProducts();
            refetchAlerts();

            // 🎉 Success feedback
            toast.success('Venda realizada com sucesso!', {
                icon: '✅',
                duration: 3000
            });

        } catch (error: any) {
            console.error('Sale confirmation error:', error);

            // 🔒 MELHORIA 2: Tratamento de erros aprimorado com mensagens específicas
            const errorResponse = error.response?.data;
            const errorMessage = errorResponse?.error || error.message;

            // Stock insufficient error
            if (errorMessage?.includes('Stock insuficiente') || errorMessage?.includes('insuficiente')) {
                const productMatch = errorMessage.match(/(.+?)\. Disponível: (\d+)/);
                if (productMatch) {
                    toast.error(
                        `❌ ${errorMessage}\n\nPor favor, ajuste a quantidade no carrinho.`,
                        { duration: 6000 }
                    );
                } else {
                    toast.error(
                        `❌ Estoque insuficiente\n\nUm ou mais produtos não têm estoque disponível. Atualize o carrinho.`,
                        { duration: 5000 }
                    );
                }
                // Refetch products to show updated stock
                refetchProducts();
                return;
            }

            // Product not found error
            if (errorMessage?.includes('não encontrado')) {
                toast.error(
                    `❌ ${errorMessage}\n\nO produto pode ter sido removido. Atualizando lista...`,
                    { duration: 5000 }
                );
                refetchProducts();
                return;
            }

            // Customer points error
            if (errorMessage?.includes('Pontos insuficientes')) {
                toast.error(
                    `❌ ${errorMessage}\n\nDesmarque a opção de usar pontos de fidelidade.`,
                    { duration: 5000 }
                );
                setRedeemPoints(false);
                return;
            }

            // Network/timeout errors
            if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK' || errorMessage?.includes('timeout')) {
                toast.error(
                    `🌐 Erro de conexão\n\nVerifique sua internet e tente novamente.`,
                    { duration: 5000 }
                );
                return;
            }

            // Validation errors with details
            if (errorResponse?.details && Array.isArray(errorResponse.details)) {
                const validationErrors = errorResponse.details
                    .map((detail: any) => `• ${detail.field}: ${detail.message}`)
                    .join('\n');

                toast.error(
                    `❌ Erro de Validação\n\n${validationErrors}\n\nVerifique os dados e tente novamente.`,
                    { duration: 8000 }
                );

                // Log for debugging
                console.error('Validation errors:', errorResponse.details);
                return;
            }

            // Generic validation error
            if (errorMessage?.includes('inválidos') || errorMessage?.includes('validação')) {
                toast.error(
                    `❌ ${errorMessage}\n\nVerifique os dados da venda:\n• Produtos no carrinho\n• Quantidade e preços\n• Método de pagamento\n• Valor pago`,
                    { duration: 6000 }
                );

                // Log full error for debugging
                console.error('Validation error details:', errorResponse);
                return;
            }

            // Generic error with helpful message
            toast.error(
                `❌ Erro ao processar venda\n\n${errorMessage || 'Erro desconhecido. Tente novamente.'}\n\nSe o problema persistir, contacte o suporte.`,
                { duration: 6000 }
            );

        } finally {
            setIsProcessing(false);
        }
    };


    // 🔒 MELHORIA 3: Loading state com skeleton loader profissional
    if (isLoadingProducts || isLoadingCustomers) {
        return (
            <div className="h-full flex gap-4">
                {/* Left Panel Skeleton */}
                <div className="flex-1 flex flex-col">
                    {/* Search Skeleton */}
                    <Card padding="md" className="mb-4">
                        <div className="h-10 bg-gray-200 dark:bg-dark-700 rounded-lg animate-pulse"></div>
                    </Card>

                    {/* Hardware Toolbar Skeleton */}
                    <div className="flex items-center gap-3 mb-4 p-3 bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700">
                        <div className="h-8 w-32 bg-gray-200 dark:bg-dark-700 rounded-lg animate-pulse"></div>
                        <div className="h-8 w-32 bg-gray-200 dark:bg-dark-700 rounded-lg animate-pulse"></div>
                        <div className="flex-1"></div>
                        <div className="h-8 w-40 bg-gray-200 dark:bg-dark-700 rounded-lg animate-pulse"></div>
                    </div>

                    {/* Products Grid Skeleton */}
                    <Card padding="md" className="flex-1">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                            {Array.from({ length: 15 }).map((_, i) => (
                                <div key={i} className="p-3 rounded-xl border-2 border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-800 animate-pulse">
                                    <div className="w-full h-16 rounded-lg bg-gray-200 dark:bg-dark-700 mb-2"></div>
                                    <div className="h-3 bg-gray-200 dark:bg-dark-700 rounded mb-2 w-2/3"></div>
                                    <div className="h-4 bg-gray-200 dark:bg-dark-700 rounded mb-2"></div>
                                    <div className="flex items-center justify-between">
                                        <div className="h-4 bg-gray-200 dark:bg-dark-700 rounded w-1/3"></div>
                                        <div className="h-5 w-10 bg-gray-200 dark:bg-dark-700 rounded"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                {/* Right Panel Skeleton */}
                <div className="w-96">
                    <Card padding="none" className="h-full flex flex-col">
                        <div className="p-4 border-b border-gray-200 dark:border-dark-700">
                            <div className="h-6 bg-gray-200 dark:bg-dark-700 rounded mb-2 w-1/3 animate-pulse"></div>
                            <div className="h-4 bg-gray-200 dark:bg-dark-700 rounded w-1/4 animate-pulse"></div>
                        </div>
                        <div className="flex-1 p-4">
                            <div className="h-32 bg-gray-200 dark:bg-dark-700 rounded-lg animate-pulse"></div>
                        </div>
                        <div className="p-4 border-t border-gray-200 dark:border-dark-700">
                            <div className="h-12 bg-gray-200 dark:bg-dark-700 rounded-lg animate-pulse"></div>
                        </div>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 flex gap-4 min-h-0 px-1 pb-16">
                <MobilePaymentModal
                    isOpen={mobilePaymentModalOpen}
                    onClose={() => setMobilePaymentModalOpen(false)}
                    amount={cartTotal}
                    provider={mobilePaymentProvider}
                    onConfirm={handleMobilePaymentConfirm}
                />
                {/* Left Panel - Products */}
                <div className="flex-1 flex flex-col min-h-0">
                    {/* Search */}
                    <Card padding="md" className="mb-4">
                        <Input
                            ref={searchInputRef}
                            placeholder="Escaneie o código de barras ou busque por código/nome..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={handleBarcodeSearch}
                            leftIcon={<HiOutlineSearch className="w-5 h-5" />}
                            autoFocus
                        />
                        <div className="flex items-center justify-between mt-2">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                💡 <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-dark-700 rounded text-xs font-mono">Enter</kbd> adicionar produto
                            </p>
                            <div className="flex gap-2 text-xs text-gray-500 dark:text-gray-400">
                                <span><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-dark-700 rounded font-mono">F2</kbd> Busca</span>
                                <span><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-dark-700 rounded font-mono">F4</kbd> Pagar</span>
                                <span><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-dark-700 rounded font-mono">F8</kbd> Gaveta</span>
                                <span><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-dark-700 rounded font-mono">ESC</kbd> Limpar</span>
                            </div>
                        </div>
                    </Card>

                    {/* Hardware Toolbar */}
                    <div className="flex items-center justify-between gap-3 mb-4 p-3 bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Hardware:</span>
                            {/* Scale Button */}
                            <button
                                onClick={() => {
                                    if (filteredProducts.length > 0) {
                                        setScaleProduct(filteredProducts[0]);
                                        setScaleWeight('');
                                        setScaleModalOpen(true);
                                    } else {
                                        toast.error('Selecione um produto primeiro');
                                    }
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-lg hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors text-sm"
                                title="Abrir Balança"
                            >
                                <HiOutlineScale className="w-4 h-4" />
                                <span className="font-medium">Balança</span>
                            </button>

                            {/* Cash Drawer Open/Close */}
                            <button
                                onClick={cashDrawerOpen ? handleCloseCashDrawer : handleOpenCashDrawer}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors text-sm ${cashDrawerOpen
                                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200'
                                    : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                                    }`}
                                title={cashDrawerOpen ? 'Fechar Gaveta' : 'Abrir Gaveta'}
                            >
                                {cashDrawerOpen ? (
                                    <>
                                        <HiOutlineLockOpen className="w-4 h-4" />
                                        <span className="font-medium">Aberta</span>
                                    </>
                                ) : (
                                    <>
                                        <HiOutlineLockClosed className="w-4 h-4" />
                                        <span className="font-medium">Gaveta</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Cash Balance */}
                        <button
                            onClick={() => setCashDrawerModalOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors text-sm"
                            title="Gestão da Gaveta"
                        >
                            <HiOutlineCash className="w-4 h-4" />
                            <span className="font-medium">Caixa: {formatCurrency(cashDrawerBalance)}</span>
                        </button>
                    </div>

                    {/* Products Grid */}
                    <Card padding="md" className="flex-1 overflow-hidden">
                        <div className="h-full overflow-y-auto scrollbar-thin">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                {filteredProducts.map((product) => (
                                    <button
                                        key={product.id}
                                        onClick={() => handleAddProduct(product)}
                                        className="p-3 rounded-xl border-2 border-gray-200 dark:border-dark-600 hover:border-primary-500 dark:hover:border-primary-500 bg-white dark:bg-dark-800 text-left transition-all hover:shadow-lg group overflow-hidden"
                                    >
                                        <div className="w-full h-16 rounded-lg bg-gray-100 dark:bg-dark-700 flex items-center justify-center mb-2 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 transition-colors flex-shrink-0">
                                            <span className="text-2xl">📦</span>
                                        </div>
                                        <p className="text-xs text-primary-600 dark:text-primary-400 font-mono mb-1 truncate">
                                            {product.code}
                                        </p>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white mb-1 line-clamp-2 break-words min-h-[2.5rem]">
                                            {product.name}
                                        </p>
                                        <div className="flex items-center justify-between gap-1">
                                            <span className="text-sm font-bold text-primary-600 dark:text-primary-400 truncate">
                                                {formatCurrency(product.price)}
                                            </span>
                                            <Badge variant={product.currentStock > 10 ? 'success' : 'warning'} size="sm">
                                                {product.currentStock}
                                            </Badge>
                                        </div>
                                    </button>
                                ))}

                                {filteredProducts.length === 0 && (
                                    <div className="col-span-full py-12 text-center text-gray-500 dark:text-gray-400">
                                        Nenhum produto encontrado
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Right Panel - Cart */}
                <div className="w-96 flex flex-col min-h-0">
                    <Card padding="none" className="flex-1 flex flex-col">
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
                                    <div className="relative">
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
                                                {customerSearchResults.map((customer) => (
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
                                                            <p className="text-xs text-gray-500">{customer.phone}</p>
                                                        </div>
                                                        {customer.activeCampaigns > 0 && (
                                                            <Badge variant="success" size="sm">
                                                                <HiOutlineTag className="w-3 h-3 mr-1" />
                                                                {customer.activeCampaigns}
                                                            </Badge>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Loyalty Points Redemption */}
                            {selectedCustomer && (selectedCustomer.loyaltyPoints || 0) > 0 && (
                                <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-100 dark:border-amber-900/20">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                                            Pontos de Fidelidade
                                        </span>
                                        <Badge variant="warning" size="sm">
                                            {selectedCustomer.loyaltyPoints} pts
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="redeemPoints"
                                            checked={redeemPoints}
                                            onChange={(e) => setRedeemPoints(e.target.checked)}
                                            className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                                            disabled={cartSubtotal === 0}
                                        />
                                        <label htmlFor="redeemPoints" className="text-xs text-amber-700 dark:text-amber-300 cursor-pointer select-none">
                                            Usar pontos para desconto
                                        </label>
                                    </div>
                                    {redeemPoints && (
                                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 ml-6">
                                            Desconto: -{formatCurrency(pointsToRedeem * POINT_VALUE)} ({pointsToRedeem} pts)
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Optional Customer Name Input (for walk-in customers) */}
                            {!selectedCustomer && (
                                <div className="mt-3">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Nome do Cliente (Opcional)
                                    </label>
                                    <Input
                                        placeholder="Ex: João Silva"
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                        leftIcon={<HiOutlineUserCircle className="w-5 h-5 text-gray-400" />}
                                    />
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        Este nome aparecerá no recibo
                                    </p>
                                </div>
                            )}

                            {/* Promo Code Input */}
                            <div className="mt-3">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Código promocional..."
                                        value={promoCode}
                                        onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                                        disabled={promoCodeApplied}
                                        leftIcon={<HiOutlineTag className="w-4 h-4 text-gray-400" />}
                                        className="flex-1"
                                    />
                                    <Button
                                        size="sm"
                                        variant="primary"
                                        className={promoCodeApplied ? 'bg-green-600 hover:bg-green-700' : ''}
                                        disabled={!promoCode || promoCodeApplied || cartSubtotal === 0}
                                        onClick={() => {
                                            const result = applyPromoCode(promoCode, cartSubtotal);
                                            if (result.success && result.campaign) {
                                                // Check if already applied
                                                const alreadyApplied = appliedCampaigns.some(
                                                    c => c.campaignId === result.campaign!.campaignId
                                                );
                                                if (!alreadyApplied) {
                                                    setAppliedCampaigns([...appliedCampaigns, result.campaign]);
                                                    setPromoCodeApplied(true);
                                                    toast.success(result.message);
                                                } else {
                                                    toast.error('Este código já foi aplicado');
                                                }
                                            } else {
                                                toast.error(result.message);
                                            }
                                        }}
                                    >
                                        {promoCodeApplied ? '✓' : 'Aplicar'}
                                    </Button>
                                </div>
                                {promoCodeApplied && (
                                    <button
                                        className="text-xs text-red-500 hover:text-red-600 mt-1"
                                        onClick={() => {
                                            // Remove the promo code campaign
                                            setAppliedCampaigns(appliedCampaigns.filter(c => c.code?.toLowerCase() !== promoCode.toLowerCase()));
                                            setPromoCode('');
                                            setPromoCodeApplied(false);
                                            toast('Código removido');
                                        }}
                                    >
                                        Remover código
                                    </button>
                                )}
                            </div>

                            {/* Applied Campaigns */}
                            {appliedCampaigns.length > 0 && (
                                <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                    <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-1 flex items-center gap-1">
                                        <HiOutlineTag className="w-3 h-3" />
                                        Descontos Aplicados
                                    </p>
                                    {appliedCampaigns.map((campaign) => (
                                        <div key={campaign.campaignId} className="flex items-center justify-between text-xs">
                                            <span className="text-green-600 dark:text-green-400 truncate">
                                                {campaign.campaignName}
                                                {campaign.code && <span className="ml-1 opacity-75">({campaign.code})</span>}
                                            </span>
                                            <span className="text-green-700 dark:text-green-300 font-medium">
                                                -{formatCurrency(campaign.calculatedDiscount)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Cart Items */}
                        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
                            {cart.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                                    <div className="text-center">
                                        <HiOutlineSearch className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                        <p>Carrinho vazio</p>
                                        <p className="text-sm">Busque e adicione produtos</p>
                                    </div>
                                </div>
                            ) : (
                                cart.map((item) => (
                                    <div
                                        key={item.productId}
                                        className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-dark-700 rounded-xl"
                                    >
                                        <div className="w-12 h-12 rounded-lg bg-white dark:bg-dark-600 flex items-center justify-center flex-shrink-0">
                                            <span className="text-xl">📦</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                {item.product.name}
                                            </p>
                                            <p className="text-sm text-primary-600 dark:text-primary-400">
                                                {formatCurrency(item.unitPrice)}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleQuantityChange(item.productId, item.quantity - 1)}
                                                className="w-7 h-7 rounded-lg bg-gray-200 dark:bg-dark-600 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-dark-500 transition-colors"
                                            >
                                                <HiOutlineMinus className="w-3 h-3" />
                                            </button>
                                            <span className="w-8 text-center font-medium text-gray-900 dark:text-white">
                                                {item.quantity}
                                            </span>
                                            <button
                                                onClick={() => handleQuantityChange(item.productId, item.quantity + 1)}
                                                className="w-7 h-7 rounded-lg bg-gray-200 dark:bg-dark-600 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-dark-500 transition-colors"
                                            >
                                                <HiOutlinePlus className="w-3 h-3" />
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => removeFromCart(item.productId)}
                                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                        >
                                            <HiOutlineTrash className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Cart Summary */}
                        <div className="p-4 pb-12 border-t border-gray-200 dark:border-dark-700 space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
                                <span className="text-gray-900 dark:text-white">{formatCurrency(cartSubtotal)}</span>
                            </div>
                            {cartDiscount > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500 dark:text-gray-400">Desconto</span>
                                    <span className="text-green-600">-{formatCurrency(cartDiscount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500 dark:text-gray-400">IVA (16%)</span>
                                <span className="text-gray-900 dark:text-white">{formatCurrency(cartTax)}</span>
                            </div>
                            <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200 dark:border-dark-700">
                                <span className="text-gray-900 dark:text-white">Total</span>
                                <span className="text-primary-600 dark:text-primary-400">{formatCurrency(cartTotal)}</span>
                            </div>

                            {/* 🔒 MELHORIA 3: Feedback visual aprimorado no botão de checkout */}
                            <Button
                                onClick={handleCheckout}
                                disabled={cart.length === 0 || isProcessing}
                                className={`w-full ${isProcessing ? 'opacity-75 cursor-not-allowed' : ''}`}
                                size="lg"
                            >
                                {isProcessing ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span>Processando...</span>
                                    </div>
                                ) : (
                                    <>
                                        <HiOutlineCash className="w-5 h-5" />
                                        Finalizar Venda ({formatCurrency(cartTotal)})
                                    </>
                                )}
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Checkout Modal */}
            <Modal
                isOpen={checkoutModalOpen}
                onClose={() => setCheckoutModalOpen(false)}
                title="Finalizar Venda"
                size="md"
            >
                <div className="space-y-6">
                    {/* Payment Methods */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Forma de Pagamento
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {paymentMethods.map((method) => (
                                <button
                                    key={method.id}
                                    onClick={() => handlePaymentMethodSelect(method.id)}
                                    className={`
                                        flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all
                                        ${selectedPayment === method.id
                                            ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                                            : 'border-gray-200 dark:border-dark-600 text-gray-600 dark:text-gray-300 hover:border-primary-200 dark:hover:border-primary-800'
                                        }
                                    `}
                                >
                                    <div className="mb-2">{method.icon}</div>
                                    <span className="text-sm font-medium">{method.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Amount Paid (for cash) */}
                    {selectedPayment === 'cash' && (
                        <div>
                            <Input
                                label="Valor Recebido"
                                type="number"
                                step="0.01"
                                value={amountPaid}
                                onChange={(e) => setAmountPaid(e.target.value)}
                                leftIcon={<span className="text-gray-400">MT</span>}
                            />
                            {change > 0 && (
                                <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                                    <p className="text-sm text-green-600 dark:text-green-400">
                                        Troco: <strong className="text-lg">{formatCurrency(change)}</strong>
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Total */}
                    <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-600 dark:text-gray-300">Total a Pagar</span>
                            <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                                {formatCurrency(cartTotal)}
                            </span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <Button variant="ghost" className="flex-1" onClick={() => setCheckoutModalOpen(false)} disabled={isProcessing}>
                            Cancelar
                        </Button>
                        <Button className="flex-1" onClick={handleConfirmSale} disabled={isProcessing}>
                            {isProcessing ? 'Processando...' : 'Confirmar Pagamento'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Receipt Modal */}
            <Modal
                isOpen={receiptModalOpen}
                onClose={() => setReceiptModalOpen(false)}
                title="Venda Realizada!"
                size="md"
            >
                {lastSale && (
                    <div className="space-y-4">
                        <div className="text-center py-4">
                            <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-3">
                                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">
                                Venda concluída!
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Recibo #{lastSale.receiptNumber}
                            </p>
                        </div>

                        <div className="space-y-2 p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Forma de pagamento</span>
                                <span className="text-gray-900 dark:text-white">
                                    {paymentMethodLabels[lastSale.paymentMethod]}
                                </span>
                            </div>
                            {(lastSale.paymentMethod === 'mpesa' || lastSale.paymentMethod === 'emola') && lastSale.notes && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Telefone</span>
                                    <span className="text-gray-900 dark:text-white font-mono">
                                        {lastSale.notes.replace('Pagamento Móvel: ', '')}
                                    </span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Subtotal</span>
                                <span className="text-gray-900 dark:text-white">
                                    {formatCurrency(lastSale.subtotal)}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">IVA (16%)</span>
                                <span className="text-gray-900 dark:text-white">
                                    {formatCurrency(lastSale.tax)}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm pt-2 border-t border-gray-200 dark:border-dark-600">
                                <span className="text-gray-500 font-medium">Total (c/ IVA)</span>
                                <span className="font-bold text-gray-900 dark:text-white">
                                    {formatCurrency(lastSale.total)}
                                </span>
                            </div>
                            {lastSale.paymentMethod === 'cash' && lastSale.change > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Troco</span>
                                    <span className="text-green-600">{formatCurrency(lastSale.change)}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={() => {
                                setReceiptModalOpen(false);
                                setLastSale(null);
                            }}>
                                <HiOutlineX className="w-4 h-4 mr-2" />
                                Fechar
                            </Button>
                            <Button className="flex-1" onClick={() => {
                                setReceiptModalOpen(false);
                                if (companySettings?.printerType === 'a4') {
                                    setA4PreviewOpen(true);
                                } else {
                                    setThermalPreviewOpen(true);
                                }
                            }}>
                                <HiOutlinePrinter className="w-4 h-4 mr-2" />
                                Ver Recibo / Imprimir
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Thermal Receipt Preview */}
            {lastSale && (
                <ThermalReceiptPreview
                    isOpen={thermalPreviewOpen}
                    onClose={() => {
                        setThermalPreviewOpen(false);
                        // Only clear lastSale if A4 is also closed
                        if (!a4PreviewOpen) setLastSale(null);
                    }}
                    onShowA4={() => {
                        setThermalPreviewOpen(false);
                        // Small delay to ensure smooth modal transition
                        setTimeout(() => setA4PreviewOpen(true), 200);
                    }}
                    sale={lastSale}
                />
            )}

            {/* A4 Invoice Preview */}
            {lastSale && (
                <A4InvoicePreview
                    isOpen={a4PreviewOpen}
                    onClose={() => {
                        setA4PreviewOpen(false);
                        // Only clear lastSale if Thermal is also closed
                        if (!thermalPreviewOpen) setLastSale(null);
                    }}
                    sale={lastSale}
                />
            )}

            {/* Scale Modal */}
            <Modal
                isOpen={scaleModalOpen}
                onClose={() => setScaleModalOpen(false)}
                title="Balança - Pesar Produto"
                size="md"
            >
                {scaleProduct && (
                    <div className="space-y-6">
                        {/* Product Info */}
                        <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
                            <div className="w-16 h-16 rounded-lg bg-white dark:bg-dark-600 flex items-center justify-center">
                                <HiOutlineScale className="w-8 h-8 text-primary-600" />
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900 dark:text-white">
                                    {scaleProduct.name}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {formatCurrency(scaleProduct.price)} / kg
                                </p>
                            </div>
                        </div>

                        {/* Weight Display */}
                        <div className="text-center py-6 bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 rounded-xl border-2 border-dashed border-primary-300 dark:border-primary-700">
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Peso (kg)</p>
                            <p className="text-5xl font-bold text-primary-600 dark:text-primary-400 font-mono">
                                {scaleWeight || '0.000'}
                            </p>
                            {scaleWeight && (
                                <p className="text-lg font-semibold text-gray-900 dark:text-white mt-2">
                                    Total: {formatCurrency(parseFloat(scaleWeight) * scaleProduct.price)}
                                </p>
                            )}
                        </div>

                        {/* Manual Weight Input */}
                        <Input
                            label="Inserir peso manualmente (kg)"
                            type="number"
                            step="0.001"
                            min="0"
                            placeholder="0.000"
                            value={scaleWeight}
                            onChange={(e) => setScaleWeight(e.target.value)}
                        />

                        {/* Actions */}
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={handleSimulateScale}
                                disabled={isSimulatingScale}
                            >
                                <HiOutlineScale className="w-4 h-4 mr-2" />
                                {isSimulatingScale ? 'Pesando...' : 'Simular Balança'}
                            </Button>
                            <Button
                                className="flex-1"
                                onClick={handleAddWeightedProduct}
                                disabled={!scaleWeight || parseFloat(scaleWeight) <= 0}
                            >
                                <HiOutlinePlus className="w-4 h-4 mr-2" />
                                Adicionar
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Cash Drawer Modal */}
            <Modal
                isOpen={cashDrawerModalOpen}
                onClose={() => setCashDrawerModalOpen(false)}
                title="Gestão da Gaveta"
                size="md"
            >
                <div className="space-y-6">
                    {/* Current Balance */}
                    <div className="text-center py-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl">
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Saldo Actual</p>
                        <p className="text-4xl font-bold text-green-600 dark:text-green-400">
                            {formatCurrency(cashDrawerBalance)}
                        </p>
                    </div>

                    {/* Operation Type */}
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setCashOperation('add')}
                            className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${cashOperation === 'add'
                                ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-600'
                                : 'border-gray-200 dark:border-dark-600 text-gray-600 dark:text-gray-300'
                                }`}
                        >
                            <HiOutlinePlus className="w-6 h-6" />
                            <span className="font-medium">Entrada</span>
                        </button>
                        <button
                            onClick={() => setCashOperation('remove')}
                            className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${cashOperation === 'remove'
                                ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600'
                                : 'border-gray-200 dark:border-dark-600 text-gray-600 dark:text-gray-300'
                                }`}
                        >
                            <HiOutlineMinus className="w-6 h-6" />
                            <span className="font-medium">Sangria</span>
                        </button>
                    </div>

                    {/* Amount Input */}
                    <Input
                        label={cashOperation === 'add' ? 'Valor a adicionar' : 'Valor a retirar'}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={cashAmount}
                        onChange={(e) => setCashAmount(e.target.value)}
                        leftIcon={<span className="text-gray-400">MT</span>}
                    />

                    {/* Actions */}
                    <div className="flex gap-3">
                        <Button variant="ghost" className="flex-1" onClick={() => setCashDrawerModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button
                            className="flex-1"
                            onClick={handleCashOperation}
                            disabled={!cashAmount || parseFloat(cashAmount) <= 0 || isProcessing}
                        >
                            {isProcessing ? 'Processando...' : 'Confirmar'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
