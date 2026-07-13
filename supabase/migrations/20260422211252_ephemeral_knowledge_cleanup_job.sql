-- 1. Enable pg_cron if not already enabled
create extension if not exists pg_cron with schema extensions;

-- 2. Create the cleanup function to be safe (idempotent)
create or replace function public.cleanup_ephemeral_knowledge()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    -- Delete chunks first to respect foreign key constraints
    delete from public.knowledge_chunks
    where widget_session_id is not null
      and created_at < now() - interval '24 hours';

    -- Delete sources
    delete from public.knowledge_sources
    where widget_session_id is not null
      and created_at < now() - interval '24 hours';
end;
$$;

-- 3. Schedule the job to run every night at midnight UTC
select cron.schedule(
    'cleanup-ephemeral-knowledge-task',
    '0 0 * * *',
    'select public.cleanup_ephemeral_knowledge()'
);
