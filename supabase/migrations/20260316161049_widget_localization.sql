-- Alter widgets table to add language and home text customization
ALTER TABLE public.widgets 
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS home_title TEXT,
  ADD COLUMN IF NOT EXISTS home_subtitle TEXT;