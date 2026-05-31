import { useState, useEffect, useCallback } from 'react';
import { Card, Badge, Select, Button, SmartTable } from '../../components/ui';
import { auditAPI } from '../../services/api/audit.api';
import type { AuditLog, AuditPayload } from '../../services/api/audit.api';
import type { BadgeVariant } from '../../components/ui';
import { PAGE_SIZE } from '../../utils/constants';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
    HiOutlineChevronLeft,
    HiOutlineChevronRight
} from 'react-icons/hi2';
import toast from 'react-hot-toast';

export default function CommercialAuditLogs() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filters, setFilters] = useState({
        action: '',
        entity: '',
        search: ''
    });

    const loadLogs = useCallback(async () => {
        setLoading(true);
        try {
            const response = await auditAPI.getAll({
                page,
                limit: PAGE_SIZE,
                action: filters.action || undefined,
                entity: filters.entity || undefined
            });
            setLogs(response.data);
            setTotalPages(response.pagination.totalPages);
        } catch {
            toast.error('Erro ao carregar logs de auditoria');
        } finally {
            setLoading(false);
        }
    }, [filters.action, filters.entity, page]);

    useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    const getActionBadge = (action: string) => {
        const colors: Partial<Record<string, BadgeVariant>> = {
            'BULK_PRICE_UPDATE': 'warning',
            'UPDATE_PRODUCT': 'info',
            'DELETE_PRODUCT': 'danger',
            'RECEIVE_ORDER': 'success',
            'CREATE_QUOTATION': 'success',
            'CONVERT_ORDER': 'primary'
        };
        return <Badge variant={colors[action] || 'outline'}>{action}</Badge>;
    };

    const getPayloadRecord = (payload?: AuditPayload): Record<string, unknown> => (
        payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {}
    );

    const formatAuditDetails = (log: AuditLog): string => {
        if (log.action === 'BULK_PRICE_UPDATE') {
            const newData = getPayloadRecord(log.newData);
            const adjustment = getPayloadRecord(newData.adjustment as AuditPayload);
            const operation = adjustment.operation === 'increase' ? 'Aumento' : 'Reducao';
            const value = adjustment.value ?? '';
            const suffix = adjustment.type === 'percentage' ? '%' : ' MTn';
            return `${operation} de ${value}${suffix}`;
        }

        return log.entityId ? `ID: ${log.entityId.slice(0, 8)}...` : 'N/A';
    };

    const auditColumns = [
        { 
            key: 'createdAt', 
            header: 'Data/Hora',
            render: (log: AuditLog) => (
                <span className="text-gray-600 dark:text-gray-400 tabular-nums">
                    {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                </span>
            )
        },
        { 
            key: 'user', 
            header: 'Utilizador',
            render: (log: AuditLog) => (
                <div className="flex flex-col">
                    <span className="font-bold text-gray-900 dark:text-white">
                        {log.userName || log.user?.name || 'Sistema'}
                    </span>
                    <span className="text-[10px] text-gray-400 italic">
                        {log.userId ? log.userId.slice(0, 8) : 'automatico'}
                    </span>
                </div>
            )
        },
        { 
            key: 'action', 
            header: 'Accao',
            render: (log: AuditLog) => getActionBadge(log.action)
        },
        { 
            key: 'entity', 
            header: 'Entidade',
            render: (log: AuditLog) => (
                <span className="capitalize font-medium text-gray-500">{log.entity}</span>
            )
        },
        { 
            key: 'details', 
            header: 'Detalhes',
            render: (log: AuditLog) => (
                <div className="max-w-xs truncate text-xs text-gray-500" title={JSON.stringify(log.newData)}>
                    {formatAuditDetails(log)}
                </div>
            )
        },
        { 
            key: 'ipAddress', 
            header: 'IP',
            render: (log: AuditLog) => (
                <span className="text-[10px] text-gray-400 font-mono">
                    {log.ipAddress || ''}
                </span>
            )
        },
    ];

    return (
        <div className="space-y-6">
            {/* Filters */}
            <Card padding="md" className="bg-white dark:bg-dark-900 border border-gray-100 dark:border-dark-700">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <Select
                        label="Acção"
                        size="sm"
                        className="bg-gray-50 dark:bg-dark-800"
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
                        className="bg-gray-50 dark:bg-dark-800"
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
                    <div className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:items-end md:col-span-2 lg:col-span-1">
                        <Button 
                            className="flex-1" 
                            variant="primary" 
                            size="sm" 
                            onClick={loadLogs}
                            isLoading={loading}
                        >
                            Filtrar
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setFilters({ action: '', entity: '', search: '' })}
                        >
                            Limpar
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Logs Table */}
            <Card padding="none" className="overflow-hidden border-gray-100 dark:border-dark-700 shadow-xl shadow-black/5">
                <SmartTable
                    data={logs}
                    columns={auditColumns}
                    isLoading={loading}
                    onRefresh={loadLogs}
                    emptyTitle="Nenhum log de auditoria encontrado"
                    emptyDescription="Ajuste os filtros para consultar outros eventos."
                    mobileCardRender={(log) => (
                        <div className="bg-white dark:bg-dark-800 rounded-xl border border-slate-200/80 dark:border-white/10 p-4 shadow-sm space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex flex-col min-w-0">
                                    <span className="font-bold text-sm text-gray-900 dark:text-white truncate">
                                        {log.userName || log.user?.name || 'Sistema'}
                                    </span>
                                    <span className="text-[10px] text-gray-400 italic">
                                        {log.userId ? log.userId.slice(0, 8) : 'automatico'}
                                    </span>
                                </div>
                                <div className="shrink-0">
                                    {getActionBadge(log.action)}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                    {log.entity}
                                </p>
                                <p className="text-xs text-gray-600 dark:text-gray-300 font-medium bg-gray-50 dark:bg-dark-900/50 p-2 rounded-lg border border-gray-100 dark:border-dark-700">
                                    {formatAuditDetails(log)}
                                </p>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                    {format(new Date(log.createdAt), "dd MMM yy, HH:mm", { locale: ptBR })}
                                </span>
                                <span className="text-[10px] text-gray-400 font-mono bg-gray-100 dark:bg-dark-700 px-1.5 py-0.5 rounded">
                                    {log.ipAddress || 'S/ IP'}
                                </span>
                            </div>
                        </div>
                    )}
                />

                {/* Pagination */}
                <div className="px-3 sm:px-6 py-4 bg-gray-50 dark:bg-dark-800 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-gray-100 dark:border-dark-700">
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
