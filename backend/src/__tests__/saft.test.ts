import { escapeXml, formatDecimal, formatSAFTDate } from '../utils/xmlBuilder';
import { SAFTParamsSchema } from '../validation/saft.validation';

// ── xmlBuilder helpers ────────────────────────────────────────────────────────

describe('escapeXml', () => {
    it('deve escapar & para &amp;', () => {
        expect(escapeXml('A & B')).toBe('A &amp; B');
    });

    it('deve escapar < e > para entidades XML', () => {
        expect(escapeXml('Empresa <Lda>')).toBe('Empresa &lt;Lda&gt;');
    });

    it('deve escapar aspas duplas', () => {
        expect(escapeXml('Nome "Teste"')).toBe('Nome &quot;Teste&quot;');
    });

    it('deve retornar string vazia para null/undefined', () => {
        expect(escapeXml(null)).toBe('');
        expect(escapeXml(undefined)).toBe('');
    });

    it('deve preservar texto normal sem modificações', () => {
        expect(escapeXml('Multicore ERP')).toBe('Multicore ERP');
    });
});

describe('formatDecimal', () => {
    it('deve formatar para 2 casas decimais', () => {
        expect(formatDecimal(1234.5)).toBe('1234.50');
        expect(formatDecimal(0)).toBe('0.00');
        expect(formatDecimal(9999.999)).toBe('10000.00');
    });

    it('deve usar ponto como separador decimal (formato SAF-T)', () => {
        expect(formatDecimal(1.5)).toContain('.');
        expect(formatDecimal(1.5)).not.toContain(',');
    });
});

describe('formatSAFTDate', () => {
    it('deve formatar Date para YYYY-MM-DD', () => {
        const date = new Date('2024-06-15T10:30:00Z');
        expect(formatSAFTDate(date)).toBe('2024-06-15');
    });

    it('deve aceitar string ISO e retornar YYYY-MM-DD', () => {
        expect(formatSAFTDate('2024-01-01T00:00:00.000Z')).toBe('2024-01-01');
    });
});

// ── Zod Validation ─────────────────────────────────────────────────────────────

describe('SAFTParamsSchema', () => {
    const valid = { startDate: '2024-01-01', endDate: '2024-12-31', fiscalYear: '2024' };

    it('deve aceitar parâmetros válidos', () => {
        const result = SAFTParamsSchema.safeParse(valid);
        expect(result.success).toBe(true);
    });

    it('deve rejeitar data no formato errado (DD/MM/YYYY)', () => {
        const result = SAFTParamsSchema.safeParse({ ...valid, startDate: '01/01/2024' });
        expect(result.success).toBe(false);
    });

    it('deve rejeitar mês inválido (13)', () => {
        const result = SAFTParamsSchema.safeParse({ ...valid, startDate: '2024-13-01' });
        expect(result.success).toBe(false);
    });

    it('deve rejeitar se startDate > endDate', () => {
        const result = SAFTParamsSchema.safeParse({
            ...valid,
            startDate: '2024-12-31',
            endDate: '2024-01-01',
        });
        expect(result.success).toBe(false);
    });

    it('deve rejeitar ano fiscal com menos de 4 dígitos', () => {
        const result = SAFTParamsSchema.safeParse({ ...valid, fiscalYear: '24' });
        expect(result.success).toBe(false);
    });

    it('deve aceitar datas iguais (mesmo dia)', () => {
        const result = SAFTParamsSchema.safeParse({
            startDate: '2024-06-01',
            endDate: '2024-06-01',
            fiscalYear: '2024',
        });
        expect(result.success).toBe(true);
    });
});
