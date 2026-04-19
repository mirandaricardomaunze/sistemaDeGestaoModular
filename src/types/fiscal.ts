// ============================================================================
// Fiscal Management Types - Adapted for Mozambique Tax System
// ============================================================================

// ============================================================================
// Tax Configuration Types
// ============================================================================

export type TaxType = 'iva' | 'inss_employee' | 'inss_employer' | 'irt' | 'withholding';

export type TaxApplicableTo = 'invoices' | 'salaries' | 'suppliers' | 'all';

export interface TaxConfig {
    id: string;
    type: TaxType;
    name: string;
    description: string;
    rate: number; // Percentage (e.g., 16 for 16%)
    isActive: boolean;
    applicableTo: TaxApplicableTo[];
    effectiveFrom: string;
    effectiveTo?: string;
    createdAt: string;
    updatedAt: string;
}

// IRPS Progressive Tax Brackets (Mozambique 2024)
export interface IRPSBracket {
    id: string;
    minIncome: number;
    maxIncome: number | null; // null for unlimited
    rate: number; // Percentage
    fixedDeduction: number; // Valor a abater
    isActive: boolean;
    year: number;
}

// Default IRPS Brackets for Mozambique 2024
export const DEFAULT_IRPS_BRACKETS: Omit<IRPSBracket, 'id'>[] = [
    { minIncome: 0, maxIncome: 22780, rate: 10, fixedDeduction: 0, isActive: true, year: 2024 },
    { minIncome: 22781, maxIncome: 42560, rate: 15, fixedDeduction: 1139, isActive: true, year: 2024 },
    { minIncome: 42561, maxIncome: 100800, rate: 20, fixedDeduction: 3267, isActive: true, year: 2024 },
    { minIncome: 100801, maxIncome: 243040, rate: 25, fixedDeduction: 8307, isActive: true, year: 2024 },
    { minIncome: 243041, maxIncome: null, rate: 32, fixedDeduction: 25340, isActive: true, year: 2024 },
];

// ============================================================================
// Tax Retention Types
// ============================================================================

export type RetentionDocumentType = 'invoice' | 'payroll' | 'supplier_payment' | 'other';
export type RetentionStatus = 'pending' | 'applied' | 'reported' | 'paid';

export interface TaxRetention {
    id: string;
    type: TaxType;
    documentType: RetentionDocumentType;
    documentId: string;
    documentNumber: string;
    entityId: string; // Customer, Employee, or Supplier ID
    entityName: string;
    entityNuit?: string;
    baseAmount: number; // Valor base de incidência
    rate: number;
    retainedAmount: number;
    date: string;
    period: string; // Format: YYYY-MM
    status: RetentionStatus;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

// ============================================================================
// Fiscal Report Types
// ============================================================================

export type FiscalReportType =
    | 'iva_monthly'
    | 'iva_quarterly'
    | 'inss_monthly'
    | 'irt_monthly'
    | 'irt_annual'
    | 'saft_monthly'
    | 'saft_annual'
    | 'withholding_monthly';

export type FiscalReportStatus = 'draft' | 'generated' | 'validated' | 'submitted' | 'accepted' | 'rejected';

export type ExportFormat = 'pdf' | 'csv' | 'xml' | 'saft' | 'excel';

export interface FiscalReportSummary {
    totalBaseAmount: number;
    totalTaxAmount: number;
    totalDocuments: number;
    byCategory: Record<string, { base: number; tax: number; count: number }>;
}

export interface FiscalReport {
    id: string;
    type: FiscalReportType;
    name: string;
    period: string; // Format: YYYY-MM or YYYY-Q1
    startDate: string;
    endDate: string;
    status: FiscalReportStatus;
    summary: FiscalReportSummary;
    retentions: TaxRetention[];
    generatedAt: string;
    submittedAt?: string;
    submissionReference?: string;
    validationErrors?: string[];
    exportedFormats: ExportFormat[];
    createdBy: string;
    notes?: string;
}

// ============================================================================
// SAF-T Types (Standard Audit File for Tax)
// ============================================================================

export interface SAFTHeader {
    auditFileVersion: string;
    companyID: string;
    taxRegistrationNumber: string;
    companyName: string;
    companyAddress: SAFTAddress;
    fiscalYear: number;
    startDate: string;
    endDate: string;
    currencyCode: string;
    dateCreated: string;
    taxEntity: string;
    productCompanyTaxID: string;
    productID: string;
    productVersion: string;
}

export interface SAFTAddress {
    addressDetail: string;
    city: string;
    postalCode?: string;
    region?: string;
    country: string;
}

export interface SAFTCustomer {
    customerID: string;
    customerTaxID: string;
    companyName: string;
    billingAddress: SAFTAddress;
    selfBillingIndicator: boolean;
}

export interface SAFTInvoiceLine {
    lineNumber: number;
    productCode: string;
    productDescription: string;
    quantity: number;
    unitOfMeasure: string;
    unitPrice: number;
    taxPointDate: string;
    description: string;
    creditAmount?: number;
    debitAmount?: number;
    tax: {
        taxType: string;
        taxCountryRegion: string;
        taxCode: string;
        taxPercentage: number;
    };
}

export interface SAFTInvoice {
    invoiceNo: string;
    documentStatus: {
        invoiceStatus: 'N' | 'A' | 'F' | 'R'; // Normal, Anulado, Faturado, Substituído
        invoiceStatusDate: string;
        reason?: string;
        sourceID: string;
        sourceBilling: 'P' | 'I' | 'M'; // Programa, Integração, Manual
    };
    hash: string;
    hashControl: string;
    period: number;
    invoiceDate: string;
    invoiceType: 'FT' | 'FS' | 'FR' | 'ND' | 'NC'; // Fatura, Fatura Simplificada, etc.
    specialRegimes?: {
        selfBillingIndicator: boolean;
        cashVATSchemeIndicator: boolean;
        thirdPartiesBillingIndicator: boolean;
    };
    sourceID: string;
    systemEntryDate: string;
    customerID: string;
    lines: SAFTInvoiceLine[];
    documentTotals: {
        taxPayable: number;
        netTotal: number;
        grossTotal: number;
    };
}

export interface SAFTFile {
    header: SAFTHeader;
    masterFiles: {
        customers: SAFTCustomer[];
        products: any[];
        taxTable: any[];
    };
    sourceDocuments: {
        salesInvoices: {
            numberOfEntries: number;
            totalDebit: number;
            totalCredit: number;
            invoices: SAFTInvoice[];
        };
    };
}

// ============================================================================
// Audit Log Types
// ============================================================================

export type FiscalAuditAction =
    | 'created'
    | 'updated'
    | 'deleted'
    | 'exported'
    | 'submitted'
    | 'validated'
    | 'approved'
    | 'rejected';

export interface FiscalAuditLog {
    id: string;
    action: FiscalAuditAction;
    entityType: 'tax_config' | 'retention' | 'report' | 'saft' | 'deadline';
    entityId: string;
    entityDescription: string;
    previousValues?: Record<string, any>;
    newValues?: Record<string, any>;
    userId: string;
    userName: string;
    ipAddress?: string;
    timestamp: string;
    notes?: string;
}

// ============================================================================
// Deadline and Compliance Types
// ============================================================================

export type DeadlineType = 'iva' | 'inss' | 'irt' | 'saft' | 'other';
export type DeadlineStatus = 'pending' | 'completed' | 'overdue' | 'cancelled';

export interface FiscalDeadline {
    id: string;
    type: DeadlineType;
    title: string;
    description: string;
    dueDate: string;
    reminderDays: number[]; // Days before due date to send reminders
    status: DeadlineStatus;
    relatedReportId?: string;
    completedAt?: string;
    completedBy?: string;
    isRecurring: boolean;
    recurringPattern?: 'monthly' | 'quarterly' | 'annual';
    createdAt: string;
    updatedAt: string;
}

// Standard Mozambican fiscal deadlines
export const STANDARD_DEADLINES: Omit<FiscalDeadline, 'id' | 'createdAt' | 'updatedAt'>[] = [
    {
        type: 'iva',
        title: 'Declaração Mensal de IVA',
        description: 'Submissão da declaração de IVA do mês anterior',
        dueDate: '', // Will be set dynamically
        reminderDays: [7, 3, 1],
        status: 'pending',
        isRecurring: true,
        recurringPattern: 'monthly',
    },
    {
        type: 'inss',
        title: 'Declaração Mensal de INSS',
        description: 'Submissão da folha de pagamento e contribuições INSS',
        dueDate: '',
        reminderDays: [7, 3, 1],
        status: 'pending',
        isRecurring: true,
        recurringPattern: 'monthly',
    },
    {
        type: 'irt',
        title: 'Retenções IRPS',
        description: 'Pagamento das retenções de IRPS do mês anterior',
        dueDate: '',
        reminderDays: [7, 3, 1],
        status: 'pending',
        isRecurring: true,
        recurringPattern: 'monthly',
    },
];

// ============================================================================
// Dashboard Types
// ============================================================================

export interface LogisticsMetrics {
    income: number;
    expenses: number;
    profit: number;
    maintenanceCosts: number;
    count: number;
}

export interface FiscalDashboardMetrics {
    currentMonth: {
        ivaCollected: number;
        ivaDeductible: number;
        ivaPayable: number;
        inssEmployee: number;
        inssEmployer: number;
        irtRetained: number;
        withholdingTotal: number;
    };
    ytd: {
        ivaTotal: number;
        inssTotal: number;
        irtTotal: number;
        reportsSubmitted: number;
        reportsAccepted: number;
    };
    pendingDeadlines: FiscalDeadline[];
    recentRetentions: TaxRetention[];
    complianceStatus: 'compliant' | 'warning' | 'non_compliant';
    logisticsMetrics?: LogisticsMetrics;
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationError {
    field: string;
    message: string;
    severity: 'error' | 'warning';
}

export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationError[];
}

// ============================================================================
// Export Types
// ============================================================================

export interface ExportOptions {
    format: ExportFormat;
    includeHeader: boolean;
    dateFormat: string;
    decimalSeparator: '.' | ',';
    fieldSeparator: ',' | ';' | '\t';
    encoding: 'utf-8' | 'iso-8859-1';
}

export interface ExportResult {
    success: boolean;
    filename: string;
    data: string | Blob;
    mimeType: string;
    errors?: string[];
}
