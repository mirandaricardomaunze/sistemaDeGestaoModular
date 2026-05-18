import { create } from 'xmlbuilder2';

/**
 * Escapa caracteres especiais XML para evitar injecção ou ficheiro inválido.
 * Regra: Todos os valores de texto DEVEM passar por esta função.
 */
export function escapeXml(value: string | null | undefined): string {
    if (!value) return '';
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Formata um número monetário para 2 casas decimais (formato SAF-T).
 * Usa sempre '.' como separador decimal.
 */
export function formatDecimal(value: number): string {
    return value.toFixed(2);
}

/**
 * Formata uma data para o formato SAF-T: YYYY-MM-DD
 */
export function formatSAFTDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().split('T')[0];
}

/**
 * Cria o documento XML raiz com o namespace SAF-T padrão MZ.
 */
export function createSAFTDocument() {
    return create({ version: '1.0', encoding: 'UTF-8' })
        .ele('AuditFile', {
            xmlns: 'urn:OECD:StandardAuditFile-Tax:MZ_1.00',
            'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        });
}
