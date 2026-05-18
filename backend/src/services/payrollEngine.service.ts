import { calculateINSS, calculateIRT, getIRTBracketRate, roundMoney } from '../utils/irtTables';

export interface PayrollComponent {
    name: string;
    amount: number;
    taxable?: boolean;
}

export interface PayrollInput {
    baseSalary: number;
    allowances?: PayrollComponent[];
    deductions?: PayrollComponent[];
    overtimeAmount?: number;
    bonus?: number;
}

export interface PayrollResult {
    baseSalary: number;
    grossSalary: number;
    taxableIncome: number;
    inssEmployee: number;
    inssEmployer: number;
    irt: number;
    manualDeductions: number;
    totalDeductions: number;
    netSalary: number;
    breakdown: {
        taxableIncome: number;
        nonTaxableAllowances: number;
        irtBracketRate: number;
    };
}

export class PayrollEngine {
    calculate(input: PayrollInput): PayrollResult {
        const baseSalary = roundMoney(Number(input.baseSalary || 0));
        const overtimeAmount = roundMoney(Number(input.overtimeAmount || 0));
        const bonus = roundMoney(Number(input.bonus || 0));
        const allowances = input.allowances ?? [];
        const deductions = input.deductions ?? [];

        const taxableAllowances = allowances
            .filter((item) => item.taxable !== false)
            .reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const nonTaxableAllowances = allowances
            .filter((item) => item.taxable === false)
            .reduce((sum, item) => sum + Number(item.amount || 0), 0);

        const grossSalary = roundMoney(baseSalary + overtimeAmount + bonus + taxableAllowances + nonTaxableAllowances);
        const taxableIncome = roundMoney(baseSalary + overtimeAmount + bonus + taxableAllowances);
        const { employeeContribution: inssEmployee, employerContribution: inssEmployer } = calculateINSS(baseSalary);
        const incomeAfterINSS = Math.max(0, taxableIncome - inssEmployee);
        const irt = calculateIRT(incomeAfterINSS);
        const manualDeductions = roundMoney(deductions.reduce((sum, item) => sum + Number(item.amount || 0), 0));
        const totalDeductions = roundMoney(inssEmployee + irt + manualDeductions);
        const netSalary = roundMoney(Math.max(0, grossSalary - totalDeductions));

        return {
            baseSalary,
            grossSalary,
            taxableIncome,
            inssEmployee,
            inssEmployer,
            irt,
            manualDeductions,
            totalDeductions,
            netSalary,
            breakdown: {
                taxableIncome,
                nonTaxableAllowances: roundMoney(nonTaxableAllowances),
                irtBracketRate: getIRTBracketRate(incomeAfterINSS)
            }
        };
    }
}

export const payrollEngine = new PayrollEngine();
