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
    HiOutlineSearch,
    HiOutlineExclamation,
} from 'react-icons/hi';
import { Button, Card, Input, Select, Modal } from '../ui';
import { useProducts } from '../../hooks/useData';
import { formatCurrency } from '../../utils/helpers';
import type { Product } from '../../types';
import toast from 'react-hot-toast';

// Customer Schema
const customerSchema = z.object({
    name: z.string().min(2, 'Nome é obrigatório'),
    phone: z.string().min(10, 'Telefone inválido'),
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
}

interface OrderCreationWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: (order: {
        customer: CustomerFormData;
        items: OrderItem[];
        details: DetailsFormData;
        total: number;
    }) => void;
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

export default function OrderCreationWizard({ isOpen, onClose, onComplete }: OrderCreationWizardProps) {
    // Use data hook instead of store
    const { products: productsData } = useProducts();
    const products = Array.isArray(productsData) ? productsData : [];

    const [currentStep, setCurrentStep] = useState(1);
    const [customerData, setCustomerData] = useState<CustomerFormData | null>(null);
    const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
    const [detailsData, setDetailsData] = useState<DetailsFormData | null>(null);

    // Product search state
    const [productSearch, setProductSearch] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [quantity, setQuantity] = useState(1);

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

    // Calculate total
    const total = useMemo(() => {
        return orderItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    }, [orderItems]);

    // Step 1: Customer
    const onSubmitCustomer = (data: CustomerFormData) => {
        setCustomerData(data);
        setCurrentStep(2);
    };

    // Step 2: Add product
    const handleAddProduct = () => {
        if (!selectedProduct) return;

        // Validate stock
        if (selectedProduct.currentStock < quantity) {
            toast.error(`Estoque insuficiente! Disponível: ${selectedProduct.currentStock}`);
            return;
        }

        // Check if product already in list
        const existingIndex = orderItems.findIndex(
            (item) => item.product.id === selectedProduct.id
        );

        if (existingIndex >= 0) {
            const newItems = [...orderItems];
            const newQty = newItems[existingIndex].quantity + quantity;

            if (selectedProduct.currentStock < newQty) {
                toast.error(`Estoque insuficiente! Disponível: ${selectedProduct.currentStock}`);
                return;
            }

            newItems[existingIndex].quantity = newQty;
            setOrderItems(newItems);
        } else {
            setOrderItems([...orderItems, { product: selectedProduct, quantity }]);
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

    // Update quantity
    const handleUpdateQuantity = (index: number, newQty: number) => {
        const item = orderItems[index];
        if (newQty > item.product.currentStock) {
            toast.error(`Estoque máximo: ${item.product.currentStock}`);
            return;
        }
        if (newQty < 1) return;

        const newItems = [...orderItems];
        newItems[index].quantity = newQty;
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
            <div className="min-h-[400px]">
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
                                placeholder="(11) 99999-9999"
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
                        <Card padding="md">
                            <div className="flex gap-4 items-end">
                                <div className="flex-1 relative">
                                    <Input
                                        label="Buscar Produto"
                                        leftIcon={<HiOutlineSearch className="w-5 h-5" />}
                                        value={productSearch}
                                        onChange={(e) => setProductSearch(e.target.value)}
                                        placeholder="Digite nome ou código..."
                                    />
                                    {productSearch && (
                                        <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-xl shadow-lg max-h-60 overflow-auto">
                                            {filteredProducts.map((product) => (
                                                <button
                                                    key={product.id}
                                                    onClick={() => {
                                                        setSelectedProduct(product);
                                                        setProductSearch('');
                                                    }}
                                                    className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-dark-700 flex justify-between items-center"
                                                >
                                                    <div>
                                                        <p className="font-medium text-gray-900 dark:text-white">
                                                            {product.name}
                                                        </p>
                                                        <p className="text-sm text-gray-500">
                                                            Código: {product.code} • Estoque: {product.currentStock}
                                                        </p>
                                                    </div>
                                                    <span className="font-semibold text-primary-600">
                                                        {formatCurrency(product.price)}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="w-24">
                                    <Input
                                        label="Qtd"
                                        type="number"
                                        min={1}
                                        value={quantity}
                                        onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                                    />
                                </div>
                                <Button
                                    onClick={handleAddProduct}
                                    disabled={!selectedProduct}
                                >
                                    <HiOutlinePlus className="w-5 h-5" />
                                </Button>
                            </div>
                            {selectedProduct && (
                                <div className="mt-3 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                                    <p className="text-sm">
                                        Selecionado: <span className="font-semibold">{selectedProduct.name}</span>
                                        {' • '}
                                        {formatCurrency(selectedProduct.price)}
                                        {selectedProduct.currentStock <= 5 && (
                                            <span className="ml-2 text-yellow-600">
                                                <HiOutlineExclamation className="inline w-4 h-4" />
                                                {' '}Estoque baixo: {selectedProduct.currentStock}
                                            </span>
                                        )}
                                    </p>
                                </div>
                            )}
                        </Card>

                        {/* Products Table */}
                        <div className="border border-gray-200 dark:border-dark-600 rounded-xl overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-dark-700">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Produto
                                        </th>
                                        <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Qtd
                                        </th>
                                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Unitário
                                        </th>
                                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Subtotal
                                        </th>
                                        <th className="w-16"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-dark-600">
                                    {orderItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                                Nenhum produto adicionado
                                            </td>
                                        </tr>
                                    ) : (
                                        orderItems.map((item, index) => (
                                            <tr key={item.product.id}>
                                                <td className="px-4 py-3">
                                                    <p className="font-medium text-gray-900 dark:text-white">
                                                        {item.product.name}
                                                    </p>
                                                    <p className="text-sm text-gray-500">{item.product.code}</p>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => handleUpdateQuantity(index, item.quantity - 1)}
                                                            className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-dark-600 hover:bg-gray-200 dark:hover:bg-dark-500"
                                                        >
                                                            -
                                                        </button>
                                                        <span className="w-12 text-center font-medium">
                                                            {item.quantity}
                                                        </span>
                                                        <button
                                                            onClick={() => handleUpdateQuantity(index, item.quantity + 1)}
                                                            className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-dark-600 hover:bg-gray-200 dark:hover:bg-dark-500"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                                                    {formatCurrency(item.product.price)}
                                                </td>
                                                <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                                                    {formatCurrency(item.product.price * item.quantity)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <button
                                                        onClick={() => handleRemoveProduct(index)}
                                                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                                    >
                                                        <HiOutlineTrash className="w-5 h-5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                {orderItems.length > 0 && (
                                    <tfoot className="bg-gray-50 dark:bg-dark-700">
                                        <tr>
                                            <td colSpan={3} className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                                                Total:
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-lg text-primary-600">
                                                {formatCurrency(total)}
                                            </td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
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
                                            {item.quantity}x {item.product.name}
                                        </span>
                                        <span className="font-medium text-gray-900 dark:text-white">
                                            {formatCurrency(item.product.price * item.quantity)}
                                        </span>
                                    </div>
                                ))}
                                <div className="border-t border-gray-200 dark:border-dark-600 pt-2 mt-2 flex justify-between">
                                    <span className="font-semibold text-gray-900 dark:text-white">Total</span>
                                    <span className="font-bold text-lg text-primary-600">
                                        {formatCurrency(total)}
                                    </span>
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
