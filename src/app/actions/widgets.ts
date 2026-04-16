'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { ensureWorkspaceContext } from '@/lib/app/bootstrap';
import { createClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';
import { buildDefaultWidgetInput } from '@/lib/widgets';

function buildWidgetSlug(name: string) {
  const base = slugify(name) || 'widget';
  return `${base}-${Date.now().toString().slice(-6)}`;
}

const createWidgetSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
});

const updateWidgetSchema = z.record(z.string(), z.unknown());

export async function createWidgetAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Unauthorized' };
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  
  const parsed = createWidgetSchema.safeParse({
    name: formData.get('name'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  
  const requestedName = parsed.data.name;

  const widgetDefaults = buildDefaultWidgetInput(context.workspace, {
    name: requestedName,
    slug: buildWidgetSlug(requestedName),
  });

  const { data: widget, error } = await supabase
    .from('widgets')
    .insert({
      ...widgetDefaults,
      workspace_id: context.workspace.id,
      created_by: user.id,
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
  
  const parsed = updateWidgetSchema.safeParse(updates);
  
  if (!parsed.success) {
    return { error: 'Invalid updates payload' };
  }

  const { error } = await supabase
    .from('widgets')
    .update({
      ...parsed.data,
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

export async function toggleWidgetStatusAction(widgetId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Unauthorized' };
  }

  const context = await ensureWorkspaceContext(supabase as never, user);

  const { data: widget } = await supabase
    .from('widgets')
    .select('status')
    .eq('id', widgetId)
    .eq('workspace_id', context.workspace.id)
    .single();

  if (!widget) {
    return { error: 'Widget not found' };
  }

  const newStatus = widget.status === 'deployed' ? 'draft' : 'deployed';

  const { error } = await supabase
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
