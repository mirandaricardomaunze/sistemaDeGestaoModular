-- Composite indexes for the hot product-listing path:
-- POS, inventory, and global navbar search all filter by (companyId, originModule, isActive)
-- and order/search by name. Without a composite index Postgres falls back to a single-column
-- index + sort, which is slow once a tenant has thousands of products.

ALTER TABLE "products"
    ADD COLUMN IF NOT EXISTS "origin_module" TEXT NOT NULL DEFAULT 'inventory';

CREATE INDEX IF NOT EXISTS "products_companyId_originModule_isActive_name_idx"
    ON "products" ("companyId", "origin_module", "isActive", "name");

CREATE INDEX IF NOT EXISTS "products_companyId_name_idx"
    ON "products" ("companyId", "name");
