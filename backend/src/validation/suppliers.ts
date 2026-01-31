/**
 * Validation Schemas - Suppliers
 * 
 * Schemas for supplier CRUD and purchase order operations.
 */

import { z } from 'zod';

// ============================================================================
// Supplier Schemas
// ============================================================================

export const createSupplierSchema = z.object({
    code: z.string().max(50, 'Código muito longo').optional(),
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200, 'Nome muito longo'),
    contactPerson: z.string().max(200, 'Nome do contacto muito longo').optional().nullable(),
    email: z.string().email('Email inválido').optional().nullable(),
    phone: z.string().max(50, 'Telefone muito longo').optional().nullable(),
    alternativePhone: z.string().max(50, 'Telefone alternativo muito longo').optional().nullable(),
    address: z.string().max(500, 'Endereço muito longo').optional().nullable(),
    city: z.string().max(100, 'Cidade muito longa').optional().nullable(),
    province: z.string().max(100, 'Província muito longa').optional().nullable(),
    country: z.string().max(100, 'País muito longo').optional().nullable(),
    taxId: z.string().max(50, 'NUIT muito longo').optional().nullable(),
    paymentTerms: z.string().max(200, 'Termos de pagamento muito longos').optional().nullable(),
    notes: z.string().max(1000, 'Notas muito longas').optional().nullable(),
    isActive: z.boolean().optional().default(true)
});

export const updateSupplierSchema = createSupplierSchema.partial();

// ============================================================================
// Purchase Order Schemas
// ============================================================================

export const purchaseOrderItemSchema = z.object({
    productId: z.string().uuid('ID do produto inválido'),
    quantity: z.number().int().positive('Quantidade deve ser maior que zero'),
    unitCost: z.number().positive('Custo unitário deve ser maior que zero').optional()
});

export const createPurchaseOrderSchema = z.object({
    supplierId: z.string().uuid('ID do fornecedor inválido').optional(),
    items: z.array(purchaseOrderItemSchema)
        .min(1, 'Pedido deve ter pelo menos um item')
        .max(100, 'Pedido não pode ter mais de 100 itens'),
    expectedDeliveryDate: z.string().datetime({ message: 'Data de entrega inválida' }).optional().nullable(),
    notes: z.string().max(1000, 'Notas muito longas').optional().nullable()
});

export const receivePurchaseOrderItemSchema = z.object({
    itemId: z.string().uuid('ID do item inválido'),
    receivedQty: z.number().int().min(0, 'Quantidade recebida não pode ser negativa')
});

export const receivePurchaseOrderSchema = z.object({
    items: z.array(receivePurchaseOrderItemSchema)
        .min(1, 'Deve informar pelo menos um item recebido')
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type ReceivePurchaseOrderInput = z.infer<typeof receivePurchaseOrderSchema>;
