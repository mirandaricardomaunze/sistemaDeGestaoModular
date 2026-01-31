import { useState, useEffect } from 'react';
import { Card, Button, Badge, EmptyState } from '../../components/ui';
import { HiOutlineRefresh, HiOutlineClipboardList } from 'react-icons/hi';
import { bottleStoreAPI } from '../../services/api/bottle-store.api';
import { formatDateTime } from '../../utils';
import toast from 'react-hot-toast';
import { Pagination, Input, Select } from '../../components/ui';
import { HiOutlineSearch, HiOutlineDownload, HiOutlinePrinter } from 'react-icons/hi';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';
import { useStore } from '../../stores/useStore';

export default function BottleStoreStock() {
    const { companySettings } = useStore();
    const [movements, setMovements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [pageSize, setPageSize] = useState(10);
    const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, pages: 1 });

    const fetchMovements = async (page = 1, limit = pageSize, searchStr = search, type = typeFilter, start = startDate, end = endDate) => {
        setLoading(true);
        try {
            const data = await bottleStoreAPI.getMovements({
                page,
                limit,
                search: searchStr || undefined,
                type: type || undefined,
                startDate: start || undefined,
                endDate: end || undefined
            });
            setMovements(data.items);
            setPagination(data.pagination);
        } catch (error) {
            toast.error('Erro ao carregar movimentos');
        } finally {
            setLoading(false);
        }
    };

    // Use effect for search debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchMovements(1, pageSize);
        }, 500);

        return () => clearTimeout(timer);
    }, [search, typeFilter, startDate, endDate]);

    useEffect(() => {
        fetchMovements(1, pageSize);
    }, [pageSize]);

    const handleExportExcel = () => {
        const period = startDate && endDate ? `${startDate}_a_${endDate}` : startDate ? `desde_${startDate}` : endDate ? `ate_${endDate}` : 'todos';
        const periodTitle = startDate && endDate ? `Período: ${startDate} a ${endDate}` : startDate ? `Desde: ${startDate}` : endDate ? `Até: ${endDate}` : 'Todos os Registos';

        exportToExcel({
            filename: `movimentacao_stock_garrafeira_${period}`,
            title: 'Movimentação de Stock - Garrafeira',
            subtitle: periodTitle,
            companyName: companySettings.companyName,
            columns: [
                { key: 'createdAt', header: 'Data', format: 'datetime', width: 22 },
                { key: 'product.name', header: 'Produto', width: 30 },
                { key: 'product.code', header: 'Código', width: 12 },
                { key: 'movementTypeLabel', header: 'Tipo', width: 15 },
                { key: 'quantity', header: 'Qtd', format: 'number', width: 10, align: 'center' },
                { key: 'balanceBefore', header: 'Anterior', format: 'number', width: 12, align: 'right' },
                { key: 'balanceAfter', header: 'Saldo', format: 'number', width: 12, align: 'right' },
                { key: 'performedBy', header: 'Responsável', width: 20 },
            ],
            data: movements.map(m => ({
                ...m,
                movementTypeLabel: m.movementType === 'purchase' ? 'Compra' :
                    m.movementType === 'sale' ? 'Venda' :
                        m.movementType === 'adjustment' ? 'Ajuste' :
                            m.movementType === 'expired' ? 'Expirado' :
                                m.movementType === 'loss' ? 'Quebra/Perda' : m.movementType
            }))
        });
    };

    const handleExportPDF = () => {
        const period = startDate && endDate ? `${startDate}_a_${endDate}` : startDate ? `desde_${startDate}` : endDate ? `ate_${endDate}` : 'todos';
        const periodTitle = startDate && endDate ? `Período: ${startDate} a ${endDate}` : startDate ? `Desde: ${startDate}` : endDate ? `Até: ${endDate}` : 'Todos os Registos';

        exportToPDF({
            filename: `movimentacao_stock_garrafeira_${period}`,
            title: 'Movimentação de Stock - Garrafeira',
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
                { key: 'performedBy', header: 'Responsável' },
            ],
            data: movements.map(m => ({
                ...m,
                movementTypeLabel: m.movementType === 'purchase' ? 'Compra' :
                    m.movementType === 'sale' ? 'Venda' :
                        m.movementType === 'adjustment' ? 'Ajuste' :
                            m.movementType === 'expired' ? 'Expirado' :
                                m.movementType === 'loss' ? 'Quebra/Perda' : m.movementType
            }))
        });
    };


    return (
        <div className="space-y-6 p-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Movimentação de Stock</h1>
                    <p className="text-gray-500 dark:text-gray-400">Gerir entradas, saídas e ajustes de inventário</p>
                </div>
                <div className="flex gap-3">
                    <Button
                        leftIcon={<HiOutlineRefresh className="w-4 h-4" />}
                        onClick={() => fetchMovements(1, pageSize)}
                        variant="ghost"
                    >
                        Atualizar
                    </Button>
                    <div className="flex bg-white dark:bg-dark-800 rounded-lg p-1 gap-1 border border-gray-200 dark:border-dark-700">
                        <Button variant="ghost" size="sm" onClick={handleExportExcel}>
                            <HiOutlineDownload className="w-4 h-4 mr-1 text-green-600" />
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
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <div className="md:col-span-1">
                        <Input
                            label="Pesquisar"
                            placeholder="Produto ou código..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            leftIcon={<HiOutlineSearch className="w-5 h-5 text-gray-400" />}
                        />
                    </div>
                    <div>
                        <Input
                            label="Desde"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <Input
                            label="Até"
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <Select
                            label="Tipo"
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            options={[
                                { value: '', label: 'Todos os Tipos' },
                                { value: 'purchase', label: 'Compra/Entrada' },
                                { value: 'sale', label: 'Venda' },
                                { value: 'adjustment', label: 'Ajuste' },
                                { value: 'transfer', label: 'Transferência' },
                                { value: 'expired', label: 'Expirado' },
                                { value: 'loss', label: 'Quebra/Perda' },
                            ]}
                        />
                    </div>
                    <div className="flex items-center justify-end text-sm text-gray-500 pb-2">
                        {pagination.total} movimentos
                    </div>
                </div>
            </Card>

            <Card padding="none">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 dark:bg-dark-900/50 uppercase text-xs font-bold text-gray-600 dark:text-gray-400">
                            <tr>
                                <th className="px-6 py-4">Data</th>
                                <th className="px-6 py-4">Produto</th>
                                <th className="px-6 py-4">Tipo</th>
                                <th className="px-6 py-4">Qtd</th>
                                <th className="px-6 py-4">Saldo Final</th>
                                <th className="px-6 py-4">Responsável</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                            {loading ? (
                                [1, 2, 3, 4, 5].map(i => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={6} className="px-6 py-4"><div className="h-4 bg-gray-200 dark:bg-dark-700 rounded w-full"></div></td>
                                    </tr>
                                ))
                            ) : movements.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12">
                                        <EmptyState
                                            icon={<HiOutlineClipboardList className="w-12 h-12 text-gray-300" />}
                                            title="Sem movimentos"
                                            description="Ainda não foram registados movimentos de stock para este módulo."
                                        />
                                    </td>
                                </tr>
                            ) : (
                                movements.map((m) => (
                                    <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-500 font-mono text-xs">
                                            {formatDateTime(m.createdAt)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900 dark:text-white">{m.product?.name}</div>
                                            <div className="text-xs text-gray-500 font-mono">{m.product?.code}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge variant={
                                                ['purchase', 'return_in', 'transfer'].includes(m.movementType) ? 'success' :
                                                    ['expired', 'loss'].includes(m.movementType) ? 'danger' : 'warning'
                                            }>
                                                {m.movementType === 'purchase' ? 'Compra' :
                                                    m.movementType === 'sale' ? 'Venda' :
                                                        m.movementType === 'adjustment' ? 'Ajuste' :
                                                            m.movementType === 'expired' ? 'Expirado' :
                                                                m.movementType === 'loss' ? 'Quebra/Perda' : m.movementType}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 font-mono font-bold">
                                            <span className={m.balanceAfter > m.balanceBefore ? 'text-green-600' : 'text-red-600'}>
                                                {m.balanceAfter > m.balanceBefore ? '+' : ''}{m.quantity}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-semibold">{m.balanceAfter} un</div>
                                            <div className="text-[10px] text-gray-400">Antes: {m.balanceBefore}</div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500">
                                            {m.performedBy}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {movements.length > 0 && (
                    <div className="p-4 border-t border-gray-100 dark:border-dark-700">
                        <Pagination
                            currentPage={pagination.page}
                            totalItems={pagination.total}
                            itemsPerPage={pageSize}
                            onPageChange={(p) => fetchMovements(p, pageSize)}
                            onItemsPerPageChange={(size) => {
                                setPageSize(size);
                                fetchMovements(1, size);
                            }}
                            itemsPerPageOptions={[5, 10, 20, 50]}
                        />
                    </div>
                )}
            </Card>


        </div >
    );
}
