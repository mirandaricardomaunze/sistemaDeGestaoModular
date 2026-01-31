/**
 * Validation Schemas - Settings
 * 
 * Schemas for system settings and configuration operations.
 */

import { z } from 'zod';

// ============================================================================
// Company Settings Schema
// ============================================================================

export const updateCompanySettingsSchema = z.object({
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200, 'Nome muito longo').optional(),
    tradeName: z.string().max(200, 'Nome comercial muito longo').optional().nullable(),
    email: z.string().email('Email inválido').optional().nullable(),
    phone: z.string().max(50, 'Telefone muito longo').optional().nullable(),
    address: z.string().max(500, 'Endereço muito longo').optional().nullable(),
    city: z.string().max(100, 'Cidade muito longa').optional().nullable(),
    province: z.string().max(100, 'Província muito longa').optional().nullable(),
    country: z.string().max(100, 'País muito longo').optional().nullable(),
    postalCode: z.string().max(20, 'Código postal muito longo').optional().nullable(),
    nuit: z.string().max(20, 'NUIT muito longo').optional().nullable(),
    website: z.string().url('URL inválida').optional().nullable(),
    logo: z.string().max(500, 'URL do logo muito longa').optional().nullable(),
    currency: z.string().max(10, 'Moeda inválida').optional().default('MZN'),
    timezone: z.string().max(50, 'Timezone inválido').optional().default('Africa/Maputo'),
    taxRate: z.number().min(0, 'Taxa de imposto inválida').max(100, 'Taxa de imposto inválida').optional().default(16),
    fiscalYear: z.string().max(20, 'Ano fiscal inválido').optional().nullable()
});

// ============================================================================
// Category Schema
// ============================================================================

export const createCategorySchema = z.object({
    code: z.string().max(50, 'Código muito longo').optional(),
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100, 'Nome muito longo'),
    description: z.string().max(500, 'Descrição muito longa').optional().nullable(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve ser um código hex válido (ex: #FF5733)').optional().nullable(),
    parentId: z.string().uuid('ID da categoria pai inválido').optional().nullable(),
    isActive: z.boolean().optional().default(true)
});

export const updateCategorySchema = createCategorySchema.partial();

// ============================================================================
// Payment Method Schema
// ============================================================================

export const createPaymentMethodSchema = z.object({
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100, 'Nome muito longo'),
    code: z.string().max(20, 'Código muito longo'),
    description: z.string().max(200, 'Descrição muito longa').optional().nullable(),
    isActive: z.boolean().optional().default(true),
    requiresReference: z.boolean().optional().default(false),
    icon: z.string().max(50, 'Ãcone muito longo').optional().nullable()
});

// ============================================================================
// Type Exports
// ============================================================================

export type UpdateCompanySettingsInput = z.infer<typeof updateCompanySettingsSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
