import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ElementType } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import {
    HiOutlineArrowDown,
    HiOutlineArrowPath,
    HiOutlineArrowUp,
    HiOutlineClock,
    HiOutlineExclamationTriangle,
    HiOutlineEye,
    HiOutlineTrash,
    HiOutlineTruck,
} from 'react-icons/hi2';
import { logger } from '../../utils/logger';
import { productsAPI } from '../../services/api';
import { useWarehouses } from '../../hooks/useData';
import type { MovementType, StockMovement } from '../../types';
import { Badge, Button, Input, Modal, Select } from '../ui';
import type { BadgeVariant } from '../ui';
import { SmartTable } from '../ui/SmartTable';

interface MovementFilters {
    search: string;
    type: string;
    warehouseId: string;
    startDate: string;
    endDate: string;
}

interface MovementPagination {
    total: number;
}

interface StockMovementHistoryProps {
    originModule?: string;
}

const movementTypeConfig: Record<MovementType, { label: string; color: BadgeVariant; icon: ElementType }> = {
    purchase: { label: 'Compra', color: 'success', icon: HiOutlineArrowUp },
    sale: { label: 'Venda', color: 'danger', icon: HiOutlineArrowDown },
    return_in: { label: 'Devol. Entrada', color: 'info', icon: HiOutlineArrowPath },
    return_out: { label: 'Devol. Saida', color: 'warning', icon: HiOutlineArrowDown },
    adjustment: { label: 'Ajuste', color: 'primary', icon: HiOutlineClock },
    expired: { label: 'Expirado', color: 'danger', icon: HiOutlineExclamationTriangle },
    transfer: { label: 'Transferencia', color: 'info', icon: HiOutlineTruck },
    loss: { label: 'Perda', color: 'danger', icon: HiOutlineExclamationTriangle },
};

const movementTypeOptions = [
    { value: 'all', label: 'Todos os tipos' },
    { value: 'sale', label: 'Vendas' },
    { value: 'purchase', label: 'Compras' },
    { value: 'transfer', label: 'Transferencias' },
    { value: 'adjustment', label: 'Ajustes' },
    { value: 'return_in', label: 'Devolucoes (Entrada)' },
    { value: 'return_out', label: 'Devolucoes (Saida)' },
    { value: 'expired', label: 'Expirados' },
    { value: 'loss', label: 'Perdas' },
];

const getMovementConfig = (type: MovementType) => movementTypeConfig[type] || movementTypeConfig.adjustment;

export default function StockMovementHistory({ originModule }: StockMovementHistoryProps) {
    const [movements, setMovements] = useState<StockMovement[]>([]);
    const [pagination, setPagination] = useState<MovementPagination | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null);
    const [filters, setFilters] = useState<MovementFilters>({
        search: '',
        type: 'all',
        warehouseId: 'all',
        startDate: '',
        endDate: '',
    });

    const { warehouses } = useWarehouses();

    const warehouseOptions = useMemo(() => [
        { value: 'all', label: 'Todos os armazens' },
        ...warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name })),
    ], [warehouses]);

    const fetchMovements = useCallback(async () => {
        setIsLoading(true);
        setIsError(false);

        try {
            const response = await productsAPI.getStockMovements({
                page,
                limit: pageSize,
                type: filters.type !== 'all' ? filters.type : undefined,
                warehouseId: filters.warehouseId !== 'all' ? filters.warehouseId : undefined,
                search: filters.search || undefined,
                startDate: filters.startDate || undefined,
                endDate: filters.endDate || undefined,
                originModule,
            });

            setMovements(response.data || []);
            setPagination(response.pagination ?? null);
        } catch (error) {
            setIsError(true);
            logger.error('Error fetching movements:', error);
        } finally {
            setIsLoading(false);
        }
    }, [filters, originModule, page, pageSize]);

    useEffect(() => {
        fetchMovements();
    }, [fetchMovements]);

    const handleFilterChange = (key: keyof MovementFilters, value: string) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
        setPage(1);
    };

    const movementColumns = useMemo<ColumnDef<StockMovement, unknown>[]>(() => [
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
                const config = getMovementConfig(row.original.movementType);
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
            header: 'Produto',
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {row.original.product?.name || '-'}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">
                        {row.original.product?.code}
                    </span>
                </div>
            ),
        },
        {
            header: 'Armazem',
            cell: ({ row }) => (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                    {row.original.warehouse?.name || <span className="italic text-gray-400">Global</span>}
                </span>
            ),
        },
        {
            header: 'Qtd',
            cell: ({ row }) => (
                <span className={`font-bold ${row.original.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {row.original.quantity > 0 ? `+${row.original.quantity}` : row.original.quantity}
                </span>
            ),
        },
        {
            header: 'Saldo',
            cell: ({ row }) => (
                <div className="flex items-center gap-1.5 text-sm">
                    <span className="text-gray-400 text-[10px]">{row.original.balanceBefore}</span>
                    <span className="text-gray-300">-&gt;</span>
                    <span className="font-bold text-slate-700 dark:text-white uppercase tracking-tighter text-xs">
                        {row.original.balanceAfter}
                    </span>
                </div>
            ),
        },
        {
            header: 'Motivo',
            cell: ({ row }) => (
                <div className="max-w-[180px]">
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
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-[10px] font-black text-emerald-700 dark:text-emerald-400 shadow-sm border border-emerald-200/50 dark:border-emerald-500/20">
                        {(row.original.performedBy || 'S').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[11px] font-black text-slate-700 dark:text-gray-300 uppercase tracking-tight">
                            {row.original.performedBy || 'Sistema'}
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                            {row.original.performedBy ? 'Operador' : 'Automatico'}
                        </span>
                    </div>
                </div>
            ),
        },
        {
            header: 'Accoes',
            cell: ({ row }) => (
                <div className="flex items-center justify-end gap-1">
                    <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setSelectedMovement(row.original)}
                        title="Ver detalhes"
                        className="h-8 w-8 px-0 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20"
                    >
                        <HiOutlineEye className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => logger.info('Eliminar:', row.original.id)}
                        title="Eliminar"
                        className="h-8 w-8 px-0 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                        <HiOutlineTrash className="w-4 h-4" />
                    </Button>
                </div>
            ),
        },
    ], []);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">
                        Controlo de Movimentacoes
                    </h1>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
                        <span className="w-8 h-[1px] bg-emerald-500" />
                        Registo completo de todas as entradas e saidas de stock
                    </p>
                </div>
                <Button
                    variant="ghost"
                    onClick={fetchMovements}
                    isLoading={isLoading}
                    loadingText=""
                    className="text-[10px] font-black uppercase tracking-widest"
                    title="Actualizar dados"
                >
                    <HiOutlineArrowPath className="w-5 h-5" />
                </Button>
            </div>

            <SmartTable
                data={movements}
                columns={movementColumns}
                isLoading={isLoading}
                isError={isError}
                errorMessage="Nao foi possivel carregar as movimentacoes."
                onRetry={fetchMovements}
                search={{
                    value: filters.search,
                    onChange: (value) => handleFilterChange('search', value),
                    placeholder: 'Pesquisar por produto, referencia...',
                }}
                renderFilters={(
                    <>
                        <div className="w-full lg:w-48">
                            <Select
                                options={movementTypeOptions}
                                value={filters.type}
                                onChange={(event) => handleFilterChange('type', event.target.value)}
                                size="sm"
                            />
                        </div>
                        <div className="w-full lg:w-48">
                            <Select
                                options={warehouseOptions}
                                value={filters.warehouseId}
                                onChange={(event) => handleFilterChange('warehouseId', event.target.value)}
                                size="sm"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Input
                                type="date"
                                value={filters.startDate}
                                onChange={(event) => handleFilterChange('startDate', event.target.value)}
                                className="w-36"
                                size="sm"
                            />
                            <Input
                                type="date"
                                value={filters.endDate}
                                onChange={(event) => handleFilterChange('endDate', event.target.value)}
                                className="w-36"
                                size="sm"
                            />
                        </div>
                    </>
                )}
                onRefresh={fetchMovements}
                emptyTitle="Nenhuma movimentacao encontrada"
                emptyDescription="Tente ajustar os filtros ou termos de pesquisa."
                minHeight="500px"
                pagination={pagination ? {
                    currentPage: page,
                    totalItems: pagination.total,
                    itemsPerPage: pageSize,
                    onPageChange: setPage,
                    onItemsPerPageChange: (size) => {
                        setPageSize(size);
                        setPage(1);
                    },
                    itemsPerPageOptions: [5, 10, 15, 25, 50],
                } : undefined}
            />

            <Modal
                isOpen={!!selectedMovement}
                onClose={() => setSelectedMovement(null)}
                title="Detalhes da Movimentacao"
                size="md"
            >
                {selectedMovement && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            {(() => {
                                const config = getMovementConfig(selectedMovement.movementType);
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
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Armazem</p>
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
                                    {selectedMovement.balanceBefore} -&gt; {selectedMovement.balanceAfter}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3 border-t border-gray-200 dark:border-dark-600 pt-4">
                            {selectedMovement.reason && (
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Motivo / Observacoes</p>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">{selectedMovement.reason}</p>
                                </div>
                            )}
                            {selectedMovement.reference && (
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Referencia</p>
                                    <p className="text-sm font-mono text-primary-600">{selectedMovement.reference}</p>
                                </div>
                            )}
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Responsavel</p>
                                <p className="text-sm text-gray-700 dark:text-gray-300">{selectedMovement.performedBy || '-'}</p>
                            </div>
                            {selectedMovement.originModule && (
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Modulo de Origem</p>
                                    <Badge variant="outline">{selectedMovement.originModule}</Badge>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-dark-600">
                            <Button variant="secondary" onClick={() => setSelectedMovement(null)}>
                                Fechar
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
