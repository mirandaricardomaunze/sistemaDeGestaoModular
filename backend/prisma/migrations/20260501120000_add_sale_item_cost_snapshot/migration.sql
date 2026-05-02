-- Add cost_price snapshot to sale_items so margin reports stay accurate
-- when the underlying product is renamed, repriced or soft-deleted.
ALTER TABLE "sale_items" ADD COLUMN "cost_price" DECIMAL(15,2);

-- Backfill existing rows with the current product cost when available.
-- Rows whose product was already deleted remain NULL; analytics queries
-- COALESCE these to 0 so they don't break.
UPDATE "sale_items" si
SET "cost_price" = p."costPrice"
FROM "products" p
WHERE si."productId" = p.id
  AND si."cost_price" IS NULL;
