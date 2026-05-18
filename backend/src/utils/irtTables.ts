export interface IRTBracket {
    min: number;
    max: number;
    rate: number;
    deduction: number;
}

export const IRT_BRACKETS_2024: IRTBracket[] = [
    { min: 0, max: 20250, rate: 0, deduction: 0 },
    { min: 20250, max: 30001, rate: 0.10, deduction: 2025 },
    { min: 30001, max: 45001, rate: 0.15, deduction: 3525 },
    { min: 45001, max: 70001, rate: 0.20, deduction: 5775 },
    { min: 70001, max: 100001, rate: 0.25, deduction: 9275 },
    { min: 100001, max: Infinity, rate: 0.32, deduction: 16275 }
];

export const INSS_EMPLOYEE_RATE = 0.03;
export const INSS_EMPLOYER_RATE = 0.04;

export function calculateIRT(grossSalary: number): number {
    const bracket = IRT_BRACKETS_2024.find((item) => grossSalary >= item.min && grossSalary < item.max);
    if (!bracket || bracket.rate === 0) return 0;
    return roundMoney(Math.max(0, grossSalary * bracket.rate - bracket.deduction));
}

export function calculateINSS(baseSalary: number) {
    return {
        employeeContribution: roundMoney(baseSalary * INSS_EMPLOYEE_RATE),
        employerContribution: roundMoney(baseSalary * INSS_EMPLOYER_RATE)
    };
}

export function getIRTBracketRate(grossSalary: number): number {
    return IRT_BRACKETS_2024.find((item) => grossSalary >= item.min && grossSalary < item.max)?.rate ?? 0;
}

export function roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
}
