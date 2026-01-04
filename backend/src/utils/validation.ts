import { z } from 'zod';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface SaleItemInput {
    productId: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    total: number;
}

export interface CreateSaleInput {
    customerId?: string;
    items: SaleItemInput[];
    subtotal: number;
    discount?: number;
    tax?: number;
    total: number;
    paymentMethod?: 'cash' | 'card' | 'pix' | 'transfer' | 'credit' | 'mpesa' | 'emola';
    amountPaid: number;
    change?: number;
    notes?: string;
    redeemPoints?: number;
}

// ============================================================================
// Zod Validation Schemas
// ============================================================================

export const saleItemSchema = z.object({
    productId: z.string().uuid('ID do produto inválido'),
    quantity: z.number().int().positive('Quantidade deve ser maior que zero'),
    unitPrice: z.number().positive('Preço unitário deve ser maior que zero'),
    discount: z.number().min(0, 'Desconto não pode ser negativo').optional().default(0),
    total: z.number().positive('Total deve ser maior que zero')
}).refine(
    (data) => {
        // Validate that total = (unitPrice * quantity) - discount
        const expectedTotal = (data.unitPrice * data.quantity) - (data.discount || 0);
        return Math.abs(data.total - expectedTotal) < 0.01; // Allow for rounding errors
    },
    { message: 'Total do item não corresponde ao cálculo (preço × quantidade - desconto)' }
);

export const createSaleSchema = z.object({
    customerId: z.string().uuid('ID do cliente inválido').optional(),
    items: z.array(saleItemSchema)
        .min(1, 'Venda deve ter pelo menos um item')
        .max(100, 'Venda não pode ter mais de 100 itens'),
    subtotal: z.number().positive('Subtotal deve ser maior que zero'),
    discount: z.number().min(0, 'Desconto não pode ser negativo').optional().default(0),
    tax: z.number().min(0, 'Imposto não pode ser negativo').optional().default(0),
    total: z.number().positive('Total deve ser maior que zero'),
    paymentMethod: z.enum(['cash', 'card', 'pix', 'transfer', 'credit', 'mpesa', 'emola']).optional().default('cash'),
    amountPaid: z.number().min(0, 'Valor pago não pode ser negativo'),
    change: z.number().min(0, 'Troco não pode ser negativo').optional().default(0),
    notes: z.string().max(500, 'Notas não podem ter mais de 500 caracteres').optional(),
    redeemPoints: z.number().int().min(0, 'Pontos não podem ser negativos').optional().default(0)

}).refine(
    (data) => {
        // Validate that subtotal matches sum of items
        const itemsTotal = data.items.reduce((sum, item) => sum + item.total, 0);
        return Math.abs(data.subtotal - itemsTotal) < 0.01;
    },
    { message: 'Subtotal não corresponde à soma dos itens' }
).refine(
    (data) => {
        // Validate that total = subtotal - discount + tax
        const expectedTotal = data.subtotal - (data.discount || 0) + (data.tax || 0);
        return Math.abs(data.total - expectedTotal) < 0.01;
    },
    { message: 'Total não corresponde ao cálculo (subtotal - desconto + imposto)' }
).refine(
    (data) => {
        // Validate that change = amountPaid - total
        const expectedChange = data.amountPaid - data.total;
        if (expectedChange < 0) {
            return data.change === 0; // If underpaid, change should be 0
        }
        return Math.abs((data.change || 0) - expectedChange) < 0.01;
    },
    { message: 'Troco não corresponde ao cálculo (valor pago - total)' }
);

// ============================================================================
// Query Parameter Validation
// ============================================================================

export const salesQuerySchema = z.object({
    startDate: z.string().datetime({ message: 'Data inicial inválida' }).optional(),
    endDate: z.string().datetime({ message: 'Data final inválida' }).optional(),
    customerId: z.string().uuid('ID do cliente inválido').optional(),
    paymentMethod: z.enum(['cash', 'card', 'pix', 'transfer', 'credit', 'mpesa', 'emola']).optional(),
    page: z.string().regex(/^\d+$/, 'Página deve ser um número').optional().default('1'),
    limit: z.string().regex(/^\d+$/, 'Limite deve ser um número').optional().default('20'),
    sortBy: z.enum(['createdAt', 'total', 'receiptNumber']).optional().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
}).refine(
    (data) => {
        const limit = parseInt(data.limit);
        return limit > 0 && limit <= 100;
    },
    { message: 'Limite deve estar entre 1 e 100' }
).refine(
    (data) => {
        const page = parseInt(data.page);
        return page > 0;
    },
    { message: 'Página deve ser maior que zero' }
);

// ============================================================================
// Validation Helper Functions
// ============================================================================

export function validateCreateSale(data: unknown): CreateSaleInput {
    return createSaleSchema.parse(data);
}

export function validateSalesQuery(data: unknown) {
    return salesQuerySchema.parse(data);
}

// ============================================================================
// Error Response Helper
// ============================================================================

export interface ValidationError {
    field: string;
    message: string;
}

export function formatZodError(error: z.ZodError): ValidationError[] {
    return error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message
    }));
}
