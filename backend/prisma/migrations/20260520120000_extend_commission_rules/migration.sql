-- Estende CommissionRule com escopo por produto/categoria (gap 1)
-- e novo tipo `target_based` (gap 2: comissão atrelada a SalesTarget).
-- Aditivo, sem perda de dados. Tudo opcional (NULL-friendly).

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommissionType') THEN
        CREATE TYPE "CommissionType" AS ENUM ('fixed', 'tiered', 'profit_based');
    END IF;
END$$;

-- 1) Novo valor no enum CommissionType
ALTER TYPE "CommissionType" ADD VALUE IF NOT EXISTS 'target_based';

CREATE TABLE IF NOT EXISTS "commission_rules" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT,
    "role" "EmployeeRole",
    "type" "CommissionType" NOT NULL DEFAULT 'fixed',
    "rate" DECIMAL(5,2),
    "tiers" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT,
    CONSTRAINT "commission_rules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "commission_rules_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "commission_rules_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "commission_rules_employeeId_key" ON "commission_rules"("employeeId");
CREATE INDEX IF NOT EXISTS "commission_rules_companyId_idx" ON "commission_rules"("companyId");

-- 2) Colunas novas em commission_rules (scope por produto/categoria)
ALTER TABLE "commission_rules" ADD COLUMN IF NOT EXISTS "productId"  TEXT;
ALTER TABLE "commission_rules" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;

-- 3) Índices para queries por escopo
CREATE INDEX IF NOT EXISTS "commission_rules_productId_idx"  ON "commission_rules"("productId");
CREATE INDEX IF NOT EXISTS "commission_rules_categoryId_idx" ON "commission_rules"("categoryId");

-- 4) Foreign keys (SET NULL para preservar histórico se produto/categoria for apagado)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'commission_rules_productId_fkey'
    ) THEN
        ALTER TABLE "commission_rules"
        ADD CONSTRAINT "commission_rules_productId_fkey"
        FOREIGN KEY ("productId") REFERENCES "products"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'commission_rules_categoryId_fkey'
    ) THEN
        ALTER TABLE "commission_rules"
        ADD CONSTRAINT "commission_rules_categoryId_fkey"
        FOREIGN KEY ("categoryId") REFERENCES "categories"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END$$;
