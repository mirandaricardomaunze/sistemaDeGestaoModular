import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Card, Button, Badge, Input, Select, SmartTable } from '../../components/ui';
import { HiOutlineArrowPath, HiOutlineArrowDownTray, HiOutlinePrinter } from 'react-icons/hi2';
import { bottleStoreAPI } from '../../services/api/bottle-store.api';
import { formatDateTime } from '../../utils';
import toast from 'react-hot-toast';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';
import { useStore } from '../../stores/useStore';

interface BottleStockMovement {
    id: string;
    createdAt: string;
    movementType: string;
    quantity: number;
    balanceBefore: number;
    balanceAfter: number;
    performedBy?: string;
    product?: {
        name?: string;
        code?: string;
    };
}

interface MovementsResponse {
    data: BottleStockMovement[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        pages: number;
    };
}

const getMovementLabel = (movementType: string) => {
    switch (movementType) {
        case 'purchase':
            return 'Compra';
        case 'sale':
            return 'Venda';
        case 'adjustment':
            return 'Ajuste';
        case 'expired':
            return 'Expirado';
        case 'loss':
            return 'Quebra/Perda';
        default:
            return movementType;
    }
};

export default function BottleStoreStock() {
    const { companySettings } = useStore();
    const [movements, setMovements] = useState<BottleStockMovement[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [pageSize, setPageSize] = useState(10);
    const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, pages: 1 });

    const fetchMovements = useCallback(async (page = 1, limit = pageSize, searchStr = search, type = typeFilter, start = startDate, end = endDate) => {
        setLoading(true);
        try {
            const data = await bottleStoreAPI.getMovements({
                page,
                limit,
                search: searchStr || undefined,
                type: type || undefined,
                startDate: start || undefined,
                endDate: end || undefined,
            }) as MovementsResponse;
            setMovements(data.data);
            setPagination(data.pagination);
        } catch {
            toast.error('Erro ao carregar movimentos');
        } finally {
            setLoading(false);
        }
    }, [endDate, pageSize, search, startDate, typeFilter]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            fetchMovements(1, pageSize);
        }, 500);

        return () => window.clearTimeout(timer);
    }, [fetchMovements, pageSize]);

    const exportRows = useMemo(() => {
        return movements.map(movement => ({
            ...movement,
            movementTypeLabel: getMovementLabel(movement.movementType),
        }));
    }, [movements]);

    const handleExportExcel = () => {
        const period = startDate && endDate ? `${startDate}_a_${endDate}` : startDate ? `desde_${startDate}` : endDate ? `ate_${endDate}` : 'todos';
        const periodTitle = startDate && endDate ? `Periodo: ${startDate} a ${endDate}` : startDate ? `Desde: ${startDate}` : endDate ? `Ate: ${endDate}` : 'Todos os Registos';

        exportToExcel({
            filename: `movimentacao_stock_garrafeira_${period}`,
            title: 'Movimentacao de Stock - Garrafeira',
            subtitle: periodTitle,
            companyName: companySettings.companyName,
            columns: [
                { key: 'createdAt', header: 'Data', format: 'datetime', width: 22 },
                { key: 'product.name', header: 'Produto', width: 30 },
                { key: 'product.code', header: 'Codigo', width: 12 },
                { key: 'movementTypeLabel', header: 'Tipo', width: 15 },
                { key: 'quantity', header: 'Qtd', format: 'number', width: 10, align: 'center' },
                { key: 'balanceBefore', header: 'Anterior', format: 'number', width: 12, align: 'right' },
                { key: 'balanceAfter', header: 'Saldo', format: 'number', width: 12, align: 'right' },
                { key: 'performedBy', header: 'Responsavel', width: 20 },
            ],
            data: exportRows,
        });
    };

    const handleExportPDF = () => {
        const period = startDate && endDate ? `${startDate}_a_${endDate}` : startDate ? `desde_${startDate}` : endDate ? `ate_${endDate}` : 'todos';
        const periodTitle = startDate && endDate ? `Periodo: ${startDate} a ${endDate}` : startDate ? `Desde: ${startDate}` : endDate ? `Ate: ${endDate}` : 'Todos os Registos';

        exportToPDF({
            filename: `movimentacao_stock_garrafeira_${period}`,
            title: 'Movimentacao de Stock - Garrafeira',
            subtitle: periodTitle,
            companyName: companySettings.companyName,
            orientation: 'landscape',
            columns: [
                { key: 'createdAt', header: 'Data', format: 'datetime' },
                { key: 'product.name', header: 'Produto' },
                { key: 'movementTypeLabel', header: 'Tipo' },
                { key: 'quantity', header: 'Qtd', format: 'number', align: 'center' },
                { key: 'balanceBefore', header: 'Anterior', format: 'number', align: 'right' },
                { key: 'balanceAfter', header: 'Saldo', format: 'number', align: 'right' },
                { key: 'performedBy', header: 'Responsavel' },
            ],
            data: exportRows,
        });
    };

    const columns = useMemo<ColumnDef<BottleStockMovement, unknown>[]>(() => [
        {
            header: 'Data',
            cell: ({ row }) => (
                <span className="whitespace-nowrap text-gray-500 font-mono text-xs">
                    {formatDateTime(row.original.createdAt)}
                </span>
            ),
        },
        {
            header: 'Produto',
            cell: ({ row }) => (
                <div>
                    <div className="font-medium text-gray-900 dark:text-white">{row.original.product?.name || '-'}</div>
                    <div className="text-xs text-gray-500 font-mono">{row.original.product?.code || '-'}</div>
                </div>
            ),
        },
        {
            header: 'Tipo',
            cell: ({ row }) => (
                <Badge variant={
                    ['purchase', 'return_in', 'transfer'].includes(row.original.movementType) ? 'success' :
                        ['expired', 'loss'].includes(row.original.movementType) ? 'danger' : 'warning'
                }>
                    {getMovementLabel(row.original.movementType)}
                </Badge>
            ),
        },
        {
            header: 'Qtd',
            cell: ({ row }) => (
                <span className={`font-mono font-bold ${row.original.balanceAfter > row.original.balanceBefore ? 'text-green-600' : 'text-red-600'}`}>
                    {row.original.balanceAfter > row.original.balanceBefore ? '+' : ''}{row.original.quantity}
                </span>
            ),
        },
        {
            header: 'Saldo Final',
            cell: ({ row }) => (
                <div>
                    <div className="text-sm font-semibold">{row.original.balanceAfter} un</div>
                    <div className="text-[10px] text-gray-400">Antes: {row.original.balanceBefore}</div>
                </div>
            ),
        },
        {
            header: 'Responsavel',
            accessorKey: 'performedBy',
        },
    ], []);

    return (
        <div className="space-y-6 p-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Movimentacao de Stock</h1>
                    <p className="text-gray-500 dark:text-gray-400">Gerir entradas, saidas e ajustes de inventario</p>
                </div>
                <div className="flex gap-3">
                    <Button
                        leftIcon={<HiOutlineArrowPath className="w-4 h-4" />}
                        onClick={() => fetchMovements(1, pageSize)}
                        variant="ghost"
                    >
                        Atualizar
                    </Button>
                    <div className="flex bg-white dark:bg-dark-800 rounded-lg p-1 gap-1 border border-gray-200 dark:border-dark-700">
                        <Button variant="ghost" size="sm" onClick={handleExportExcel}>
                            <HiOutlineArrowDownTray className="w-4 h-4 mr-1 text-green-600" />
                            Excel
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleExportPDF}>
                            <HiOutlinePrinter className="w-4 h-4 mr-1 text-red-600" />
                            PDF
                        </Button>
                    </div>
                </div>
            </div>

            <Card padding="md" variant="glass" className="border-none">
                <div className="text-sm text-gray-500">
                    {pagination.total} movimentos
                </div>
            </Card>

            <SmartTable
                data={movements}
                columns={columns}
                isLoading={loading}
                search={{
                    value: search,
                    onChange: setSearch,
                    placeholder: 'Produto ou codigo...',
                }}
                renderFilters={(
                    <>
                        <Input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            size="sm"
                            className="bg-white dark:bg-dark-800"
                            aria-label="Desde"
                        />
                        <Input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            size="sm"
                            className="bg-white dark:bg-dark-800"
                            aria-label="Ate"
                        />
                        <Select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            options={[
                                { value: '', label: 'Todos os Tipos' },
                                { value: 'purchase', label: 'Compra/Entrada' },
                                { value: 'sale', label: 'Venda' },
                                { value: 'adjustment', label: 'Ajuste' },
                                { value: 'transfer', label: 'Transferencia' },
                                { value: 'expired', label: 'Expirado' },
                                { value: 'loss', label: 'Quebra/Perda' },
                            ]}
                            size="sm"
                            className="w-48 bg-white dark:bg-dark-800"
                        />
                    </>
                )}
                emptyTitle="Sem movimentos"
                emptyDescription="Ainda nao foram registados movimentos de stock para este módulo."
                pagination={{
                    currentPage: pagination.page,
                    totalItems: pagination.total,
                    itemsPerPage: pageSize,
                    onPageChange: (nextPage) => fetchMovements(nextPage, pageSize),
                    onItemsPerPageChange: (size) => {
                        setPageSize(size);
                        fetchMovements(1, size);
                    },
                    itemsPerPageOptions: [5, 10, 20, 50],
                }}
            />
        </div>
    );
}
