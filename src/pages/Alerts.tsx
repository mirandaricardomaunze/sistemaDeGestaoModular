/**
 * AlertsPage - Full page view for managing all alerts
 * 
 * Uses the new modular notification system with filtering,
 * bulk actions, and module-specific views.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
    HiOutlineBell,
    HiOutlineArrowPath as HiOutlineArrowPath,
    HiOutlineCheck,
    HiOutlineCheckCircle,
    HiOutlineTrash,
    HiOutlineFunnel as HiOutlineFilter,
    HiOutlineExclamationTriangle as HiOutlineExclamationTriangle,
    HiOutlineExclamationCircle,
    HiOutlineInformationCircle,
    HiOutlineChevronRight,
    HiOutlineMagnifyingGlass,
    HiOutlineXMark
} from 'react-icons/hi2';
import { cn } from '../utils/helpers';
import { useAlerts, useUnreadCount } from '../hooks/useAlerts';
import { useTenant } from '../contexts/TenantContext';
import { Button, Badge, Card, Pagination, usePagination, Select, ConfirmationModal } from '../components/ui';
import type { Alert, AlertModule, AlertPriority } from '../services/api';

// ============================================================================
// Configuration
// ============================================================================

const MODULE_CONFIG: Record<string, { label: string }> = {
    inventory: { label: 'InventÃ¡rio' },
    invoices: { label: 'Facturas' },
    hospitality: { label: 'Hotelaria' },
    pharmacy: { label: 'FarmÃ¡cia' },
    crm: { label: 'CRM' },
    pos: { label: 'POS' },
};

// Each alert module is shown only if the tenant has at least one of these
// underlying modules enabled. Examples:
//   - "InventÃ¡rio" requires any product-carrying module (commercial/pharmacy/â€¦)
//   - "Hotelaria" requires the hospitality module
//   - Core modules (invoices, crm, pos) match themselves
const MODULE_REQUIRES: Record<string, string[]> = {
    inventory: ['commercial', 'pharmacy', 'bottle_store', 'restaurant'],
    invoices: ['invoices', 'commercial', 'pharmacy', 'hospitality', 'bottle_store', 'restaurant'],
    hospitality: ['hospitality'],
    pharmacy: ['pharmacy'],
    crm: ['crm'],
    pos: ['pos', 'commercial', 'pharmacy', 'bottle_store', 'restaurant'],
};

const PRIORITY_CONFIG: Record<AlertPriority, { label: string; color: string; icon: React.ReactNode }> = {
    critical: { label: 'CrÃ­tico', color: 'red', icon: <HiOutlineExclamationCircle className="w-5 h-5" /> },
    high: { label: 'Alto', color: 'orange', icon: <HiOutlineExclamationTriangle className="w-5 h-5" /> },
    medium: { label: 'MÃ©dio', color: 'yellow', icon: <HiOutlineInformationCircle className="w-5 h-5" /> },
    low: { label: 'Baixo', color: 'blue', icon: <HiOutlineInformationCircle className="w-5 h-5" /> }
};

// ============================================================================
// Component
// ============================================================================

export default function AlertsPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { hasModule } = useTenant();
    const [selectedModule, setSelectedModule] = useState<AlertModule | 'all'>('all');
    const [showResolved, setShowResolved] = useState(false);
    const [selectedPriority, setSelectedPriority] = useState<AlertPriority | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [confirmClearOpen, setConfirmClearOpen] = useState(false);
    const [isClearing, setIsClearing] = useState(false);

    // Server-side unread counts power the badges on module chips
    const { counts: unreadCounts } = useUnreadCount();

    const visibleModuleEntries = React.useMemo(
        () => Object.entries(MODULE_CONFIG).filter(([key]) => {
            const requires = MODULE_REQUIRES[key] ?? [key];
            return requires.some(m => hasModule(m));
        }),
        [hasModule]
    );

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

    const filteredAlerts = React.useMemo(() => {
        if (!searchQuery.trim()) return alerts;
        const q = searchQuery.trim().toLowerCase();
        return alerts.filter(a =>
            a.title.toLowerCase().includes(q) ||
            a.message.toLowerCase().includes(q)
        );
    }, [alerts, searchQuery]);

    const {
        currentPage,
        setCurrentPage,
        itemsPerPage,
        setItemsPerPage,
        paginatedItems: paginatedAlerts,
        totalItems,
    } = usePagination(filteredAlerts, 10);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const diffMs = Date.now() - date.getTime();
        const diffMin = Math.floor(diffMs / 60000);
        if (diffMin < 1) return 'agora mesmo';
        if (diffMin < 60) return `hÃ¡ ${diffMin} min`;
        const diffH = Math.floor(diffMin / 60);
        if (diffH < 24) return `hÃ¡ ${diffH} h`;
        const diffD = Math.floor(diffH / 24);
        if (diffD < 7) return `hÃ¡ ${diffD} d`;
        return date.toLocaleDateString('pt-MZ', {
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
            critical: 'border-l-red-500 bg-red-50 dark:bg-red-500/10 dark:backdrop-blur-sm',
            high: 'border-l-orange-500 bg-orange-50 dark:bg-orange-500/10 dark:backdrop-blur-sm',
            medium: 'border-l-yellow-500 bg-yellow-50 dark:bg-amber-500/10 dark:backdrop-blur-sm',
            low: 'border-l-blue-500 bg-blue-50 dark:bg-blue-500/10 dark:backdrop-blur-sm'
        };
        return classes[priority];
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <HiOutlineBell className="w-7 h-7 text-primary-600 dark:text-primary-400" />
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
                        <HiOutlineArrowPath className="w-4 h-4" />
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
                        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/15 border border-transparent dark:border-blue-500/20 flex items-center justify-center backdrop-blur-sm shadow-sm transition-transform hover:scale-110">
                            <HiOutlineBell className="w-6 h-6 text-blue-600 dark:text-blue-300" />
                        </div>
                    </div>
                </Card>
                <Card className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">NÃ£o Lidos</p>
                            <p className="text-2xl font-bold text-primary-600">{unreadCount}</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-500/15 border border-transparent dark:border-primary-500/20 flex items-center justify-center backdrop-blur-sm shadow-sm transition-transform hover:scale-110 relative">
                            <HiOutlineBell className="w-6 h-6 text-primary-600 dark:text-primary-300" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary-500 animate-pulse ring-2 ring-white dark:ring-dark-800" />
                            )}
                        </div>
                    </div>
                </Card>
                <Card className="p-4 border-l-4 border-l-red-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">CrÃ­ticos</p>
                            <p className="text-2xl font-bold text-red-600">{criticalCount}</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/15 border border-transparent dark:border-red-500/20 flex items-center justify-center backdrop-blur-sm shadow-sm transition-transform hover:scale-110">
                            <HiOutlineExclamationCircle className="w-6 h-6 text-red-600 dark:text-red-300" />
                        </div>
                    </div>
                </Card>
                <Card className="p-4 border-l-4 border-l-orange-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Alta Prioridade</p>
                            <p className="text-2xl font-bold text-orange-600">{highCount}</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-500/15 border border-transparent dark:border-orange-500/20 flex items-center justify-center backdrop-blur-sm shadow-sm transition-transform hover:scale-110">
                            <HiOutlineExclamationTriangle className="w-6 h-6 text-orange-600 dark:text-orange-300" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Filters */}
            <Card className="p-4 space-y-4">
                {/* Search bar */}
                <div className="relative">
                    <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Procurar por tÃ­tulo ou mensagem..."
                        className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    />
                    {searchQuery && (
                        <Button variant="ghost"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors"
                            aria-label="Limpar busca"
                        >
                            <HiOutlineXMark className="w-4 h-4" />
                        </Button>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-4 items-start">
                    {/* Module Filter */}
                    <div className="min-w-0">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            <HiOutlineFilter className="w-4 h-4 inline mr-1" />
                            MÃ³dulo
                        </label>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                size="sm"
                                variant={selectedModule === 'all' ? 'primary' : 'ghost'}
                                onClick={() => setSelectedModule('all')}
                                className={cn(
                                    'font-medium transition-colors gap-2',
                                    selectedModule !== 'all' && 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-dark-700 dark:text-gray-400'
                                )}
                            >
                                Todos
                                {unreadCounts?.total ? (
                                    <span className={cn(
                                        'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full',
                                        selectedModule === 'all' ? 'bg-white/25 text-white' : 'bg-gray-200 text-gray-700 dark:bg-dark-600 dark:text-gray-300'
                                    )}>{unreadCounts.total}</span>
                                ) : null}
                            </Button>
                            {visibleModuleEntries.map(([key, config]) => {
                                const moduleCount = unreadCounts?.byModule?.[key] ?? 0;
                                return (
                                    <Button
                                        key={key}
                                        size="sm"
                                        variant={selectedModule === key ? 'primary' : 'ghost'}
                                        onClick={() => setSelectedModule(key as AlertModule)}
                                        className={cn(
                                            'font-medium transition-colors gap-2',
                                            selectedModule !== key && 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-dark-700 dark:text-gray-400'
                                        )}
                                    >
                                        {config.label}
                                        {moduleCount > 0 && (
                                            <span className={cn(
                                                'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full',
                                                selectedModule === key ? 'bg-white/25 text-white' : 'bg-gray-200 text-gray-700 dark:bg-dark-600 dark:text-gray-300'
                                            )}>{moduleCount}</span>
                                        )}
                                    </Button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Priority Filter */}
                    <div>
                        <Select
                            label="Prioridade"
                            value={selectedPriority}
                            onChange={(e) => setSelectedPriority(e.target.value as AlertPriority | 'all')}
                            options={[
                                { value: 'all', label: 'Todas' },
                                { value: 'critical', label: 'CrÃ­tico' },
                                { value: 'high', label: 'Alto' },
                                { value: 'medium', label: 'MÃ©dio' },
                                { value: 'low', label: 'Baixo' }
                            ]}
                        />
                    </div>

                    {/* Show Resolved Toggle */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Estado
                        </label>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant={!showResolved ? 'primary' : 'ghost'}
                                onClick={() => setShowResolved(false)}
                                className={cn(
                                    'font-medium transition-colors',
                                    showResolved && 'bg-gray-100 text-gray-600 dark:bg-dark-700'
                                )}
                            >
                                Activos
                            </Button>
                            <Button
                                size="sm"
                                variant={showResolved ? 'primary' : 'ghost'}
                                onClick={() => setShowResolved(true)}
                                className={cn(
                                    'font-medium transition-colors',
                                    !showResolved && 'bg-gray-100 text-gray-600 dark:bg-dark-700'
                                )}
                            >
                                Incluir Resolvidos
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Bulk Actions â€” always visible so the affordance isn't hidden behind a toggle */}
                <div className="pt-4 border-t border-gray-200 dark:border-dark-600 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {totalItems > 0
                            ? `${totalItems} alerta${totalItems > 1 ? 's' : ''} ${searchQuery ? 'encontrado' + (totalItems > 1 ? 's' : '') : ''}`
                            : 'Sem alertas para os filtros actuais'}
                    </p>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmClearOpen(true)}
                        className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 gap-2"
                    >
                        <HiOutlineTrash className="w-4 h-4" />
                        Limpar Resolvidos
                    </Button>
                </div>
            </Card>

            <ConfirmationModal
                isOpen={confirmClearOpen}
                onClose={() => !isClearing && setConfirmClearOpen(false)}
                onConfirm={async () => {
                    try {
                        setIsClearing(true);
                        await clearResolved();
                        setConfirmClearOpen(false);
                    } finally {
                        setIsClearing(false);
                    }
                }}
                title="Limpar alertas resolvidos?"
                message="Todos os alertas marcados como resolvidos serÃ£o removidos permanentemente. Esta acÃ§Ã£o nÃ£o pode ser desfeita."
                confirmText="Sim, remover"
                cancelText="Cancelar"
                variant="danger"
                isLoading={isClearing}
            />

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
                            NÃ£o existem alertas para os filtros seleccionados.
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
                                    <div className={cn(
                                        'flex-shrink-0 mt-1',
                                        alert.priority === 'critical' ? 'text-red-600 dark:text-red-400' :
                                        alert.priority === 'high' ? 'text-orange-600 dark:text-orange-400' :
                                        alert.priority === 'medium' ? 'text-yellow-600 dark:text-yellow-400' : 'text-blue-600 dark:text-blue-400'
                                    )}>
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
