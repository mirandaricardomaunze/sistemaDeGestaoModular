import type {
    TaxRetention,
    FiscalReport,
    SAFTFile,
    SAFTHeader,
    ExportOptions,
    ValidationResult,
    ValidationError,
} from '../types/fiscal';
import type { Invoice, CompanyInfo } from '../types';

// ============================================================================
// Fiscal Calculations
// ============================================================================

/**
 * Calculate IRPS (Imposto sobre Rendimento das Pessoas Singulares) - Mozambique progressive tax
 * Based on 2024 tax brackets
 */
export function calculateIRPS(
    grossSalary: number,
    brackets: Array<{ minIncome: number; maxIncome: number | null; rate: number; fixedDeduction: number }>
): { irt: number; effectiveRate: number; bracket: typeof brackets[0] | null } {
    // Sort brackets by minIncome
    const sortedBrackets = [...brackets].sort((a, b) => a.minIncome - b.minIncome);

    // Find applicable bracket
    const bracket = sortedBrackets.find((b) => {
        if (b.maxIncome === null) {
            return grossSalary >= b.minIncome;
        }
        return grossSalary >= b.minIncome && grossSalary <= b.maxIncome;
    });

    if (!bracket) {
        return { irt: 0, effectiveRate: 0, bracket: null };
    }

    // Calculate IRPS: (Gross * Rate%) - Fixed Deduction
    const irt = Math.max(0, (grossSalary * bracket.rate / 100) - bracket.fixedDeduction);
    const effectiveRate = grossSalary > 0 ? (irt / grossSalary) * 100 : 0;

    return { irt, effectiveRate, bracket };
}

/**
 * Calculate INSS contributions
 */
export function calculateINSS(
    grossSalary: number,
    employeeRate: number = 3,
    employerRate: number = 4
): { employee: number; employer: number; total: number } {
    const employee = grossSalary * (employeeRate / 100);
    const employer = grossSalary * (employerRate / 100);
    return { employee, employer, total: employee + employer };
}

/**
 * Calculate IVA
 */
export function calculateIVA(
    baseAmount: number,
    rate: number = 16
): { iva: number; total: number } {
    const iva = baseAmount * (rate / 100);
    return { iva, total: baseAmount + iva };
}

/**
 * Calculate withholding tax for service providers
 */
export function calculateWithholding(
    amount: number,
    rate: number = 10
): number {
    return amount * (rate / 100);
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate NUIT (Número Único de Identificação Tributária)
 */
export function validateNUIT(nuit: string): boolean {
    // NUIT should be 9 digits
    const cleaned = nuit.replace(/\D/g, '');
    return cleaned.length === 9;
}

/**
 * Validate fiscal document for SAF-T export
 */
export function validateInvoiceForSAFT(invoice: Invoice): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Required fields
    if (!invoice.invoiceNumber) {
        errors.push({ field: 'invoiceNumber', message: 'Número da fatura é obrigatório', severity: 'error' });
    }

    if (!invoice.customerName) {
        errors.push({ field: 'customerName', message: 'Nome do cliente é obrigatório', severity: 'error' });
    }

    if (!invoice.customerDocument) {
        warnings.push({ field: 'customerDocument', message: 'NIF do cliente não preenchido', severity: 'warning' });
    } else if (!validateNUIT(invoice.customerDocument)) {
        errors.push({ field: 'customerDocument', message: 'NIF do cliente inválido (deve ter 9 dígitos)', severity: 'error' });
    }

    if (!invoice.issueDate) {
        errors.push({ field: 'issueDate', message: 'Data de emissão é obrigatória', severity: 'error' });
    }

    if (invoice.items.length === 0) {
        errors.push({ field: 'items', message: 'A fatura deve ter pelo menos um item', severity: 'error' });
    }

    if (invoice.total <= 0) {
        errors.push({ field: 'total', message: 'O valor total deve ser positivo', severity: 'error' });
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
    };
}

/**
 * Validate fiscal report before submission
 */
export function validateFiscalReport(report: FiscalReport): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    if (!report.period) {
        errors.push({ field: 'period', message: 'Período é obrigatório', severity: 'error' });
    }

    if (!report.startDate || !report.endDate) {
        errors.push({ field: 'dates', message: 'Datas de início e fim são obrigatórias', severity: 'error' });
    }

    if (report.retentions.length === 0) {
        warnings.push({ field: 'retentions', message: 'O relatório não contém retenções', severity: 'warning' });
    }

    // Validate each retention has required fields
    report.retentions.forEach((retention, index) => {
        if (!retention.entityNuit) {
            warnings.push({
                field: `retentions[${index}].entityNuit`,
                message: `Retenção ${index + 1}: NIF da entidade não preenchido`,
                severity: 'warning',
            });
        }
    });

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
    };
}

// ============================================================================
// SAF-T Generation
// ============================================================================

/**
 * Generate SAF-T XML header
 */
export function generateSAFTHeader(
    companyInfo: CompanyInfo,
    fiscalYear: number,
    startDate: string,
    endDate: string
): SAFTHeader {
    return {
        auditFileVersion: '1.04_01',
        companyID: companyInfo.taxId,
        taxRegistrationNumber: companyInfo.taxId,
        companyName: companyInfo.name,
        companyAddress: {
            addressDetail: companyInfo.address,
            city: 'Maputo', // Default
            country: 'MZ',
        },
        fiscalYear,
        startDate,
        endDate,
        currencyCode: 'MZN',
        dateCreated: new Date().toISOString().split('T')[0],
        taxEntity: 'Global',
        productCompanyTaxID: companyInfo.taxId,
        productID: 'ERP Sistema',
        productVersion: '1.0',
    };
}

/**
 * Generate SAF-T XML string from data
 */
export function generateSAFTXML(saftData: SAFTFile): string {
    const escapeXML = (str: string): string => {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    };

    const header = saftData.header;
    const invoices = saftData.sourceDocuments.salesInvoices.invoices;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:MZ_1.04_01">
  <Header>
    <AuditFileVersion>${header.auditFileVersion}</AuditFileVersion>
    <CompanyID>${escapeXML(header.companyID)}</CompanyID>
    <TaxRegistrationNumber>${escapeXML(header.taxRegistrationNumber)}</TaxRegistrationNumber>
    <CompanyName>${escapeXML(header.companyName)}</CompanyName>
    <CompanyAddress>
      <AddressDetail>${escapeXML(header.companyAddress.addressDetail)}</AddressDetail>
      <City>${escapeXML(header.companyAddress.city)}</City>
      <Country>${header.companyAddress.country}</Country>
    </CompanyAddress>
    <FiscalYear>${header.fiscalYear}</FiscalYear>
    <StartDate>${header.startDate}</StartDate>
    <EndDate>${header.endDate}</EndDate>
    <CurrencyCode>${header.currencyCode}</CurrencyCode>
    <DateCreated>${header.dateCreated}</DateCreated>
    <TaxEntity>${header.taxEntity}</TaxEntity>
    <ProductCompanyTaxID>${escapeXML(header.productCompanyTaxID)}</ProductCompanyTaxID>
    <ProductID>${escapeXML(header.productID)}</ProductID>
    <ProductVersion>${header.productVersion}</ProductVersion>
  </Header>
  <MasterFiles>
    <Customer>
${saftData.masterFiles.customers.map(c => `      <CustomerID>${escapeXML(c.customerID)}</CustomerID>
      <CustomerTaxID>${escapeXML(c.customerTaxID)}</CustomerTaxID>
      <CompanyName>${escapeXML(c.companyName)}</CompanyName>`).join('\n')}
    </Customer>
  </MasterFiles>
  <SourceDocuments>
    <SalesInvoices>
      <NumberOfEntries>${saftData.sourceDocuments.salesInvoices.numberOfEntries}</NumberOfEntries>
      <TotalDebit>${saftData.sourceDocuments.salesInvoices.totalDebit.toFixed(2)}</TotalDebit>
      <TotalCredit>${saftData.sourceDocuments.salesInvoices.totalCredit.toFixed(2)}</TotalCredit>
${invoices.map(inv => `      <Invoice>
        <InvoiceNo>${escapeXML(inv.invoiceNo)}</InvoiceNo>
        <InvoiceDate>${inv.invoiceDate}</InvoiceDate>
        <InvoiceType>${inv.invoiceType}</InvoiceType>
        <CustomerID>${escapeXML(inv.customerID)}</CustomerID>
        <DocumentTotals>
          <TaxPayable>${inv.documentTotals.taxPayable.toFixed(2)}</TaxPayable>
          <NetTotal>${inv.documentTotals.netTotal.toFixed(2)}</NetTotal>
          <GrossTotal>${inv.documentTotals.grossTotal.toFixed(2)}</GrossTotal>
        </DocumentTotals>
      </Invoice>`).join('\n')}
    </SalesInvoices>
  </SourceDocuments>
</AuditFile>`;

    return xml;
}

// ============================================================================
// CSV Export Functions
// ============================================================================

/**
 * Export retentions to CSV
 */
export function exportRetentionsToCSV(
    retentions: TaxRetention[],
    options: ExportOptions
): string {
    const separator = options.fieldSeparator || ';';
    const decimal = options.decimalSeparator || ',';

    const formatNumber = (num: number): string => {
        return num.toFixed(2).replace('.', decimal);
    };

    const headers = [
        'Tipo',
        'Documento',
        'Número Documento',
        'Entidade',
        'NIF',
        'Valor Base',
        'Taxa (%)',
        'Valor Retido',
        'Data',
        'Período',
        'Estado',
    ].join(separator);

    const rows = retentions.map(r => [
        r.type.toUpperCase(),
        r.documentType,
        r.documentNumber,
        r.entityName,
        r.entityNuit || '',
        formatNumber(r.baseAmount),
        formatNumber(r.rate),
        formatNumber(r.retainedAmount),
        r.date,
        r.period,
        r.status,
    ].join(separator));

    return [headers, ...rows].join('\n');
}

/**
 * Export IVA report to official CSV format
 */
export function exportIVAReportCSV(
    retentions: TaxRetention[],
    period: string,
    companyNuit: string
): string {
    const separator = ';';

    // Official IVA declaration format
    const headers = [
        'NIF_DECLARANTE',
        'PERIODO',
        'NIF_CLIENTE',
        'TIPO_DOCUMENTO',
        'NUMERO_DOCUMENTO',
        'DATA_DOCUMENTO',
        'BASE_TRIBUTAVEL',
        'IVA_LIQUIDADO',
    ].join(separator);

    const ivaRetentions = retentions.filter(r => r.type === 'iva');

    const rows = ivaRetentions.map(r => [
        companyNuit,
        period,
        r.entityNuit || '',
        r.documentType === 'invoice' ? 'FT' : 'XX',
        r.documentNumber,
        r.date,
        r.baseAmount.toFixed(2),
        r.retainedAmount.toFixed(2),
    ].join(separator));

    return [headers, ...rows].join('\n');
}

/**
 * Export INSS report to official CSV format
 */
export function exportINSSReportCSV(
    retentions: TaxRetention[],
    period: string,
    companyNuit: string
): string {
    const separator = ';';

    const headers = [
        'NIF_EMPREGADOR',
        'PERIODO',
        'NOME_TRABALHADOR',
        'NUIT_TRABALHADOR',
        'REMUNERACAO_BASE',
        'CONTRIBUICAO_TRABALHADOR',
        'CONTRIBUICAO_EMPREGADOR',
    ].join(separator);

    const inssRetentions = retentions.filter(r =>
        r.type === 'inss_employee' || r.type === 'inss_employer'
    );

    // Group by entity (employee)
    const byEmployee = inssRetentions.reduce((acc, r) => {
        if (!acc[r.entityId]) {
            acc[r.entityId] = {
                name: r.entityName,
                nuit: r.entityNuit || '',
                base: r.baseAmount,
                employee: 0,
                employer: 0,
            };
        }
        if (r.type === 'inss_employee') {
            acc[r.entityId].employee = r.retainedAmount;
        } else {
            acc[r.entityId].employer = r.retainedAmount;
        }
        return acc;
    }, {} as Record<string, any>);

    const rows = Object.values(byEmployee).map((e: any) => [
        companyNuit,
        period,
        e.name,
        e.nuit,
        e.base.toFixed(2),
        e.employee.toFixed(2),
        e.employer.toFixed(2),
    ].join(separator));

    return [headers, ...rows].join('\n');
}

// ============================================================================
// Date Helpers for Fiscal Periods
// ============================================================================

/**
 * Get current fiscal period (YYYY-MM)
 */
export function getCurrentFiscalPeriod(): string {
    return new Date().toISOString().slice(0, 7);
}

/**
 * Get fiscal period from date
 */
export function getFiscalPeriod(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().slice(0, 7);
}

/**
 * Get period range (start and end dates)
 */
export function getPeriodRange(period: string): { startDate: string; endDate: string } {
    const [year, month] = period.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of month

    return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
    };
}

/**
 * Calculate deadline date (20th of next month)
 */
export function calculateDeadlineDate(period: string): string {
    const [year, month] = period.split('-').map(Number);
    const deadline = new Date(year, month, 20); // 20th of next month
    return deadline.toISOString().split('T')[0];
}

/**
 * Format period for display
 */
export function formatPeriod(period: string): string {
    const [year, month] = period.split('-');
    const months = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${months[parseInt(month) - 1]} ${year}`;
}
