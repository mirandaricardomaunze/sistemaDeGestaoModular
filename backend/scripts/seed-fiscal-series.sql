INSERT INTO document_series (id, code, name, prefix, series, "lastNumber", "isActive", "companyId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'FR-2026',
  'Faturas Recibo 2026',
  'FR',
  'A',
  200,
  true,
  'a7fbe6e7-f65f-4d09-9f76-97f6d0c00187',
  NOW(),
  NOW()
)
ON CONFLICT ("companyId", code) DO UPDATE
SET "lastNumber" = GREATEST(document_series."lastNumber", EXCLUDED."lastNumber"),
    "isActive"  = true,
    prefix      = 'FR',
    "updatedAt" = NOW();
