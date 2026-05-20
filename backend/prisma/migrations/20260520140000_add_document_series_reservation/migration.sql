-- DocumentSeriesReservation: pre-allocated block of fiscal numbers per cash session.
-- Allows offline POS terminals to print receipts with valid sequential fiscal numbers
-- from the start (vs. provisional OFF-xxx that mismatch the eventual server-side number).
-- One block per session; unused numbers become gaps when the session closes (legally
-- acceptable in MZ provided audit trail is preserved — the `releasedAt` column records this).

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

CREATE UNIQUE INDEX "document_series_reservations_sessionId_key" ON "document_series_reservations"("sessionId");
CREATE INDEX "document_series_reservations_companyId_idx" ON "document_series_reservations"("companyId");
CREATE INDEX "document_series_reservations_seriesId_idx" ON "document_series_reservations"("seriesId");

ALTER TABLE "document_series_reservations"
    ADD CONSTRAINT "document_series_reservations_seriesId_fkey"
    FOREIGN KEY ("seriesId") REFERENCES "document_series"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "document_series_reservations"
    ADD CONSTRAINT "document_series_reservations_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "cash_sessions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
