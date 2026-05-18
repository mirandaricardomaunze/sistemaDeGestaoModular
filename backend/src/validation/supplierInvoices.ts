import { z } from 'zod';

const supplierInvoiceItemSchema = z.object({
  purchaseOrderItemId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

export const createSupplierInvoiceSchema = z.object({
  invoiceNumber: z.string().trim().min(1).max(64),
  issueDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional().nullable(),
  taxRate: z.number().min(0).max(100).optional(),
  status: z.enum(['registered', 'paid']).optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
  items: z.array(supplierInvoiceItemSchema).min(1).optional(),
});

export const updateSupplierInvoiceStatusSchema = z.object({
  status: z.enum(['paid', 'cancelled']),
});

export const paymentMethodSchema = z.enum(['cash', 'card', 'pix', 'transfer', 'credit', 'mpesa', 'emola']);

export const addSupplierInvoicePaymentSchema = z.object({
  amount: z.number().positive(),
  method: paymentMethodSchema.default('transfer'),
  paymentDate: z.coerce.date().optional(),
  reference: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  approvalId: z.string().uuid().optional(),
});

export type AddSupplierInvoicePaymentInput = z.infer<typeof addSupplierInvoicePaymentSchema>;

export const listSupplierInvoicesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  purchaseOrderId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  status: z.enum(['registered', 'partial', 'paid', 'cancelled']).optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

export type CreateSupplierInvoiceInput = z.infer<typeof createSupplierInvoiceSchema>;
export type UpdateSupplierInvoiceStatusInput = z.infer<typeof updateSupplierInvoiceStatusSchema>;
export type ListSupplierInvoicesQuery = z.infer<typeof listSupplierInvoicesQuerySchema>;
