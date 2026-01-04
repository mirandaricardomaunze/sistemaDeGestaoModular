/**
 * Validation Schemas - Authentication
 * 
 * Schemas for authentication and authorization operations.
 */

import { z } from 'zod';

// ============================================================================
// Auth Schemas
// ============================================================================

export const loginSchema = z.object({
    email: z.string().email('Email inválido'),
    password: z.string().min(1, 'Senha obrigatória')
});

export const registerSchema = z.object({
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200, 'Nome muito longo'),
    email: z.string().email('Email inválido'),
    password: z.string()
        .min(8, 'Senha deve ter pelo menos 8 caracteres')
        .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
        .regex(/[a-z]/, 'Senha deve conter pelo menos uma letra minúscula')
        .regex(/[0-9]/, 'Senha deve conter pelo menos um número'),
    role: z.string().optional(),
    phone: z.string().max(50, 'Telefone muito longo').optional().nullable(),
    companyName: z.string().min(2, 'Nome da empresa muito curto').max(200, 'Nome da empresa muito longo'),
    companyTradeName: z.string().max(200, 'Nome comercial muito longo').optional().nullable(),
    companyNuit: z.string().min(9, 'NUIT inválido').max(20, 'NUIT muito longo'),
    companyPhone: z.string().max(50, 'Telefone da empresa muito longo').optional().nullable(),
    companyEmail: z.string().email('Email da empresa inválido').optional().nullable(),
    companyAddress: z.string().max(500, 'Endereço da empresa muito longo').optional().nullable(),
    moduleCode: z.string().min(1, 'Código do módulo obrigatório')
});

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Senha atual obrigatória'),
    newPassword: z.string()
        .min(8, 'Nova senha deve ter pelo menos 8 caracteres')
        .regex(/[A-Z]/, 'Nova senha deve conter pelo menos uma letra maiúscula')
        .regex(/[a-z]/, 'Nova senha deve conter pelo menos uma letra minúscula')
        .regex(/[0-9]/, 'Nova senha deve conter pelo menos um número')
}).refine(
    (data) => data.currentPassword !== data.newPassword,
    { message: 'Nova senha deve ser diferente da senha atual' }
);

export const forgotPasswordSchema = z.object({
    email: z.string().email('Email inválido')
});

export const verifyOtpSchema = z.object({
    email: z.string().email('Email inválido'),
    otp: z.string().min(6, 'Código deve ter 6 dígitos').max(6, 'Código deve ter 6 dígitos')
});

export const resetPasswordSchema = z.object({
    email: z.string().email('Email inválido'),
    otp: z.string().min(6, 'Código deve ter 6 dígitos').max(6, 'Código deve ter 6 dígitos'),
    newPassword: z.string()
        .min(8, 'Senha deve ter pelo menos 8 caracteres')
        .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
        .regex(/[a-z]/, 'Senha deve conter pelo menos uma letra minúscula')
        .regex(/[0-9]/, 'Senha deve conter pelo menos um número')
});

export const updateProfileSchema = z.object({
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200, 'Nome muito longo').optional(),
    phone: z.string().max(50, 'Telefone muito longo').optional().nullable(),
    avatar: z.string().url('URL do avatar inválida').optional().nullable()
});

export const updateUserSchema = z.object({
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200, 'Nome muito longo').optional(),
    email: z.string().email('Email inválido').optional(),
    role: z.string().optional(),
    phone: z.string().max(50, 'Telefone muito longo').optional().nullable()
});

export const updateUserStatusSchema = z.object({
    isActive: z.boolean({ message: 'Status deve ser um booleano' })
});

// ============================================================================
// Type Exports
// ============================================================================

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
