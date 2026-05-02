/**
 * NotificationBadge Component
 * 
 * Header badge showing unread notification count with
 * click-to-open dropdown notification center.
 */

import { useState } from 'react';
import { HiOutlineBell } from 'react-icons/hi2';
import { useUnreadCount } from '../../hooks/useAlerts';
import NotificationCenter from './NotificationCenter';

interface NotificationBadgeProps {
    className?: string;
}

export default function NotificationBadge({ className = '' }: NotificationBadgeProps) {
    const [isOpen, setIsOpen] = useState(false);
    const { counts } = useUnreadCount();

    const total = counts?.total || 0;
    const hasCritical = (counts?.byPriority?.critical || 0) > 0;

    return (
        <div className={`relative ${className}`}>
            <button
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
            </button>

            <NotificationCenter
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
            />
        </div>
    );
}
