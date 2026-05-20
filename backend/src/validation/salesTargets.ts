import { z } from 'zod';

export const targetTypeSchema = z.enum(['DAILY', 'WEEKLY', 'MONTHLY']);

export const salesTargetSchema = z.object({
  employeeId: z.string().uuid().optional().nullable(),
  warehouseId: z.string().uuid().optional().nullable(),
  type: targetTypeSchema.default('MONTHLY'),
  value: z.number().positive(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isActive: z.boolean().default(true),
}).refine((data) => data.endDate >= data.startDate, {
  message: 'Data fim tem de ser igual ou posterior à data início',
  path: ['endDate'],
});

export const updateSalesTargetSchema = z.object({
  employeeId: z.string().uuid().optional().nullable(),
  warehouseId: z.string().uuid().optional().nullable(),
  type: targetTypeSchema.optional(),
  value: z.number().positive().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
});
