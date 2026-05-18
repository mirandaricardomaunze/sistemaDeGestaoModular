-- AlterEnum: add 'debit_note' as a new ApprovalRequestType.
-- Using IF NOT EXISTS keeps the migration idempotent on partial replays.
ALTER TYPE "ApprovalRequestType" ADD VALUE IF NOT EXISTS 'debit_note';
