import { z } from 'zod';

export const commercialPeriodQuerySchema = z.object({
    period: z.coerce.number().int().default(30).transform((value) => Math.min(365, Math.max(1, value))),
    userId: z.string().min(1).optional(),
    warehouseId: z.string().min(1).optional(),
});

export const commercialWarehouseQuerySchema = z.object({
    warehouseId: z.string().min(1).optional(),
});

export const predictiveSuggestionsSchema = z.object({
    suggestions: z.array(z.object({
        productId: z.string().min(1),
        quantity: z.coerce.number().int().min(1),
    })).min(1),
});

export const commercialListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    status: z.string().min(1).optional(),
    supplierId: z.string().min(1).optional(),
    customerId: z.string().min(1).optional(),
    search: z.string().min(1).optional(),
});

export const accountsReceivableQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    status: z.enum(['all', 'overdue', 'pending']).optional(),
    search: z.string().min(1).optional(),
});

export const createCommercialQuotationSchema = z.object({
    customerId: z.string().min(1).optional(),
    customerName: z.string().min(1),
    customerPhone: z.string().optional().nullable(),
    customerEmail: z.string().email().optional().nullable(),
    validUntil: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    items: z.array(z.object({
        productId: z.string().min(1).optional().nullable(),
        productName: z.string().min(1),
        quantity: z.coerce.number().int().min(1),
        price: z.coerce.number().min(0),
    })).min(1),
});

export const convertQuotationToInvoiceSchema = z.object({
    dueDays: z.coerce.number().int().min(1).optional(),
    taxRate: z.coerce.number().min(0).optional(),
});

export const purchaseOrderStatusSchema = z.object({
    status: z.enum(['draft', 'ordered', 'partial', 'received', 'cancelled']),
    warehouseId: z.string().min(1).optional(),
    approvalId: z.string().min(1).optional(),
});

export const partialDeliverySchema = z.object({
    warehouseId: z.string().min(1).optional(),
    deliveries: z.array(z.object({
        itemId: z.string().min(1),
        receivedQty: z.coerce.number().int().min(1),
    })).min(1),
});

export const reserveItemSchema = z.object({
    productId: z.string().min(1),
    quantity: z.coerce.number().int().min(1),
    sessionId: z.string().min(1).optional(),
    warehouseId: z.string().min(1).optional(),
});

export const salesTargetQuerySchema = z.object({
    employeeId: z.string().min(1).optional(),
});

export type CommercialListQuery = z.infer<typeof commercialListQuerySchema>;
export type PurchaseOrderStatusInput = z.infer<typeof purchaseOrderStatusSchema>;
export type PartialDeliveryInput = z.infer<typeof partialDeliverySchema>;
