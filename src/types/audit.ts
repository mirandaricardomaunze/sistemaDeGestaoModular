/**
 * Audit Log Types
 * Sistema de auditoria para rastrear todas as ações dos utilizadores
 */

// Modules that can be audited
export type AuditModule =
    | 'auth'           // Autenticação (login, logout)
    | 'inventory'      // Inventário (produtos, stock)
    | 'invoices'       // Faturas
    | 'orders'         // Encomendas
    | 'employees'      // Funcionários e RH
    | 'payroll'        // Processamento de salários
    | 'customers'      // Clientes
    | 'suppliers'      // Fornecedores
    | 'fiscal'         // Gestão fiscal
    | 'settings'       // Configurações
    | 'pos'            // Ponto de Venda
    | 'warehouses'     // Armazéns
    | 'transfers'      // Transferências de stock
    | 'reports'        // Relatórios
    | 'system';        // Sistema

// Types of actions
export type AuditAction =
    | 'create'         // Criação
    | 'update'         // Atualização
    | 'delete'         // Eliminação
    | 'view'           // Visualização
    | 'export'         // Exportação
    | 'import'         // Importação
    | 'login'          // Login
    | 'logout'         // Logout
    | 'login_failed'   // Login falhado
    | 'approve'        // Aprovação
    | 'reject'         // Rejeição
    | 'submit'         // Submissão
    | 'process'        // Processamento
    | 'cancel'         // Cancelamento
    | 'restore'        // Restauração
    | 'transfer'       // Transferência
    | 'payment'        // Pagamento
    | 'refund'         // Reembolso
    | 'print'          // Impressão
    | 'email'          // Envio de email
    | 'config_change'  // Alteração de configuração
    | 'CREATE'         // Criação (Backend)
    | 'UPDATE'         // Atualização (Backend)
    | 'DELETE'         // Eliminação (Backend)
    | 'LOGIN'          // Login (Backend)
    | 'REGISTER'       // Registo (Backend)
    | 'PASSWORD_CHANGE'; // Alteração de Senha (Backend)


// Severity levels
export type AuditSeverity = 'info' | 'warning' | 'error' | 'critical';

// Main audit log interface
export interface AuditLog {
    id: string;
    timestamp: string;              // ISO 8601 format
    userId: string;                 // User who performed the action
    userName: string;               // User display name
    userRole?: string;              // User role at time of action
    ipAddress?: string;             // Source IP (for future use)
    userAgent?: string;             // Browser info (for future use)

    module: AuditModule;            // Module where action occurred
    action: AuditAction;            // Type of action
    severity: AuditSeverity;        // Severity level

    entityType: string;             // Type of entity affected (e.g., 'Product', 'Invoice')
    entityId?: string;              // ID of affected entity
    entityName?: string;            // Display name of entity (for readability)

    description: string;            // Human-readable description
    details?: Record<string, any>;  // Additional details (JSON)

    previousValues?: Record<string, any>;  // Previous state (for updates)
    newValues?: Record<string, any>;       // New state (for updates)

    success: boolean;               // Whether action succeeded
    errorMessage?: string;          // Error message if failed

    metadata?: {
        sessionId?: string;
        requestId?: string;
        duration?: number;          // Action duration in ms
        affectedCount?: number;     // Number of records affected
    };
}

// Filter options for audit log queries
export interface AuditLogFilter {
    startDate?: string;
    endDate?: string;
    userId?: string;
    module?: AuditModule;
    action?: AuditAction;
    severity?: AuditSeverity;
    entityType?: string;
    entityId?: string;
    success?: boolean;
    searchTerm?: string;
}

// Audit log summary statistics
export interface AuditStats {
    totalLogs: number;
    byModule: Record<AuditModule, number>;
    byAction: Record<AuditAction, number>;
    bySeverity: Record<AuditSeverity, number>;
    byUser: { userId: string; userName: string; count: number }[];
    recentActivity: AuditLog[];
    failedActions: number;
    period: {
        start: string;
        end: string;
    };
}

// Export format
export type AuditExportFormat = 'csv' | 'pdf' | 'json';

// Audit configuration
export interface AuditConfig {
    enabled: boolean;
    retentionDays: number;          // How long to keep logs
    logLevel: AuditSeverity;        // Minimum severity to log
    excludeModules: AuditModule[];  // Modules to exclude from logging
    excludeActions: AuditAction[];  // Actions to exclude from logging
}

// Helper type for creating audit logs
export type CreateAuditLog = Omit<AuditLog, 'id' | 'timestamp'>;

// Module labels for display
export const MODULE_LABELS: Record<AuditModule, string> = {
    auth: 'Autenticação',
    inventory: 'Inventário',
    invoices: 'Faturas',
    orders: 'Encomendas',
    employees: 'Funcionários',
    payroll: 'Folha de Pagamento',
    customers: 'Clientes',
    suppliers: 'Fornecedores',
    fiscal: 'Gestão Fiscal',
    settings: 'Configurações',
    pos: 'Ponto de Venda',
    warehouses: 'Armazéns',
    transfers: 'Transferências',
    reports: 'Relatórios',
    system: 'Sistema',
};

// Action labels for display
export const ACTION_LABELS: Record<AuditAction, string> = {
    create: 'Criação',
    update: 'Atualização',
    delete: 'Eliminação',
    view: 'Visualização',
    export: 'Exportação',
    import: 'Importação',
    login: 'Login',
    logout: 'Logout',
    login_failed: 'Login Falhado',
    approve: 'Aprovação',
    reject: 'Rejeição',
    submit: 'Submissão',
    process: 'Processamento',
    cancel: 'Cancelamento',
    restore: 'Restauração',
    transfer: 'Transferência',
    payment: 'Pagamento',
    refund: 'Reembolso',
    print: 'Impressão',
    email: 'Email',
    config_change: 'Alt. Configuração',
    CREATE: 'Criação',
    UPDATE: 'Atualização',
    DELETE: 'Eliminação',
    LOGIN: 'Login',
    REGISTER: 'Registo',
    PASSWORD_CHANGE: 'Alteração de Senha',
};


// Severity labels and colors
export const SEVERITY_CONFIG: Record<AuditSeverity, { label: string; color: string; bgColor: string }> = {
    info: { label: 'Info', color: 'text-blue-600', bgColor: 'bg-blue-100' },
    warning: { label: 'Aviso', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
    error: { label: 'Erro', color: 'text-red-600', bgColor: 'bg-red-100' },
    critical: { label: 'Crítico', color: 'text-red-800', bgColor: 'bg-red-200' },
};
