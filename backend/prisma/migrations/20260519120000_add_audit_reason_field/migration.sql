-- AuditLog: add explicit `reason` column so motivos deixam de ficar embebidos em newData JSON.
-- Tornar pesquisável (LIKE/ILIKE) o motivo de anulações, alterações fiscais, rejeições, etc.
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "reason" TEXT;
