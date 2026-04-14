import { useState, useEffect } from 'react';
import { Card, Badge, Input, Select, Button } from '../../components/ui';
import { auditAPI } from '../../services/api/audit.api';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
    HiOutlineShieldCheck, 
    HiOutlineSearch, 
    HiOutlineFilter,
    HiOutlineEye,
    HiOutlineChevronLeft,
    HiOutlineChevronRight
} from 'react-icons/hi';
import toast from 'react-hot-toast';

export default function CommercialAuditLogs() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filters, setFilters] = useState({
        action: '',
        entity: '',
        search: ''
    });

    useEffect(() => {
        loadLogs();
    }, [page, filters.action, filters.entity]);

    const loadLogs = async () => {
        setLoading(true);
        try {
            const response = await auditAPI.getAll({
                page,
                limit: 15,
                action: filters.action || undefined,
                entity: filters.entity || undefined
            });
            setLogs(response.data);
            setTotalPages(response.pagination.totalPages);
        } catch (error) {
            toast.error('Erro ao carregar logs de auditoria');
        } finally {
            setLoading(false);
        }
    };

    const getActionBadge = (action: string) => {
        const colors: any = {
            'BULK_PRICE_UPDATE': 'warning',
            'UPDATE_PRODUCT': 'info',
            'DELETE_PRODUCT': 'danger',
            'RECEIVE_ORDER': 'success',
            'CREATE_QUOTATION': 'success',
            'CONVERT_ORDER': 'primary'
        };
        return <Badge variant={colors[action] || 'ghost'}>{action}</Badge>;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2 uppercase tracking-tight">
                        <HiOutlineShieldCheck className="text-primary-500" />
                        Trilhas de Auditoria
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                        Histórico completo de acções administrativas e operacionais sensíveis
                    </p>
                </div>
            </div>

            {/* Filters */}
            <Card padding="md" className="bg-gray-50 dark:bg-dark-900/50 border-gray-100 dark:border-dark-700">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Select
                        label="Acção"
                        size="sm"
                        value={filters.action}
                        onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                        options={[
                            { value: '', label: 'Todas as acções' },
                            { value: 'BULK_PRICE_UPDATE', label: 'Ajuste de Preços em Massa' },
                            { value: 'UPDATE_PRODUCT', label: 'Edição de Produto' },
                            { value: 'DELETE_PRODUCT', label: 'Eliminação de Produto' },
                            { value: 'RECEIVE_ORDER', label: 'Recepção de OC' },
                            { value: 'CONVERT_ORDER', label: 'Conversão de Documentos' }
                        ]}
                    />
                    <Select
                        label="Entidade"
                        size="sm"
                        value={filters.entity}
                        onChange={(e) => setFilters({ ...filters, entity: e.target.value })}
                        options={[
                            { value: '', label: 'Todas as entidades' },
                            { value: 'products', label: 'Produtos' },
                            { value: 'purchase_orders', label: 'Ordens de Compra' },
                            { value: 'quotations', label: 'Cotações' },
                            { value: 'invoices', label: 'Facturas' }
                        ]}
                    />
                    <div className="flex items-end">
                        <Button variant="ghost" size="sm" onClick={() => setFilters({ action: '', entity: '', search: '' })}>
                            Limpar Filtros
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Logs Table */}
            <Card padding="none" className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs uppercase bg-gray-50 dark:bg-dark-800 text-gray-500 dark:text-gray-400">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Data/Hora</th>
                                <th className="px-6 py-4 font-semibold">Utilizador</th>
                                <th className="px-6 py-4 font-semibold">Acção</th>
                                <th className="px-6 py-4 font-semibold">Entidade</th>
                                <th className="px-6 py-4 font-semibold">Detalhes</th>
                                <th className="px-6 py-4 font-semibold">IP</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={6} className="px-6 py-8 h-4 bg-gray-50/50 dark:bg-dark-800/50" />
                                    </tr>
                                ))
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        Nenhum log de auditoria encontrado
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-dark-800/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-400 tabular-nums">
                                            {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-900 dark:text-white">
                                                    {log.userName || log.user?.name || 'Sistema'}
                                                </span>
                                                <span className="text-[10px] text-gray-400 italic">
                                                    {log.userId ? log.userId.slice(0, 8) : 'automático'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {getActionBadge(log.action)}
                                        </td>
                                        <td className="px-6 py-4 capitalize font-medium text-gray-500">
                                            {log.entity}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="max-w-xs truncate text-xs text-gray-500" title={JSON.stringify(log.details || log.newData)}>
                                                {log.action === 'BULK_PRICE_UPDATE' 
                                                    ? `${log.newData?.adjustment?.operation === 'increase' ? 'Aumento' : 'Redução'} de ${log.newData?.adjustment?.value}${log.newData?.adjustment?.type === 'percentage' ? '%' : ' MTn'}`
                                                    : log.entityId ? `ID: ${log.entityId.slice(0, 8)}...` : 'N/A'
                                                }
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-[10px] text-gray-400 font-mono">
                                            {log.ipAddress || '—'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 bg-gray-50 dark:bg-dark-800 flex items-center justify-between border-t border-gray-100 dark:border-dark-700">
                    <span className="text-xs text-gray-500">
                        Página <span className="font-bold text-gray-900 dark:text-white">{page}</span> de <span className="font-bold text-gray-900 dark:text-white">{totalPages}</span>
                    </span>
                    <div className="flex gap-2">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            disabled={page <= 1} 
                            onClick={() => setPage(page - 1)}
                        >
                            <HiOutlineChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            disabled={page >= totalPages} 
                            onClick={() => setPage(page + 1)}
                        >
                            <HiOutlineChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
