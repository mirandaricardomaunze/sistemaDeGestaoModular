-- DocumentSeriesReservation: pre-allocated block of fiscal numbers per cash session.
-- Allows offline POS terminals to print receipts with valid sequential fiscal numbers
-- from the start (vs. provisional OFF-xxx that mismatch the eventual server-side number).
-- One block per session; unused numbers become gaps when the session closes (legally
-- acceptable in MZ provided audit trail is preserved — the `releasedAt` column records this).

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CashSessionStatus') THEN
        CREATE TYPE "CashSessionStatus" AS ENUM ('open', 'closed', 'suspended');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS "cash_sessions" (
    "id" TEXT NOT NULL,
    "opened_by_id" TEXT NOT NULL,
    "closed_by_id" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "openingBalance" DECIMAL(15,2) NOT NULL,
    "closingBalance" DECIMAL(15,2),
    "expectedBalance" DECIMAL(15,2),
    "difference" DECIMAL(15,2),
    "cashSales" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "mpesaSales" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "emolaSales" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cardSales" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "creditSales" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalSales" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "withdrawals" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "deposits" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "status" "CashSessionStatus" NOT NULL DEFAULT 'open',
    "companyId" TEXT,
    "terminal_id" TEXT,
    "warehouse_id" TEXT,
    CONSTRAINT "cash_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cash_sessions_opened_by_id_fkey" FOREIGN KEY ("opened_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cash_sessions_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cash_sessions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cash_sessions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "cash_sessions_companyId_idx" ON "cash_sessions"("companyId");
CREATE INDEX IF NOT EXISTS "cash_sessions_status_idx" ON "cash_sessions"("status");

CREATE TABLE IF NOT EXISTS "cash_movements" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "performed_by_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cash_movements_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "cash_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cash_movements_performed_by_id_fkey" FOREIGN KEY ("performed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "cash_movements_session_id_idx" ON "cash_movements"("session_id");

CREATE TABLE IF NOT EXISTS "document_series_reservations" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fromNumber" INTEGER NOT NULL,
    "toNumber" INTEGER NOT NULL,
    "nextNumber" INTEGER NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_series_reservations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "document_series_reservations_sessionId_key" ON "document_series_reservations"("sessionId");
CREATE INDEX IF NOT EXISTS "document_series_reservations_companyId_idx" ON "document_series_reservations"("companyId");
CREATE INDEX IF NOT EXISTS "document_series_reservations_seriesId_idx" ON "document_series_reservations"("seriesId");

ALTER TABLE "document_series_reservations"
    DROP CONSTRAINT IF EXISTS "document_series_reservations_seriesId_fkey",
    ADD CONSTRAINT "document_series_reservations_seriesId_fkey"
    FOREIGN KEY ("seriesId") REFERENCES "document_series"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "document_series_reservations"
    DROP CONSTRAINT IF EXISTS "document_series_reservations_sessionId_fkey",
    ADD CONSTRAINT "document_series_reservations_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "cash_sessions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
