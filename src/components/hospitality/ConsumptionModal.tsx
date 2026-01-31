import { Modal, Input, Select, Button } from '../ui';
import { HiOutlinePlus, HiOutlineShoppingCart } from 'react-icons/hi';
import { useProducts } from '../../hooks/useData';

interface ConsumptionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (e: React.FormEvent) => void;
    data: any;
    setData: (data: any) => void;
}

export default function ConsumptionModal({ isOpen, onClose, onAdd, data, setData }: ConsumptionModalProps) {
    const { products } = useProducts();

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Registrar Consumo / Serviço"
            size="md"
        >
            <form onSubmit={onAdd} className="space-y-4 pt-2">
                <div className="p-4 bg-primary-50 dark:bg-primary-900/10 rounded-xl flex items-center gap-3 mb-2">
                    <HiOutlineShoppingCart className="w-6 h-6 text-primary-600" />
                    <p className="text-sm text-primary-700 dark:text-primary-400 font-medium">
                        O consumo será adicionado à conta corrente do quarto e facturado no check-out.
                    </p>
                </div>

                <Select
                    label="Produto ou Serviço"
                    required
                    value={data.productId}
                    onChange={(e) => setData({ ...data, productId: e.target.value })}
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
                    value={data.quantity}
                    onChange={(e) => setData({ ...data, quantity: parseInt(e.target.value) })}
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
