import { logger } from '../../utils/logger';
/**
 * Audit Log Viewer Component
 * Visualizador de logs de auditoria com filtros e exportação
 */

import { useState, useMemo, useEffect } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import {
    HiOutlineMagnifyingGlass as HiOutlineMagnifyingGlass,
    HiOutlineArrowDownTray as HiOutlineArrowDownTray,
    HiOutlineFunnel as HiOutlineFilter,
    HiOutlineXMark as HiOutlineXMark,
    HiOutlineDocumentText,
    HiOutlineEye,
    HiOutlineArrowPath as HiOutlineArrowPath,
    HiOutlineChartPie,
    HiOutlineTrash,
    HiOutlineCheckCircle,
    HiOutlineExclamationCircle,
    HiOutlineInformationCircle,
    HiOutlineExclamationTriangle as HiOutlineExclamationTriangle,
} from 'react-icons/hi2';
import { useAuditStore } from '../../stores/useAuditStore';
import { useStore } from '../../stores/useStore';
import { Button, Card, Input, Select, Modal, Badge, SmartTable, usePagination } from '../ui';
import {
    MODULE_LABELS,
    ACTION_LABELS,
    SEVERITY_CONFIG,
    type AuditLog,
    type AuditModule,
    type AuditAction,
    type AuditSeverity,
    type AuditLogFilter,
} from '../../types/audit';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';

export default function AuditLogViewer() {
    const { logs, getFilteredLogs, getStats, exportLogs, clearAllLogs, loadFromDatabase } = useAuditStore();
    const { companySettings } = useStore();

    // Fetch initial logs
    useEffect(() => {
        loadFromDatabase();
    }, [loadFromDatabase]);

    // Filter state
    const [filters, setFilters] = useState<AuditLogFilter>({});
    const [showFilters, setShowFilters] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
    const [showStatsModal, setShowStatsModal] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);


    // Get filtered logs
    const filteredLogs = useMemo(() => {
        return getFilteredLogs(filters);
    }, [logs, filters, getFilteredLogs]);

    // Get statistics
    const stats = useMemo(() => {
        return getStats(filters);
    }, [filteredLogs, getStats, filters]);

    // Pagination
    const {
        currentPage,
        setCurrentPage,
        itemsPerPage,
        setItemsPerPage,
        paginatedItems: paginatedLogs,
        totalItems,
    } = usePagination(filteredLogs, 20);

    // Get unique users for filter dropdown
    const uniqueUsers = useMemo(() => {
        const users = new Map<string, string>();
        logs.forEach((log) => {
            if (!users.has(log.userId)) {
                users.set(log.userId, log.userName);
            }
        });
        return Array.from(users, ([id, name]) => ({ value: id, label: name }));
    }, [logs]);

    // Module options for filter
    const moduleOptions = Object.entries(MODULE_LABELS).map(([value, label]) => ({
        value,
        label,
    }));

    // Action options for filter
    const actionOptions = Object.entries(ACTION_LABELS).map(([value, label]) => ({
        value,
        label,
    }));

    // Severity options for filter
    const severityOptions = Object.entries(SEVERITY_CONFIG).map(([value, config]) => ({
        value,
        label: config.label,
    }));

    // Clear filters
    const handleClearFilters = () => {
        setFilters({});
        loadFromDatabase({});
    };

    // Refresh logs from database
    const handleRefresh = () => {
        loadFromDatabase({
            startDate: filters.startDate,
            endDate: filters.endDate,
            userId: filters.userId,
            action: filters.action,
            entityType: filters.module, // Map module to entityType for API
        });
        toast.success('Logs atualizados!');
    };


    // Export handlers
    const handleExportCSV = () => {
        const csv = exportLogs(filters, 'csv');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Logs exportados para CSV!');
    };

    const handleExportJSON = () => {
        const json = exportLogs(filters, 'json');
        const blob = new Blob([json], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `audit_logs_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Logs exportados para JSON!');
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();
        const logsToExport = getFilteredLogs(filters).slice(0, 100); // Limit to 100 for PDF
        const pageWidth = 210;

        let y = 20;
        const lineHeight = 7;
        const pageHeight = 280;

        // Add Company Logo if available
        if (companySettings?.logo) {
            try {
                const logoHeight = 20;
                const logoWidth = 20;
                // Center the logo
                const x = (pageWidth - logoWidth) / 2;
                doc.addImage(companySettings.logo, 'PNG', x, y, logoWidth, logoHeight);
                y += logoHeight + 5;
            } catch (e) {
                logger.warn("Logo error", e);
            }
        }

        // Title
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(companySettings?.tradeName || 'Relatório de Auditoria', pageWidth / 2, y, { align: 'center' });
        y += 8;

        if (companySettings?.tradeName) {
            doc.setFontSize(12);
            doc.text('Relatório de Auditoria', pageWidth / 2, y, { align: 'center' });
            y += 10;
        }

        // Period info
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-MZ')}`, pageWidth / 2, y, { align: 'center' });
        y += 5;
        doc.text(`Total de registos: ${filteredLogs.length}`, pageWidth / 2, y, { align: 'center' });
        y += 15;

        // Headers
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('Data/Hora', 10, y);
        doc.text('Utilizador', 40, y);
        doc.text('Módulo', 75, y);
        doc.text('Ação', 100, y);
        doc.text('Descrição', 125, y);
        y += 2;
        doc.line(10, y, 200, y);
        y += lineHeight;

        // Data rows
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);

        logsToExport.forEach((log) => {
            if (y > pageHeight) {
                doc.addPage();
                y = 20;
            }

            const date = new Date(log.timestamp).toLocaleString('pt-MZ', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
            });

            doc.text(date, 10, y);
            doc.text(log.userName.substring(0, 15), 40, y);
            doc.text(MODULE_LABELS[log.module].substring(0, 12), 75, y);
            doc.text(ACTION_LABELS[log.action].substring(0, 12), 100, y);
            doc.text(log.description.substring(0, 40), 125, y);

            y += lineHeight;
        });

        // Save
        doc.save(`audit_report_${new Date().toISOString().split('T')[0]}.pdf`);
        toast.success('Relatório PDF gerado!');
    };

    // View log details
    const handleViewDetails = (log: AuditLog) => {
        setSelectedLog(log);
        setShowDetailsModal(true);
    };

    // Clear all logs
    const handleClearLogs = () => {
        clearAllLogs();
        setShowClearConfirm(false);
        toast.success('Todos os logs foram limpos!');
    };

    // Get severity icon
    const getSeverityIcon = (severity: AuditSeverity) => {
        switch (severity) {
            case 'info':
                return <HiOutlineInformationCircle className="w-5 h-5 text-blue-500" />;
            case 'warning':
                return <HiOutlineExclamationTriangle className="w-5 h-5 text-yellow-500" />;
            case 'error':
                return <HiOutlineExclamationCircle className="w-5 h-5 text-red-500" />;
            case 'critical':
                return <HiOutlineExclamationCircle className="w-5 h-5 text-red-700" />;
        }
    };

    // Get action color
    const getActionBadge = (action: AuditAction, success: boolean) => {
        if (!success) {
            return <Badge variant="danger">{ACTION_LABELS[action]}</Badge>;
        }

        const variants: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'gray'> = {
            create: 'success',
            update: 'primary',
            delete: 'danger',
            login: 'success',
            logout: 'gray',
            login_failed: 'danger',
            export: 'info',
            payment: 'success',
            refund: 'warning',
            approve: 'success',
            reject: 'danger',
            CREATE: 'success',
            UPDATE: 'primary',
            DELETE: 'danger',
            LOGIN: 'success',
            REGISTER: 'success',
            PASSWORD_CHANGE: 'warning',
        };


        return <Badge variant={variants[action] || 'gray'}>{ACTION_LABELS[action]}</Badge>;
    };

    const columns: ColumnDef<AuditLog, unknown>[] = [
        {
            header: 'Data/Hora',
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    {getSeverityIcon(row.original.severity)}
                    <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {new Date(row.original.timestamp).toLocaleDateString('pt-MZ')}
                        </p>
                        <p className="text-xs text-gray-500">
                            {new Date(row.original.timestamp).toLocaleTimeString('pt-MZ')}
                        </p>
                    </div>
                </div>
            ),
        },
        {
            header: 'Utilizador',
            cell: ({ row }) => (
                <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {row.original.userName}
                    </p>
                    {row.original.userRole && (
                        <p className="text-xs text-gray-500">{row.original.userRole}</p>
                    )}
                </div>
            ),
        },
        {
            header: 'Modulo',
            cell: ({ row }) => <Badge variant="gray">{MODULE_LABELS[row.original.module]}</Badge>,
        },
        {
            header: 'Acao',
            cell: ({ row }) => getActionBadge(row.original.action, row.original.success),
        },
        {
            header: 'Descricao',
            cell: ({ row }) => (
                <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 max-w-xs truncate">
                        {row.original.description}
                    </p>
                    {row.original.entityName && (
                        <p className="text-xs text-gray-500">
                            {row.original.entityType}: {row.original.entityName}
                        </p>
                    )}
                </div>
            ),
        },
        {
            header: 'Estado',
            cell: ({ row }) => (
                <div className="flex justify-center">
                    {row.original.success ? (
                        <HiOutlineCheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                        <HiOutlineExclamationCircle className="w-5 h-5 text-red-500" />
                    )}
                </div>
            ),
        },
        {
            header: 'Accoes',
            cell: ({ row }) => (
                <div className="text-right">
                    <Button variant="ghost"
                        type="button"
                        onClick={() => handleViewDetails(row.original)}
                        aria-label="Ver detalhes"
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-lg"
                    >
                        <HiOutlineEye className="w-5 h-5" />
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <HiOutlineDocumentText className="w-6 h-6" />
                        Logs de Auditoria
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {filteredLogs.length} registos encontrados
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                        leftIcon={<HiOutlineArrowPath className="w-4 h-4" />}
                    >
                        Atualizar
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowFilters(!showFilters)}
                        leftIcon={<HiOutlineFilter className="w-4 h-4" />}
                        className={showFilters ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-500' : ''}
                    >
                        Filtros
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowStatsModal(true)}
                        leftIcon={<HiOutlineChartPie className="w-4 h-4" />}
                    >
                        Estatísticas
                    </Button>
                    <div className="relative group">
                        <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<HiOutlineArrowDownTray className="w-4 h-4" />}
                        >
                            Exportar
                        </Button>
                        <div className="absolute right-0 top-full mt-1 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-[120px]" role="menu">
                            <Button variant="ghost"
                                type="button"
                                onClick={handleExportCSV}
                                role="menuitem"
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-t-lg focus:outline-none focus-visible:bg-gray-100 dark:focus-visible:bg-dark-700"
                            >
                                CSV
                            </Button>
                            <Button variant="ghost"
                                type="button"
                                onClick={handleExportJSON}
                                role="menuitem"
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-700 focus:outline-none focus-visible:bg-gray-100 dark:focus-visible:bg-dark-700"
                            >
                                JSON
                            </Button>
                            <Button variant="ghost"
                                type="button"
                                onClick={handleExportPDF}
                                role="menuitem"
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-b-lg focus:outline-none focus-visible:bg-gray-100 dark:focus-visible:bg-dark-700"
                            >
                                PDF
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters Panel */}
            {showFilters && (
                <Card padding="md" className="bg-gray-50 dark:bg-dark-800">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-gray-900 dark:text-white">Filtros</h3>
                        <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                                <HiOutlineArrowPath className="w-4 h-4 mr-1" />
                                Limpar
                            </Button>
                            <Button variant="ghost"
                                type="button"
                                onClick={() => setShowFilters(false)}
                                aria-label="Fechar filtros"
                                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                            >
                                <HiOutlineXMark className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Input
                            label="Pesquisar"
                            placeholder="Descrição, utilizador..."
                            value={filters.searchTerm || ''}
                            onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                            leftIcon={<HiOutlineMagnifyingGlass className="w-5 h-5 text-gray-400" />}
                        />

                        <Input
                            label="Data Início"
                            type="date"
                            value={filters.startDate || ''}
                            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                        />

                        <Input
                            label="Data Fim"
                            type="date"
                            value={filters.endDate || ''}
                            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                        />

                        <Select
                            label="Utilizador"
                            options={[{ value: '', label: 'Todos' }, ...uniqueUsers]}
                            value={filters.userId || ''}
                            onChange={(e) => setFilters({ ...filters, userId: e.target.value || undefined })}
                        />

                        <Select
                            label="Módulo"
                            options={[{ value: '', label: 'Todos' }, ...moduleOptions]}
                            value={filters.module || ''}
                            onChange={(e) => setFilters({ ...filters, module: e.target.value as AuditModule || undefined })}
                        />

                        <Select
                            label="Ação"
                            options={[{ value: '', label: 'Todas' }, ...actionOptions]}
                            value={filters.action || ''}
                            onChange={(e) => setFilters({ ...filters, action: e.target.value as AuditAction || undefined })}
                        />

                        <Select
                            label="Severidade"
                            options={[{ value: '', label: 'Todas' }, ...severityOptions]}
                            value={filters.severity || ''}
                            onChange={(e) => setFilters({ ...filters, severity: e.target.value as AuditSeverity || undefined })}
                        />

                        <Select
                            label="Estado"
                            options={[
                                { value: '', label: 'Todos' },
                                { value: 'true', label: 'Sucesso' },
                                { value: 'false', label: 'Falha' },
                            ]}
                            value={filters.success === undefined ? '' : String(filters.success)}
                            onChange={(e) => setFilters({
                                ...filters,
                                success: e.target.value === '' ? undefined : e.target.value === 'true',
                            })}
                        />
                    </div>
                </Card>
            )}

            {/* Logs Table */}
            <SmartTable
                data={paginatedLogs}
                columns={columns}
                hideToolbar
                emptyTitle="Nenhum log encontrado"
                emptyDescription="Nenhum registo de auditoria corresponde aos filtros atuais."
                pagination={{
                    currentPage,
                    totalItems,
                    itemsPerPage,
                    onPageChange: setCurrentPage,
                    onItemsPerPageChange: setItemsPerPage,
                }}
            />
            {/* Admin Actions */}
            <div className="flex justify-end">
                <Button
                    variant="ghost"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => setShowClearConfirm(true)}
                    leftIcon={<HiOutlineTrash className="w-4 h-4" />}
                >
                    Limpar Todos os Logs
                </Button>
            </div>

            {/* Details Modal */}
            <Modal
                isOpen={showDetailsModal}
                onClose={() => setShowDetailsModal(false)}
                title="Detalhes do Log"
                size="lg"
            >
                {selectedLog && (
                    <div className="space-y-4">
                        {/* Header Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-gray-500">Data/Hora</p>
                                <p className="font-medium text-gray-900 dark:text-white">
                                    {new Date(selectedLog.timestamp).toLocaleString('pt-MZ')}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Utilizador</p>
                                <p className="font-medium text-gray-900 dark:text-white">
                                    {selectedLog.userName}
                                    {selectedLog.userRole && ` (${selectedLog.userRole})`}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Módulo</p>
                                <Badge variant="gray">{MODULE_LABELS[selectedLog.module]}</Badge>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Ação</p>
                                {getActionBadge(selectedLog.action, selectedLog.success)}
                            </div>
                        </div>

                        {/* Description */}
                        <div className="p-3 bg-gray-50 dark:bg-dark-800 rounded-lg">
                            <p className="text-sm text-gray-500 mb-1">Descrição</p>
                            <p className="text-gray-900 dark:text-white">{selectedLog.description}</p>
                        </div>

                        {/* Entity Info */}
                        {(selectedLog.entityType || selectedLog.entityId) && (
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <p className="text-sm text-gray-500">Tipo de Entidade</p>
                                    <p className="font-medium">{selectedLog.entityType}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">ID da Entidade</p>
                                    <p className="font-mono text-sm">{selectedLog.entityId || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Nome</p>
                                    <p className="font-medium">{selectedLog.entityName || '-'}</p>
                                </div>
                            </div>
                        )}

                        {/* Error Details */}
                        {!selectedLog.success && selectedLog.errorMessage && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                                <p className="text-sm text-red-700 dark:text-red-400 font-medium mb-1">
                                    Mensagem de Erro
                                </p>
                                <p className="text-red-600 dark:text-red-300">{selectedLog.errorMessage}</p>
                            </div>
                        )}

                        {/* Previous and New Values */}
                        {(selectedLog.previousValues || selectedLog.newValues) && (
                            <div className="grid grid-cols-2 gap-4">
                                {selectedLog.previousValues && (
                                    <div>
                                        <p className="text-sm text-gray-500 mb-2">Valores Anteriores</p>
                                        <pre className="p-3 bg-gray-100 dark:bg-dark-800 rounded-lg text-xs overflow-auto max-h-40">
                                            {JSON.stringify(selectedLog.previousValues, null, 2)}
                                        </pre>
                                    </div>
                                )}
                                {selectedLog.newValues && (
                                    <div>
                                        <p className="text-sm text-gray-500 mb-2">Novos Valores</p>
                                        <pre className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-xs overflow-auto max-h-40">
                                            {JSON.stringify(selectedLog.newValues, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Additional Details */}
                        {selectedLog.details && (
                            <div>
                                <p className="text-sm text-gray-500 mb-2">Detalhes Adicionais</p>
                                <pre className="p-3 bg-gray-100 dark:bg-dark-800 rounded-lg text-xs overflow-auto max-h-40">
                                    {JSON.stringify(selectedLog.details, null, 2)}
                                </pre>
                            </div>
                        )}

                        {/* Metadata */}
                        <div className="pt-4 border-t border-gray-200 dark:border-dark-700">
                            <p className="text-xs text-gray-400">ID: {selectedLog.id}</p>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Statistics Modal */}
            <Modal
                isOpen={showStatsModal}
                onClose={() => setShowStatsModal(false)}
                title="Estatísticas de Auditoria"
                size="lg"
            >
                <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg text-center">
                            <p className="text-2xl font-bold text-primary-600">{stats.totalLogs}</p>
                            <p className="text-sm text-primary-700 dark:text-primary-300">Total Logs</p>
                        </div>
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
                            <p className="text-2xl font-bold text-red-600">{stats.failedActions}</p>
                            <p className="text-sm text-red-700 dark:text-red-300">Falhas</p>
                        </div>
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                            <p className="text-2xl font-bold text-green-600">{stats.byUser.length}</p>
                            <p className="text-sm text-green-700 dark:text-green-300">Utilizadores</p>
                        </div>
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                            <p className="text-2xl font-bold text-blue-600">
                                {Object.keys(stats.byModule).length}
                            </p>
                            <p className="text-sm text-blue-700 dark:text-blue-300">Módulos</p>
                        </div>
                    </div>

                    {/* By Severity */}
                    <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Por Severidade</h4>
                        <div className="flex gap-4 flex-wrap">
                            {Object.entries(stats.bySeverity).map(([severity, count]) => (
                                <div
                                    key={severity}
                                    className={`px-4 py-2 rounded-lg ${SEVERITY_CONFIG[severity as AuditSeverity].bgColor}`}
                                >
                                    <span className={`font-semibold ${SEVERITY_CONFIG[severity as AuditSeverity].color}`}>
                                        {count}
                                    </span>
                                    <span className="text-sm text-gray-600 ml-2">
                                        {SEVERITY_CONFIG[severity as AuditSeverity].label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Top Users */}
                    <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Top Utilizadores</h4>
                        <div className="space-y-2">
                            {stats.byUser.slice(0, 5).map((user) => (
                                <div key={user.userId} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-dark-800 rounded-lg">
                                    <span className="text-gray-700 dark:text-gray-300">{user.userName}</span>
                                    <Badge variant="primary">{user.count}</Badge>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* By Module */}
                    <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Por Módulo</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {Object.entries(stats.byModule)
                                .sort(([, a], [, b]) => b - a)
                                .slice(0, 9)
                                .map(([module, count]) => (
                                    <div key={module} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-dark-800 rounded-lg">
                                        <span className="text-sm text-gray-700 dark:text-gray-300">
                                            {MODULE_LABELS[module as AuditModule]}
                                        </span>
                                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{count}</span>
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Clear Confirmation Modal */}
            <Modal
                isOpen={showClearConfirm}
                onClose={() => setShowClearConfirm(false)}
                title="Confirmar Limpeza de Logs"
                size="sm"
            >
                <div className="space-y-4">
                    <p className="text-gray-600 dark:text-gray-300">
                        Tem certeza que deseja eliminar <strong>todos os {logs.length} registos</strong> de auditoria?
                    </p>
                    <p className="text-sm text-red-600 dark:text-red-400">
                        Esta ação não pode ser desfeita.
                    </p>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="ghost" onClick={() => setShowClearConfirm(false)}>
                            Cancelar
                        </Button>
                        <Button variant="danger" onClick={handleClearLogs}>
                            Limpar Todos
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
