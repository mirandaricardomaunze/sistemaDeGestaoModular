import { calculateINSS, calculateIRT, getIRTBracketRate, roundMoney } from '../utils/irtTables';

/**
 * Component of a payroll calculation (e.g. transport allowance, advance loan deduction).
 * `taxable` defaults to `true` — set to `false` for non-taxable allowances such as
 * meal/transport stipends defined in Mozambican labor law.
 */
export interface PayrollComponent {
    name: string;
    amount: number;
    /** Defaults to `true`. Set `false` for components excluded from IRT base. */
    taxable?: boolean;
}

/** Inputs to a single employee's monthly payroll run. All amounts in MZN. */
export interface PayrollInput {
    baseSalary: number;
    allowances?: PayrollComponent[];
    deductions?: PayrollComponent[];
    overtimeAmount?: number;
    bonus?: number;
}

/**
 * Output of {@link PayrollEngine.calculate}. All values are rounded to 2 decimal
 * places (MZN cents). `grossSalary − totalDeductions = netSalary`.
 */
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

/**
 * Stateless payroll computation engine for Mozambique (MZ).
 *
 * Applies INSS (social security) and IRT (income tax) according to the official
 * tables defined in {@link ./utils/irtTables}. The engine is intentionally
 * stateless so it can be unit-tested in isolation and reused by both the
 * commercial HR module and module-specific payrolls (pharmacy, hospitality, …).
 */
export class PayrollEngine {
    /**
     * Computes a payroll result from raw inputs.
     *
     * Calculation order (mandated by MZ tax law):
     *  1. **Gross salary** = base + overtime + bonus + taxable allowances + non-taxable allowances
     *  2. **Taxable income** = base + overtime + bonus + taxable allowances *(excludes non-taxable)*
     *  3. **INSS employee** (`INSS_EMPLOYEE_RATE` of base salary) is deducted **before** IRT base
     *  4. **INSS employer** (`INSS_EMPLOYER_RATE` of base salary) is computed but **not** deducted from net
     *  5. **IRT** is computed on `taxableIncome − inssEmployee` using the progressive brackets in
     *     `IRT_BRACKETS_2024` (see {@link ../utils/irtTables})
     *  6. **Net salary** = gross − (inssEmployee + irt + manualDeductions)
     *
     * All values are rounded to 2 decimal places via {@link roundMoney}.
     *
     * @param input — Raw payroll components (see {@link PayrollInput})
     * @returns Full breakdown with gross, taxable income, INSS (both sides), IRT,
     *          deductions and net salary, plus the IRT bracket rate that applied.
     *
     * @example
     * const result = payrollEngine.calculate({
     *   baseSalary: 50000,
     *   allowances: [{ name: 'transport', amount: 3000, taxable: false }],
     *   bonus: 5000,
     * });
     * // result.netSalary holds the take-home amount.
     */
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
