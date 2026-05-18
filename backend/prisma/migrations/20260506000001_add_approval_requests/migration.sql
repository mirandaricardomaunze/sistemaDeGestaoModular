-- CreateEnum
CREATE TYPE "ApprovalRequestType" AS ENUM (
    'discount_override',
    'cash_drop',
    'credit_note',
    'stock_adjustment',
    'purchase_order',
    'supplier_payment',
    'price_change',
    'payroll_release',
    'bonus_release',
    'warehouse_transfer',
    'invoice_cancel',
    'fiscal_period_reopen'
);

-- CreateEnum
CREATE TYPE "ApprovalRequestStatus" AS ENUM (
    'pending',
    'approved',
    'rejected',
    'expired',
    'cancelled'
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "requestType" "ApprovalRequestType" NOT NULL,
    "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'pending',
    "resourceType" TEXT,
    "resourceId" TEXT,
    "amount" DECIMAL(15, 2),
    "reason" TEXT NOT NULL,
    "payload" JSONB,
    "decisionNotes" TEXT,
    "requestedByUserId" TEXT NOT NULL,
    "requestedByName" TEXT,
    "decidedByUserId" TEXT,
    "decidedByName" TEXT,
    "decidedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "approval_requests_companyId_status_idx" ON "approval_requests"("companyId", "status");

-- CreateIndex
CREATE INDEX "approval_requests_companyId_requestType_status_idx" ON "approval_requests"("companyId", "requestType", "status");

-- CreateIndex
CREATE INDEX "approval_requests_companyId_createdAt_idx" ON "approval_requests"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "approval_requests_resourceType_resourceId_idx" ON "approval_requests"("resourceType", "resourceId");

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "company_settings" ADD COLUMN "approvalThresholds" JSONB;
