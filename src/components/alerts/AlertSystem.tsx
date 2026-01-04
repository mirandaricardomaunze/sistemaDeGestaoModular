import { useState, useMemo } from 'react';
import {
    HiOutlineBell,
    HiOutlineCheck,
    HiOutlineTrash,
    HiOutlineRefresh,
    HiOutlineCog,
    HiOutlineExclamationCircle,
    HiOutlineInformationCircle,
} from 'react-icons/hi';
import { Button, Card, Modal, Badge, Input, EmptyState, LoadingSpinner } from '../ui';
import { formatRelativeTime, cn } from '../../utils/helpers';
import { alertTypeLabels, priorityLabels } from '../../utils/constants';
import type { Alert, AlertPriority, AlertType, AlertConfig } from '../../types';

import toast from 'react-hot-toast';
import { useAlerts } from '../../hooks/useData';

const priorityConfig: Record<AlertPriority, { color: string; bgColor: string; icon: React.ReactNode }> = {
    critical: {
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-100 dark:bg-red-900/30',
        icon: <HiOutlineExclamationCircle className="w-5 h-5" />,
    },
    high: {
        color: 'text-orange-600 dark:text-orange-400',
        bgColor: 'bg-orange-100 dark:bg-orange-900/30',
        icon: <HiOutlineExclamationCircle className="w-5 h-5" />,
    },
    medium: {
        color: 'text-yellow-600 dark:text-yellow-400',
        bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
        icon: <HiOutlineBell className="w-5 h-5" />,
    },
    low: {
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-100 dark:bg-blue-900/30',
        icon: <HiOutlineInformationCircle className="w-5 h-5" />,
    },
};

// Default alert configuration (can be fetched from settings API if needed)
const defaultAlertConfig: AlertConfig = {
    lowStockThreshold: 10,
    expiryWarningDays: 30,
    paymentDueDays: 7,
    enableEmailAlerts: false,
    enablePushNotifications: true,
};

export default function AlertSystem() {
    // Use API hook for real data
    const {
        alerts,
        isLoading,
        error,
        refetch,
        markAsRead,
        markAsResolved,
        deleteAlert,
        markAllAsRead,
        unreadCount,
    } = useAlerts();

    const [filterPriority, setFilterPriority] = useState<AlertPriority | 'all'>('all');
    const [filterType, setFilterType] = useState<AlertType | 'all'>('all');
    const [filterStatus, setFilterStatus] = useState<'all' | 'unread' | 'unresolved'>('all');
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [configForm, setConfigForm] = useState<AlertConfig>(defaultAlertConfig);

    // Filter alerts
    const filteredAlerts = useMemo(() => {
        return alerts
            .filter((alert) => {
                if (filterPriority !== 'all' && alert.priority !== filterPriority) return false;
                if (filterType !== 'all' && alert.type !== filterType) return false;
                if (filterStatus === 'unread' && alert.isRead) return false;
                if (filterStatus === 'unresolved' && alert.isResolved) return false;
                return true;
            })
            .sort((a, b) => {
                // Sort by priority first, then by date
                const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
                if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                    return priorityOrder[a.priority] - priorityOrder[b.priority];
                }
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });
    }, [alerts, filterPriority, filterType, filterStatus]);

    // Stats
    const stats = useMemo(() => ({
        total: alerts.length,
        unread: unreadCount,
        critical: alerts.filter((a) => a.priority === 'critical' && !a.isResolved).length,
        unresolved: alerts.filter((a) => !a.isResolved).length,
    }), [alerts, unreadCount]);

    // Actions
    const handleMarkAsRead = async (alert: Alert) => {
        try {
            await markAsRead(alert.id);
            toast.success('Marcado como lido');
        } catch {
            toast.error('Erro ao marcar como lido');
        }
    };

    const handleMarkAsResolved = async (alert: Alert) => {
        try {
            await markAsResolved(alert.id);
        } catch {
            toast.error('Erro ao resolver alerta');
        }
    };

    const handleDelete = async (alert: Alert) => {
        try {
            await deleteAlert(alert.id);
            toast.success('Alerta excluído');
        } catch {
            toast.error('Erro ao excluir alerta');
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await markAllAsRead();
        } catch {
            toast.error('Erro ao marcar todos como lidos');
        }
    };

    const handleSaveConfig = () => {
        // TODO: Connect to settings API when available
        setShowConfigModal(false);
        toast.success('Configurações salvas');
    };

    const priorityOptions = [
        { value: 'all', label: 'Todas as prioridades' },
        ...Object.entries(priorityLabels).map(([value, label]) => ({ value, label })),
    ];

    const typeOptions = [
        { value: 'all', label: 'Todos os tipos' },
        ...Object.entries(alertTypeLabels).map(([value, label]) => ({ value, label })),
    ];

    const statusOptions = [
        { value: 'all', label: 'Todos' },
        { value: 'unread', label: 'Não lidos' },
        { value: 'unresolved', label: 'Não resolvidos' },
    ];

    // Loading state
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <p className="text-red-500">{error}</p>
                <Button onClick={() => refetch()}>
                    <HiOutlineRefresh className="w-5 h-5 mr-2" />
                    Tentar Novamente
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card padding="md">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-dark-700 flex items-center justify-center">
                            <HiOutlineBell className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {stats.total}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
                        </div>
                    </div>
                </Card>

                <Card padding="md">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                            <HiOutlineBell className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {stats.unread}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Não lidos</p>
                        </div>
                    </div>
                </Card>

                <Card padding="md">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                            <HiOutlineExclamationCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {stats.critical}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Críticos</p>
                        </div>
                    </div>
                </Card>

                <Card padding="md">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                            <HiOutlineRefresh className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {stats.unresolved}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Pendentes</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Filters */}
            <Card padding="md">
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                    <div className="flex flex-wrap gap-3">
                        {/* Priority Filter */}
                        <select
                            className="input py-2 w-auto"
                            value={filterPriority}
                            onChange={(e) => setFilterPriority(e.target.value as AlertPriority | 'all')}
                        >
                            {priorityOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>

                        {/* Type Filter */}
                        <select
                            className="input py-2 w-auto"
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value as AlertType | 'all')}
                        >
                            {typeOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>

                        {/* Status Filter */}
                        <select
                            className="input py-2 w-auto"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value as 'all' | 'unread' | 'unresolved')}
                        >
                            {statusOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleMarkAllAsRead}
                            disabled={stats.unread === 0}
                        >
                            <HiOutlineCheck className="w-4 h-4 mr-2" />
                            Marcar todos como lido
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowConfigModal(true)}
                        >
                            <HiOutlineCog className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Alerts List */}
            <Card padding="none">
                {filteredAlerts.length === 0 ? (
                    <EmptyState
                        icon={<HiOutlineBell className="w-8 h-8" />}
                        title="Nenhum alerta encontrado"
                        description="Não há alertas que correspondam aos filtros selecionados."
                    />
                ) : (
                    <div className="divide-y divide-gray-200 dark:divide-dark-700">
                        {filteredAlerts.map((alert) => {
                            const config = priorityConfig[alert.priority];

                            return (
                                <div
                                    key={alert.id}
                                    className={cn(
                                        'p-4 hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors',
                                        !alert.isRead && 'bg-primary-50/50 dark:bg-primary-900/10'
                                    )}
                                >
                                    <div className="flex items-start gap-4">
                                        {/* Icon */}
                                        <div
                                            className={cn(
                                                'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                                                config.bgColor,
                                                config.color
                                            )}
                                        >
                                            {config.icon}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h4 className="font-medium text-gray-900 dark:text-white">
                                                            {alert.title}
                                                        </h4>
                                                        <Badge
                                                            variant={
                                                                alert.priority === 'critical'
                                                                    ? 'danger'
                                                                    : alert.priority === 'high'
                                                                        ? 'warning'
                                                                        : alert.priority === 'medium'
                                                                            ? 'info'
                                                                            : 'gray'
                                                            }
                                                            size="sm"
                                                        >
                                                            {priorityLabels[alert.priority]}
                                                        </Badge>
                                                        <Badge variant="gray" size="sm">
                                                            {alertTypeLabels[alert.type]}
                                                        </Badge>
                                                        {alert.isResolved && (
                                                            <Badge variant="success" size="sm">
                                                                Resolvido
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-gray-600 dark:text-gray-300">
                                                        {alert.message}
                                                    </p>
                                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                        {formatRelativeTime(alert.createdAt)}
                                                    </p>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex items-center gap-1">
                                                    {!alert.isRead && (
                                                        <button
                                                            onClick={() => handleMarkAsRead(alert)}
                                                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-500 hover:text-primary-600 transition-colors"
                                                            title="Marcar como lido"
                                                        >
                                                            <HiOutlineCheck className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {!alert.isResolved && (
                                                        <button
                                                            onClick={() => handleMarkAsResolved(alert)}
                                                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-500 hover:text-green-600 transition-colors"
                                                            title="Marcar como resolvido"
                                                        >
                                                            <HiOutlineRefresh className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDelete(alert)}
                                                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-500 hover:text-red-600 transition-colors"
                                                        title="Excluir"
                                                    >
                                                        <HiOutlineTrash className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>

            {/* Config Modal */}
            <Modal
                isOpen={showConfigModal}
                onClose={() => setShowConfigModal(false)}
                title="Configurações de Alertas"
            >
                <div className="space-y-4">
                    <Input
                        label="Limite de estoque baixo"
                        type="number"
                        value={configForm.lowStockThreshold}
                        onChange={(e) =>
                            setConfigForm((prev) => ({
                                ...prev,
                                lowStockThreshold: parseInt(e.target.value) || 0,
                            }))
                        }
                        helperText="Gerar alerta quando estoque estiver abaixo deste valor"
                    />

                    <Input
                        label="Dias para aviso de vencimento"
                        type="number"
                        value={configForm.expiryWarningDays}
                        onChange={(e) =>
                            setConfigForm((prev) => ({
                                ...prev,
                                expiryWarningDays: parseInt(e.target.value) || 0,
                            }))
                        }
                        helperText="Alertar sobre produtos que vencem em X dias"
                    />

                    <Input
                        label="Dias para aviso de pagamento"
                        type="number"
                        value={configForm.paymentDueDays}
                        onChange={(e) =>
                            setConfigForm((prev) => ({
                                ...prev,
                                paymentDueDays: parseInt(e.target.value) || 0,
                            }))
                        }
                        helperText="Alertar sobre pagamentos que vencem em X dias"
                    />

                    <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-dark-700">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={configForm.enableEmailAlerts}
                                onChange={(e) =>
                                    setConfigForm((prev) => ({
                                        ...prev,
                                        enableEmailAlerts: e.target.checked,
                                    }))
                                }
                                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                Receber alertas por email
                            </span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={configForm.enablePushNotifications}
                                onChange={(e) =>
                                    setConfigForm((prev) => ({
                                        ...prev,
                                        enablePushNotifications: e.target.checked,
                                    }))
                                }
                                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                Receber notificações push
                            </span>
                        </label>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button
                            variant="ghost"
                            className="flex-1"
                            onClick={() => setShowConfigModal(false)}
                        >
                            Cancelar
                        </Button>
                        <Button className="flex-1" onClick={handleSaveConfig}>
                            Salvar
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
