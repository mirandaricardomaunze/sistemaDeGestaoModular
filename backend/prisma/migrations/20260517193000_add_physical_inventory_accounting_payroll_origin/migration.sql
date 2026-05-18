-- Physical inventory, accounting core, and payroll module tracking.

CREATE TYPE "PhysicalInventoryStatus" AS ENUM ('DRAFT', 'COUNTING', 'REVIEW', 'APPROVED', 'CANCELLED');
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE', 'COST_OF_GOODS');
CREATE TYPE "AccountNature" AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE "JournalEntryStatus" AS ENUM ('DRAFT', 'POSTED', 'VOID');

ALTER TABLE "payroll_records"
  ADD COLUMN IF NOT EXISTS "inssEmployer" DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "origin_module" TEXT NOT NULL DEFAULT 'hr';

CREATE INDEX IF NOT EXISTS "payroll_records_companyId_origin_module_idx"
  ON "payroll_records"("companyId", "origin_module");

CREATE TABLE IF NOT EXISTS "physical_inventories" (
  "id" TEXT NOT NULL,
  "companyId" TEXT,
  "warehouseId" TEXT NOT NULL,
  "status" "PhysicalInventoryStatus" NOT NULL DEFAULT 'DRAFT',
  "reference" TEXT NOT NULL,
  "notes" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "approvedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "physical_inventories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "physical_inventories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "physical_inventories_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "physical_inventories_companyId_reference_key"
  ON "physical_inventories"("companyId", "reference");
CREATE INDEX IF NOT EXISTS "physical_inventories_companyId_status_idx"
  ON "physical_inventories"("companyId", "status");
CREATE INDEX IF NOT EXISTS "physical_inventories_warehouseId_idx"
  ON "physical_inventories"("warehouseId");

CREATE TABLE IF NOT EXISTS "physical_inventory_lines" (
  "id" TEXT NOT NULL,
  "physicalInventoryId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "expectedQuantity" INTEGER NOT NULL,
  "countedQuantity" INTEGER NOT NULL DEFAULT 0,
  "difference" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  CONSTRAINT "physical_inventory_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "physical_inventory_lines_physicalInventoryId_fkey" FOREIGN KEY ("physicalInventoryId") REFERENCES "physical_inventories"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "physical_inventory_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "physical_inventory_lines_physicalInventoryId_productId_key"
  ON "physical_inventory_lines"("physicalInventoryId", "productId");
CREATE INDEX IF NOT EXISTS "physical_inventory_lines_productId_idx"
  ON "physical_inventory_lines"("productId");

CREATE TABLE IF NOT EXISTS "accounts" (
  "id" TEXT NOT NULL,
  "companyId" TEXT,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "AccountType" NOT NULL,
  "nature" "AccountNature" NOT NULL,
  "parentId" TEXT,
  "level" INTEGER NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "allowsEntries" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "accounts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "accounts_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "accounts_companyId_code_key" ON "accounts"("companyId", "code");
CREATE INDEX IF NOT EXISTS "accounts_companyId_type_idx" ON "accounts"("companyId", "type");
CREATE INDEX IF NOT EXISTS "accounts_parentId_idx" ON "accounts"("parentId");

CREATE TABLE IF NOT EXISTS "journal_entries" (
  "id" TEXT NOT NULL,
  "companyId" TEXT,
  "number" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "description" TEXT NOT NULL,
  "reference" TEXT,
  "status" "JournalEntryStatus" NOT NULL DEFAULT 'POSTED',
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "journal_entries_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "journal_entries_companyId_number_key" ON "journal_entries"("companyId", "number");
CREATE INDEX IF NOT EXISTS "journal_entries_companyId_date_idx" ON "journal_entries"("companyId", "date");
CREATE INDEX IF NOT EXISTS "journal_entries_status_idx" ON "journal_entries"("status");

CREATE TABLE IF NOT EXISTS "journal_lines" (
  "id" TEXT NOT NULL,
  "journalEntryId" TEXT NOT NULL,
  "debitAccountId" TEXT,
  "creditAccountId" TEXT,
  "amount" DECIMAL(15,2) NOT NULL,
  "description" TEXT,
  CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "journal_lines_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "journal_lines_debitAccountId_fkey" FOREIGN KEY ("debitAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "journal_lines_creditAccountId_fkey" FOREIGN KEY ("creditAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "journal_lines_journalEntryId_idx" ON "journal_lines"("journalEntryId");
CREATE INDEX IF NOT EXISTS "journal_lines_debitAccountId_idx" ON "journal_lines"("debitAccountId");
CREATE INDEX IF NOT EXISTS "journal_lines_creditAccountId_idx" ON "journal_lines"("creditAccountId");
