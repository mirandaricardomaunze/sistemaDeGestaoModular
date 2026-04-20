import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LoadingSpinner, Badge, Skeleton } from '../../components/ui';
import { productsAPI, customersAPI, salesAPI, shiftAPI, warehousesAPI } from '../../services/api';
import type { ShiftSession, ShiftSummary } from '../../services/api';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { useCompanySettings } from '../../hooks/useCompanySettings';
import { playScanSound } from '../../utils/audio';
import toast from 'react-hot-toast';
import {
    calculatePOSDiscounts,
    recordCampaignUsages,
    applyPromoCode
} from '../../utils/crmIntegration';
import { usePagination } from '../../components/ui/Pagination';
import { HiOutlinePlay, HiOutlineStop, HiOutlineLockClosed, HiOutlineBanknotes, HiOutlineBuildingOffice, HiOutlineCloud, HiOutlineCloudArrowUp } from 'react-icons/hi2';
import { useSyncManager } from '../../hooks/commercial/useSyncManager';
import { offlineDB } from '../../services/offline/offlineDB';
import { commercialAPI } from '../../services/api/commercial.api';

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


    // ── Shift Management (DB-backed) — MUST be first so warehouseId is known ──
    const queryClient = useQueryClient();
    const { data: activeShift, isLoading: loadingShift } = useQuery<ShiftSession | null>({
        queryKey: ['commercial', 'shift'],
        queryFn: () => shiftAPI.getCurrent(),
        refetchInterval: 60_000,
        retry: false,
    });

    const { isOnline, pendingCount, isSyncing } = useSyncManager(activeShift?.companyId);
    const { data: shiftSummary } = useQuery<ShiftSummary | null>({
        queryKey: ['commercial', 'shift', 'summary'],
        queryFn: () => shiftAPI.getSummary(),
        enabled: !!activeShift,
        refetchInterval: 30_000,
    });

    // Fetch warehouse list (for name display in header + shift modal)
    const { data: warehouses = [] } = useQuery({
        queryKey: ['warehouses'],
        queryFn: async () => {
            const data = await warehousesAPI.getAll();
            return Array.isArray(data) ? data : (data?.data || []);
        },
    });
    const activeWarehouse = useMemo(() =>
        (warehouses as any[]).find((w: any) => w.id === activeShift?.warehouseId),
        [warehouses, activeShift?.warehouseId]
    );

    // ── Multi-warehouse product loading ──────────────────────────────────────
    // Once the shift is loaded, we know which warehouse the POS is bound to.
    // Pass warehouseId so the backend overrides currentStock with per-warehouse qty.
    const shiftWarehouseId = activeShift?.warehouseId;

    const { data: products = [], isLoading: loadingProducts } = useQuery({
        queryKey: ['commercial', 'products', shiftWarehouseId ?? 'global'],
        queryFn: async () => {
            const data = await productsAPI.getAll({
                origin_module: 'commercial',
                limit: 999,
                ...(shiftWarehouseId ? { warehouseId: shiftWarehouseId } : {})
            });
            return Array.isArray(data) ? data : (data?.data || []);
        },
        enabled: !loadingShift && isOnline,
    });

    const { data: customers = [], isLoading: loadingCustomers } = useQuery({
        queryKey: ['commercial', 'customers'],
        queryFn: async () => {
            const data = await customersAPI.getAll();
            return Array.isArray(data) ? data : (data?.data || []);
        },
        enabled: isOnline
    });

    // Offline data fallbacks
    const [offlineProducts, setOfflineProducts] = useState<any[]>([]);
    const [offlineCustomers, setOfflineCustomers] = useState<any[]>([]);

    useEffect(() => {
        if (!isOnline) {
            offlineDB.products.toArray().then(setOfflineProducts);
            offlineDB.customers.toArray().then(setOfflineCustomers);
        }
    }, [isOnline]);

    const displayProducts = isOnline ? products : offlineProducts;
    const displayCustomers = isOnline ? customers : offlineCustomers;

    // Carregar price tiers de todos os produtos em batch (1 request)
    const productIds = useMemo(() => (products as any[]).map((p: any) => p.id), [products]);
    const { data: priceTiersMap = {} } = useQuery({
        queryKey: ['commercial', 'price-tiers', productIds],
        queryFn: () => productsAPI.getPriceTiersBatch(productIds),
        enabled: productIds.length > 0,
        staleTime: 5 * 60 * 1000,
    });

    /** Retorna o preço escalonado para uma quantidade, ou o preço base. */
    const resolvePrice = useCallback((productId: string, basePrice: number, qty: number): number => {
        const tiers = (priceTiersMap as Record<string, { minQty: number; price: number }[]>)[productId];
        if (!tiers || tiers.length === 0) return basePrice;
        const applicable = tiers.filter(t => qty >= t.minQty).sort((a, b) => b.minQty - a.minQty);
        return applicable.length > 0 ? applicable[0].price : basePrice;
    }, [priceTiersMap]);

    // ── Company Settings (IVA rate) ──────────────────────────────────────────
    const { settings: companySettings } = useCompanySettings();
    const ivaRate = companySettings?.ivaRate ?? 16;

    // ── POS State ────────────────────────────────────────────────────────────
    const [posSearch, setPosSearch] = useState('');
    const [cart, setCart] = useState<any[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
    const [customerName, setCustomerName] = useState('');
    const [promoCode, setPromoCode] = useState('');
    const [promoCodeApplied, setPromoCodeApplied] = useState(false);
    const [appliedCampaign, setAppliedCampaign] = useState<any>(null);

    // ── Hardware State ──────────────────────────────────────────────────────-
    const [cashDrawerOpen, setCashDrawerOpen] = useState(false);

    // ── Held Sales (Parking) - persisted to localStorage ────────────────────
    const [heldSales, setHeldSales] = useState<HeldSale[]>(() => {
        try {
            const stored = localStorage.getItem('pos_held_sales');
            return stored ? JSON.parse(stored) : [];
        } catch { return []; }
    });

    useEffect(() => {
        try { localStorage.setItem('pos_held_sales', JSON.stringify(heldSales)); } catch { /* quota exceeded */ }
    }, [heldSales]);


    const [showShiftModal, setShowShiftModal] = useState(false);
    const [shiftModalMode, setShiftModalMode] = useState<'open' | 'close'>('open');
    const [showScaleModal, setShowScaleModal] = useState(false);
    const [scaleProduct, setScaleProduct] = useState<{ name: string; unitPrice: number; unit?: string } | null>(null);

    // Build ShiftData shape for the modal from the DB session + summary
    const shift: ShiftData | null = useMemo(() => {
        if (!activeShift) return null;
        const s = shiftSummary;
        return {
            openedAt: new Date(activeShift.openedAt), // openedAt is ISO string from API
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
        return shift.openingBalance + shift.cashSales + (shift.deposits || 0) - (shift.withdrawals || 0);
    }, [shift]);

    // ── Modals ──────────────────────────────────────────────────────────────-
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [lastReceipt, setLastReceipt] = useState<ReceiptData | null>(null);
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [showMovementModal, setShowMovementModal] = useState(false);
    const [movementType, setMovementType] = useState<'cash_in' | 'cash_out'>('cash_in');
    const [showShortcutsHUD, setShowShortcutsHUD] = useState(false);

    // ── Global discount (desconto global sobre o total, com controlo de permissão) -
    const [globalDiscountPct, setGlobalDiscountPct] = useState(0);

    // ── Filtering & Pagination ──────────────────────────────────────────────-
    const filteredProducts = useMemo(() => {
        const available = displayProducts.filter((p: any) => {
            // When bound to a warehouse, prefer per-warehouse stock; fall back to
            // global currentStock so products without a warehouse entry stay visible.
            const stock = shiftWarehouseId
                ? (p.warehouseStocks?.find((ws: any) => ws.warehouseId === shiftWarehouseId)?.quantity ?? p.currentStock)
                : p.currentStock;
            return Number(stock) > 0;
        });
        if (!posSearch) return available;
        const q = posSearch.toLowerCase();
        return available.filter((p: any) =>
            p.name.toLowerCase().includes(q) ||
            p.code.toLowerCase().includes(q) ||
            (p.barcode && p.barcode.toLowerCase().includes(q))
        );
    }, [displayProducts, posSearch, shiftWarehouseId]);

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

    // ── Cart Logic ──────────────────────────────────────────────────────────-
    const addToCart = useCallback(async (product: any, qty = 1) => {
        let reservation: any = null;
        if (isOnline) {
            try {
                reservation = await commercialAPI.reserveItem(product.id, qty, activeShift?.id);
            } catch {
                // Reservation is best-effort — stock is validated again at checkout.
                // A failed reservation must NOT prevent the product from being added.
            }
        }

        setCart(prev => {
            const existing = prev.find(item => item.productId === product.id);
            if (existing) {
                const newQty = existing.quantity + qty;
                if (newQty > product.currentStock) { 
                    toast.error('Stock insuficiente'); 
                    if (reservation) commercialAPI.releaseItem(reservation.id);
                    return prev; 
                }
                const tieredPrice = resolvePrice(product.id, Number(product.price), newQty);
                const hasTier = tieredPrice !== existing.unitPrice;
                if (hasTier) toast(`Preço escalonado aplicado: ${tieredPrice.toLocaleString()} MTn/un`, { icon: '' });
                return prev.map(item =>
                    item.productId === product.id
                        ? { 
                            ...item, 
                            quantity: newQty, 
                            unitPrice: tieredPrice, 
                            total: newQty * tieredPrice * (1 - (item.discountPct || 0) / 100),
                            reservations: [...(item.reservations || []), reservation].filter(Boolean)
                          }
                        : item
                );
            }
            if (qty > product.currentStock) { 
                toast.error('Stock insuficiente'); 
                if (reservation) commercialAPI.releaseItem(reservation.id);
                return prev; 
            }
            const unitPrice = resolvePrice(product.id, Number(product.price), qty);
            return [...prev, {
                productId: product.id,
                product,
                quantity: qty,
                unitPrice,
                discountPct: 0,
                total: qty * unitPrice,
                reservations: reservation ? [reservation] : []
            }];
        });
        playScanSound();
    }, [resolvePrice, isOnline, activeShift?.id]);

    const updateQuantity = useCallback(async (productId: string, qty: number) => {
        const item = cart.find(i => i.productId === productId);
        if (!item) return;

        if (qty <= 0) { 
            if (isOnline && item.reservations) {
                item.reservations.forEach((r: any) => commercialAPI.releaseItem(r.id));
            }
            setCart(c => c.filter(i => i.productId !== productId)); 
            return; 
        }

        if (qty > item.product.currentStock) { toast.error('Stock insuficiente'); return; }

        let newReservation: any = null;
        if (isOnline && qty > item.quantity) {
            try {
                newReservation = await commercialAPI.reserveItem(productId, qty - item.quantity, activeShift?.id);
            } catch (err: any) {
                toast.error('Erro ao ajustar reserva de stock');
                return;
            }
        } else if (isOnline && qty < item.quantity) {
             // Logic to release partial reservation can be complex; simplified to just keeping track
             // In a real scenario, we'd release the difference
        }

        setCart(c => c.map(item => {
            if (item.productId !== productId) return item;
            const tieredPrice = resolvePrice(productId, item.product.price, qty);
            const total = qty * tieredPrice * (1 - (item.discountPct || 0) / 100);
            return { 
                ...item, 
                quantity: qty, 
                unitPrice: tieredPrice, 
                total,
                reservations: newReservation ? [...(item.reservations || []), newReservation] : item.reservations
            };
        }));
    }, [resolvePrice, cart, isOnline, activeShift?.id]);

    const updateItemDiscount = useCallback((productId: string, discountPct: number) => {
        setCart(c => c.map(item => {
            if (item.productId !== productId) return item;
            const validDiscount = Math.min(Math.max(discountPct || 0, 0), 100);
            const total = item.quantity * item.unitPrice * (1 - validDiscount / 100);
            return {
                ...item,
                discountPct: validDiscount,
                total
            };
        }));
    }, []);

    const removeFromCart = (productId: string) => {
        const item = cart.find(i => i.productId === productId);
        if (isOnline && item?.reservations) {
            item.reservations.forEach((r: any) => commercialAPI.releaseItem(r.id));
        }
        setCart(c => c.filter(i => i.productId !== productId));
    };

    // ── Calculations ────────────────────────────────────────────────────────-
    const cartSubtotal = useMemo(() => cart.reduce((s, i) => s + i.quantity * i.unitPrice, 0), [cart]);
    const itemDiscounts = useMemo(() => cart.reduce((s, i) => s + i.quantity * i.unitPrice * ((i.discountPct || 0) / 100), 0), [cart]);

    const { totalDiscount: crmDiscount, appliedCampaigns } = useMemo(() =>
        calculatePOSDiscounts(selectedCustomer?.id || null, cartSubtotal, customers),
        [selectedCustomer, cartSubtotal, customers]
    );

    const manualDiscount = appliedCampaign?.calculatedDiscount || 0;
    const globalDiscountAmt = cartSubtotal * (globalDiscountPct / 100);
    const cartDiscount = crmDiscount + manualDiscount + itemDiscounts + globalDiscountAmt;
    const cartTax = (cartSubtotal - cartDiscount) * (ivaRate / 100);
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

    // ── Checkout flow ────────────────────────────────────────────────────────-
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

            const saleData = {
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
                warehouseId: activeShift?.warehouseId || undefined,
                originModule: 'commercial',
                notes: [
                    selectedCustomer ? `Cliente: ${selectedCustomer.name}` : customerName ? `Cliente: ${customerName}` : 'Consumidor Geral',
                    isCredit ? `CRÉDITO - Vence em ${creditDueDays} dias` : ''
                ].filter(Boolean).join(' | ')
            };

            let saleResponse: any;
            if (isOnline) {
                saleResponse = await salesAPI.create(saleData);
            } else {
                await offlineDB.syncQueue.add({
                    type: 'SALE',
                    data: saleData,
                    timestamp: Date.now(),
                    status: 'pending',
                    attempts: 0
                });
                
                // Deduct stock locally immediately to prevent offline overselling
                for (const item of cart) {
                    const productToUpdate = await offlineDB.products.get(item.productId);
                    if (productToUpdate) {
                        await offlineDB.products.update(item.productId, {
                            currentStock: Math.max(0, productToUpdate.currentStock - item.quantity)
                        });
                    }
                }
                
                // Immediately synchronize the UI list with the DB reflection
                offlineDB.products.toArray().then(setOfflineProducts);

                saleResponse = { receiptNumber: `OFF-${Date.now().toString().slice(-6)}` };
            }

            // Refresh shift summary from DB (totals are computed server-side from sales)
            if (isOnline) {
                queryClient.invalidateQueries({ queryKey: ['commercial', 'shift'] });
            }

            if (isOnline && appliedCampaigns.length > 0) {
                recordCampaignUsages(selectedCustomer?.id || 'anonymous', selectedCustomer?.name || 'Avulso', cartTotal, appliedCampaigns);
            }

            // Build receipt
            const receipt: ReceiptData = {
                saleNumber: saleResponse.receiptNumber,
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
            if (isOnline) {
                queryClient.invalidateQueries({ queryKey: ['commercial', 'products'] });
            }

            toast.success(isOnline ? `Venda ${saleResponse.receiptNumber} registada!` : `Venda offline gravada! Sincronização pendente.`);
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
        toast.success('Venda suspensa', { icon: '️' });
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
            icon: cashDrawerOpen ? <HiOutlineLockClosed className="w-5 h-5 text-gray-500" /> : <HiOutlineBanknotes className="w-5 h-5 text-green-500" /> 
        });
    };

    // ── Shift ────────────────────────────────────────────────────────────────-
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
            <div className="space-y-6 max-w-full">
                {/* Header Skeleton */}
                <div className="h-24 bg-white dark:bg-dark-900 rounded-lg p-4 flex gap-4 animate-pulse">
                    <Skeleton className="w-64 h-full" />
                    <Skeleton className="flex-1 h-full" />
                    <Skeleton className="w-32 h-full" />
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-3 space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="bg-white dark:bg-dark-800 h-48 rounded-xl p-2 flex flex-col gap-2">
                                    <Skeleton className="flex-1 w-full rounded-md" />
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-6 w-1/2" />
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white dark:bg-dark-800 h-[600px] rounded-xl flex flex-col p-4 space-y-4">
                            <Skeleton className="h-10 w-full" />
                            <div className="flex-1 space-y-2">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="flex gap-2">
                                        <Skeleton className="h-12 w-12 rounded-lg" />
                                        <div className="flex-1 space-y-1">
                                            <Skeleton className="h-4 w-3/4" />
                                            <Skeleton className="h-3 w-1/4" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-12 w-full rounded-xl" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-white dark:bg-dark-900 rounded-lg border border-gray-100 dark:border-dark-700 shadow-sm relative overflow-hidden transition-all">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 rounded-full blur-3xl -mr-32 -mt-32" />
                <div className="relative z-10">
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-none mb-1">
                        PDV Comercial
                    </h1>
                    <div className="flex items-center gap-2 flex-wrap">
                        {isOnline ? (
                            <Badge variant="success" size="sm" className="font-black px-1.5 py-0.5 uppercase tracking-widest bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 flex items-center gap-1">
                                <HiOutlineCloud className="w-3 h-3" />
                                Online
                            </Badge>
                        ) : (
                            <Badge variant="danger" size="sm" className="font-black px-1.5 py-0.5 uppercase tracking-widest flex items-center gap-1">
                                <HiOutlineCloudArrowUp className="w-3 h-3" />
                                Modo Offline
                            </Badge>
                        )}

                        {pendingCount > 0 && (
                            <Badge variant="warning" size="sm" className="font-black px-1.5 py-0.5 uppercase tracking-widest animate-pulse">
                                {pendingCount} Pendentes
                            </Badge>
                        )}

                        {shift ? (
                            <Badge variant="success" size="sm" className="font-black px-1.5 py-0.5 uppercase tracking-widest bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                                Turno Activo
                            </Badge>
                        ) : (
                            <Badge variant="danger" size="sm" className="font-black px-1.5 py-0.5 uppercase tracking-widest">
                                Turno Fechado
                            </Badge>
                        )}
                        {/* Warehouse indicator — shows which warehouse stock is being sold from */}
                        {activeWarehouse && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
                                <HiOutlineBuildingOffice className="w-3 h-3" />
                                {activeWarehouse.name}
                            </span>
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
                            className="flex items-center gap-2 px-6 py-2.5 bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-700 text-slate-900 dark:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm hover:-translate-y-0.5 border border-slate-200 dark:border-white/5 active:scale-95"
                        >
                            <HiOutlineStop className="w-4 h-4 text-red-500" />
                            Encerrar Turno
                        </button>
                    ) : (
                        <button
                            onClick={() => { setShiftModalMode('open'); setShowShiftModal(true); }}
                            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20 hover:-translate-y-0.5 active:scale-95"
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
                        allProducts={displayProducts}
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
                        customers={displayCustomers}
                        cashDrawerOpen={cashDrawerOpen}
                        handleToggleCashDrawer={handleToggleCashDrawer}
                        cashDrawerBalance={cashDrawerBalance}
                        handleScaleAction={() => {
                            // Se h um item no carrinho, pré-selecciona o último para pesagem
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
                    // Se h produto pré-seleccionado, actualiza a quantidade do último item
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

            {/* Atalhos de teclado - overlay F1 */}
            <CommercialShortcutsHUD
                isOpen={showShortcutsHUD}
                onClose={() => setShowShortcutsHUD(false)}
            />

            {/* Badge flutuante de atalhos */}
            <ShortcutsHintBadge onClick={() => setShowShortcutsHUD(true)} />
        </div>
    );
}
