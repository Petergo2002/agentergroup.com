-- Add the Agent timezone column.
ALTER TABLE public.agents 
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';  
