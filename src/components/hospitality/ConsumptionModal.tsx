import { useState, useEffect } from 'react';
import { Modal, Input, Select, Button } from '../ui';
import { HiOutlinePlus, HiOutlineShoppingCart } from 'react-icons/hi';
import { useProducts } from '../../hooks/useData';

interface ConsumptionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: { productId: string; quantity: number }) => void;
}

export default function ConsumptionModal({ isOpen, onClose, onConfirm }: ConsumptionModalProps) {
    const { products } = useProducts();
    const [productId, setProductId] = useState('');
    const [quantity, setQuantity] = useState(1);

    useEffect(() => {
        if (!isOpen) {
            setProductId('');
            setQuantity(1);
        }
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!productId) return;
        onConfirm({ productId, quantity });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Registrar Consumo / Serviço"
            size="md"
        >
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                <div className="p-4 bg-primary-50 dark:bg-primary-900/10 rounded-lg flex items-center gap-3 mb-2">
                    <HiOutlineShoppingCart className="w-6 h-6 text-primary-600" />
                    <p className="text-sm text-primary-700 dark:text-primary-400 font-medium">
                        O consumo será adicionado à conta corrente do quarto e facturado no check-out.
                    </p>
                </div>

                <Select
                    label="Produto ou Serviço"
                    required
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                    options={[
                        { value: '', label: 'Seleccione um produto...' },
                        ...(products?.map((p: any) => ({
                            value: p.id,
                            label: `${p.name} - ${new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN' }).format(p.price)}`
                        })) || [])
                    ]}
                />

                <Input
                    label="Quantidade"
                    required
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    placeholder="1"
                />

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-dark-700">
                    <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
                    <Button variant="primary" type="submit" leftIcon={<HiOutlinePlus />}>
                        Adicionar Consumo
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
