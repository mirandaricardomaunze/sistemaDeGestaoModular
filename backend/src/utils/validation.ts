import { z } from 'zod';

// Sales schemas live in validation/sales.ts; re-exported here for backwards
// compatibility with existing routes/services that import from this path.
export {
    saleItemSchema,
    createSaleSchema,
    salesQuerySchema,
    validateCreateSale,
    validateSalesQuery,
    type SaleItemInput,
    type DiscountAuditEntry,
    type DiscountAudit,
    type CreateSaleInput,
} from '../validation/sales';

// ============================================================================
// Customer Validation Schemas
// ============================================================================

export const createCustomerSchema = z.object({
    code: z.string().max(50, 'Código não pode ter mais de 50 caracteres').optional(),
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200, 'Nome não pode ter mais de 200 caracteres'),
    type: z.enum(['individual', 'company']).optional().default('individual'),
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
    operation: z.enum(['add', 'subtract', 'set'])
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type UpdateCustomerBalanceInput = z.infer<typeof updateCustomerBalanceSchema>;

// ============================================================================
// Validation Helper Functions
// ============================================================================

/**
 * Safely parses and clamps pagination query parameters.
 * - page: minimum 1
 * - limit: minimum 1, maximum MAX_LIMIT (default 500) to prevent DoS attacks
 */
export function parsePaginationParams(query: Record<string, unknown>, maxLimit = 500) {
    const page = Math.max(1, parseInt(query.page as string) || 1);
    const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit as string) || 20));
    return { page, limit };
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

// ============================================================================
// Hospitality Validation Schemas
// ============================================================================

export const createRoomSchema = z.object({
    number: z.string().min(1, 'Número do quarto é obrigatório').max(20, 'Número do quarto não pode ter mais de 20 caracteres'),
    type: z.enum(['single', 'double', 'suite', 'deluxe']).optional().default('single'),
    price: z.union([z.string(), z.number()]).transform((val) => typeof val === 'string' ? parseFloat(val) : val).refine((val) => !isNaN(val) && val > 0, 'Preço deve ser maior que zero'),
    priceNoMeal: z.union([z.string(), z.number(), z.null()]).optional().transform((val) => val === null || val === '' || val === undefined ? null : typeof val === 'string' ? parseFloat(val) || null : val),
    priceBreakfast: z.union([z.string(), z.number(), z.null()]).optional().transform((val) => val === null || val === '' || val === undefined ? null : typeof val === 'string' ? parseFloat(val) || null : val),
    priceHalfBoard: z.union([z.string(), z.number(), z.null()]).optional().transform((val) => val === null || val === '' || val === undefined ? null : typeof val === 'string' ? parseFloat(val) || null : val),
    priceFullBoard: z.union([z.string(), z.number(), z.null()]).optional().transform((val) => val === null || val === '' || val === undefined ? null : typeof val === 'string' ? parseFloat(val) || null : val),
    notes: z.string().max(500, 'Notas não podem ter mais de 500 caracteres').optional().nullable()
});

export const updateRoomSchema = createRoomSchema.partial();

export const checkInSchema = z.object({
    roomId: z.string().uuid('ID do quarto inválido'),
    customerId: z.string().uuid('ID do cliente inválido').optional().nullable(),
    customerName: z.string().min(2, 'Nome do hóspede deve ter pelo menos 2 caracteres').max(200),
    guestCount: z.union([z.string(), z.number()]).transform((val) => typeof val === 'string' ? parseInt(val) || 1 : val).optional().default(1),
    guestDocumentType: z.string().max(20).optional(),
    guestDocumentNumber: z.string().max(50).optional(),
    guestNationality: z.string().max(100).optional(),
    guestPhone: z.string().max(50).optional(),
    checkIn: z.string().datetime({ message: 'Data de check-in inválida' }).optional(),
    checkOut: z.string().datetime({ message: 'Data de check-out inválida' }).optional().nullable(),
    totalPrice: z.union([z.string(), z.number(), z.null()]).optional().transform((val) => val === null || val === '' || val === undefined ? null : typeof val === 'string' ? parseFloat(val) || null : val),
    mealPlan: z.enum(['none', 'breakfast', 'half_board', 'full_board']).optional().default('none'),
    notes: z.string().max(1000).optional().nullable()
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type CheckInInput = z.infer<typeof checkInSchema>;
