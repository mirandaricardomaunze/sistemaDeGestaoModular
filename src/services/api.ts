// ============================================================================
// API Services - Legacy Compatibility Layer
// ============================================================================
//
// This file re-exports all API services from the modular structure for 
// backward compatibility with existing imports.
//
// New code should import directly from '@/services/api':
//   import { authAPI, productsAPI } from '@/services/api';
//
// Or from individual modules for tree-shaking:
//   import { authAPI } from '@/services/api/auth.api';
//
// ============================================================================

// Re-export everything from the modular API structure
export * from './api/index';
export { default } from './api/client';
