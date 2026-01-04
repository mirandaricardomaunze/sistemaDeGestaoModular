/**
 * Validation Schemas - Products
 * 
 * Schemas for product CRUD and stock operations.
 */

import { z } from 'zod';

// ============================================================================
// Product Schemas
// ============================================================================

export const createProductSchema = z.object({
    code: z.string().max(50, 'Código muito longo').optional(),
    barcode: z.string().max(100, 'Código de barras muito longo').optional().nullable(),
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200, 'Nome muito longo'),
    description: z.string().max(1000, 'Descrição muito longa').optional().nullable(),
    categoryId: z.string().uuid('ID da categoria inválido').optional().nullable(),
    price: z.number().positive('Preço deve ser maior que zero'),
    costPrice: z.number().min(0, 'Custo não pode ser negativo').optional().default(0),
    currentStock: z.number().int().min(0, 'Stock não pode ser negativo').optional().default(0),
    minStock: z.number().int().min(0, 'Stock mínimo não pode ser negativo').optional().default(0),
    maxStock: z.number().int().min(0, 'Stock máximo não pode ser negativo').optional().nullable(),
    unit: z.string().max(20, 'Unidade muito longa').optional().default('un'),
    location: z.string().max(100, 'Localização muito longa').optional().nullable(),
    warehouseId: z.string().uuid('ID do armazém inválido').optional().nullable(),
    supplierId: z.string().uuid('ID do fornecedor inválido').optional().nullable(),
    expiryDate: z.string().datetime({ message: 'Data de validade inválida' }).optional().nullable(),
    batchNumber: z.string().max(100, 'Número do lote muito longo').optional().nullable(),
    taxRate: z.number().min(0, 'Taxa de imposto não pode ser negativa').max(100, 'Taxa de imposto inválida').optional().default(16),
    isActive: z.boolean().optional().default(true),
    isService: z.boolean().optional().default(false),
    // Pharmacy-specific fields
    requiresPrescription: z.boolean().optional().default(false),
    dosageForm: z.string().max(100, 'Forma de dosagem muito longa').optional().nullable(),
    strength: z.string().max(100, 'Dosagem muito longa').optional().nullable(),
    manufacturer: z.string().max(200, 'Fabricante muito longo').optional().nullable()
});

export const updateProductSchema = createProductSchema.partial();

export const adjustStockSchema = z.object({
    quantity: z.number().int('Quantidade deve ser um número inteiro'),
    operation: z.enum(['add', 'subtract', 'set'], {
        errorMap: () => ({ message: 'Operação deve ser: add, subtract ou set' })
    }),
    warehouseId: z.string().uuid('ID do armazém inválido').optional().nullable(),
    reason: z.string().max(500, 'Motivo muito longo').optional().nullable()
}).refine(
    (data) => {
        if (data.operation === 'subtract' && data.quantity < 0) {
            return false;
        }
        return true;
    },
    { message: 'Quantidade para subtração deve ser positiva' }
);

export const bulkImportProductSchema = z.object({
    products: z.array(createProductSchema.omit({ code: true }))
        .min(1, 'Deve importar pelo menos um produto')
        .max(1000, 'Não pode importar mais de 1000 produtos de uma vez')
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
