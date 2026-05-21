import { useQuery } from '@tanstack/react-query';
import { usePaginatedQuery } from './usePaginatedQuery';
import { auditAPI } from '../services/api';
import type { AuditLog, AuditSeverity } from '../types/audit';

export interface AuditLogFilters {
    startDate?: string;
    endDate?: string;
    userId?: string;
    module?: string;
    action?: string;
    severity?: AuditSeverity;
    searchTerm?: string;
    success?: boolean;
    page?: number;
    limit?: number;
}

export function useAuditLogsQuery(filters: AuditLogFilters) {
    // Paginated query for table
    const query = usePaginatedQuery<AuditLog>({
        endpoint: 'audit',
        queryKey: ['audit-logs'],
        params: {
            ...filters,
            entity: filters.module, // API uses 'entity' for module in this context
        },
    });

    return query;
}

export function useAuditStatsQuery(filters: Omit<AuditLogFilters, 'page' | 'limit' | 'searchTerm'>) {
    return useQuery({
        queryKey: ['audit-stats', filters],
        queryFn: () => auditAPI.getStats({
            startDate: filters.startDate,
            endDate: filters.endDate,
            userId: filters.userId,
            action: filters.action,
            entity: filters.module,
        }),
    });
}
