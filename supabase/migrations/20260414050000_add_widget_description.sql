-- Add description column to widgets table
ALTER TABLE public.widgets ADD COLUMN description text NOT NULL DEFAULT '';
