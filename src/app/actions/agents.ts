'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { ensureWorkspaceContext } from '@/lib/app/bootstrap';
import { createClient } from '@/lib/supabase/server';

export async function createAgentAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Unauthorized' };
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const admin = createAdminClient();

  const requestedName = (formData.get('name') as string)?.trim() || 'Untitled Agent';
  const description = (formData.get('description') as string)?.trim() || '';

  const { data: agent, error } = await admin
    .from('agents')
    .insert({
      name: requestedName,
      description,
      status: 'draft',
      workspace_id: context.workspace.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/agents');

  return { agent };
}

export async function updateAgentAction(
  agentId: string,
  updates: Record<string, unknown>,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Unauthorized' };
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const admin = createAdminClient();

  const { error } = await admin
    .from('agents')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', agentId)
    .eq('workspace_id', context.workspace.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/agents/${agentId}`);
  revalidatePath('/agents');

  return { success: true };
}

export async function deleteAgentAction(agentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Unauthorized' };
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const admin = createAdminClient();

  await admin.from('agent_connections').delete().eq('agent_id', agentId);
  await admin.from('knowledge_sources').delete().eq('agent_id', agentId);
  await admin.from('widget_agents').delete().eq('agent_id', agentId);

  const { error } = await admin
    .from('agents')
    .delete()
    .eq('id', agentId)
    .eq('workspace_id', context.workspace.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/agents');

  return { success: true };
}

export async function toggleAgentStatusAction(agentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Unauthorized' };
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const admin = createAdminClient();

  const { data: agent } = await admin
    .from('agents')
    .select('status')
    .eq('id', agentId)
    .single();

  const statusMap: Record<string, string> = {
    draft: 'active',
    active: 'paused',
    paused: 'active',
  };

  const newStatus = statusMap[agent?.status ?? 'draft'] || 'active';

  const { error } = await admin
    .from('agents')
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', agentId)
    .eq('workspace_id', context.workspace.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/agents');
  revalidatePath(`/agents/${agentId}`);

  return { success: true, newStatus };
}

export async function archiveAgentAction(agentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Unauthorized' };
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const admin = createAdminClient();

  const { error } = await admin
    .from('agents')
    .update({
      archived_at: new Date().toISOString(),
      status: 'archived',
      updated_at: new Date().toISOString(),
    })
    .eq('id', agentId)
    .eq('workspace_id', context.workspace.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/agents');
  revalidatePath(`/agents/${agentId}`);

  return { success: true };
}
