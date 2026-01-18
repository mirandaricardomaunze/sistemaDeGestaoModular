-- Add LOGISTICS module to Miranda Comercial company
INSERT INTO company_modules ("id", "companyId", "moduleCode", "isActive", "createdAt")
VALUES (
    gen_random_uuid(),
    'd52ae58f-b6f9-4ded-9ed0-3a490aba86cd',
    'LOGISTICS',
    true,
    NOW()
)
ON CONFLICT ("companyId", "moduleCode") DO UPDATE
SET "isActive" = true;
