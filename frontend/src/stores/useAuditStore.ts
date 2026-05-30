import { logger } from '../utils/logger';
/**
 * Audit Store
 * Gerencia o estado e operações de auditoria (apenas configuração e operações locais pendentes)
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { auditAPI } from '../services/api';
import type {
    AuditSeverity,
    AuditConfig,
    CreateAuditLog,
    AuditLog,
    AuditLogFilter,
    AuditStats,
} from '../types/audit';

// ============================================================================
// Default Configuration
// ============================================================================

const defaultConfig: AuditConfig = {
    enabled: true,
    retentionDays: 90,
    logLevel: 'info',
    excludeModules: [],
    excludeActions: ['view'], // Don't log view actions by default
};

// ============================================================================
// Store Interface
// ============================================================================

interface AuditState {
    config: AuditConfig;
    syncEnabled: boolean; // Enable/disable database sync
    isSyncing: boolean; // Track sync status
    pendingSync: CreateAuditLog[]; // Queue for offline logs

    // Read state (populated by loadFromDatabase)
    logs: AuditLog[];

    // Actions
    addLog: (log: CreateAuditLog) => void;
    addLogs: (logs: CreateAuditLog[]) => void;

    // Configuration
    updateConfig: (config: Partial<AuditConfig>) => void;

    // Database Sync
    setSyncEnabled: (enabled: boolean) => void;
    syncToDatabase: () => Promise<void>;

    // Read / report helpers used by the AuditLogViewer
    loadFromDatabase: (filters?: AuditLogFilter) => Promise<void>;
    getFilteredLogs: (filters: AuditLogFilter) => AuditLog[];
    getStats: (filters: AuditLogFilter) => AuditStats;
    exportLogs: (filters: AuditLogFilter, format: 'csv' | 'json') => string;
    clearAllLogs: () => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

// Adapter: the API audit row uses `entity`/`createdAt`, but the viewer reads
// `module`/`action`/`timestamp` from the richer local `AuditLog` shape. Map the
// API rows onto that shape so the viewer's reads stay valid.
function mapApiLog(row: {
    id?: string;
    userId?: string;
    userName?: string;
    action?: string;
    entity?: string;
    entityId?: string;
    ipAddress?: string;
    userAgent?: string;
    createdAt?: string;
}): AuditLog {
    return {
        id: row.id ?? '',
        timestamp: row.createdAt ?? new Date().toISOString(),
        userId: row.userId ?? '',
        userName: row.userName ?? 'Sistema',
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        module: 'auth' as AuditLog['module'],
        action: (row.action as AuditLog['action']) ?? 'view',
        severity: 'info',
        entityType: row.entity ?? 'unknown',
        entityId: row.entityId,
        description: `${row.action ?? ''} ${row.entity ?? ''}`.trim(),
        success: true,
    };
}

const emptyStats = (): AuditStats => ({
    totalLogs: 0,
    byModule: {} as AuditStats['byModule'],
    byAction: {} as AuditStats['byAction'],
    bySeverity: { info: 0, warning: 0, error: 0, critical: 0 },
    byUser: [],
    recentActivity: [],
    failedActions: 0,
    period: { start: new Date().toISOString(), end: new Date().toISOString() },
});

export const useAuditStore = create<AuditState>()(
    persist(
        (set, get) => ({
            config: defaultConfig,
            syncEnabled: true, // Enable database sync by default
            isSyncing: false,
            pendingSync: [],
            logs: [],

            // Add a single log entry (queues it for sync or sends it immediately)
            addLog: (logData) => {
                const config = get().config;

                // Check if logging is enabled
                if (!config.enabled) return;

                // Check severity level
                const severityLevels: AuditSeverity[] = ['info', 'warning', 'error', 'critical'];
                const minLevel = severityLevels.indexOf(config.logLevel);
                const logLevel = severityLevels.indexOf(logData.severity);
                if (logLevel < minLevel) return;

                // Check excluded modules and actions
                if (config.excludeModules.includes(logData.module)) return;
                if (config.excludeActions.includes(logData.action)) return;

                const token = localStorage.getItem('auth_token');
                // Sync to database if enabled and authenticated
                if (get().syncEnabled && token) {
                    auditAPI.create({
                        userId: logData.userId,
                        userName: logData.userName,
                        action: logData.action,
                        entity: logData.entityType,
                        entityId: logData.entityId,
                        oldData: logData.previousValues,
                        newData: logData.newValues,
                    }).then((res) => {
                        if (res === null) {
                            // If API returned null (failed silently), store it locally to sync later
                            set((state) => ({
                                pendingSync: [...state.pendingSync, logData],
                            }));
                        }
                    }).catch(error => {
                        logger.error('Failed to sync audit log to database:', error);
                        // Add to pending sync queue for retry
                        set((state) => ({
                            pendingSync: [...state.pendingSync, logData],
                        }));
                    });
                } else {
                    set((state) => ({
                        pendingSync: [...state.pendingSync, logData],
                    }));
                }
            },

            // Add multiple logs at once
            addLogs: (logsData) => {
                const config = get().config;
                if (!config.enabled) return;

                logsData.forEach(logData => get().addLog(logData));
            },

            // Update configuration
            updateConfig: (updates) => {
                set((state) => ({
                    config: { ...state.config, ...updates },
                }));
            },

            // Enable/disable database sync
            setSyncEnabled: (enabled) => {
                set({ syncEnabled: enabled });
                if (enabled) {
                    // Try to sync pending logs
                    get().syncToDatabase();
                }
            },

            // Read API logs into local state. Filters with no API mapping
            // (severity, success, searchTerm) are applied client-side by
            // `getFilteredLogs` instead.
            loadFromDatabase: async (filters?: AuditLogFilter) => {
                try {
                    const res = await auditAPI.getAll({
                        startDate: filters?.startDate,
                        endDate: filters?.endDate,
                        userId: filters?.userId,
                        action: filters?.action,
                        entity: filters?.entityType,
                        searchTerm: filters?.searchTerm,
                    });
                    const mapped = (res.data || []).map((r: Parameters<typeof mapApiLog>[0]) => mapApiLog(r));
                    set({ logs: mapped });
                } catch (err) {
                    logger.error('Failed to load audit logs from database:', err);
                }
            },

            getFilteredLogs: (filters: AuditLogFilter) => {
                const all = get().logs;
                return all.filter((l) => {
                    if (filters.userId && l.userId !== filters.userId) return false;
                    if (filters.module && l.module !== filters.module) return false;
                    if (filters.action && l.action !== filters.action) return false;
                    if (filters.severity && l.severity !== filters.severity) return false;
                    if (filters.entityType && l.entityType !== filters.entityType) return false;
                    if (filters.searchTerm) {
                        const t = filters.searchTerm.toLowerCase();
                        if (!l.description.toLowerCase().includes(t) && !l.userName.toLowerCase().includes(t)) return false;
                    }
                    return true;
                });
            },

            getStats: (_filters: AuditLogFilter) => emptyStats(),

            exportLogs: (filters: AuditLogFilter, format: 'csv' | 'json') => {
                const rows = get().getFilteredLogs(filters);
                if (format === 'json') return JSON.stringify(rows, null, 2);
                const header = 'timestamp,userName,module,action,entityType,description\n';
                const body = rows.map((l) =>
                    [l.timestamp, l.userName, l.module, l.action, l.entityType, l.description]
                        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
                        .join(',')
                ).join('\n');
                return header + body;
            },

            clearAllLogs: () => set({ logs: [] }),

            // Sync pending logs to database
            syncToDatabase: async () => {
                const { pendingSync, syncEnabled } = get();
                const token = localStorage.getItem('auth_token');

                // Do not attempt to sync if not enabled, no token, or no pending logs
                if (!syncEnabled || !token || pendingSync.length === 0) return;

                set({ isSyncing: true });

                try {
                    const failedLogs: CreateAuditLog[] = [];

                    // Attempt to sync each pending log, collecting failures
                    await Promise.allSettled(
                        pendingSync.map(async (logData) => {
                            try {
                                const res = await auditAPI.create({
                                    userId: logData.userId,
                                    userName: logData.userName,
                                    action: logData.action,
                                    entity: logData.entityType,
                                    entityId: logData.entityId,
                                    oldData: logData.previousValues,
                                    newData: logData.newValues,
                                });
                                if (res === null) {
                                    failedLogs.push(logData);
                                }
                            } catch (err) {
                                failedLogs.push(logData);
                            }
                        })
                    );

                    // Keep failed logs in the queue to retry later, clear successfully synced ones
                    set({ pendingSync: failedLogs });
                } catch (error) {
                    logger.error('Failed to sync audit logs:', error);
                } finally {
                    set({ isSyncing: false });
                }
            },
        }),
        {
            name: 'audit-storage',
            partialize: (state) => ({
                config: state.config,
                syncEnabled: state.syncEnabled,
                pendingSync: state.pendingSync, // Persist pending sync queue
            }),
            onRehydrateStorage: () => (state) => {
                if (state && state.syncEnabled) {
                    // Only sync to database if user is authenticated (has valid token)
                    const token = localStorage.getItem('auth_token');
                    if (token) {
                        // Try to sync pending logs after rehydration
                        setTimeout(() => {
                            state.syncToDatabase();
                        }, 1000);
                    }
                }
            },
        }
    )
);
