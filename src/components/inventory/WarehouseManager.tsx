import { useState } from 'react';
import { Button, Card, Input, Modal, Badge, Pagination, usePagination, ConfirmationModal } from '../ui';
import { HiOutlinePencil, HiOutlineCheck, HiOutlineXMark } from 'react-icons/hi2';
import toast from 'react-hot-toast';
import { cn } from '../../utils/helpers';
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
    const [warehouseToToggle, setWarehouseToToggle] = useState<{ id: string, name: string, isActive: boolean } | null>(null);

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

    const handleToggleActive = (warehouse: { id: string, name: string, isActive: boolean }) => {
        setWarehouseToToggle(warehouse);
    };

    const confirmToggleActive = async () => {
        if (!warehouseToToggle) return;
        try {
            await updateWarehouse({ id: warehouseToToggle.id, data: { isActive: !warehouseToToggle.isActive } });
            setWarehouseToToggle(null);
        } catch (err) {
            toast.error('Erro ao alterar status do armazém');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            if (editingWarehouse) {
                await updateWarehouse({ id: editingWarehouse.id, data: formData });
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
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleOpenModal(warehouse)}
                                                    className="p-2 rounded-lg bg-blue-50/50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all border border-blue-100/50 dark:border-blue-500/20 shadow-sm"
                                                    title="Editar"
                                                >
                                                    <HiOutlinePencil className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleToggleActive(warehouse)}
                                                    className={cn(
                                                        "p-2 rounded-lg transition-all border shadow-sm",
                                                        warehouse.isActive
                                                            ? 'bg-red-50/50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 border-red-100/50 dark:border-red-500/20'
                                                            : 'bg-emerald-50/50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border-emerald-100/50 dark:border-emerald-500/20'
                                                    )}
                                                    title={warehouse.isActive ? 'Desativar' : 'Ativar'}
                                                >
                                                    {warehouse.isActive ? <HiOutlineXMark className="w-5 h-5" /> : <HiOutlineCheck className="w-5 h-5" />}
                                                </button>
                                            </div>
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
            {/* Toggle Active Confirmation Modal */}
            <ConfirmationModal
                isOpen={!!warehouseToToggle}
                onClose={() => setWarehouseToToggle(null)}
                onConfirm={confirmToggleActive}
                title={warehouseToToggle?.isActive ? 'Desativar Armazém' : 'Ativar Armazém'}
                message={`Tem certeza que deseja ${warehouseToToggle?.isActive ? 'desativar' : 'ativar'} o armazém "${warehouseToToggle?.name}"?`}
                confirmText={warehouseToToggle?.isActive ? 'Desativar' : 'Ativar'}
                variant={warehouseToToggle?.isActive ? 'danger' : 'info'}
            />
        </div>
    );
}
