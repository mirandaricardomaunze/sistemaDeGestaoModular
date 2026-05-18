DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StaffCategory') THEN
    CREATE TYPE "StaffCategory" AS ENUM ('driver', 'mechanic', 'warehouse', 'manager', 'admin', 'other');
  END IF;
END $$;

ALTER TABLE "employees"
  ADD COLUMN IF NOT EXISTS "notes" TEXT;

ALTER TABLE "drivers"
  ADD COLUMN IF NOT EXISTS "category" "StaffCategory" NOT NULL DEFAULT 'driver',
  ADD COLUMN IF NOT EXISTS "medicalExamExpiry" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "safetyTrainingDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "baseSalary" DECIMAL(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "subsidyTransport" DECIMAL(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "subsidyFood" DECIMAL(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "commissionRate" DECIMAL(5, 2),
  ADD COLUMN IF NOT EXISTS "bankName" TEXT,
  ADD COLUMN IF NOT EXISTS "bankAccountNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "bankNib" TEXT,
  ADD COLUMN IF NOT EXISTS "socialSecurityNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "nuit" TEXT,
  ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3);
