-- Add template_variables column to agent_library_templates
-- Stores the parsed variable metadata as JSON array
-- Format: [{ "key": "company_name", "label": "Company Name", "description": "..." }]
-- This column is optional — if empty, template imports as-is with no setup step

alter table public.agent_library_templates
  add column if not exists template_variables jsonb not null default '[]'::jsonb;
