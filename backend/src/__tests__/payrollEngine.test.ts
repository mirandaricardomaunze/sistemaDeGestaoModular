import { PayrollEngine } from '../services/payrollEngine.service';
import { calculateINSS, calculateIRT } from '../utils/irtTables';

describe('calculateIRT', () => {
    it('returns zero below the taxable threshold', () => {
        expect(calculateIRT(20000)).toBe(0);
    });

    it('calculates the 10 percent bracket with deduction', () => {
        expect(calculateIRT(25000)).toBe(475);
    });

    it('calculates the 32 percent bracket with deduction', () => {
        expect(calculateIRT(150000)).toBe(31725);
    });
});

describe('calculateINSS', () => {
    it('calculates employee and employer contributions', () => {
        expect(calculateINSS(50000)).toEqual({
            employeeContribution: 1500,
            employerContribution: 2000,
        });
    });
});

describe('PayrollEngine.calculate', () => {
    const engine = new PayrollEngine();

    it('calculates net salary using backend IRT and INSS rules', () => {
        const result = engine.calculate({ baseSalary: 50000 });

        expect(result.inssEmployee).toBe(1500);
        expect(result.irt).toBe(3925);
        expect(result.totalDeductions).toBe(5425);
        expect(result.netSalary).toBe(44575);
    });

    it('keeps non-taxable allowances out of taxable income', () => {
        const result = engine.calculate({
            baseSalary: 50000,
            allowances: [{ name: 'Subsidio de alimentacao', amount: 5000, taxable: false }],
        });

        expect(result.grossSalary).toBe(55000);
        expect(result.breakdown.taxableIncome).toBe(50000);
        expect(result.irt).toBe(3925);
    });

    it('includes overtime and bonus in taxable income', () => {
        const result = engine.calculate({
            baseSalary: 50000,
            overtimeAmount: 5000,
            bonus: 5000,
        });

        expect(result.taxableIncome).toBe(60000);
        expect(result.grossSalary).toBe(60000);
    });

    it('never returns a negative net salary', () => {
        const result = engine.calculate({
            baseSalary: 10000,
            deductions: [{ name: 'Adiantamento', amount: 50000 }],
        });

        expect(result.netSalary).toBe(0);
    });
});
