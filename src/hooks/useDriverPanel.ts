/**
 * useDriverPanel Hook
 *
 * Responsibility: All business logic for the Driver Panel feature.
 *   - Resolves which driver the current user represents (by matching driver code to user name)
 *   - Fetches only that driver's pending/active deliveries
 *   - Exposes status update action with user-facing feedback
 *
 * Components that use this hook remain purely presentational.
 */

import { useMemo } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import type { User } from '../types';
import {
    useDrivers,
    useDeliveries,
    useUpdateDeliveryStatus,
    useDeliveryStatusTimeline,
} from './useLogistics';
import type { Delivery, Driver } from '../services/api/logistics.api';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Statuses that represent an active delivery a driver needs to act on. */
const ACTIVE_DELIVERY_STATUSES: Delivery['status'][] = [
    'pending',
    'scheduled',
    'in_transit',
    'out_for_delivery',
];

/** Statuses the driver is allowed to transition to from a given current status. */
const ALLOWED_NEXT_STATUSES: Partial<Record<Delivery['status'], Delivery['status'][]>> = {
    pending:          ['in_transit', 'cancelled'],
    scheduled:        ['in_transit', 'cancelled'],
    in_transit:       ['out_for_delivery', 'delivered', 'failed'],
    out_for_delivery: ['delivered', 'failed', 'returned'],
};

const STATUS_LABELS: Record<Delivery['status'], string> = {
    pending:          'Pendente',
    scheduled:        'Agendada',
    in_transit:       'Em Trânsito',
    out_for_delivery: 'Saiu para Entrega',
    delivered:        'Entregue',
    failed:           'Falhada',
    returned:         'Devolvida',
    cancelled:        'Cancelada',
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DriverPanelDelivery {
    delivery: Delivery;
    allowedTransitions: Array<{ status: Delivery['status']; label: string }>;
}

export interface UseDriverPanelResult {
    /** The driver record matched to the current logged-in user. Null if not found. */
    currentDriver: Driver | null;
    /** Active deliveries enriched with allowed next-status transitions. */
    activeDeliveries: DriverPanelDelivery[];
    /** Summary counts for the dashboard header. */
    summary: {
        totalToday: number;
        inTransit: number;
        delivered: number;
        pending: number;
    };
    isLoading: boolean;
    /** Call to transition a delivery to a new status. */
    updateStatus: (params: {
        deliveryId: string;
        status: Delivery['status'];
        failureReason?: string;
        recipientSign?: string;
    }) => Promise<void>;
    isUpdating: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDriverPanel(): UseDriverPanelResult {
    const { user } = useAuthStore();

    // Fetch all drivers to find the one matching the current user.
    // SRP: driver resolution is a pure lookup, not mixed with delivery fetching.
    const { data: driversData, isLoading: loadingDrivers } = useDrivers({ limit: 200 } as any);

    /** Resolve current driver by matching user name OR email to driver record. */
    const currentDriver = useMemo<Driver | null>(() => {
        if (!driversData?.data || !user) return null;

        return (
            driversData.data.find(
                (d) =>
                    d.name.toLowerCase() === (user.name ?? '').toLowerCase() ||
                    (d.email && d.email.toLowerCase() === (user.email ?? '').toLowerCase())
            ) ?? null
        );
    }, [driversData, user]);

    // Fetch ALL active deliveries for this driver (not paginated — drivers rarely have >100).
    const { data: deliveriesData, isLoading: loadingDeliveries } = useDeliveries(
        currentDriver
            ? { driverId: currentDriver.id, limit: 100 }
            : undefined
    );

    const updateStatusMutation = useUpdateDeliveryStatus();

    /** Enrich each active delivery with the transitions the driver can trigger. */
    const activeDeliveries = useMemo<DriverPanelDelivery[]>(() => {
        if (!deliveriesData?.deliveries) return [];

        return deliveriesData.deliveries
            .filter((d) => ACTIVE_DELIVERY_STATUSES.includes(d.status))
            .map((delivery) => {
                const nextStatuses = ALLOWED_NEXT_STATUSES[delivery.status] ?? [];
                const allowedTransitions = nextStatuses.map((status) => ({
                    status,
                    label: STATUS_LABELS[status],
                }));
                return { delivery, allowedTransitions };
            })
            .sort((a, b) => {
                // Sort by priority: urgent → high → normal → low
                const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
                return (
                    (priorityOrder[a.delivery.priority] ?? 2) -
                    (priorityOrder[b.delivery.priority] ?? 2)
                );
            });
    }, [deliveriesData]);

    /** Summary derived from ALL deliveries today (not only active). */
    const summary = useMemo(() => {
        const all = deliveriesData?.deliveries ?? [];
        return {
            totalToday: all.length,
            inTransit: all.filter((d) =>
                ['in_transit', 'out_for_delivery'].includes(d.status)
            ).length,
            delivered: all.filter((d) => d.status === 'delivered').length,
            pending: all.filter((d) =>
                ['pending', 'scheduled'].includes(d.status)
            ).length,
        };
    }, [deliveriesData]);

    const updateStatus = async ({
        deliveryId,
        status,
        failureReason,
        recipientSign,
    }: {
        deliveryId: string;
        status: Delivery['status'];
        failureReason?: string;
        recipientSign?: string;
    }) => {
        await updateStatusMutation.mutateAsync({
            id: deliveryId,
            status,
            failureReason,
            recipientSign,
        });
    };

    return {
        currentDriver,
        activeDeliveries,
        summary,
        isLoading: loadingDrivers || loadingDeliveries,
        updateStatus,
        isUpdating: updateStatusMutation.isLoading,
    };
}

// Re-export for convenience so the page only imports from this hook file
export { useDeliveryStatusTimeline } from './useLogistics';
export type { Delivery, Driver } from '../services/api/logistics.api';
