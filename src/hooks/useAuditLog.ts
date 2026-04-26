import { useAuditStore } from '../stores/useAuditStore';
import { useAuthStore } from '../stores/useAuthStore';
import type { AuditModule, AuditAction, AuditSeverity } from '../types/audit';

/**
 * Hook to easily add audit logs with current user context.
 * This hook is separated from the store to avoid circular dependencies.
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
