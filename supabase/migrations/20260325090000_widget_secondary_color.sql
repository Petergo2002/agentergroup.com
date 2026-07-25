-- Add the secondary Widget brand colour.
alter table if exists public.widgets
  add column if not exists secondary_color text;

update public.widgets
set secondary_color = coalesce(
  nullif(trim(secondary_color), ''),
  nullif(trim(primary_color), ''),
  '#ff5c00'
)
where secondary_color is null
   or trim(secondary_color) = '';

alter table if exists public.widgets
  alter column secondary_color set default '#ff5c00',
  alter column secondary_color set not null;
