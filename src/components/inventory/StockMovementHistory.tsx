import { useState, useEffect, useCallback } from 'react';
import { Card, Input, Select, Badge, LoadingSpinner, Button, Modal } from '../ui';
import Pagination from '../ui/Pagination';
import { productsAPI } from '../../services/api';
import { useWarehouses } from '../../hooks/useData';
import { format } from 'date-fns';
import { HiOutlineSearch, HiOutlineFilter, HiOutlineRefresh, HiOutlineArrowUp, HiOutlineArrowDown, HiOutlineTruck, HiOutlineExclamation, HiOutlineClock, HiOutlineEye, HiOutlineTrash } from 'react-icons/hi';
import type { MovementType, StockMovement } from '../../types';

interface MovementFilters {
    search: string;
    type: string;
    warehouseId: string;
    startDate: string;
    endDate: string;
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

const movementTypeOptions = [
    { value: 'all', label: 'Todos os tipos' },
    { value: 'sale', label: 'Vendas' },
    { value: 'purchase', label: 'Compras' },
    { value: 'transfer', label: 'Transferências' },
    { value: 'adjustment', label: 'Ajustes' },
    { value: 'return_in', label: 'Devoluções (Entrada)' },
    { value: 'return_out', label: 'Devoluções (Saída)' },
    { value: 'expired', label: 'Expirados' },
    { value: 'loss', label: 'Perdas' },
];

export default function StockMovementHistory() {
    const [movements, setMovements] = useState<StockMovement[]>([]);
    const [pagination, setPagination] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const [selectedMovement, setSelectedMovement] = useState<any>(null);
    const [filters, setFilters] = useState<MovementFilters>({
        search: '',
        type: 'all',
        warehouseId: 'all',
        startDate: '',
        endDate: ''
    });

    const { warehouses } = useWarehouses();

    const warehouseOptions = [
        { value: 'all', label: 'Todos os armazéns' },
        ...warehouses.map(w => ({ value: w.id, label: w.name }))
    ];

    const fetchMovements = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await productsAPI.getStockMovements({
                page,
                limit: pageSize,
                type: filters.type !== 'all' ? filters.type : undefined,
                warehouseId: filters.warehouseId !== 'all' ? filters.warehouseId : undefined,
                search: filters.search || undefined,
                startDate: filters.startDate || undefined,
                endDate: filters.endDate || undefined
            });
            setMovements(response.data || []);
            setPagination(response.pagination);
        } catch (error) {
            console.error('Error fetching movements:', error);
        } finally {
            setIsLoading(false);
        }
    }, [page, pageSize, filters]);

    useEffect(() => {
        fetchMovements();
    }, [fetchMovements]);

    const handleFilterChange = (key: keyof MovementFilters, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPage(1); // Reset to first page on filter change
    };

    const getMovementConfig = (type: MovementType) => {
        return movementTypeConfig[type] || movementTypeConfig.adjustment;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Histórico de Movimentações
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Registo completo de todas as entradas e saídas de stock
                    </p>
                </div>
                <Button
                    variant="ghost"
                    onClick={fetchMovements}
                    isLoading={isLoading}
                >
                    <HiOutlineRefresh className="w-5 h-5" />
                </Button>
            </div>

            {/* Filters */}
            <Card padding="md">
                <div className="flex flex-col lg:flex-row gap-4">
                    {/* Search */}
                    <div className="flex-1">
                        <Input
                            placeholder="Pesquisar por produto, referência..."
                            value={filters.search}
                            onChange={(e) => handleFilterChange('search', e.target.value)}
                            leftIcon={<HiOutlineSearch className="w-5 h-5" />}
                        />
                    </div>

                    {/* Type Filter */}
                    <div className="w-full lg:w-48">
                        <Select
                            options={movementTypeOptions}
                            value={filters.type}
                            onChange={(e) => handleFilterChange('type', e.target.value)}
                        />
                    </div>

                    {/* Warehouse Filter */}
                    <div className="w-full lg:w-48">
                        <Select
                            options={warehouseOptions}
                            value={filters.warehouseId}
                            onChange={(e) => handleFilterChange('warehouseId', e.target.value)}
                        />
                    </div>

                    {/* Date Range */}
                    <div className="flex gap-2">
                        <Input
                            type="date"
                            value={filters.startDate}
                            onChange={(e) => handleFilterChange('startDate', e.target.value)}
                            className="w-36"
                        />
                        <Input
                            type="date"
                            value={filters.endDate}
                            onChange={(e) => handleFilterChange('endDate', e.target.value)}
                            className="w-36"
                        />
                    </div>
                </div>
            </Card>

            {/* Table */}
            <Card padding="none">
                {isLoading ? (
                    <div className="py-16 flex justify-center">
                        <LoadingSpinner size="lg" />
                    </div>
                ) : movements.length === 0 ? (
                    <div className="py-16 flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 mb-4 rounded-full bg-gray-100 dark:bg-dark-700 flex items-center justify-center">
                            <HiOutlineFilter className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                            Nenhuma movimentação encontrada
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                            Tente ajustar os filtros ou termos de pesquisa.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-700">
                            <thead className="bg-gray-50 dark:bg-dark-800">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Data</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Tipo</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Produto</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Armazém</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Qtd</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Saldo</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Motivo</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Responsável</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-dark-700 bg-white dark:bg-dark-900">
                                {movements.map((mov: any) => {
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
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                        {mov.product?.name || '-'}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500 font-mono">
                                                        {mov.product?.code}
                                                    </span>
                                                </div>
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
                                                    <span className="text-gray-400">â†’</span>
                                                    <span className="font-semibold text-gray-900 dark:text-white">{mov.balanceAfter}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 max-w-[180px]">
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
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => setSelectedMovement(mov)}
                                                        className="p-2 rounded-lg text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                                                        title="Ver detalhes"
                                                    >
                                                        <HiOutlineEye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => console.log('Eliminar:', mov.id)}
                                                        className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                        title="Eliminar"
                                                    >
                                                        <HiOutlineTrash className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {pagination && (
                    <div className="px-6 py-4 border-t border-gray-200 dark:border-dark-700">
                        <Pagination
                            currentPage={page}
                            totalItems={pagination.total}
                            itemsPerPage={pageSize}
                            onPageChange={setPage}
                            onItemsPerPageChange={(size) => {
                                setPageSize(size);
                                setPage(1);
                            }}
                            itemsPerPageOptions={[5, 10, 15, 25, 50]}
                        />
                    </div>
                )}
            </Card>

            {/* Movement Details Modal */}
            <Modal
                isOpen={!!selectedMovement}
                onClose={() => setSelectedMovement(null)}
                title="Detalhes da Movimentação"
                size="md"
            >
                {selectedMovement && (
                    <div className="space-y-4">
                        {/* Movement Type Badge */}
                        <div className="flex items-center gap-3">
                            {(() => {
                                const config = movementTypeConfig[selectedMovement.movementType as MovementType] || movementTypeConfig.adjustment;
                                const Icon = config.icon;
                                return (
                                    <Badge variant={config.color} className="flex items-center gap-1">
                                        <Icon className="w-4 h-4" />
                                        {config.label}
                                    </Badge>
                                );
                            })()}
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                {format(new Date(selectedMovement.createdAt), 'dd/MM/yyyy HH:mm:ss')}
                            </span>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-dark-700 rounded-lg">
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Produto</p>
                                <p className="font-medium text-gray-900 dark:text-white">
                                    {selectedMovement.product?.name || '-'}
                                </p>
                                <p className="text-xs text-gray-500 font-mono">
                                    {selectedMovement.product?.code}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Armazém</p>
                                <p className="font-medium text-gray-900 dark:text-white">
                                    {selectedMovement.warehouse?.name || 'Global'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Quantidade</p>
                                <p className={`font-bold text-lg ${selectedMovement.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {selectedMovement.quantity > 0 ? `+${selectedMovement.quantity}` : selectedMovement.quantity}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Saldo</p>
                                <p className="font-medium text-gray-900 dark:text-white">
                                    {selectedMovement.balanceBefore} â†’ {selectedMovement.balanceAfter}
                                </p>
                            </div>
                        </div>

                        {/* Additional Info */}
                        <div className="space-y-3 border-t border-gray-200 dark:border-dark-600 pt-4">
                            {selectedMovement.reason && (
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Motivo / Observações</p>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">{selectedMovement.reason}</p>
                                </div>
                            )}
                            {selectedMovement.reference && (
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Referência</p>
                                    <p className="text-sm font-mono text-primary-600">{selectedMovement.reference}</p>
                                </div>
                            )}
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Responsável</p>
                                <p className="text-sm text-gray-700 dark:text-gray-300">{selectedMovement.performedBy || '-'}</p>
                            </div>
                            {selectedMovement.originModule && (
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Módulo de Origem</p>
                                    <Badge variant="outline">{selectedMovement.originModule}</Badge>
                                </div>
                            )}
                        </div>

                        {/* Close Button */}
                        <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-dark-600">
                            <Button
                                variant="secondary"
                                onClick={() => setSelectedMovement(null)}
                            >
                                Fechar
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
