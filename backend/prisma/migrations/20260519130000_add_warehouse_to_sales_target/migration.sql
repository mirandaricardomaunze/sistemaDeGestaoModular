DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TargetType') THEN
    CREATE TYPE "TargetType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "sales_targets" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT,
  "warehouseId" TEXT,
  "type" "TargetType" NOT NULL DEFAULT 'MONTHLY',
  "value" DECIMAL(15,2) NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "companyId" TEXT,
  CONSTRAINT "sales_targets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sales_targets_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "sales_targets_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- AlterTable
ALTER TABLE "sales_targets" ADD COLUMN IF NOT EXISTS "warehouseId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sales_targets_companyId_idx" ON "sales_targets"("companyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sales_targets_employeeId_idx" ON "sales_targets"("employeeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sales_targets_warehouseId_idx" ON "sales_targets"("warehouseId");

-- AddForeignKey
ALTER TABLE "sales_targets"
  DROP CONSTRAINT IF EXISTS "sales_targets_warehouseId_fkey",
  ADD CONSTRAINT "sales_targets_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
