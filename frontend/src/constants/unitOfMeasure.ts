/**
 * Unit of Measure — Canonical definitions (Frontend copy)
 *
 * IMPORTANT: This file is a conscious duplicate of backend/src/constants/unitOfMeasure.ts
 * per monorepo-structure skill rules (no cross-workspace imports).
 * Keep both files in sync when adding/removing units.
 */

export const UNIT_OF_MEASURE = {
    un: { label: 'Unidade', abbrev: 'un', decimals: 0, isWeighable: false },
    cx: { label: 'Caixa', abbrev: 'cx', decimals: 0, isWeighable: false },
    pc: { label: 'Peça', abbrev: 'pç', decimals: 0, isWeighable: false },
    kg: { label: 'Quilograma', abbrev: 'kg', decimals: 3, isWeighable: true },
    g: { label: 'Grama', abbrev: 'g', decimals: 0, isWeighable: true },
    L: { label: 'Litro', abbrev: 'L', decimals: 3, isWeighable: true },
    mL: { label: 'Mililitro', abbrev: 'mL', decimals: 0, isWeighable: true },
    m: { label: 'Metro', abbrev: 'm', decimals: 2, isWeighable: false },
    m2: { label: 'Metro²', abbrev: 'm²', decimals: 2, isWeighable: false },
} as const;

export type UnitCode = keyof typeof UNIT_OF_MEASURE;

/** All valid unit codes as an array */
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

/** Returns the display abbreviation */
export function unitAbbrev(unit: string): string {
    const def = UNIT_OF_MEASURE[unit as UnitCode];
    return def?.abbrev ?? unit;
}

/**
 * Formats a quantity with the appropriate decimal places for display.
 * E.g. formatQuantity(0.75, 'kg') → '0.750'
 *      formatQuantity(5, 'un') → '5'
 *
 * Defensive: for integer-only units (un/cx/pc/g/mL) we no longer
 * silently `Math.round` a decimal value. Rounding hides the upstream
 * bug — a decimal `quantity` paired with `unit='un'` means
 * `validateQuantityForUnit` either was not called or has a gap. We
 * render the value with up to 3 decimals so the bug is visible, and
 * console.warn so it shows in dev/console telemetry. Valid integers
 * still render as integers — no visual change in the happy path.
 */
export function formatQuantity(quantity: number, unit: string): string {
    const decimals = unitDecimals(unit);
    if (decimals > 0) return quantity.toFixed(decimals);
    if (Number.isInteger(quantity)) return String(quantity);
    // Integer-only unit received a decimal value — surface it instead of rounding.
    if (typeof console !== 'undefined') {
        console.warn(
            `[formatQuantity] non-integer ${quantity} for integer unit '${unit}'. ` +
            `Upstream validation should have rejected this.`,
        );
    }
    return quantity.toFixed(Math.min(3, (String(quantity).split('.')[1] || '').length));
}

/**
 * Formats quantity with unit abbreviation.
 * E.g. formatQuantityWithUnit(0.75, 'kg') → '0.750 kg'
 */
export function formatQuantityWithUnit(quantity: number, unit: string): string {
    return `${formatQuantity(quantity, unit)} ${unitAbbrev(unit)}`;
}

/** Unit options for Select dropdowns */
export const UNIT_OPTIONS = Object.entries(UNIT_OF_MEASURE).map(([code, def]) => ({
    value: code,
    label: `${def.label} (${def.abbrev})`,
}));
