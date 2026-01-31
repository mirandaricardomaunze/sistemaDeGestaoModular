import { useState } from 'react';
import { Card, Button, EmptyState, ConfirmationModal } from '../ui';
import { HiOutlineHome, HiOutlinePlus, HiOutlineTrash, HiOutlinePencil, HiOutlineCog } from 'react-icons/hi';
import { formatCurrency } from '../../utils/helpers';
import { useHospitality } from '../../hooks/useHospitality';
import RoomFormModal from './RoomFormModal';
import toast from 'react-hot-toast';

export default function HospitalityManagement() {
    const { rooms, isLoading, addRoom, updateRoom, deleteRoom, refetch } = useHospitality();

    // Modal state
    const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
    const [editingRoom, setEditingRoom] = useState<any>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [roomToDelete, setRoomToDelete] = useState<string | null>(null);

    // Form data
    const [roomFormData, setRoomFormData] = useState({
        number: '',
        type: 'single',
        price: '',
        priceNoMeal: '',
        priceBreakfast: '',
        priceHalfBoard: '',
        priceFullBoard: '',
        notes: ''
    });

    const handleOpenAddModal = () => {
        setEditingRoom(null);
        setRoomFormData({
            number: '',
            type: 'single',
            price: '',
            priceNoMeal: '',
            priceBreakfast: '',
            priceHalfBoard: '',
            priceFullBoard: '',
            notes: ''
        });
        setIsRoomModalOpen(true);
    };

    const handleOpenEditModal = (room: any) => {
        setEditingRoom(room);
        setRoomFormData({
            number: room.number || '',
            type: room.type || 'single',
            price: String(room.price || ''),
            priceNoMeal: room.priceNoMeal ? String(room.priceNoMeal) : '',
            priceBreakfast: room.priceBreakfast ? String(room.priceBreakfast) : '',
            priceHalfBoard: room.priceHalfBoard ? String(room.priceHalfBoard) : '',
            priceFullBoard: room.priceFullBoard ? String(room.priceFullBoard) : '',
            notes: room.notes || ''
        });
        setIsRoomModalOpen(true);
    };

    const handleSaveRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const data = {
                number: roomFormData.number,
                type: roomFormData.type,
                price: parseFloat(roomFormData.price),
                priceNoMeal: roomFormData.priceNoMeal ? parseFloat(roomFormData.priceNoMeal) : null,
                priceBreakfast: roomFormData.priceBreakfast ? parseFloat(roomFormData.priceBreakfast) : null,
                priceHalfBoard: roomFormData.priceHalfBoard ? parseFloat(roomFormData.priceHalfBoard) : null,
                priceFullBoard: roomFormData.priceFullBoard ? parseFloat(roomFormData.priceFullBoard) : null,
                notes: roomFormData.notes
            };

            if (editingRoom) {
                await updateRoom(editingRoom.id, data);
                toast.success('Quarto actualizado com sucesso!');
            } else {
                await addRoom(data);
                toast.success('Quarto adicionado com sucesso!');
            }

            setIsRoomModalOpen(false);
            setEditingRoom(null);
            refetch();
        } catch (err: unknown) {
            toast.error(err.message || 'Erro ao guardar quarto');
        }
    };

    const handleDeleteClick = (roomId: string) => {
        setRoomToDelete(roomId);
        setDeleteConfirmOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!roomToDelete) return;
        try {
            await deleteRoom(roomToDelete);
            toast.success('Quarto eliminado com sucesso!');
            setDeleteConfirmOpen(false);
            setRoomToDelete(null);
            refetch();
        } catch (err: unknown) {
            toast.error(err.message || 'Erro ao eliminar quarto');
        }
    };

    if (isLoading) return <div className="p-12 text-center">Carregando quartos...</div>;

    return (
        <div className="space-y-6">
            <Card>
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Gestão de Quartos</h3>
                        <p className="text-sm text-gray-500">Adicione ou edite os quartos disponíveis no estabelecimento.</p>
                    </div>
                    <Button
                        variant="primary"
                        leftIcon={<HiOutlinePlus />}
                        onClick={handleOpenAddModal}
                    >
                        Adicionar Quarto
                    </Button>
                </div>

                {rooms.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-100 dark:border-dark-700">
                                    <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">Número</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">Tipo</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">Preço Base</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">Status</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase text-right">Acções</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-dark-700/50">
                                {rooms.map((room) => (
                                    <tr key={room.id} className="hover:bg-gray-50/50 dark:hover:bg-dark-700/20 transition-colors">
                                        <td className="px-4 py-4 font-bold text-primary-600">Quarto {room.number}</td>
                                        <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400 capitalize">{room.type}</td>
                                        <td className="px-4 py-4 text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(room.price)}</td>
                                        <td className="px-4 py-4">
                                            <span className={`px-2 py-1 text-xs font-bold rounded-full ${room.status === 'available' ? 'bg-green-100 text-green-700' :
                                                    room.status === 'occupied' ? 'bg-blue-100 text-blue-700' :
                                                        room.status === 'dirty' ? 'bg-amber-100 text-amber-700' :
                                                            'bg-red-100 text-red-700'
                                                }`}>
                                                {room.status === 'available' ? 'Disponível' :
                                                    room.status === 'occupied' ? 'Ocupado' :
                                                        room.status === 'dirty' ? 'Limpeza' : 'Manutenção'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleOpenEditModal(room)}
                                                    className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
                                                    title="Editar quarto"
                                                >
                                                    <HiOutlinePencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteClick(room.id)}
                                                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                                    title="Eliminar quarto"
                                                >
                                                    <HiOutlineTrash className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState
                        title="Nenhum quarto cadastrado"
                        description="Comece adicionando seu primeiro quarto ao sistema."
                        icon={<HiOutlineHome className="w-12 h-12" />}
                        action={
                            <Button variant="primary" leftIcon={<HiOutlinePlus />} onClick={handleOpenAddModal}>
                                Adicionar Primeiro Quarto
                            </Button>
                        }
                    />
                )}
            </Card>

            <Card>
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-gray-100 dark:bg-dark-700 rounded-lg">
                        <HiOutlineCog className="w-5 h-5 text-gray-500" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Configurações de Hotelaria</h3>
                        <p className="text-sm text-gray-500">Defina políticas de check-out, taxas extras e horários.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-50 pointer-events-none">
                    <div className="p-4 border border-dashed border-gray-200 dark:border-dark-700 rounded-xl">
                        <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">Horário de Checkout Padrão</p>
                        <p className="text-xs text-gray-500">Actualmente: 10:00 AM</p>
                    </div>
                    <div className="p-4 border border-dashed border-gray-200 dark:border-dark-700 rounded-xl">
                        <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">Taxa de Turismo</p>
                        <p className="text-xs text-gray-500">Actualmente: 50.00 MT por noite</p>
                    </div>
                </div>
            </Card>

            {/* Room Form Modal */}
            <RoomFormModal
                isOpen={isRoomModalOpen}
                onClose={() => { setIsRoomModalOpen(false); setEditingRoom(null); }}
                onSave={handleSaveRoom}
                room={editingRoom}
                data={roomFormData}
                setData={setRoomFormData}
            />

            {/* Delete Confirmation Modal */}
            <ConfirmationModal
                isOpen={deleteConfirmOpen}
                onClose={() => { setDeleteConfirmOpen(false); setRoomToDelete(null); }}
                onConfirm={handleConfirmDelete}
                title="Eliminar Quarto"
                message="Tem certeza que deseja eliminar este quarto? Esta acção não pode ser desfeita."
                variant="danger"
            />
        </div>
    );
}

