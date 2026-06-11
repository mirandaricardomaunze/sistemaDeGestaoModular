import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../../utils/helpers';
import { toCents, toMoney, applyPercent } from '../../utils/money';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, LoadingOverlay, ConfirmationModal, Modal, usePagination } from '../../components/ui';
import { productsAPI, customersAPI, salesAPI, shiftAPI, warehousesAPI } from '../../services/api';
import type { ShiftSession, ShiftSummary } from '../../services/api';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { useCompanySettings } from '../../hooks/useCompanySettings';
import { playScanSound } from '../../utils/audio';
import { getApiErrorMessage } from '../../utils/apiError';
import { isDecimalUnit } from '../../constants/unitOfMeasure';
import toast from 'react-hot-toast';
import type { Customer } from '../../types';

// ── Internal types ──────────────────────────────────────────────────────────
interface POSProduct {
    id: string;
    code: string;
    name: string;
    price: number | string;
    currentStock: number;
    packSize?: number | string;
    barcode?: string;
    sku?: string;
    unit?: string;
    category?: string;
    categoryId?: string;
    warehouseStocks?: Array<{ warehouseId: string; quantity: number }>;
}

type POSCustomer = Customer;

interface POSWarehouse {
    id: string;
    name: string;
}

type ListApiResponse<T> = T[] | {
    data?: T[];
};

const getListRows = <T,>(response: ListApiResponse<T>): T[] => (
    Array.isArray(response) ? response : response.data ?? []
);

interface CartReservation { id: string }

interface CartItem {
    productId: string;
    product: POSProduct;
    packSize: number;
    unitMode: 'box' | 'unit';
    quantity: number;
    unitPrice: number;
    discountPct: number;
    discount: DiscountInfo | null;
    total: number;
    reservations?: CartReservation[];
}

interface PriceTier { minQty: number; price: number }

interface DiscountAuditPayload {
    global: {
        kind: DiscountInfo['kind'];
        value: number;
        amount: number;
        reason?: string;
        appliedBy?: string;
    } | null;
    lines: Array<{
        productId: string;
        productName?: string;
        kind: DiscountInfo['kind'];
        value: number;
        amount: number;
        pct: number;
        reason?: string;
        appliedBy?: string;
    }>;
}

interface ValidationDetail {
    label?: string;
    field?: string;
    message?: string;
}

type PosApiError = Error & {
    response?: {
        data?: {
            errors?: ValidationDetail[];
        };
    };
};

interface SaleCreateResponse {
    receiptNumber?: string;
}
import {
    calculatePOSDiscounts,
    recordCampaignUsages
} from '../../utils/crmIntegration';
import { HiOutlinePlay, HiOutlineStop, HiOutlineLockClosed, HiOutlineBanknotes, HiOutlineCloudArrowUp } from 'react-icons/hi2';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { enqueueSale, OfflineQueueFullError } from '../../services/offline/offlineQueue';
import { getCachedProducts, getCachedCustomers } from '../../services/offline/catalogPrefetch';
import { commercialAPI } from '../../services/api/commercial.api';

// Components
import { CommercialProductGrid } from '../../components/commercial/pos/CommercialProductGrid';
import { CommercialCartPanel } from '../../components/commercial/pos/CommercialCartPanel';
import type { HeldSale } from '../../components/commercial/pos/CommercialCartPanel';
import { CommercialPaymentModal } from '../../components/commercial/pos/CommercialPaymentModal';
import type { PaymentEntry } from '../../components/commercial/pos/CommercialPaymentModal';
import { CommercialShiftModal } from '../../components/commercial/pos/CommercialShiftModal';
import type { ShiftData } from '../../components/commercial/pos/CommercialShiftModal';
import { ShiftReminder } from '../../components/pos/ShiftReminder';
import { CommercialReceiptModal } from '../../components/commercial/pos/CommercialReceiptModal';
import type { ReceiptData } from '../../components/commercial/pos/CommercialReceiptModal';
import { CommercialScaleModal } from '../../components/commercial/pos/CommercialScaleModal';
import { CommercialCashMovementModal } from '../../components/commercial/pos/CommercialCashMovementModal';
import { CommercialShortcutsHUD, ShortcutsHintBadge } from '../../components/commercial/pos/CommercialShortcutsHUD';
import { CommercialDiscountModal } from '../../components/commercial/pos/CommercialDiscountModal';
import type { DiscountInfo } from '../../components/commercial/pos/CommercialDiscountModal';

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

    const { isOnline, pendingCount } = useOfflineSync();
    const { data: shiftSummary } = useQuery<ShiftSummary | null>({
        queryKey: ['commercial', 'shift', 'summary'],
        queryFn: () => shiftAPI.getSummary(),
        enabled: !!activeShift,
        refetchInterval: 30_000,
    });

    // Fetch warehouse list (for name display in header + shift modal)
    const { data: warehouses = [] } = useQuery<POSWarehouse[]>({
        queryKey: ['warehouses'],
        queryFn: async () => {
            const data = await warehousesAPI.getAll() as ListApiResponse<POSWarehouse>;
            return getListRows(data);
        },
    });
    const activeWarehouse = useMemo(() =>
        warehouses.find((w) => w.id === activeShift?.warehouseId),
        [warehouses, activeShift?.warehouseId]
    );

    // ── Multi-warehouse product loading ──────────────────────────────────────
    // Once the shift is loaded, we know which warehouse the POS is bound to.
    // Pass warehouseId so the backend overrides currentStock with per-warehouse qty.
    const shiftWarehouseId = activeShift?.warehouseId;

    const { data: products = [], isLoading: loadingProducts } = useQuery<POSProduct[]>({
        queryKey: ['commercial', 'products', shiftWarehouseId ?? 'global'],
        queryFn: async () => {
            const data = await productsAPI.getAll({
                originModule: 'commercial',
                limit: 2000, // cap do backend; catálogos maiores exigem server-side search
                ...(shiftWarehouseId ? { warehouseId: shiftWarehouseId } : {})
            }) as ListApiResponse<POSProduct>;
            return getListRows(data);
        },
        enabled: !loadingShift && isOnline,
    });

    const { data: customers = [] } = useQuery<POSCustomer[]>({
        queryKey: ['commercial', 'customers'],
        queryFn: async () => {
            const data = await customersAPI.getAll({ limit: 2000 }) as ListApiResponse<POSCustomer>;
            return getListRows(data);
        },
        enabled: isOnline
    });

    // Offline data fallbacks
    const [offlineProducts, setOfflineProducts] = useState<POSProduct[]>([]);
    const [offlineCustomers, setOfflineCustomers] = useState<POSCustomer[]>([]);

    useEffect(() => {
        if (!isOnline) {
            getCachedProducts().then(rows => setOfflineProducts(rows as unknown as POSProduct[]));
            getCachedCustomers().then(rows => setOfflineCustomers(rows as POSCustomer[]));
        }
    }, [isOnline]);

    const displayProducts: POSProduct[] = isOnline ? products : offlineProducts;
    const displayCustomers: POSCustomer[] = isOnline ? customers : offlineCustomers;

    // Carregar price tiers de todos os produtos em batch (1 request)
    const productIds = useMemo(() => products.map(p => p.id), [products]);
    const { data: priceTiersMap = {} } = useQuery<Record<string, PriceTier[]>>({
        queryKey: ['commercial', 'price-tiers', productIds],
        queryFn: () => productsAPI.getPriceTiersBatch(productIds),
        enabled: productIds.length > 0,
        staleTime: 5 * 60 * 1000,
    });

    /** Retorna o preço escalonado para uma quantidade, ou o preço base. */
    const resolvePrice = useCallback((productId: string, basePrice: number, qty: number): number => {
        const tiers = priceTiersMap[productId];
        if (!tiers || tiers.length === 0) return basePrice;
        const applicable = tiers.filter(t => qty >= t.minQty).sort((a, b) => b.minQty - a.minQty);
        return applicable.length > 0 ? applicable[0].price : basePrice;
    }, [priceTiersMap]);

    // ── Company Settings (IVA rate) ──────────────────────────────────────────
    const { settings: companySettings } = useCompanySettings();
    const ivaRate = companySettings?.ivaRate ?? 16;

    // ── POS State ────────────────────────────────────────────────────────────
    const [posSearch, setPosSearch] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<POSCustomer | null>(null);
    const [customerName, setCustomerName] = useState('');

    // Mobile view toggle: catalog vs cart (< lg only)
    const [mobileView, setMobileView] = useState<'catalog' | 'cart'>('catalog');


    // Track processing state for each action (e.g., product addition, qty change)
    const [processingActions, setProcessingActions] = useState<Record<string, boolean>>({});

    const setActionLoading = (id: string, isLoading: boolean) => {
        setProcessingActions(prev => ({ ...prev, [id]: isLoading }));
    };

    // ── Hardware State ──────────────────────────────────────────────────────-
    const [cashDrawerOpen, setCashDrawerOpen] = useState(false);

    // ── Held Sales (Parking) - persisted to localStorage ────────────────────
    const [heldSales, setHeldSales] = useState<HeldSale[]>(() => {
        try {
            const stored = localStorage.getItem('pos_held_sales');
            return stored ? JSON.parse(stored) : [];
        } catch { return []; }
    });

    const heldSalesQuotaWarned = useRef(false);
    useEffect(() => {
        try {
            localStorage.setItem('pos_held_sales', JSON.stringify(heldSales));
            heldSalesQuotaWarned.current = false;
        } catch (err) {
            // QuotaExceededError → show once, don't spam on each re-render
            if (!heldSalesQuotaWarned.current) {
                heldSalesQuotaWarned.current = true;
                const isQuota = err instanceof DOMException && err.name === 'QuotaExceededError';
                toast.error(
                    isQuota
                        ? 'Espaço local cheio: vendas suspensas não puderam ser persistidas. Finalize ou descarte algumas.'
                        : 'Falha ao gravar vendas suspensas no armazenamento local.',
                    { duration: 6000 }
                );
            }
        }
    }, [heldSales]);


    const [showShiftModal, setShowShiftModal] = useState(false);
    const [shiftModalMode, setShiftModalMode] = useState<'open' | 'close'>('open');
    const [showScaleModal, setShowScaleModal] = useState(false);
    const [scaleProduct, setScaleProduct] = useState<{ name: string; unitPrice: number; unit?: string } | null>(null);
    // ID do produto-alvo da balança — desacopla a operação do "último item do
    // carrinho" para evitar pesar o produto errado quando há mais do que um
    // item pesável ou um item não-pesável foi adicionado depois.
    const [scaleTargetProductId, setScaleTargetProductId] = useState<string | null>(null);
    // Picker aberto quando há mais de um item pesável e o cashier precisa de
    // escolher qual quer pesar (em vez de assumir "o último adicionado").
    const [scalePickerOpen, setScalePickerOpen] = useState(false);

    // Build ShiftData shape for the modal from the DB session + summary
    const shift: ShiftData | null = useMemo(() => {
        if (!activeShift) return null;
        const s = shiftSummary;
        return {
            openedAt: new Date(activeShift.openedAt), // openedAt is ISO string from API
            openingBalance: Number(activeShift.openingBalance),
            cashSales: s?.byPaymentMethod?.cash ?? Number(activeShift.cashSales),
            mpesaSales: s?.byPaymentMethod?.mpesa ?? Number(activeShift.mpesaSales),
            emolaSales: s?.byPaymentMethod?.emola ?? Number(activeShift.emolaSales),
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
    const [shiftLoading, setShiftLoading] = useState(false);
    const [movementLoading, setMovementLoading] = useState(false);
    const [showMovementModal, setShowMovementModal] = useState(false);
    const [movementType, setMovementType] = useState<'cash_in' | 'cash_out'>('cash_in');
    const [showShortcutsHUD, setShowShortcutsHUD] = useState(false);

    // ── Discount state ──────────────────────────────────────────────────────
    const [globalDiscount, setGlobalDiscount] = useState<DiscountInfo | null>(null);
    const [discountModal, setDiscountModal] = useState<
        | { scope: 'line'; productId: string }
        | { scope: 'global' }
        | null
    >(null);



    // ── Filtering & Pagination ──────────────────────────────────────────────-
    const filteredProducts = useMemo(() => {
        const available = displayProducts.filter((p) => {
            // When bound to a warehouse, prefer per-warehouse stock; fall back to
            // global currentStock so products without a warehouse entry stay visible.
            const stock = shiftWarehouseId
                ? (p.warehouseStocks?.find((ws) => ws.warehouseId === shiftWarehouseId)?.quantity ?? p.currentStock)
                : p.currentStock;
            return Number(stock) > 0;
        });
        if (!posSearch) return available;
        const q = posSearch.toLowerCase();
        return available.filter((p) =>
            p.name.toLowerCase().includes(q) ||
            p.code.toLowerCase().includes(q) ||
            (p.barcode && p.barcode.toLowerCase().includes(q))
        );
    }, [displayProducts, posSearch, shiftWarehouseId]);

    const posPagination = usePagination(filteredProducts, 12);

    // ── Pre-fill from Quote ──────────────────────────────────────────────────
    useEffect(() => {
        const state = location.state as { fromQuote?: { items?: Array<{ productId: string; productName: string; price: number; quantity: number }>; customerId?: string; customerName: string; orderNumber: string } } | null;
        if (state?.fromQuote && products.length > 0) {
            const quote = state.fromQuote;

            // Map items — cotações vêm com preço/quantidade em UNIDADES, então fixamos unitMode='unit'.
            const newCart: CartItem[] = (quote.items || []).map(item => {
                const product = (products as POSProduct[]).find(p => p.id === item.productId);
                const packSize = Number(product?.packSize) || 1;
                const unitPrice = toMoney(toCents(item.price));
                const total = toMoney(Math.round(toCents(unitPrice) * item.quantity));
                return {
                    productId: item.productId,
                    product: product || { id: item.productId, code: '', name: item.productName, price: item.price, currentStock: 999 },
                    packSize,
                    unitMode: 'unit',
                    quantity: item.quantity,
                    unitPrice,
                    discountPct: 0,
                    discount: null,
                    total,
                    reservations: [],
                };
            });

            setCart(newCart);

            // Set customer
            if (quote.customerId) {
                const foundCustomer = (customers as POSCustomer[]).find(c => c.id === quote.customerId);
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
    // product.price = preço de venda DA CAIXA. unidade = price / packSize.
    // O carrinho permite alternar entre 'box' (caixa) e 'unit' (unidade) por linha.
    // Stock está sempre em unidades — convertemos qty × packSize quando o modo é 'box'.
    const priceForMode = useCallback((product: POSProduct, mode: 'box' | 'unit', qty: number) => {
        const boxPrice = Number(product.price) || 0;
        const packSize = Number(product.packSize) || 1;
        if (mode === 'box') {
            return resolvePrice(product.id, boxPrice, qty);
        }
        const unitBase = boxPrice / packSize;
        return resolvePrice(product.id, unitBase, qty);
    }, [resolvePrice]);

    /** Compute line total with line-discount applied, using cents to avoid float drift. */
    const lineTotal = useCallback((quantity: number, unitPrice: number, discountPct: number): number => {
        const gross = Math.round(toCents(unitPrice) * quantity);
        const net = gross - applyPercent(gross, discountPct || 0);
        return toMoney(Math.max(0, net));
    }, []);

    const addToCart = useCallback(async (product: POSProduct, qty = 1) => {
        const packSize = Number(product.packSize) || 1;
        const defaultMode: 'box' | 'unit' = 'unit';

        // Determine factor based on existing item's mode (or default for new items)
        const existing = cart.find(item => item.productId === product.id);
        const effectiveMode = existing?.unitMode || defaultMode;
        const factor = effectiveMode === 'box' ? (existing?.packSize || packSize) : 1;
        const unitsNeeded = qty * factor;
        const totalUnitsAfterAdd = ((existing?.quantity || 0) + qty) * factor;

        if (totalUnitsAfterAdd > product.currentStock) {
            toast.error('Stock insuficiente');
            return;
        }

        const newQty = (existing?.quantity || 0) + qty;
        const tieredPrice = priceForMode(product, effectiveMode, newQty);

        if (existing && tieredPrice !== existing.unitPrice) {
            toast(`Preço escalonado: ${tieredPrice.toLocaleString()} MTn/${effectiveMode === 'box' ? 'cx' : 'un'}`);
        }

        setCart(prev => {
            const idx = prev.findIndex(i => i.productId === product.id);
            if (idx >= 0) {
                return prev.map(item =>
                    item.productId === product.id
                        ? {
                            ...item,
                            quantity: newQty,
                            unitPrice: tieredPrice,
                            total: lineTotal(newQty, tieredPrice, item.discountPct || 0),
                          }
                        : item
                );
            }
            return [...prev, {
                productId: product.id,
                product,
                packSize,
                unitMode: defaultMode,
                quantity: qty,
                unitPrice: tieredPrice,
                discountPct: 0,
                discount: null,
                total: lineTotal(qty, tieredPrice, 0),
                reservations: []
            }];
        });
        playScanSound();

        if (!isOnline) return;
        setActionLoading(product.id, true);
        try {
            const reservation = await commercialAPI.reserveItem(product.id, unitsNeeded, activeShift?.id);
            if (reservation) {
                setCart(prev => prev.map(item =>
                    item.productId === product.id
                        ? { ...item, reservations: [...(item.reservations || []), reservation as CartReservation] }
                        : item
                ));
            }
        } catch {
            // Reservation is best-effort — stock is validated again at checkout.
        } finally {
            setActionLoading(product.id, false);
        }
    }, [priceForMode, lineTotal, isOnline, activeShift?.id, cart]);

    const updateQuantity = useCallback(async (productId: string, qty: number) => {
        const item = cart.find(i => i.productId === productId);
        if (!item) return;

        setActionLoading(productId, true);
        try {
            if (qty <= 0) {
                if (isOnline && item.reservations) {
                    for (const r of (item.reservations || [])) {
                        await commercialAPI.releaseItem(r.id);
                    }
                }
                setCart(c => c.filter(i => i.productId !== productId));
                return;
            }

            const factor = item.unitMode === 'box' ? (item.packSize || 1) : 1;
            const unitsNeeded = qty * factor;
            if (unitsNeeded > item.product.currentStock) { toast.error('Stock insuficiente'); return; }

            let newReservation: CartReservation | null = null;
            let replaceReservations = false;
            if (isOnline && qty > item.quantity) {
                try {
                    newReservation = await commercialAPI.reserveItem(productId, (qty - item.quantity) * factor, activeShift?.id) as CartReservation;
                } catch {
                    toast.error('Erro ao ajustar reserva de stock');
                    return;
                }
            } else if (isOnline && qty < item.quantity) {
                // Release all existing reservations and re-reserve the new lower quantity
                try {
                    for (const r of (item.reservations || [])) {
                        await commercialAPI.releaseItem(r.id);
                    }
                    replaceReservations = true;
                    if (qty > 0) {
                        newReservation = await commercialAPI.reserveItem(productId, qty * factor, activeShift?.id) as CartReservation;
                    }
                } catch {
                    // Non-blocking: continue with cart update even if release fails
                }
            }

            setCart(c => c.map(it => {
                if (it.productId !== productId) return it;
                const tieredPrice = priceForMode(it.product, it.unitMode, qty);
                const total = lineTotal(qty, tieredPrice, it.discountPct || 0);
                const updatedReservations = replaceReservations
                    ? (newReservation ? [newReservation] : [])
                    : (newReservation ? [...(it.reservations || []), newReservation] : it.reservations);
                return {
                    ...it,
                    quantity: qty,
                    unitPrice: tieredPrice,
                    total,
                    reservations: updatedReservations
                };
            }));
        } finally {
            setActionLoading(productId, false);
        }
    }, [priceForMode, lineTotal, cart, isOnline, activeShift?.id]);



    const removeFromCart = async (productId: string) => {
        const item = cart.find(i => i.productId === productId);
        setActionLoading(productId, true);
        try {
            if (isOnline && item?.reservations) {
                for (const r of (item.reservations || [])) {
                    await commercialAPI.releaseItem(r.id);
                }
            }
            setCart(c => c.filter(i => i.productId !== productId));
        } finally {
            setActionLoading(productId, false);
        }
    };

    // ── Calculations (cents-based to avoid float drift) ─────────────────────
    const cartSubtotalCents = useMemo(
        () => cart.reduce((s, i) => s + Math.round(toCents(i.unitPrice) * i.quantity), 0),
        [cart]
    );
    const itemDiscountsCents = useMemo(
        () => cart.reduce((s, i) => {
            const lineCents = Math.round(toCents(i.unitPrice) * i.quantity);
            return s + applyPercent(lineCents, i.discountPct || 0);
        }, 0),
        [cart]
    );

    const cartSubtotal = toMoney(cartSubtotalCents);
    const itemDiscounts = toMoney(itemDiscountsCents);

    const { totalDiscount: crmDiscount, appliedCampaigns } = useMemo(() =>
        calculatePOSDiscounts(selectedCustomer?.id || null, cartSubtotal, customers),
        [selectedCustomer, cartSubtotal, customers]
    );
    const crmDiscountCents = toCents(crmDiscount);

    // Subtotal já com descontos de linha aplicados — base para desconto global
    const subtotalAfterLineCents = Math.max(0, cartSubtotalCents - itemDiscountsCents);
    const subtotalAfterLine = toMoney(subtotalAfterLineCents);

    const globalDiscountCents = useMemo(() => {
        if (!globalDiscount) return 0;
        const raw = globalDiscount.kind === 'percent'
            ? applyPercent(subtotalAfterLineCents, globalDiscount.value)
            : toCents(globalDiscount.value);
        return Math.min(Math.max(0, raw), subtotalAfterLineCents);
    }, [globalDiscount, subtotalAfterLineCents]);
    const globalDiscountAmount = toMoney(globalDiscountCents);

    const cartDiscountCents = crmDiscountCents + itemDiscountsCents + globalDiscountCents;
    const taxBaseCents = Math.max(0, cartSubtotalCents - cartDiscountCents);
    const cartTaxCents = applyPercent(taxBaseCents, ivaRate);
    const cartTotalCents = Math.max(0, cartSubtotalCents - cartDiscountCents + cartTaxCents);

    const cartDiscount = toMoney(cartDiscountCents);
    const cartTax = toMoney(cartTaxCents);
    const cartTotal = toMoney(cartTotalCents);



    // ── Discount handlers ────────────────────────────────────────────────────
    const handleOpenLineDiscount = useCallback((productId: string) => {
        setDiscountModal({ scope: 'line', productId });
    }, []);

    const handleOpenGlobalDiscount = useCallback(() => {
        setDiscountModal({ scope: 'global' });
    }, []);

    const handleConfirmDiscount = useCallback((discount: DiscountInfo | null) => {
        if (!discountModal) return;
        if (discountModal.scope === 'global') {
            setGlobalDiscount(discount);
            toast.success(discount ? 'Desconto global aplicado' : 'Desconto global removido');
        } else {
            const { productId } = discountModal;
            setCart(prev => prev.map(item => {
                if (item.productId !== productId) return item;
                if (!discount) {
                    return { ...item, discountPct: 0, discount: null, total: lineTotal(item.quantity, item.unitPrice, 0) };
                }
                const lineBaseCents = Math.round(toCents(item.unitPrice) * item.quantity);
                const pct = discount.kind === 'percent'
                    ? discount.value
                    : Math.min(100, (toCents(discount.value) / Math.max(lineBaseCents, 1)) * 100);
                return { ...item, discountPct: pct, discount, total: lineTotal(item.quantity, item.unitPrice, pct) };
            }));
            toast.success(discount ? 'Desconto aplicado ao item' : 'Desconto removido');
        }
        setDiscountModal(null);
    }, [discountModal, lineTotal]);

    const lineDiscountTarget = useMemo(() => {
        if (!discountModal || discountModal.scope !== 'line') return null;
        return cart.find(i => i.productId === discountModal.productId) || null;
    }, [discountModal, cart]);

    // ── Checkout flow ────────────────────────────────────────────────────────-
    const handleOpenCheckout = useCallback(() => {
        if (cart.length === 0) return;
        if (!shift) {
            toast('Abra o turno primeiro', { icon: '⚠️' });
            setShiftModalMode('open');
            setShowShiftModal(true);
            return;
        }
        setShowPaymentModal(true);
    }, [cart.length, shift]);

    const handleConfirmPayment = async (payments: PaymentEntry[], isCredit: boolean, creditDueDays: number) => {
        // Offline guard — verify per-product offline buffer is sufficient.
        // The buffer was pre-reserved server-side at openShift; if any item
        // exceeds it, the second-out-the-door terminal would oversell on sync.
        if (!isOnline && activeShift?.id) {
            const { getOfflineAvailability } = await import('../../services/offline/shiftReservations');
            const aggregated = new Map<string, { name: string; needed: number }>();
            for (const item of cart) {
                const factor = item.unitMode === 'box' ? (Number(item.packSize) || 1) : 1;
                const units = item.quantity * factor;
                const current = aggregated.get(item.productId);
                aggregated.set(item.productId, {
                    name: item.product.name,
                    needed: (current?.needed ?? 0) + units,
                });
            }
            for (const [productId, { name, needed }] of aggregated) {
                const available = await getOfflineAvailability(activeShift.id, productId);
                if (available < needed) {
                    toast.error(`Stock reservado offline insuficiente para "${name}" (disponível: ${available}, pedido: ${needed}). Restabeleça a ligação ou peça reposição.`, { duration: 8000 });
                    return;
                }
            }
        }

        setShowPaymentModal(false);
        setCheckoutLoading(true);
        try {
            const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
            const primaryMethod = isCredit ? 'credit' : payments[0]?.method || 'cash';

            // Build structured payment reference (JSON) for mixed/reference payments
            const paymentRefData = payments.map(p => ({
                method: p.method,
                amount: Number(p.amount),
                ...(p.reference ? { reference: p.reference } : {})
            }));

            // Recompute values safely avoiding floating point discrepancies before sending to backend.
            // Backend opera SEMPRE em unidades — convertemos qty/unitPrice quando o item está em modo 'box'.
            const sanitizedItems = cart.map(item => {
                const qty = Number(item.quantity) || 0;
                const unitPrice = Number(item.unitPrice) || 0;
                const total = Number(item.total) || 0;
                const discountPct = Number(item.discountPct) || 0;
                const factor = item.unitMode === 'box' ? (Number(item.packSize) || 1) : 1;
                const qtyUnits = qty * factor;
                const unitPriceUnits = factor > 1 ? unitPrice / factor : unitPrice;
                const discountAmount = discountPct > 0 ? (qtyUnits * unitPriceUnits * (discountPct / 100)) : 0;
                return {
                    productId: item.productId,
                    quantity: qtyUnits,
                    unitPrice: Number(unitPriceUnits.toFixed(4)),
                    discount: Number(discountAmount.toFixed(2)),
                    total: Number(total.toFixed(2)),
                    ...(item.discount ? {
                        discountReason: item.discount.reason,
                        discountKind: item.discount.kind,
                        discountAppliedBy: item.discount.appliedBy,
                    } : {})
                };
            });
            const validItemsSubtotal = Number(sanitizedItems.reduce((acc, item) => acc + item.total, 0).toFixed(2));
            const validGlobalDiscount = Math.max(0, Number((cartDiscount - itemDiscounts).toFixed(2)));
            const validTax = Number(cartTax.toFixed(2));
            const validTotal = Number((validItemsSubtotal - validGlobalDiscount + validTax).toFixed(2));
            const validAmountPaid = isCredit ? 0 : Number(totalPaid.toFixed(2));
            const validChange = isCredit ? 0 : Math.max(0, Number((validAmountPaid - validTotal).toFixed(2)));

            // Audit trail estruturado para o backend (persistido em colunas dedicadas)
            const discountAuditPayload: DiscountAuditPayload = {
                global: globalDiscount ? {
                    kind: globalDiscount.kind,
                    value: globalDiscount.value,
                    amount: Number(globalDiscountAmount.toFixed(2)),
                    reason: globalDiscount.reason,
                    appliedBy: globalDiscount.appliedBy,
                } : null,
                lines: cart
                    .filter((i): i is CartItem & { discount: DiscountInfo } => i.discount !== null)
                    .map(i => ({
                        productId: i.productId,
                        productName: i.product?.name,
                        kind: i.discount.kind,
                        value: i.discount.value,
                        amount: Number((i.quantity * i.unitPrice * ((i.discountPct || 0) / 100)).toFixed(2)),
                        pct: Number((i.discountPct || 0).toFixed(2)),
                        reason: i.discount.reason,
                        appliedBy: i.discount.appliedBy,
                    })),
            };
            const hasAnyDiscount = !!discountAuditPayload.global || discountAuditPayload.lines.length > 0;

            const saleData = {
                customerId: selectedCustomer?.id,
                items: sanitizedItems,
                subtotal: validItemsSubtotal,
                discount: validGlobalDiscount,
                tax: validTax,
                total: validTotal,
                sessionId: activeShift?.id,
                paymentMethod: primaryMethod,
                amountPaid: validAmountPaid,
                change: validChange,
                paymentRef: JSON.stringify(paymentRefData),
                warehouseId: activeShift?.warehouseId || undefined,
                originModule: 'commercial',
                ...(globalDiscount ? {
                    discountReason: globalDiscount.reason,
                    discountKind: globalDiscount.kind,
                } : {}),
                ...(hasAnyDiscount ? { discountAudit: discountAuditPayload } : {}),
                notes: [
                    selectedCustomer ? `Cliente: ${selectedCustomer.name}` : customerName ? `Cliente: ${customerName}` : 'Consumidor Geral',
                    isCredit ? `CRÉDITO - Vence em ${creditDueDays} dias` : ''
                ].filter(Boolean).join(' | ')
            };

            let saleResponse: SaleCreateResponse | null = null;
            if (isOnline) {
                saleResponse = await salesAPI.create(saleData) as SaleCreateResponse;
            } else {
                const { allocateNextFiscalNumber, consumeOfflineStock } = await import('../../services/offline/shiftReservations');
                const allocation = activeShift?.id ? await allocateNextFiscalNumber(activeShift.id) : null;
                if (!allocation) {
                    toast.error('Bloco fiscal offline esgotado para este turno. Restabeleça a ligação para receber um novo bloco.', { duration: 8000 });
                    return;
                }

                // Decrement offline reservation per product. Already validated
                // above so failure here is unexpected; treat as hard error.
                const stockDelta = new Map<string, number>();
                for (const item of cart) {
                    const factor = item.unitMode === 'box' ? (Number(item.packSize) || 1) : 1;
                    stockDelta.set(item.productId, (stockDelta.get(item.productId) ?? 0) + item.quantity * factor);
                }
                for (const [productId, units] of stockDelta) {
                    const remaining = await consumeOfflineStock(activeShift!.id, productId, units);
                    if (remaining === null) {
                        toast.error('Falha a consumir reserva offline. Recarregue a página.', { duration: 8000 });
                        return;
                    }
                }

                let queued;
                try {
                    queued = await enqueueSale({
                        ...saleData,
                        assignedFiscalNumber: allocation.assignedFiscalNumber,
                        assignedFiscalSeries: allocation.assignedFiscalSeries,
                    });
                } catch (e) {
                    if (e instanceof OfflineQueueFullError) {
                        toast.error('Fila offline cheia (500 operações). Restaure a ligação antes de continuar a vender.', { duration: 8000 });
                        return;
                    }
                    throw e;
                }

                // Reflect deduction in the UI list (server-truth comes after sync).
                setOfflineProducts(prev => prev.map(p => {
                    const delta = stockDelta.get(p.id);
                    if (!delta) return p;
                    return { ...p, currentStock: Math.max(0, p.currentStock - delta) };
                }));

                // Use the real fiscal number — receipt matches what the server
                // will eventually record, so customers walk out with the right talão.
                saleResponse = { receiptNumber: allocation.receiptNumber };
                void queued;
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
                saleNumber: saleResponse?.receiptNumber ?? '',
                date: new Date(),
                customerName: selectedCustomer?.name || customerName || 'Consumidor Geral',
                customerPhone: selectedCustomer?.phone,
                items: cart.map(i => ({
                    name: i.unitMode === 'box' && (i.packSize || 1) > 1
                        ? `${i.product.name} (cx ${i.packSize}un)`
                        : i.product.name,
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
                change: validChange,
                isCredit,
                creditDueDays: isCredit ? creditDueDays : undefined
            };
            setLastReceipt(receipt);
            setShowReceiptModal(true);

            // Reset cart
            setCart([]);
            setCustomerName('');
            setSelectedCustomer(null);
            setGlobalDiscount(null);
            
            // Invalidate products to update stock quantities immediately
            if (isOnline) {
                queryClient.invalidateQueries({ queryKey: ['commercial', 'products'] });
            }

            toast.success(isOnline ? `Venda ${saleResponse?.receiptNumber ?? ''} registada!` : `Venda offline gravada! Sincronização pendente.`);
        } catch (err) {
            const apiErr = err as PosApiError;
            const errorResponse = apiErr.response?.data;
            const errorMessage = getApiErrorMessage(err, 'Erro ao realizar venda');

            if (errorResponse?.errors && Array.isArray(errorResponse.errors)) {
                const validationErrors = errorResponse.errors
                    .map((detail) => `• ${detail.label || detail.field || 'campo'}: ${detail.message}`)
                    .join('\n');
                toast.error(`Erro de Validação\n\n${validationErrors}`, { duration: 8000 });
            } else {
                toast.error(errorMessage, { duration: 6000 });
            }
            setShowPaymentModal(true);
        } finally {
            setCheckoutLoading(false);
        }
    };

    // ── Held Sales ────────────────────────────────────────────────────────────
    const handleHoldSale = useCallback(() => {
        if (cart.length === 0) return;
        const held: HeldSale = {
            id: Date.now().toString(),
            label: selectedCustomer?.name || customerName || `Venda ${heldSales.length + 1}`,
            cart: [...cart],
            customerName,
            selectedCustomer,
            createdAt: new Date(),
            globalDiscount
        };
        setHeldSales(prev => [...prev, held]);
        setCart([]);
        setCustomerName('');
        setSelectedCustomer(null);
        setGlobalDiscount(null);
        toast.success('Venda suspensa');
    }, [cart, customerName, globalDiscount, heldSales.length, selectedCustomer]);

    const handleResumeSale = (held: HeldSale) => {
        if (cart.length > 0) {
            toast('Finalize ou suspenda a venda actual antes de retomar', { icon: '⚠️' });
            return;
        }
        // Garantir compatibilidade com vendas suspensas antes do toggle Cx/Un
        const restored: CartItem[] = (held.cart as CartItem[]).map((item) => ({
            ...item,
            packSize: Number(item.packSize) || Number(item.product?.packSize) || 1,
            unitMode: item.unitMode || ((Number(item.product?.packSize) || 1) > 1 ? 'box' : 'unit'),
        }));
        setCart(restored);
        setCustomerName(held.customerName);
        setSelectedCustomer(held.selectedCustomer);
        setGlobalDiscount(held.globalDiscount || null);
        setHeldSales(prev => prev.filter(h => h.id !== held.id));
        toast.success(`Venda "${held.label}" retomada`);
    };

    const handleDeleteHeld = (id: string) => {
        setHeldSales(prev => prev.filter(h => h.id !== id));
    };

    // ── Hardware ──────────────────────────────────────────────────────────────
    const handleToggleCashDrawer = useCallback(() => {
        setCashDrawerOpen(v => !v);
        toast(cashDrawerOpen ? 'Gaveta fechada' : 'Gaveta aberta', { 
            icon: cashDrawerOpen ? <HiOutlineLockClosed className="w-5 h-5 text-gray-400 dark:text-gray-500" /> : <HiOutlineBanknotes className="w-5 h-5 text-emerald-500 dark:text-emerald-400" /> 
        });
    }, [cashDrawerOpen]);

    // ── Shift ────────────────────────────────────────────────────────────────-
    const handleOpenShift = async (openingBalance: number, warehouseId?: string) => {
        setShiftLoading(true);
        try {
            await shiftAPI.open(openingBalance, warehouseId);
            queryClient.invalidateQueries({ queryKey: ['commercial', 'shift'] });
            setShowShiftModal(false);
            toast.success('Turno aberto!', { icon: '✅' });
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Erro ao abrir turno'));
        } finally {
            setShiftLoading(false);
        }
    };

    const handleCloseShift = async (countedCash: number, notes?: string) => {
        setShiftLoading(true);
        try {
            const closed = await shiftAPI.close(countedCash, notes);
            const diff = Number(closed.difference) || 0;
            const total = Number(closed.totalSales) || 0;
            toast.success(
                `Turno fechado. Total: ${total.toLocaleString()} MTn${diff !== 0 ? ` | Diferença: ${diff > 0 ? '+' : ''}${diff.toFixed(0)} MTn` : ''}`,
                { duration: 6000 }
            );
            queryClient.invalidateQueries({ queryKey: ['commercial', 'shift'] });
            setShowShiftModal(false);
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Erro ao fechar turno'));
        } finally {
            setShiftLoading(false);
        }
    };

    const handleConfirmMovement = async (amount: number, reason: string) => {
        setMovementLoading(true);
        try {
            await shiftAPI.addMovement({ 
                amount, 
                type: movementType === 'cash_in' ? 'suprimento' : 'sangria', 
                reason 
            });
            queryClient.invalidateQueries({ queryKey: ['commercial', 'shift'] });
            setShowMovementModal(false);
            toast.success(movementType === 'cash_in' ? 'Entrada registada' : 'Sangria registada');
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Erro ao registar movimento'));
        } finally {
            setMovementLoading(false);
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

    const handleReminderCloseShift = useCallback(() => {
        setShiftModalMode('close');
        setShowShiftModal(true);
    }, []);

    const handleReminderViewHistory = useCallback(() => {
        navigate('/commercial/history?tab=shifts');
    }, [navigate]);

    const handleReprintLast = useCallback(() => {
        if (lastReceipt) {
            setShowReceiptModal(true);
        } else {
            toast('Nenhum talão para reimprimir', { icon: '⚠️' });
        }
    }, [lastReceipt]);

    const [confirmClearCartOpen, setConfirmClearCartOpen] = useState(false);

    const performClearCart = useCallback(() => {
        if (isOnline) {
            cart.forEach(item => {
                (item.reservations || []).forEach((r) => commercialAPI.releaseItem(r.id));
            });
        }
        setCart([]);
        setPosSearch('');
        setGlobalDiscount(null);
        setConfirmClearCartOpen(false);
    }, [cart, isOnline]);

    const handleClearCart = useCallback(() => {
        if (cart.length === 0) {
            setCart([]);
            setPosSearch('');
            setGlobalDiscount(null);
            return;
        }
        setConfirmClearCartOpen(true);
    }, [cart]);

    const shortcuts = useMemo(() => [
        { key: 'F1',     action: () => setShowShortcutsHUD(v => !v), description: 'Atalhos' },
        { key: 'F2',     action: () => searchInputRef.current?.focus(), description: 'Busca' },
        { key: 'F4',     action: handleOpenCheckout,   description: 'Pagar'         },
        { key: 'F5',     action: handleHoldSale,       description: 'Suspender'     },
        { key: 'F8',     action: handleToggleCashDrawer, description: 'Gaveta'      },
        { key: 'F9',     action: handleReprintLast,    description: 'Reimprimir'    },
        { key: 'F10',    action: handleToggleShift,    description: 'Turno'         },
        { key: 'Escape', action: handleClearCart,      description: 'Limpar'        }
    ], [handleOpenCheckout, handleToggleCashDrawer, handleHoldSale, handleReprintLast, handleToggleShift, handleClearCart]);

    useKeyboardShortcuts(shortcuts);

    const handleBarcodeSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && posSearch.trim()) {
            const found = products.find((p) =>
                p.barcode === posSearch.trim() || p.code.toLowerCase() === posSearch.trim().toLowerCase()
            );
            if (found) { addToCart(found); setPosSearch(''); }
            else if (filteredProducts.length === 1) { addToCart(filteredProducts[0]); setPosSearch(''); }
        }
    };

    useBarcodeScanner({
        onScan: (barcode) => {
            const found = products.find((p) => p.barcode === barcode || p.code.toLowerCase() === barcode.toLowerCase());
            if (found) { addToCart(found); toast.success(`${found.name} adicionado`); }
        },
        enabled: true
    });

    // First-load feedback: thin top progress strip — non-blocking, page chrome
    // renders immediately so the user is not staring at a blank screen.
    // Strip disappears as soon as both shift and catalog have data.
    const initialLoading = (loadingShift && !activeShift) || (loadingProducts && products.length === 0);

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-dark-950 text-slate-900 dark:text-white space-y-2 pb-10 p-1 lg:p-1 transition-colors duration-500 overflow-x-hidden">
            {/* Top progress strip — non-blocking first-load indicator. */}
            {initialLoading && (
                <>
                    <style>{`
                        @keyframes mc-pos-strip {
                            0%   { transform: translateX(-100%); }
                            50%  { transform: translateX(0%); }
                            100% { transform: translateX(100%); }
                        }
                    `}</style>
                    <div
                        className="fixed top-0 left-0 right-0 z-[100] h-0.5 overflow-hidden bg-blue-500/10 pointer-events-none"
                        role="status"
                        aria-live="polite"
                        aria-label={`A carregar ${[loadingShift && 'turno', loadingProducts && 'catálogo'].filter(Boolean).join(' e ')}`}
                    >
                        <div
                            className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-blue-500 to-transparent"
                            style={{ animation: 'mc-pos-strip 1.4s cubic-bezier(0.4, 0, 0.2, 1) infinite' }}
                        />
                    </div>
                </>
            )}

            {/* Header Redesign - Gaming/Modern Style */}
            <div className="relative group overflow-hidden bg-white dark:bg-gradient-to-br dark:from-dark-800 dark:to-dark-900 border border-slate-200 dark:border-white/5 rounded-2xl p-3 mb-2 shadow-sm dark:shadow-2xl">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/5 rounded-full blur-[80px] pointer-events-none" />
                
                <div className="flex min-w-0 flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-6 relative z-10">
                    <div className="min-w-0 space-y-1">
                        <h1 className="text-lg lg:text-2xl font-bold tracking-tight text-slate-900 dark:text-white drop-shadow-sm">
                            PDV COMERCIAL
                        </h1>
                        <div className="flex min-w-0 items-center gap-2 sm:gap-3 flex-wrap">
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Sistema Online</span>
                            </div>
                            
                            {shift ? (
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                    <HiOutlinePlay className="w-3 h-3 text-blue-400" />
                                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                                        Terminal: {activeWarehouse?.name || 'Geral'}
                                    </span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                                    <HiOutlineLockClosed className="w-3 h-3 text-rose-500" />
                                    <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Turno Fechado</span>
                                </div>
                            )}
                            
                            <span className="text-[10px] font-bold text-slate-500 dark:text-white/30 uppercase tracking-widest sm:tracking-[0.2em] sm:ml-2 break-words">
                                Abra o turno para iniciar vendas
                            </span>
                        </div>
                    </div>

                    <div className="flex w-full flex-wrap items-center gap-2 sm:gap-3 lg:w-auto lg:justify-end [&>*]:w-full sm:[&>*]:w-auto">
                        {!shift ? (
                            <Button
                                variant="primary"
                                onClick={() => { setShiftModalMode('open'); setShowShiftModal(true); }}
                                leftIcon={<HiOutlinePlay className="w-4 h-4" />}
                            >
                                Abrir Turno
                            </Button>
                        ) : (
                            <div className="flex w-full items-center gap-2 sm:w-auto">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { setShiftModalMode('close'); setShowShiftModal(true); }}
                                    leftIcon={<HiOutlineStop className="w-4 h-4" />}
                                >
                                    Fechar Turno
                                </Button>
                            </div>
                        )}
                        
                        <div className="hidden sm:flex w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 items-center justify-center hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer group/sync">
                            <HiOutlineCloudArrowUp className={cn("w-5 h-5 text-slate-400 dark:text-white/30 group-hover/sync:text-blue-500 dark:group-hover/sync:text-blue-400 transition-colors", pendingCount > 0 && "animate-bounce text-blue-500")} />
                        </div>
                    </div>
                </div>
            </div>

            <ShiftReminder
                shift={activeShift}
                summary={shiftSummary}
                isInteractionBlocked={showPaymentModal || showReceiptModal || showShiftModal || showMovementModal || checkoutLoading || shiftLoading}
                onCloseShift={handleReminderCloseShift}
                onViewHistory={handleReminderViewHistory}
            />

            {/* Mobile tabs (Catalogo/Carrinho) — sticky, only < lg */}
            <div className="lg:hidden sticky top-14 z-20 -mx-2 sm:-mx-3 px-2 sm:px-3 py-2 bg-slate-100 dark:bg-dark-950 mb-2 border-b border-slate-200 dark:border-dark-800">
                <div className="flex min-w-0 items-center gap-1 p-1 bg-slate-200 dark:bg-dark-800 rounded-xl shadow-inner">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setMobileView('catalog')}
                        className={cn(
                            "flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all active:scale-[0.98]",
                            mobileView === 'catalog'
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'text-slate-700 dark:text-gray-300 hover:bg-white/40 dark:hover:bg-dark-700/40'
                        )}
                    >
                        Catálogo
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setMobileView('cart')}
                        className={cn(
                            "flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all active:scale-[0.98] relative",
                            mobileView === 'cart'
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'text-slate-700 dark:text-gray-300 hover:bg-white/40 dark:hover:bg-dark-700/40'
                        )}
                    >
                        Carrinho
                        {cart.length > 0 && (
                            <span className="absolute top-1 right-2 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center text-[10px] font-black text-white bg-red-500 rounded-full ring-2 ring-white dark:ring-dark-800">
                                {cart.length > 9 ? '9+' : cart.length}
                            </span>
                        )}
                    </Button>
                </div>
            </div>

            {/* Layout 60/40 (desktop) / tabs (mobile) */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 lg:gap-6 lg:h-[calc(100vh-220px)] pb-24 lg:pb-0">
                <div
                    className={cn(
                        "lg:col-span-3 lg:overflow-y-auto lg:pr-2 lg:scrollbar-none",
                        mobileView === 'catalog' ? 'block' : 'hidden lg:block'
                    )}
                >
                    <CommercialProductGrid
                        searchInputRef={searchInputRef}
                        posSearch={posSearch}
                        setPosSearch={setPosSearch}
                        filteredProducts={filteredProducts}
                        allProducts={displayProducts}
                        posPagination={posPagination}
                        addToCart={addToCart}
                        handleBarcodeSearch={handleBarcodeSearch}
                        processingActions={processingActions}
                    />
                </div>

                <div
                    className={cn(
                        "lg:col-span-2",
                        mobileView === 'cart' ? 'block' : 'hidden lg:block'
                    )}
                >
                    <CommercialCartPanel
                        cart={cart}
                        setCart={setCart}
                        updateQuantity={updateQuantity}
                        removeFromCart={removeFromCart}
                        processingActions={processingActions}
                        cartTotal={cartTotal}
                        cartSubtotal={cartSubtotal}
                        cartTax={cartTax}
                        ivaRate={ivaRate}
                        cartDiscount={cartDiscount}
                        selectedCustomer={selectedCustomer}
                        setSelectedCustomer={setSelectedCustomer}
                        customerName={customerName}
                        setCustomerName={setCustomerName}
                        onCheckout={handleOpenCheckout}
                        checkoutLoading={checkoutLoading}
                        customers={displayCustomers}
                        cashDrawerOpen={cashDrawerOpen}
                        handleToggleCashDrawer={handleToggleCashDrawer}
                        cashDrawerBalance={cashDrawerBalance}
                        onOpenLineDiscount={handleOpenLineDiscount}
                        onOpenGlobalDiscount={handleOpenGlobalDiscount}
                        globalDiscount={globalDiscount}
                        crmDiscount={crmDiscount}
                        handleScaleAction={() => {
                            // Filtra items vendidos em unidade pesável (kg, L, m, m²...).
                            // 0 pesáveis → erro. 1 pesável → abre balança directo.
                            // >1 → abre picker para o cashier escolher.
                            const weighable = cart.filter((item) => isDecimalUnit(item.product.unit || 'un'));
                            if (weighable.length === 0) {
                                toast.error('Adicione primeiro um produto pesável (kg, L) ao carrinho.');
                                return;
                            }
                            if (weighable.length === 1) {
                                const target = weighable[0];
                                setScaleTargetProductId(target.productId);
                                setScaleProduct({ name: target.product.name, unitPrice: target.unitPrice, unit: target.product.unit });
                                setShowScaleModal(true);
                                return;
                            }
                            setScalePickerOpen(true);
                        }}
                        heldSales={heldSales}
                        onResumeSale={handleResumeSale}
                        onDeleteHeld={handleDeleteHeld}
                        onCashMovement={(type) => {
                            setMovementType(type);
                            setShowMovementModal(true);
                        }}
                    />
                </div>
            </div>

            {/* Mobile bottom bar — visible only on < lg, shows total + pay */}
            {cart.length > 0 && (
                <div
                    className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-dark-800 border-t border-slate-200 dark:border-dark-700 shadow-[0_-4px_20px_rgba(15,23,42,0.08)]"
                    style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
                >
                    <div className="flex items-center justify-between gap-3 px-3 py-2">
                        <div
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => setMobileView('cart')}
                        >
                            <p className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                                {cart.length} {cart.length === 1 ? 'item' : 'itens'}
                            </p>
                            <p className="text-lg font-black text-slate-900 dark:text-white tabular-nums leading-tight truncate">
                                {toMoney(cartTotal)} MZN
                            </p>
                        </div>
                        <Button
                            variant="success"
                            size="md"
                            onClick={handleOpenCheckout}
                            disabled={checkoutLoading || !shift}
                            isLoading={checkoutLoading}
                            className="h-12 flex-1 px-4 sm:flex-none sm:px-5"
                            leftIcon={<HiOutlineBanknotes className="w-5 h-5" />}
                        >
                            Pagar
                        </Button>
                    </div>
                </div>
            )}

            {/* Modals */}
            <CommercialPaymentModal
                isOpen={showPaymentModal}
                onClose={() => setShowPaymentModal(false)}
                onConfirm={handleConfirmPayment}
                cartTotal={cartTotal}
                cartSubtotal={cartSubtotal}
                cartDiscount={cartDiscount}
                cartTax={cartTax}
                ivaRate={ivaRate}
                customerName={selectedCustomer?.name || customerName}
                selectedCustomer={selectedCustomer}
                isLoading={checkoutLoading}
            />

            <CommercialShiftModal
                isOpen={showShiftModal}
                mode={shiftModalMode}
                shift={shift}
                onOpenShift={handleOpenShift}
                onCloseShift={handleCloseShift}
                onClose={() => setShowShiftModal(false)}
                isLoading={shiftLoading}
            />

            <CommercialReceiptModal
                isOpen={showReceiptModal}
                receipt={lastReceipt}
                onClose={() => setShowReceiptModal(false)}
            />

            {/* Picker — só aparece quando há >1 produto pesável no carrinho */}
            <Modal
                isOpen={scalePickerOpen}
                onClose={() => setScalePickerOpen(false)}
                title="Pesar qual produto?"
                size="sm"
            >
                <div className="space-y-2">
                    <p className="text-xs text-slate-500 dark:text-gray-400 mb-3">
                        Escolha o produto que está em cima da balança.
                    </p>
                    {cart
                        .filter((item) => isDecimalUnit(item.product.unit || 'un'))
                        .map((item) => (
                            <Button
                                key={item.productId}
                                type="button"
                                variant="outline"
                                fullWidth
                                onClick={() => {
                                    setScalePickerOpen(false);
                                    setScaleTargetProductId(item.productId);
                                    setScaleProduct({
                                        name: item.product.name,
                                        unitPrice: item.unitPrice,
                                        unit: item.product.unit,
                                    });
                                    setShowScaleModal(true);
                                }}
                                className="justify-between"
                            >
                                <span className="truncate">{item.product.name}</span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary-600 dark:text-primary-300 shrink-0">
                                    {item.quantity} {item.product.unit}
                                </span>
                            </Button>
                        ))}
                </div>
            </Modal>

            <CommercialScaleModal
                isOpen={showScaleModal}
                onClose={() => {
                    setShowScaleModal(false);
                    setScaleTargetProductId(null);
                }}
                product={scaleProduct}
                onConfirm={(weightG, qty) => {
                    // Aplica o peso ao produto-alvo registado quando a balança
                    // foi aberta, NÃO ao último item do carrinho. Se o item
                    // entretanto foi removido, falha silenciosamente.
                    const target = scaleTargetProductId
                        ? cart.find((i) => i.productId === scaleTargetProductId)
                        : null;
                    if (target) {
                        updateQuantity(target.productId, qty);
                        toast.success(`${target.product.name}: ${(weightG / 1000).toFixed(3)} kg`);
                    } else {
                        toast.error('Produto-alvo já não está no carrinho.');
                    }
                    setScaleTargetProductId(null);
                    setShowScaleModal(false);
                }}
            />

            <CommercialCashMovementModal
                isOpen={showMovementModal}
                type={movementType}
                onClose={() => setShowMovementModal(false)}
                onConfirm={handleConfirmMovement}
                isLoading={movementLoading}
            />

            {/* Atalhos de teclado - overlay F1 */}
            <CommercialShortcutsHUD
                isOpen={showShortcutsHUD}
                onClose={() => setShowShortcutsHUD(false)}
            />

            {/* Modal de desconto profissional */}
            <CommercialDiscountModal
                isOpen={!!discountModal}
                onClose={() => setDiscountModal(null)}
                onConfirm={handleConfirmDiscount}
                scope={discountModal?.scope || 'global'}
                productName={lineDiscountTarget?.product?.name}
                baseAmount={
                    discountModal?.scope === 'line' && lineDiscountTarget
                        ? lineDiscountTarget.quantity * lineDiscountTarget.unitPrice
                        : subtotalAfterLine
                }
                currentDiscount={
                    discountModal?.scope === 'line'
                        ? (lineDiscountTarget?.discount || null)
                        : globalDiscount
                }
            />

            {/* Badge flutuante de atalhos */}
            <ShortcutsHintBadge onClick={() => setShowShortcutsHUD(true)} />

            {(() => {
                const busy = checkoutLoading || shiftLoading || movementLoading;
                if (!busy) return null;

                // Honest, specific messages — citam o que está realmente em curso
                // com os números visíveis no momento da acção (carrinho ainda
                // não foi limpo, movementType ainda em estado, activeShift
                // indica abertura vs fecho).
                let message: string;
                let subtext: string | undefined;
                if (checkoutLoading) {
                    message = 'A processar venda';
                    const itemCount = cart.length;
                    const totalLabel = `${cartTotal.toLocaleString('pt-MZ')} MTn`;
                    subtext = `${itemCount} ${itemCount === 1 ? 'item' : 'itens'} · ${totalLabel}`;
                } else if (shiftLoading) {
                    message = activeShift ? 'A processar fecho de turno' : 'A processar abertura de turno';
                } else {
                    message = movementType === 'cash_in'
                        ? 'A processar suprimento'
                        : 'A processar sangria';
                    subtext = movementType === 'cash_in' ? 'entrada de caixa' : 'saída de caixa';
                }
                return <LoadingOverlay message={message} subtext={subtext} fullScreen />;
            })()}

            <ConfirmationModal
                isOpen={confirmClearCartOpen}
                onClose={() => setConfirmClearCartOpen(false)}
                onConfirm={performClearCart}
                title="Limpar carrinho?"
                message="A venda actual será descartada. Quer continuar?"
                confirmText="Sim, limpar"
                cancelText="Cancelar"
                variant="warning"
            />
        </div>
    );
}
