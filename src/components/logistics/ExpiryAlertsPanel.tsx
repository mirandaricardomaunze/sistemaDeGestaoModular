/**
 * ExpiryAlertsPanel Component
 *
 * Responsibility: Render ONLY. Receives pre-computed `ExpiryAlert[]` via props.
 * The hook `useExpiryAlerts` owns all business logic (severity, sorting, filtering).
 *
 * Design: Collapsible card with colour-coded severity rows.
 *   - Expired  → Red background + bold
 *   - Critical → Amber background
 *   - Warning  → Yellow tint
 *
 * Collapses automatically when there are no alerts.
 */

import { useState } from 'react';
import type { ExpiryAlert, ExpiryAlertSeverity } from '../../services/api/logistics.api';
import {
    HiOutlineExclamationTriangle,
    HiOutlineXCircle,
    HiOutlineChevronDown,
    HiOutlineChevronUp,
    HiOutlineTruck,
    HiOutlineIdentification,
} from 'react-icons/hi2';

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<
    ExpiryAlertSeverity,
    { label: string; rowClass: string; badgeClass: string; icon: React.ElementType }
> = {
    expired: {
        label: 'Expirado',
        rowClass: 'bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500',
        badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
        icon: HiOutlineXCircle,
    },
    critical: {
        label: 'Crítico',
        rowClass: 'bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500',
        badgeClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
        icon: HiOutlineExclamationTriangle,
    },
    warning: {
        label: 'Atenção',
        rowClass: 'bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400',
        badgeClass: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
        icon: HiOutlineExclamationTriangle,
    },
};

// ─── Sub-components (Atoms) ───────────────────────────────────────────────────

interface AlertRowProps {
    alert: ExpiryAlert;
}

function AlertRow({ alert }: AlertRowProps) {
    const config = SEVERITY_CONFIG[alert.severity];
    const SeverityIcon = config.icon;
    const EntityIcon = alert.entityType === 'vehicle' ? HiOutlineTruck : HiOutlineIdentification;

    const daysText =
        alert.daysUntilExpiry <= 0
            ? `Expirou há ${Math.abs(alert.daysUntilExpiry)} dia(s)`
            : `Expira em ${alert.daysUntilExpiry} dia(s)`;

    const expiryFormatted = new Date(alert.expiryDate).toLocaleDateString('pt-MZ', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });

    return (
        <li className={`flex items-start gap-3 px-4 py-3 rounded-lg ${config.rowClass}`}>
            <SeverityIcon className="w-5 h-5 flex-shrink-0 mt-0.5 text-current opacity-70" aria-hidden="true" />

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <EntityIcon className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" aria-hidden="true" />
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                        {alert.entityLabel}
                    </p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.badgeClass}`}>
                        {alert.documentType}
                    </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {daysText} — {expiryFormatted}
                </p>
            </div>

            <span className={`text-xs font-bold px-2 py-1 rounded-full flex-shrink-0 ${config.badgeClass}`}>
                {config.label}
            </span>
        </li>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ExpiryAlertsPanelProps {
    alerts: ExpiryAlert[];
}

export function ExpiryAlertsPanel({ alerts }: ExpiryAlertsPanelProps) {
    const [isExpanded, setIsExpanded] = useState(true);

    if (alerts.length === 0) return null;

    const expiredCount = alerts.filter((a) => a.severity === 'expired').length;
    const criticalCount = alerts.filter((a) => a.severity === 'critical').length;

    const headerSeverityClass =
        expiredCount > 0
            ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
            : criticalCount > 0
            ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
            : 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20';

    return (
        <section
            aria-label="Alertas de documentos a expirar"
            className={`rounded-xl border-2 overflow-hidden shadow-sm ${headerSeverityClass}`}
        >
            {/* Header — always visible */}
            <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500"
                aria-expanded={isExpanded}
            >
                <div className="flex items-center gap-2">
                    <HiOutlineExclamationTriangle className="w-5 h-5 text-red-500" aria-hidden="true" />
                    <span className="font-semibold text-gray-800 dark:text-gray-100">
                        Alertas de Documentos ({alerts.length})
                    </span>
                    {expiredCount > 0 && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                            {expiredCount} expirado(s)
                        </span>
                    )}
                    {criticalCount > 0 && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                            {criticalCount} crítico(s)
                        </span>
                    )}
                </div>
                {isExpanded ? (
                    <HiOutlineChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0" aria-hidden="true" />
                ) : (
                    <HiOutlineChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" aria-hidden="true" />
                )}
            </button>

            {/* Body — collapsible */}
            {isExpanded && (
                <ul className="px-4 pb-4 space-y-2" role="list">
                    {alerts.map((alert) => (
                        <AlertRow key={alert.id} alert={alert} />
                    ))}
                </ul>
            )}
        </section>
    );
}
