import { z } from 'zod';

export const bottleStoreTransactionSchema = z.object({
    type: z.enum(['income', 'expense']),
    category: z.string().min(1, 'Categoria e obrigatoria'),
    description: z.string().min(2, 'Descricao e obrigatoria'),
    amount: z.coerce.number().min(0.01, 'Valor deve ser maior que zero'),
    date: z.string().min(1, 'Data e obrigatoria'),
    dueDate: z.string().optional().nullable(),
    paymentMethod: z.enum(['cash', 'card', 'mpesa', 'emola', 'transfer', 'credit']).optional().nullable(),
    reference: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
});

export const updateBottleStoreTransactionSchema = bottleStoreTransactionSchema.partial();
