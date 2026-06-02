import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { HiOutlineCheck, HiOutlinePencil, HiOutlineXMark } from 'react-icons/hi2';
import toast from 'react-hot-toast';
import { Button, Input, Modal, Badge, usePagination, ConfirmationModal, SmartTable } from '../ui';
import { useWarehouses, type Warehouse } from '../../hooks/useWarehouses';

export default function WarehouseManager() {
    const { warehouses: warehousesData, addWarehouse, updateWarehouse } = useWarehouses();
    const warehouses = Array.isArray(warehousesData) ? warehousesData : [];

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
    const [warehouseToToggle, setWarehouseToToggle] = useState<{ id: string; name: string; isActive: boolean } | null>(null);

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

    const handleOpenModal = (warehouse?: Warehouse) => {
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

    const handleToggleActive = (warehouse: { id: string; name: string; isActive: boolean }) => {
        setWarehouseToToggle(warehouse);
    };

    const confirmToggleActive = async () => {
        if (!warehouseToToggle) return;
        try {
            await updateWarehouse({ id: warehouseToToggle.id, data: { isActive: !warehouseToToggle.isActive } });
            setWarehouseToToggle(null);
        } catch {
            toast.error('Erro ao alterar status do armazem');
        }
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

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
        } catch {
            toast.error('Erro ao salvar armazem');
        }
    };

    const warehouseColumns: ColumnDef<Warehouse, unknown>[] = [
        {
            header: 'Codigo',
            accessorKey: 'code',
            cell: ({ row }) => (
                <span className="text-sm font-mono font-medium text-primary-600 dark:text-primary-400">
                    {row.original.code}
                </span>
            ),
        },
        {
            header: 'Nome',
            accessorKey: 'name',
            cell: ({ row }) => (
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {row.original.name}
                </span>
            ),
        },
        {
            header: 'Localizacao',
            accessorKey: 'location',
            cell: ({ row }) => (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                    {row.original.location || '-'}
                </span>
            ),
        },
        {
            header: 'Responsavel',
            accessorKey: 'responsible',
            cell: ({ row }) => (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                    {row.original.responsible || '-'}
                </span>
            ),
        },
        {
            header: 'Status',
            cell: ({ row }) => (
                <div className="text-center">
                    <Badge variant={row.original.isActive ? 'success' : 'danger'}>
                        {row.original.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                </div>
            ),
        },
        {
            header: 'Accoes',
            cell: ({ row }) => (
                <div className="flex justify-end gap-2">
                    <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleOpenModal(row.original)}
                        className="h-9 w-9 px-0 rounded-lg bg-blue-50/50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 border border-blue-100/50 dark:border-blue-500/20 shadow-sm"
                        title="Editar"
                    >
                        <HiOutlinePencil className="w-5 h-5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleToggleActive(row.original)}
                        className={
                            row.original.isActive
                                ? 'h-9 w-9 px-0 rounded-lg bg-red-50/50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 border border-red-100/50 dark:border-red-500/20 shadow-sm'
                                : 'h-9 w-9 px-0 rounded-lg bg-emerald-50/50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-100/50 dark:border-emerald-500/20 shadow-sm'
                        }
                        title={row.original.isActive ? 'Desativar' : 'Ativar'}
                    >
                        {row.original.isActive ? <HiOutlineXMark className="w-5 h-5" /> : <HiOutlineCheck className="w-5 h-5" />}
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <Button variant="ghost" id="new-warehouse-btn" className="hidden" onClick={() => handleOpenModal()} />

            <SmartTable
                data={paginatedWarehouses}
                columns={warehouseColumns}
                hideToolbar
                emptyTitle="Nenhum armazem encontrado"
                emptyDescription="Crie um armazem para organizar o stock por localizacao."
                onEmptyAction={() => handleOpenModal()}
                emptyActionLabel="Novo Armazem"
                pagination={{
                    currentPage,
                    totalItems,
                    itemsPerPage,
                    onPageChange: setCurrentPage,
                    onItemsPerPageChange: setItemsPerPage,
                }}
                minHeight="420px"
            />

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingWarehouse ? 'Editar Armazem' : 'Novo Armazem'}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        label="Nome do Armazem"
                        value={formData.name}
                        onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                        required
                        placeholder="Ex: Armazem Principal"
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Codigo"
                            value={formData.code}
                            onChange={(event) => setFormData({ ...formData, code: event.target.value })}
                            required
                            placeholder="Ex: MAIN"
                        />
                        <Input
                            label="Localizacao"
                            value={formData.location}
                            onChange={(event) => setFormData({ ...formData, location: event.target.value })}
                            required
                            placeholder="Ex: Sede"
                        />
                    </div>
                    <Input
                        label="Responsavel"
                        value={formData.responsible}
                        onChange={(event) => setFormData({ ...formData, responsible: event.target.value })}
                        required
                        placeholder="Ex: Nome do Gerente"
                    />

                    <div className="flex justify-end pt-4 gap-2">
                        <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit">
                            {editingWarehouse ? 'Salvar Alteracoes' : 'Criar Armazem'}
                        </Button>
                    </div>
                </form>
            </Modal>

            <ConfirmationModal
                isOpen={!!warehouseToToggle}
                onClose={() => setWarehouseToToggle(null)}
                onConfirm={confirmToggleActive}
                title={warehouseToToggle?.isActive ? 'Desativar Armazem' : 'Ativar Armazem'}
                message={`Tem certeza que deseja ${warehouseToToggle?.isActive ? 'desativar' : 'ativar'} o armazem "${warehouseToToggle?.name}"?`}
                confirmText={warehouseToToggle?.isActive ? 'Desativar' : 'Ativar'}
                variant={warehouseToToggle?.isActive ? 'danger' : 'info'}
            />
        </div>
    );
}
