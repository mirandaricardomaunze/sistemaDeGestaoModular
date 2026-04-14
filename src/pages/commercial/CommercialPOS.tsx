import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LoadingSpinner, Badge } from '../../components/ui';
import { productsAPI, customersAPI, salesAPI, shiftAPI } from '../../services/api';
import type { ShiftSession, ShiftSummary } from '../../services/api';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { playScanSound } from '../../utils/audio';
import toast from 'react-hot-toast';
import {
    calculatePOSDiscounts,
    recordCampaignUsages,
    applyPromoCode
} from '../../utils/crmIntegration';
import { cn } from '../../utils/helpers';
import { usePagination } from '../../components/ui/Pagination';
import { HiOutlinePlay, HiOutlineStop, HiOutlineLockClosed, HiOutlineCash } from 'react-icons/hi';

// Components
import { CommercialProductGrid } from '../../components/commercial/pos/CommercialProductGrid';
import { CommercialCartPanel } from '../../components/commercial/pos/CommercialCartPanel';
import type { HeldSale } from '../../components/commercial/pos/CommercialCartPanel';
import { CommercialPaymentModal } from '../../components/commercial/pos/CommercialPaymentModal';
import type { PaymentEntry } from '../../components/commercial/pos/CommercialPaymentModal';
import { CommercialShiftModal } from '../../components/commercial/pos/CommercialShiftModal';
import type { ShiftData } from '../../components/commercial/pos/CommercialShiftModal';
import { CommercialReceiptModal } from '../../components/commercial/pos/CommercialReceiptModal';
import type { ReceiptData } from '../../components/commercial/pos/CommercialReceiptModal';
import { CommercialScaleModal } from '../../components/commercial/pos/CommercialScaleModal';
import { CommercialCashMovementModal } from '../../components/commercial/pos/CommercialCashMovementModal';
import { CommercialShortcutsHUD, ShortcutsHintBadge } from '../../components/commercial/pos/CommercialShortcutsHUD';

export default function CommercialPOS() {
    const location = useLocation();
    const navigate = useNavigate();
    const searchInputRef = useRef<HTMLInputElement>(null);

    // ── Data Fetching ────────────────────────────────────────────────────────
    const { data: products = [], isLoading: loadingProducts, refetch: refetchProducts } = useQuery({
        queryKey: ['commercial', 'products'],
        queryFn: async () => {
            const data = await productsAPI.getAll({ origin_module: 'commercial' });
            return Array.isArray(data) ? data : (data?.data || []);
        }
    });

    // Carregar price tiers de todos os produtos com tiers definidos (lazy, cached)
    const { data: priceTiersMap = {} } = useQuery({
        queryKey: ['commercial', 'price-tiers'],
        queryFn: async () => {
            const map: Record<string, { minQty: number; price: number }[]> = {};
            await Promise.all(
                (products as any[]).map(async (p) => {
                    try {
                        const tiers = await productsAPI.getPriceTiers(p.id);
                        if (tiers.length > 0) map[p.id] = tiers.map(t => ({ minQty: t.minQty, price: Number(t.price) }));
                    } catch { /* sem tiers */ }
                })
            );
            return map;
        },
        enabled: products.length > 0,
        staleTime: 5 * 60 * 1000,
    });

    /** Retorna o preço escalonado para uma quantidade, ou o preço base. */
    const resolvePrice = useCallback((productId: string, basePrice: number, qty: number): number => {
        const tiers = (priceTiersMap as Record<string, { minQty: number; price: number }[]>)[productId];
        if (!tiers || tiers.length === 0) return basePrice;
        // Aplicar o maior tier cujo minQty <= qty
        const applicable = tiers.filter(t => qty >= t.minQty).sort((a, b) => b.minQty - a.minQty);
        return applicable.length > 0 ? applicable[0].price : basePrice;
    }, [priceTiersMap]);

    const { data: customers = [], isLoading: loadingCustomers } = useQuery({
        queryKey: ['commercial', 'customers'],
        queryFn: async () => {
            const data = await customersAPI.getAll();
            return Array.isArray(data) ? data : (data?.data || []);
        }
    });

    // ── POS State ────────────────────────────────────────────────────────────
    const [posSearch, setPosSearch] = useState('');
    const [cart, setCart] = useState<any[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
    const [customerName, setCustomerName] = useState('');
    const [promoCode, setPromoCode] = useState('');
    const [promoCodeApplied, setPromoCodeApplied] = useState(false);
    const [appliedCampaign, setAppliedCampaign] = useState<any>(null);

    // ── Hardware State ───────────────────────────────────────────────────────
    const [cashDrawerOpen, setCashDrawerOpen] = useState(false);

    // ── Held Sales (Parking) ─────────────────────────────────────────────────
    const [heldSales, setHeldSales] = useState<HeldSale[]>([]);

    // ── Shift Management (DB-backed) ──────────────────────────────────────────
    const queryClient = useQueryClient();
    const { data: activeShift, isLoading: loadingShift } = useQuery<ShiftSession | null>({
        queryKey: ['commercial', 'shift'],
        queryFn: () => shiftAPI.getCurrent(),
        refetchInterval: 60_000, // sync every minute
        retry: false,
    });
    const { data: shiftSummary } = useQuery<ShiftSummary | null>({
        queryKey: ['commercial', 'shift', 'summary'],
        queryFn: () => shiftAPI.getSummary(),
        enabled: !!activeShift,
        refetchInterval: 30_000,
    });

    const [showShiftModal, setShowShiftModal] = useState(false);
    const [shiftModalMode, setShiftModalMode] = useState<'open' | 'close'>('open');
    const [showScaleModal, setShowScaleModal] = useState(false);
    const [scaleProduct, setScaleProduct] = useState<{ name: string; unitPrice: number; unit?: string } | null>(null);

    // Build ShiftData shape for the modal from the DB session + summary
    const shift: ShiftData | null = useMemo(() => {
        if (!activeShift) return null;
        const s = shiftSummary;
        return {
            openedAt: new Date(activeShift.openedAt),
            openingBalance: Number(activeShift.openingBalance),
            cashSales: s?.byPaymentMethod?.cash ?? Number(activeShift.cashSales),
            mpesaSales: s?.byPaymentMethod?.mpesa ?? Number(activeShift.mpesaSales),
            cardSales: s?.byPaymentMethod?.card ?? Number(activeShift.cardSales),
            creditSales: s?.byPaymentMethod?.credit ?? Number(activeShift.creditSales),
            totalSales: s?.totalSales ?? Number(activeShift.totalSales),
            saleCount: s?.salesCount ?? 0,
            withdrawals: Number(activeShift.withdrawals || 0),
            deposits: Number(activeShift.deposits || 0),
        };
    }, [activeShift, shiftSummary]);

    const cashDrawerBalance = useMemo(() => {
        if (!shift) return 0;
        return shift.openingBalance + shift.cashSales;
    }, [shift]);

    // ── Modals ───────────────────────────────────────────────────────────────
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [lastReceipt, setLastReceipt] = useState<ReceiptData | null>(null);
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [showMovementModal, setShowMovementModal] = useState(false);
    const [movementType, setMovementType] = useState<'cash_in' | 'cash_out'>('cash_in');
    const [showShortcutsHUD, setShowShortcutsHUD] = useState(false);

    // ── Global discount (desconto global sobre o total, com controlo de permissão) ─
    const [globalDiscountPct, setGlobalDiscountPct] = useState(0);

    // ── Filtering & Pagination ───────────────────────────────────────────────
    const filteredProducts = useMemo(() => {
        if (!posSearch) return products.filter((p: any) => p.currentStock > 0);
        const q = posSearch.toLowerCase();
        return products.filter((p: any) =>
            p.currentStock > 0 &&
            (p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(q)))
        );
    }, [products, posSearch]);

    const posPagination = usePagination(filteredProducts, 12);

    // ── Pre-fill from Quote ──────────────────────────────────────────────────
    useEffect(() => {
        const state = location.state as any;
        if (state?.fromQuote && products.length > 0) {
            const quote = state.fromQuote;
            
            // Map items
            const newCart = (quote.items || []).map((item: any) => {
                const product = products.find((p: any) => p.id === item.productId);
                return {
                    productId: item.productId,
                    product: product || { name: item.productName, price: item.price, currentStock: 999 }, // fallback
                    quantity: item.quantity,
                    unitPrice: Number(item.price),
                    discountPct: 0,
                    total: item.quantity * Number(item.price)
                };
            });
            
            setCart(newCart);
            
            // Set customer
            if (quote.customerId) {
                const foundCustomer = customers.find((c: any) => c.id === quote.customerId);
                if (foundCustomer) setSelectedCustomer(foundCustomer);
                else setCustomerName(quote.customerName);
            } else {
                setCustomerName(quote.customerName);
            }

            toast.success(`Cotação ${quote.orderNumber} carregada!`);
            
            // Clear state so it doesn't re-run on every render or navigation
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, products, customers, navigate, location.pathname]);

    // ── Cart Logic ───────────────────────────────────────────────────────────
    const addToCart = useCallback((product: any, qty = 1) => {
        setCart(prev => {
            const existing = prev.find(item => item.productId === product.id);
            if (existing) {
                const newQty = existing.quantity + qty;
                if (newQty > product.currentStock) { toast.error('Stock insuficiente'); return prev; }
                const tieredPrice = resolvePrice(product.id, Number(product.price), newQty);
                const hasTier = tieredPrice !== existing.unitPrice;
                if (hasTier) toast(`Preço escalonado aplicado: ${tieredPrice.toLocaleString()} MTn/un`, { icon: '🏷️' });
                return prev.map(item =>
                    item.productId === product.id
                        ? { ...item, quantity: newQty, unitPrice: tieredPrice, total: newQty * tieredPrice * (1 - (item.discountPct || 0) / 100) }
                        : item
                );
            }
            if (qty > product.currentStock) { toast.error('Stock insuficiente'); return prev; }
            const unitPrice = resolvePrice(product.id, Number(product.price), qty);
            return [...prev, {
                productId: product.id,
                product,
                quantity: qty,
                unitPrice,
                discountPct: 0,
                total: qty * unitPrice
            }];
        });
        playScanSound();
    }, [resolvePrice]);

    const updateQuantity = useCallback((productId: string, qty: number) => {
        if (qty <= 0) { setCart(c => c.filter(i => i.productId !== productId)); return; }
        setCart(c => c.map(item => {
            if (item.productId !== productId) return item;
            if (qty > item.product.currentStock) { toast.error('Stock insuficiente'); return item; }
            const tieredPrice = resolvePrice(productId, item.product.price, qty);
            const total = qty * tieredPrice * (1 - (item.discountPct || 0) / 100);
            return { ...item, quantity: qty, unitPrice: tieredPrice, total };
        }));
    }, [resolvePrice]);

    const updateItemDiscount = (productId: string, discountPct: number) => {
        setCart(c => c.map(item => {
            if (item.productId !== productId) return item;
            const total = item.quantity * item.unitPrice * (1 - discountPct / 100);
            return { ...item, discountPct, total };
        }));
    };

    const removeFromCart = (productId: string) => {
        setCart(c => c.filter(i => i.productId !== productId));
    };

    // ── Calculations ─────────────────────────────────────────────────────────
    const cartSubtotal = useMemo(() => cart.reduce((s, i) => s + i.quantity * i.unitPrice, 0), [cart]);
    const itemDiscounts = useMemo(() => cart.reduce((s, i) => s + i.quantity * i.unitPrice * ((i.discountPct || 0) / 100), 0), [cart]);

    const { totalDiscount: crmDiscount, appliedCampaigns } = useMemo(() =>
        calculatePOSDiscounts(selectedCustomer?.id || null, cartSubtotal, customers),
        [selectedCustomer, cartSubtotal, customers]
    );

    const manualDiscount = appliedCampaign?.calculatedDiscount || 0;
    const globalDiscountAmt = cartSubtotal * (globalDiscountPct / 100);
    const cartDiscount = crmDiscount + manualDiscount + itemDiscounts + globalDiscountAmt;
    const cartTax = (cartSubtotal - cartDiscount) * 0.16;
    const cartTotal = cartSubtotal - cartDiscount + cartTax;

    // ── Promo code ────────────────────────────────────────────────────────────
    const handleApplyPromoCode = () => {
        const result = applyPromoCode(promoCode, cartSubtotal);
        if (result.success && result.campaign) {
            setAppliedCampaign(result.campaign);
            setPromoCodeApplied(true);
            toast.success(result.message);
        } else {
            toast.error(result.message);
        }
    };

    // ── Checkout flow ─────────────────────────────────────────────────────────
    const handleOpenCheckout = () => {
        if (cart.length === 0) return;
        if (!shift) {
            toast('Abra o turno primeiro', { icon: '⚠️' });
            setShiftModalMode('open');
            setShowShiftModal(true);
            return;
        }
        setShowPaymentModal(true);
    };

    const handleConfirmPayment = async (payments: PaymentEntry[], isCredit: boolean, creditDueDays: number) => {
        setShowPaymentModal(false);
        setCheckoutLoading(true);
        try {
            const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
            const change = Math.max(0, totalPaid - cartTotal);
            const primaryMethod = isCredit ? 'credit' : payments[0]?.method || 'cash';

            // Build structured payment reference (JSON) for mixed/reference payments
            const paymentRefData = payments.map(p => ({
                method: p.method,
                amount: Number(p.amount),
                ...(p.reference ? { reference: p.reference } : {})
            }));

            // The backend validates that subtotal == sum(item.total).
            // item.total already includes per-item discounts, so we send the
            // discounted subtotal; global discounts (CRM/promo) go separately.
            const itemsSubtotal = cart.reduce((s, i) => s + i.total, 0);
            const globalDiscount = cartDiscount - itemDiscounts; // strip item-level discounts (already baked into item.total)

            const sale = await salesAPI.create({
                customerId: selectedCustomer?.id,
                items: cart.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discount: item.discountPct > 0 ? item.quantity * item.unitPrice * (item.discountPct / 100) : 0,
                    total: item.total
                })),
                subtotal: itemsSubtotal,
                discount: globalDiscount,
                tax: cartTax,
                total: cartTotal,
                sessionId: activeShift?.id,
                paymentMethod: primaryMethod,
                amountPaid: isCredit ? 0 : totalPaid,
                change: isCredit ? 0 : change,
                paymentRef: JSON.stringify(paymentRefData),
                notes: [
                    selectedCustomer ? `Cliente: ${selectedCustomer.name}` : customerName ? `Cliente: ${customerName}` : 'Consumidor Geral',
                    isCredit ? `CRÉDITO - Vence em ${creditDueDays} dias` : ''
                ].filter(Boolean).join(' | ')
            });

            // Refresh shift summary from DB (totals are computed server-side from sales)
            queryClient.invalidateQueries({ queryKey: ['commercial', 'shift'] });

            if (appliedCampaigns.length > 0) {
                recordCampaignUsages(selectedCustomer?.id || 'anonymous', selectedCustomer?.name || 'Avulso', cartTotal, appliedCampaigns);
            }

            // Build receipt
            const receipt: ReceiptData = {
                saleNumber: sale.receiptNumber,
                date: new Date(),
                customerName: selectedCustomer?.name || customerName || 'Consumidor Geral',
                customerPhone: selectedCustomer?.phone,
                items: cart.map(i => ({
                    name: i.product.name,
                    code: i.product.code,
                    quantity: i.quantity,
                    unitPrice: i.unitPrice,
                    discountPct: i.discountPct || 0,
                    total: i.total
                })),
                subtotal: cartSubtotal,
                discount: cartDiscount,
                tax: cartTax,
                total: cartTotal,
                payments,
                change,
                isCredit,
                creditDueDays: isCredit ? creditDueDays : undefined
            };
            setLastReceipt(receipt);
            setShowReceiptModal(true);

            // Reset cart
            setCart([]);
            setCustomerName('');
            setSelectedCustomer(null);
            setPromoCode('');
            setPromoCodeApplied(false);
            setAppliedCampaign(null);
            
            // Invalidate products to update stock quantities immediately
            queryClient.invalidateQueries({ queryKey: ['commercial', 'products'] });

            toast.success(`Venda ${sale.receiptNumber} registada!`);
        } catch (err: any) {
            toast.error(err.message || 'Erro ao realizar venda');
            setShowPaymentModal(true);
        } finally {
            setCheckoutLoading(false);
        }
    };

    // ── Held Sales ────────────────────────────────────────────────────────────
    const handleHoldSale = () => {
        if (cart.length === 0) return;
        const held: HeldSale = {
            id: Date.now().toString(),
            label: selectedCustomer?.name || customerName || `Venda ${heldSales.length + 1}`,
            cart: [...cart],
            customerName,
            selectedCustomer,
            createdAt: new Date()
        };
        setHeldSales(prev => [...prev, held]);
        setCart([]);
        setCustomerName('');
        setSelectedCustomer(null);
        setPromoCode('');
        setPromoCodeApplied(false);
        setAppliedCampaign(null);
        toast.success('Venda suspensa', { icon: '⏸️' });
    };

    const handleResumeSale = (held: HeldSale) => {
        if (cart.length > 0) {
            toast('Finalize ou suspenda a venda actual antes de retomar', { icon: '⚠️' });
            return;
        }
        setCart(held.cart);
        setCustomerName(held.customerName);
        setSelectedCustomer(held.selectedCustomer);
        setHeldSales(prev => prev.filter(h => h.id !== held.id));
        toast.success(`Venda "${held.label}" retomada`, { icon: '▶️' });
    };

    const handleDeleteHeld = (id: string) => {
        setHeldSales(prev => prev.filter(h => h.id !== id));
    };

    // ── Hardware ──────────────────────────────────────────────────────────────
    const handleToggleCashDrawer = () => {
        setCashDrawerOpen(v => !v);
        toast(cashDrawerOpen ? 'Gaveta fechada' : 'Gaveta aberta', { 
            icon: cashDrawerOpen ? <HiOutlineLockClosed className="w-5 h-5 text-gray-500" /> : <HiOutlineCash className="w-5 h-5 text-green-500" /> 
        });
    };

    // ── Shift ─────────────────────────────────────────────────────────────────
    const handleOpenShift = async (openingBalance: number, warehouseId?: string) => {
        try {
            await shiftAPI.open(openingBalance, warehouseId);
            queryClient.invalidateQueries({ queryKey: ['commercial', 'shift'] });
            setShowShiftModal(false);
            toast.success('Turno aberto!', { icon: '✅' });
        } catch (err: any) {
            toast.error(err.message || 'Erro ao abrir turno');
        }
    };

    const handleCloseShift = async (countedCash: number) => {
        try {
            const closed = await shiftAPI.close(countedCash);
            const diff = Number(closed.difference) || 0;
            const total = Number(closed.totalSales) || 0;
            toast.success(
                `Turno fechado. Total: ${total.toLocaleString()} MTn${diff !== 0 ? ` | Diferença: ${diff > 0 ? '+' : ''}${diff.toFixed(0)} MTn` : ''}`,
                { duration: 6000 }
            );
            queryClient.invalidateQueries({ queryKey: ['commercial', 'shift'] });
            setShowShiftModal(false);
        } catch (err: any) {
            toast.error(err.message || 'Erro ao fechar turno');
        }
    };

    const handleConfirmMovement = async (amount: number, reason: string) => {
        try {
            await shiftAPI.addMovement({ 
                amount, 
                type: movementType === 'cash_in' ? 'suprimento' : 'sangria', 
                reason 
            });
            queryClient.invalidateQueries({ queryKey: ['commercial', 'shift'] });
            setShowMovementModal(false);
            toast.success(movementType === 'cash_in' ? 'Entrada registada' : 'Sangria registada');
        } catch (err: any) {
            toast.error(err.message || 'Erro ao registar movimento');
        }
    };

    // ── Keyboard shortcuts ────────────────────────────────────────────────────
    const handleToggleShift = useCallback(() => {
        if (shift) {
            setShiftModalMode('close');
        } else {
            setShiftModalMode('open');
        }
        setShowShiftModal(true);
    }, [shift]);

    const handleReprintLast = useCallback(() => {
        if (lastReceipt) {
            setShowReceiptModal(true);
        } else {
            toast('Nenhum talão para reimprimir', { icon: '⚠️' });
        }
    }, [lastReceipt]);

    const shortcuts = useMemo(() => [
        { key: 'F1',     action: () => setShowShortcutsHUD(v => !v), description: 'Atalhos' },
        { key: 'F2',     action: () => searchInputRef.current?.focus(), description: 'Busca' },
        { key: 'F4',     action: handleOpenCheckout,   description: 'Pagar'         },
        { key: 'F5',     action: handleHoldSale,       description: 'Suspender'     },
        { key: 'F8',     action: handleToggleCashDrawer, description: 'Gaveta'      },
        { key: 'F9',     action: handleReprintLast,    description: 'Reimprimir'    },
        { key: 'F10',    action: handleToggleShift,    description: 'Turno'         },
        { key: 'Escape', action: () => { setCart([]); setPosSearch(''); setGlobalDiscountPct(0); }, description: 'Limpar' }
    ], [handleOpenCheckout, handleToggleCashDrawer, handleHoldSale, handleReprintLast, handleToggleShift]);

    useKeyboardShortcuts(shortcuts);

    const handleBarcodeSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && posSearch.trim()) {
            const found = products.find((p: any) =>
                p.barcode === posSearch.trim() || p.code.toLowerCase() === posSearch.trim().toLowerCase()
            );
            if (found) { addToCart(found); setPosSearch(''); }
            else if (filteredProducts.length === 1) { addToCart(filteredProducts[0]); setPosSearch(''); }
        }
    };

    useBarcodeScanner({
        onScan: (barcode) => {
            const found = products.find((p: any) => p.barcode === barcode || p.code.toLowerCase() === barcode.toLowerCase());
            if (found) { addToCart(found); toast.success(`${found.name} adicionado`); }
        },
        enabled: true
    });

    if (loadingProducts || loadingCustomers || loadingShift) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <LoadingSpinner size="xl" />
                <p className="mt-4 text-sm text-gray-400">A carregar ponto de venda...</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-white dark:bg-dark-900 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm relative overflow-hidden transition-all">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 rounded-full blur-3xl -mr-32 -mt-32" />
                <div className="relative z-10">
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-none mb-1">
                        PDV Comercial
                    </h1>
                    <div className="flex items-center gap-2">
                        {shift ? (
                            <Badge variant="success" size="sm" className="font-black px-1.5 py-0.5 uppercase tracking-widest bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                                Turno Activo
                            </Badge>
                        ) : (
                            <Badge variant="danger" size="sm" className="font-black px-1.5 py-0.5 uppercase tracking-widest">
                                Turno Fechado
                            </Badge>
                        )}
                        <p className="text-gray-400 dark:text-gray-500 font-bold text-[10px] uppercase tracking-wider">
                            {shift
                                ? `${shift.openedAt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} · ${shift.saleCount} vendas · ${shift.totalSales.toLocaleString()} MTn`
                                : 'Abra o turno para iniciar vendas'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 relative z-10">
                    {shift ? (
                        <button
                            onClick={() => { setShiftModalMode('close'); setShowShiftModal(true); }}
                            className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 dark:bg-dark-800 hover:bg-black dark:hover:bg-dark-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-black/10 hover:-translate-y-0.5 border border-white/5 active:scale-95"
                        >
                            <HiOutlineStop className="w-4 h-4 text-red-500" />
                            Encerrar Turno
                        </button>
                    ) : (
                        <button
                            onClick={() => { setShiftModalMode('open'); setShowShiftModal(true); }}
                            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-500/20 hover:-translate-y-0.5 active:scale-95"
                        >
                            <HiOutlinePlay className="w-4 h-4" />
                            Abrir Turno
                        </button>
                    )}
                </div>
            </div>

            {/* Layout 60/40 */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
                <div className="lg:col-span-3">
                    <CommercialProductGrid
                        searchInputRef={searchInputRef}
                        posSearch={posSearch}
                        setPosSearch={setPosSearch}
                        filteredProducts={filteredProducts}
                        allProducts={products}
                        posPagination={posPagination}
                        addToCart={addToCart}
                        handleBarcodeSearch={handleBarcodeSearch}
                    />
                </div>

                <div className="lg:col-span-2">
                    <CommercialCartPanel
                        cart={cart}
                        setCart={setCart}
                        updateQuantity={updateQuantity}
                        updateItemDiscount={updateItemDiscount}
                        removeFromCart={removeFromCart}
                        cartTotal={cartTotal}
                        cartSubtotal={cartSubtotal}
                        cartTax={cartTax}
                        cartDiscount={cartDiscount}
                        selectedCustomer={selectedCustomer}
                        setSelectedCustomer={setSelectedCustomer}
                        customerName={customerName}
                        setCustomerName={setCustomerName}
                        promoCode={promoCode}
                        setPromoCode={setPromoCode}
                        promoCodeApplied={promoCodeApplied}
                        handleApplyPromoCode={handleApplyPromoCode}
                        globalDiscountPct={globalDiscountPct}
                        onGlobalDiscountChange={setGlobalDiscountPct}
                        onCheckout={handleOpenCheckout}
                        checkoutLoading={checkoutLoading}
                        customers={customers}
                        cashDrawerOpen={cashDrawerOpen}
                        handleToggleCashDrawer={handleToggleCashDrawer}
                        cashDrawerBalance={cashDrawerBalance}
                        handleScaleAction={() => {
                            // Se há um item no carrinho, pré-selecciona o último para pesagem
                            const last = cart.at(-1);
                            setScaleProduct(last ? { name: last.product.name, unitPrice: last.unitPrice, unit: last.product.unit } : null);
                            setShowScaleModal(true);
                        }}
                        heldSales={heldSales}
                        onHoldSale={handleHoldSale}
                        onResumeSale={handleResumeSale}
                        onDeleteHeld={handleDeleteHeld}
                        onCashMovement={(type) => {
                            setMovementType(type);
                            setShowMovementModal(true);
                        }}
                    />
                </div>
            </div>

            {/* Modals */}
            <CommercialPaymentModal
                isOpen={showPaymentModal}
                onClose={() => setShowPaymentModal(false)}
                onConfirm={handleConfirmPayment}
                cartTotal={cartTotal}
                cartSubtotal={cartSubtotal}
                cartDiscount={cartDiscount}
                cartTax={cartTax}
                customerName={selectedCustomer?.name || customerName}
                selectedCustomer={selectedCustomer}
            />

            <CommercialShiftModal
                isOpen={showShiftModal}
                mode={shiftModalMode}
                shift={shift}
                onOpenShift={handleOpenShift}
                onCloseShift={handleCloseShift}
                onClose={() => setShowShiftModal(false)}
            />

            <CommercialReceiptModal
                isOpen={showReceiptModal}
                receipt={lastReceipt}
                onClose={() => setShowReceiptModal(false)}
            />

            <CommercialScaleModal
                isOpen={showScaleModal}
                onClose={() => setShowScaleModal(false)}
                product={scaleProduct}
                onConfirm={(weightG, qty) => {
                    // Se há produto pré-seleccionado, actualiza a quantidade do último item
                    const last = cart.at(-1);
                    if (last) {
                        updateQuantity(last.productId, qty);
                        toast.success(`${last.product.name}: ${(weightG / 1000).toFixed(3)} kg`);
                    }
                    setShowScaleModal(false);
                }}
            />

            <CommercialCashMovementModal
                isOpen={showMovementModal}
                type={movementType}
                onClose={() => setShowMovementModal(false)}
                onConfirm={handleConfirmMovement}
            />

            {/* Atalhos de teclado — overlay F1 */}
            <CommercialShortcutsHUD
                isOpen={showShortcutsHUD}
                onClose={() => setShowShortcutsHUD(false)}
            />

            {/* Badge flutuante de atalhos */}
            <ShortcutsHintBadge onClick={() => setShowShortcutsHUD(true)} />
        </div>
    );
}
