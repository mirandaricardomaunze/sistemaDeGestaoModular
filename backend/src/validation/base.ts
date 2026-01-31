/**
 * Validation Schemas - Base Utilities
 * 
 * Common validation utilities, types, and reusable schema components.
 */

import { z, ZodError } from 'zod';
import { Request, Response, NextFunction } from 'express';

// ============================================================================
// Common Primitive Schemas
// ============================================================================

/** UUID validation */
export const uuidSchema = z.string().uuid('ID inválido');

/** Non-empty string */
export const nonEmptyString = z.string().min(1, 'Campo obrigatório');

/** Optional email */
export const emailSchema = z.string().email('Email inválido').optional().nullable();

/** Phone number (flexible format) */
export const phoneSchema = z.string().max(50, 'Telefone muito longo').optional().nullable();

/** Positive number */
export const positiveNumber = z.number().positive('Valor deve ser maior que zero');

/** Non-negative number */
export const nonNegativeNumber = z.number().min(0, 'Valor não pode ser negativo');

/** Pagination parameters */
export const paginationSchema = z.object({
    page: z.string().regex(/^\d+$/, 'Página inválida').optional().default('1'),
    limit: z.string().regex(/^\d+$/, 'Limite inválido').optional().default('20'),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional().default('asc')
}).refine(
    (data) => {
        const limit = parseInt(data.limit);
        return limit > 0 && limit <= 100;
    },
    { message: 'Limite deve estar entre 1 e 100' }
);

/** Flexible Date validation (accepts ISO and YYYY-MM-DD) */
export const dateSchema = z.string().refine(val => !isNaN(Date.parse(val)), {
    message: 'Data inválida'
});

/** Date range for queries */
export const dateRangeSchema = z.object({
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional()
});

// ============================================================================
// Error Formatting
// ============================================================================

export interface ValidationError {
    field: string;
    message: string;
}

export function formatZodError(error: ZodError): ValidationError[] {
    return error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message
    }));
}

// ============================================================================
// Validation Middleware Factory
// ============================================================================

/**
 * Creates an Express middleware that validates req.body against a Zod schema.
 * On success, attaches validated data to req.validatedBody.
 * On failure, returns 400 with detailed error messages.
 */
export function validateBody<T extends z.ZodType>(schema: T) {
    return (req: Request & { validatedBody?: z.infer<T> }, res: Response, next: NextFunction) => {
        try {
            req.validatedBody = schema.parse(req.body);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                return res.status(400).json({
                    error: 'Dados inválidos',
                    details: formatZodError(error)
                });
            }
            next(error);
        }
    };
}

/**
 * Creates an Express middleware that validates req.query against a Zod schema.
 */
export function validateQuery<T extends z.ZodType>(schema: T) {
    return (req: Request & { validatedQuery?: z.infer<T> }, res: Response, next: NextFunction) => {
        try {
            req.validatedQuery = schema.parse(req.query);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                return res.status(400).json({
                    error: 'Parâmetros inválidos',
                    details: formatZodError(error)
                });
            }
            next(error);
        }
    };
}

/**
 * Creates an Express middleware that validates req.params against a Zod schema.
 */
export function validateParams<T extends z.ZodType>(schema: T) {
    return (req: Request & { validatedParams?: z.infer<T> }, res: Response, next: NextFunction) => {
        try {
            req.validatedParams = schema.parse(req.params);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                return res.status(400).json({
                    error: 'Parâmetros de rota inválidos',
                    details: formatZodError(error)
                });
            }
            next(error);
        }
    };
}

// ============================================================================
// Type Exports
// ============================================================================

export { z, ZodError };
