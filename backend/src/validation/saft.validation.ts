import { z } from 'zod';

export const SAFTParamsSchema = z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato: YYYY-MM-DD'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato: YYYY-MM-DD'),
    fiscalYear: z.string().regex(/^\d{4}$/, 'Ano com 4 dígitos'),
}).refine(
    (data) => new Date(data.startDate) <= new Date(data.endDate),
    { message: 'Data início deve ser anterior à data fim', path: ['startDate'] }
);

export type SAFTParams = z.infer<typeof SAFTParamsSchema>;
