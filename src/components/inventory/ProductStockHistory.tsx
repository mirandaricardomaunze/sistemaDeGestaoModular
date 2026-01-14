import { useState } from 'react';
import { Modal, Badge, LoadingSpinner } from '../ui';
import { useStockMovements } from '../../hooks/useStockMovements';
import { format } from 'date-fns';
import { HiOutlineClock, HiOutlineCube, HiOutlineArrowUp, HiOutlineArrowDown, HiOutlineRefresh, HiOutlineExclamation, HiOutlineTruck, HiOutlineChevronLeft, HiOutlineChevronRight } from 'react-icons/hi';
import type { Product, MovementType, StockMovement } from '../../types';

interface ProductStockHistoryProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product;
}

const movementTypeConfig: Record<MovementType, { label: string; color: 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'gray'; icon: any }> = {
    purchase: { label: 'Compra', color: 'success', icon: HiOutlineArrowUp },
    sale: { label: 'Venda', color: 'danger', icon: HiOutlineArrowDown },
    return_in: { label: 'Devol. Entrada', color: 'info', icon: HiOutlineRefresh },
    return_out: { label: 'Devol. Saída', color: 'warning', icon: HiOutlineArrowDown },
    adjustment: { label: 'Ajuste', color: 'primary', icon: HiOutlineClock },
    expired: { label: 'Expirado', color: 'danger', icon: HiOutlineExclamation },
    transfer: { label: 'Transferência', color: 'info', icon: HiOutlineTruck },
    loss: { label: 'Perda', color: 'danger', icon: HiOutlineExclamation },
};

export function ProductStockHistory({ isOpen, onClose, product }: ProductStockHistoryProps) {
    const [page, setPage] = useState(1);
    const { movements, pagination, isLoading } = useStockMovements(product.id, {
        page,
        limit: 8
    });

    const getMovementConfig = (type: MovementType) => {
        return movementTypeConfig[type] || movementTypeConfig.adjustment;
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Histórico de Stock: ${product.name}`}
            size="xl"
        >
            <div className="flex flex-col gap-6">
                {/* Product Info Header */}
                <div className="flex items-center justify-between bg-gray-50 dark:bg-dark-900/50 p-4 rounded-xl border border-gray-100 dark:border-dark-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600">
                            <HiOutlineCube className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">SKU / Código</p>
                            <p className="font-bold text-gray-900 dark:text-white">{product.code}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Stock Actual (Global)</p>
                        <p className="text-2xl font-black text-primary-600">{product.currentStock} {product.unit}</p>
                    </div>
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="py-12 flex justify-center">
                        <LoadingSpinner size="lg" />
                    </div>
                ) : movements.length > 0 ? (
                    <div className="flex flex-col gap-4">
                        {/* Table */}
                        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-dark-700">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-700">
                                <thead className="bg-gray-50 dark:bg-dark-800">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Data</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Tipo</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Armazém</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Qtd</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Saldo</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Motivo</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Responsável</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-dark-700 bg-white dark:bg-dark-900">
                                    {movements.map((mov: StockMovement) => {
                                        const config = getMovementConfig(mov.movementType);
                                        const Icon = config.icon;
                                        return (
                                            <tr key={mov.id} className="hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors">
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                            {format(new Date(mov.createdAt), 'dd/MM/yyyy')}
                                                        </span>
                                                        <span className="text-[10px] text-gray-500">
                                                            {format(new Date(mov.createdAt), 'HH:mm')}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <Badge variant={config.color} className="flex items-center gap-1 w-fit">
                                                        <Icon className="w-3 h-3" />
                                                        {config.label}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                                                    {mov.warehouse?.name || <span className="italic text-gray-400">Global</span>}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-right">
                                                    <span className={`font-bold ${mov.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {mov.quantity > 0 ? `+${mov.quantity}` : mov.quantity}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                                    <div className="flex items-center justify-center gap-1 text-sm">
                                                        <span className="text-gray-400">{mov.balanceBefore}</span>
                                                        <span className="text-gray-400">→</span>
                                                        <span className="font-semibold text-gray-900 dark:text-white">{mov.balanceAfter}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 max-w-[150px]">
                                                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate" title={mov.reason || ''}>
                                                        {mov.reason || '-'}
                                                    </p>
                                                    {mov.reference && (
                                                        <p className="text-[10px] text-primary-500 font-medium">
                                                            REF: {mov.reference}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600 dark:text-gray-400">
                                                    {mov.performedBy}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {pagination && pagination.totalPages > 1 && (
                            <div className="flex items-center justify-between px-2">
                                <p className="text-sm text-gray-500">
                                    Página {page} de {pagination.totalPages} ({pagination.total} registos)
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="p-2 rounded-lg border border-gray-200 dark:border-dark-600 hover:bg-gray-100 dark:hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <HiOutlineChevronLeft className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                                        disabled={page === pagination.totalPages}
                                        className="p-2 rounded-lg border border-gray-200 dark:border-dark-600 hover:bg-gray-100 dark:hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <HiOutlineChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="py-12 flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 mb-4 rounded-full bg-gray-100 dark:bg-dark-700 flex items-center justify-center">
                            <HiOutlineClock className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                            Sem movimentações
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                            Este produto ainda não possui registos de entrada ou saída de stock.
                        </p>
                    </div>
                )}
            </div>
        </Modal>
    );
}
