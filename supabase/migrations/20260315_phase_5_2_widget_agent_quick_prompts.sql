alter table public.widget_agents
  add column if not exists show_quick_actions boolean not null default true;

update public.widget_agents
set show_quick_actions = true
where show_quick_actions is distinct from true
  and show_quick_actions is null;
