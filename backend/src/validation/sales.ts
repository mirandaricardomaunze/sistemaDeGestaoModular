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
    reservationIds?: string[];
    discountReason?: string;
    discountKind?: 'percent' | 'amount';
    discountAppliedBy?: string;
}

export interface DiscountAuditEntry {
    kind: 'percent' | 'amount';
    value: number;
    amount: number;
    reason: string;
    appliedBy: string;
}

export interface DiscountAudit {
    global?: DiscountAuditEntry | null;
    lines?: Array<DiscountAuditEntry & { productId: string; productName?: string; pct?: number }>;
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
    paymentRef?: string;
    notes?: string;
    redeemPoints?: number;
    sessionId?: string;
    originModule?: 'pharmacy' | 'logistics' | 'bottlestore' | 'restaurant' | 'commercial' | 'hospitality';
    tableId?: string;
    warehouseId?: string;
    discountReason?: string;
    discountKind?: 'percent' | 'amount';
    discountAudit?: DiscountAudit;
    discountApprovalId?: string;
}

// ============================================================================
// Zod Validation Schemas
// ============================================================================

export const saleItemSchema = z.object({
    productId: z.string().uuid('ID do produto inválido'),
    quantity: z.number().positive('Quantidade deve ser maior que zero'),
    unitPrice: z.number().positive('Preço unitário deve ser maior que zero'),
    discount: z.number().min(0, 'Desconto não pode ser negativo').optional().default(0),
    total: z.number().positive('Total deve ser maior que zero'),
    reservationIds: z.array(z.string().uuid('ID de reserva invalido')).optional(),
    discountReason: z.string().max(200, 'Motivo do desconto demasiado longo').optional(),
    discountKind: z.enum(['percent', 'amount']).optional(),
    discountAppliedBy: z.string().max(150).optional()
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
    redeemPoints: z.number().int().min(0, 'Pontos não podem ser negativos').optional().default(0),
    paymentRef: z.string().max(1000).optional(),
    sessionId: z.string().uuid('ID de sessão inválido').optional(),
    originModule: z.enum(['pharmacy', 'logistics', 'bottlestore', 'restaurant', 'commercial', 'hospitality']).optional().default('commercial'),
    tableId: z.string().uuid('ID da mesa inválido').optional(),
    warehouseId: z.string().uuid('ID do armazém inválido').optional(),
    discountReason: z.string().max(200, 'Motivo do desconto demasiado longo').optional(),
    discountKind: z.enum(['percent', 'amount']).optional(),
    discountAudit: z.object({
        global: z.object({
            kind: z.enum(['percent', 'amount']),
            value: z.number().min(0),
            amount: z.number().min(0),
            reason: z.string().min(1).max(200),
            appliedBy: z.string().max(150)
        }).nullable().optional(),
        lines: z.array(z.object({
            productId: z.string().uuid(),
            productName: z.string().max(200).optional(),
            kind: z.enum(['percent', 'amount']),
            value: z.number().min(0),
            amount: z.number().min(0).optional(),
            pct: z.number().min(0).max(100).optional(),
            reason: z.string().min(1).max(200),
            appliedBy: z.string().max(150)
        })).optional()
    }).optional()

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
// Sales query parameters
// ============================================================================

export const salesQuerySchema = z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    customerId: z.string().uuid('ID do cliente inválido').optional(),
    paymentMethod: z.enum(['cash', 'card', 'pix', 'transfer', 'credit', 'mpesa', 'emola']).optional(),
    search: z.string().trim().min(1).max(100).optional(),
    originModule: z.string().trim().max(50).optional(),
    page: z.string().regex(/^\d+$/, 'Página deve ser um número').optional().default('1'),
    limit: z.string().regex(/^\d+$/, 'Limite deve ser um número').optional().default('20'),
    sortBy: z.enum(['createdAt', 'total', 'receiptNumber']).optional().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
    warehouseId: z.string().uuid('ID do armazém inválido').optional()
}).refine(
    (data) => {
        const limit = parseInt(data.limit);
        return limit > 0 && limit <= 2000;
    },
    { message: 'Limite deve estar entre 1 e 2000' }
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
    return createSaleSchema.parse(data) as CreateSaleInput;
}

export function validateSalesQuery(data: unknown) {
    return salesQuerySchema.parse(data);
}
