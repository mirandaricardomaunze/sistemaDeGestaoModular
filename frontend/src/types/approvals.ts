export const APPROVAL_REQUEST_TYPES = [
    'discount_override',
    'cash_drop',
    'credit_note',
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

export type ApprovalRequestType = typeof APPROVAL_REQUEST_TYPES[number];

export const APPROVAL_REQUEST_STATUSES = [
    'pending',
    'approved',
    'rejected',
    'expired',
    'cancelled',
] as const;

export type ApprovalRequestStatus = typeof APPROVAL_REQUEST_STATUSES[number];

export interface ApprovalRequest {
    id: string;
    companyId: string;
    requestType: ApprovalRequestType;
    status: ApprovalRequestStatus;
    resourceType: string | null;
    resourceId: string | null;
    amount: number | null;
    reason: string;
    payload: Record<string, unknown> | null;
    decisionNotes: string | null;
    requestedByUserId: string;
    requestedByName: string | null;
    decidedByUserId: string | null;
    decidedByName: string | null;
    decidedAt: string | null;
    expiresAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface ApprovalThresholds {
    discount?: number;
    cashDrop?: number;
    creditNote?: number;
    stockAdjustment?: number;
    purchaseOrder?: number;
    supplierPayment?: number;
    priceChangePercent?: number;
    payrollRelease?: number;
    bonusRelease?: number;
    warehouseTransferUnits?: number;
    invoiceCancel?: number;
}

export const APPROVAL_REQUEST_LABELS: Record<ApprovalRequestType, string> = {
    discount_override: 'Desconto acima do limite',
    cash_drop: 'Sangria de caixa',
    credit_note: 'Nota de crédito / devolução',
    stock_adjustment: 'Ajuste de stock',
    purchase_order: 'Ordem de compra',
    supplier_payment: 'Pagamento a fornecedor',
    price_change: 'Alteração de preço',
    payroll_release: 'Folha de pagamento',
    bonus_release: 'Bónus',
    warehouse_transfer: 'Transferência de armazém',
    invoice_cancel: 'Cancelamento de fatura',
    fiscal_period_reopen: 'Reabertura de período fiscal',
};

export interface CreateApprovalRequestInput {
    requestType: ApprovalRequestType;
    resourceType?: string | null;
    resourceId?: string | null;
    amount?: number | null;
    reason: string;
    payload?: Record<string, unknown> | null;
    expiresAt?: string | null;
}

export interface DecideApprovalRequestInput {
    decisionNotes?: string | null;
}

export interface ApprovalListParams {
    status?: ApprovalRequestStatus;
    requestType?: ApprovalRequestType;
    page?: number;
    limit?: number;
}
