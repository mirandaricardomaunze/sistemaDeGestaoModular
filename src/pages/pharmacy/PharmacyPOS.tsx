/**
 * Pharmacy POS (Point of Sale)
 * 
 * Professional point of sale system for pharmacy with:
 * - Product search and selection
 * - Shopping cart management
 * - Customer selection
 * - Multiple payment methods
 * - Receipt printing
 * - Real-time stock validation
 */

import { useState, useEffect, useMemo } from 'react';
import { Card, Button, Badge, Input, Select, LoadingSpinner } from '../../components/ui';
import { pharmacyAPI } from '../../services/api';
import { useCustomers } from '../../hooks/useData';
import toast from 'react-hot-toast';
import {
    HiOutlineShoppingCart,
    HiOutlineSearch,
    HiOutlineTrash,
    HiOutlineCheck,
    HiOutlineDocumentDownload,
    HiOutlineRefresh
} from 'react-icons/hi';
import Pagination, { usePagination } from '../../components/ui/Pagination';
import { useStore } from '../../stores/useStore';
import { generatePOSReceipt } from '../../utils/documentGenerator';

interface Medication {
    id: string;
    productId: string;
    dci: string;
    dosage: string;
    pharmaceuticalForm: string;
    requiresPrescription: boolean;
    isControlled: boolean;
    storageTemp: string;
    product: {
        id: string;
        code: string;
        name: string;
        price: number;
        minStock: number;
    };
    batches: any[];
    totalStock: number;
    nearestExpiry: string | null;
    isLowStock: boolean;
    daysToExpiry: number | null;
    alertLevel: 'critical' | 'warning' | 'normal';
}

interface CartItem {
    batchId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    total: number;
    maxQuantity: number;
    posologyLabel?: string;
}

export default function PharmacyPOS() {
    const { companySettings } = useStore();
    const [isLoading, setIsLoading] = useState(true);

    // Medications state
    const [medications, setMedications] = useState<Medication[]>([]);
    const [posSearch, setPosSearch] = useState('');

    // POS / Sales state
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
    const [manualCustomerName, setManualCustomerName] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [lastSale, setLastSale] = useState<any>(null);
    const [discount, setDiscount] = useState(0);

    const { customers } = useCustomers();

    // Filtered medications for POS
    const filteredMedications = useMemo(() => {
        if (!posSearch) return medications.filter(m => m.totalStock > 0);
        return medications.filter(m =>
            m.totalStock > 0 &&
            (m.product.name.toLowerCase().includes(posSearch.toLowerCase()) ||
                m.product.code.toLowerCase().includes(posSearch.toLowerCase()))
        );
    }, [medications, posSearch]);

    // Pagination
    const posPagination = usePagination(filteredMedications, 12);

    // Fetch medications
    const fetchMedications = async () => {
        try {
            setIsLoading(true);
            const data = await pharmacyAPI.getMedications({});
            setMedications(data);
        } catch (error) {
            console.error('Error fetching medications:', error);
            toast.error('Erro ao carregar medicamentos');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchMedications();
    }, []);

    // POS Functions
    const addToCart = (medication: Medication) => {
        if (!medication.batches || medication.batches.length === 0) {
            toast.error('Medicamento sem stock disponível');
            return;
        }

        // Use FEFO (First Expired, First Out)
        const batch = medication.batches[0];
        const existing = cart.find(item => item.batchId === batch.id);

        if (existing) {
            if (existing.quantity >= batch.quantityAvailable) {
                toast.error('Stock máximo atingido');
                return;
            }
            setCart(cart.map(item =>
                item.batchId === batch.id
                    ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unitPrice - item.discount }
                    : item
            ));
        } else {
            setCart([...cart, {
                batchId: batch.id,
                productName: medication.product.name,
                quantity: 1,
                unitPrice: Number(batch.sellingPrice),
                discount: 0,
                total: Number(batch.sellingPrice),
                maxQuantity: batch.quantityAvailable
            }]);
        }
    };

    const updateCartItem = (batchId: string, quantity: number) => {
        if (quantity <= 0) {
            setCart(cart.filter(item => item.batchId !== batchId));
        } else {
            setCart(cart.map(item =>
                item.batchId === batchId
                    ? { ...item, quantity, total: quantity * item.unitPrice - item.discount }
                    : item
            ));
        }
    };

    const removeFromCart = (batchId: string) => {
        setCart(cart.filter(item => item.batchId !== batchId));
    };

    const cartTotal = useMemo(() => {
        const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
        return subtotal - discount;
    }, [cart, discount]);

    const handleCheckout = async () => {
        if (cart.length === 0) {
            toast.error('Adicione produtos ao carrinho');
            return;
        }

        try {
            const customer = customers.find(c => c.id === selectedCustomer);
            const sale = await pharmacyAPI.createSale({
                customerId: selectedCustomer,
                customerName: selectedCustomer ? (customer?.name || 'Cliente Balcão') : (manualCustomerName || 'Cliente Balcão'),
                items: cart.map(item => ({
                    batchId: item.batchId,
                    quantity: item.quantity,
                    discount: item.discount,
                    posologyLabel: item.posologyLabel
                })),
                discount,
                paymentMethod
            });

            // Store last sale for reprint
            setLastSale(sale);

            // Success toast with Print Action
            toast.success(
                (t) => (
                    <div className="flex flex-col gap-2">
                        <span>Venda realizada com sucesso!</span>
                        <button
                            onClick={() => {
                                const companyInfo = {
                                    name: companySettings?.companyName || 'Empresa',
                                    address: companySettings?.address || '',
                                    phone: companySettings?.phone || '',
                                    email: companySettings?.email || '',
                                    taxId: companySettings?.taxId || '',
                                    logo: companySettings?.logo
                                };
                                generatePOSReceipt(sale, companyInfo);
                                toast.dismiss(t.id);
                            }}
                            className="bg-white text-primary-600 px-3 py-1 rounded text-sm font-medium hover:bg-gray-50 border border-primary-200"
                        >
                            Imprimir Recibo
                        </button>
                    </div>
                ),
                { duration: 5000 }
            );

            setCart([]);
            setDiscount(0);
            setSelectedCustomer(null);
            setManualCustomerName('');
            fetchMedications();
        } catch (error: any) {
            toast.error(error.message || 'Erro ao realizar venda');
        }
    };

    const handlePrintLastReceipt = () => {
        if (!lastSale) {
            toast.error('Nenhuma venda recente para imprimir');
            return;
        }

        const companyInfo = {
            name: companySettings?.companyName || 'Empresa',
            address: companySettings?.address || '',
            phone: companySettings?.phone || '',
            email: companySettings?.email || '',
            taxId: companySettings?.taxId || '',
            logo: companySettings?.logo
        };
        generatePOSReceipt(lastSale, companyInfo);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <LoadingSpinner size="xl" />
                <p className="mt-4 text-sm text-gray-400">A carregar ponto de venda...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ponto de Venda - Farmácia</h1>
                    <p className="text-gray-500 dark:text-gray-400">Sistema de vendas para medicamentos</p>
                </div>
                <Button variant="outline" onClick={fetchMedications} leftIcon={<HiOutlineRefresh className="w-4 h-4" />}>
                    Actualizar
                </Button>
            </div>

            {/* POS Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Product List */}
                <div className="lg:col-span-2 space-y-4">
                    <Input
                        placeholder="Pesquisar medicamento..."
                        value={posSearch}
                        onChange={(e) => setPosSearch(e.target.value)}
                        leftIcon={<HiOutlineSearch className="w-5 h-5 text-gray-400" />}
                    />
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[600px] overflow-y-auto">
                        {posPagination.paginatedItems.map(med => (
                            <div
                                key={med.id}
                                className="p-3 cursor-pointer bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-xl hover:border-primary-500 transition-all"
                                onClick={() => addToCart(med)}
                            >
                                <p className="font-bold text-sm truncate">{med.product.name}</p>
                                <p className="text-xs text-gray-500">{med.dosage}</p>
                                <div className="flex items-center justify-between mt-2">
                                    <span className="text-primary-600 font-bold text-sm">
                                        {Number(med.batches[0]?.sellingPrice || med.product.price).toLocaleString()} MT
                                    </span>
                                    <Badge variant={med.isLowStock ? 'warning' : 'success'} className="text-xs">
                                        {med.totalStock} un
                                    </Badge>
                                </div>
                                {med.requiresPrescription && (
                                    <Badge variant="info" className="text-xs mt-1">Receita</Badge>
                                )}
                            </div>
                        ))}
                        {filteredMedications.length === 0 && (
                            <div className="col-span-full py-8 text-center text-gray-400">
                                Nenhum medicamento encontrado
                            </div>
                        )}
                    </div>

                    {/* POS Grid Pagination */}
                    {filteredMedications.length > 0 && (
                        <Pagination
                            currentPage={posPagination.currentPage}
                            totalItems={posPagination.totalItems}
                            itemsPerPage={posPagination.itemsPerPage}
                            onPageChange={posPagination.setCurrentPage}
                            onItemsPerPageChange={posPagination.setItemsPerPage}
                            itemsPerPageOptions={[12, 24, 48]}
                            showInfo={false}
                            className="mt-4"
                        />
                    )}
                </div>

                {/* Cart */}
                <Card className="p-4 h-fit sticky top-4">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                        <HiOutlineShoppingCart className="w-5 h-5 text-primary-600" />
                        Carrinho
                    </h3>

                    {/* Customer Selection */}
                    <Select
                        label="Cliente"
                        options={[
                            { value: '', label: 'Cliente Balcão' },
                            ...customers.map(c => ({ value: c.id, label: c.name }))
                        ]}
                        value={selectedCustomer || ''}
                        onChange={(e) => setSelectedCustomer(e.target.value || null)}
                        className="mb-2"
                    />

                    {!selectedCustomer && (
                        <Input
                            label="Nome do Cliente (Opcional)"
                            placeholder="Digite o nome para o recibo..."
                            value={manualCustomerName}
                            onChange={(e) => setManualCustomerName(e.target.value)}
                            className="mb-4"
                        />
                    )}

                    {/* Cart Items */}
                    <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                        {cart.map(item => (
                            <div key={item.batchId} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-dark-700 rounded-lg">
                                <div className="flex-1">
                                    <p className="text-sm font-medium truncate">{item.productName}</p>
                                    <p className="text-xs text-gray-500">{item.unitPrice.toLocaleString()} MT × {item.quantity}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        className="w-6 h-6 rounded bg-gray-200 dark:bg-dark-600 hover:bg-gray-300"
                                        onClick={() => updateCartItem(item.batchId, item.quantity - 1)}
                                    >-</button>
                                    <span className="w-8 text-center font-bold">{item.quantity}</span>
                                    <button
                                        className="w-6 h-6 rounded bg-gray-200 dark:bg-dark-600 hover:bg-gray-300"
                                        onClick={() => updateCartItem(item.batchId, Math.min(item.quantity + 1, item.maxQuantity))}
                                    >+</button>
                                    <button
                                        className="w-6 h-6 rounded bg-red-100 text-red-600 hover:bg-red-200"
                                        onClick={() => removeFromCart(item.batchId)}
                                    >
                                        <HiOutlineTrash className="w-4 h-4 mx-auto" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {cart.length === 0 && (
                            <p className="text-center text-gray-400 py-8">Carrinho vazio</p>
                        )}
                    </div>

                    {/* Cart Actions */}
                    <div className="flex gap-2 mb-4">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCart([])}
                            className="flex-1"
                            disabled={cart.length === 0}
                        >
                            <HiOutlineTrash className="w-4 h-4 mr-2" />
                            Limpar
                        </Button>
                        {lastSale && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handlePrintLastReceipt}
                                title="Reimprimir Último Recibo"
                            >
                                <HiOutlineDocumentDownload className="w-4 h-4" />
                            </Button>
                        )}
                    </div>

                    {/* Discount */}
                    <Input
                        label="Desconto"
                        type="number"
                        value={discount}
                        onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                        min={0}
                    />

                    {/* Payment Method */}
                    <Select
                        label="Forma de Pagamento"
                        options={[
                            { value: 'cash', label: 'Dinheiro' },
                            { value: 'card', label: 'Cartão' },
                            { value: 'mpesa', label: 'M-Pesa' },
                            { value: 'emola', label: 'e-Mola' },
                            { value: 'transfer', label: 'Transferência' }
                        ]}
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="mt-4"
                    />

                    {/* Total */}
                    <div className="mt-4 pt-4 border-t dark:border-dark-600">
                        <div className="flex justify-between text-lg font-bold">
                            <span>Total:</span>
                            <span className="text-primary-600">{cartTotal.toLocaleString()} MT</span>
                        </div>
                    </div>

                    {/* Checkout Button */}
                    <Button
                        className="w-full mt-4"
                        size="lg"
                        onClick={handleCheckout}
                        disabled={cart.length === 0}
                        leftIcon={<HiOutlineCheck className="w-5 h-5" />}
                    >
                        Finalizar Venda
                    </Button>
                </Card>
            </div>
        </div>
    );
}
