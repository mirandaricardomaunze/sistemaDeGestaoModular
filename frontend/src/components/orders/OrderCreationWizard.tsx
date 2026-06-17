import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    HiOutlineUser,
    HiOutlineShoppingCart,
    HiOutlineDocumentText,
    HiOutlineCheck,
    HiOutlinePlus,
    HiOutlineTrash,
    HiOutlineMagnifyingGlass,
    HiOutlineExclamationTriangle,
} from 'react-icons/hi2';
import { Button, Card, Input, Select, Modal } from '../ui';
import { useProducts } from '../../hooks/useData';
import { useStore } from '../../stores/useStore';
import { formatCurrency, cn } from '../../utils/helpers';
import type { Product } from '../../types';
import { isDecimalUnit, unitDecimals, unitAbbrev } from '../../constants/unitOfMeasure';
import toast from 'react-hot-toast';

// Customer Schema
const customerSchema = z.object({
    name: z.string().min(2, 'Nome é obrigatório'),
    phone: z.string().min(9, 'Telefone inválido'),
    email: z.string().email('Email inválido').optional().or(z.literal('')),
    address: z.string().optional(),
});

type CustomerFormData = z.infer<typeof customerSchema>;

// Order Details Schema
const detailsSchema = z.object({
    deliveryDate: z.string().min(1, 'Data de entrega é obrigatória'),
    priority: z.enum(['low', 'normal', 'high', 'urgent']),
    notes: z.string().optional(),
    paymentMethod: z.enum(['cash', 'card', 'pix', 'invoice']),
});

type DetailsFormData = z.infer<typeof detailsSchema>;

interface OrderItem {
    product: Product;
    quantity: number;
    unitMode: 'box' | 'unit';
    packSize: number;
    unitPrice: number;
}

interface OrderCreationWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: (order: {
        customer: CustomerFormData;
        items: OrderItem[];
        details: DetailsFormData;
        subtotal: number;
        taxAmount: number;
        total: number;
    }) => void;
    originModule?: string;
}

const STEPS = [
    { id: 1, title: 'Cliente', icon: HiOutlineUser },
    { id: 2, title: 'Produtos', icon: HiOutlineShoppingCart },
    { id: 3, title: 'Detalhes', icon: HiOutlineDocumentText },
    { id: 4, title: 'Confirmação', icon: HiOutlineCheck },
];

const priorityOptions = [
    { value: 'low', label: 'Baixa' },
    { value: 'normal', label: 'Normal' },
    { value: 'high', label: 'Alta' },
    { value: 'urgent', label: 'Urgente' },
];

const paymentOptions = [
    { value: 'cash', label: 'Dinheiro' },
    { value: 'card', label: 'Cartão' },
    { value: 'pix', label: 'PIX' },
    { value: 'invoice', label: 'Faturado' },
];

export default function OrderCreationWizard({ isOpen, onClose, onComplete, originModule }: OrderCreationWizardProps) {
    // Load full catalogue once (client-side search). Pass originModule so the
    // backend returns module-specific products (e.g. commercial) + shared inventory.
    const { products: productsData } = useProducts({ limit: 2000, originModule });
    const products = useMemo(() => Array.isArray(productsData) ? productsData : [], [productsData]);
    const { companySettings } = useStore();
    const ivaRate = (companySettings?.ivaRate ?? 16) / 100;

    const [currentStep, setCurrentStep] = useState(1);
    const [customerData, setCustomerData] = useState<CustomerFormData | null>(null);
    const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
    const [detailsData, setDetailsData] = useState<DetailsFormData | null>(null);

    // Product search state
    const [productSearch, setProductSearch] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [defaultMode, setDefaultMode] = useState<'box' | 'unit'>('unit');

    // Customer form
    const {
        register: registerCustomer,
        handleSubmit: handleSubmitCustomer,
        reset: resetCustomer,
        formState: { errors: customerErrors },
    } = useForm<CustomerFormData>({
        resolver: zodResolver(customerSchema) as never,
    });

    // Details form
    const {
        register: registerDetails,
        handleSubmit: handleSubmitDetails,
        formState: { errors: detailsErrors },
    } = useForm<DetailsFormData>({
        resolver: zodResolver(detailsSchema) as never,
        defaultValues: {
            priority: 'normal',
            paymentMethod: 'cash',
            deliveryDate: new Date().toISOString().split('T')[0],
        },
    });

    // Filtered products based on search
    const filteredProducts = useMemo(() => {
        if (!productSearch) return products.slice(0, 10);
        return products.filter(
            (p) =>
                p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                p.code.toLowerCase().includes(productSearch.toLowerCase())
        ).slice(0, 10);
    }, [products, productSearch]);

    // ── Box/Unit pricing helpers ─────────────────────────────────────────────
    // product.price = preço DA CAIXA. Stock está sempre em UNIDADES.
    // Linha em modo 'unit': unitPrice = price/packSize, 1 quantity = 1 unidade.
    // Linha em modo 'box':  unitPrice = price,          1 quantity = packSize unidades.
    const priceFor = (product: Product, mode: 'box' | 'unit') => {
        const boxPrice = Number(product.price) || 0;
        const packSize = Number(product.packSize) || 1;
        return mode === 'box' ? boxPrice : boxPrice / packSize;
    };

    const lineSubtotal = (item: OrderItem) => item.unitPrice * item.quantity;
    const unitsConsumed = (item: OrderItem) =>
        item.quantity * (item.unitMode === 'box' ? item.packSize : 1);

    // Calculate totals (subtotal sem IVA, IVA e total com IVA)
    const { subtotal, taxAmount, total } = useMemo(() => {
        const sub = orderItems.reduce((sum, item) => sum + lineSubtotal(item), 0);
        const tax = sub * ivaRate;
        return {
            subtotal: Math.round(sub * 100) / 100,
            taxAmount: Math.round(tax * 100) / 100,
            total: Math.round((sub + tax) * 100) / 100,
        };
    }, [orderItems, ivaRate]);

    // Step 1: Customer
    const onSubmitCustomer = (data: CustomerFormData) => {
        setCustomerData(data);
        setCurrentStep(2);
    };

    // Step 2: Add product
    const handleAddProduct = () => {
        if (!selectedProduct) return;

        const packSize = Number(selectedProduct.packSize) || 1;
        const existingIndex = orderItems.findIndex(
            (item) => item.product.id === selectedProduct.id
        );
        const existing = existingIndex >= 0 ? orderItems[existingIndex] : null;
        const effectiveMode = existing?.unitMode ?? defaultMode;
        const factor = effectiveMode === 'box' ? (existing?.packSize ?? packSize) : 1;

        const newQty = (existing?.quantity ?? 0) + quantity;
        const totalUnits = newQty * factor;

        if (selectedProduct.currentStock < totalUnits) {
            toast.error(`Stock insuficiente! Disponível: ${selectedProduct.currentStock} un.`);
            return;
        }

        if (existing) {
            const newItems = [...orderItems];
            newItems[existingIndex] = { ...existing, quantity: newQty };
            setOrderItems(newItems);
        } else {
            setOrderItems([...orderItems, {
                product: selectedProduct,
                quantity,
                unitMode: defaultMode,
                packSize,
                unitPrice: priceFor(selectedProduct, defaultMode),
            }]);
        }

        setSelectedProduct(null);
        setQuantity(1);
        setProductSearch('');
        toast.success('Produto adicionado!');
    };

    // Remove product
    const handleRemoveProduct = (index: number) => {
        setOrderItems(orderItems.filter((_, i) => i !== index));
    };

    // Update quantity (in current mode units — box or unit)
    const handleUpdateQuantity = (index: number, newQty: number) => {
        const item = orderItems[index];
        // Permite decimais para unidades pesáveis (kg, L) — o mínimo é o
        // step da unidade. Para unidades inteiras, mantém o ≥ 1 original.
        const unit = item.product.unit || 'un';
        const minQty = isDecimalUnit(unit) ? 1 / 10 ** unitDecimals(unit) : 1;
        if (!Number.isFinite(newQty) || newQty < minQty) return;
        const factor = item.unitMode === 'box' ? item.packSize : 1;
        const totalUnits = newQty * factor;
        if (totalUnits > item.product.currentStock) {
            toast.error(`Stock máximo: ${item.product.currentStock} un.`);
            return;
        }
        const newItems = [...orderItems];
        newItems[index] = { ...item, quantity: newQty };
        setOrderItems(newItems);
    };

    // Toggle CX / UN on an existing line
    const handleToggleMode = (index: number) => {
        const item = orderItems[index];
        if ((item.packSize || 1) <= 1) return; // Sem caixa real, ignora
        const newMode: 'box' | 'unit' = item.unitMode === 'box' ? 'unit' : 'box';
        const newItems = [...orderItems];
        newItems[index] = {
            ...item,
            unitMode: newMode,
            unitPrice: priceFor(item.product, newMode),
            // Mantém 1 unidade visível por defeito ao alternar para evitar saltos surpreendentes.
            quantity: 1,
        };
        setOrderItems(newItems);
    };

    // Step 3: Details
    const onSubmitDetails = (data: DetailsFormData) => {
        setDetailsData(data);
        setCurrentStep(4);
    };

    // Step 4: Complete
    const handleComplete = () => {
        if (!customerData || !detailsData || orderItems.length === 0) return;

        onComplete({
            customer: customerData,
            items: orderItems,
            details: detailsData,
            subtotal,
            taxAmount,
            total,
        });

        // Reset wizard
        resetWizard();
    };

    const resetWizard = () => {
        setCurrentStep(1);
        setCustomerData(null);
        setOrderItems([]);
        setDetailsData(null);
        resetCustomer();
        setProductSearch('');
        setSelectedProduct(null);
        onClose();
    };

    const canProceedStep2 = orderItems.length > 0;

    return (
        <Modal isOpen={isOpen} onClose={resetWizard} title="Nova Encomenda" size="xl">
            {/* Step Indicator */}
            <div className="flex items-center justify-between mb-8 px-4">
                {STEPS.map((step, index) => (
                    <div key={step.id} className="flex items-center">
                        <div className="flex flex-col items-center">
                            <div
                                className={`
                                    w-12 h-12 rounded-full flex items-center justify-center transition-all
                                    ${currentStep >= step.id
                                        ? 'bg-primary-600 text-white'
                                        : 'bg-gray-200 dark:bg-dark-600 text-gray-500'
                                    }
                                    ${currentStep === step.id && 'ring-4 ring-primary-200 dark:ring-primary-900/50'}
                                `}
                            >
                                <step.icon className="w-6 h-6" />
                            </div>
                            <span className={`
                                text-xs mt-2 font-medium
                                ${currentStep >= step.id ? 'text-primary-600' : 'text-gray-500'}
                            `}>
                                {step.title}
                            </span>
                        </div>
                        {index < STEPS.length - 1 && (
                            <div
                                className={`
                                    w-16 h-1 mx-2 rounded
                                    ${currentStep > step.id ? 'bg-primary-600' : 'bg-gray-200 dark:bg-dark-600'}
                                `}
                            />
                        )}
                    </div>
                ))}
            </div>

            {/* Step Content */}
            <div className="min-h-[600px]">
                {/* Step 1: Customer */}
                {currentStep === 1 && (
                    <form onSubmit={handleSubmitCustomer(onSubmitCustomer as never)} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Nome do Cliente *"
                                {...registerCustomer('name')}
                                error={customerErrors.name?.message}
                            />
                            <Input
                                label="Telefone *"
                                {...registerCustomer('phone')}
                                error={customerErrors.phone?.message}
                                placeholder="+258 84 000 0000"
                            />
                        </div>
                        <Input
                            label="Email"
                            type="email"
                            {...registerCustomer('email')}
                            error={customerErrors.email?.message}
                        />
                        <Input
                            label="Endereço de Entrega"
                            {...registerCustomer('address')}
                        />
                        <div className="flex justify-end pt-4">
                            <Button type="submit">
                                Próximo
                            </Button>
                        </div>
                    </form>
                )}

                {/* Step 2: Products */}
                {currentStep === 2 && (
                    <div className="space-y-4">
                        {/* Product Search */}
                        <Card padding="md" className="overflow-visible z-20">
                            <div className="flex gap-4 items-end relative z-20">
                                <div className="flex-1 relative z-20">
                                    <Input
                                        label="Buscar Produto"
                                        leftIcon={<HiOutlineMagnifyingGlass className="w-5 h-5" />}
                                        value={productSearch}
                                        onChange={(e) => setProductSearch(e.target.value)}
                                        placeholder="Digite nome ou código..."
                                    />
                                    {productSearch && (
                                        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-lg shadow-xl max-h-72 overflow-y-auto divide-y divide-gray-100 dark:divide-dark-700">
                                            {filteredProducts.length === 0 ? (
                                                <div className="px-4 py-6 text-center text-xs text-gray-500">
                                                    Nenhum produto encontrado para "{productSearch}"
                                                </div>
                                            ) : filteredProducts.map((product) => {
                                                const ps = Number(product.packSize) || 1;
                                                const unitP = priceFor(product, 'unit');
                                                const boxP = priceFor(product, 'box');
                                                const stockLow = product.currentStock <= 5;
                                                return (
                                                    <button
                                                        key={product.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedProduct(product);
                                                            setProductSearch('');
                                                        }}
                                                        className="w-full px-4 py-3 text-left hover:bg-primary-50/50 dark:hover:bg-primary-900/10 flex justify-between items-start gap-3 transition-colors outline-none focus:bg-primary-50/50 dark:focus:bg-primary-900/10"
                                                    >
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                                                {product.name}
                                                            </p>
                                                            <p className="text-[10px] font-mono text-gray-400 mt-0.5">
                                                                {product.barcode || product.code}
                                                            </p>
                                                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                                                <span className="inline-flex items-baseline gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200/60 dark:border-blue-500/20">
                                                                    <span className="text-xs font-black text-blue-700 dark:text-blue-300 tabular-nums">{formatCurrency(unitP)}</span>
                                                                    <span className="text-[9px] font-black text-blue-500/70 dark:text-blue-400/70 uppercase tracking-widest">por unidade</span>
                                                                </span>
                                                                {ps > 1 && (
                                                                    <span className="inline-flex items-baseline gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/60 dark:border-emerald-500/20">
                                                                        <span className="text-xs font-black text-emerald-700 dark:text-emerald-300 tabular-nums">{formatCurrency(boxP)}</span>
                                                                        <span className="text-[9px] font-black text-emerald-500/70 dark:text-emerald-400/70 uppercase tracking-widest">por caixa</span>
                                                                        <span className="text-[9px] font-bold text-emerald-600/60 dark:text-emerald-400/60">({ps} unidades)</span>
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="text-right flex-shrink-0">
                                                            <span className={cn(
                                                                "inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest",
                                                                stockLow
                                                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                                                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                                            )}>
                                                                {product.currentStock} un.
                                                            </span>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                                <div className="w-32">
                                    <label className="block text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-2">
                                        Modo
                                    </label>
                                    <div className="flex h-12 rounded-xl border border-slate-300 dark:border-dark-700 bg-white dark:bg-dark-800 p-1">
                                        {(['unit', 'box'] as const).map(m => (
                                            <Button
                                                key={m}
                                                type="button"
                                                variant="ghost"
                                                onClick={() => setDefaultMode(m)}
                                                className={cn(
                                                    'flex-1 h-full rounded-lg text-[10px] font-black uppercase tracking-widest focus:ring-0',
                                                    defaultMode === m
                                                        ? 'bg-primary-600 text-white shadow-sm'
                                                        : 'text-slate-500 hover:text-primary-600'
                                                )}
                                            >
                                                {m === 'unit' ? 'UN' : 'CX'}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                                <div className="w-24">
                                    {(() => {
                                        // Picker quantity input — respeita a unidade do
                                        // produto seleccionado: 0.001 para kg/L, 1 para
                                        // unidade/caixa. Sem produto seleccionado, fica
                                        // em integer (não-destrutivo).
                                        const unit = selectedProduct?.unit || 'un';
                                        const weighable = isDecimalUnit(unit);
                                        const step = weighable ? 1 / 10 ** unitDecimals(unit) : 1;
                                        const minQty = weighable ? step : 1;
                                        return (
                                            <Input
                                                label={weighable ? `Qtd (${unitAbbrev(unit)})` : 'Qtd'}
                                                type="number"
                                                min={minQty}
                                                step={step}
                                                value={quantity}
                                                onChange={(e) => {
                                                    const raw = weighable
                                                        ? parseFloat(e.target.value)
                                                        : parseInt(e.target.value);
                                                    setQuantity(Number.isFinite(raw) && raw > 0 ? raw : minQty);
                                                }}
                                            />
                                        );
                                    })()}
                                </div>
                                <Button
                                    onClick={handleAddProduct}
                                    disabled={!selectedProduct}
                                >
                                    <HiOutlinePlus className="w-5 h-5" />
                                </Button>
                            </div>
                            {selectedProduct && (() => {
                                const ps = Number(selectedProduct.packSize) || 1;
                                const unitP = priceFor(selectedProduct, 'unit');
                                const boxP = priceFor(selectedProduct, 'box');
                                return (
                                    <div className="mt-3 p-3 bg-gradient-to-r from-primary-50 to-transparent dark:from-primary-900/20 dark:to-transparent border border-primary-200/50 dark:border-primary-500/20 rounded-lg flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                                {selectedProduct.name}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                                <span className="inline-flex items-baseline gap-1.5 px-2.5 py-1 rounded-md bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-500/30">
                                                    <span className="text-xs font-black text-blue-700 dark:text-blue-300 tabular-nums">{formatCurrency(unitP)}</span>
                                                    <span className="text-[9px] font-black text-blue-500/70 dark:text-blue-400/70 uppercase tracking-widest">por unidade</span>
                                                </span>
                                                {ps > 1 && (
                                                    <span className="inline-flex items-baseline gap-1.5 px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-500/30">
                                                        <span className="text-xs font-black text-emerald-700 dark:text-emerald-300 tabular-nums">{formatCurrency(boxP)}</span>
                                                        <span className="text-[9px] font-black text-emerald-500/70 dark:text-emerald-400/70 uppercase tracking-widest">por caixa</span>
                                                        <span className="text-[9px] font-bold text-emerald-600/60 dark:text-emerald-400/60">({ps} unidades)</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {selectedProduct.currentStock <= 5 && (
                                            <span className="text-yellow-600 dark:text-yellow-400 text-[11px] font-bold flex items-center gap-1 flex-shrink-0 mt-0.5">
                                                <HiOutlineExclamationTriangle className="w-4 h-4" />
                                                {selectedProduct.currentStock} un.
                                            </span>
                                        )}
                                    </div>
                                );
                            })()}
                        </Card>

                        {/* Products Table */}
                        <div className="border border-gray-200 dark:border-dark-600 rounded-lg overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-dark-700">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-300">
                                            Produto
                                        </th>
                                        <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-300 w-20">
                                            Modo
                                        </th>
                                        <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-300 w-32">
                                            Qtd
                                        </th>
                                        <th className="px-3 py-3 text-right text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-300 w-28">
                                            Preço
                                        </th>
                                        <th className="px-3 py-3 text-right text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-300 w-28">
                                            Subtotal
                                        </th>
                                        <th className="w-14"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-dark-600">
                                    {orderItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-10 text-center text-gray-500 text-sm">
                                                Nenhum produto adicionado
                                            </td>
                                        </tr>
                                    ) : (
                                        orderItems.map((item, index) => {
                                            const canToggle = (item.packSize || 1) > 1;
                                            return (
                                                <tr key={item.product.id} className="hover:bg-gray-50/50 dark:hover:bg-dark-700/50">
                                                    <td className="px-4 py-3">
                                                        <p className="font-semibold text-sm text-gray-900 dark:text-white">
                                                            {item.product.name}
                                                        </p>
                                                        <p className="text-[11px] text-gray-500 font-mono">
                                                            {item.product.barcode || item.product.code} · {unitsConsumed(item)} un.
                                                        </p>
                                                    </td>
                                                    <td className="px-3 py-3 text-center">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            onClick={() => handleToggleMode(index)}
                                                            disabled={!canToggle}
                                                            className={cn(
                                                                'h-7 px-2.5 rounded-md text-[10px] font-black uppercase tracking-widest focus:ring-0',
                                                                item.unitMode === 'box'
                                                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                                                    : 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
                                                                !canToggle && 'opacity-50 cursor-not-allowed'
                                                            )}
                                                            title={canToggle ? `Alternar para ${item.unitMode === 'box' ? 'UN' : 'CX'}` : 'Sem caixa definida'}
                                                        >
                                                            {item.unitMode === 'box' ? `CX×${item.packSize}` : 'UN'}
                                                        </Button>
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                onClick={() => handleUpdateQuantity(index, item.quantity - 1)}
                                                                className="w-7 h-7 rounded-md bg-gray-100 dark:bg-dark-600 hover:bg-gray-200 dark:hover:bg-dark-500 focus:ring-0 p-0"
                                                            >
                                                                −
                                                            </Button>
                                                            {(() => {
                                                                // Per-row quantity edit — respeita unit do
                                                                // produto desta linha (kg/L permitem decimais).
                                                                const unit = item.product.unit || 'un';
                                                                const weighable = isDecimalUnit(unit);
                                                                const step = weighable ? 1 / 10 ** unitDecimals(unit) : 1;
                                                                const minQty = weighable ? step : 1;
                                                                return (
                                                                    <input
                                                                        type="number"
                                                                        min={minQty}
                                                                        step={step}
                                                                        value={item.quantity}
                                                                        onChange={(e) => {
                                                                            const raw = weighable
                                                                                ? parseFloat(e.target.value)
                                                                                : parseInt(e.target.value);
                                                                            handleUpdateQuantity(index, Number.isFinite(raw) && raw > 0 ? raw : minQty);
                                                                        }}
                                                                        className={cn(
                                                                            "h-7 text-center text-sm font-bold rounded-md border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500/30",
                                                                            weighable ? "w-16" : "w-12"
                                                                        )}
                                                                    />
                                                                );
                                                            })()}
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                onClick={() => handleUpdateQuantity(index, item.quantity + 1)}
                                                                className="w-7 h-7 rounded-md bg-gray-100 dark:bg-dark-600 hover:bg-gray-200 dark:hover:bg-dark-500 focus:ring-0 p-0"
                                                            >
                                                                +
                                                            </Button>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 text-right">
                                                        <p className="text-sm text-gray-900 dark:text-white">
                                                            {formatCurrency(item.unitPrice)}
                                                        </p>
                                                        <p className="text-[10px] text-gray-400 font-bold uppercase">
                                                            /{item.unitMode === 'box' ? 'cx' : 'un'}
                                                        </p>
                                                    </td>
                                                    <td className="px-3 py-3 text-right font-bold text-sm text-gray-900 dark:text-white">
                                                        {formatCurrency(lineSubtotal(item))}
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <Button variant="ghost"
                                                            type="button"
                                                            onClick={() => handleRemoveProduct(index)}
                                                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md focus:ring-0"
                                                        >
                                                            <HiOutlineTrash className="w-4 h-4" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>

                            {/* Financial Summary */}
                            {orderItems.length > 0 && (
                                <div className="bg-gray-50 dark:bg-dark-700 px-4 py-3 border-t border-gray-200 dark:border-dark-600">
                                    <div className="flex justify-end">
                                        <div className="w-72 space-y-1.5">
                                            <div className="flex justify-between text-xs">
                                                <span className="font-bold text-gray-500 uppercase tracking-widest">Subtotal (s/IVA)</span>
                                                <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(subtotal)}</span>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <span className="font-bold text-gray-500 uppercase tracking-widest">IVA ({(ivaRate * 100).toFixed(0)}%)</span>
                                                <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(taxAmount)}</span>
                                            </div>
                                            <div className="flex justify-between items-center pt-2 border-t border-gray-300 dark:border-dark-500">
                                                <span className="font-black text-sm text-gray-900 dark:text-white uppercase tracking-tighter">Total c/IVA</span>
                                                <span className="font-black text-xl text-primary-600">{formatCurrency(total)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-between pt-4">
                            <Button variant="ghost" onClick={() => setCurrentStep(1)}>
                                Voltar
                            </Button>
                            <Button onClick={() => setCurrentStep(3)} disabled={!canProceedStep2}>
                                Próximo
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 3: Details */}
                {currentStep === 3 && (
                    <form onSubmit={handleSubmitDetails(onSubmitDetails as never)} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Data de Entrega *"
                                type="date"
                                {...registerDetails('deliveryDate')}
                                error={detailsErrors.deliveryDate?.message}
                            />
                            <Select
                                label="Prioridade"
                                options={priorityOptions}
                                {...registerDetails('priority')}
                            />
                        </div>
                        <Select
                            label="Forma de Pagamento"
                            options={paymentOptions}
                            {...registerDetails('paymentMethod')}
                        />
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                Observações
                            </label>
                            <textarea
                                className="input min-h-[100px]"
                                {...registerDetails('notes')}
                                placeholder="Instruções especiais, detalhes de entrega..."
                            />
                        </div>
                        <div className="flex justify-between pt-4">
                            <Button variant="ghost" onClick={() => setCurrentStep(2)}>
                                Voltar
                            </Button>
                            <Button type="submit">
                                Próximo
                            </Button>
                        </div>
                    </form>
                )}

                {/* Step 4: Confirmation */}
                {currentStep === 4 && (
                    <div className="space-y-6">
                        {/* Customer Summary */}
                        <Card padding="md">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                                Cliente
                            </h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-gray-500">Nome:</span>
                                    <span className="ml-2 font-medium text-gray-900 dark:text-white">
                                        {customerData?.name}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-gray-500">Telefone:</span>
                                    <span className="ml-2 font-medium text-gray-900 dark:text-white">
                                        {customerData?.phone}
                                    </span>
                                </div>
                                {customerData?.email && (
                                    <div>
                                        <span className="text-gray-500">Email:</span>
                                        <span className="ml-2 font-medium text-gray-900 dark:text-white">
                                            {customerData.email}
                                        </span>
                                    </div>
                                )}
                                {customerData?.address && (
                                    <div className="col-span-2">
                                        <span className="text-gray-500">Endereço:</span>
                                        <span className="ml-2 font-medium text-gray-900 dark:text-white">
                                            {customerData.address}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* Items Summary */}
                        <Card padding="md">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                                Produtos ({orderItems.length})
                            </h3>
                            <div className="space-y-2">
                                {orderItems.map((item) => (
                                    <div key={item.product.id} className="flex justify-between text-sm">
                                        <span className="text-gray-600 dark:text-gray-300">
                                            {item.quantity}{item.unitMode === 'box' ? `cx (${unitsConsumed(item)}un)` : 'un'} × {item.product.name}
                                        </span>
                                        <span className="font-medium text-gray-900 dark:text-white">
                                            {formatCurrency(lineSubtotal(item))}
                                        </span>
                                    </div>
                                ))}
                                <div className="border-t border-gray-200 dark:border-dark-600 pt-2 mt-2 space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="font-bold text-gray-500 uppercase tracking-widest">Subtotal (s/IVA)</span>
                                        <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(subtotal)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="font-bold text-gray-500 uppercase tracking-widest">IVA ({(ivaRate * 100).toFixed(0)}%)</span>
                                        <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(taxAmount)}</span>
                                    </div>
                                    <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-dark-600">
                                        <span className="font-black text-sm text-gray-900 dark:text-white uppercase">Total c/IVA</span>
                                        <span className="font-black text-lg text-primary-600">{formatCurrency(total)}</span>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* Details Summary */}
                        <Card padding="md">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                                Detalhes da Entrega
                            </h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-gray-500">Data:</span>
                                    <span className="ml-2 font-medium text-gray-900 dark:text-white">
                                        {detailsData?.deliveryDate}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-gray-500">Prioridade:</span>
                                    <span className={`ml-2 font-medium ${detailsData?.priority === 'urgent' ? 'text-red-600' :
                                        detailsData?.priority === 'high' ? 'text-orange-600' :
                                            'text-gray-900 dark:text-white'
                                        }`}>
                                        {priorityOptions.find(p => p.value === detailsData?.priority)?.label}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-gray-500">Pagamento:</span>
                                    <span className="ml-2 font-medium text-gray-900 dark:text-white">
                                        {paymentOptions.find(p => p.value === detailsData?.paymentMethod)?.label}
                                    </span>
                                </div>
                            </div>
                            {detailsData?.notes && (
                                <div className="mt-3 p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
                                    <span className="text-sm text-gray-500">Observações:</span>
                                    <p className="text-sm text-gray-900 dark:text-white mt-1">
                                        {detailsData.notes}
                                    </p>
                                </div>
                            )}
                        </Card>

                        <div className="flex justify-between pt-4">
                            <Button variant="ghost" onClick={() => setCurrentStep(3)}>
                                Voltar
                            </Button>
                            <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
                                <HiOutlineCheck className="w-5 h-5 mr-2" />
                                Confirmar Encomenda
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}
