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
export const sanitizeObject = <T extends Record<string, any>>(obj: T): T => {
    if (!obj || typeof obj !== 'object') return obj;

    const result = { ...obj };

    for (const key in result) {
        if (typeof result[key] === 'string') {
            (result as any)[key] = sanitizeString(result[key]);
        } else if (typeof result[key] === 'object' && result[key] !== null && !Array.isArray(result[key])) {
            result[key] = sanitizeObject(result[key]);
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
