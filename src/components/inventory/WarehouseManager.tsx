import { useState } from 'react';
import { Button, Card, Input, Modal, Badge, Pagination, usePagination } from '../ui';
import { HiOutlinePencil, HiOutlineCheck, HiOutlineX } from 'react-icons/hi';
import toast from 'react-hot-toast';
import { useWarehouses } from '../../hooks/useData';

export default function WarehouseManager() {
    // Use data hook instead of store
    const { warehouses: warehousesData, addWarehouse, updateWarehouse } = useWarehouses();

    // Ensure warehouses is always an array
    const warehouses = Array.isArray(warehousesData) ? warehousesData : [];

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingWarehouse, setEditingWarehouse] = useState<{
        id: string;
        code: string;
        name: string;
        location?: string;
        responsible?: string;
        isActive: boolean;
        isDefault: boolean;
    } | null>(null);

    const {
        currentPage,
        setCurrentPage,
        itemsPerPage,
        setItemsPerPage,
        paginatedItems: paginatedWarehouses,
        totalItems,
    } = usePagination(warehouses, 10);

    const [formData, setFormData] = useState({
        name: '',
        code: '',
        location: '',
        responsible: '',
    });

    const handleOpenModal = (warehouse?: typeof editingWarehouse extends infer T ? NonNullable<T> : never) => {
        if (warehouse) {
            setEditingWarehouse(warehouse);
            setFormData({
                name: warehouse.name,
                code: warehouse.code,
                location: warehouse.location ?? '',
                responsible: warehouse.responsible ?? '',
            });
        } else {
            setEditingWarehouse(null);
            setFormData({
                name: '',
                code: '',
                location: '',
                responsible: '',
            });
        }
        setIsModalOpen(true);
    };

    const handleToggleActive = async (warehouse: { id: string; isActive: boolean }) => {
        try {
            await updateWarehouse(warehouse.id, { isActive: !warehouse.isActive });
        } catch (err) {
            toast.error('Erro ao alterar status do armazém');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            if (editingWarehouse) {
                await updateWarehouse(editingWarehouse.id, formData);
            } else {
                await addWarehouse({
                    ...formData,
                    isDefault: false,
                });
            }
            setIsModalOpen(false);
        } catch (err) {
            toast.error('Erro ao salvar armazém');
        }
    };

    return (
        <div className="space-y-6">
            <button id="new-warehouse-btn" className="hidden" onClick={() => handleOpenModal()} />


            <Card padding="none">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-700">
                        <thead className="bg-gray-50 dark:bg-dark-800">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Localização</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Responsável</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-dark-900 divide-y divide-gray-200 dark:divide-dark-700">
                            {paginatedWarehouses.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                        Nenhum armazém encontrado
                                    </td>
                                </tr>
                            ) : (
                                paginatedWarehouses.map((warehouse) => (
                                    <tr key={warehouse.id} className="hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium text-primary-600 dark:text-primary-400">
                                            {warehouse.code}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                            {warehouse.name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {warehouse.location}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {warehouse.responsible}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <Badge variant={warehouse.isActive ? 'success' : 'danger'}>
                                                {warehouse.isActive ? 'Ativo' : 'Inativo'}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-2">
                                            <button
                                                onClick={() => handleOpenModal(warehouse)}
                                                className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                                title="Editar"
                                            >
                                                <HiOutlinePencil className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleToggleActive(warehouse)}
                                                className={`p-2 rounded-lg transition-colors ${warehouse.isActive
                                                    ? 'text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                                                    : 'text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                                                    }`}
                                                title={warehouse.isActive ? 'Desativar' : 'Ativar'}
                                            >
                                                {warehouse.isActive ? <HiOutlineX className="w-5 h-5" /> : <HiOutlineCheck className="w-5 h-5" />}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="px-6">
                    <Pagination
                        currentPage={currentPage}
                        totalItems={totalItems}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={setItemsPerPage}
                    />
                </div>
            </Card>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingWarehouse ? 'Editar Armazém' : 'Novo Armazém'}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        label="Nome do Armazém"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        placeholder="Ex: Armazém Principal"
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Código"
                            value={formData.code}
                            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                            required
                            placeholder="Ex: MAIN"
                        />
                        <Input
                            label="Localização"
                            value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                            required
                            placeholder="Ex: Sede"
                        />
                    </div>
                    <Input
                        label="Responsável"
                        value={formData.responsible}
                        onChange={(e) => setFormData({ ...formData, responsible: e.target.value })}
                        required
                        placeholder="Ex: Nome do Gerente"
                    />

                    <div className="flex justify-end pt-4 gap-2">
                        <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit">
                            {editingWarehouse ? 'Salvar Alterações' : 'Criar Armazém'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
