export const UNCATEGORISED = 'Sem Categoria';

export function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

export function calcMargin(revenue: number, cogs: number): number {
    return revenue > 0 ? round2(((revenue - cogs) / revenue) * 100) : 0;
}

export function daysAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}

export function monthStart(offset = 0): Date {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth() + offset, 1);
}

export function monthEnd(offset = 0): Date {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth() + offset + 1, 0);
}
