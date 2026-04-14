-- AlterTable: add restaurant fields to sales
ALTER TABLE "sales" ADD COLUMN "tableId" TEXT;
ALTER TABLE "sales" ADD COLUMN "origin_module" TEXT;

-- CreateIndex on sales
CREATE INDEX "sales_tableId_idx" ON "sales"("tableId");

-- CreateTable: restaurant_tables
CREATE TABLE "restaurant_tables" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "status" TEXT NOT NULL DEFAULT 'available',
    "section" TEXT,
    "notes" TEXT,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurant_tables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_tables_companyId_number_key" ON "restaurant_tables"("companyId", "number");
CREATE INDEX "restaurant_tables_companyId_idx" ON "restaurant_tables"("companyId");
CREATE INDEX "restaurant_tables_status_idx" ON "restaurant_tables"("status");

-- AddForeignKey
ALTER TABLE "restaurant_tables" ADD CONSTRAINT "restaurant_tables_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales" ADD CONSTRAINT "sales_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "restaurant_tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;
