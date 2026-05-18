-- ============================================================================
-- Enterprise order cancellation workflow.
-- Adds auditable cancellation requests, approval decisions and richer statuses.
-- ============================================================================

ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'cancellation_requested';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'cancellation_rejected';

CREATE TYPE "OrderCancellationStatus" AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE "order_cancellation_requests" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "originalStatus" "OrderStatus" NOT NULL,
    "status" "OrderCancellationStatus" NOT NULL DEFAULT 'pending',
    "reason" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL DEFAULT 'standard',
    "requiresCreditNote" BOOLEAN NOT NULL DEFAULT false,
    "invoiceId" TEXT,
    "creditNoteId" TEXT,
    "requestedByUserId" TEXT,
    "requestedByName" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedByUserId" TEXT,
    "decidedByName" TEXT,
    "decisionNotes" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT,

    CONSTRAINT "order_cancellation_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_cancellation_requests_companyId_idx" ON "order_cancellation_requests"("companyId");
CREATE INDEX "order_cancellation_requests_orderId_idx" ON "order_cancellation_requests"("orderId");
CREATE INDEX "order_cancellation_requests_status_idx" ON "order_cancellation_requests"("status");
CREATE INDEX "order_cancellation_requests_requestedAt_idx" ON "order_cancellation_requests"("requestedAt");

ALTER TABLE "order_cancellation_requests"
    ADD CONSTRAINT "order_cancellation_requests_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "order_cancellation_requests"
    ADD CONSTRAINT "order_cancellation_requests_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "customer_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
