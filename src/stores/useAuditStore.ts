/**
 * Audit Store
 * Gerencia o estado e operações de auditoria
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateId } from '../utils/helpers';
import { auditAPI } from '../services/api';
import type {
    AuditLog,
    AuditLogFilter,
    AuditStats,
    AuditModule,
    AuditAction,
    AuditSeverity,
    AuditConfig,
    CreateAuditLog,
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
    // Logs
    logs: AuditLog[];
    config: AuditConfig;
    syncEnabled: boolean; // Enable/disable database sync
    isSyncing: boolean; // Track sync status
    pendingSync: CreateAuditLog[]; // Queue for offline logs

    // Actions
    addLog: (log: CreateAuditLog) => void;
    addLogs: (logs: CreateAuditLog[]) => void;
    clearOldLogs: () => void;
    clearAllLogs: () => void;

    // Configuration
    updateConfig: (config: Partial<AuditConfig>) => void;

    // Queries
    getFilteredLogs: (filter: AuditLogFilter) => AuditLog[];
    getLogById: (id: string) => AuditLog | undefined;
    getLogsByEntity: (entityType: string, entityId: string) => AuditLog[];
    getLogsByUser: (userId: string) => AuditLog[];
    getRecentLogs: (count: number) => AuditLog[];

    // Statistics
    getStats: (filter?: AuditLogFilter) => AuditStats;

    // Export
    exportLogs: (filter: AuditLogFilter, format: 'csv' | 'json') => string;

    // Database Sync
    setSyncEnabled: (enabled: boolean) => void;
    syncToDatabase: () => Promise<void>;
    loadFromDatabase: (filter?: AuditLogFilter) => Promise<void>;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useAuditStore = create<AuditState>()(
    persist(
        (set, get) => ({
            logs: [],
            config: defaultConfig,
            syncEnabled: true, // Enable database sync by default
            isSyncing: false,
            pendingSync: [],

            // Add a single log entry
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

                const log: AuditLog = {
                    ...logData,
                    id: generateId(),
                    timestamp: new Date().toISOString(),
                };

                set((state) => ({
                    logs: [log, ...state.logs].slice(0, 100), // Keep max 100 logs (historic in DB)
                }));

                // Sync to database if enabled
                if (get().syncEnabled) {
                    auditAPI.create({
                        userId: logData.userId,
                        userName: logData.userName,
                        action: logData.action,
                        entity: logData.entityType,
                        entityId: logData.entityId,
                        oldData: logData.previousValues,
                        newData: logData.newValues,
                    }).catch(error => {
                        console.error('Failed to sync audit log to database:', error);
                        // Add to pending sync queue for retry
                        set((state) => ({
                            pendingSync: [...state.pendingSync, logData],
                        }));
                    });
                }
            },

            // Add multiple logs at once
            addLogs: (logsData) => {
                const config = get().config;
                if (!config.enabled) return;

                const now = new Date().toISOString();
                const newLogs: AuditLog[] = logsData.map((logData) => ({
                    ...logData,
                    id: generateId(),
                    timestamp: now,
                }));

                set((state) => ({
                    logs: [...newLogs, ...state.logs].slice(0, 100),
                }));
            },

            // Clear logs older than retention period
            clearOldLogs: () => {
                const config = get().config;
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - config.retentionDays);
                const cutoffISO = cutoffDate.toISOString();

                set((state) => ({
                    logs: state.logs.filter((log) => log.timestamp >= cutoffISO),
                }));
            },

            // Clear all logs
            clearAllLogs: () => {
                set({ logs: [] });
            },

            // Update configuration
            updateConfig: (updates) => {
                set((state) => ({
                    config: { ...state.config, ...updates },
                }));
            },

            // Get filtered logs
            getFilteredLogs: (filter) => {
                let logs = get().logs;

                if (filter.startDate) {
                    logs = logs.filter((log) => log.timestamp >= filter.startDate!);
                }

                if (filter.endDate) {
                    const endDate = new Date(filter.endDate);
                    endDate.setHours(23, 59, 59, 999);
                    logs = logs.filter((log) => log.timestamp <= endDate.toISOString());
                }

                if (filter.userId) {
                    logs = logs.filter((log) => log.userId === filter.userId);
                }

                if (filter.module) {
                    logs = logs.filter((log) => log.module === filter.module);
                }

                if (filter.action) {
                    logs = logs.filter((log) => log.action === filter.action);
                }

                if (filter.severity) {
                    logs = logs.filter((log) => log.severity === filter.severity);
                }

                if (filter.entityType) {
                    logs = logs.filter((log) => log.entityType === filter.entityType);
                }

                if (filter.entityId) {
                    logs = logs.filter((log) => log.entityId === filter.entityId);
                }

                if (filter.success !== undefined) {
                    logs = logs.filter((log) => log.success === filter.success);
                }

                if (filter.searchTerm) {
                    const term = filter.searchTerm.toLowerCase();
                    logs = logs.filter((log) =>
                        log.description.toLowerCase().includes(term) ||
                        log.userName.toLowerCase().includes(term) ||
                        log.entityName?.toLowerCase().includes(term) ||
                        log.entityType.toLowerCase().includes(term)
                    );
                }

                return logs;
            },

            // Get log by ID
            getLogById: (id) => {
                return get().logs.find((log) => log.id === id);
            },

            // Get logs for a specific entity
            getLogsByEntity: (entityType, entityId) => {
                return get().logs.filter(
                    (log) => log.entityType === entityType && log.entityId === entityId
                );
            },

            // Get logs by user
            getLogsByUser: (userId) => {
                return get().logs.filter((log) => log.userId === userId);
            },

            // Get recent logs
            getRecentLogs: (count) => {
                return get().logs.slice(0, count);
            },

            // Get statistics
            getStats: (filter) => {
                const logs = filter ? get().getFilteredLogs(filter) : get().logs;

                const byModule: Record<AuditModule, number> = {} as Record<AuditModule, number>;
                const byAction: Record<AuditAction, number> = {} as Record<AuditAction, number>;
                const bySeverity: Record<AuditSeverity, number> = {
                    info: 0,
                    warning: 0,
                    error: 0,
                    critical: 0,
                };
                const userCounts: Record<string, { userId: string; userName: string; count: number }> = {};
                let failedActions = 0;

                logs.forEach((log) => {
                    // By module
                    byModule[log.module] = (byModule[log.module] || 0) + 1;

                    // By action
                    byAction[log.action] = (byAction[log.action] || 0) + 1;

                    // By severity
                    bySeverity[log.severity] = (bySeverity[log.severity] || 0) + 1;

                    // By user
                    if (!userCounts[log.userId]) {
                        userCounts[log.userId] = { userId: log.userId, userName: log.userName, count: 0 };
                    }
                    userCounts[log.userId].count++;

                    // Failed actions
                    if (!log.success) {
                        failedActions++;
                    }
                });

                const byUser = Object.values(userCounts).sort((a, b) => b.count - a.count);

                return {
                    totalLogs: logs.length,
                    byModule,
                    byAction,
                    bySeverity,
                    byUser,
                    recentActivity: logs.slice(0, 10),
                    failedActions,
                    period: {
                        start: filter?.startDate || (logs[logs.length - 1]?.timestamp || new Date().toISOString()),
                        end: filter?.endDate || (logs[0]?.timestamp || new Date().toISOString()),
                    },
                };
            },

            // Export logs to CSV or JSON
            exportLogs: (filter, format) => {
                const logs = get().getFilteredLogs(filter);

                if (format === 'json') {
                    return JSON.stringify(logs, null, 2);
                }

                // CSV format
                const headers = [
                    'Data/Hora',
                    'Utilizador',
                    'Cargo',
                    'Módulo',
                    'Ação',
                    'Severidade',
                    'Tipo Entidade',
                    'ID Entidade',
                    'Nome Entidade',
                    'Descrição',
                    'Sucesso',
                    'Erro',
                ].join(';');

                const rows = logs.map((log) => [
                    new Date(log.timestamp).toLocaleString('pt-MZ'),
                    log.userName,
                    log.userRole || '',
                    log.module,
                    log.action,
                    log.severity,
                    log.entityType,
                    log.entityId || '',
                    log.entityName || '',
                    `"${log.description.replace(/"/g, '""')}"`,
                    log.success ? 'Sim' : 'Não',
                    log.errorMessage || '',
                ].join(';'));

                return [headers, ...rows].join('\n');
            },

            // Enable/disable database sync
            setSyncEnabled: (enabled) => {
                set({ syncEnabled: enabled });
                if (enabled) {
                    // Try to sync pending logs
                    get().syncToDatabase();
                }
            },

            // Sync pending logs to database
            syncToDatabase: async () => {
                const { pendingSync, syncEnabled } = get();

                if (!syncEnabled || pendingSync.length === 0) return;

                set({ isSyncing: true });

                try {
                    // Sync pending logs
                    const promises = pendingSync.map(logData =>
                        auditAPI.create({
                            userId: logData.userId,
                            userName: logData.userName,
                            action: logData.action,
                            entity: logData.entityType,
                            entityId: logData.entityId,
                            oldData: logData.previousValues,
                            newData: logData.newValues,
                        })
                    );

                    await Promise.allSettled(promises);

                    // Clear successfully synced logs
                    set({ pendingSync: [] });
                } catch (error) {
                    console.error('Failed to sync audit logs:', error);
                } finally {
                    set({ isSyncing: false });
                }
            },

            // Load logs from database
            loadFromDatabase: async (filter = {}) => {
                if (!get().syncEnabled) return;

                try {
                    const response = await auditAPI.getAll({
                        startDate: filter.startDate,
                        endDate: filter.endDate,
                        userId: filter.userId,
                        action: filter.action,
                        entity: filter.entityType,
                        limit: 100, // Load last 100 logs to prevent timeout
                    });

                    const dbLogs = response?.logs || (Array.isArray(response) ? response : []);

                    if (dbLogs.length > 0) {
                        // Transform database logs to app format
                        const transformedLogs: AuditLog[] = dbLogs.map((dbLog: any) => ({
                            id: dbLog.id,
                            userId: dbLog.userId || 'system',
                            userName: dbLog.userName || 'Sistema',
                            userRole: undefined,
                            module: (dbLog.entity || 'system') as any,
                            action: dbLog.action as any,
                            entityType: dbLog.entity,
                            entityId: dbLog.entityId,
                            entityName: undefined,
                            description: `${dbLog.action} ${dbLog.entity}${dbLog.entityId ? ` #${dbLog.entityId}` : ''}`,
                            severity: (dbLog.action === 'DELETE' || dbLog.action === 'ERROR' ? 'error' : 'info') as any,
                            timestamp: dbLog.createdAt,
                            success: true,
                            details: dbLog.newData,
                            previousValues: dbLog.oldData,
                            newValues: dbLog.newData,
                        }));

                        // Merge with local logs (keep local as primary, add missing from DB)
                        const localIds = new Set(get().logs.map(l => l.id));
                        const newLogs = transformedLogs.filter(l => !localIds.has(l.id));

                        set((state) => ({
                            logs: [...state.logs, ...newLogs].sort((a, b) =>
                                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                            ).slice(0, 100),
                        }));
                    }
                } catch (error) {
                    console.error('Failed to load audit logs from database:', error);
                }
            },
        }),
        {
            name: 'audit-storage',
            partialize: (state) => ({
                logs: state.logs.slice(0, 100), // Only persist last 100 logs
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
                            // Load recent logs from database
                            state.loadFromDatabase();
                        }, 1000);
                    }
                }
            },
        }
    )
);

// ============================================================================
// Audit Helper Hook
// ============================================================================

import { useAuthStore } from './useAuthStore';

/**
 * Hook to easily add audit logs with current user context
 */
export function useAuditLog() {
    const { addLog } = useAuditStore();
    const { user } = useAuthStore();

    const log = (
        module: AuditModule,
        action: AuditAction,
        entityType: string,
        description: string,
        options?: {
            entityId?: string;
            entityName?: string;
            severity?: AuditSeverity;
            details?: Record<string, any>;
            previousValues?: Record<string, any>;
            newValues?: Record<string, any>;
            success?: boolean;
            errorMessage?: string;
        }
    ) => {
        addLog({
            userId: user?.id || 'anonymous',
            userName: user?.name || 'Anónimo',
            userRole: user?.role,
            module,
            action,
            entityType,
            description,
            severity: options?.severity || 'info',
            entityId: options?.entityId,
            entityName: options?.entityName,
            details: options?.details,
            previousValues: options?.previousValues,
            newValues: options?.newValues,
            success: options?.success ?? true,
            errorMessage: options?.errorMessage,
        });
    };

    return {
        log,
        // Convenience methods
        logCreate: (module: AuditModule, entityType: string, entityName: string, entityId: string, details?: Record<string, any>) => {
            log(module, 'create', entityType, `Criou ${entityType}: ${entityName}`, {
                entityId,
                entityName,
                details,
                newValues: details,
            });
        },
        logUpdate: (module: AuditModule, entityType: string, entityName: string, entityId: string, previousValues?: Record<string, any>, newValues?: Record<string, any>) => {
            log(module, 'update', entityType, `Atualizou ${entityType}: ${entityName}`, {
                entityId,
                entityName,
                previousValues,
                newValues,
            });
        },
        logDelete: (module: AuditModule, entityType: string, entityName: string, entityId: string) => {
            log(module, 'delete', entityType, `Eliminou ${entityType}: ${entityName}`, {
                entityId,
                entityName,
                severity: 'warning',
            });
        },
        logExport: (module: AuditModule, entityType: string, format: string, count: number) => {
            log(module, 'export', entityType, `Exportou ${count} ${entityType}(s) em formato ${format}`, {
                details: { format, count },
            });
        },
        logError: (module: AuditModule, action: AuditAction, entityType: string, errorMessage: string) => {
            log(module, action, entityType, `Erro ao ${action} ${entityType}: ${errorMessage}`, {
                severity: 'error',
                success: false,
                errorMessage,
            });
        },
    };
}
