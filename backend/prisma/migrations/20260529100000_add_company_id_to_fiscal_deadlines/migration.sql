-- Align the existing fiscal_deadlines table with the current Prisma model.
ALTER TABLE "fiscal_deadlines"
    ADD COLUMN IF NOT EXISTS "companyId" TEXT;

CREATE INDEX IF NOT EXISTS "fiscal_deadlines_companyId_idx"
    ON "fiscal_deadlines"("companyId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fiscal_deadlines_companyId_fkey'
    ) THEN
        ALTER TABLE "fiscal_deadlines"
            ADD CONSTRAINT "fiscal_deadlines_companyId_fkey"
            FOREIGN KEY ("companyId") REFERENCES "companies"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
