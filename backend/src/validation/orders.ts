/**
 * Validation Schemas - Orders
 * 
 * Schemas for order management operations.
 */

import { z } from 'zod';

// ============================================================================
// Order Schemas
// ============================================================================

export const orderItemSchema = z.object({
    productId: z.string().uuid('ID do produto inválido'),
    productName: z.string().max(200, 'Nome do produto muito longo').optional(),
    quantity: z.coerce.number().int().positive('Quantidade deve ser maior que zero'),
    unitPrice: z.coerce.number().positive('Preço unitário deve ser maior que zero').optional(),
    price: z.coerce.number().positive('Preço deve ser maior que zero').optional(),
    notes: z.string().max(200, 'Notas muito longas').optional().nullable()
});

export const createOrderSchema = z.object({
    customerId: z.string().uuid('ID do cliente inválido').optional().nullable(),
    customerName: z.string().max(200, 'Nome do cliente muito longo'),
    customerPhone: z.string().max(50, 'Telefone muito longo'),
    customerEmail: z.string().max(200, 'Email muito longo').optional().nullable(),
    customerAddress: z.string().max(500, 'Endereço muito longo').optional().nullable(),
    items: z.array(orderItemSchema)
        .min(1, 'Pedido deve ter pelo menos um item')
        .max(50, 'Pedido não pode ter mais de 50 itens'),
    subtotal: z.coerce.number().min(0, 'Subtotal não pode ser negativo').optional(),
    discount: z.coerce.number().min(0, 'Desconto não pode ser negativo').optional().default(0),
    deliveryFee: z.coerce.number().min(0, 'Taxa de entrega não pode ser negativa').optional().default(0),
    total: z.coerce.number().positive('Total deve ser maior que zero'),
    notes: z.string().max(1000, 'Notas muito longas').optional().nullable(),
    deliveryDate: z.string().optional().nullable(),
    deliveryTime: z.string().max(50, 'Hora de entrega muito longa').optional().nullable(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().default('normal'),
    paymentMethod: z.string().max(50, 'Método de pagamento muito longo').optional().nullable(),
    isPaid: z.boolean().optional().default(false)
});

export const updateOrderStatusSchema = z.object({
    status: z.enum(['created', 'printed', 'separated', 'completed', 'cancelled']),
    responsibleName: z.string().max(200, 'Nome do responsável muito longo').optional().nullable(),
    notes: z.string().max(500, 'Notas muito longas').optional().nullable()
});

export const updateOrderSchema = z.object({
    customerName: z.string().max(200).optional(),
    customerPhone: z.string().max(50).optional(),
    customerEmail: z.string().max(200).optional().nullable(),
    customerAddress: z.string().max(500).optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
    deliveryDate: z.string().optional().nullable(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
    paymentMethod: z.string().max(50).optional().nullable(),
    isPaid: z.boolean().optional(),
});

export const cancelOrderSchema = z.object({
    reason: z.string().min(3, 'Motivo deve ter pelo menos 3 caracteres').max(500, 'Motivo muito longo')
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
