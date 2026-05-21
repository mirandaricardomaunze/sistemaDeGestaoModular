/**
 * NotificationBadge Component
 * 
 * Header badge showing unread notification count with
 * click-to-open dropdown notification center.
 */

import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { HiOutlineBell } from 'react-icons/hi2';
import { useAlerts, useUnreadCount } from '../../hooks/useAlerts';
import type { AlertModule } from '../../services/api';
import NotificationCenter from './NotificationCenter';
import { Button } from '../ui/Button';

interface NotificationBadgeProps {
    className?: string;
}

// Mirrors ROUTE_MODULE_SCOPE in NotificationCenter — kept in sync so the badge
// only counts alerts the open panel will actually display.
const ROUTE_MODULE_SCOPE: Record<string, AlertModule[]> = {
    commercial: ['inventory', 'invoices', 'crm', 'pos'],
    pharmacy: ['pharmacy', 'inventory', 'invoices'],
    hospitality: ['hospitality'],
    hotel: ['hospitality'],
    'bottle-store': ['inventory', 'invoices', 'pos'],
    bottlestore: ['inventory', 'invoices', 'pos'],
    bottleStore: ['inventory', 'invoices', 'pos'],
    restaurant: ['hospitality', 'inventory', 'pos'],
    logistics: ['inventory'],
};

export default function NotificationBadge({ className = '' }: NotificationBadgeProps) {
    const [isOpen, setIsOpen] = useState(false);
    const location = useLocation();
    const { counts } = useUnreadCount();

    const scope = useMemo<AlertModule[] | null>(() => {
        const segment = location.pathname.split('/').filter(Boolean)[0];
        return segment ? ROUTE_MODULE_SCOPE[segment] ?? null : null;
    }, [location.pathname]);

    // When in a scoped section, fetch unread alerts so we can show a
    // module-relevant badge count. Outside scope we use the global summary.
    const { alerts: scopedAlerts } = useAlerts({
        isResolved: false,
        autoRefresh: !!scope,
    });

    const { total, hasCritical } = useMemo(() => {
        if (!scope) {
            return {
                total: counts?.total ?? 0,
                hasCritical: (counts?.byPriority?.critical ?? 0) > 0,
            };
        }
        const filtered = scopedAlerts.filter(
            a => !a.isRead && a.module && scope.includes(a.module as AlertModule),
        );
        return {
            total: filtered.length,
            hasCritical: filtered.some(a => a.priority === 'critical'),
        };
    }, [scope, counts, scopedAlerts]);

    return (
        <div className={`relative ${className}`}>
            <Button variant="ghost"
                onClick={() => setIsOpen(!isOpen)}
                className={`relative p-2.5 rounded-xl transition-all duration-300 ring-1 shadow-sm
                    ${isOpen
                        ? 'bg-primary-50 text-primary-600 ring-primary-200 dark:bg-primary-900/30 dark:text-primary-400 dark:ring-primary-800 shadow-inner'
                        : 'text-gray-500 hover:bg-gray-100 ring-gray-200/50 dark:text-gray-400 dark:hover:bg-dark-800 dark:ring-dark-700/50 hover:shadow-md hover:scale-105'}
                    ${hasCritical ? 'animate-pulse' : ''}`}
                title="Notificações"
            >
                <HiOutlineBell className="w-5 h-5" />

                {/* Badge counter */}
                {total > 0 && (
                    <span
                        className={`absolute -top-1 -right-1 min-w-[20px] h-[20px] 
                            flex items-center justify-center text-[10px] font-black text-white 
                            rounded-full px-1 border-2 border-white dark:border-dark-900 shadow-sm
                            ${hasCritical
                                ? 'bg-red-500 animate-bounce'
                                : 'bg-primary-600'}`}
                    >
                        {total > 99 ? '99+' : total}
                    </span>
                )}

                {/* Critical indicator ring */}
                {hasCritical && (
                    <span className="absolute inset-0 rounded-xl border-2 border-red-500 animate-ping opacity-75" />
                )}
            </Button>

            <NotificationCenter
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
            />
        </div>
    );
}
