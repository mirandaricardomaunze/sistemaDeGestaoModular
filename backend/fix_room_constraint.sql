ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS rooms_number_companyId_key ON rooms(number, "companyId");
