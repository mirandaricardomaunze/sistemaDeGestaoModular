-- Spec: docs/specs/2026-06-01-fefo-batch-selection.md
-- Adds the opt-in flag for automatic FEFO batch selection on commercial sales.
-- Default 'none' preserves existing behaviour for every company.

ALTER TABLE "company_settings"
    ADD COLUMN "batch_selection_mode" TEXT NOT NULL DEFAULT 'none';
