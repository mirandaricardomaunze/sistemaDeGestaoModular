/**
 * Validation Schemas - Global Admin
 * 
 * Schemas for global administration operations (super_admin).
 */

import { z } from 'zod';

export const updateCompanyStatusSchema = z.object({
    status: z.enum(['active', 'inactive', 'suspended'], {
        message: 'Status deve ser: active, inactive ou suspended'
    })
});

export type UpdateCompanyStatusInput = z.infer<typeof updateCompanyStatusSchema>;
