import { useMemo } from 'react';
import type { ReactNode } from 'react';

export type WorkflowStatusConfig<S extends string> = Record<S, {
    label: string;
    variant: 'gray' | 'info' | 'success' | 'warning' | 'danger' | 'primary';
    icon?: any;
    color?: string;
    bg?: string;
}>;

export type WorkflowTransition = {
    next: string;
    label: string;
    variant: 'primary' | 'success' | 'danger' | 'ghost' | 'warning';
    icon?: ReactNode;
};

export type WorkflowTransitions<S extends string> = Record<S, WorkflowTransition[]>;

export interface DocumentWorkflow<S extends string> {
    status: S;
    config: WorkflowStatusConfig<S>[S];
    transitions: WorkflowTransition[];
    canTransitionTo: (next: string) => boolean;
    isTerminal: boolean;
}

/**
 * Resolves the display config and allowed transitions for a commercial document
 * (Quotes, Purchase Orders). Plain function, safe to call inside loops/maps.
 */
export function getDocumentWorkflow<S extends string>(
    status: S,
    statusConfig: WorkflowStatusConfig<S>,
    transitions: WorkflowTransitions<S>,
    fallbackStatus: S,
): DocumentWorkflow<S> {
    const config = statusConfig[status] ?? statusConfig[fallbackStatus];
    const allowed = transitions[status] ?? [];
    return {
        status,
        config,
        transitions: allowed,
        canTransitionTo: (next: string) => allowed.some(t => t.next === next),
        isTerminal: allowed.length === 0,
    };
}

/**
 * React hook version of the workflow resolver.
 */
export function useDocumentWorkflow<S extends string>(
    status: S,
    statusConfig: WorkflowStatusConfig<S>,
    transitions: WorkflowTransitions<S>,
    fallbackStatus: S,
): DocumentWorkflow<S> {
    return useMemo(
        () => getDocumentWorkflow(status, statusConfig, transitions, fallbackStatus),
        [status, statusConfig, transitions, fallbackStatus]
    );
}
