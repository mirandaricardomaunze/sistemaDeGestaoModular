-- ============================================================================
-- Add IVA breakdown columns to customer_orders.
-- Existing orders are backfilled assuming the stored "total" already includes
-- IVA at the company's current rate (the rate prior to this migration was the
-- only rate ever applied to invoicing). The breakdown is reverse-derived:
--     subtotal  = total / (1 + ivaRate)
--     taxAmount = total - subtotal
-- Orders without an associated company fall back to the system default (16%).
-- ============================================================================

ALTER TABLE "customer_orders"
    ADD COLUMN "subtotal"  DECIMAL(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN "discount"  DECIMAL(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN "taxRate"   DECIMAL(5,2)  NOT NULL DEFAULT 0,
    ADD COLUMN "taxAmount" DECIMAL(15,2) NOT NULL DEFAULT 0;

-- Some fresh deploys can start from an older baseline where company_settings
-- did not yet have a company relation. Ensure the backfill join is available.
ALTER TABLE "company_settings"
    ADD COLUMN IF NOT EXISTS "companyId" TEXT;

-- Backfill from total + each company's stored ivaRate.
UPDATE "customer_orders" co
SET
    "taxRate"   = COALESCE(cs."ivaRate", 16),
    "subtotal"  = ROUND(co."total" / (1 + COALESCE(cs."ivaRate", 16) / 100), 2),
    "taxAmount" = ROUND(co."total" - (co."total" / (1 + COALESCE(cs."ivaRate", 16) / 100)), 2)
FROM "company_settings" cs
WHERE cs."companyId" = co."companyId";

-- Orders not linked to a company (legacy data): assume default 16% IVA.
UPDATE "customer_orders"
SET
    "taxRate"   = 16,
    "subtotal"  = ROUND("total" / 1.16, 2),
    "taxAmount" = ROUND("total" - ("total" / 1.16), 2)
WHERE "companyId" IS NULL;
