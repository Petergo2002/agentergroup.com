-- Add timezone column to agents table
ALTER TABLE public.agents 
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';
