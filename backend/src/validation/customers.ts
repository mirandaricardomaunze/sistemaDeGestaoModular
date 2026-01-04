/**
 * Validation Schemas - Customers
 * 
 * Schemas for customer CRUD and balance operations.
 */

import { z } from 'zod';

// ============================================================================
// Customer Schemas
// ============================================================================

export const createCustomerSchema = z.object({
    code: z.string().max(50, 'Código não pode ter mais de 50 caracteres').optional(),
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200, 'Nome não pode ter mais de 200 caracteres'),
    type: z.enum(['individual', 'business']).optional().default('individual'),
    email: z.string().email('Email inválido').optional().nullable(),
    phone: z.string().max(50, 'Telefone não pode ter mais de 50 caracteres').optional().nullable(),
    document: z.string().max(50, 'Documento não pode ter mais de 50 caracteres').optional().nullable(),
    address: z.string().max(500, 'Endereço não pode ter mais de 500 caracteres').optional().nullable(),
    city: z.string().max(100, 'Cidade não pode ter mais de 100 caracteres').optional().nullable(),
    province: z.string().max(100, 'Província não pode ter mais de 100 caracteres').optional().nullable(),
    notes: z.string().max(1000, 'Notas não podem ter mais de 1000 caracteres').optional().nullable(),
    creditLimit: z.number().min(0, 'Limite de crédito não pode ser negativo').optional().nullable(),
    isActive: z.boolean().optional().default(true)
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const updateCustomerBalanceSchema = z.object({
    amount: z.number().positive('Valor deve ser maior que zero'),
    operation: z.enum(['add', 'subtract', 'set'], {
        errorMap: () => ({ message: 'Operação deve ser: add, subtract ou set' })
    })
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type UpdateCustomerBalanceInput = z.infer<typeof updateCustomerBalanceSchema>;
