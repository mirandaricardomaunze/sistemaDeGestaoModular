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

    it('applies INSS even when income is below the IRT threshold', () => {
        // Base salary entirely under the 20250 MZN IRT exemption — only INSS is deducted.
        const result = engine.calculate({ baseSalary: 18000 });

        expect(result.irt).toBe(0);
        expect(result.inssEmployee).toBe(540); // 3% of 18000
        expect(result.netSalary).toBe(17460);
        expect(result.breakdown.irtBracketRate).toBe(0);
    });

    it('exposes the marginal IRT bracket rate on the breakdown', () => {
        // 60000 base − 1800 INSS = 58200 → falls in the 20% bracket (45001–70000)
        const result = engine.calculate({ baseSalary: 60000 });

        expect(result.breakdown.irtBracketRate).toBe(0.20);
    });

    it('combines manual deductions with statutory ones in totalDeductions', () => {
        const result = engine.calculate({
            baseSalary: 50000,
            deductions: [
                { name: 'Adiantamento', amount: 2000 },
                { name: 'Sindicato', amount: 500 },
            ],
        });

        // statutory (INSS 1500 + IRT 3925) + manual (2000 + 500) = 7925
        expect(result.manualDeductions).toBe(2500);
        expect(result.totalDeductions).toBe(7925);
        expect(result.netSalary).toBe(50000 - 7925);
    });

    it('rounds money to 2 decimal places', () => {
        const result = engine.calculate({ baseSalary: 33333.333 });

        // No fractional cents anywhere — every numeric output is roundMoney'd.
        expect(Number.isInteger(Math.round(result.netSalary * 100))).toBe(true);
        expect(Number.isInteger(Math.round(result.inssEmployee * 100))).toBe(true);
        expect(Number.isInteger(Math.round(result.irt * 100))).toBe(true);
    });
});
