-- Adds partial-payment tracking for supplier invoices.
-- Backfill: amount_due = total for existing rows so the invariant holds.

ALTER TYPE "SupplierInvoiceStatus" ADD VALUE 'partial' BEFORE 'paid';

ALTER TABLE "supplier_invoices"
    ADD COLUMN "amount_paid" DECIMAL(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN "amount_due"  DECIMAL(15,2) NOT NULL DEFAULT 0;

UPDATE "supplier_invoices"
SET "amount_due" = "total" - "amount_paid",
    "amount_paid" = CASE WHEN "status" = 'paid' THEN "total" ELSE 0 END
WHERE "amount_due" = 0;

UPDATE "supplier_invoices"
SET "amount_due" = GREATEST("total" - "amount_paid", 0);

CREATE TABLE "supplier_invoice_payments" (
    "id" TEXT NOT NULL,
    "supplier_invoice_id" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'transfer',
    "payment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "notes" TEXT,
    "created_by_user_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_invoice_payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "supplier_invoice_payments_supplier_invoice_id_idx" ON "supplier_invoice_payments"("supplier_invoice_id");
CREATE INDEX "supplier_invoice_payments_payment_date_idx" ON "supplier_invoice_payments"("payment_date");

ALTER TABLE "supplier_invoice_payments"
    ADD CONSTRAINT "supplier_invoice_payments_supplier_invoice_id_fkey"
    FOREIGN KEY ("supplier_invoice_id") REFERENCES "supplier_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
