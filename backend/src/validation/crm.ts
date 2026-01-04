/**
 * Validation Schemas - CRM
 * 
 * Schemas for CRM contacts, opportunities, and pipeline operations.
 */

import { z } from 'zod';

// ============================================================================
// Contact Schemas
// ============================================================================

export const createContactSchema = z.object({
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200, 'Nome muito longo'),
    email: z.string().email('Email inválido').optional().nullable(),
    phone: z.string().max(50, 'Telefone muito longo').optional().nullable(),
    company: z.string().max(200, 'Empresa muito longa').optional().nullable(),
    position: z.string().max(100, 'Cargo muito longo').optional().nullable(),
    source: z.enum(['website', 'referral', 'social', 'cold_call', 'event', 'other']).optional(),
    notes: z.string().max(1000, 'Notas muito longas').optional().nullable(),
    tags: z.array(z.string().max(50)).max(10, 'Máximo de 10 tags').optional(),
    customFields: z.record(z.string(), z.unknown()).optional()
});

export const updateContactSchema = createContactSchema.partial();

// ============================================================================
// Opportunity Schemas
// ============================================================================

export const createOpportunitySchema = z.object({
    title: z.string().min(2, 'Título deve ter pelo menos 2 caracteres').max(200, 'Título muito longo'),
    contactId: z.string().uuid('ID do contacto inválido').optional().nullable(),
    stageId: z.string().uuid('ID do estágio inválido').optional().nullable(),
    value: z.number().min(0, 'Valor não pode ser negativo').optional().default(0),
    currency: z.string().max(10, 'Moeda inválida').optional().default('MZN'),
    probability: z.number().min(0, 'Probabilidade mínima é 0').max(100, 'Probabilidade máxima é 100').optional().default(50),
    expectedCloseDate: z.string().datetime({ message: 'Data de fecho esperada inválida' }).optional().nullable(),
    description: z.string().max(2000, 'Descrição muito longa').optional().nullable(),
    source: z.string().max(100, 'Fonte muito longa').optional().nullable(),
    assignedTo: z.string().uuid('ID do responsável inválido').optional().nullable(),
    tags: z.array(z.string().max(50)).max(10, 'Máximo de 10 tags').optional()
});

export const updateOpportunitySchema = createOpportunitySchema.partial();

export const moveOpportunityStageSchema = z.object({
    newStageId: z.string().uuid('ID do novo estágio inválido'),
    reason: z.string().max(500, 'Motivo muito longo').optional().nullable()
});

// ============================================================================
// Pipeline Stage Schemas
// ============================================================================

export const createPipelineStageSchema = z.object({
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100, 'Nome muito longo'),
    order: z.number().int().min(0, 'Ordem deve ser maior ou igual a zero'),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve ser um código hex válido').optional().nullable(),
    probability: z.number().min(0).max(100).optional().default(50),
    isWon: z.boolean().optional().default(false),
    isLost: z.boolean().optional().default(false)
});

export const updatePipelineStageSchema = createPipelineStageSchema.partial();

// ============================================================================
// Activity Schemas
// ============================================================================

export const createActivitySchema = z.object({
    type: z.enum(['call', 'meeting', 'email', 'task', 'note', 'other']),
    title: z.string().min(2, 'Título deve ter pelo menos 2 caracteres').max(200, 'Título muito longo'),
    description: z.string().max(2000, 'Descrição muito longa').optional().nullable(),
    contactId: z.string().uuid('ID do contacto inválido').optional().nullable(),
    opportunityId: z.string().uuid('ID da oportunidade inválido').optional().nullable(),
    dueDate: z.string().datetime({ message: 'Data de vencimento inválida' }).optional().nullable(),
    completedAt: z.string().datetime({ message: 'Data de conclusão inválida' }).optional().nullable(),
    assignedTo: z.string().uuid('ID do responsável inválido').optional().nullable()
});

export const updateActivitySchema = createActivitySchema.partial();

// ============================================================================
// Type Exports
// ============================================================================

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>;
export type UpdateOpportunityInput = z.infer<typeof updateOpportunitySchema>;
export type MoveOpportunityStageInput = z.infer<typeof moveOpportunityStageSchema>;
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
