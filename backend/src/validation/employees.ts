/**
 * Validation Schemas - Employees
 * 
 * Schemas for employee CRUD, attendance, payroll, and vacation operations.
 */

import { z } from 'zod';

// ============================================================================
// Employee Schemas
// ============================================================================

export const createEmployeeSchema = z.object({
    code: z.string().max(50, 'Código muito longo').optional(),
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200, 'Nome muito longo'),
    email: z.string().email('Email inválido').optional().nullable(),
    phone: z.string().max(50, 'Telefone muito longo').optional().nullable(),
    address: z.string().max(500, 'Endereço muito longo').optional().nullable(),
    documentId: z.string().max(50, 'Documento muito longo').optional().nullable(),
    documentType: z.enum(['bi', 'passport', 'dire', 'other']).optional().default('bi'),
    position: z.string().max(100, 'Cargo muito longo').optional().nullable(),
    department: z.string().max(100, 'Departamento muito longo').optional().nullable(),
    salary: z.number().min(0, 'Salário não pode ser negativo').optional().default(0),
    hireDate: z.string().datetime({ message: 'Data de contratação inválida' }),
    birthDate: z.string().datetime({ message: 'Data de nascimento inválida' }).optional().nullable(),
    contractType: z.enum(['permanent', 'temporary', 'contract', 'intern']).optional().default('permanent'),
    contractExpiry: z.string().datetime({ message: 'Data de expiração inválida' }).optional().nullable(),
    bankName: z.string().max(100, 'Nome do banco muito longo').optional().nullable(),
    bankAccount: z.string().max(50, 'Conta bancária muito longa').optional().nullable(),
    nuit: z.string().max(20, 'NUIT muito longo').optional().nullable(),
    inssNumber: z.string().max(50, 'Número INSS muito longo').optional().nullable(),
    emergencyContact: z.string().max(200, 'Contacto de emergência muito longo').optional().nullable(),
    emergencyPhone: z.string().max(50, 'Telefone de emergência muito longo').optional().nullable(),
    notes: z.string().max(1000, 'Notas muito longas').optional().nullable(),
    isActive: z.boolean().optional().default(true)
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

// ============================================================================
// Attendance Schemas
// ============================================================================

export const recordAttendanceSchema = z.object({
    date: z.string().datetime({ message: 'Data inválida' }),
    checkIn: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Hora de entrada inválida (HH:MM)').optional().nullable(),
    checkOut: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Hora de saída inválida (HH:MM)').optional().nullable(),
    status: z.enum(['present', 'absent', 'late', 'half_day', 'holiday', 'vacation', 'sick']).optional().default('present'),
    notes: z.string().max(500, 'Notas muito longas').optional().nullable(),
    justification: z.string().max(500, 'Justificação muito longa').optional().nullable()
});

// ============================================================================
// Payroll Schemas
// ============================================================================

export const generatePayrollSchema = z.object({
    month: z.number().int().min(1, 'Mês inválido').max(12, 'Mês inválido'),
    year: z.number().int().min(2000, 'Ano inválido').max(2100, 'Ano inválido'),
    otHours: z.number().min(0, 'Horas extras não podem ser negativas').optional().default(0),
    bonus: z.number().min(0, 'Bónus não pode ser negativo').optional().default(0),
    advances: z.number().min(0, 'Adiantamentos não podem ser negativos').optional().default(0),
    notes: z.string().max(500, 'Notas muito longas').optional().nullable()
});

export const processPayrollSchema = z.object({
    payrollIds: z.array(z.string().uuid('ID de folha inválido'))
        .min(1, 'Deve selecionar pelo menos uma folha de pagamento')
});

// ============================================================================
// Vacation Schemas
// ============================================================================

export const requestVacationSchema = z.object({
    startDate: z.string().datetime({ message: 'Data de início inválida' }),
    endDate: z.string().datetime({ message: 'Data de fim inválida' }),
    notes: z.string().max(500, 'Notas muito longas').optional().nullable()
}).refine(
    (data) => new Date(data.startDate) < new Date(data.endDate),
    { message: 'Data de início deve ser anterior à data de fim' }
);

export const approveVacationSchema = z.object({
    status: z.enum(['approved', 'rejected'], {
        errorMap: () => ({ message: 'Status deve ser: approved ou rejected' })
    }),
    approvedBy: z.string().max(200, 'Nome do aprovador muito longo').optional().nullable()
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type RecordAttendanceInput = z.infer<typeof recordAttendanceSchema>;
export type GeneratePayrollInput = z.infer<typeof generatePayrollSchema>;
export type RequestVacationInput = z.infer<typeof requestVacationSchema>;
export type ApproveVacationInput = z.infer<typeof approveVacationSchema>;
