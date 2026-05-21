import { useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/useAuthStore';

/**
 * Hook to automatically log out the user after a period of inactivity
 * @param timeoutInMinutes Minutes of inactivity before logout
 */
export const useIdleLogout = (timeoutInMinutes: number = 15) => {
    const { logout, isAuthenticated } = useAuthStore();
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const resetTimeout = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        if (isAuthenticated) {
            timeoutRef.current = setTimeout(() => {
                logout();
                window.location.href = '/login';
            }, timeoutInMinutes * 60 * 1000);
        }
    };

    useEffect(() => {
        const events = [
            'mousedown',
            'mousemove',
            'keypress',
            'scroll',
            'touchstart',
            'click'
        ];

        const handleActivity = () => {
            resetTimeout();
        };

        if (isAuthenticated) {
            resetTimeout();
            events.forEach(event => {
                window.addEventListener(event, handleActivity);
            });
        }

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            events.forEach(event => {
                window.removeEventListener(event, handleActivity);
            });
        };
    }, [isAuthenticated, logout, timeoutInMinutes]);
};
