import { z } from 'zod';

export const APPROVAL_REQUEST_TYPES = [
    'discount_override',
    'cash_drop',
    'credit_note',
    'debit_note',
    'stock_adjustment',
    'purchase_order',
    'supplier_payment',
    'price_change',
    'payroll_release',
    'bonus_release',
    'warehouse_transfer',
    'invoice_cancel',
    'fiscal_period_reopen',
] as const;

export const APPROVAL_REQUEST_STATUSES = [
    'pending',
    'approved',
    'rejected',
    'expired',
    'cancelled',
] as const;

export const createApprovalRequestSchema = z.object({
    requestType: z.enum(APPROVAL_REQUEST_TYPES),
    resourceType: z.string().trim().max(64).optional().nullable(),
    resourceId: z.string().trim().max(64).optional().nullable(),
    amount: z.number().nonnegative().optional().nullable(),
    reason: z.string().trim().min(3, 'Motivo deve ter pelo menos 3 caracteres').max(500),
    payload: z.record(z.string(), z.unknown()).optional().nullable(),
    expiresAt: z.coerce.date().optional().nullable(),
});

export const decideApprovalRequestSchema = z.object({
    decisionNotes: z.string().trim().max(500).optional().nullable(),
});

export const listApprovalRequestsSchema = z.object({
    status: z.enum(APPROVAL_REQUEST_STATUSES).optional(),
    requestType: z.enum(APPROVAL_REQUEST_TYPES).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
});

const numberThreshold = z.number().nonnegative().optional();

export const approvalThresholdsSchema = z.object({
    discount: z.number().min(0).max(1).optional(),
    cashDrop: numberThreshold,
    creditNote: numberThreshold,
    debitNote: numberThreshold,
    stockAdjustment: numberThreshold,
    purchaseOrder: numberThreshold,
    supplierPayment: numberThreshold,
    priceChangePercent: z.number().min(0).max(1).optional(),
    payrollRelease: numberThreshold,
    bonusRelease: numberThreshold,
    warehouseTransferUnits: numberThreshold,
    invoiceCancel: numberThreshold,
}).strict();

export type CreateApprovalRequestInput = z.infer<typeof createApprovalRequestSchema>;
export type DecideApprovalRequestInput = z.infer<typeof decideApprovalRequestSchema>;
export type ListApprovalRequestsInput = z.infer<typeof listApprovalRequestsSchema>;
export type ApprovalThresholds = z.infer<typeof approvalThresholdsSchema>;
