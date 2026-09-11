-- Proactive teaser shown next to the closed launcher on the customer's site,
-- to draw attention to Website Chat before the visitor thinks to open it.
--
-- Kept deliberately short: it renders in a small bubble beside the launcher and
-- long copy either wraps badly or gets clipped on mobile.

alter table public.widgets
  add column if not exists proactive_message text,
  add column if not exists proactive_enabled boolean not null default false;

alter table public.widgets
  drop constraint if exists widgets_proactive_message_length;

alter table public.widgets
  add constraint widgets_proactive_message_length
  check (proactive_message is null or char_length(proactive_message) <= 140)
  not valid;

alter table public.widgets
  validate constraint widgets_proactive_message_length;

comment on column public.widgets.proactive_message is
  'Short attention message shown beside the closed launcher. Max 140 chars; rendered by loader.js on the host page.';

comment on column public.widgets.proactive_enabled is
  'Whether the proactive teaser is shown. The message is omitted from the public bootstrap payload when this is false.';
