import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { socketService } from '../services/socketService';

/**
 * Maps socket events to the TanStack Query cache keys they should invalidate.
 * When the backend emits e.g. 'product:created', all queries with key ['products']
 * are refetched automatically — tables update without user interaction.
 */
const EVENT_QUERY_MAP: Record<string, string[][]> = {
    // Products / Inventory
    'product:created':       [['products'], ['stock-movements'], ['dashboard']],
    'product:updated':       [['products'], ['stock-movements']],
    'product:deleted':       [['products'], ['stock-movements'], ['dashboard']],
    'product:stock-updated': [['products'], ['stock-movements'], ['dashboard'], ['low-stock']],

    // Customers
    'customer:created': [['customers'], ['dashboard']],
    'customer:updated': [['customers']],
    'customer:deleted': [['customers']],

    // Sales
    'sale:created': [['sales'], ['dashboard'], ['products'], ['stock-movements']],

    // Invoices
    'invoice:created': [['invoices'], ['dashboard'], ['accounts-receivable']],
    'invoice:updated': [['invoices'], ['accounts-receivable']],

    // Alerts
    'alert:new':     [['alerts']],
    'alert:updated': [['alerts']],
};

/**
 * Mount this hook once at the app/layout level.
 * It subscribes to all relevant socket events and invalidates the matching
 * query cache keys so every open table refreshes automatically.
 */
export function useRealtimeSync() {
    const queryClient = useQueryClient();

    useEffect(() => {
        const unsubscribers = Object.entries(EVENT_QUERY_MAP).map(([event, queryKeys]) =>
            socketService.on(event, () => {
                queryKeys.forEach(key =>
                    queryClient.invalidateQueries({ queryKey: key })
                );
            })
        );

        return () => {
            unsubscribers.forEach(unsub => unsub());
        };
    }, [queryClient]);
}
