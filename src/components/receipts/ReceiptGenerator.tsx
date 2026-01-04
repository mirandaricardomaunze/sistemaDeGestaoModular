import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { jsPDF } from 'jspdf';
import {
    HiOutlinePlus,
    HiOutlineMinus,
    HiOutlineTrash,
    HiOutlineDocumentDownload,
} from 'react-icons/hi';
import { useStore } from '../../stores/useStore';
import { Button, Card, Input, Modal } from '../ui';
import { formatCurrency, formatDate, generateReceiptNumber } from '../../utils/helpers';
import type { Product, CartItem, CompanyInfo, ReceiptData, ReceiptCustomer } from '../../types';
import toast from 'react-hot-toast';

// Validation Schema
const customerSchema = z.object({
    name: z.string().min(2, 'Nome é obrigatório'),
    email: z.string().email('Email inválido').optional().or(z.literal('')),
    phone: z.string().optional(),
    document: z.string().optional(),
    address: z.string().optional(),
});

type CustomerFormData = z.infer<typeof customerSchema>;

export default function ReceiptGenerator() {
    const { companySettings } = useStore();
    const [selectedProducts, setSelectedProducts] = useState<CartItem[]>([]);
    const [customer, setCustomer] = useState<ReceiptCustomer | null>(null);
    const [showCustomerModal, setShowCustomerModal] = useState(false);

    const [searchProduct, setSearchProduct] = useState('');

    // Products come from a data hook
    const products: Product[] = [];

    // Format company info for receipt display with null safety
    const companyInfo: CompanyInfo = useMemo(() => ({
        name: companySettings?.companyName ?? 'Empresa',
        address: `${companySettings?.address ?? ''} - ${companySettings?.city ?? ''}/${companySettings?.state ?? ''}`,
        phone: companySettings?.phone ?? '',
        email: companySettings?.email ?? '',
        taxId: companySettings?.taxId ?? '',
        logo: companySettings?.logo,
    }), [companySettings]);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<CustomerFormData>({
        resolver: zodResolver(customerSchema),
    });

    // Filtered products for search
    const filteredProducts = useMemo(() => {
        if (!searchProduct) return products.slice(0, 10);
        const query = searchProduct.toLowerCase();
        return products.filter(
            (p) =>
                p.code.toLowerCase().includes(query) ||
                p.name.toLowerCase().includes(query)
        );
    }, [products, searchProduct]);

    // Calculations with IVA 16%
    const subtotal = selectedProducts.reduce((sum, item) => sum + item.total, 0);
    const IVA_RATE = 0.16; // 16% IVA Moçambique
    const tax = subtotal * IVA_RATE;
    const discount = 0;
    const total = subtotal + tax - discount;

    // Add product to receipt
    const addProduct = (product: Product) => {
        const existing = selectedProducts.find((p) => p.productId === product.id);
        if (existing) {
            setSelectedProducts((prev) =>
                prev.map((p) =>
                    p.productId === product.id
                        ? { ...p, quantity: p.quantity + 1, total: (p.quantity + 1) * p.unitPrice }
                        : p
                )
            );
        } else {
            setSelectedProducts((prev) => [
                ...prev,
                {
                    productId: product.id,
                    product,
                    quantity: 1,
                    unitPrice: product.price,
                    discount: 0,
                    total: product.price,
                },
            ]);
        }
        toast.success(`${product.name} adicionado`, { duration: 1500 });
    };

    // Update quantity
    const updateQuantity = (productId: string, delta: number) => {
        setSelectedProducts((prev) =>
            prev
                .map((p) => {
                    if (p.productId === productId) {
                        const newQty = Math.max(0, p.quantity + delta);
                        return { ...p, quantity: newQty, total: newQty * p.unitPrice };
                    }
                    return p;
                })
                .filter((p) => p.quantity > 0)
        );
    };

    // Remove product
    const removeProduct = (productId: string) => {
        setSelectedProducts((prev) => prev.filter((p) => p.productId !== productId));
    };

    // Save customer
    const onSubmitCustomer = (data: CustomerFormData) => {
        setCustomer({
            id: Date.now().toString(),
            name: data.name,
            email: data.email || undefined,
            phone: data.phone || undefined,
            document: data.document || undefined,
            address: data.address || undefined,
        });
        setShowCustomerModal(false);
        toast.success('Cliente adicionado!');
    };

    // Generate receipt data
    const getReceiptData = (): ReceiptData => ({
        receiptNumber: generateReceiptNumber(),
        date: new Date().toISOString(),
        customer: customer || undefined,
        items: selectedProducts,
        subtotal,
        discount,
        tax,
        total,
        paymentMethod: 'cash',
        amountPaid: total,
        change: 0,
        companyInfo,
    });

    // Generate PDF
    const generatePDF = () => {
        if (selectedProducts.length === 0) {
            toast.error('Adicione produtos ao recibo!');
            return;
        }

        const receipt = getReceiptData();
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: [80, 200], // Thermal receipt size
        });

        let y = 10;
        const lineHeight = 5;
        const centerX = 40;

        // Company Logo in PDF
        if (companyInfo.logo) {
            try {
                // Add logo centered
                doc.addImage(companyInfo.logo, 'PNG', centerX - 10, y, 20, 20);
                y += 25;
            } catch (e) {
                console.warn('Failed to add logo to PDF', e);
            }
        }

        // Company Header
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(companyInfo.name, centerX, y, { align: 'center' });
        y += lineHeight;

        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(companyInfo.address, centerX, y, { align: 'center' });
        y += lineHeight;
        doc.text(`Tel: ${companyInfo.phone}`, centerX, y, { align: 'center' });
        y += lineHeight;
        doc.text(`NUIT: ${companyInfo.taxId}`, centerX, y, { align: 'center' });
        y += lineHeight * 2;

        // Separator
        doc.line(5, y, 75, y);
        y += lineHeight;

        // Receipt info
        doc.setFont('helvetica', 'bold');
        doc.text(`RECIBO #${receipt.receiptNumber}`, centerX, y, { align: 'center' });
        y += lineHeight;
        doc.setFont('helvetica', 'normal');
        doc.text(formatDate(receipt.date, "dd/MM/yyyy 'às' HH:mm"), centerX, y, { align: 'center' });
        y += lineHeight;

        // Customer info
        if (receipt.customer) {
            y += lineHeight;
            doc.text(`Cliente: ${receipt.customer.name}`, 5, y);
            y += lineHeight;
            if (receipt.customer.document) {
                doc.text(`Doc: ${receipt.customer.document}`, 5, y);
                y += lineHeight;
            }
        }

        // Separator
        doc.line(5, y, 75, y);
        y += lineHeight;

        // Items header
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        doc.text('ITEM', 5, y);
        doc.text('QTD', 40, y, { align: 'center' });
        doc.text('UNIT', 55, y, { align: 'center' });
        doc.text('TOTAL', 75, y, { align: 'right' });
        y += lineHeight;

        // Items
        doc.setFont('helvetica', 'normal');
        receipt.items.forEach((item) => {
            // Item name (may wrap)
            const name = item.product.name.substring(0, 25);
            doc.text(name, 5, y);
            y += lineHeight - 1;
            doc.text(item.quantity.toString(), 40, y, { align: 'center' });
            doc.text(formatCurrency(item.unitPrice).replace('MTn', '').replace('MZN', ''), 55, y, { align: 'center' });
            doc.text(formatCurrency(item.total).replace('MTn', '').replace('MZN', ''), 75, y, { align: 'right' });
            y += lineHeight;
        });

        // Separator
        doc.line(5, y, 75, y);
        y += lineHeight;

        // Totals
        doc.setFontSize(7);
        doc.text('Subtotal:', 5, y);
        doc.text(formatCurrency(receipt.subtotal), 75, y, { align: 'right' });
        y += lineHeight;

        if (receipt.discount > 0) {
            doc.text('Desconto:', 5, y);
            doc.text(`-${formatCurrency(receipt.discount)}`, 75, y, { align: 'right' });
            y += lineHeight;
        }

        if (receipt.tax > 0) {
            doc.text('IVA (16%):', 5, y);
            doc.text(formatCurrency(receipt.tax), 75, y, { align: 'right' });
            y += lineHeight;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('TOTAL (c/ IVA):', 5, y);
        doc.text(formatCurrency(receipt.total), 75, y, { align: 'right' });
        y += lineHeight * 2;

        // Footer
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.text('Obrigado pela preferência!', centerX, y, { align: 'center' });
        y += lineHeight;
        doc.text('Volte sempre!', centerX, y, { align: 'center' });

        // Save PDF
        doc.save(`recibo-${receipt.receiptNumber}.pdf`);
        toast.success('PDF gerado com sucesso!');
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Panel - Product Selection */}
            <div className="space-y-4">
                {/* Customer Section */}
                <Card padding="md">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900 dark:text-white">Dados do Cliente</h3>
                        <Button size="sm" variant="outline" onClick={() => setShowCustomerModal(true)}>
                            {customer ? 'Editar' : 'Adicionar'}
                        </Button>
                    </div>
                    {customer ? (
                        <div className="p-3 bg-gray-50 dark:bg-dark-700 rounded-xl">
                            <p className="font-medium text-gray-900 dark:text-white">{customer.name}</p>
                            {customer.email && (
                                <p className="text-sm text-gray-500 dark:text-gray-400">{customer.email}</p>
                            )}
                            {customer.document && (
                                <p className="text-sm text-gray-500 dark:text-gray-400">Doc: {customer.document}</p>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Nenhum cliente selecionado (opcional)
                        </p>
                    )}
                </Card>

                {/* Product Search */}
                <Card padding="md">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Adicionar Produtos</h3>
                    <Input
                        placeholder="Buscar produto por código ou nome..."
                        value={searchProduct}
                        onChange={(e) => setSearchProduct(e.target.value)}
                    />
                    <div className="mt-4 max-h-64 overflow-y-auto scrollbar-thin space-y-2">
                        {filteredProducts.map((product) => (
                            <button
                                key={product.id}
                                onClick={() => addProduct(product)}
                                className="w-full flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-dark-700 hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors"
                            >
                                <div className="text-left">
                                    <p className="text-xs text-primary-600 dark:text-primary-400 font-mono">
                                        {product.code}
                                    </p>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                        {product.name}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                                        {formatCurrency(product.price)}
                                    </p>
                                    <p className="text-xs text-gray-500">Estoque: {product.currentStock}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </Card>

                {/* Selected Products */}
                <Card padding="md">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                        Itens do Recibo ({selectedProducts.length})
                    </h3>
                    {selectedProducts.length === 0 ? (
                        <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                            Nenhum produto adicionado
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {selectedProducts.map((item) => (
                                <div
                                    key={item.productId}
                                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-dark-700 rounded-xl"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                            {item.product.name}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {formatCurrency(item.unitPrice)} cada
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => updateQuantity(item.productId, -1)}
                                            className="w-7 h-7 rounded-lg bg-gray-200 dark:bg-dark-600 flex items-center justify-center"
                                        >
                                            <HiOutlineMinus className="w-3 h-3" />
                                        </button>
                                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                                        <button
                                            onClick={() => updateQuantity(item.productId, 1)}
                                            className="w-7 h-7 rounded-lg bg-gray-200 dark:bg-dark-600 flex items-center justify-center"
                                        >
                                            <HiOutlinePlus className="w-3 h-3" />
                                        </button>
                                    </div>
                                    <p className="font-semibold text-gray-900 dark:text-white w-20 text-right">
                                        {formatCurrency(item.total)}
                                    </p>
                                    <button
                                        onClick={() => removeProduct(item.productId)}
                                        className="p-2 text-gray-400 hover:text-red-500"
                                    >
                                        <HiOutlineTrash className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>

            {/* Right Panel - Receipt Preview */}
            <div className="space-y-4">
                <Card padding="md" className="sticky top-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Preview do Recibo</h3>

                    {/* Receipt Preview */}
                    <div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-600 rounded-xl p-6 font-mono text-sm">
                        {/* Header */}
                        <div className="text-center border-b border-dashed border-gray-300 dark:border-dark-600 pb-4 mb-4">
                            {companyInfo.logo && (
                                <div className="mb-2 flex justify-center">
                                    <img
                                        src={companyInfo.logo}
                                        alt="Logo"
                                        className="max-h-12 object-contain grayscale opacity-80"
                                        style={{ filter: 'grayscale(100%) contrast(1.2)' }}
                                    />
                                </div>
                            )}
                            <h4 className="font-bold text-base">{companyInfo.name}</h4>
                            <p className="text-xs text-gray-500 mt-1">{companyInfo.address}</p>
                            <p className="text-xs text-gray-500">Tel: {companyInfo.phone}</p>
                            <p className="text-xs text-gray-500">NUIT: {companyInfo.taxId}</p>
                        </div>

                        {/* Receipt Info */}
                        <div className="text-center mb-4">
                            <p className="font-bold">RECIBO</p>
                            <p className="text-xs text-gray-500">{formatDate(new Date(), "dd/MM/yyyy HH:mm")}</p>
                        </div>

                        {/* Customer */}
                        {customer && (
                            <div className="mb-4 pb-2 border-b border-dashed border-gray-300 dark:border-dark-600">
                                <p className="text-xs">Cliente: {customer.name}</p>
                                {customer.document && <p className="text-xs">Doc: {customer.document}</p>}
                            </div>
                        )}

                        {/* Items */}
                        <div className="space-y-2 mb-4 pb-4 border-b border-dashed border-gray-300 dark:border-dark-600">
                            {selectedProducts.length === 0 ? (
                                <p className="text-center text-gray-400 py-4">Nenhum item</p>
                            ) : (
                                selectedProducts.map((item) => (
                                    <div key={item.productId} className="flex justify-between text-xs">
                                        <div className="flex-1">
                                            <p>{item.product.name}</p>
                                            <p className="text-gray-500">
                                                {item.quantity} x {formatCurrency(item.unitPrice)}
                                            </p>
                                        </div>
                                        <p className="font-medium">{formatCurrency(item.total)}</p>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Totals */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                                <span>Subtotal:</span>
                                <span>{formatCurrency(subtotal)}</span>
                            </div>
                            {discount > 0 && (
                                <div className="flex justify-between text-xs text-green-600">
                                    <span>Desconto:</span>
                                    <span>-{formatCurrency(discount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-xs">
                                <span>IVA (16%):</span>
                                <span>{formatCurrency(tax)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-300 dark:border-dark-600">
                                <span>TOTAL (c/ IVA):</span>
                                <span>{formatCurrency(total)}</span>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="text-center mt-6 pt-4 border-t border-dashed border-gray-300 dark:border-dark-600">
                            <p className="text-xs text-gray-500">Obrigado pela preferência!</p>
                            <p className="text-xs text-gray-500">Volte sempre!</p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 mt-4">
                        <Button
                            className="flex-1"
                            onClick={generatePDF}
                            disabled={selectedProducts.length === 0}
                        >
                            <HiOutlineDocumentDownload className="w-4 h-4 mr-2" />
                            Gerar PDF
                        </Button>
                    </div>
                </Card>
            </div>

            {/* Customer Modal */}
            <Modal
                isOpen={showCustomerModal}
                onClose={() => {
                    setShowCustomerModal(false);
                    reset();
                }}
                title="Dados do Cliente"
            >
                <form onSubmit={handleSubmit(onSubmitCustomer)} className="space-y-4">
                    <Input
                        label="Nome *"
                        {...register('name')}
                        error={errors.name?.message}
                        placeholder="Nome do cliente"
                    />
                    <Input
                        label="Email"
                        type="email"
                        {...register('email')}
                        error={errors.email?.message}
                        placeholder="email@exemplo.com"
                    />
                    <Input
                        label="Telefone"
                        {...register('phone')}
                        placeholder="(00) 00000-0000"
                    />
                    <Input
                        label="Documento (BI/NUIT)"
                        {...register('document')}
                        placeholder="000.000.000-00"
                    />
                    <Input
                        label="Endereço"
                        {...register('address')}
                        placeholder="Rua, número, bairro"
                    />
                    <div className="flex gap-3 pt-4">
                        <Button
                            type="button"
                            variant="ghost"
                            className="flex-1"
                            onClick={() => {
                                setShowCustomerModal(false);
                                reset();
                            }}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" className="flex-1">
                            Salvar
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
