/**
 * Validation Schemas - Warehouses
 * 
 * Schemas for warehouse and stock transfer operations.
 */

import { z } from 'zod';

// ============================================================================
// Warehouse Schemas
// ============================================================================

export const createWarehouseSchema = z.object({
    code: z.string().max(50, 'Código muito longo').optional(),
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100, 'Nome muito longo'),
    address: z.string().max(500, 'Endereço muito longo').optional().nullable(),
    city: z.string().max(100, 'Cidade muito longa').optional().nullable(),
    province: z.string().max(100, 'Província muito longa').optional().nullable(),
    phone: z.string().max(50, 'Telefone muito longo').optional().nullable(),
    manager: z.string().max(200, 'Nome do gerente muito longo').optional().nullable(),
    capacity: z.number().int().positive('Capacidade deve ser maior que zero').optional().nullable(),
    notes: z.string().max(500, 'Notas muito longas').optional().nullable(),
    isDefault: z.boolean().optional().default(false),
    isActive: z.boolean().optional().default(true)
});

export const updateWarehouseSchema = createWarehouseSchema.partial();

// ============================================================================
// Stock Transfer Schemas
// ============================================================================

export const transferItemSchema = z.object({
    productId: z.string().uuid('ID do produto inválido'),
    quantity: z.number().int().positive('Quantidade deve ser maior que zero')
});

export const createStockTransferSchema = z.object({
    sourceWarehouseId: z.string().uuid('ID do armazém de origem inválido'),
    targetWarehouseId: z.string().uuid('ID do armazém de destino inválido'),
    items: z.array(transferItemSchema)
        .min(1, 'Transferência deve ter pelo menos um item')
        .max(100, 'Transferência não pode ter mais de 100 itens'),
    responsible: z.string().max(200, 'Nome do responsável muito longo').optional().nullable(),
    reason: z.string().max(500, 'Motivo muito longo').optional().nullable(),
    notes: z.string().max(1000, 'Notas muito longas').optional().nullable()
}).refine(
    (data) => data.sourceWarehouseId !== data.targetWarehouseId,
    { message: 'Armazém de origem deve ser diferente do armazém de destino' }
);

// ============================================================================
// Type Exports
// ============================================================================

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;
export type CreateStockTransferInput = z.infer<typeof createStockTransferSchema>;
