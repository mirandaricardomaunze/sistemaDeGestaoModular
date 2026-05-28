-- Runtime tables present in the Prisma schema but missing from older baselines.

CREATE TABLE IF NOT EXISTS "stock_reservations" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "sessionId" TEXT,
    "companyId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stock_reservations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "stock_reservations_productId_idx" ON "stock_reservations"("productId");
CREATE INDEX IF NOT EXISTS "stock_reservations_companyId_idx" ON "stock_reservations"("companyId");
CREATE INDEX IF NOT EXISTS "stock_reservations_expiresAt_idx" ON "stock_reservations"("expiresAt");
