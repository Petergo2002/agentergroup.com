-- ============================================================
-- Migration: automations_feature_flag
-- Date: 2026-05-07
-- Purpose: Add automations_enabled column to workspaces.
--          Defaults to false — automation agents are hidden from
--          all workspaces until an admin explicitly enables them.
-- ============================================================

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS automations_enabled boolean NOT NULL DEFAULT false;
