-- Idempotent safety net for runtime jobs/tables used by cron and POS offline flows.

CREATE TABLE IF NOT EXISTS "stock_reservations" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "sessionId" TEXT,
    "companyId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "stock_reservations"
    DROP CONSTRAINT IF EXISTS "stock_reservations_productId_fkey",
    ADD CONSTRAINT "stock_reservations_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "stock_reservations_productId_idx" ON "stock_reservations"("productId");
CREATE INDEX IF NOT EXISTS "stock_reservations_companyId_idx" ON "stock_reservations"("companyId");
CREATE INDEX IF NOT EXISTS "stock_reservations_expiresAt_idx" ON "stock_reservations"("expiresAt");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AttendeeStatus') THEN
        CREATE TYPE "AttendeeStatus" AS ENUM ('pending', 'accepted', 'declined');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS "calendar_events" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "module" TEXT,
    "color" TEXT,
    "recurrence" TEXT,
    "recurrenceEnd" TIMESTAMP(3),
    "notifyBefore" INTEGER,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "calendar_events"
    DROP CONSTRAINT IF EXISTS "calendar_events_companyId_fkey",
    ADD CONSTRAINT "calendar_events_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "calendar_events"
    DROP CONSTRAINT IF EXISTS "calendar_events_createdById_fkey",
    ADD CONSTRAINT "calendar_events_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "calendar_events_companyId_idx" ON "calendar_events"("companyId");
CREATE INDEX IF NOT EXISTS "calendar_events_startAt_idx" ON "calendar_events"("startAt");

CREATE TABLE IF NOT EXISTS "calendar_attendees" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AttendeeStatus" NOT NULL DEFAULT 'pending',
    CONSTRAINT "calendar_attendees_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "calendar_attendees"
    DROP CONSTRAINT IF EXISTS "calendar_attendees_eventId_fkey",
    ADD CONSTRAINT "calendar_attendees_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "calendar_events"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "calendar_attendees"
    DROP CONSTRAINT IF EXISTS "calendar_attendees_userId_fkey",
    ADD CONSTRAINT "calendar_attendees_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "calendar_attendees_eventId_userId_key" ON "calendar_attendees"("eventId", "userId");
