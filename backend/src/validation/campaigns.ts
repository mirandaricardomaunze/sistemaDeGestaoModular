/**
 * Validation Schemas - Campaigns & Alerts
 * 
 * Schemas for marketing campaigns and system alerts.
 */

import { z } from 'zod';

// ============================================================================
// Campaign Schemas
// ============================================================================

export const createCampaignSchema = z.object({
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200, 'Nome muito longo'),
    description: z.string().max(2000, 'Descrição muito longa').optional().nullable(),
    type: z.enum(['email', 'sms', 'push', 'whatsapp', 'social']),
    status: z.enum(['draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled']).optional().default('draft'),
    target: z.enum(['all', 'customers', 'leads', 'segment']).optional().default('all'),
    segmentId: z.string().uuid('ID do segmento inválido').optional().nullable(),
    content: z.string().max(10000, 'Conteúdo muito longo').optional().nullable(),
    subject: z.string().max(200, 'Assunto muito longo').optional().nullable(),
    scheduledAt: z.string().datetime({ message: 'Data agendada inválida' }).optional().nullable(),
    budget: z.number().min(0, 'Orçamento não pode ser negativo').optional().default(0),
    tags: z.array(z.string().max(50)).max(10, 'Máximo de 10 tags').optional()
});

export const updateCampaignSchema = createCampaignSchema.partial();

// ============================================================================
// Alert Schemas
// ============================================================================

export const createAlertSchema = z.object({
    type: z.enum(['low_stock', 'expiry', 'payment_due', 'maintenance', 'system', 'custom']),
    title: z.string().min(2, 'Título deve ter pelo menos 2 caracteres').max(200, 'Título muito longo'),
    message: z.string().max(1000, 'Mensagem muito longa'),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
    relatedId: z.string().uuid('ID relacionado inválido').optional().nullable(),
    relatedType: z.string().max(50, 'Tipo relacionado muito longo').optional().nullable(),
    expiresAt: z.string().datetime({ message: 'Data de expiração inválida' }).optional().nullable(),
    actionUrl: z.string().url('URL de ação inválida').optional().nullable()
});

export const updateAlertSchema = z.object({
    isRead: z.boolean().optional(),
    isResolved: z.boolean().optional(),
    resolvedAt: z.string().datetime({ message: 'Data de resolução inválida' }).optional().nullable(),
    resolvedBy: z.string().uuid('ID do resolvedor inválido').optional().nullable(),
    notes: z.string().max(500, 'Notas muito longas').optional().nullable()
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type CreateAlertInput = z.infer<typeof createAlertSchema>;
export type UpdateAlertInput = z.infer<typeof updateAlertSchema>;
