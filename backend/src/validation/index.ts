/**
 * Validation Schemas - Barrel Export
 * 
 * Central export point for all validation schemas.
 * Import from this file for convenience.
 * 
 * @example
 * import { createCustomerSchema, formatZodError, validateBody } from '../validation';
 */

// Base utilities and middleware
export * from './base';

// Domain-specific schemas
export * from './admin';
export * from './auth';
export * from './customers';
export * from './suppliers';
export * from './products';
export * from './employees';
export * from './orders';
export * from './invoices';
export * from './settings';
export * from './warehouses';
export * from './crm';
export * from './hospitality';
export * from './campaigns';
export {
    createFiscalDocumentSchema,
    dispenseMedicationSchema
} from './fiscal';
export type {
    CreateFiscalDocumentInput,
    DispenseMedicationInput
} from './fiscal';
export * from './pharmacy';
export * from './cashSession';
export * from './commercial';
export * from './restaurant';
export * from './sales';
