/**
 * DeliveryStatusTimeline Component
 *
 * Responsibility: Render ONLY. Receives pre-computed timeline events via props.
 * Has zero business logic — the hook `useDeliveryStatusTimeline` owns that.
 *
 * Design: Vertical step-by-step timeline with:
 *   - Green checkmark for completed steps
 *   - Blue pulsing dot for current step
 *   - Grey ring for future steps
 *   - Red X for terminal failure
 */

import type { DeliveryStatusEvent } from '../../services/api/logistics.api';

// ─── Sub-components (Atoms) ───────────────────────────────────────────────────

interface StepIconProps {
    isCompleted: boolean;
    isCurrent: boolean;
    isTerminalFailure: boolean;
}

function StepIcon({ isCompleted, isCurrent, isTerminalFailure }: StepIconProps) {
    if (isTerminalFailure && isCurrent) {
        return (
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-100 dark:bg-red-900/40 ring-2 ring-red-400">
                <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </div>
        );
    }

    if (isCompleted) {
        return (
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/40 ring-2 ring-emerald-400">
                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
            </div>
        );
    }

    if (isCurrent) {
        return (
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-400">
                <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
            </div>
        );
    }

    return (
        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 dark:bg-dark-700 ring-2 ring-gray-300 dark:ring-dark-500">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-dark-500" />
        </div>
    );
}

interface StepConnectorProps {
    isCompleted: boolean;
}

function StepConnector({ isCompleted }: StepConnectorProps) {
    return (
        <div
            className={`w-0.5 h-8 mx-auto my-1 rounded-full transition-colors duration-300 ${
                isCompleted
                    ? 'bg-emerald-400 dark:bg-emerald-600'
                    : 'bg-gray-200 dark:bg-dark-600'
            }`}
            aria-hidden="true"
        />
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface DeliveryStatusTimelineProps {
    events: DeliveryStatusEvent[];
}

export function DeliveryStatusTimeline({ events }: DeliveryStatusTimelineProps) {
    if (events.length === 0) return null;

    const terminalFailureStatuses = ['failed', 'returned', 'cancelled'] as const;

    return (
        <ol aria-label="Histórico de estado da entrega" className="space-y-0">
            {events.map((event, index) => {
                const isLast = index === events.length - 1;
                const isTerminalFailure = terminalFailureStatuses.includes(event.status as any);

                return (
                    <li key={event.status} className="flex gap-3">
                        {/* Left column: icon + connector */}
                        <div className="flex flex-col items-center flex-shrink-0 w-8">
                            <StepIcon
                                isCompleted={event.isCompleted}
                                isCurrent={event.isCurrent}
                                isTerminalFailure={isTerminalFailure}
                            />
                            {!isLast && <StepConnector isCompleted={event.isCompleted} />}
                        </div>

                        {/* Right column: label + timestamp */}
                        <div className={`pb-2 flex-1 ${isLast ? '' : 'pb-2'}`}>
                            <p
                                className={`text-sm font-semibold leading-8 ${
                                    event.isCurrent
                                        ? isTerminalFailure
                                            ? 'text-red-600 dark:text-red-400'
                                            : 'text-blue-600 dark:text-blue-400'
                                        : event.isCompleted
                                        ? 'text-emerald-700 dark:text-emerald-400'
                                        : 'text-gray-400 dark:text-gray-500'
                                }`}
                            >
                                {event.label}
                            </p>

                            {event.timestamp && (event.isCompleted || event.isCurrent) && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">
                                    {new Date(event.timestamp).toLocaleString('pt-MZ', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </p>
                            )}

                            {event.notes && event.isCurrent && (
                                <p className="mt-1 text-xs text-red-600 dark:text-red-400 italic">
                                    Motivo: {event.notes}
                                </p>
                            )}
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}
