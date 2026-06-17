import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    HiOutlineMagnifyingGlass,
    HiOutlineXMark,
    HiOutlineClock,
    HiOutlineArrowRight,
    HiOutlineBuildingOffice2,
    HiCube,
    HiUserGroup,
    HiShoppingBag,
    HiOutlineUser,
    HiOutlineTruck,
    HiOutlineTag,
    HiCommandLine,
} from 'react-icons/hi2';
import {
    MdMedicalServices,
    MdHotel,
    MdReceiptLong,
    MdShowChart,
    MdRestaurantMenu,
    MdLocalShipping,
    MdLiquor,
} from 'react-icons/md';
import { logger } from '../../utils/logger';
import { useTenant } from '../../contexts/TenantContext';
import { useAuthStore } from '../../stores/useAuthStore';
import { Button } from '../ui';
import {
    productsAPI,
    customersAPI,
    employeesAPI,
    ordersAPI,
    suppliersAPI,
    settingsAPI,
    pharmacyAPI,
    hospitalityAPI,
    crmAPI,
    invoicesAPI,
    salesAPI,
    restaurantAPI,
} from '../../services/api';

// ============================================================================
// Types
// ============================================================================

type ResultType =
    | 'product'
    | 'customer'
    | 'supplier'
    | 'employee'
    | 'category'
    | 'order'
    | 'sale'
    | 'invoice'
    | 'medication'
    | 'room'
    | 'booking'
    | 'opportunity'
    | 'table'
    | 'menuItem';

interface SearchResultItem {
    id: string | number;
    type: ResultType;
    title: string;
    subtitle?: string;
    href: string;
    module?: string;
}

// ── Minimal shape interfaces — only the fields this component reads. ────────
// API responses come either as a raw array or wrapped in `{ data: [...] }`,
// so the helper below normalises both forms.
type ListResponse<T> = T[] | { data?: T[] };
function pickItems<T>(res: unknown): T[] {
    if (Array.isArray(res)) return res as T[];
    if (res && typeof res === 'object' && 'data' in res && Array.isArray((res as { data?: unknown }).data)) {
        return (res as { data: T[] }).data;
    }
    return [];
}

type ProductHit = {
    id: string | number;
    name: string;
    code?: string | null;
    barcode?: string | null;
    sku?: string | null;
    currentStock?: number;
    originModule?: string | null;
};
type SupplierHit = { id: string | number; name: string; contactPerson?: string | null; phone?: string | null };
type CategoryHit = { id: string | number; name: string; code?: string | null };
type OrderHit = { id: string | number; orderNumber: string; customerName?: string | null };
type CustomerHit = { id: string | number; name: string; phone?: string | null; email?: string | null };
type OpportunityHit = { id: string | number; title: string; status?: string | null; customer?: { name?: string | null } | null };
type EmployeeHit = { id: string | number; name: string; role?: string | null; department?: string | null };
type SaleHit = { id: string | number; receiptNumber?: string | null; customerName?: string | null; total?: number | string | null };
type InvoiceHit = { id: string | number; invoiceNumber: string; customerName?: string | null; status?: string | null };
type MedicationHit = { id: string | number; name: string; concentration?: string | null; dosageForm?: string | null };
type RoomHit = { id: string | number; number: string | number; type?: string | null; status?: string | null };
type BookingHit = { id: string | number; customerName?: string | null; status?: string | null; room?: { number?: string | number | null } | null };
type TableHit = { id: string | number; number: string | number; name?: string | null; zone?: string | null; status?: string | null };
type MenuItemHit = { id: string | number; name: string; category?: string | null; price?: number | string | null };

interface ModuleConfig {
    code: string;
    label: string;
    types: ResultType[];
    requires: string | string[];
    icon: React.ComponentType<{ className?: string }>;
    accent: string;
    badgeBg: string;
    badgeText: string;
    landing: string;
}

// ============================================================================
// Config: which modules can produce which types
// ============================================================================

const MODULE_CONFIG: ModuleConfig[] = [
    {
        code: 'inventory',
        label: 'Inventário',
        types: ['product', 'category', 'supplier', 'order'],
        requires: 'inventory',
        icon: HiCube,
        accent: 'text-slate-600 dark:text-slate-300',
        badgeBg: 'bg-slate-100 dark:bg-slate-800',
        badgeText: 'text-slate-700 dark:text-slate-300',
        landing: '/inventory',
    },
    {
        code: 'pharmacy',
        label: 'Farmácia',
        types: ['medication'],
        requires: 'pharmacy',
        icon: MdMedicalServices,
        accent: 'text-teal-600 dark:text-teal-400',
        badgeBg: 'bg-teal-100 dark:bg-teal-900/30',
        badgeText: 'text-teal-700 dark:text-teal-300',
        landing: '/pharmacy/dashboard',
    },
    {
        code: 'hospitality',
        label: 'Hospitalidade',
        types: ['room', 'booking'],
        requires: 'hospitality',
        icon: MdHotel,
        accent: 'text-indigo-600 dark:text-indigo-400',
        badgeBg: 'bg-indigo-100 dark:bg-indigo-900/30',
        badgeText: 'text-indigo-700 dark:text-indigo-300',
        landing: '/hospitality/dashboard',
    },
    {
        code: 'restaurant',
        label: 'Restaurante',
        types: ['table', 'menuItem'],
        requires: 'restaurant',
        icon: MdRestaurantMenu,
        accent: 'text-orange-600 dark:text-orange-400',
        badgeBg: 'bg-orange-100 dark:bg-orange-900/30',
        badgeText: 'text-orange-700 dark:text-orange-300',
        landing: '/restaurant/dashboard',
    },
    {
        code: 'commercial',
        label: 'Comercial',
        types: ['product', 'sale', 'invoice'],
        requires: 'commercial',
        icon: MdReceiptLong,
        accent: 'text-blue-600 dark:text-blue-400',
        badgeBg: 'bg-blue-100 dark:bg-blue-900/30',
        badgeText: 'text-blue-700 dark:text-blue-300',
        landing: '/commercial/dashboard',
    },
    {
        code: 'crm',
        label: 'CRM',
        types: ['customer', 'opportunity'],
        requires: ['crm', 'inventory'],
        icon: MdShowChart,
        accent: 'text-amber-600 dark:text-amber-400',
        badgeBg: 'bg-amber-100 dark:bg-amber-900/30',
        badgeText: 'text-amber-700 dark:text-amber-300',
        landing: '/crm',
    },
    {
        code: 'sales',
        label: 'Vendas & Facturas',
        types: ['sale', 'invoice'],
        requires: ['pos', 'invoices'],
        icon: MdReceiptLong,
        accent: 'text-emerald-600 dark:text-emerald-400',
        badgeBg: 'bg-emerald-100 dark:bg-emerald-900/30',
        badgeText: 'text-emerald-700 dark:text-emerald-300',
        landing: '/financial',
    },
    {
        code: 'hr',
        label: 'Recursos Humanos',
        types: ['employee'],
        requires: 'hr',
        icon: HiOutlineUser,
        accent: 'text-rose-600 dark:text-rose-400',
        badgeBg: 'bg-rose-100 dark:bg-rose-900/30',
        badgeText: 'text-rose-700 dark:text-rose-300',
        landing: '/hr',
    },
    {
        code: 'logistics',
        label: 'Logística',
        types: ['product'],
        requires: 'logistics',
        icon: MdLocalShipping,
        accent: 'text-cyan-600 dark:text-cyan-400',
        badgeBg: 'bg-cyan-100 dark:bg-cyan-900/30',
        badgeText: 'text-cyan-700 dark:text-cyan-300',
        landing: '/logistics/dashboard',
    },
    {
        code: 'bottle_store',
        label: 'Garrafeira',
        types: ['product'],
        requires: 'bottle_store',
        icon: MdLiquor,
        accent: 'text-purple-600 dark:text-purple-400',
        badgeBg: 'bg-purple-100 dark:bg-purple-900/30',
        badgeText: 'text-purple-700 dark:text-purple-300',
        landing: '/bottle-store/dashboard',
    },
];

const TYPE_META: Record<ResultType, { label: string; icon: React.ComponentType<{ className?: string }>; module: string }> = {
    product: { label: 'PRODUTO', icon: HiCube, module: 'inventory' },
    category: { label: 'CATEGORIA', icon: HiOutlineTag, module: 'inventory' },
    supplier: { label: 'FORNECEDOR', icon: HiOutlineTruck, module: 'inventory' },
    order: { label: 'ENCOMENDA', icon: HiShoppingBag, module: 'inventory' },
    customer: { label: 'CLIENTE', icon: HiUserGroup, module: 'crm' },
    opportunity: { label: 'OPORTUNIDADE', icon: MdShowChart, module: 'crm' },
    employee: { label: 'COLABORADOR', icon: HiOutlineUser, module: 'hr' },
    sale: { label: 'VENDA', icon: MdReceiptLong, module: 'sales' },
    invoice: { label: 'FACTURA', icon: MdReceiptLong, module: 'sales' },
    medication: { label: 'MEDICAMENTO', icon: MdMedicalServices, module: 'pharmacy' },
    room: { label: 'QUARTO', icon: MdHotel, module: 'hospitality' },
    booking: { label: 'RESERVA', icon: MdHotel, module: 'hospitality' },
    table: { label: 'MESA', icon: MdRestaurantMenu, module: 'restaurant' },
    menuItem: { label: 'MENU', icon: MdRestaurantMenu, module: 'restaurant' },
};

const SPECIALIZED_MODULES = ['pharmacy', 'commercial', 'hospitality', 'bottle_store', 'logistics', 'restaurant'];
const RECENT_SEARCHES_KEY = 'globalSearch:recent';
const MAX_RECENT = 6;
const MAX_PER_TYPE = 5;
const SERVER_LIMIT = 10; // request a small page from server, slice further client-side
const CACHE_TTL_MS = 30_000;
const CACHE_MAX = 30;

// ============================================================================
// Helpers
// ============================================================================

const safeText = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const lower = (v: unknown) => safeText(v).toLowerCase();
const matches = (q: string, ...fields: unknown[]) =>
    fields.some((f) => lower(f).includes(q));

function highlight(text: string, query: string) {
    if (!query.trim()) return text;
    try {
        const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
        return parts.map((part, i) =>
            part.toLowerCase() === query.trim().toLowerCase() ? (
                <mark key={i} className="bg-yellow-200/70 dark:bg-yellow-500/30 text-inherit rounded px-0.5">
                    {part}
                </mark>
            ) : (
                <span key={i}>{part}</span>
            )
        );
    } catch {
        return text;
    }
}

function loadRecent(scopeKey: string): string[] {
    try {
        const raw = localStorage.getItem(`${RECENT_SEARCHES_KEY}:${scopeKey}`);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveRecent(scopeKey: string, query: string) {
    if (!query.trim()) return;
    try {
        const current = loadRecent(scopeKey);
        const next = [query, ...current.filter((q) => q.toLowerCase() !== query.toLowerCase())].slice(0, MAX_RECENT);
        localStorage.setItem(`${RECENT_SEARCHES_KEY}:${scopeKey}`, JSON.stringify(next));
    } catch {
        // ignore
    }
}

function clearRecent(scopeKey: string) {
    try {
        localStorage.removeItem(`${RECENT_SEARCHES_KEY}:${scopeKey}`);
    } catch {
        // ignore
    }
}

// In-memory LRU-ish cache for search results, scoped per company+module context
const resultCache = new Map<string, { ts: number; items: SearchResultItem[] }>();
function cacheGet(key: string): SearchResultItem[] | null {
    const entry = resultCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL_MS) {
        resultCache.delete(key);
        return null;
    }
    // bump recency
    resultCache.delete(key);
    resultCache.set(key, entry);
    return entry.items;
}
function cacheSet(key: string, items: SearchResultItem[]) {
    if (resultCache.size >= CACHE_MAX) {
        const oldestKey = resultCache.keys().next().value;
        if (oldestKey) resultCache.delete(oldestKey);
    }
    resultCache.set(key, { ts: Date.now(), items });
}

// ============================================================================
// GlobalSearch
// ============================================================================

export default function GlobalSearch() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { hasModule, company } = useTenant();
    const { user } = useAuthStore();

    const inputRef = useRef<HTMLInputElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [activeFilter, setActiveFilter] = useState<string>('all');
    const [isSearching, setIsSearching] = useState(false);
    const [results, setResults] = useState<SearchResultItem[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);

    const isSuperAdmin = user?.role === 'super_admin';
    const userSpecializedModules = !isSuperAdmin
        ? SPECIALIZED_MODULES.filter((m) => hasModule(m))
        : [];
    // Only restrict origin filter when user has exactly one specialized module.
    // Multiple specialized modules → don't pre-filter (let user pick via chips).
    const userSpecializedModule =
        userSpecializedModules.length === 1 ? userSpecializedModules[0] : undefined;

    // Recent searches scoped per company (multi-empresa)
    const recentScope = company?.id ? `c${company.id}` : 'global';
    const [recent, setRecent] = useState<string[]>(() => loadRecent(recentScope));

    useEffect(() => {
        setRecent(loadRecent(recentScope));
    }, [recentScope]);

    // Available modules for filter chips (only those the tenant has)
    const availableModules = useMemo(
        () =>
            MODULE_CONFIG.filter((m) => {
                if (m.types.length === 0) return false;
                const reqs = Array.isArray(m.requires) ? m.requires : [m.requires];
                return reqs.some((r) => hasModule(r));
            }),
        [hasModule]
    );

    // Close on route change
    useEffect(() => {
        setOpen(false);
        setQuery('');
    }, [location.pathname, location.search]);

    // Cmd/Ctrl+K shortcut
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const isMac = navigator.platform.toLowerCase().includes('mac');
            const mod = isMac ? e.metaKey : e.ctrlKey;
            if (mod && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
                inputRef.current?.select();
                setOpen(true);
            }
            if (e.key === 'Escape' && open) {
                setOpen(false);
                inputRef.current?.blur();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open]);

    // Click outside to close
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (!containerRef.current) return;
            if (!containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Debounced search
    useEffect(() => {
        if (!open) return;
        if (query.trim().length === 0) {
            setResults([]);
            setIsSearching(false);
            abortRef.current?.abort();
            return;
        }

        const controller = new AbortController();
        abortRef.current?.abort();
        abortRef.current = controller;

        const timer = setTimeout(async () => {
            const q = query.trim();
            const cacheKey = `${recentScope}::${userSpecializedModule || 'all'}::${q.toLowerCase()}`;
            const cached = cacheGet(cacheKey);
            if (cached) {
                setResults(cached);
                setActiveIndex(0);
                setIsSearching(false);
                return;
            }

            setIsSearching(true);
            try {
                const collected: SearchResultItem[] = [];

                const tasks: Promise<SearchResultItem[]>[] = [];

                // Inventory: products, suppliers, categories, orders
                if (hasModule('inventory')) {
                    tasks.push(
                        productsAPI
                            .getAll({ search: q, originModule: userSpecializedModule })
                            .then((res) => {
                                const items = pickItems<ProductHit>(res);
                                const ql = q.toLowerCase();
                                return items.slice(0, MAX_PER_TYPE).map((p): SearchResultItem => {
                                    // Derive module from product.originModule so badges/chips group correctly.
                                    const om = (p.originModule || 'inventory').toLowerCase();
                                    const moduleCode = MODULE_CONFIG.find((m) => m.code === om)?.code || 'inventory';
                                    const hrefByModule: Record<string, string> = {
                                        pharmacy: `/pharmacy/manage?search=${encodeURIComponent(p.code || p.name)}`,
                                        restaurant: `/restaurant/menu?search=${encodeURIComponent(p.name)}`,
                                        bottle_store: `/bottle-store/inventory?search=${encodeURIComponent(p.name)}`,
                                        commercial: `/commercial/inventory?search=${encodeURIComponent(p.code || p.name)}`,
                                        logistics: `/logistics/dashboard?search=${encodeURIComponent(p.name)}`,
                                    };
                                    // Surface whichever identifier matched the query so the user sees the hit.
                                    const idParts: string[] = [];
                                    if (p.code) idParts.push(p.code);
                                    if (p.barcode && lower(p.barcode).includes(ql) && p.barcode !== p.code) {
                                        idParts.push(`cb:${p.barcode}`);
                                    }
                                    if (p.sku && lower(p.sku).includes(ql) && p.sku !== p.code) {
                                        idParts.push(`sku:${p.sku}`);
                                    }
                                    const stockPart = p.currentStock !== undefined ? `${p.currentStock} em stock` : '';
                                    const subtitle = [idParts.join(' · '), stockPart].filter(Boolean).join(' • ');
                                    return {
                                        id: p.id,
                                        type: 'product',
                                        title: p.name,
                                        subtitle,
                                        href: hrefByModule[moduleCode] || `/inventory?search=${encodeURIComponent(p.code || p.name)}`,
                                        module: moduleCode,
                                    };
                                });
                            })
                            .catch(() => [])
                    );

                    tasks.push(
                        suppliersAPI
                            .getAll({ search: q })
                            .then((res) => {
                                const items = pickItems<SupplierHit>(res);
                                return items.slice(0, MAX_PER_TYPE).map((s): SearchResultItem => ({
                                    id: s.id,
                                    type: 'supplier',
                                    title: s.name,
                                    subtitle: [s.contactPerson, s.phone].filter(Boolean).join(' • '),
                                    href: `/suppliers?search=${encodeURIComponent(s.name)}`,
                                    module: 'inventory',
                                }));
                            })
                            .catch(() => [])
                    );

                    tasks.push(
                        settingsAPI
                            .getCategories()
                            .then((res) => {
                                const items = pickItems<CategoryHit>(res);
                                return items
                                    .filter((c) => matches(q.toLowerCase(), c.name, c.code))
                                    .slice(0, MAX_PER_TYPE)
                                    .map((c): SearchResultItem => ({
                                        id: c.id,
                                        type: 'category',
                                        title: c.name,
                                        subtitle: c.code || '',
                                        href: `/categories?search=${encodeURIComponent(c.name)}`,
                                        module: 'inventory',
                                    }));
                            })
                            .catch(() => [])
                    );

                    // ordersAPI.getAll doesn't formally accept `search` — backend
                    // ignores unknown params, so cast just the call signature.
                    if (ordersAPI.getAll) {
                        const getOrders = ordersAPI.getAll as (p: { search?: string; originModule?: string }) => Promise<ListResponse<OrderHit>>;
                        tasks.push(
                            getOrders({ search: q, originModule: userSpecializedModule })
                                .then((res) => {
                                    const items = pickItems<OrderHit>(res);
                                    return items
                                        .filter((o) => matches(q.toLowerCase(), o.orderNumber, o.customerName))
                                        .slice(0, MAX_PER_TYPE)
                                        .map((o): SearchResultItem => ({
                                            id: o.id,
                                            type: 'order',
                                            title: o.orderNumber,
                                            subtitle: o.customerName ?? undefined,
                                            href: `/orders?search=${encodeURIComponent(o.orderNumber)}`,
                                            module: 'inventory',
                                        }));
                                })
                                .catch(() => [])
                        );
                    }
                }

                // CRM: customers + opportunities
                if (hasModule('crm') || hasModule('inventory')) {
                    tasks.push(
                        customersAPI
                            .getAll({ search: q })
                            .then((res) => {
                                const items = pickItems<CustomerHit>(res);
                                return items.slice(0, MAX_PER_TYPE).map((c): SearchResultItem => ({
                                    id: c.id,
                                    type: 'customer',
                                    title: c.name,
                                    subtitle: [c.phone, c.email].filter(Boolean).join(' • ') || 'Sem contacto',
                                    href: `/customers?search=${encodeURIComponent(c.name)}`,
                                    module: 'crm',
                                }));
                            })
                            .catch(() => [])
                    );
                }

                if (hasModule('crm') && crmAPI.getOpportunities) {
                    tasks.push(
                        crmAPI
                            .getOpportunities({ search: q, limit: SERVER_LIMIT })
                            .then((res) => {
                                const items = pickItems<OpportunityHit>(res);
                                return items.slice(0, MAX_PER_TYPE).map((o): SearchResultItem => ({
                                    id: o.id,
                                    type: 'opportunity',
                                    title: o.title,
                                    subtitle: [o.customer?.name, o.status].filter(Boolean).join(' • '),
                                    href: `/crm?search=${encodeURIComponent(o.title)}`,
                                    module: 'crm',
                                }));
                            })
                            .catch(() => [])
                    );
                }

                // HR: employees
                if (hasModule('hr')) {
                    tasks.push(
                        employeesAPI
                            .getAll({ search: q })
                            .then((res) => {
                                const items = pickItems<EmployeeHit>(res);
                                return items.slice(0, MAX_PER_TYPE).map((e): SearchResultItem => ({
                                    id: e.id,
                                    type: 'employee',
                                    title: e.name,
                                    subtitle: [e.role, e.department].filter(Boolean).join(' • '),
                                    href: `/employees?search=${encodeURIComponent(e.name)}`,
                                    module: 'hr',
                                }));
                            })
                            .catch(() => [])
                    );
                }

                // Sales (POS) + invoices
                if (hasModule('pos') && salesAPI.getAll) {
                    tasks.push(
                        salesAPI
                            .getAll({ search: q, originModule: userSpecializedModule, limit: SERVER_LIMIT })
                            .then((res) => {
                                const items = pickItems<SaleHit>(res);
                                return items.slice(0, MAX_PER_TYPE).map((s): SearchResultItem => ({
                                    id: s.id,
                                    type: 'sale',
                                    title: s.receiptNumber || `Venda #${s.id}`,
                                    subtitle: [s.customerName, s.total ? `${s.total} MT` : null].filter(Boolean).join(' • '),
                                    href: `/financial?search=${encodeURIComponent(s.receiptNumber || '')}`,
                                    module: 'sales',
                                }));
                            })
                            .catch(() => [])
                    );
                }

                // invoicesAPI.getAll doesn't formally accept `search`; the backend
                // ignores unknown params, so cast just the call signature.
                if (hasModule('invoices') && invoicesAPI.getAll) {
                    const getInvoices = invoicesAPI.getAll as (p: { search?: string; originModule?: string }) => Promise<ListResponse<InvoiceHit>>;
                    tasks.push(
                        getInvoices({ search: q, originModule: userSpecializedModule })
                            .then((res) => {
                                const items = pickItems<InvoiceHit>(res);
                                return items
                                    .filter((i) => matches(q.toLowerCase(), i.invoiceNumber, i.customerName))
                                    .slice(0, MAX_PER_TYPE)
                                    .map((i): SearchResultItem => ({
                                        id: i.id,
                                        type: 'invoice',
                                        title: i.invoiceNumber,
                                        subtitle: [i.customerName, i.status].filter(Boolean).join(' • '),
                                        href: `/invoices?search=${encodeURIComponent(i.invoiceNumber)}`,
                                        module: 'sales',
                                    }));
                            })
                            .catch(() => [])
                    );
                }

                // Pharmacy
                if (hasModule('pharmacy') && pharmacyAPI.getMedications) {
                    tasks.push(
                        pharmacyAPI
                            .getMedications({ search: q })
                            .then((res) => {
                                const items = pickItems<MedicationHit>(res);
                                return items.slice(0, MAX_PER_TYPE).map((m): SearchResultItem => ({
                                    id: m.id,
                                    type: 'medication',
                                    title: m.name,
                                    subtitle: [m.concentration, m.dosageForm].filter(Boolean).join(' • '),
                                    href: `/pharmacy?search=${encodeURIComponent(m.name)}`,
                                    module: 'pharmacy',
                                }));
                            })
                            .catch(() => [])
                    );
                }

                // Hospitality
                if (hasModule('hospitality') && hospitalityAPI.getRooms) {
                    tasks.push(
                        hospitalityAPI
                            .getRooms({ search: q })
                            .then((res) => {
                                const items = pickItems<RoomHit>(res);
                                return items.slice(0, MAX_PER_TYPE).map((r): SearchResultItem => ({
                                    id: r.id,
                                    type: 'room',
                                    title: `Quarto ${r.number}`,
                                    subtitle: [r.type, r.status].filter(Boolean).join(' • '),
                                    href: `/hospitality/rooms?number=${encodeURIComponent(String(r.number))}`,
                                    module: 'hospitality',
                                }));
                            })
                            .catch(() => [])
                    );
                }

                if (hasModule('hospitality') && hospitalityAPI.getBookings) {
                    tasks.push(
                        hospitalityAPI
                            .getBookings({ search: q, limit: SERVER_LIMIT })
                            .then((res) => {
                                const items = pickItems<BookingHit>(res);
                                return items.slice(0, MAX_PER_TYPE).map((b): SearchResultItem => ({
                                    id: b.id,
                                    type: 'booking',
                                    title: b.customerName || `Reserva #${b.id}`,
                                    subtitle: [b.room?.number ? `Quarto ${b.room.number}` : null, b.status].filter(Boolean).join(' • '),
                                    href: `/hospitality/reservations?search=${encodeURIComponent(b.customerName || '')}`,
                                    module: 'hospitality',
                                }));
                            })
                            .catch(() => [])
                    );
                }

                // Restaurant
                if (hasModule('restaurant')) {
                    if (restaurantAPI.getTables) {
                        tasks.push(
                            restaurantAPI
                                .getTables()
                                .then((res) => {
                                    const items = pickItems<TableHit>(res);
                                    return items
                                        .filter((tbl) => matches(q.toLowerCase(), tbl.number, tbl.name, tbl.zone))
                                        .slice(0, MAX_PER_TYPE)
                                        .map((tbl): SearchResultItem => ({
                                            id: tbl.id,
                                            type: 'table',
                                            title: `Mesa ${tbl.number}${tbl.name ? ` — ${tbl.name}` : ''}`,
                                            subtitle: [tbl.zone, tbl.status].filter(Boolean).join(' • '),
                                            href: `/restaurant/tables`,
                                            module: 'restaurant',
                                        }));
                                })
                                .catch(() => [])
                        );
                    }
                    if (restaurantAPI.getMenuItems) {
                        tasks.push(
                            restaurantAPI
                                .getMenuItems({ search: q })
                                .then((res) => {
                                    const items = pickItems<MenuItemHit>(res);
                                    return items.slice(0, MAX_PER_TYPE).map((m): SearchResultItem => ({
                                        id: m.id,
                                        type: 'menuItem',
                                        title: m.name,
                                        subtitle: [m.category, m.price ? `${m.price} MT` : null].filter(Boolean).join(' • '),
                                        href: `/restaurant/menu?search=${encodeURIComponent(m.name)}`,
                                        module: 'restaurant',
                                    }));
                                })
                                .catch(() => [])
                        );
                    }
                }

                const batches = await Promise.all(tasks);
                if (controller.signal.aborted) return;

                for (const batch of batches) collected.push(...batch);
                cacheSet(cacheKey, collected);
                setResults(collected);
                setActiveIndex(0);
            } catch (err) {
                if (!controller.signal.aborted) {
                    logger.error('Global search failed:', err);
                }
            } finally {
                if (!controller.signal.aborted) setIsSearching(false);
            }
        }, 300);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [query, open, hasModule, userSpecializedModule, recentScope]);

    // Group + filter
    const filteredResults = useMemo(() => {
        if (activeFilter === 'all') return results;
        const cfg = MODULE_CONFIG.find((m) => m.code === activeFilter);
        if (!cfg) return results;
        // Match either by item.module (preferred — set from originModule for products)
        // or by type (for items where module isn't disambiguated).
        return results.filter((r) => {
            if (r.module) return r.module === cfg.code;
            return cfg.types.includes(r.type);
        });
    }, [results, activeFilter]);

    const groupedResults = useMemo(() => {
        const groups: Record<string, SearchResultItem[]> = {};
        for (const item of filteredResults) {
            const moduleCode = item.module || TYPE_META[item.type].module;
            if (!groups[moduleCode]) groups[moduleCode] = [];
            groups[moduleCode].push(item);
        }
        return groups;
    }, [filteredResults]);

    const flatList = useMemo(
        () => Object.values(groupedResults).flat(),
        [groupedResults]
    );

    const totalCount = filteredResults.length;
    const allCounts = useMemo(() => {
        const counts: Record<string, number> = { all: results.length };
        for (const cfg of availableModules) {
            counts[cfg.code] = results.filter((r) => {
                if (r.module) return r.module === cfg.code;
                return cfg.types.includes(r.type);
            }).length;
        }
        return counts;
    }, [results, availableModules]);

    const handleSelect = useCallback(
        (item: SearchResultItem) => {
            saveRecent(recentScope, query.trim());
            setRecent(loadRecent(recentScope));
            setOpen(false);
            setQuery('');
            navigate(item.href);
        },
        [navigate, query, recentScope]
    );

    // Keyboard navigation within results
    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!open) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, Math.max(0, flatList.length - 1)));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const item = flatList[activeIndex];
            if (item) handleSelect(item);
        } else if (e.key === 'Escape') {
            setOpen(false);
        }
    };

    const showEmpty = open && query.trim().length === 0;
    const showResults = open && query.trim().length > 0;
    const isMac = typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac');

    // Lock body scroll when mobile modal is open
    useEffect(() => {
        if (typeof document === 'undefined') return;
        if (open && window.matchMedia('(max-width: 767px)').matches) {
            const original = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = original; };
        }
    }, [open]);

    // ────────────────────────────────────────────────────────────────────────
    // Body content (shared between desktop dropdown and mobile modal)
    // ────────────────────────────────────────────────────────────────────────
    const dropdownBody = (
        <>
            {/* Multi-empresa header */}
            {company && (
                <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-900/30">
                    <HiOutlineBuildingOffice2 className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-[11px] uppercase tracking-wider font-bold text-slate-600 dark:text-gray-400">
                        Pesquisando em
                    </span>
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-200 truncate">
                        {company.name}
                    </span>
                    {userSpecializedModule && (
                        <span className="ml-auto text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                            {userSpecializedModule.replace('_', ' ')}
                        </span>
                    )}
                </div>
            )}

            {showResults && availableModules.length > 1 && (
                <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-200 dark:border-dark-700 overflow-x-auto scrollbar-thin">
                    <Button variant="ghost"
                        onClick={() => setActiveFilter('all')}
                        className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                            activeFilter === 'all'
                                ? 'bg-primary-600 text-white'
                                : 'bg-slate-100 dark:bg-dark-700 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-dark-600'
                        }`}
                    >
                        Todos
                        {allCounts.all > 0 && <span className="ml-1.5 opacity-75">{allCounts.all}</span>}
                    </Button>
                    {availableModules.map((cfg) => {
                        const count = allCounts[cfg.code] || 0;
                        if (count === 0) return null;
                        const Icon = cfg.icon;
                        return (
                            <Button variant="ghost"
                                key={cfg.code}
                                onClick={() => setActiveFilter(cfg.code)}
                                className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                                    activeFilter === cfg.code
                                        ? 'bg-primary-600 text-white'
                                    : 'bg-slate-100 dark:bg-dark-700 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-dark-600'
                                }`}
                            >
                                <Icon className="w-3 h-3" />
                                {cfg.label}
                                <span className="opacity-75">{count}</span>
                            </Button>
                        );
                    })}
                </div>
            )}

            <div className="flex-1 overflow-y-auto">
                {showEmpty && (
                    <div className="py-2">
                        {recent.length > 0 ? (
                            <>
                                <div className="flex items-center justify-between px-4 py-2">
                                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        <HiOutlineClock className="w-3 h-3" />
                                        Pesquisas Recentes
                                    </div>
                                    <Button variant="ghost"
                                        onClick={() => {
                                            clearRecent(recentScope);
                                            setRecent([]);
                                        }}
                                        className="text-[11px] text-gray-400 hover:text-red-500"
                                    >
                                        Limpar
                                    </Button>
                                </div>
                                {recent.map((q, i) => (
                                    <Button variant="ghost"
                                        key={i}
                                        onClick={() => {
                                            setQuery(q);
                                            inputRef.current?.focus();
                                        }}
                                        className="w-full px-4 py-2 flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-dark-700/50 text-left text-sm text-gray-700 dark:text-gray-200"
                                    >
                                        <HiOutlineMagnifyingGlass className="w-3.5 h-3.5 text-gray-400" />
                                        {q}
                                    </Button>
                                ))}
                            </>
                        ) : (
                            <div className="px-4 py-6 text-center">
                                <HiOutlineMagnifyingGlass className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                                    Comece a pesquisar
                                </p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                    Produtos, clientes, facturas, encomendas e mais
                                </p>
                            </div>
                        )}

                        {availableModules.length > 0 && (
                            <div className="px-4 py-3 border-t border-gray-100 dark:border-dark-700 mt-2">
                                <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                    Acesso Rápido
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                    {availableModules.slice(0, 6).map((cfg) => {
                                        const Icon = cfg.icon;
                                        return (
                                            <Button variant="ghost"
                                                key={cfg.code}
                                                onClick={() => {
                                                    setOpen(false);
                                                    setQuery('');
                                                    navigate(cfg.landing);
                                                }}
                                                className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors"
                                                title={`Abrir ${cfg.label}`}
                                            >
                                                <Icon className={`w-4 h-4 ${cfg.accent}`} />
                                                <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300 text-center leading-tight">
                                                    {cfg.label}
                                                </span>
                                            </Button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {showResults && isSearching && results.length === 0 && (
                    <div className="px-4 py-8 text-center">
                        <div className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <span className="w-3 h-3 rounded-full bg-primary-500 animate-pulse" />
                            Pesquisando...
                        </div>
                    </div>
                )}

                {showResults && !isSearching && totalCount === 0 && (
                    <div className="px-4 py-8 text-center">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                            Nenhum resultado para <span className="text-primary-600">"{query}"</span>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Tente outra palavra-chave ou verifique a ortografia
                        </p>
                    </div>
                )}

                {showResults && totalCount > 0 && (
                    <div className="py-1">
                        {Object.entries(groupedResults).map(([moduleCode, items]) => {
                            const cfg = MODULE_CONFIG.find((m) => m.code === moduleCode);
                            const Icon = cfg?.icon || HiCube;
                            return (
                                <div key={moduleCode}>
                                    <div className="flex items-center justify-between px-4 py-1.5 bg-gray-50/60 dark:bg-dark-900/30">
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                            <Icon className={`w-3 h-3 ${cfg?.accent || ''}`} />
                                            {cfg?.label || moduleCode}
                                        </div>
                                        <span className="text-[10px] font-semibold text-gray-400">
                                            {items.length}
                                        </span>
                                    </div>
                                    {items.map((item) => {
                                        const flatIdx = flatList.indexOf(item);
                                        const isActive = flatIdx === activeIndex;
                                        const meta = TYPE_META[item.type];
                                        const moduleStyle = MODULE_CONFIG.find(
                                            (m) => m.code === (item.module || meta.module)
                                        );
                                        return (
                                            <Button variant="ghost"
                                                key={`${item.type}-${item.id}`}
                                                onMouseEnter={() => setActiveIndex(flatIdx)}
                                                onClick={() => handleSelect(item)}
                                                className={`w-full px-4 py-2 flex items-center gap-3 group transition-colors border-l-2 text-left ${
                                                    isActive
                                                        ? 'bg-primary-50 dark:bg-primary-900/10 border-primary-500'
                                                        : 'border-transparent hover:bg-gray-50 dark:hover:bg-dark-700/50'
                                                }`}
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <span
                                                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-tight ${
                                                                moduleStyle?.badgeBg || 'bg-gray-100 dark:bg-dark-700'
                                                            } ${moduleStyle?.badgeText || 'text-gray-600'}`}
                                                        >
                                                            {meta.label}
                                                        </span>
                                                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                            {highlight(item.title, query)}
                                                        </p>
                                                    </div>
                                                    {item.subtitle && (
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate pl-0.5">
                                                            {highlight(item.subtitle, query)}
                                                        </p>
                                                    )}
                                                </div>
                                                <HiOutlineArrowRight
                                                    className={`w-4 h-4 transition-transform ${
                                                        isActive
                                                            ? 'text-primary-500 translate-x-0.5'
                                                            : 'text-gray-300 group-hover:text-primary-500'
                                                    }`}
                                                />
                                            </Button>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 dark:border-dark-700 bg-gray-50/60 dark:bg-dark-900/30 text-[10px] text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded text-[10px] font-bold">↑↓</kbd>
                        navegar
                    </span>
                    <span className="inline-flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded text-[10px] font-bold">↵</kbd>
                        abrir
                    </span>
                    <span className="inline-flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded text-[10px] font-bold">Esc</kbd>
                        fechar
                    </span>
                </div>
                <div className="hidden sm:flex items-center gap-1">
                    <HiCommandLine className="w-3 h-3" />
                    Pesquisa Global
                </div>
            </div>
        </>
    );

    return (
        <div ref={containerRef} className="relative flex-1 max-w-md">
            {/* Mobile trigger button (visible < md) */}
            <Button variant="ghost"
                onClick={() => {
                    setOpen(true);
                    setTimeout(() => inputRef.current?.focus(), 0);
                }}
                className="md:hidden p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-700 text-slate-600 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors"
                title={t('common.search')}
            >
                <HiOutlineMagnifyingGlass className="w-5 h-5" />
            </Button>

            {/* Desktop inline input (md+) */}
            <div className="hidden md:block relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <HiOutlineMagnifyingGlass
                        className={`w-4 h-4 ${isSearching ? 'text-primary-500 animate-pulse' : 'text-slate-500'}`}
                    />
                </div>
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={onKeyDown}
                    placeholder={`${t('common.search')} em ${company?.name || 'todos os módulos'}...`}
                    className="w-full pl-10 pr-20 py-2.5 bg-white dark:bg-dark-800/50 border border-slate-300 dark:border-dark-700 rounded-xl text-sm text-slate-950 dark:text-gray-100 placeholder-slate-500 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 focus:bg-white dark:focus:bg-dark-800 transition-all shadow-sm"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-2">
                    {query && (
                        <Button variant="ghost"
                            onClick={() => {
                                setQuery('');
                                inputRef.current?.focus();
                            }}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-700 text-slate-500 transition-colors"
                            title="Limpar"
                        >
                            <HiOutlineXMark className="w-3.5 h-3.5" />
                        </Button>
                    )}
                    <kbd className="hidden lg:inline-flex items-center gap-1 px-2 py-1 text-[10px] font-black text-slate-600 dark:text-gray-400 bg-white dark:bg-dark-700 border border-slate-300 dark:border-dark-600 rounded-lg shadow-sm">
                        <span className="text-[12px]">{isMac ? '⌘' : 'Ctrl'}</span>
                        <span>K</span>
                    </kbd>
                </div>
            </div>

            {/* Desktop dropdown (md+ only) */}
            {(showEmpty || showResults) && (
                <div className="hidden md:flex absolute top-full left-0 right-0 mt-2 bg-white dark:bg-dark-800 rounded-xl shadow-card-hover border border-slate-300/70 dark:border-dark-700 overflow-hidden animate-slide-up flex-col max-h-[70vh] z-50">
                    {dropdownBody}
                </div>
            )}

            {/* Mobile full-screen modal (< md) */}
            {open && (
                <div className="md:hidden fixed inset-0 z-[100] bg-white dark:bg-dark-800 flex flex-col">
                    <div className="flex items-center gap-2 p-3 border-b border-gray-200 dark:border-dark-700">
                        <Button variant="ghost"
                            onClick={() => {
                                setOpen(false);
                                setQuery('');
                            }}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-500"
                            title="Fechar"
                        >
                            <HiOutlineXMark className="w-5 h-5" />
                        </Button>
                        <div className="relative flex-1">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <HiOutlineMagnifyingGlass
                                    className={`w-4 h-4 ${isSearching ? 'text-primary-500 animate-pulse' : 'text-gray-400'}`}
                                />
                            </div>
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={onKeyDown}
                                placeholder={`${t('common.search')}...`}
                                autoFocus
                                className="w-full pl-10 pr-3 py-2 bg-gray-100 dark:bg-dark-700 border border-transparent rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-hidden flex flex-col">
                        {dropdownBody}
                    </div>
                </div>
            )}

        </div>
    );
}
