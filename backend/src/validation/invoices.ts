/**
 * Validation Schemas - Invoices
 * 
 * Schemas for invoice operations.
 */

import { z } from 'zod';

// ============================================================================
// Invoice Schemas
// ============================================================================

export const invoiceItemSchema = z.object({
    productId: z.string().uuid('ID do produto inválido').optional().nullable(),
    description: z.string().min(1, 'Descrição obrigatória').max(500, 'Descrição muito longa'),
    quantity: z.number().positive('Quantidade deve ser maior que zero'),
    unitPrice: z.number().positive('Preço unitário deve ser maior que zero'),
    discount: z.number().min(0, 'Desconto não pode ser negativo').optional().default(0),
    taxRate: z.number().min(0, 'Taxa de imposto não pode ser negativa').max(100, 'Taxa inválida').optional().default(16),
    total: z.number().positive('Total deve ser maior que zero')
});

export const createInvoiceSchema = z.object({
    customerId: z.string().uuid('ID do cliente inválido').optional().nullable(),
    customerName: z.string().max(200, 'Nome do cliente muito longo').optional().nullable(),
    customerNuit: z.string().max(20, 'NUIT muito longo').optional().nullable(),
    customerAddress: z.string().max(500, 'Endereço muito longo').optional().nullable(),
    items: z.array(invoiceItemSchema)
        .min(1, 'Fatura deve ter pelo menos um item')
        .max(100, 'Fatura não pode ter mais de 100 itens'),
    subtotal: z.number().min(0, 'Subtotal não pode ser negativo'),
    discount: z.number().min(0, 'Desconto não pode ser negativo').optional().default(0),
    taxAmount: z.number().min(0, 'Imposto não pode ser negativo').optional().default(0),
    total: z.number().positive('Total deve ser maior que zero'),
    dueDate: z.string().datetime({ message: 'Data de vencimento inválida' }).optional().nullable(),
    notes: z.string().max(1000, 'Notas muito longas').optional().nullable(),
    paymentTerms: z.string().max(200, 'Termos de pagamento muito longos').optional().nullable(),
    type: z.enum(['invoice', 'proforma', 'receipt', 'credit_note', 'debit_note']).optional().default('invoice')
});

export const updateInvoiceSchema = createInvoiceSchema.partial();

export const updateInvoiceStatusSchema = z.object({
    status: z.enum(['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled'], {
        message: 'Status inválido'
    }),
    paidAmount: z.number().min(0, 'Valor pago não pode ser negativo').optional(),
    paymentDate: z.string().datetime({ message: 'Data de pagamento inválida' }).optional().nullable(),
    paymentMethod: z.enum(['cash', 'card', 'pix', 'transfer', 'credit', 'mpesa', 'emola']).optional(),
    notes: z.string().max(500, 'Notas muito longas').optional().nullable()
});

export const addPaymentSchema = z.object({
    amount: z.number().positive('Venda deve ser maior que zero'),
    method: z.enum(['cash', 'card', 'transfer', 'check', 'mpesa', 'emola', 'other'], {
        message: 'Método de pagamento inválido'
    }),
    reference: z.string().max(100, 'Referência muito longa').optional().nullable(),
    notes: z.string().max(500, 'Notas muito longas').optional().nullable()
});

export const creditNoteSchema = z.object({
    reason: z.string().min(1, 'Motivo é obrigatório').max(500, 'Motivo muito longo'),
    items: z.array(z.object({
        productId: z.string().uuid('ID do produto inválido').optional().nullable(),
        description: z.string().min(1, 'Descrição obrigatória'),
        quantity: z.number().positive('Quantidade deve ser maior que zero'),
        unitPrice: z.number().positive('Preço unitário deve ser maior que zero'),
        total: z.number().positive('Total deve ser maior que zero'),
        originalInvoiceItemId: z.string().uuid('ID do item original inválido').optional().nullable()
    })).min(1, 'Deve ter pelo menos um item'),
    notes: z.string().max(500, 'Notas muito longas').optional().nullable()
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type UpdateInvoiceStatusInput = z.infer<typeof updateInvoiceStatusSchema>;
export type AddPaymentInput = z.infer<typeof addPaymentSchema>;
export type CreditNoteInput = z.infer<typeof creditNoteSchema>;
