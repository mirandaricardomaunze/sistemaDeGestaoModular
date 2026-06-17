-- CreateEnum
CREATE TYPE "DeliveryKind" AS ENUM ('shipment', 'warehouse_transfer');

-- AlterTable
ALTER TABLE "deliveries" ADD COLUMN     "kind" "DeliveryKind" NOT NULL DEFAULT 'shipment',
ADD COLUMN     "transferId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_transferId_key" ON "deliveries"("transferId");

-- CreateIndex
CREATE INDEX "deliveries_transferId_idx" ON "deliveries"("transferId");

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "stock_transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
