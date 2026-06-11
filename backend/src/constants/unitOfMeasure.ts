/**
 * Unit of Measure — Canonical definitions
 *
 * Central registry of all supported units of measure. Each unit defines:
 * - label:       Human-readable name (Portuguese)
 * - abbrev:      Short display abbreviation
 * - decimals:    Maximum decimal places allowed for quantities
 * - isWeighable: Whether the product is typically weighed/measured (affects POS UX)
 * - saftCode:    SAF-T XML UnitOfMeasure code (AT-MZ spec)
 *
 * Rules:
 *   1. If decimals === 0, quantities MUST be integers (validated in service layer).
 *   2. If decimals > 0, quantities may have up to that many decimal places.
 *   3. This file is duplicated in frontend/src/constants/unitOfMeasure.ts
 *      (monorepo rule: no cross-workspace imports).
 */

export const UNIT_OF_MEASURE = {
    un: { label: 'Unidade', abbrev: 'un', decimals: 0, isWeighable: false, saftCode: 'UN' },
    cx: { label: 'Caixa', abbrev: 'cx', decimals: 0, isWeighable: false, saftCode: 'CX' },
    pc: { label: 'Peça', abbrev: 'pç', decimals: 0, isWeighable: false, saftCode: 'UN' },
    kg: { label: 'Quilograma', abbrev: 'kg', decimals: 3, isWeighable: true, saftCode: 'KG' },
    g: { label: 'Grama', abbrev: 'g', decimals: 0, isWeighable: true, saftCode: 'GR' },
    L: { label: 'Litro', abbrev: 'L', decimals: 3, isWeighable: true, saftCode: 'LT' },
    mL: { label: 'Mililitro', abbrev: 'mL', decimals: 0, isWeighable: true, saftCode: 'ML' },
    m: { label: 'Metro', abbrev: 'm', decimals: 2, isWeighable: false, saftCode: 'MT' },
    m2: { label: 'Metro²', abbrev: 'm²', decimals: 2, isWeighable: false, saftCode: 'M2' },
} as const;

export type UnitCode = keyof typeof UNIT_OF_MEASURE;

/** All valid unit codes as an array (useful for Zod enums) */
export const UNIT_CODES = Object.keys(UNIT_OF_MEASURE) as UnitCode[];

/** Returns whether a unit accepts decimal quantities */
export function isDecimalUnit(unit: string): boolean {
    const def = UNIT_OF_MEASURE[unit as UnitCode];
    return def ? def.decimals > 0 : false;
}

/** Returns the max decimal places for a unit (0 = integer only) */
export function unitDecimals(unit: string): number {
    const def = UNIT_OF_MEASURE[unit as UnitCode];
    return def?.decimals ?? 0;
}

/** Returns the SAF-T UnitOfMeasure code */
export function saftUnitCode(unit: string): string {
    const def = UNIT_OF_MEASURE[unit as UnitCode];
    return def?.saftCode ?? 'UN';
}

/** Returns the display abbreviation */
export function unitAbbrev(unit: string): string {
    const def = UNIT_OF_MEASURE[unit as UnitCode];
    return def?.abbrev ?? unit;
}

/**
 * Validates that a quantity respects the decimal rules for its unit.
 * Returns an error message string, or null if valid.
 */
export function validateQuantityForUnit(quantity: number, unit: string): string | null {
    if (quantity <= 0) {
        return 'Quantidade deve ser maior que zero';
    }

    const maxDecimals = unitDecimals(unit);

    if (maxDecimals === 0) {
        // Integer-only unit
        if (!Number.isInteger(quantity)) {
            const def = UNIT_OF_MEASURE[unit as UnitCode];
            const unitLabel = def?.label ?? unit;
            return `Quantidade deve ser inteira para produtos vendidos em ${unitLabel}`;
        }
    } else {
        // Decimal unit — check max decimal places
        const parts = String(quantity).split('.');
        if (parts[1] && parts[1].length > maxDecimals) {
            return `Quantidade não pode ter mais de ${maxDecimals} casas decimais para esta unidade`;
        }
    }

    return null;
}

/**
 * Formats a quantity with the appropriate number of decimal places for display.
 * E.g. formatQuantity(0.75, 'kg') → '0.750'
 *      formatQuantity(5, 'un') → '5'
 */
export function formatQuantity(quantity: number | string | null | undefined, unit: string): string {
    // Prisma returns Decimal columns as strings/Decimal; coerce so .toFixed is safe.
    const value = typeof quantity === 'number' ? quantity : Number(quantity ?? 0);
    const safe = Number.isFinite(value) ? value : 0;
    const decimals = unitDecimals(unit);
    return decimals > 0 ? safe.toFixed(decimals) : String(Math.round(safe));
}

/**
 * Formats quantity with unit abbreviation for display.
 * E.g. formatQuantityWithUnit(0.75, 'kg') → '0.750 kg'
 *      formatQuantityWithUnit(5, 'un') → '5 un'
 */
export function formatQuantityWithUnit(quantity: number | string | null | undefined, unit: string): string {
    return `${formatQuantity(quantity, unit)} ${unitAbbrev(unit)}`;
}
