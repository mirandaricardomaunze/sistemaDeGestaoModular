import { Modal, Input, Textarea, Select, Button } from '../ui';
import { HiOutlineSave } from 'react-icons/hi';

interface RoomFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (e: React.FormEvent) => void;
    room: any;
    data: any;
    setData: (data: any) => void;
}

export default function RoomFormModal({ isOpen, onClose, onSave, room, data, setData }: RoomFormModalProps) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={room ? `Editar Quarto ${room.number}` : 'Adicionar Novo Quarto'}
            size="md"
        >
            <form onSubmit={onSave} className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                    <Input
                        label="Número do Quarto"
                        required
                        value={data.number}
                        onChange={(e) => setData({ ...data, number: e.target.value })}
                        placeholder="Ex: 101"
                    />
                    <Select
                        label="Tipo de Quarto"
                        value={data.type}
                        onChange={(e) => setData({ ...data, type: e.target.value })}
                        options={[
                            { value: 'single', label: 'Single' },
                            { value: 'double', label: 'Double' },
                            { value: 'suite', label: 'Suite' },
                            { value: 'deluxe', label: 'Deluxe' },
                        ]}
                    />
                </div>

                <Input
                    label="Preço Base (por noite)"
                    required
                    type="number"
                    value={data.price}
                    onChange={(e) => setData({ ...data, price: e.target.value })}
                    placeholder="0.00"
                />

                <div className="grid grid-cols-2 gap-4">
                    <Input
                        label="Preço Sem Refeição"
                        type="number"
                        value={data.priceNoMeal}
                        onChange={(e) => setData({ ...data, priceNoMeal: e.target.value })}
                        placeholder="0.00"
                    />
                    <Input
                        label="Preço com Pequeno Almoço"
                        type="number"
                        value={data.priceBreakfast}
                        onChange={(e) => setData({ ...data, priceBreakfast: e.target.value })}
                        placeholder="0.00"
                    />
                </div>

                <Textarea
                    label="Notas / Observações"
                    rows={3}
                    value={data.notes}
                    onChange={(e) => setData({ ...data, notes: e.target.value })}
                    placeholder="Detalhes adicionais do quarto..."
                />

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-dark-700">
                    <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
                    <Button variant="primary" type="submit" leftIcon={<HiOutlineSave />}>
                        {room ? 'Guardar Alterações' : 'Adicionar Quarto'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
