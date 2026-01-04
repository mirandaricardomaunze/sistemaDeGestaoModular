-- AlterTable
ALTER TABLE "housekeeping_tasks" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "bookingId" TEXT,
ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "module" TEXT,
ADD COLUMN     "roomId" TEXT;

-- CreateIndex
CREATE INDEX "housekeeping_tasks_companyId_idx" ON "housekeeping_tasks"("companyId");

-- CreateIndex
CREATE INDEX "transactions_companyId_idx" ON "transactions"("companyId");

-- CreateIndex
CREATE INDEX "transactions_bookingId_idx" ON "transactions"("bookingId");

-- CreateIndex
CREATE INDEX "transactions_module_idx" ON "transactions"("module");

-- CreateIndex
CREATE INDEX "transactions_type_idx" ON "transactions"("type");

-- CreateIndex
CREATE INDEX "transactions_date_idx" ON "transactions"("date");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
