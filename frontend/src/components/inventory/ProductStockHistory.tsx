import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import type { IconType } from 'react-icons';
import {
    HiOutlineClock,
    HiOutlineCube,
    HiOutlineArrowUp,
    HiOutlineArrowDown,
    HiOutlineArrowPath,
    HiOutlineExclamationTriangle,
    HiOutlineTruck,
} from 'react-icons/hi2';
import { format } from 'date-fns';
import { Modal, Badge, SmartTable } from '../ui';
import { useStockMovements } from '../../hooks/useStockMovements';
import type { Product, MovementType, StockMovement } from '../../types';

interface ProductStockHistoryProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product;
}

const movementTypeConfig: Record<MovementType, { label: string; color: 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'gray'; icon: IconType }> = {
    purchase: { label: 'Compra', color: 'success', icon: HiOutlineArrowUp },
    sale: { label: 'Venda', color: 'danger', icon: HiOutlineArrowDown },
    return_in: { label: 'Devol. Entrada', color: 'info', icon: HiOutlineArrowPath },
    return_out: { label: 'Devol. Saida', color: 'warning', icon: HiOutlineArrowDown },
    adjustment: { label: 'Ajuste', color: 'primary', icon: HiOutlineClock },
    expired: { label: 'Expirado', color: 'danger', icon: HiOutlineExclamationTriangle },
    transfer: { label: 'Transferencia', color: 'info', icon: HiOutlineTruck },
    loss: { label: 'Perda', color: 'danger', icon: HiOutlineExclamationTriangle },
};

export function ProductStockHistory({ isOpen, onClose, product }: ProductStockHistoryProps) {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(8);
    const { movements, pagination, isLoading } = useStockMovements(product.id, {
        page,
        limit: pageSize,
    });

    const columns = useMemo<ColumnDef<StockMovement, unknown>[]>(() => [
        {
            header: 'Data',
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {format(new Date(row.original.createdAt), 'dd/MM/yyyy')}
                    </span>
                    <span className="text-[10px] text-gray-500">
                        {format(new Date(row.original.createdAt), 'HH:mm')}
                    </span>
                </div>
            ),
        },
        {
            header: 'Tipo',
            cell: ({ row }) => {
                const config = movementTypeConfig[row.original.movementType] || movementTypeConfig.adjustment;
                const Icon = config.icon;

                return (
                    <Badge variant={config.color} className="flex items-center gap-1 w-fit font-black uppercase tracking-widest text-[9px]">
                        <Icon className="w-3 h-3" />
                        {config.label}
                    </Badge>
                );
            },
        },
        {
            header: 'Armazem',
            cell: ({ row }) => row.original.warehouse?.name || <span className="italic text-gray-400">Global</span>,
        },
        {
            header: 'Qtd',
            cell: ({ row }) => {
                const quantity = row.original.quantity;

                return (
                    <span className={`font-bold ${quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {quantity > 0 ? `+${quantity}` : quantity}
                    </span>
                );
            },
        },
        {
            header: 'Saldo',
            cell: ({ row }) => (
                <div className="flex items-center justify-center gap-1 text-sm">
                    <span className="text-gray-400">{row.original.balanceBefore}</span>
                    <span className="text-gray-400">-&gt;</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{row.original.balanceAfter}</span>
                </div>
            ),
        },
        {
            header: 'Motivo',
            cell: ({ row }) => (
                <div className="max-w-[150px]">
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate" title={row.original.reason || ''}>
                        {row.original.reason || '-'}
                    </p>
                    {row.original.reference && (
                        <p className="text-[10px] text-primary-500 font-medium">
                            REF: {row.original.reference}
                        </p>
                    )}
                </div>
            ),
        },
        {
            header: 'Responsavel',
            accessorKey: 'performedBy',
        },
    ], []);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Historico de Stock: ${product.name}`}
            size="xl"
        >
            <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between bg-gray-50 dark:bg-dark-900/50 p-4 rounded-lg border border-gray-100 dark:border-dark-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600">
                            <HiOutlineCube className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">SKU / Codigo</p>
                            <p className="font-bold text-gray-900 dark:text-white">{product.code}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Stock Actual (Global)</p>
                        <p className="text-2xl font-black text-primary-600">{product.currentStock} {product.unit}</p>
                    </div>
                </div>

                <SmartTable
                    data={movements}
                    columns={columns}
                    isLoading={isLoading}
                    hideToolbar
                    minHeight={400}
                    emptyTitle="Sem movimentacoes"
                    emptyDescription="Este produto ainda não possui registos de entrada ou saída de stock."
                    pagination={{
                        currentPage: page,
                        totalItems: pagination?.total || 0,
                        itemsPerPage: pageSize,
                        onPageChange: setPage,
                        onItemsPerPageChange: (size) => {
                            setPageSize(size);
                            setPage(1);
                        },
                        itemsPerPageOptions: [5, 8, 15, 25],
                    }}
                />
            </div>
        </Modal>
    );
}
