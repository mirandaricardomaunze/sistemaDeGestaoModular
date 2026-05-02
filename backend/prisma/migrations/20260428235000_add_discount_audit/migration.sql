-- Add structured discount audit columns to sales and sale_items
-- Enables enforcement of role-based discount limits and proper reporting.

ALTER TABLE "sales"
    ADD COLUMN "discount_reason" TEXT,
    ADD COLUMN "discount_kind"   TEXT,
    ADD COLUMN "discount_audit"  JSONB;

ALTER TABLE "sale_items"
    ADD COLUMN "discount_reason"     TEXT,
    ADD COLUMN "discount_kind"       TEXT,
    ADD COLUMN "discount_applied_by" TEXT;

-- Optional reporting indexes (cheap, partial)
CREATE INDEX "sales_discount_reason_idx" ON "sales" ("discount_reason") WHERE "discount_reason" IS NOT NULL;
CREATE INDEX "sale_items_discount_reason_idx" ON "sale_items" ("discount_reason") WHERE "discount_reason" IS NOT NULL;
