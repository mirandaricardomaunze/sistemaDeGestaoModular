/**
 * Validation Schemas - Fiscal & Pharmacy
 * 
 * Schemas for fiscal documents and pharmacy operations.
 */

import { z } from 'zod';

// ============================================================================
// Fiscal Document Schemas
// ============================================================================

export const createFiscalDocumentSchema = z.object({
    type: z.enum(['invoice', 'credit_note', 'debit_note', 'receipt', 'transport_guide']),
    customerId: z.string().uuid('ID do cliente inválido').optional().nullable(),
    customerName: z.string().max(200, 'Nome do cliente muito longo'),
    customerNuit: z.string().max(20, 'NUIT muito longo').optional().nullable(),
    customerAddress: z.string().max(500, 'Endereço muito longo').optional().nullable(),
    items: z.array(z.object({
        description: z.string().min(1, 'Descrição obrigatória').max(500, 'Descrição muito longa'),
        quantity: z.number().positive('Quantidade deve ser maior que zero'),
        unitPrice: z.number().positive('Preço unitário deve ser maior que zero'),
        taxRate: z.number().min(0).max(100).optional().default(16),
        total: z.number().positive('Total deve ser maior que zero')
    })).min(1, 'Documento deve ter pelo menos um item'),
    subtotal: z.number().min(0, 'Subtotal não pode ser negativo'),
    taxAmount: z.number().min(0, 'Imposto não pode ser negativo'),
    total: z.number().positive('Total deve ser maior que zero'),
    notes: z.string().max(1000, 'Notas muito longas').optional().nullable()
});

// ============================================================================
// Pharmacy Schemas
// ============================================================================

export const createMedicationSchema = z.object({
    code: z.string().max(50, 'Código muito longo').optional(),
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200, 'Nome muito longo'),
    genericName: z.string().max(200, 'Nome genérico muito longo').optional().nullable(),
    dosageForm: z.enum(['tablet', 'capsule', 'syrup', 'injection', 'cream', 'ointment', 'drops', 'inhaler', 'patch', 'suppository', 'other']),
    strength: z.string().max(50, 'Dosagem muito longa').optional().nullable(),
    manufacturer: z.string().max(200, 'Fabricante muito longo').optional().nullable(),
    batchNumber: z.string().max(100, 'Número do lote muito longo').optional().nullable(),
    expiryDate: z.string().datetime({ message: 'Data de validade inválida' }),
    price: z.number().positive('Preço deve ser maior que zero'),
    costPrice: z.number().min(0, 'Custo não pode ser negativo').optional().default(0),
    stock: z.number().int().min(0, 'Stock não pode ser negativo').optional().default(0),
    minStock: z.number().int().min(0, 'Stock mínimo não pode ser negativo').optional().default(5),
    requiresPrescription: z.boolean().optional().default(false),
    controlled: z.boolean().optional().default(false),
    storageConditions: z.string().max(200, 'Condições de armazenamento muito longas').optional().nullable(),
    contraindications: z.string().max(1000, 'Contraindicações muito longas').optional().nullable(),
    sideEffects: z.string().max(1000, 'Efeitos secundários muito longos').optional().nullable(),
    isActive: z.boolean().optional().default(true)
});

export const updateMedicationSchema = createMedicationSchema.partial();

export const createPrescriptionSchema = z.object({
    patientName: z.string().min(2, 'Nome do paciente obrigatório').max(200, 'Nome muito longo'),
    patientPhone: z.string().max(50, 'Telefone muito longo').optional().nullable(),
    doctorName: z.string().max(200, 'Nome do médico muito longo').optional().nullable(),
    doctorLicense: z.string().max(50, 'Número da ordem muito longo').optional().nullable(),
    prescriptionDate: z.string().datetime({ message: 'Data da prescrição inválida' }),
    items: z.array(z.object({
        medicationId: z.string().uuid('ID do medicamento inválido'),
        quantity: z.number().int().positive('Quantidade deve ser maior que zero'),
        dosage: z.string().max(200, 'Dosagem muito longa').optional().nullable(),
        frequency: z.string().max(100, 'Frequência muito longa').optional().nullable(),
        duration: z.string().max(100, 'Duração muito longa').optional().nullable(),
        instructions: z.string().max(500, 'Instruções muito longas').optional().nullable()
    })).min(1, 'Prescrição deve ter pelo menos um item'),
    notes: z.string().max(1000, 'Notas muito longas').optional().nullable()
});

export const dispenseMedicationSchema = z.object({
    medicationId: z.string().uuid('ID do medicamento inválido'),
    quantity: z.number().int().positive('Quantidade deve ser maior que zero'),
    patientName: z.string().max(200, 'Nome do paciente muito longo').optional().nullable(),
    prescriptionId: z.string().uuid('ID da prescrição inválido').optional().nullable(),
    notes: z.string().max(500, 'Notas muito longas').optional().nullable()
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateFiscalDocumentInput = z.infer<typeof createFiscalDocumentSchema>;
export type CreateMedicationInput = z.infer<typeof createMedicationSchema>;
export type UpdateMedicationInput = z.infer<typeof updateMedicationSchema>;
export type CreatePrescriptionInput = z.infer<typeof createPrescriptionSchema>;
export type DispenseMedicationInput = z.infer<typeof dispenseMedicationSchema>;
