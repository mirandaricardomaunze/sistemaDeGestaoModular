/**
 * Validation Schemas - Global Admin
 * 
 * Schemas for global administration operations (super_admin).
 */

import { z } from 'zod';

export const updateCompanyStatusSchema = z.object({
    status: z.enum(['active', 'trial', 'blocked', 'cancelled'])
});

export type UpdateCompanyStatusInput = z.infer<typeof updateCompanyStatusSchema>;
