ALTER TABLE "company_modules" ADD COLUMN IF NOT EXISTS "moduleCode" TEXT;

UPDATE "company_modules" AS cm
SET "moduleCode" = COALESCE(m."code", cm."moduleId")
FROM "modules" AS m
WHERE cm."moduleId" = m."id"
  AND (cm."moduleCode" IS NULL OR cm."moduleCode" = '');

UPDATE "company_modules"
SET "moduleCode" = "moduleId"
WHERE "moduleCode" IS NULL OR "moduleCode" = '';

ALTER TABLE "company_modules" ALTER COLUMN "moduleId" DROP NOT NULL;
ALTER TABLE "company_modules" ALTER COLUMN "moduleCode" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "company_modules_companyId_moduleCode_key"
ON "company_modules"("companyId", "moduleCode");
