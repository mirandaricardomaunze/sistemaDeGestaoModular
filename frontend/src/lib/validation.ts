import { z } from 'zod';

// ============================================================================
// Base Schemas
// ============================================================================

export const idSchema = z.string().uuid().or(z.string().min(1));

export const paginationSchema = z.object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().default(10),
    search: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
});

// ============================================================================
// Domain Schemas
// ============================================================================

export const productSchema = z.object({
    id: idSchema.optional(),
    code: z.string().min(1, 'Código é obrigatório'),
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
    description: z.string().optional(),
    category: z.string().min(1, 'Categoria é obrigatória'),
    price: z.number().nonnegative('Preço deve ser positivo'),
    costPrice: z.number().nonnegative('Preço de custo deve ser positivo'),
    currentStock: z.number().int().default(0),
    minStock: z.number().int().default(0),
    unit: z.string().default('un'),
    barcode: z.string().optional(),
    sku: z.string().optional(),
    status: z.enum(['in_stock', 'low_stock', 'out_of_stock']).default('in_stock'),
});

export const customerSchema = z.object({
    id: idSchema.optional(),
    code: z.string().min(1).optional(),
    name: z.string().min(2, 'Nome é obrigatório'),
    type: z.enum(['individual', 'company']).default('individual'),
    email: z.string().email('Email inválido').optional().or(z.literal('')),
    phone: z.string().min(9, 'Telefone inválido'),
    document: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    province: z.string().optional(),
    isActive: z.boolean().default(true),
});

export const saleItemSchema = z.object({
    productId: idSchema,
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative(),
    discount: z.number().nonnegative().default(0),
    total: z.number().nonnegative(),
});

export const saleSchema = z.object({
    id: idSchema.optional(),
    items: z.array(saleItemSchema).min(1, 'Pelo menos um item é necessário'),
    subtotal: z.number().nonnegative(),
    discount: z.number().nonnegative().default(0),
    tax: z.number().nonnegative().default(0),
    total: z.number().nonnegative(),
    paymentMethod: z.enum(['cash', 'card', 'transfer', 'mpesa', 'emola']).default('cash'),
    amountPaid: z.number().nonnegative(),
    change: z.number().nonnegative().default(0),
    customerId: idSchema.optional(),
    status: z.enum(['active', 'voided']).default('active'),
    notes: z.string().optional(),
});

export const commercialAnalyticsSchema = z.object({
    revenue: z.number(),
    cogs: z.number(),
    grossProfit: z.number(),
    grossMargin: z.number(),
    marginTrend: z.number(),
    inventoryValue: z.number(),
    inventoryTurnover: z.number(),
    reorderNeeded: z.number(),
    pendingPOs: z.number(),
    overduePOs: z.number(),
    poSpend: z.number(),
    lastMonthMargin: z.number(),
});

export const purchaseOrderSchema = z.object({
    id: idSchema,
    orderNumber: z.string(),
    supplierId: idSchema,
    total: z.number(),
    status: z.enum(['draft', 'ordered', 'partial', 'received', 'cancelled']),
    expectedDeliveryDate: z.string().nullable(),
    receivedDate: z.string().nullable(),
    createdAt: z.string(),
    supplier: z.object({ id: idSchema, name: z.string(), code: z.string() }).optional(),
    items: z.array(z.object({
        productId: idSchema,
        quantity: z.number(),
        receivedQty: z.number(),
        unitCost: z.number(),
        total: z.number(),
    })).optional(),
});

// ============================================================================
// API Response Wrappers
// ============================================================================

export function createResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
    return z.object({
        success: z.boolean(),
        data: dataSchema,
        message: z.string().optional(),
        error: z.string().optional(),
    });
}

export function createPaginatedResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
    return z.object({
        success: z.boolean(),
        data: z.array(dataSchema),
        pagination: z.object({
            total: z.number(),
            page: z.number(),
            limit: z.number(),
            totalPages: z.number(),
        }),
        message: z.string().optional(),
        error: z.string().optional(),
    });
}
