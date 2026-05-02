import { z } from 'zod';

export const restaurantOrderItemSchema = z.object({
    menuItemId: z.string().uuid('ID de item de menu inválido'),
    quantity: z.number().int().positive('Quantidade deve ser positiva'),
    unitPrice: z.number().nonnegative(),
    notes: z.string().optional()
});

export const createRestaurantOrderSchema = z.object({
    tableId: z.string().uuid().optional().nullable(),
    notes: z.string().optional(),
    items: z.array(restaurantOrderItemSchema).min(1, 'O pedido deve ter pelo menos um item'),
    // Note: sessionId is not strictly mandatory for kitchen orders if they are not paid yet, 
    // but the service might require it if we want to track shift performance.
    // For now, let's keep it optional in validation but recalculated in service.
    sessionId: z.string().uuid().optional()
});

export const createRestaurantReservationSchema = z.object({
    guestName: z.string().min(1, 'Nome do cliente é obrigatório'),
    guestPhone: z.string().min(1, 'Telefone do cliente é obrigatório'),
    guestEmail: z.string().email().optional().nullable(),
    partySize: z.number().int().positive().default(2),
    tableId: z.string().uuid().optional().nullable(),
    scheduledAt: z.string(),
    notes: z.string().optional()
});
