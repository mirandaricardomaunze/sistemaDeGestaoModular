/**
 * NotificationCenter Component
 * 
 * Central notification hub with module filtering, priority indicators,
 * and quick actions for managing alerts across all system modules.
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    HiOutlineBell,
    HiOutlineCheck,
    HiOutlineCheckCircle,
    HiOutlineX,
    HiOutlineExclamation,
    HiOutlineExclamationCircle,
    HiOutlineInformationCircle,
    HiOutlineChevronRight,
    HiOutlineRefresh,
    HiOutlineTrash,
    HiOutlineFilter
} from 'react-icons/hi';
import { useAlerts, useUnreadCount } from '../../hooks/useAlerts';
import { Button, Badge } from '../ui';
import type { Alert, AlertModule, AlertPriority } from '../../services/api';

// ============================================================================
// Module Configuration
// ============================================================================

const MODULE_CONFIG: Record<string, { label: string; color: string; icon?: string }> = {
    inventory: { label: 'Inventário', color: 'blue' },
    invoices: { label: 'Facturas', color: 'green' },
    hospitality: { label: 'Hotelaria', color: 'purple' },
    pharmacy: { label: 'Farmácia', color: 'red' },
    crm: { label: 'CRM', color: 'orange' },
    pos: { label: 'POS', color: 'cyan' },
    general: { label: 'Geral', color: 'gray' }
};

const PRIORITY_CONFIG: Record<AlertPriority, { label: string; color: string; icon: React.ReactNode }> = {
    critical: {
        label: 'Crítico',
        color: 'red',
        icon: <HiOutlineExclamationCircle className="w-4 h-4" />
    },
    high: {
        label: 'Alto',
        color: 'orange',
        icon: <HiOutlineExclamation className="w-4 h-4" />
    },
    medium: {
        label: 'Médio',
        color: 'yellow',
        icon: <HiOutlineInformationCircle className="w-4 h-4" />
    },
    low: {
        label: 'Baixo',
        color: 'blue',
        icon: <HiOutlineInformationCircle className="w-4 h-4" />
    }
};

// ============================================================================
// NotificationCenter Component
// ============================================================================

interface NotificationCenterProps {
    isOpen: boolean;
    onClose: () => void;
    className?: string;
}

export default function NotificationCenter({ isOpen, onClose, className = '' }: NotificationCenterProps) {
    const navigate = useNavigate();
    const containerRef = useRef<HTMLDivElement>(null);
    const [selectedModule, setSelectedModule] = useState<AlertModule | 'all'>('all');
    const [showResolved, setShowResolved] = useState(false);

    const {
        alerts,
        isLoading,
        markAsRead,
        markAsResolved,
        markAllAsRead,
        generateAlerts,
        clearResolved,
        unreadCount,
        criticalCount
    } = useAlerts({
        isResolved: showResolved ? undefined : false,
        module: selectedModule === 'all' ? undefined : selectedModule
    });

    const { counts } = useUnreadCount();

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    // Close on escape
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleAlertClick = async (alert: Alert) => {
        if (!alert.isRead) {
            await markAsRead(alert.id);
        }
        if (alert.actionUrl) {
            navigate(alert.actionUrl);
            onClose();
        }
    };

    const handleResolve = async (e: React.MouseEvent, alertId: string) => {
        e.stopPropagation();
        await markAsResolved(alertId);
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Agora';
        if (diffMins < 60) return `${diffMins}m`;
        if (diffHours < 24) return `${diffHours}h`;
        if (diffDays < 7) return `${diffDays}d`;
        return date.toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short' });
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
        <div
            ref={containerRef}
            className={`absolute right-0 top-12 w-96 max-h-[80vh] bg-white dark:bg-dark-800 
                       rounded-xl shadow-2xl border border-gray-200 dark:border-dark-700 
                       flex flex-col z-50 overflow-hidden ${className}`}
        >
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-dark-700 bg-gray-50 dark:bg-dark-900">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <HiOutlineBell className="w-5 h-5 text-primary-600" />
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                            Notificações
                        </h3>
                        {unreadCount > 0 && (
                            <Badge variant="primary" size="sm">{unreadCount}</Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => generateAlerts()}
                            title="Actualizar alertas"
                        >
                            <HiOutlineRefresh className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={onClose}>
                            <HiOutlineX className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* Critical alert banner */}
                {criticalCount > 0 && (
                    <div className="mt-3 p-2 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center gap-2">
                        <HiOutlineExclamationCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                        <span className="text-sm font-medium text-red-700 dark:text-red-300">
                            {criticalCount} alerta{criticalCount > 1 ? 's' : ''} crítico{criticalCount > 1 ? 's' : ''}
                        </span>
                    </div>
                )}

                {/* Module tabs */}
                <div className="mt-3 flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
                    <button
                        onClick={() => setSelectedModule('all')}
                        className={`px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors
                            ${selectedModule === 'all'
                                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700'}`}
                    >
                        Todos {counts?.total ? `(${counts.total})` : ''}
                    </button>
                    {Object.entries(counts?.byModule || {}).map(([mod, count]) => (
                        <button
                            key={mod}
                            onClick={() => setSelectedModule(mod as AlertModule)}
                            className={`px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors
                                ${selectedModule === mod
                                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700'}`}
                        >
                            {MODULE_CONFIG[mod]?.label || mod} ({count})
                        </button>
                    ))}
                </div>
            </div>

            {/* Actions bar */}
            <div className="px-4 py-2 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between bg-gray-50/50 dark:bg-dark-800">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowResolved(!showResolved)}
                        className={`text-xs flex items-center gap-1 ${showResolved ? 'text-primary-600' : 'text-gray-500'}`}
                    >
                        <HiOutlineFilter className="w-3.5 h-3.5" />
                        {showResolved ? 'Todos' : 'Activos'}
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                        <button
                            onClick={() => markAllAsRead(selectedModule === 'all' ? undefined : selectedModule)}
                            className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                        >
                            <HiOutlineCheckCircle className="w-3.5 h-3.5" />
                            Marcar lidos
                        </button>
                    )}
                    {showResolved && (
                        <button
                            onClick={clearResolved}
                            className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                        >
                            <HiOutlineTrash className="w-3.5 h-3.5" />
                            Limpar
                        </button>
                    )}
                </div>
            </div>

            {/* Alerts list */}
            <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="p-8 text-center text-gray-500">
                        <div className="animate-spin w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full mx-auto mb-2" />
                        <p className="text-sm">A carregar...</p>
                    </div>
                ) : alerts.length === 0 ? (
                    <div className="p-8 text-center">
                        <HiOutlineCheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                        <p className="text-gray-600 dark:text-gray-400 font-medium">
                            Sem notificações
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                            Está tudo em ordem!
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100 dark:divide-dark-700">
                        {alerts.map((alert) => (
                            <div
                                key={alert.id}
                                onClick={() => handleAlertClick(alert)}
                                className={`p-3 border-l-4 cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-dark-700
                                    ${getPriorityClasses(alert.priority)}
                                    ${!alert.isRead ? 'bg-opacity-100' : 'bg-opacity-50 opacity-75'}
                                    ${alert.isResolved ? 'opacity-50' : ''}`}
                            >
                                <div className="flex items-start gap-3">
                                    {/* Priority icon */}
                                    <div className={`mt-0.5 ${alert.priority === 'critical' ? 'text-red-500' :
                                        alert.priority === 'high' ? 'text-orange-500' :
                                            alert.priority === 'medium' ? 'text-yellow-600' : 'text-blue-500'
                                        }`}>
                                        {PRIORITY_CONFIG[alert.priority].icon}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            {alert.module && (
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium
                                                    bg-${MODULE_CONFIG[alert.module]?.color || 'gray'}-100 
                                                    text-${MODULE_CONFIG[alert.module]?.color || 'gray'}-700
                                                    dark:bg-${MODULE_CONFIG[alert.module]?.color || 'gray'}-900/30 
                                                    dark:text-${MODULE_CONFIG[alert.module]?.color || 'gray'}-400`}>
                                                    {MODULE_CONFIG[alert.module]?.label || alert.module}
                                                </span>
                                            )}
                                            <span className="text-[10px] text-gray-400">
                                                {formatTime(alert.createdAt)}
                                            </span>
                                            {!alert.isRead && (
                                                <span className="w-2 h-2 rounded-full bg-primary-500" />
                                            )}
                                        </div>
                                        <h4 className={`text-sm font-medium text-gray-900 dark:text-white truncate
                                            ${alert.isResolved ? 'line-through' : ''}`}>
                                            {alert.title}
                                        </h4>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mt-0.5">
                                            {alert.message}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1">
                                        {!alert.isResolved && (
                                            <button
                                                onClick={(e) => handleResolve(e, alert.id)}
                                                className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                                                title="Resolver"
                                            >
                                                <HiOutlineCheck className="w-4 h-4" />
                                            </button>
                                        )}
                                        {alert.actionUrl && (
                                            <HiOutlineChevronRight className="w-4 h-4 text-gray-400" />
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gray-200 dark:border-dark-700 bg-gray-50 dark:bg-dark-900">
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-center"
                    onClick={() => {
                        navigate('/alerts');
                        onClose();
                    }}
                >
                    Ver todos os alertas
                    <HiOutlineChevronRight className="w-4 h-4 ml-1" />
                </Button>
            </div>
        </div>
    );
}
