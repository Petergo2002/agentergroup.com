import { NextRequest, NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { createAuditLog } from "@/lib/runtime/observability";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizeAllowedOrigins } from "@/lib/widgets";
import {
  buildWidgetPreviewPayload,
  buildWidgetSummary,
  loadWidgetById,
  signWidgetPreviewToken,
  type WidgetAdminSupabase,
} from "@/lib/widgets/server";
import { WorkspaceAccessError, assertOwnedWorkspaceResource } from "@/lib/workspace-security";
import type { AgentRecord } from "@/lib/types";
import { PROACTIVE_MESSAGE_MAX_LENGTH } from "@/lib/widgets";

const WIDGET_AGENT_SELECT =
  "id, workspace_id, created_by, surface, name, slug, description, status, model, instructions, starter_prompts, timezone, published_version_id, archived_at, archived_by, created_at, updated_at";
const WIDGET_SELECT =
  "id, workspace_id, name, slug, status, widget_public_key, brand_name, logo_url, primary_color, secondary_color, background_color, text_color, theme, language, home_title, home_subtitle, hosted_enabled, show_branding, proactive_message, proactive_enabled, privacy_policy_url, allowed_origins, description, created_at, updated_at, deployed_at";

function parseString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const context = await ensureWorkspaceContext(supabase, user);
  const loaded = await loadWidgetById(supabase as unknown as WidgetAdminSupabase, id, {
    canHideBranding: context.subscription?.plan_tier === "premium",
  });

  if (!loaded) {
    return NextResponse.json({ error: "Widget not found." }, { status: 404 });
  }

  try {
    assertOwnedWorkspaceResource(
      loaded.widget,
      context.workspace.id,
      "You do not have access to this widget.",
    );
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }

  const { data: availableAgents, error: agentsError } = await supabase
    .from("agents")
    .select(WIDGET_AGENT_SELECT)
    .eq("workspace_id", context.workspace.id)
    .eq("surface", "widget")
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  if (agentsError) {
    return NextResponse.json(
      { error: agentsError.message || "Failed to load agents." },
      { status: 500 },
    );
  }

  const summary = buildWidgetSummary(loaded.widget, loaded.widgetAgents, {
    preview: true,
  });
  const previewToken = await signWidgetPreviewToken(
    buildWidgetPreviewPayload({
      widgetPublicKey: summary.widget.widget_public_key,
      widgetId: summary.widget.id,
      workspaceId: context.workspace.id,
      userId: user.id,
    }),
  );

  return NextResponse.json({
    ...summary,
    previewToken,
    availableAgents: (availableAgents ?? []) as AgentRecord[],
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const context = await ensureWorkspaceContext(supabase, user);
  const loaded = await loadWidgetById(supabase as unknown as WidgetAdminSupabase, id, {
    canHideBranding: context.subscription?.plan_tier === "premium",
  });

  if (!loaded) {
    return NextResponse.json({ error: "Widget not found." }, { status: 404 });
  }

  try {
    assertOwnedWorkspaceResource(
      loaded.widget,
      context.workspace.id,
      "You do not have access to this widget.",
    );
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }

  const body = await request.json().catch(() => ({}));
  const canHideBranding = context.subscription?.plan_tier === "premium";
  const payload = {
    name: parseString(body.name) ?? loaded.widget.name,
    description:
      typeof body.description === "string"
        ? body.description.trim().slice(0, 200)
        : loaded.widget.description,
    brand_name: parseString(body.brandName) ?? loaded.widget.brand_name,
    logo_url: parseString(body.logoUrl),
    primary_color: parseString(body.primaryColor) ?? loaded.widget.primary_color,
    secondary_color:
      parseString(body.secondaryColor) ??
      parseString(body.backgroundColor) ??
      loaded.widget.secondary_color ??
      loaded.widget.primary_color,
    background_color:
      parseString(body.backgroundColor) ?? loaded.widget.background_color,
    text_color: parseString(body.textColor) ?? loaded.widget.text_color,
    theme: body.theme === "light" ? "light" : "dark",
    language: parseString(body.language) ?? "en",
    home_title: parseString(body.homeTitle),
    home_subtitle: parseString(body.homeSubtitle),
    hosted_enabled: parseBoolean(body.hostedEnabled, loaded.widget.hosted_enabled),
    show_branding: canHideBranding
      ? parseBoolean(body.showBranding, loaded.widget.show_branding)
      : true,
    proactive_enabled: parseBoolean(
      body.proactiveEnabled,
      loaded.widget.proactive_enabled,
    ),
    // Trimmed and capped here as well as in the database, so an over-long
    // message is stored truncated rather than rejecting the whole save.
    proactive_message:
      parseString(body.proactiveMessage)?.slice(0, PROACTIVE_MESSAGE_MAX_LENGTH) ??
      null,
    privacy_policy_url:
      parseString(body.privacyPolicyUrl) ?? loaded.widget.privacy_policy_url,
    allowed_origins: Array.isArray(body.allowedOrigins)
      ? normalizeAllowedOrigins(
          body.allowedOrigins.map((value: unknown) => String(value)),
        )
      : loaded.widget.allowed_origins,
  };

  const { data: updatedWidget, error } = await supabase
    .from("widgets")
    .update(payload)
    .eq("id", id)
    .eq("workspace_id", context.workspace.id)
    .select(WIDGET_SELECT)
    .maybeSingle();

  if (error || !updatedWidget) {
    return NextResponse.json(
      { error: error?.message || "Failed to update widget." },
      { status: 500 },
    );
  }

  const summary = buildWidgetSummary(updatedWidget, loaded.widgetAgents, {
    preview: false,
  });
  const previewToken = await signWidgetPreviewToken(
    buildWidgetPreviewPayload({
      widgetPublicKey: summary.widget.widget_public_key,
      widgetId: summary.widget.id,
      workspaceId: context.workspace.id,
      userId: user.id,
    }),
  );

  return NextResponse.json({
    ...summary,
    previewToken,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const context = await ensureWorkspaceContext(supabase, user);
  if (
    context.workspace.product_experience === "milo" &&
    context.workspace.primary_widget_id === id
  ) {
    return NextResponse.json(
      { error: "Website Chat cannot be deleted while the Milo experience is active.", code: "milo_primary_widget_protected" },
      { status: 409 },
    );
  }
  const loaded = await loadWidgetById(supabase as unknown as WidgetAdminSupabase, id, {
    canHideBranding: context.subscription?.plan_tier === "premium",
  });

  if (!loaded) {
    return NextResponse.json({ error: "Widget not found." }, { status: 404 });
  }

  try {
    assertOwnedWorkspaceResource(
      loaded.widget,
      context.workspace.id,
      "You do not have access to delete this widget.",
    );
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }

  if (context.membership.role !== "owner") {
    return NextResponse.json(
      { error: "Only workspace owners can permanently delete a widget." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const confirmationName =
    typeof body.confirmationName === "string" ? body.confirmationName.trim() : "";

  if (confirmationName !== loaded.widget.name) {
    return NextResponse.json(
      { error: "Confirmation name did not match the widget name." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: attachmentRows, error: attachmentLookupError } = await admin
    .from("widget_attachments")
    .select("storage_bucket, storage_path")
    .eq("widget_id", id);

  if (attachmentLookupError) {
    return NextResponse.json(
      { error: "Failed to load widget attachments for deletion." },
      { status: 500 },
    );
  }

  const pathsByBucket = new Map<string, string[]>();
  for (const attachment of (attachmentRows ?? []) as Array<{
    storage_bucket: string;
    storage_path: string;
  }>) {
    const paths = pathsByBucket.get(attachment.storage_bucket) ?? [];
    paths.push(attachment.storage_path);
    pathsByBucket.set(attachment.storage_bucket, paths);
  }

  for (const [bucket, paths] of pathsByBucket) {
    const { error: storageError } = await admin.storage.from(bucket).remove(paths);
    if (storageError) {
      return NextResponse.json(
        { error: "Failed to delete widget attachment files." },
        { status: 500 },
      );
    }
  }

  const deleteResult = await supabase
    .from("widgets")
    .delete()
    .eq("id", id)
    .eq("workspace_id", context.workspace.id)
    .select("id")
    .maybeSingle();

  if (deleteResult.error) {
    return NextResponse.json(
      { error: deleteResult.error.message || "Failed to delete widget." },
      { status: 500 },
    );
  }

  if (!deleteResult.data) {
    return NextResponse.json(
      {
        error:
          "Widget deletion was blocked. Verify the widget still exists and that delete access is enabled.",
      },
      { status: 500 },
    );
  }

  try {
    await createAuditLog(supabase, {
      workspaceId: context.workspace.id,
      actorId: user.id,
      action: "widget.deleted",
      summary: `Permanently deleted widget "${loaded.widget.name}".`,
      metadata: {
        deletedWidgetId: loaded.widget.id,
        deletedWidgetName: loaded.widget.name,
      },
    });
  } catch (error) {
    console.error("Failed to write widget delete audit log", error);
  }

  return NextResponse.json({ ok: true });
}
