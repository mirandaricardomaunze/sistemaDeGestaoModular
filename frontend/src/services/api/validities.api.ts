/**
 * Validity API -- now delegates to ProductBatch (unified expiry model).
 * This file is kept for backwards-compatibility. New code should use batchesAPI directly.
 */
export { batchesAPI as validitiesAPI, type ProductBatch as ProductValidity } from './batches.api';
