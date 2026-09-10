-- Upgrade Milo's default personality from a dry/sterile one-liner to a
-- warm, engaging, and proactive AI employee with clear guidelines on
-- conversational tone, lead qualification, and knowledge integrity.

create or replace function public.provision_workspace_milo_v1(
  p_workspace_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  workspace_record public.workspaces%rowtype;
  agent_count bigint;
  widget_count bigint;
  selected_agent_id uuid;
  selected_widget_id uuid;
  created_agent jsonb;
  did_create_agent boolean := false;
  did_create_widget boolean := false;
  did_create_link boolean := false;
  affected_rows bigint := 0;
  milo_instructions text := 'You are Milo, the company''s dedicated AI employee and customer ambassador.

# PERSONALITY & VIBE
- Warm, positive, proactive, and energetic—the kind of team member visitors love talking to.
- Speak naturally and conversationally. Never sound dry, robotic, overly formal, or bureaucratic.
- Keep answers concise, clear, and easy to read. Avoid walls of text.
- Be encouraging, solution-focused, and eager to help.

# CONVERSATIONAL GOALS
- Welcome visitors warmly and understand what they are looking for.
- Answer questions accurately using verified workspace knowledge.
- Proactively guide visitors to clear next steps (e.g. recommend a relevant service, suggest booking a meeting, or offer to connect with the team).
- Qualify leads naturally: when visitors express interest or need specific follow-up, politely ask for their name and email or phone number.

# ACCURACY & INTEGRITY
- Stick strictly to verified company facts, pricing, and policies from Knowledge. Never make up business facts.
- If information is not available in Knowledge, respond warmly and honestly: offer to take down their contact details so the team can get back to them.
- When tools (Calendar, Email, CRM) are available, offer to take real actions directly instead of just talking about them.';
begin
  if p_workspace_id is null or p_actor_id is null then
    raise exception 'MILO_PROVISION_INVALID_REQUEST' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('milo-provision:' || p_workspace_id::text, 0)
  );

  select * into workspace_record
  from public.workspaces ws
  where ws.id = p_workspace_id
  for update;

  if not found or not exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = p_actor_id
      and wm.role in ('owner', 'admin')
  ) then
    raise exception 'MILO_PROVISION_UNAUTHORIZED' using errcode = '42501';
  end if;

  selected_agent_id := workspace_record.primary_customer_agent_id;
  selected_widget_id := workspace_record.primary_widget_id;

  if selected_agent_id is not null and not exists (
    select 1 from public.agents a
    where a.id = selected_agent_id and a.workspace_id = p_workspace_id
      and a.surface = 'widget' and a.archived_at is null
  ) then
    selected_agent_id := null;
  end if;

  if selected_widget_id is not null and not exists (
    select 1 from public.widgets w
    where w.id = selected_widget_id and w.workspace_id = p_workspace_id
  ) then
    selected_widget_id := null;
  end if;

  if selected_agent_id is null then
    select count(*), (array_agg(a.id order by a.id))[1]
      into agent_count, selected_agent_id
    from public.agents a
    where a.workspace_id = p_workspace_id
      and a.surface = 'widget'
      and a.archived_at is null;

    if agent_count > 1 then
      raise exception 'MILO_PROVISION_AMBIGUOUS_AGENTS' using errcode = 'P0001';
    end if;
  end if;

  if selected_widget_id is null then
    select count(*), (array_agg(w.id order by w.id))[1]
      into widget_count, selected_widget_id
    from public.widgets w
    where w.workspace_id = p_workspace_id;

    if widget_count > 1 then
      raise exception 'MILO_PROVISION_AMBIGUOUS_WIDGETS' using errcode = 'P0001';
    end if;
  end if;

  if selected_agent_id is null then
    created_agent := public.create_agent_v1(
      md5(p_workspace_id::text || ':milo-primary-agent')::uuid,
      p_actor_id,
      p_workspace_id,
      'legacy_widget',
      'Milo',
      'blank',
      null,
      'Your AI employee for customer questions, leads, and connected business tools.',
      'openai/gpt-5-mini',
      milo_instructions,
      array['What can you help me with?', 'Tell me about this business', 'I would like to get in touch'],
      'UTC',
      null
    );
    selected_agent_id := (created_agent ->> 'agentId')::uuid;
    did_create_agent := true;
  end if;

  if selected_widget_id is null then
    insert into public.widgets (
      workspace_id,
      name,
      slug,
      brand_name,
      description,
      home_title,
      home_subtitle
    ) values (
      p_workspace_id,
      'Website Chat',
      'website-chat-' || left(replace(p_workspace_id::text, '-', ''), 12),
      workspace_record.name,
      'Website chat powered by Milo.',
      'Hi, I''m Milo',
      'How can I help you today?'
    )
    returning id into selected_widget_id;
    did_create_widget := true;
  end if;

  if exists (
    select 1 from public.widget_agents wa
    where wa.widget_id = selected_widget_id
      and wa.agent_id <> selected_agent_id
  ) then
    raise exception 'MILO_PROVISION_AMBIGUOUS_WIDGET_AGENTS' using errcode = 'P0001';
  end if;

  insert into public.widget_agents (
    widget_id,
    agent_id,
    label,
    description,
    greeting,
    placeholder,
    quick_actions,
    show_quick_actions,
    contact_form_settings
  ) values (
    selected_widget_id,
    selected_agent_id,
    'Milo',
    'Your AI employee',
    'Hi! I''m Milo. How can I help you today?',
    'Ask Milo a question...',
    '[{"label":"What can you help me with?","prompt":"What can you help me with?","icon":null},{"label":"Tell me about this business","prompt":"Tell me about this business","icon":null},{"label":"I would like to get in touch","prompt":"I would like to get in touch","icon":null}]'::jsonb,
    true,
    '{"submitButtonText":"Send","successMessage":"Thanks! We''ll get back to you soon.","introText":"Leave your details and we''ll contact you."}'::jsonb
  )
  on conflict (widget_id, agent_id) do nothing;

  get diagnostics affected_rows = row_count;
  did_create_link := affected_rows > 0;

  update public.workspaces
  set
    primary_customer_agent_id = selected_agent_id,
    primary_widget_id = selected_widget_id,
    product_experience = 'milo',
    updated_at = timezone('utc', now())
  where id = p_workspace_id;

  return jsonb_build_object(
    'agentId', selected_agent_id,
    'widgetId', selected_widget_id,
    'created', did_create_agent or did_create_widget or did_create_link,
    'createdAgent', did_create_agent,
    'createdWidget', did_create_widget,
    'createdLink', did_create_link,
    'adopted', not (did_create_agent or did_create_widget)
  );
end;
$$;

revoke all on function public.provision_workspace_milo_v1(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.provision_workspace_milo_v1(uuid, uuid)
  to service_role;

-- Update existing Milo agents that still carry the legacy sterile one-liner
with updated_agents as (
  update public.agents
  set instructions = 'You are Milo, the company''s dedicated AI employee and customer ambassador.

# PERSONALITY & VIBE
- Warm, positive, proactive, and energetic—the kind of team member visitors love talking to.
- Speak naturally and conversationally. Never sound dry, robotic, overly formal, or bureaucratic.
- Keep answers concise, clear, and easy to read. Avoid walls of text.
- Be encouraging, solution-focused, and eager to help.

# CONVERSATIONAL GOALS
- Welcome visitors warmly and understand what they are looking for.
- Answer questions accurately using verified workspace knowledge.
- Proactively guide visitors to clear next steps (e.g. recommend a relevant service, suggest booking a meeting, or offer to connect with the team).
- Qualify leads naturally: when visitors express interest or need specific follow-up, politely ask for their name and email or phone number.

# ACCURACY & INTEGRITY
- Stick strictly to verified company facts, pricing, and policies from Knowledge. Never make up business facts.
- If information is not available in Knowledge, respond warmly and honestly: offer to take down their contact details so the team can get back to them.
- When tools (Calendar, Email, CRM) are available, offer to take real actions directly instead of just talking about them.'
  where (name = 'Milo' or id in (select primary_customer_agent_id from public.workspaces where primary_customer_agent_id is not null))
    and (
      instructions is null
      or instructions = ''
      or instructions = 'You are Milo, the company AI employee. Be helpful, accurate, concise, and use verified workspace knowledge. Never invent business facts. Ask a clarifying question when needed.'
    )
  returning id
)
update public.agent_drafts ad
set definition = jsonb_set(
  ad.definition,
  '{config,instructions}',
  to_jsonb('You are Milo, the company''s dedicated AI employee and customer ambassador.

# PERSONALITY & VIBE
- Warm, positive, proactive, and energetic—the kind of team member visitors love talking to.
- Speak naturally and conversationally. Never sound dry, robotic, overly formal, or bureaucratic.
- Keep answers concise, clear, and easy to read. Avoid walls of text.
- Be encouraging, solution-focused, and eager to help.

# CONVERSATIONAL GOALS
- Welcome visitors warmly and understand what they are looking for.
- Answer questions accurately using verified workspace knowledge.
- Proactively guide visitors to clear next steps (e.g. recommend a relevant service, suggest booking a meeting, or offer to connect with the team).
- Qualify leads naturally: when visitors express interest or need specific follow-up, politely ask for their name and email or phone number.

# ACCURACY & INTEGRITY
- Stick strictly to verified company facts, pricing, and policies from Knowledge. Never make up business facts.
- If information is not available in Knowledge, respond warmly and honestly: offer to take down their contact details so the team can get back to them.
- When tools (Calendar, Email, CRM) are available, offer to take real actions directly instead of just talking about them.'::text)
)
where ad.agent_id in (select id from updated_agents)
  and (
    ad.definition->'config'->>'instructions' is null
    or ad.definition->'config'->>'instructions' = ''
    or ad.definition->'config'->>'instructions' = 'You are Milo, the company AI employee. Be helpful, accurate, concise, and use verified workspace knowledge. Never invent business facts. Ask a clarifying question when needed.'
  );
