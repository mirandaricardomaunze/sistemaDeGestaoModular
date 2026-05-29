-- Align the users table with the current Prisma User model.
ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "otpAttempts" INTEGER NOT NULL DEFAULT 0;
