'use server';

import { revalidatePath } from 'next/cache';
import { ensureWorkspaceContext } from '@/lib/app/bootstrap';
import { createClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';
import { buildDefaultWidgetInput } from '@/lib/widgets';

function buildWidgetSlug(name: string) {
  const base = slugify(name) || 'widget';
  return `${base}-${Date.now().toString().slice(-6)}`;
}

export async function createWidgetAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Unauthorized' };
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const requestedName =
    (formData.get('name') as string)?.trim() || 'Untitled Widget';

  const widgetDefaults = buildDefaultWidgetInput(context.workspace, {
    name: requestedName,
    slug: buildWidgetSlug(requestedName),
  });

  const admin = await import('@/lib/supabase/admin').then((m) => m.createAdminClient());

  const { data: widget, error } = await admin
    .from('widgets')
    .insert({
      ...widgetDefaults,
      workspace_id: context.workspace.id,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/widgets');

  return { widget };
}

export async function updateWidgetAction(
  widgetId: string,
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
  const admin = await import('@/lib/supabase/admin').then((m) => m.createAdminClient());

  const { error } = await admin
    .from('widgets')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', widgetId)
    .eq('workspace_id', context.workspace.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/widgets/${widgetId}`);
  revalidatePath('/widgets');

  return { success: true };
}

export async function deleteWidgetAction(widgetId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Unauthorized' };
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const admin = await import('@/lib/supabase/admin').then((m) => m.createAdminClient());

  await admin.from('widget_agents').delete().eq('widget_id', widgetId);

  const { error } = await admin
    .from('widgets')
    .delete()
    .eq('id', widgetId)
    .eq('workspace_id', context.workspace.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/widgets');

  return { success: true };
}

export async function toggleWidgetStatusAction(widgetId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Unauthorized' };
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const admin = await import('@/lib/supabase/admin').then((m) => m.createAdminClient());

  const { data: widget } = await admin
    .from('widgets')
    .select('status')
    .eq('id', widgetId)
    .single();

  const newStatus = widget?.status === 'deployed' ? 'draft' : 'deployed';

  const { error } = await admin
    .from('widgets')
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', widgetId)
    .eq('workspace_id', context.workspace.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/widgets');
  revalidatePath(`/widgets/${widgetId}`);

  return { success: true, newStatus };
}
