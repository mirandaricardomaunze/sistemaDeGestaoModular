-- AlterTable
ALTER TABLE "sales_targets" ADD COLUMN "warehouseId" TEXT;

-- CreateIndex
CREATE INDEX "sales_targets_warehouseId_idx" ON "sales_targets"("warehouseId");

-- AddForeignKey
ALTER TABLE "sales_targets" ADD CONSTRAINT "sales_targets_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
