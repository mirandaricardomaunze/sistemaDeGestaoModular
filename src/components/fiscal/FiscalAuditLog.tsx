import { useMemo } from 'react';
import {
    HiOutlineDocumentText,
    HiOutlineClock,
    HiOutlineUser,
    HiOutlineSearch,
} from 'react-icons/hi';
import { useFiscalStore } from '../../stores/useFiscalStore';
import { Card, Badge, Input, Pagination, usePagination } from '../ui';
import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function FiscalAuditLog() {
    const { auditLogs } = useFiscalStore();
    const [search, setSearch] = useState('');
    const [filterAction, setFilterAction] = useState<string>('all');

    // Filter logs
    const filteredLogs = useMemo(() => {
        return auditLogs.filter(log => {
            const matchesSearch =
                log.entityDescription.toLowerCase().includes(search.toLowerCase()) ||
                log.userName.toLowerCase().includes(search.toLowerCase()) ||
                log.action.toLowerCase().includes(search.toLowerCase());

            const matchesAction = filterAction === 'all' || log.action === filterAction;

            return matchesSearch && matchesAction;
        });
    }, [auditLogs, search, filterAction]);

    // Pagination
    const {
        currentPage,
        setCurrentPage,
        itemsPerPage,
        setItemsPerPage,
        paginatedItems: paginatedLogs,
        totalItems,
    } = usePagination(filteredLogs, 20);

    const getActionBadge = (action: string) => {
        const variants: Record<string, 'success' | 'primary' | 'warning' | 'danger' | 'info'> = {
            created: 'success',
            updated: 'primary',
            deleted: 'danger',
            exported: 'info',
            submitted: 'success',
            validated: 'primary',
            approved: 'success',
            rejected: 'danger',
        };
        const labels: Record<string, string> = {
            created: 'Criado',
            updated: 'Atualizado',
            deleted: 'Eliminado',
            exported: 'Exportado',
            submitted: 'Submetido',
            validated: 'Validado',
            approved: 'Aprovado',
            rejected: 'Rejeitado',
        };
        return <Badge variant={variants[action] || 'gray'}>{labels[action] || action}</Badge>;
    };

    const getEntityIcon = (entityType: string) => {
        switch (entityType) {
            case 'tax_config':
                return <HiOutlineDocumentText className="w-5 h-5" />;
            case 'report':
                return <HiOutlineDocumentText className="w-5 h-5" />;
            case 'retention':
                return <HiOutlineDocumentText className="w-5 h-5" />;
            case 'deadline':
                return <HiOutlineClock className="w-5 h-5" />;
            default:
                return <HiOutlineDocumentText className="w-5 h-5" />;
        }
    };

    const formatTimestamp = (timestamp: string) => {
        try {
            return format(new Date(timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
        } catch {
            return timestamp;
        }
    };

    const actionOptions = [
        { value: 'all', label: 'Todas as ações' },
        { value: 'created', label: 'Criação' },
        { value: 'updated', label: 'Atualização' },
        { value: 'deleted', label: 'Eliminação' },
        { value: 'exported', label: 'Exportação' },
        { value: 'submitted', label: 'Submissão' },
        { value: 'validated', label: 'Validação' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Auditoria Fiscal
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Histórico de todas as alterações em documentos fiscais
                    </p>
                </div>
                <Badge variant="gray">{auditLogs.length} registos</Badge>
            </div>

            {/* Filters */}
            <Card padding="md">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                        <Input
                            placeholder="Pesquisar por descrição, utilizador..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            leftIcon={<HiOutlineSearch className="w-5 h-5" />}
                        />
                    </div>
                    <div className="w-full sm:w-48">
                        <select
                            className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-gray-900 dark:text-white"
                            value={filterAction}
                            onChange={(e) => setFilterAction(e.target.value)}
                        >
                            {actionOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </Card>

            {/* Logs List */}
            <Card padding="none">
                {paginatedLogs.length === 0 ? (
                    <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                        <HiOutlineDocumentText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="font-medium">Nenhum registo de auditoria</p>
                        <p className="text-sm mt-1">
                            Os registos aparecerão aqui quando houver alterações em documentos fiscais
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200 dark:divide-dark-700">
                        {paginatedLogs.map((log) => (
                            <div
                                key={log.id}
                                className="p-4 hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors"
                            >
                                <div className="flex items-start gap-4">
                                    {/* Icon */}
                                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 dark:bg-dark-700 flex items-center justify-center text-gray-500 dark:text-gray-400">
                                        {getEntityIcon(log.entityType)}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {getActionBadge(log.action)}
                                            <span className="font-medium text-gray-900 dark:text-white">
                                                {log.entityDescription}
                                            </span>
                                        </div>

                                        {/* Changes Details */}
                                        {log.previousValues && log.newValues && (
                                            <div className="mt-2 p-2 bg-gray-50 dark:bg-dark-800 rounded text-sm">
                                                <div className="grid grid-cols-2 gap-2">
                                                    {Object.keys(log.newValues).map(key => (
                                                        <div key={key}>
                                                            <span className="text-gray-500">{key}:</span>{' '}
                                                            <span className="line-through text-red-500 mr-2">
                                                                {log.previousValues?.[key]?.toString() || '-'}
                                                            </span>
                                                            <span className="text-green-600 dark:text-green-400">
                                                                {log.newValues?.[key]?.toString() || '-'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {log.notes && (
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 italic">
                                                "{log.notes}"
                                            </p>
                                        )}

                                        {/* Metadata */}
                                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                                            <div className="flex items-center gap-1">
                                                <HiOutlineUser className="w-4 h-4" />
                                                {log.userName}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <HiOutlineClock className="w-4 h-4" />
                                                {formatTimestamp(log.timestamp)}
                                            </div>
                                            {log.ipAddress && (
                                                <span className="font-mono text-xs">
                                                    IP: {log.ipAddress}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

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

            {/* Info */}
            <Card padding="md" className="bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800">
                <div className="flex items-start gap-3">
                    <HiOutlineDocumentText className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-700 dark:text-blue-400">
                        <p className="font-medium mb-1">Sobre a Auditoria Fiscal</p>
                        <p>
                            Todos os documentos fiscais são rastreados automaticamente.
                            Este registo é essencial para auditorias da Autoridade Tributária e
                            permite verificar quem fez alterações e quando.
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
}
