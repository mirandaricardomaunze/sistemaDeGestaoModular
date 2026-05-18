/**
 * Validation Schemas - Cash Sessions
 * 
 * Schemas for POS cash session operations: open, close, and cash movements.
 */

import { z } from 'zod';

// ============================================================================
// Cash Session Schemas
// ============================================================================

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const isValidDateOnly = (value: string): boolean => {
    const match = DATE_ONLY_RE.exec(value);
    if (!match) return false;

    const [, year, month, day] = match.map(Number);
    const date = new Date(year, month - 1, day);

    return (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
    );
};

const dateQueryParamSchema = z.string()
    .trim()
    .refine((value) => (
        DATE_ONLY_RE.test(value)
            ? isValidDateOnly(value)
            : !Number.isNaN(Date.parse(value))
    ), {
        message: 'Data inválida'
    });

export const openSessionSchema = z.object({
    openingBalance: z.number().min(0, 'Saldo de abertura não pode ser negativo'),
    warehouseId: z.string().uuid('ID do armazém inválido').optional().nullable(),
    terminalId: z.string().max(50, 'ID do terminal muito longo').optional().nullable()
});

export const closeSessionSchema = z.object({
    closingBalance: z.number().min(0, 'Saldo de fecho não pode ser negativo'),
    notes: z.string().max(500, 'Notas muito longas').optional()
});

export const cashMovementSchema = z.object({
    type: z.enum(['sangria', 'suprimento'], {
        message: 'Tipo de movimento deve ser "sangria" ou "suprimento"'
    }),
    amount: z.number().positive('Valor deve ser maior que zero'),
    reason: z.string()
        .min(1, 'Motivo é obrigatório')
        .max(500, 'Motivo muito longo'),
    approvalId: z.string().uuid().optional()
});

export const cashSessionHistoryQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    startDate: dateQueryParamSchema.optional(),
    endDate: dateQueryParamSchema.optional(),
    openedById: z.string().min(1).optional(),
    warehouseId: z.string().min(1).optional(),
    search: z.string().min(1).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type OpenSessionInput = z.infer<typeof openSessionSchema>;
export type CloseSessionInput = z.infer<typeof closeSessionSchema>;
export type CashMovementInput = z.infer<typeof cashMovementSchema>;
export type CashSessionHistoryQuery = z.infer<typeof cashSessionHistoryQuerySchema>;
