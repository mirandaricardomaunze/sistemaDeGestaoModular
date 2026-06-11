import { z } from 'zod';

export const CreateInventorySchema = z.object({
    warehouseId: z.string().uuid('Armazem invalido'),
    notes: z.string().max(1000, 'Notas muito longas').optional().nullable()
});

export const CountLineSchema = z.object({
    lineId: z.string().uuid('Linha invalida'),
    countedQuantity: z.number().min(0, 'Quantidade nao pode ser negativa'),
    notes: z.string().max(500, 'Notas muito longas').optional().nullable()
});

export const BulkCountSchema = z.object({
    lines: z.array(CountLineSchema).min(1, 'Informe pelo menos uma contagem')
});

export type CreateInventoryInput = z.infer<typeof CreateInventorySchema>;
export type BulkCountInput = z.infer<typeof BulkCountSchema>;
