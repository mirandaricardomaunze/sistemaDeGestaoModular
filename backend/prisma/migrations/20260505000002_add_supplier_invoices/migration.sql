-- Supplier invoices create the fiscal purchase document used for deductible IVA.
CREATE TYPE "SupplierInvoiceStatus" AS ENUM ('registered', 'paid', 'cancelled');

CREATE TABLE "supplier_invoices" (
    "id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "purchase_order_id" TEXT,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "tax" DECIMAL(15,2) NOT NULL,
    "total" DECIMAL(15,2) NOT NULL,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 16,
    "status" "SupplierInvoiceStatus" NOT NULL DEFAULT 'registered',
    "issue_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" TEXT,
    "created_by_user_id" TEXT,

    CONSTRAINT "supplier_invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supplier_invoice_items" (
    "id" TEXT NOT NULL,
    "supplier_invoice_id" TEXT NOT NULL,
    "purchase_order_item_id" TEXT,
    "productId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cost" DECIMAL(15,2) NOT NULL,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 16,
    "tax_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_invoice_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "supplier_invoices_companyId_invoice_number_key" ON "supplier_invoices"("companyId", "invoice_number");
CREATE INDEX "supplier_invoices_companyId_idx" ON "supplier_invoices"("companyId");
CREATE INDEX "supplier_invoices_supplierId_idx" ON "supplier_invoices"("supplierId");
CREATE INDEX "supplier_invoices_purchase_order_id_idx" ON "supplier_invoices"("purchase_order_id");
CREATE INDEX "supplier_invoices_companyId_issue_date_idx" ON "supplier_invoices"("companyId", "issue_date");
CREATE INDEX "supplier_invoice_items_supplier_invoice_id_idx" ON "supplier_invoice_items"("supplier_invoice_id");
CREATE INDEX "supplier_invoice_items_purchase_order_item_id_idx" ON "supplier_invoice_items"("purchase_order_item_id");
CREATE INDEX "supplier_invoice_items_productId_idx" ON "supplier_invoice_items"("productId");

ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "supplier_invoice_items" ADD CONSTRAINT "supplier_invoice_items_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "supplier_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_invoice_items" ADD CONSTRAINT "supplier_invoice_items_purchase_order_item_id_fkey" FOREIGN KEY ("purchase_order_item_id") REFERENCES "purchase_order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "supplier_invoice_items" ADD CONSTRAINT "supplier_invoice_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
