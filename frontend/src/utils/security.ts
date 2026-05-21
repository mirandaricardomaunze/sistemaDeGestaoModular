/**
 * Security Utilities
 * Helpers for data sanitization and security checks
 */

/**
 * Sanitizes a string for safe display or storage by escaping HTML characters
 * @param str The string to sanitize
 * @returns Sanitized string
 */
export const sanitizeString = (str: string): string => {
    if (!str || typeof str !== 'string') return str;

    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

/**
 * Sanitizes an object by recursively sanitizing all string properties
 * @param obj The object to sanitize
 * @returns Sanitized object
 */
export const sanitizeObject = <T extends Record<string, unknown>>(obj: T): T => {
    if (!obj || typeof obj !== 'object') return obj;

    const result = { ...obj };

    for (const key in result) {
        const value = result[key];
        if (typeof value === 'string') {
            (result as Record<string, unknown>)[key] = sanitizeString(value);
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            (result as Record<string, unknown>)[key] = sanitizeObject(value as Record<string, unknown>);
        }
    }

    return result;
};

/**
 * Validates if a string is a potentially dangerous pattern (e.g. script tags)
 * @param str The string to check
 * @returns boolean true if dangerous
 */
export const isDangerous = (str: string): boolean => {
    if (!str) return false;
    const dangerousPatterns = [
        /<script\b[^>]*>([\s\S]*?)<\/script>/gim,
        /on\w+\s*=/gim,
        /javascript:/gim,
        /vbscript:/gim,
    ];

    return dangerousPatterns.some(pattern => pattern.test(str));
};
