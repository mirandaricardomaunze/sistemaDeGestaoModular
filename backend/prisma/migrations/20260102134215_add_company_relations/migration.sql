-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'super_admin';

-- AlterTable
ALTER TABLE "alerts" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "customer_orders" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "stock_transfers" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "tax_configs" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "warehouses" ADD COLUMN     "companyId" TEXT;

-- CreateIndex
CREATE INDEX "alerts_companyId_idx" ON "alerts"("companyId");

-- CreateIndex
CREATE INDEX "audit_logs_companyId_idx" ON "audit_logs"("companyId");

-- CreateIndex
CREATE INDEX "customer_orders_companyId_idx" ON "customer_orders"("companyId");

-- CreateIndex
CREATE INDEX "customers_companyId_idx" ON "customers"("companyId");

-- CreateIndex
CREATE INDEX "invoices_companyId_idx" ON "invoices"("companyId");

-- CreateIndex
CREATE INDEX "sales_companyId_idx" ON "sales"("companyId");

-- CreateIndex
CREATE INDEX "stock_transfers_companyId_idx" ON "stock_transfers"("companyId");

-- CreateIndex
CREATE INDEX "tax_configs_companyId_idx" ON "tax_configs"("companyId");

-- CreateIndex
CREATE INDEX "warehouses_companyId_idx" ON "warehouses"("companyId");

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_orders" ADD CONSTRAINT "customer_orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_configs" ADD CONSTRAINT "tax_configs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
