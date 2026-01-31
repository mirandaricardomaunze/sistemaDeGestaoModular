/**
 * AlertsPage - Full page view for managing all alerts
 * 
 * Uses the new modular notification system with filtering,
 * bulk actions, and module-specific views.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
    HiOutlineBell,
    HiOutlineRefresh,
    HiOutlineCheck,
    HiOutlineCheckCircle,
    HiOutlineTrash,
    HiOutlineFilter,
    HiOutlineExclamation,
    HiOutlineExclamationCircle,
    HiOutlineInformationCircle,
    HiOutlineChevronRight
} from 'react-icons/hi';
import { useAlerts } from '../hooks/useAlerts';
import { Button, Badge, Card, Pagination, usePagination } from '../components/ui';
import type { Alert, AlertModule, AlertPriority } from '../services/api';

// ============================================================================
// Configuration
// ============================================================================

const MODULE_CONFIG: Record<string, { label: string; color: string }> = {
    inventory: { label: 'Inventário', color: 'blue' },
    invoices: { label: 'Facturas', color: 'green' },
    hospitality: { label: 'Hotelaria', color: 'purple' },
    pharmacy: { label: 'Farmácia', color: 'red' },
    crm: { label: 'CRM', color: 'orange' },
    pos: { label: 'POS', color: 'cyan' },
};

const PRIORITY_CONFIG: Record<AlertPriority, { label: string; color: string; icon: React.ReactNode }> = {
    critical: { label: 'Crítico', color: 'red', icon: <HiOutlineExclamationCircle className="w-5 h-5" /> },
    high: { label: 'Alto', color: 'orange', icon: <HiOutlineExclamation className="w-5 h-5" /> },
    medium: { label: 'Médio', color: 'yellow', icon: <HiOutlineInformationCircle className="w-5 h-5" /> },
    low: { label: 'Baixo', color: 'blue', icon: <HiOutlineInformationCircle className="w-5 h-5" /> }
};

// ============================================================================
// Component
// ============================================================================

export default function AlertsPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [selectedModule, setSelectedModule] = useState<AlertModule | 'all'>('all');
    const [showResolved, setShowResolved] = useState(false);
    const [selectedPriority, setSelectedPriority] = useState<AlertPriority | 'all'>('all');

    const {
        alerts,
        isLoading,
        generateAlerts,
        markAsRead,
        markAsResolved,
        markAllAsRead,
        clearResolved,
        unreadCount,
        criticalCount,
        highCount
    } = useAlerts({
        module: selectedModule === 'all' ? undefined : selectedModule,
        isResolved: showResolved ? undefined : false,
        priority: selectedPriority === 'all' ? undefined : selectedPriority
    });

    const {
        currentPage,
        setCurrentPage,
        itemsPerPage,
        setItemsPerPage,
        paginatedItems: paginatedAlerts,
        totalItems,
    } = usePagination(alerts, 10);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('pt-MZ', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleAlertClick = async (alert: Alert) => {
        if (!alert.isRead) {
            await markAsRead(alert.id);
        }
        if (alert.actionUrl) {
            navigate(alert.actionUrl);
        }
    };

    const getPriorityClasses = (priority: AlertPriority): string => {
        const classes: Record<AlertPriority, string> = {
            critical: 'border-l-red-500 bg-red-50 dark:bg-red-900/10',
            high: 'border-l-orange-500 bg-orange-50 dark:bg-orange-900/10',
            medium: 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/10',
            low: 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/10'
        };
        return classes[priority];
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <HiOutlineBell className="w-7 h-7 text-primary-600" />
                        {t('alerts.title')}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        {t('alerts.description')}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateAlerts()}
                        className="gap-2"
                    >
                        <HiOutlineRefresh className="w-4 h-4" />
                        Gerar Alertas
                    </Button>
                    {unreadCount > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => markAllAsRead()}
                            className="gap-2"
                        >
                            <HiOutlineCheckCircle className="w-4 h-4" />
                            Marcar Todos Lidos
                        </Button>
                    )}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalItems}</p>
                        </div>
                        <HiOutlineBell className="w-8 h-8 text-gray-400" />
                    </div>
                </Card>
                <Card className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Não Lidos</p>
                            <p className="text-2xl font-bold text-primary-600">{unreadCount}</p>
                        </div>
                        <div className="w-3 h-3 rounded-full bg-primary-500 animate-pulse" />
                    </div>
                </Card>
                <Card className="p-4 border-l-4 border-l-red-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Críticos</p>
                            <p className="text-2xl font-bold text-red-600">{criticalCount}</p>
                        </div>
                        <HiOutlineExclamationCircle className="w-8 h-8 text-red-400" />
                    </div>
                </Card>
                <Card className="p-4 border-l-4 border-l-orange-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Alta Prioridade</p>
                            <p className="text-2xl font-bold text-orange-600">{highCount}</p>
                        </div>
                        <HiOutlineExclamation className="w-8 h-8 text-orange-400" />
                    </div>
                </Card>
            </div>

            {/* Filters */}
            <Card className="p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    {/* Module Filter */}
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            <HiOutlineFilter className="w-4 h-4 inline mr-1" />
                            Módulo
                        </label>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setSelectedModule('all')}
                                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
                                    ${selectedModule === 'all'
                                        ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-dark-700 dark:text-gray-400'}`}
                            >
                                Todos
                            </button>
                            {Object.entries(MODULE_CONFIG).map(([key, config]) => (
                                <button
                                    key={key}
                                    onClick={() => setSelectedModule(key as AlertModule)}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
                                        ${selectedModule === key
                                            ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-dark-700 dark:text-gray-400'}`}
                                >
                                    {config.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Priority Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Prioridade
                        </label>
                        <select
                            value={selectedPriority}
                            onChange={(e) => setSelectedPriority(e.target.value as AlertPriority | 'all')}
                            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-sm"
                        >
                            <option value="all">Todas</option>
                            <option value="critical">Crítico</option>
                            <option value="high">Alto</option>
                            <option value="medium">Médio</option>
                            <option value="low">Baixo</option>
                        </select>
                    </div>

                    {/* Show Resolved Toggle */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Estado
                        </label>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowResolved(false)}
                                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
                                    ${!showResolved
                                        ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30'
                                        : 'bg-gray-100 text-gray-600 dark:bg-dark-700'}`}
                            >
                                Activos
                            </button>
                            <button
                                onClick={() => setShowResolved(true)}
                                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
                                    ${showResolved
                                        ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30'
                                        : 'bg-gray-100 text-gray-600 dark:bg-dark-700'}`}
                            >
                                Todos
                            </button>
                        </div>
                    </div>
                </div>

                {/* Bulk Actions */}
                {showResolved && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-dark-600">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearResolved}
                            className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 gap-2"
                        >
                            <HiOutlineTrash className="w-4 h-4" />
                            Limpar Resolvidos
                        </Button>
                    </div>
                )}
            </Card>

            {/* Alerts List */}
            <Card className="overflow-hidden">
                {isLoading ? (
                    <div className="p-8 text-center">
                        <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full mx-auto mb-4" />
                        <p className="text-gray-500">A carregar alertas...</p>
                    </div>
                ) : totalItems === 0 ? (
                    <div className="p-12 text-center">
                        <HiOutlineCheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                            Sem Alertas
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400">
                            Não existem alertas para os filtros seleccionados.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100 dark:divide-dark-700">
                        {paginatedAlerts.map((alert) => (
                            <div
                                key={alert.id}
                                onClick={() => handleAlertClick(alert)}
                                className={`p-4 border-l-4 cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-dark-700
                                    ${getPriorityClasses(alert.priority)}
                                    ${!alert.isRead ? '' : 'opacity-75'}
                                    ${alert.isResolved ? 'opacity-50' : ''}`}
                            >
                                <div className="flex items-start gap-4">
                                    {/* Priority Icon */}
                                    <div className={`flex-shrink-0 mt-1 ${alert.priority === 'critical' ? 'text-red-500' :
                                        alert.priority === 'high' ? 'text-orange-500' :
                                            alert.priority === 'medium' ? 'text-yellow-600' : 'text-blue-500'
                                        }`}>
                                        {PRIORITY_CONFIG[alert.priority].icon}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            {alert.module && (
                                                <Badge variant="gray" size="sm">
                                                    {MODULE_CONFIG[alert.module]?.label || alert.module}
                                                </Badge>
                                            )}
                                            <Badge
                                                variant={
                                                    alert.priority === 'critical' ? 'danger' :
                                                        alert.priority === 'high' ? 'warning' : 'gray'
                                                }
                                                size="sm"
                                            >
                                                {PRIORITY_CONFIG[alert.priority].label}
                                            </Badge>
                                            {!alert.isRead && (
                                                <span className="w-2 h-2 rounded-full bg-primary-500" />
                                            )}
                                            {alert.isResolved && (
                                                <Badge variant="success" size="sm">Resolvido</Badge>
                                            )}
                                        </div>
                                        <h4 className={`text-sm font-medium text-gray-900 dark:text-white
                                            ${alert.isResolved ? 'line-through' : ''}`}>
                                            {alert.title}
                                        </h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                            {alert.message}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-2">
                                            {formatDate(alert.createdAt)}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {!alert.isResolved && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    markAsResolved(alert.id);
                                                }}
                                                className="text-green-600 hover:bg-green-50"
                                                title="Resolver"
                                            >
                                                <HiOutlineCheck className="w-4 h-4" />
                                            </Button>
                                        )}
                                        {alert.actionUrl && (
                                            <HiOutlineChevronRight className="w-5 h-5 text-gray-400" />
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {totalItems > 0 && (
                    <div className="px-6 py-4 border-t border-gray-100 dark:border-dark-700">
                        <Pagination
                            currentPage={currentPage}
                            totalItems={totalItems}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={setItemsPerPage}
                            showInfo={true}
                        />
                    </div>
                )}
            </Card>
        </div>
    );
}
