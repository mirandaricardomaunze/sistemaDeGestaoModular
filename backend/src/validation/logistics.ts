/**
 * Validation Schemas - Logistics
 *
 * Schemas for delivery (Guia de Transporte) operations, including the
 * warehouse-transfer variant that moves stock between warehouses.
 */

import { z } from 'zod';

// ============================================================================
// Delivery (Guia de Transporte)
// ============================================================================

export const deliveryItemSchema = z.object({
    productId: z.string().uuid('ID do produto inválido').optional().nullable(),
    description: z.string().max(500, 'Descrição muito longa').optional().default(''),
    quantity: z.number().positive('Quantidade deve ser maior que zero'),
    unitPrice: z.number().nonnegative('Preço inválido').optional(),
    weight: z.number().nonnegative('Peso inválido').optional()
});

export const createDeliverySchema = z.object({
    kind: z.enum(['shipment', 'warehouse_transfer']).optional().default('shipment'),
    // Shipment / common fields
    routeId: z.string().uuid().optional().nullable(),
    driverId: z.string().uuid().optional().nullable(),
    vehicleId: z.string().uuid().optional().nullable(),
    customerId: z.string().uuid().optional().nullable(),
    recipientName: z.string().max(200, 'Nome muito longo').optional().default(''),
    recipientPhone: z.string().max(50, 'Telefone muito longo').optional().nullable(),
    deliveryAddress: z.string().max(500, 'Endereço muito longo').optional().default(''),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
    scheduledDate: z.union([z.string(), z.date()]).optional().nullable(),
    shippingCost: z.number().nonnegative().optional(),
    notes: z.string().max(1000, 'Notas muito longas').optional().nullable(),
    items: z.array(deliveryItemSchema).max(200, 'Demasiados itens').optional(),
    // Warehouse-transfer fields
    sourceWarehouseId: z.string().uuid('ID do armazém de origem inválido').optional().nullable(),
    targetWarehouseId: z.string().uuid('ID do armazém de destino inválido').optional().nullable(),
    reason: z.string().max(500, 'Motivo muito longo').optional().nullable()
}).superRefine((data, ctx) => {
    if (data.kind !== 'warehouse_transfer') return;

    if (!data.sourceWarehouseId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sourceWarehouseId'], message: 'Armazém de origem é obrigatório numa transferência' });
    }
    if (!data.targetWarehouseId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targetWarehouseId'], message: 'Armazém de destino é obrigatório numa transferência' });
    }
    if (data.sourceWarehouseId && data.targetWarehouseId && data.sourceWarehouseId === data.targetWarehouseId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targetWarehouseId'], message: 'Armazém de origem deve ser diferente do destino' });
    }
    const productItems = (data.items ?? []).filter((i) => i.productId);
    if (productItems.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items'], message: 'Transferência exige pelo menos um produto com productId' });
    }
});

export const updateDeliveryStatusSchema = z.object({
    status: z.enum(['pending', 'scheduled', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned', 'cancelled']),
    recipientSign: z.string().optional(),
    proofOfDelivery: z.string().optional(),
    failureReason: z.string().max(500, 'Motivo muito longo').optional()
});

export type CreateDeliveryInput = z.infer<typeof createDeliverySchema>;
export type UpdateDeliveryStatusInput = z.infer<typeof updateDeliveryStatusSchema>;
