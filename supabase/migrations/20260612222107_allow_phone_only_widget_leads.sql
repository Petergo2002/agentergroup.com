set lock_timeout = '5s';

alter table public.widget_leads
  alter column email drop not null;

alter table public.widget_leads
  add constraint widget_leads_contact_required
  check (
    nullif(btrim(email), '') is not null
    or nullif(btrim(phone), '') is not null
  ) not valid;

alter table public.widget_leads
  validate constraint widget_leads_contact_required;
