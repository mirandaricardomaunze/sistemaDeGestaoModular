import { useState, useRef } from 'react';
import { Card, Button, Input, Select } from '../../ui';
import {
    HiOutlineShoppingCart, HiOutlineTrash, HiOutlineDocumentDownload,
    HiOutlineCheck, HiOutlineSearch, HiOutlineExclamationCircle,
    HiOutlineUser, HiOutlineCheckCircle, HiOutlinePhotograph, HiOutlineX,
    HiOutlineEye
} from 'react-icons/hi';
import { formatCurrency } from '../../../utils/helpers';
import { pharmacyAPI } from '../../../services/api';
import toast from 'react-hot-toast';

export function POSCartPanel({
    cart,
    setCart,
    updateCartItem,
    removeFromCart,
    cartTotal,
    insuranceAmount,
    discount,
    setDiscount,
    cartHasControlledItems,
    prescriptionNumber,
    setPrescriptionNumber,
    selectedCustomer,
    setSelectedCustomer,
    manualCustomerName,
    setManualCustomerName,
    paymentMethod,
    setPaymentMethod,
    handleCheckout,
    lastSale,
    handlePrintLastReceipt,
    customers,
    partners,
    insuranceEntity,
    setInsuranceEntity,
    setInsuranceCoverage,
    handleViewPatientHistory,
    onPrescriptionValidated,
}: any) {
    const subtotal = cart.reduce((sum: number, item: any) => sum + item.total, 0);
    const [lookingUp, setLookingUp] = useState(false);
    const [validatedRx, setValidatedRx] = useState<any>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [rxImageUrl, setRxImageUrl] = useState<string | null>(null);
    const [showImageModal, setShowImageModal] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleLookupPrescription = async () => {
        if (!prescriptionNumber.trim()) return;
        setLookingUp(true);
        try {
            const rx = await pharmacyAPI.lookupPrescription(prescriptionNumber.trim());
            setValidatedRx(rx);
            toast.success(`Receita ${rx.prescriptionNumber || rx.prescriptionNo || ''} encontrada - ${rx.patientName || 'Paciente'}`);
            if (onPrescriptionValidated) onPrescriptionValidated(rx);
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Receita não encontrada';
            toast.error(msg);
            setValidatedRx(null);
        } finally {
            setLookingUp(false);
        }
    };

    const handlePrescriptionChange = (val: string) => {
        setPrescriptionNumber(val);
        if (validatedRx && (validatedRx.prescriptionNumber || validatedRx.prescriptionNo) !== val) {
            setValidatedRx(null);
            setRxImageUrl(null);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !validatedRx?.id) return;

        if (file.size > 8 * 1024 * 1024) {
            toast.error('Ficheiro demasiado grande. Máximo 8 MB.');
            return;
        }

        setIsUploading(true);
        try {
            const result = await pharmacyAPI.uploadPrescriptionImage(validatedRx.id, file);
            setRxImageUrl(result.imageUrl);
            setValidatedRx((prev: any) => ({ ...prev, imageUrl: result.imageUrl }));
            toast.success('Imagem da receita guardada!');
        } catch (err: any) {
            toast.error('Erro ao guardar imagem: ' + (err?.response?.data?.message || err.message));
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleRemoveImage = async () => {
        if (!validatedRx?.id) return;
        try {
            await pharmacyAPI.deletePrescriptionImage(validatedRx.id);
            setRxImageUrl(null);
            setValidatedRx((prev: any) => ({ ...prev, imageUrl: null }));
            toast.success('Imagem removida');
        } catch {
            toast.error('Erro ao remover imagem');
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-10rem)] sticky top-6 mb-6">
            <Card className="flex flex-col flex-1 overflow-hidden p-0">
                {/* ── Header ──────────────────────────────────────-*/}
                <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b dark:border-dark-700 flex-shrink-0">
                    <h3 className="font-bold text-base flex items-center gap-2">
                        <HiOutlineShoppingCart className="w-5 h-5 text-teal-600" />
                        Carrinho
                        {cart.length > 0 && (
                            <span className="ml-1 w-5 h-5 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center">
                                {cart.length}
                            </span>
                        )}
                    </h3>
                    <div className="flex gap-1">
                        {lastSale && (
                            <button onClick={handlePrintLastReceipt} title="Reimprimir último recibo"
                                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-400 hover:text-teal-600 transition-colors">
                                <HiOutlineDocumentDownload className="w-4 h-4" />
                            </button>
                        )}
                        {cart.length > 0 && (
                            <button onClick={() => setCart([])} title="Limpar carrinho"
                                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 text-gray-400 hover:text-red-600 transition-colors">
                                <HiOutlineTrash className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Scrollable body ──────────────────────────────-*/}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                    {/* Customer */}
                    <div className="flex gap-2 items-end">
                        <div className="flex-1">
                            <Select
                                label="Cliente"
                                options={[
                                    { value: '', label: 'Cliente Balcão' },
                                    ...customers.map((c: any) => ({ value: c.id, label: c.name }))
                                ]}
                                value={selectedCustomer || ''}
                                onChange={(e: any) => setSelectedCustomer(e.target.value || null)}
                            />
                        </div>
                        {selectedCustomer && (
                            <button onClick={handleViewPatientHistory}
                                className="mb-0.5 px-2 py-2 text-xs rounded-lg border border-gray-300 dark:border-dark-600 text-gray-600 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors whitespace-nowrap">
                                Histórico
                            </button>
                        )}
                    </div>

                    {!selectedCustomer && (
                        <Input
                            placeholder="Nome do cliente (opcional)..."
                            value={manualCustomerName}
                            onChange={(e: any) => setManualCustomerName(e.target.value)}
                        />
                    )}

                    {/* Insurance */}
                    <Select
                        label="Convénio / Seguro"
                        options={[
                            { value: '', label: 'Sem seguro' },
                            ...partners.filter((p: any) => p.isActive).map((p: any) => ({
                                value: p.id,
                                label: `${p.name} (${p.coveragePercentage}%)`
                            }))
                        ]}
                        value={insuranceEntity || ''}
                        onChange={(e: any) => {
                            const id = e.target.value;
                            setInsuranceEntity(id || null);
                            const sel = partners.find((p: any) => p.id === id);
                            setInsuranceCoverage(sel ? sel.coveragePercentage : 0);
                        }}
                    />

                    {/* Prescription (controlled items) */}
                    {cartHasControlledItems && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-200 dark:border-amber-700">
                            <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-2">⚠️ Receita obrigatória</p>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <Input
                                        placeholder="Nº da Receita Médica *"
                                        value={prescriptionNumber}
                                        onChange={(e: any) => handlePrescriptionChange(e.target.value)}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleLookupPrescription}
                                    disabled={lookingUp || !prescriptionNumber.trim()}
                                    className="mt-0.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1 whitespace-nowrap"
                                >
                                    {lookingUp
                                        ? <span className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                        : <HiOutlineSearch className="w-3.5 h-3.5" />
                                    }
                                    Validar
                                </button>
                            </div>

                            {validatedRx && (
                                <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                    <div className="flex items-start gap-2">
                                        <HiOutlineCheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                                        <div className="text-xs flex-1">
                                            <p className="font-semibold text-green-700 dark:text-green-400">Receita validada</p>
                                            {validatedRx.patientName && (
                                                <p className="text-green-600 flex items-center gap-1">
                                                    <HiOutlineUser className="w-3 h-3" />
                                                    {validatedRx.patientName}
                                                </p>
                                            )}
                                            {validatedRx.prescriberName && (
                                                <p className="text-green-600">Prescritor: {validatedRx.prescriberName}</p>
                                            )}
                                            {validatedRx.status === 'dispensed' && (
                                                <p className="text-amber-600 font-medium mt-0.5">⚠️ Esta receita já foi dispensada anteriormente.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Image upload / preview */}
                                    <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-700">
                                        {/* Hidden file input */}
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp,application/pdf"
                                            className="hidden"
                                            onChange={handleImageUpload}
                                        />

                                        {rxImageUrl || validatedRx.imageUrl ? (
                                            <div className="flex items-center gap-2">
                                                {/* Thumbnail (only for images, not PDFs) */}
                                                {(rxImageUrl || validatedRx.imageUrl)?.match(/\.(jpg|jpeg|png|webp)$/i) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowImageModal(true)}
                                                        className="w-12 h-12 rounded-lg overflow-hidden border-2 border-green-300 flex-shrink-0 hover:border-green-500 transition-colors"
                                                    >
                                                        <img
                                                            src={`${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001'}${rxImageUrl || validatedRx.imageUrl}`}
                                                            alt="Receita"
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </button>
                                                )}
                                                <div className="flex-1 text-xs text-green-700 dark:text-green-400 font-medium">
                                                    Imagem anexada
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowImageModal(true)}
                                                    className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                                                    title="Ver imagem"
                                                >
                                                    <HiOutlineEye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                                    title="Substituir imagem"
                                                >
                                                    <HiOutlinePhotograph className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleRemoveImage}
                                                    className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                                                    title="Remover imagem"
                                                >
                                                    <HiOutlineX className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={isUploading}
                                                className="w-full flex items-center justify-center gap-2 py-1.5 px-3 border border-dashed border-green-400 rounded-lg text-xs text-green-700 dark:text-green-400 hover:bg-green-100/50 dark:hover:bg-green-900/30 transition-colors disabled:opacity-50"
                                            >
                                                {isUploading
                                                    ? <span className="w-3 h-3 border-2 border-green-500/50 border-t-green-500 rounded-full animate-spin" />
                                                    : <HiOutlinePhotograph className="w-4 h-4" />
                                                }
                                                {isUploading ? 'A guardar...' : 'Digitalizar / Anexar Receita'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Image lightbox modal */}
                            {showImageModal && (rxImageUrl || validatedRx?.imageUrl) && (
                                <div
                                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
                                    onClick={() => setShowImageModal(false)}
                                >
                                    <div className="relative max-w-2xl max-h-[80vh] mx-4" onClick={e => e.stopPropagation()}>
                                        <button
                                            onClick={() => setShowImageModal(false)}
                                            className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg z-10"
                                        >
                                            <HiOutlineX className="w-4 h-4 text-gray-700" />
                                        </button>
                                        <img
                                            src={`${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001'}${rxImageUrl || validatedRx?.imageUrl}`}
                                            alt="Imagem da Receita"
                                            className="max-w-full max-h-[80vh] rounded-lg shadow-2xl object-contain"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Cart Items */}
                    <div className="space-y-2">
                        {cart.length === 0 ? (
                            <div className="text-center py-8">
                                <HiOutlineShoppingCart className="w-10 h-10 text-gray-200 dark:text-dark-600 mx-auto mb-2" />
                                <p className="text-sm text-gray-400">Carrinho vazio</p>
                                <p className="text-xs text-gray-300 dark:text-dark-500 mt-1">Clique num medicamento para adicionar</p>
                            </div>
                        ) : cart.map((item: any) => (
                            <div key={item.batchId} className="flex items-start gap-2 p-2.5 bg-gray-50 dark:bg-dark-700 rounded-lg">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold truncate text-gray-900 dark:text-white">{item.productName}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-xs text-gray-500">{formatCurrency(item.unitPrice)} x {item.quantity}</span>
                                        {item.expiryDate && (
                                            <span className="text-[10px] text-red-500 font-medium">
                                                Val: {new Date(item.expiryDate).toLocaleDateString('pt-MZ')}
                                            </span>
                                        )}
                                        {item.requiresPrescription && (
                                            <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 px-1 rounded font-bold">Rx</span>
                                        )}
                                        {item.isControlled && (
                                            <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 px-1 rounded font-bold">Ctrl</span>
                                        )}
                                    </div>
                                    <p className="text-xs font-bold text-teal-600 mt-0.5">{formatCurrency(item.total)}</p>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <button onClick={() => updateCartItem(item.batchId, item.quantity - 1)}
                                        className="w-6 h-6 rounded-md bg-gray-200 dark:bg-dark-600 hover:bg-gray-300 dark:hover:bg-dark-500 flex items-center justify-center text-sm font-bold transition-colors">
                                        -
                                    </button>
                                    <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                                    <button onClick={() => updateCartItem(item.batchId, Math.min(item.quantity + 1, item.maxQuantity))}
                                        className="w-6 h-6 rounded-md bg-gray-200 dark:bg-dark-600 hover:bg-gray-300 dark:hover:bg-dark-500 flex items-center justify-center text-sm font-bold transition-colors">
                                        +
                                    </button>
                                    <button onClick={() => removeFromCart(item.batchId)}
                                        className="w-6 h-6 rounded-md bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 flex items-center justify-center ml-1 transition-colors">
                                        <HiOutlineTrash className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Controlled items warning for known patient */}
                    {cartHasControlledItems && selectedCustomer && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2.5 border border-blue-200 dark:border-blue-800 flex items-start gap-2">
                            <HiOutlineExclamationCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-blue-700 dark:text-blue-300">
                                Verifique o histórico do paciente para garantir que os limites de dispensação de substâncias controladas não foram excedidos.
                            </p>
                        </div>
                    )}

                    {/* Discount */}
                    {cart.length > 0 && (
                        <Input
                            label="Desconto (MT)"
                            type="number"
                            value={discount}
                            onChange={(e: any) => setDiscount(Number(e.target.value) || 0)}
                            min={0}
                        />
                    )}

                    {/* Payment method */}
                    {cart.length > 0 && (
                        <Select
                            label="Forma de Pagamento"
                            options={[
                                { value: 'cash', label: 'Dinheiro' },
                                { value: 'card', label: 'Cartão' },
                                { value: 'mpesa', label: 'M-Pesa' },
                                { value: 'emola', label: 'e-Mola' },
                                { value: 'transfer', label: 'Transferência' },
                            ]}
                            value={paymentMethod}
                            onChange={(e: any) => setPaymentMethod(e.target.value)}
                        />
                    )}
                </div>

                {/* ── Fixed footer: totals + checkout button ──────-*/}
                <div className="flex-shrink-0 border-t dark:border-dark-700 px-4 pt-4 pb-8 bg-white dark:bg-dark-800">
                    {cart.length > 0 && (
                        <div className="space-y-1 mb-3">
                            <div className="flex justify-between text-sm text-gray-500">
                                <span>Subtotal</span>
                                <span>{formatCurrency(subtotal)}</span>
                            </div>
                            {insuranceEntity && (
                                <div className="flex justify-between text-sm text-blue-600">
                                    <span>Cobertura Seguro</span>
                                    <span>- {formatCurrency(insuranceAmount)}</span>
                                </div>
                            )}
                            {discount > 0 && (
                                <div className="flex justify-between text-sm text-amber-600">
                                    <span>Desconto</span>
                                    <span>- {formatCurrency(discount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-lg font-black text-gray-900 dark:text-white pt-2 border-t dark:border-dark-700">
                                <span>Total</span>
                                <span className="text-teal-600">{formatCurrency(cartTotal)}</span>
                            </div>
                        </div>
                    )}

                    <Button
                        className="w-full"
                        size="lg"
                        onClick={handleCheckout}
                        disabled={cart.length === 0}
                        leftIcon={<HiOutlineCheck className="w-5 h-5" />}
                    >
                        {cart.length === 0 ? 'Carrinho Vazio' : `Finalizar Venda · ${formatCurrency(cartTotal)}`}
                    </Button>
                </div>
            </Card>
        </div>
    );
}
