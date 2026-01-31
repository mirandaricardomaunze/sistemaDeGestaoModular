import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateId } from '../utils/helpers';
import { fiscalAPI } from '../services/api';
import type {
    TaxConfig,
    IRPSBracket,
    TaxRetention,
    FiscalReport,
    FiscalAuditLog,
    FiscalDeadline,
    FiscalDashboardMetrics,
    TaxType,
    LogisticsMetrics,
} from '../types/fiscal';

// ============================================================================
// Default Tax Configurations for Mozambique
// ============================================================================

const defaultTaxConfigs: TaxConfig[] = [
    {
        id: generateId(),
        type: 'iva',
        name: 'IVA - Imposto sobre Valor Acrescentado',
        description: 'Imposto sobre vendas e serviços',
        rate: 16,
        isActive: true,
        applicableTo: ['invoices'],
        effectiveFrom: '2024-01-01',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        id: generateId(),
        type: 'inss_employee',
        name: 'INSS - Contribuição do Trabalhador',
        description: 'Contribuição obrigatória para segurança social (trabalhador)',
        rate: 3,
        isActive: true,
        applicableTo: ['salaries'],
        effectiveFrom: '2024-01-01',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        id: generateId(),
        type: 'inss_employer',
        name: 'INSS - Contribuição do Empregador',
        description: 'Contribuição obrigatória para segurança social (empregador)',
        rate: 4,
        isActive: true,
        applicableTo: ['salaries'],
        effectiveFrom: '2024-01-01',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        id: generateId(),
        type: 'irt',
        name: 'IRPS - Imposto sobre Rendimento das Pessoas Singulares',
        description: 'Imposto progressivo sobre salários',
        rate: 0, // Progressive, calculated by brackets
        isActive: true,
        applicableTo: ['salaries'],
        effectiveFrom: '2024-01-01',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        id: generateId(),
        type: 'withholding',
        name: 'Retenção na Fonte - Prestadores de Serviços',
        description: 'Retenção aplicável a pagamentos a prestadores de serviços',
        rate: 10,
        isActive: true,
        applicableTo: ['suppliers'],
        effectiveFrom: '2024-01-01',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
];

// Default IRPS Brackets
const defaultIRPSBrackets: IRPSBracket[] = [
    { id: generateId(), minIncome: 0, maxIncome: 22780, rate: 10, fixedDeduction: 0, isActive: true, year: 2024 },
    { id: generateId(), minIncome: 22781, maxIncome: 42560, rate: 15, fixedDeduction: 1139, isActive: true, year: 2024 },
    { id: generateId(), minIncome: 42561, maxIncome: 100800, rate: 20, fixedDeduction: 3267, isActive: true, year: 2024 },
    { id: generateId(), minIncome: 100801, maxIncome: 243040, rate: 25, fixedDeduction: 8307, isActive: true, year: 2024 },
    { id: generateId(), minIncome: 243041, maxIncome: null, rate: 32, fixedDeduction: 25340, isActive: true, year: 2024 },
];

// ============================================================================
// Fiscal Store Interface
// ============================================================================

interface FiscalState {
    // Database Sync
    isSyncing: boolean;
    loadFiscalDataFromDatabase: () => Promise<void>;

    // Tax Configuration
    taxConfigs: TaxConfig[];
    irpsBrackets: IRPSBracket[];
    addTaxConfig: (config: TaxConfig) => Promise<void>;
    updateTaxConfig: (id: string, config: Partial<TaxConfig>) => Promise<void>;
    deleteTaxConfig: (id: string) => Promise<void>;
    updateIRPSBracket: (id: string, bracket: Partial<IRPSBracket>) => Promise<void>;

    // Retentions
    retentions: TaxRetention[];
    addRetention: (retention: TaxRetention) => Promise<void>;
    updateRetention: (id: string, retention: Partial<TaxRetention>) => Promise<void>;
    deleteRetention: (id: string) => Promise<void>;
    getRetentionsByPeriod: (period: string) => TaxRetention[];
    getRetentionsByType: (type: TaxType) => TaxRetention[];

    // Reports
    fiscalReports: FiscalReport[];
    addFiscalReport: (report: FiscalReport) => Promise<void>;
    updateFiscalReport: (id: string, report: Partial<FiscalReport>) => Promise<void>;
    deleteFiscalReport: (id: string) => Promise<void>;

    // Audit Logs
    auditLogs: FiscalAuditLog[];
    addAuditLog: (log: FiscalAuditLog) => void;

    // Deadlines
    deadlines: FiscalDeadline[];
    addDeadline: (deadline: FiscalDeadline) => Promise<void>;
    updateDeadline: (id: string, deadline: Partial<FiscalDeadline>) => Promise<void>;
    deleteDeadline: (id: string) => Promise<void>;
    completeDeadline: (id: string, userId: string) => Promise<void>;

    // Calculations
    calculateIRPS: (grossSalary: number) => { irps: number; netSalary: number; bracket: IRPSBracket | null };
    calculateINSS: (grossSalary: number) => { employeeContribution: number; employerContribution: number };
    calculateIVA: (amount: number) => { iva: number; total: number };

    // Dashboard Metrics
    getDashboardMetrics: () => FiscalDashboardMetrics;
    logisticsMetrics: LogisticsMetrics | null;
    fetchLogisticsMetrics: () => Promise<void>;

    // Reset State
    reset: () => void;
}

// ============================================================================
// Fiscal Store Implementation
// ============================================================================

export const useFiscalStore = create<FiscalState>()(
    persist(
        (set, get) => ({
            // Initial State
            taxConfigs: defaultTaxConfigs,
            irpsBrackets: defaultIRPSBrackets,
            retentions: [],
            fiscalReports: [],
            auditLogs: [],
            deadlines: [],
            isSyncing: false,
            logisticsMetrics: null,

            // Database Actions
            loadFiscalDataFromDatabase: async () => {
                const token = localStorage.getItem('auth_token');
                if (!token) return;

                set({ isSyncing: true });
                try {
                    // Load Tax Configs
                    const configs = await fiscalAPI.getTaxConfigs();
                    if (Array.isArray(configs)) {
                        set({ taxConfigs: configs });
                    }

                    // Load IRPS Brackets
                    const brackets = await fiscalAPI.getIRPSBrackets();
                    if (Array.isArray(brackets)) {
                        set({ irpsBrackets: brackets });
                    }

                    // Load Retentions
                    const retentionsResult = await fiscalAPI.getRetentions();
                    if (Array.isArray(retentionsResult)) {
                        set({
                            retentions: retentionsResult.map((r: any) => ({
                                ...r,
                                baseAmount: Number(r.baseAmount),
                                retainedAmount: Number(r.retainedAmount),
                                rate: Number(r.rate)
                            }))
                        });
                    }

                    // Load Reports
                    const reports = await fiscalAPI.getReports();
                    if (Array.isArray(reports)) {
                        set({ fiscalReports: reports });
                    }

                    // Load Deadlines
                    const deadlines = await fiscalAPI.getDeadlines();
                    if (Array.isArray(deadlines)) {
                        set({ deadlines });
                    }

                    // Load Logistics Metrics
                    await get().fetchLogisticsMetrics();
                } catch (error) {
                    console.error('Failed to load fiscal data from database:', error);
                } finally {
                    set({ isSyncing: false });
                }
            },

            // Tax Config Actions
            addTaxConfig: async (config) => {
                // Local update
                set((state) => ({
                    taxConfigs: [...state.taxConfigs, config],
                }));
                // Sync
                try {
                    await fiscalAPI.createTaxConfig(config);
                } catch (error) {
                    console.error('Failed to sync tax config:', error);
                }
            },

            updateTaxConfig: async (id, updates) => {
                // Local update
                set((state) => ({
                    taxConfigs: state.taxConfigs.map((c) =>
                        c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
                    ),
                }));
                // Sync
                try {
                    await fiscalAPI.updateTaxConfig(id, updates);
                } catch (error) {
                    console.error('Failed to update tax config:', error);
                }
            },

            deleteTaxConfig: async (id) => {
                // Not standard to delete tax configs, usually just deactivate
                const configs = get().taxConfigs;
                const config = Array.isArray(configs) ? configs.find(c => c.id === id) : null;
                if (config) {
                    await get().updateTaxConfig(id, { isActive: false });
                }
            },

            updateIRPSBracket: async (id, updates) => {
                // Local update
                set((state) => ({
                    irpsBrackets: state.irpsBrackets.map((b) =>
                        b.id === id ? { ...b, ...updates } : b
                    ),
                }));
                // Sync (we only have create in API currently, but it works for update if DB handles conflict)
                try {
                    const bracket = get().irpsBrackets.find(b => b.id === id);
                    if (bracket) await fiscalAPI.createIRPSBracket(bracket);
                } catch (error) {
                    console.error('Failed to sync IRPS bracket:', error);
                }
            },

            // Retention Actions
            addRetention: async (retention) => {
                // Local update
                set((state) => ({
                    retentions: [retention, ...state.retentions],
                }));
                // Sync
                try {
                    await fiscalAPI.createRetention(retention);
                } catch (error) {
                    console.error('Failed to sync retention:', error);
                }
            },

            updateRetention: async (id, updates) => {
                // Local update
                set((state) => ({
                    retentions: state.retentions.map((r) =>
                        r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
                    ),
                }));
                // Sync
                try {
                    await fiscalAPI.updateRetention(id, updates);
                } catch (error) {
                    console.error('Failed to update retention:', error);
                }
            },

            deleteRetention: async (id) => {
                // Local update
                set((state) => ({
                    retentions: state.retentions.filter((r) => r.id !== id),
                }));
                // Sync (optional - typically we don't delete retentions)
            },

            getRetentionsByPeriod: (period) => {
                return get().retentions.filter((r) => r.period === period);
            },

            getRetentionsByType: (type) => {
                return get().retentions.filter((r) => r.type === type);
            },

            // Report Actions
            addFiscalReport: async (report) => {
                // Local update
                set((state) => ({
                    fiscalReports: [report, ...state.fiscalReports],
                }));
                // Sync
                try {
                    await fiscalAPI.createReport(report);
                } catch (error) {
                    console.error('Failed to sync report:', error);
                }
            },

            updateFiscalReport: async (id, updates) => {
                // Local update
                set((state) => ({
                    fiscalReports: state.fiscalReports.map((r) =>
                        r.id === id ? { ...r, ...updates } : r
                    ),
                }));
                // Sync
                try {
                    await fiscalAPI.updateReport(id, updates);
                } catch (error) {
                    console.error('Failed to update report:', error);
                }
            },

            deleteFiscalReport: async (id) => {
                // Local update
                set((state) => ({
                    fiscalReports: state.fiscalReports.filter((r) => r.id !== id),
                }));
            },

            // Audit Log Actions
            addAuditLog: (log) => set((state) => ({
                auditLogs: [log, ...state.auditLogs].slice(0, 1000), // Keep last 1000 logs
            })),

            // Deadline Actions
            addDeadline: async (deadline) => {
                // Local update
                set((state) => ({
                    deadlines: [...state.deadlines, deadline],
                }));
                // Sync
                try {
                    await fiscalAPI.createDeadline(deadline);
                } catch (error) {
                    console.error('Failed to sync deadline:', error);
                }
            },

            updateDeadline: async (id, updates) => {
                // Local update
                set((state) => ({
                    deadlines: state.deadlines.map((d) =>
                        d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d
                    ),
                }));
                // Sync
                try {
                    await fiscalAPI.updateDeadline(id, updates);
                } catch (error) {
                    console.error('Failed to update deadline:', error);
                }
            },

            deleteDeadline: async (id) => {
                // Local update
                set((state) => ({
                    deadlines: state.deadlines.filter((d) => d.id !== id),
                }));
            },

            completeDeadline: async (id, userId) => {
                // Local update
                set((state) => ({
                    deadlines: state.deadlines.map((d) =>
                        d.id === id
                            ? {
                                ...d,
                                status: 'completed' as const,
                                completedAt: new Date().toISOString(),
                                completedBy: userId,
                                updatedAt: new Date().toISOString(),
                            }
                            : d
                    ),
                }));
                // Sync
                try {
                    await fiscalAPI.completeDeadline(id);
                } catch (error) {
                    console.error('Failed to complete deadline in database:', error);
                }
            },

            // IRPS Calculation (Progressive Tax)
            calculateIRPS: (grossSalary) => {
                const brackets = get().irpsBrackets.filter((b) => b.isActive).sort((a, b) => a.minIncome - b.minIncome);

                if (brackets.length === 0) {
                    return { irps: 0, netSalary: grossSalary, bracket: null };
                }

                // Find applicable bracket
                const bracket = brackets.find((b) => {
                    if (b.maxIncome === null) {
                        return grossSalary >= b.minIncome;
                    }
                    return grossSalary >= b.minIncome && grossSalary <= b.maxIncome;
                });

                if (!bracket) {
                    return { irps: 0, netSalary: grossSalary, bracket: null };
                }

                // Calculate IRPS: (Gross * Rate%) - Fixed Deduction
                const irps = Math.max(0, (grossSalary * bracket.rate / 100) - bracket.fixedDeduction);
                const netSalary = grossSalary - irps;

                return { irps, netSalary, bracket };
            },

            // INSS Calculation
            calculateINSS: (grossSalary) => {
                const configs = get().taxConfigs;
                const configList = Array.isArray(configs) ? configs : [];
                const employeeConfig = configList.find((c) => c.type === 'inss_employee' && c.isActive);
                const employerConfig = configList.find((c) => c.type === 'inss_employer' && c.isActive);

                const employeeContribution = employeeConfig ? grossSalary * (employeeConfig.rate / 100) : 0;
                const employerContribution = employerConfig ? grossSalary * (employerConfig.rate / 100) : 0;

                return { employeeContribution, employerContribution };
            },

            // IVA Calculation
            calculateIVA: (amount) => {
                const configs = get().taxConfigs;
                const configList = Array.isArray(configs) ? configs : [];
                const ivaConfig = configList.find((c) => c.type === 'iva' && c.isActive);
                const rate = ivaConfig?.rate || 16;

                const iva = amount * (rate / 100);
                const total = amount + iva;

                return { iva, total };
            },

            // Dashboard Metrics
            getDashboardMetrics: () => {
                const state = get();
                const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
                const currentYear = new Date().getFullYear();

                // Current month retentions
                const monthRetentions = state.retentions.filter((r) => r.period === currentMonth);

                const ivaRetentions = monthRetentions.filter((r) => r.type === 'iva');
                const inssRetentions = monthRetentions.filter((r) => r.type === 'inss_employee' || r.type === 'inss_employer');
                const irtRetentions = monthRetentions.filter((r) => r.type === 'irt');
                const withholdingRetentions = monthRetentions.filter((r) => r.type === 'withholding');

                // YTD retentions
                const ytdRetentions = state.retentions.filter((r) => r.period.startsWith(currentYear.toString()));

                // Pending deadlines
                const today = new Date().toISOString().split('T')[0];
                const pendingDeadlines = state.deadlines.filter(
                    (d) => d.status === 'pending' && d.dueDate >= today
                ).sort((a, b) => a.dueDate.localeCompare(b.dueDate));

                // Check compliance
                const overdueDeadlines = state.deadlines.filter(
                    (d) => d.status === 'pending' && d.dueDate < today
                );

                let complianceStatus: 'compliant' | 'warning' | 'non_compliant' = 'compliant';
                if (overdueDeadlines.length > 0) {
                    complianceStatus = 'non_compliant';
                } else if (pendingDeadlines.some((d) => {
                    const dueDate = new Date(d.dueDate);
                    const daysUntilDue = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    return daysUntilDue <= 3;
                })) {
                    complianceStatus = 'warning';
                }

                return {
                    currentMonth: {
                        ivaCollected: ivaRetentions.reduce((sum, r) => sum + r.retainedAmount, 0),
                        ivaDeductible: 0, // Would need purchase invoices
                        ivaPayable: ivaRetentions.reduce((sum, r) => sum + r.retainedAmount, 0),
                        inssEmployee: inssRetentions
                            .filter((r) => r.type === 'inss_employee')
                            .reduce((sum, r) => sum + r.retainedAmount, 0),
                        inssEmployer: inssRetentions
                            .filter((r) => r.type === 'inss_employer')
                            .reduce((sum, r) => sum + r.retainedAmount, 0),
                        irtRetained: irtRetentions.reduce((sum, r) => sum + r.retainedAmount, 0),
                        withholdingTotal: withholdingRetentions.reduce((sum, r) => sum + r.retainedAmount, 0),
                    },
                    ytd: {
                        ivaTotal: ytdRetentions.filter((r) => r.type === 'iva').reduce((sum, r) => sum + r.retainedAmount, 0),
                        inssTotal: ytdRetentions.filter((r) => r.type === 'inss_employee' || r.type === 'inss_employer').reduce((sum, r) => sum + r.retainedAmount, 0),
                        irtTotal: ytdRetentions.filter((r) => r.type === 'irt').reduce((sum, r) => sum + r.retainedAmount, 0),
                        reportsSubmitted: state.fiscalReports.filter((r) => r.status === 'submitted' || r.status === 'accepted').length,
                        reportsAccepted: state.fiscalReports.filter((r) => r.status === 'accepted').length,
                    },
                    pendingDeadlines: pendingDeadlines.slice(0, 5),
                    recentRetentions: state.retentions.slice(0, 10),
                    complianceStatus,
                    logisticsMetrics: state.logisticsMetrics || undefined,
                };
            },

            fetchLogisticsMetrics: async () => {
                try {
                    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/fiscal/metrics/logistics`, {
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                        }
                    });
                    if (response.ok) {
                        const data = await response.json();
                        set({ logisticsMetrics: data });
                    }
                } catch (error) {
                    console.error('Failed to fetch logistics metrics:', error);
                }
            },

            // Reset State
            reset: () => set({
                taxConfigs: defaultTaxConfigs,
                irpsBrackets: defaultIRPSBrackets,
                retentions: [],
                fiscalReports: [],
                auditLogs: [],
                deadlines: [],
                isSyncing: false,
                logisticsMetrics: null,
            }),
        }),
        {
            name: 'fiscal-storage',
            partialize: (state) => ({
                taxConfigs: state.taxConfigs,
                irpsBrackets: state.irpsBrackets,
                retentions: state.retentions,
                fiscalReports: state.fiscalReports,
                deadlines: state.deadlines,
                // Don't persist audit logs to avoid storage bloat
            }),
            onRehydrateStorage: () => () => {
                // We no longer sync automatically on rehydration
                // Sync is now triggered by useAuthStore after successful authentication
            },
        }
    )
);

