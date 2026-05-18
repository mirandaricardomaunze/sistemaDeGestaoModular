import { z } from 'zod';

export const targetTypeSchema = z.enum(['DAILY', 'WEEKLY', 'MONTHLY']);

export const salesTargetSchema = z.object({
  employeeId: z.string().uuid().optional().nullable(),
  type: targetTypeSchema.default('MONTHLY'),
  value: z.number().positive(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isActive: z.boolean().default(true),
});

export const updateSalesTargetSchema = salesTargetSchema.partial();
