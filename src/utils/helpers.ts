import { format, parseISO, differenceInDays, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ============================================================================
// Formatting Utilities
// ============================================================================

export function formatCurrency(value: number, currency: string = 'MZN'): string {
    return new Intl.NumberFormat('pt-MZ', {
        style: 'currency',
        currency,
    }).format(value);
}

export function formatDate(date: string | Date, formatStr: string = 'dd/MM/yyyy'): string {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, formatStr, { locale: ptBR });
}

export function formatDateTime(date: string | Date): string {
    return formatDate(date, "dd/MM/yyyy 'á s' HH:mm");
}

export function formatTime(date: string | Date): string {
    return formatDate(date, 'HH:mm');
}

export function formatRelativeTime(date: string | Date): string {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'agora';
    if (diffMins < 60) return `há¡ ${diffMins} min`;
    if (diffHours < 24) return `há¡ ${diffHours}h`;
    if (diffDays < 7) return `há¡ ${diffDays} dias`;
    return formatDate(dateObj);
}

// ============================================================================
// Number Utilities
// ============================================================================

export function formatNumber(value: number, decimals: number = 0): string {
    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(value);
}

export function formatPercent(value: number): string {
    return `${formatNumber(value, 1)}%`;
}

export function calculatePercentChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
}

// ============================================================================
// String Utilities
// ============================================================================

export function generateId(): string {
    return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

export function generateReceiptNumber(): string {
    const date = new Date();
    const dateStr = format(date, 'yyyyMMdd');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `REC-${dateStr}-${random}`;
}

export function truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength) + '...';
}

export function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function slugify(str: string): string {
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

// ============================================================================
// Date Utilities
// ============================================================================

export function getDaysUntilExpiry(expiryDate: string): number {
    return differenceInDays(parseISO(expiryDate), new Date());
}

export function isExpired(expiryDate: string): boolean {
    return getDaysUntilExpiry(expiryDate) < 0;
}

export function isExpiringSoon(expiryDate: string, warningDays: number = 30): boolean {
    const days = getDaysUntilExpiry(expiryDate);
    return days >= 0 && days <= warningDays;
}

export function getMonthDays(year: number, month: number): Date[] {
    const start = startOfMonth(new Date(year, month));
    const end = endOfMonth(start);
    return eachDayOfInterval({ start, end });
}

// ============================================================================
// Stock Utilities
// ============================================================================

export function getStockStatus(current: number, min: number): 'in_stock' | 'low_stock' | 'out_of_stock' {
    if (current === 0) return 'out_of_stock';
    if (current <= min) return 'low_stock';
    return 'in_stock';
}

export function getStockPercentage(current: number, max: number): number {
    if (max === 0) return 0;
    return Math.min((current / max) * 100, 100);
}

// ============================================================================
// CSS Class Utilities
// ============================================================================

export function cn(...classes: (string | boolean | undefined | null)[]): string {
    return classes.filter(Boolean).join(' ');
}

// ============================================================================
// Storage Utilities
// ============================================================================

export function getFromStorage<T>(key: string, defaultValue: T): T {
    if (typeof window === 'undefined') return defaultValue;
    try {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch {
        return defaultValue;
    }
}

export function setToStorage<T>(key: string, value: T): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error('Error saving to localStorage:', error);
    }
}

// ============================================================================
// Validation Utilities
// ============================================================================

export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

export function isValidPhone(phone: string): boolean {
    const phoneRegex = /^\(\d{2}\)\s?\d{4,5}-?\d{4}$/;
    return phoneRegex.test(phone);
}

export function isValidCPF(cpf: string): boolean {
    const cleanCPF = cpf.replace(/\D/g, '');
    if (cleanCPF.length !== 11) return false;
    if (/^(\d)\1+$/.test(cleanCPF)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCPF.charAt(9))) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
        sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCPF.charAt(10))) return false;

    return true;
}

// ============================================================================
// Export Utilities
// ============================================================================

export function exportToCSV<T extends Record<string, unknown>>(
    data: T[],
    filename: string,
    headers?: Record<keyof T, string>
): void {
    if (data.length === 0) return;

    const keys = Object.keys(data[0]) as (keyof T)[];
    const headerRow = headers
        ? keys.map((key) => headers[key] || String(key))
        : keys.map(String);

    const rows = data.map((item) =>
        keys.map((key) => {
            const value = item[key];
            if (typeof value === 'string' && value.includes(',')) {
                return `"${value}"`;
            }
            return String(value ?? '');
        })
    );

    const csvContent = [headerRow.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ============================================================================
// Debounce / Throttle
// ============================================================================

export function debounce<T extends (...args: unknown[]) => unknown>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return (...args: Parameters<T>) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

