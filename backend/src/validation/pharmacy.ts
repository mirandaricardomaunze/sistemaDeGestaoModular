/**
 * Pharmacy Validation Schemas
 * 
 * Zod schemas for pharmacy module input validation.
 */

import { z } from 'zod';

// ============================================================================
// MEDICATION SCHEMAS
// ============================================================================

export const createMedicationSchema = z.object({
    productId: z.string().uuid('ID do produto invalido'),
    activeIngredient: z.string().optional(),
    dosage: z.string().optional(),
    dosageForm: z.string().optional(),
    manufacturer: z.string().optional(),
    requiresPrescription: z.boolean().default(false),
    isControlled: z.boolean().default(false),
    storageTemp: z.enum(['ambiente', 'refrigerado', 'congelado']).default('ambiente'),
    therapeuticClass: z.string().optional(),
    contraindications: z.string().optional(),
    sideEffects: z.string().optional(),
    interactions: z.string().optional(),
    posology: z.string().optional()
});

export const updateMedicationSchema = createMedicationSchema.partial().omit({ productId: true });

// ============================================================================
// BATCH SCHEMAS
// ============================================================================

export const createBatchSchema = z.object({
    medicationId: z.string().uuid('ID do medicamento invalido'),
    batchNumber: z.string().min(1, 'Numero do lote e obrigatorio'),
    quantity: z.number().int().positive('Quantidade deve ser positiva'),
    expiryDate: z.string().refine(
        (date) => new Date(date) > new Date(),
        'Data de validade deve ser futura'
    ),
    costPrice: z.number().nonnegative('Preco de custo nao pode ser negativo').optional(),
    sellingPrice: z.number().positive('Preco de venda deve ser positivo').optional(),
    invoiceNumber: z.string().optional(),
    supplierId: z.string().uuid().optional().nullable()
});

// ============================================================================
// SALE SCHEMAS
// ============================================================================

export const pharmacySaleItemSchema = z.object({
    batchId: z.string().uuid('ID do lote invalido'),
    quantity: z.number().int().positive('Quantidade deve ser positiva'),
    discount: z.number().nonnegative().default(0),
    posologyLabel: z.string().optional()
});

export const createPharmacySaleSchema = z.object({
    items: z.array(pharmacySaleItemSchema).min(1, 'A venda deve ter pelo menos um item'),
    customerId: z.string().uuid().optional().nullable(),
    customerName: z.string().optional(),
    prescriptionId: z.string().uuid().optional().nullable(),
    discount: z.number().nonnegative().default(0),
    paymentMethod: z.enum(['cash', 'card', 'mpesa', 'emola', 'transfer', 'credit']).default('cash'),
    paymentDetails: z.string().optional(),
    partnerId: z.string().uuid().optional().nullable(),
    notes: z.string().optional()
});

// ============================================================================
// PRESCRIPTION SCHEMAS
// ============================================================================

export const createPrescriptionSchema = z.object({
    patientName: z.string().min(1, 'Nome do paciente é obrigatório'),
    patientPhone: z.string().optional(),
    patientBirthDate: z.string().optional(),
    patientAddress: z.string().optional(),
    prescriberName: z.string().min(1, 'Nome do prescritor é obrigatório'),
    prescriberCRM: z.string().optional(),
    prescriberPhone: z.string().optional(),
    facility: z.string().optional(),
    prescriptionDate: z.string(),
    validUntil: z.string().optional(),
    diagnosis: z.string().optional(),
    isControlled: z.boolean().default(false),
    notes: z.string().optional(),
    imageUrl: z.string().optional(),
    items: z.array(z.object({
        medicationName: z.string(),
        medicationId: z.string().uuid().optional().nullable(),
        dosage: z.string().optional(),
        quantity: z.number().int().positive(),
        posology: z.string().optional(),
        duration: z.string().optional(),
        notes: z.string().optional()
    })).optional()
});

// ============================================================================
// PARTNER SCHEMAS
// ============================================================================

export const createPartnerSchema = z.object({
    name: z.string().min(1, 'Nome do parceiro é obrigatório'),
    category: z.string().default('Private Insurance'),
    email: z.string().email('Email inválido').optional().nullable().or(z.literal('')),
    phone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    nuit: z.string().optional().nullable(),
    coveragePercentage: z.number().min(0).max(100).default(0),
    isActive: z.boolean().default(true)
});

export const updatePartnerSchema = createPartnerSchema.partial();
