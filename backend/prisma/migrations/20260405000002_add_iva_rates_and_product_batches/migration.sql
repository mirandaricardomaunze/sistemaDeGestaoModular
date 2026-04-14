-- ============================================================================
-- IVA RATES TABLE
-- ============================================================================
CREATE TABLE "iva_rates" (
    "id"                    TEXT NOT NULL,
    "code"                  TEXT NOT NULL,
    "name"                  TEXT NOT NULL,
    "description"           TEXT,
    "rate"                  DECIMAL(5,2) NOT NULL,
    "is_default"            BOOLEAN NOT NULL DEFAULT false,
    "applicable_categories" TEXT[] NOT NULL DEFAULT '{}',
    "is_active"             BOOLEAN NOT NULL DEFAULT true,
    "effective_from"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to"          TIMESTAMP(3),
    "companyId"             TEXT NOT NULL,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL,

    CONSTRAINT "iva_rates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "iva_rates_companyId_code_key"  ON "iva_rates"("companyId", "code");
CREATE INDEX        "iva_rates_companyId_idx"        ON "iva_rates"("companyId");
CREATE INDEX        "iva_rates_is_active_idx"        ON "iva_rates"("is_active");

ALTER TABLE "iva_rates"
    ADD CONSTRAINT "iva_rates_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- PRODUCT BATCHES TABLE (Lotes / Validade)
-- ============================================================================
CREATE TABLE "product_batches" (
    "id"               TEXT NOT NULL,
    "batch_number"     TEXT NOT NULL,
    "productId"        TEXT NOT NULL,
    "companyId"        TEXT NOT NULL,
    "supplierId"       TEXT,
    "warehouseId"      TEXT,
    "initial_quantity" INTEGER NOT NULL DEFAULT 0,
    "quantity"         INTEGER NOT NULL DEFAULT 0,
    "cost_price"       DECIMAL(15,2) NOT NULL DEFAULT 0,
    "manufacture_date" TIMESTAMP(3),
    "received_date"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiry_date"      TIMESTAMP(3),
    "status"           TEXT NOT NULL DEFAULT 'active',
    "notes"            TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_batches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_batches_companyId_batch_number_key"   ON "product_batches"("companyId", "batch_number");
CREATE INDEX        "product_batches_productId_idx"                 ON "product_batches"("productId");
CREATE INDEX        "product_batches_companyId_idx"                 ON "product_batches"("companyId");
CREATE INDEX        "product_batches_status_idx"                    ON "product_batches"("status");
CREATE INDEX        "product_batches_expiry_date_idx"               ON "product_batches"("expiry_date");

ALTER TABLE "product_batches"
    ADD CONSTRAINT "product_batches_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_batches"
    ADD CONSTRAINT "product_batches_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_batches"
    ADD CONSTRAINT "product_batches_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "product_batches"
    ADD CONSTRAINT "product_batches_warehouseId_fkey"
    FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- ALTER PRODUCTS: add ivaRateId + taxRate override
-- ============================================================================
ALTER TABLE "products"
    ADD COLUMN "iva_rate_id" TEXT,
    ADD COLUMN "tax_rate"    DECIMAL(5,2);

CREATE INDEX "products_iva_rate_id_idx" ON "products"("iva_rate_id");

ALTER TABLE "products"
    ADD CONSTRAINT "products_iva_rate_id_fkey"
    FOREIGN KEY ("iva_rate_id") REFERENCES "iva_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- ALTER SALE_ITEMS: add batchId + ivaAmount
-- ============================================================================
ALTER TABLE "sale_items"
    ADD COLUMN "batch_id"   TEXT,
    ADD COLUMN "iva_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN "iva_rate"   DECIMAL(5,2)  NOT NULL DEFAULT 0;

CREATE INDEX "sale_items_batch_id_idx" ON "sale_items"("batch_id");

ALTER TABLE "sale_items"
    ADD CONSTRAINT "sale_items_batch_id_fkey"
    FOREIGN KEY ("batch_id") REFERENCES "product_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- ALTER INVOICE_ITEMS: add ivaRateId + ivaAmount
-- ============================================================================
ALTER TABLE "invoice_items"
    ADD COLUMN "iva_rate_id" TEXT,
    ADD COLUMN "iva_amount"  DECIMAL(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN "iva_rate"    DECIMAL(5,2)  NOT NULL DEFAULT 0;

ALTER TABLE "invoice_items"
    ADD CONSTRAINT "invoice_items_iva_rate_id_fkey"
    FOREIGN KEY ("iva_rate_id") REFERENCES "iva_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
