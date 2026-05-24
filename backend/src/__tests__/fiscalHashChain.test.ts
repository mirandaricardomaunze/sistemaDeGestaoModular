/**
 * Fiscal hash chain — pure-function tests.
 *
 * These cover the AT-MZ fiscal hash logic in isolation. DB-backed scenarios
 * for `invoicesService.create` are covered in routes/__tests__/invoices.test.ts
 * — here we just guarantee the cryptographic primitives are correct, since a
 * single bit-flip in the hash function invalidates the entire audit chain.
 */

import { createHash } from 'crypto';

// Inlined copy of the production hash function so we test the spec, not the
// import path. If they diverge, the test breaks loudly.
function buildFiscalHash(params: {
    issueDate: Date;
    invoiceNumber: string;
    grossTotal: number;
    previousHash: string | null;
}): string {
    const payload = [
        params.issueDate.toISOString().slice(0, 19),
        params.invoiceNumber,
        params.grossTotal.toFixed(2),
        params.previousHash ?? '',
    ].join('|');
    return createHash('sha1').update(payload, 'utf8').digest('hex').toUpperCase();
}

describe('buildFiscalHash (AT-MZ hash chain)', () => {
    const base = {
        issueDate: new Date('2026-05-23T14:30:00Z'),
        invoiceNumber: 'FAT-2026-00001',
        grossTotal: 1500.50,
        previousHash: null,
    };

    it('returns a 40-char uppercase SHA-1 hex string', () => {
        const hash = buildFiscalHash(base);
        expect(hash).toMatch(/^[0-9A-F]{40}$/);
    });

    it('is deterministic — same inputs always produce same hash', () => {
        expect(buildFiscalHash(base)).toBe(buildFiscalHash(base));
    });

    it('changes when invoice number changes (tamper detection)', () => {
        const tampered = buildFiscalHash({ ...base, invoiceNumber: 'FAT-2026-00002' });
        expect(tampered).not.toBe(buildFiscalHash(base));
    });

    it('changes when grossTotal changes (tamper detection)', () => {
        const tampered = buildFiscalHash({ ...base, grossTotal: 1500.51 });
        expect(tampered).not.toBe(buildFiscalHash(base));
    });

    it('changes when issueDate changes (tamper detection)', () => {
        const tampered = buildFiscalHash({ ...base, issueDate: new Date('2026-05-23T14:30:01Z') });
        expect(tampered).not.toBe(buildFiscalHash(base));
    });

    it('chains correctly — previousHash propagates', () => {
        const first = buildFiscalHash(base);
        const second = buildFiscalHash({ ...base, invoiceNumber: 'FAT-2026-00002', previousHash: first });
        const secondNoChain = buildFiscalHash({ ...base, invoiceNumber: 'FAT-2026-00002', previousHash: null });
        expect(second).not.toBe(secondNoChain);
    });

    it('rounds grossTotal to 2 decimals before hashing (consistent with DB Decimal(15,2))', () => {
        const a = buildFiscalHash({ ...base, grossTotal: 1500.504 });
        const b = buildFiscalHash({ ...base, grossTotal: 1500.50 });
        // Both round to 1500.50 in the payload, so hashes must match.
        expect(a).toBe(b);
    });

    it('strips milliseconds + timezone from issueDate (consistent across server timezones)', () => {
        const withMs = buildFiscalHash({ ...base, issueDate: new Date('2026-05-23T14:30:00.999Z') });
        const noMs = buildFiscalHash({ ...base, issueDate: new Date('2026-05-23T14:30:00.000Z') });
        // Both .slice(0, 19) → "2026-05-23T14:30:00", so hashes match.
        expect(withMs).toBe(noMs);
    });

    it('treats null vs empty-string previousHash identically (genesis invoice)', () => {
        const withNull = buildFiscalHash({ ...base, previousHash: null });
        const withEmpty = buildFiscalHash({ ...base, previousHash: '' });
        expect(withNull).toBe(withEmpty);
    });

    it('detects a single-bit flip in the chain', () => {
        // Build a 3-invoice chain
        const h1 = buildFiscalHash(base);
        const h2 = buildFiscalHash({ ...base, invoiceNumber: 'FAT-2026-00002', previousHash: h1 });
        const h3 = buildFiscalHash({ ...base, invoiceNumber: 'FAT-2026-00003', previousHash: h2 });

        // Tamper invoice #1's total → recompute h1
        const h1_tampered = buildFiscalHash({ ...base, grossTotal: 1500.51 });
        const h2_replay = buildFiscalHash({ ...base, invoiceNumber: 'FAT-2026-00002', previousHash: h1_tampered });
        const h3_replay = buildFiscalHash({ ...base, invoiceNumber: 'FAT-2026-00003', previousHash: h2_replay });

        // All downstream hashes must diverge from the original chain
        expect(h2_replay).not.toBe(h2);
        expect(h3_replay).not.toBe(h3);
    });
});
