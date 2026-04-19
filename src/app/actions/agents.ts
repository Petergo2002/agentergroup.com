'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { ensureWorkspaceContext } from '@/lib/app/bootstrap';
import { createClient } from '@/lib/supabase/server';

const createAgentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional().default(''),
});

const updateAgentSchema = z.record(z.string(), z.unknown());

export async function createAgentAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Unauthorized' };
  }

  const context = await ensureWorkspaceContext(supabase, user);

  const parsed = createAgentSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { name, description } = parsed.data;

  const { data: agent, error } = await supabase
    .from('agents')
    .insert({
      name,
      description,
      status: 'draft',
      workspace_id: context.workspace.id,
      created_by: user.id,
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

  const context = await ensureWorkspaceContext(supabase, user);

  const parsed = updateAgentSchema.safeParse(updates);
  
  if (!parsed.success) {
    return { error: 'Invalid updates payload' };
  }

  const { error } = await supabase
    .from('agents')
    .update({
      ...parsed.data,
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

export async function toggleAgentStatusAction(agentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Unauthorized' };
  }

  const context = await ensureWorkspaceContext(supabase, user);

  const { data: agent } = await supabase
    .from('agents')
    .select('status')
    .eq('id', agentId)
    .eq('workspace_id', context.workspace.id)
    .single();

  if (!agent) {
    return { error: 'Agent not found' };
  }

  const statusMap: Record<string, string> = {
    draft: 'active',
    active: 'paused',
    paused: 'active',
  };

  const newStatus = statusMap[agent.status ?? 'draft'] || 'active';

  const { error } = await supabase
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

  const context = await ensureWorkspaceContext(supabase, user);

  const { error } = await supabase
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
