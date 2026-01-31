/**
 * NotificationBadge Component
 * 
 * Header badge showing unread notification count with
 * click-to-open dropdown notification center.
 */

import { useState } from 'react';
import { HiOutlineBell } from 'react-icons/hi';
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
                className={`relative p-2 rounded-lg transition-all
                    ${isOpen
                        ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
                        : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-dark-700'}
                    ${hasCritical ? 'animate-pulse' : ''}`}
                title="Notificações"
            >
                <HiOutlineBell className="w-5 h-5" />

                {/* Badge counter */}
                {total > 0 && (
                    <span
                        className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] 
                            flex items-center justify-center text-[10px] font-bold text-white 
                            rounded-full px-1
                            ${hasCritical
                                ? 'bg-red-500 animate-bounce'
                                : 'bg-primary-600'}`}
                    >
                        {total > 99 ? '99+' : total}
                    </span>
                )}

                {/* Critical indicator ring */}
                {hasCritical && (
                    <span className="absolute inset-0 rounded-lg border-2 border-red-500 animate-ping opacity-75" />
                )}
            </button>

            <NotificationCenter
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
            />
        </div>
    );
}
