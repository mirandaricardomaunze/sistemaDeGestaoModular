/**
 * Money helpers — operate in centavos (integers) to avoid float drift.
 * MZN has 2 decimals, so 1 MTn = 100 centavos.
 *
 * Use toCents() at the boundary (user input / API), do all arithmetic in
 * centavos, and call toMoney() only when emitting to UI or backend.
 */

const SCALE = 100;

export const toCents = (value: number | string | null | undefined): number => {
    const n = typeof value === 'string' ? Number(value) : (value ?? 0);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * SCALE);
};

export const toMoney = (cents: number): number => {
    return Math.round(cents) / SCALE;
};

export const addMoney = (a: number, b: number): number => toCents(a) + toCents(b);

export const subMoney = (a: number, b: number): number => toCents(a) - toCents(b);

/** Multiply money (in any unit) by a non-money quantity. Returns centavos. */
export const mulMoney = (money: number, qty: number): number => {
    return Math.round(toCents(money) * (Number.isFinite(qty) ? qty : 0));
};

/** Apply a percentage (0-100). Returns centavos. */
export const applyPercent = (cents: number, pct: number | string | null | undefined): number => {
    const numericPct = typeof pct === 'string' ? Number(pct) : (pct ?? 0);
    const safePct = Number.isFinite(numericPct) ? numericPct : 0;
    return Math.round(cents * (safePct / 100));
};

/** Sum a list of money values (each in normal units). Returns money (not cents). */
export const sumMoney = (values: number[]): number =>
    toMoney(values.reduce((acc, v) => acc + toCents(v), 0));

/** Clamp a money value to [min, max]. Operates in cents internally. */
export const clampMoney = (value: number, min: number, max: number): number => {
    const c = toCents(value);
    const lo = toCents(min);
    const hi = toCents(max);
    return toMoney(Math.min(Math.max(c, lo), hi));
};
