-- ============================================================
-- Migration: connections_one_per_toolkit
-- Date: 2026-05-07
-- Purpose: Enforce one connected account per toolkit per workspace.
--
-- Previously the unique constraint was on (workspace_id, toolkit_slug, account_label),
-- which allowed multiple accounts per toolkit if they had different labels.
-- We now enforce a single connection per toolkit per workspace so the UI can
-- display it as a read-only card rather than a dropdown selector.
--
-- Steps:
--   1. Delete any duplicate rows, keeping only the best one
--      (prefer status='connected', then latest created_at).
--   2. Drop the old constraint.
--   3. Add the new tighter constraint.
-- ============================================================

-- Step 1: Remove duplicate connections per (workspace_id, toolkit_slug),
-- keeping the row with the highest-priority status and latest created_at.
DELETE FROM connections
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY workspace_id, toolkit_slug
        ORDER BY
          -- Prefer connected > pending > error > disconnected
          CASE status
            WHEN 'connected'    THEN 1
            WHEN 'pending'      THEN 2
            WHEN 'error'        THEN 3
            WHEN 'disconnected' THEN 4
            ELSE 5
          END ASC,
          created_at DESC
      ) AS rn
    FROM connections
  ) ranked
  WHERE rn > 1
);

-- Step 2: Drop the old unique constraint.
-- The exact constraint name depends on your Supabase project.
-- Try the most common auto-generated name first; if it fails, check with:
--   SELECT conname FROM pg_constraint WHERE conrelid = 'connections'::regclass;
ALTER TABLE connections
  DROP CONSTRAINT IF EXISTS connections_workspace_id_toolkit_slug_account_label_key;

-- Also drop any index that might enforce the old constraint under a different name.
DROP INDEX IF EXISTS connections_workspace_id_toolkit_slug_account_label_key;

-- Step 3: Add the new one-per-toolkit unique constraint.
ALTER TABLE connections
  ADD CONSTRAINT connections_workspace_id_toolkit_slug_key
  UNIQUE (workspace_id, toolkit_slug);
