import { z } from 'zod';

export const commercialFinancePeriodSchema = z.enum(['1m', '3m', '6m', '1y']).default('1m');

const emptyToUndefined = (v: unknown) =>
    typeof v === 'string' && v.trim() === '' ? undefined : v;

export const commercialTransactionsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    startDate: z.preprocess(emptyToUndefined, z.string().optional()),
    endDate: z.preprocess(emptyToUndefined, z.string().optional()),
    category: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    type: z.preprocess(emptyToUndefined, z.enum(['income', 'expense']).optional()),
    search: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
});

export const commercialTransactionSchema = z.object({
    type: z.enum(['income', 'expense']),
    category: z.string().min(1, 'Categoria e obrigatoria'),
    description: z.string().min(2, 'Descricao e obrigatoria'),
    amount: z.coerce.number().min(0.01, 'Valor deve ser maior que zero'),
    date: z.string().min(1, 'Data e obrigatoria'),
    dueDate: z.string().optional().nullable(),
    paymentMethod: z.enum(['cash', 'card', 'mpesa', 'emola', 'transfer', 'bank_transfer', 'credit']).optional().nullable(),
    reference: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
});

export const updateCommercialTransactionSchema = commercialTransactionSchema.partial();

export type CommercialFinancePeriod = z.infer<typeof commercialFinancePeriodSchema>;
export type CommercialTransactionsQuery = z.infer<typeof commercialTransactionsQuerySchema>;
export type CommercialTransactionInput = z.infer<typeof commercialTransactionSchema>;
export type UpdateCommercialTransactionInput = z.infer<typeof updateCommercialTransactionSchema>;
