import { round2, calcMargin, daysAgo, monthStart, monthEnd, UNCATEGORISED } from '../../services/commercial/shared';

describe('round2()', () => {
    it('rounds to 2 decimal places', () => {
        expect(round2(1.005)).toBe(1.01);
        expect(round2(1.004)).toBe(1);
        expect(round2(3.14159)).toBe(3.14);
    });

    it('handles whole numbers', () => {
        expect(round2(5)).toBe(5);
        expect(round2(0)).toBe(0);
    });

    it('handles negative numbers', () => {
        expect(round2(-1.005)).toBe(-1);
        expect(round2(-3.145)).toBe(-3.14);
    });

    it('handles large numbers', () => {
        expect(round2(1234567.891)).toBe(1234567.89);
    });
});

describe('calcMargin()', () => {
    it('calculates margin percentage correctly', () => {
        // revenue=100, cost=60 → margin = (40/100)*100 = 40%
        expect(calcMargin(100, 60)).toBe(40);
    });

    it('returns 0 when revenue is 0', () => {
        expect(calcMargin(0, 50)).toBe(0);
    });

    it('returns 100 when cogs is 0', () => {
        expect(calcMargin(100, 0)).toBe(100);
    });

    it('returns negative margin when cogs > revenue', () => {
        // revenue=50, cost=100 → (50-100)/50 * 100 = -100%
        expect(calcMargin(50, 100)).toBe(-100);
    });

    it('rounds margin to 2 decimal places', () => {
        // revenue=3, cost=1 → (2/3)*100 = 66.67%
        expect(calcMargin(3, 1)).toBe(66.67);
    });
});

describe('daysAgo()', () => {
    it('returns a date in the past', () => {
        const result = daysAgo(7);
        const now = new Date();
        expect(result.getTime()).toBeLessThan(now.getTime());
    });

    it('is approximately n days ago', () => {
        const result = daysAgo(30);
        const expected = new Date();
        expected.setDate(expected.getDate() - 30);
        expect(Math.abs(result.getTime() - expected.getTime())).toBeLessThan(1000);
    });

    it('daysAgo(0) is approximately now', () => {
        const result = daysAgo(0);
        const now = new Date();
        expect(Math.abs(result.getTime() - now.getTime())).toBeLessThan(1000);
    });
});

describe('monthStart()', () => {
    it('returns first day of current month at midnight', () => {
        const result = monthStart();
        expect(result.getDate()).toBe(1);
        expect(result.getHours()).toBe(0);
        expect(result.getMinutes()).toBe(0);
    });

    it('offset=1 returns next month', () => {
        const current = new Date();
        const result = monthStart(1);
        const expectedMonth = (current.getMonth() + 1) % 12;
        expect(result.getMonth()).toBe(expectedMonth);
        expect(result.getDate()).toBe(1);
    });

    it('offset=-1 returns previous month', () => {
        const current = new Date();
        const result = monthStart(-1);
        const expectedMonth = (current.getMonth() - 1 + 12) % 12;
        expect(result.getMonth()).toBe(expectedMonth);
    });
});

describe('monthEnd()', () => {
    it('returns last day of current month', () => {
        const result = monthEnd();
        const nextDay = new Date(result);
        nextDay.setDate(nextDay.getDate() + 1);
        expect(nextDay.getDate()).toBe(1);
    });

    it('offset=1 returns last day of next month', () => {
        const result = monthEnd(1);
        const nextDay = new Date(result);
        nextDay.setDate(nextDay.getDate() + 1);
        expect(nextDay.getDate()).toBe(1);
    });
});

describe('UNCATEGORISED constant', () => {
    it('has correct value', () => {
        expect(UNCATEGORISED).toBe('Sem Categoria');
    });
});
