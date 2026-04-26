/**
 * Validation Schemas - Cash Sessions
 * 
 * Schemas for POS cash session operations: open, close, and cash movements.
 */

import { z } from 'zod';

// ============================================================================
// Cash Session Schemas
// ============================================================================

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
        .max(500, 'Motivo muito longo')
});

// ============================================================================
// Type Exports
// ============================================================================

export type OpenSessionInput = z.infer<typeof openSessionSchema>;
export type CloseSessionInput = z.infer<typeof closeSessionSchema>;
export type CashMovementInput = z.infer<typeof cashMovementSchema>;
