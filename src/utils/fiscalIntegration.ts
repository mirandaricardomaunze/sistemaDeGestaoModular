/**
 * Fiscal Integration Hook
 * 
 * Este hook fornece funções para integrar automaticamente os cálculos fiscais
 * com os módulos de faturas, folha de pagamento e fornecedores.
 */

import { useFiscalStore } from '../stores/useFiscalStore';
import { generateId } from './helpers';
import type { TaxRetention } from '../types/fiscal';
import type { Employee } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface PayrollTaxResult {
    irps: number;
    irpsBracket: number | null;
    inssEmployee: number;
    inssEmployer: number;
    totalDeductions: number;
    netSalary: number;
}

export interface InvoiceTaxResult {
    subtotal: number;
    ivaRate: number;
    ivaAmount: number;
    total: number;
}

export interface SupplierPaymentResult {
    grossAmount: number;
    withholdingRate: number;
    withholdingAmount: number;
    netPayment: number;
}

// ============================================================================
// Fiscal Integration Functions
// ============================================================================

/**
 * Calculate all payroll taxes dynamically based on fiscal configuration
 */
export function usePayrollTaxes() {
    const { calculateIRPS, calculateINSS, taxConfigs, addRetention } = useFiscalStore();

    /**
     * Calculate IRPS, INSS and create retention records
     */
    const calculatePayrollTaxes = (
        employee: Employee,
        grossSalary: number,
        period: string, // Format: YYYY-MM
        createRetentions: boolean = false
    ): PayrollTaxResult => {
        // Calculate IRPS using progressive brackets
        const irpsResult = calculateIRPS(grossSalary);
        const irps = irpsResult.irps;
        const irpsBracket = irpsResult.bracket?.rate || null;

        // Calculate INSS contributions
        const inssResult = calculateINSS(grossSalary);
        const inssEmployee = inssResult.employeeContribution;
        const inssEmployer = inssResult.employerContribution;

        // Total deductions (only employee contributions)
        const totalDeductions = irps + inssEmployee;
        const netSalary = grossSalary - totalDeductions;

        // Create retention records if requested
        if (createRetentions) {
            const now = new Date().toISOString();
            const date = now.split('T')[0];

            // IRPS Retention
            if (irps > 0) {
                const irpsRetention: TaxRetention = {
                    id: generateId(),
                    type: 'irt', // Keep 'irt' as internal type for backwards compatibility
                    documentType: 'payroll',
                    documentId: `payroll-${employee.id}-${period}`,
                    documentNumber: `FOL-${period}-${employee.id.slice(-4)}`,
                    entityId: employee.id,
                    entityName: employee.name,
                    entityNuit: employee.nuit || '',
                    baseAmount: grossSalary,
                    rate: irpsBracket || 0,
                    retainedAmount: irps,
                    date,
                    period,
                    status: 'applied',
                    createdAt: now,
                    updatedAt: now,
                };
                addRetention(irpsRetention);
            }

            // INSS Employee Retention
            if (inssEmployee > 0) {
                const configList = Array.isArray(taxConfigs) ? taxConfigs : [];
                const inssEmployeeConfig = configList.find(c => c.type === 'inss_employee' && c.isActive);
                const inssEmployeeRetention: TaxRetention = {
                    id: generateId(),
                    type: 'inss_employee',
                    documentType: 'payroll',
                    documentId: `payroll-${employee.id}-${period}`,
                    documentNumber: `FOL-${period}-${employee.id.slice(-4)}`,
                    entityId: employee.id,
                    entityName: employee.name,
                    entityNuit: employee.nuit || '',
                    baseAmount: grossSalary,
                    rate: inssEmployeeConfig?.rate || 3,
                    retainedAmount: inssEmployee,
                    date,
                    period,
                    status: 'applied',
                    createdAt: now,
                    updatedAt: now,
                };
                addRetention(inssEmployeeRetention);
            }

            // INSS Employer Retention (company obligation)
            if (inssEmployer > 0) {
                const configList = Array.isArray(taxConfigs) ? taxConfigs : [];
                const inssEmployerConfig = configList.find(c => c.type === 'inss_employer' && c.isActive);
                const inssEmployerRetention: TaxRetention = {
                    id: generateId(),
                    type: 'inss_employer',
                    documentType: 'payroll',
                    documentId: `payroll-${employee.id}-${period}`,
                    documentNumber: `FOL-${period}-${employee.id.slice(-4)}`,
                    entityId: employee.id,
                    entityName: employee.name,
                    entityNuit: employee.nuit || '',
                    baseAmount: grossSalary,
                    rate: inssEmployerConfig?.rate || 4,
                    retainedAmount: inssEmployer,
                    date,
                    period,
                    status: 'applied',
                    createdAt: now,
                    updatedAt: now,
                };
                addRetention(inssEmployerRetention);
            }
        }

        return {
            irps,
            irpsBracket,
            inssEmployee,
            inssEmployer,
            totalDeductions,
            netSalary,
        };
    };

    /**
     * Get current tax rates from configuration
     */
    const getTaxRates = () => {
        const configList = Array.isArray(taxConfigs) ? taxConfigs : [];
        const inssEmployeeConfig = configList.find(c => c.type === 'inss_employee' && c.isActive);
        const inssEmployerConfig = configList.find(c => c.type === 'inss_employer' && c.isActive);
        const ivaConfig = configList.find(c => c.type === 'iva' && c.isActive);
        const withholdingConfig = configList.find(c => c.type === 'withholding' && c.isActive);

        return {
            inssEmployee: inssEmployeeConfig?.rate || 3,
            inssEmployer: inssEmployerConfig?.rate || 4,
            iva: ivaConfig?.rate || 16,
            withholding: withholdingConfig?.rate || 10,
        };
    };

    return {
        calculatePayrollTaxes,
        getTaxRates,
    };
}

/**
 * Calculate IVA for invoices dynamically
 */
export function useInvoiceTaxes() {
    const { calculateIVA, taxConfigs, addRetention } = useFiscalStore();

    /**
     * Calculate IVA for an invoice
     */
    const calculateInvoiceIVA = (
        subtotal: number,
        customerId: string,
        customerName: string,
        customerNuit: string,
        invoiceNumber: string,
        invoiceDate: string,
        period: string,
        createRetention: boolean = false
    ): InvoiceTaxResult => {
        const result = calculateIVA(subtotal);
        const configList = Array.isArray(taxConfigs) ? taxConfigs : [];
        const ivaConfig = configList.find(c => c.type === 'iva' && c.isActive);
        const ivaRate = ivaConfig?.rate || 16;

        if (createRetention && result.iva > 0) {
            const now = new Date().toISOString();
            const ivaRetention: TaxRetention = {
                id: generateId(),
                type: 'iva',
                documentType: 'invoice',
                documentId: invoiceNumber,
                documentNumber: invoiceNumber,
                entityId: customerId,
                entityName: customerName,
                entityNuit: customerNuit,
                baseAmount: subtotal,
                rate: ivaRate,
                retainedAmount: result.iva,
                date: invoiceDate,
                period,
                status: 'applied',
                createdAt: now,
                updatedAt: now,
            };
            addRetention(ivaRetention);
        }

        return {
            subtotal,
            ivaRate,
            ivaAmount: result.iva,
            total: result.total,
        };
    };

    /**
     * Get current IVA rate
     */
    const getIVARate = (): number => {
        const configList = Array.isArray(taxConfigs) ? taxConfigs : [];
        const ivaConfig = configList.find(c => c.type === 'iva' && c.isActive);
        return ivaConfig?.rate || 16;
    };

    return {
        calculateInvoiceIVA,
        getIVARate,
    };
}

/**
 * Calculate withholding tax for supplier payments
 */
export function useSupplierTaxes() {
    const { taxConfigs, addRetention } = useFiscalStore();

    /**
     * Calculate withholding tax for service providers
     */
    const calculateWithholdingTax = (
        grossAmount: number,
        supplierId: string,
        supplierName: string,
        supplierNuit: string,
        documentNumber: string,
        paymentDate: string,
        period: string,
        createRetention: boolean = false
    ): SupplierPaymentResult => {
        const configList = Array.isArray(taxConfigs) ? taxConfigs : [];
        const withholdingConfig = configList.find(c => c.type === 'withholding' && c.isActive);
        const rate = withholdingConfig?.rate || 10;
        const withholdingAmount = grossAmount * (rate / 100);
        const netPayment = grossAmount - withholdingAmount;

        if (createRetention && withholdingAmount > 0) {
            const now = new Date().toISOString();
            const retention: TaxRetention = {
                id: generateId(),
                type: 'withholding',
                documentType: 'supplier_payment',
                documentId: documentNumber,
                documentNumber: documentNumber,
                entityId: supplierId,
                entityName: supplierName,
                entityNuit: supplierNuit,
                baseAmount: grossAmount,
                rate,
                retainedAmount: withholdingAmount,
                date: paymentDate,
                period,
                status: 'applied',
                createdAt: now,
                updatedAt: now,
            };
            addRetention(retention);
        }

        return {
            grossAmount,
            withholdingRate: rate,
            withholdingAmount,
            netPayment,
        };
    };

    /**
     * Get current withholding rate
     */
    const getWithholdingRate = (): number => {
        const configList = Array.isArray(taxConfigs) ? taxConfigs : [];
        const config = configList.find(c => c.type === 'withholding' && c.isActive);
        return config?.rate || 10;
    };

    return {
        calculateWithholdingTax,
        getWithholdingRate,
    };
}

/**
 * Combined fiscal integration hook
 */
export function useFiscalIntegration() {
    const payrollTaxes = usePayrollTaxes();
    const invoiceTaxes = useInvoiceTaxes();
    const supplierTaxes = useSupplierTaxes();

    return {
        ...payrollTaxes,
        ...invoiceTaxes,
        ...supplierTaxes,
    };
}

/**
 * Get current fiscal period (YYYY-MM)
 */
export function getCurrentFiscalPeriod(): string {
    return new Date().toISOString().slice(0, 7);
}

/**
 * Get fiscal period from month and year
 */
export function getFiscalPeriodFromDate(month: number, year: number): string {
    return `${year}-${String(month).padStart(2, '0')}`;
}
