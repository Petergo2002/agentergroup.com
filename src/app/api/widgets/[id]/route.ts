import { NextRequest, NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { createAuditLog } from "@/lib/runtime/observability";
import { createClient } from "@/lib/supabase/server";
import { normalizeAllowedOrigins } from "@/lib/widgets";
import {
  buildWidgetPreviewPayload,
  buildWidgetSummary,
  loadWidgetById,
  signWidgetPreviewToken,
} from "@/lib/widgets/server";
import type { AgentRecord } from "@/lib/types";

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

  const context = await ensureWorkspaceContext(supabase as never, user);
  const loaded = await loadWidgetById(supabase as never, id);

  if (!loaded || loaded.widget.workspace_id !== context.workspace.id) {
    return NextResponse.json({ error: "Widget not found." }, { status: 404 });
  }

  const { data: availableAgents, error: agentsError } = await supabase
    .from("agents")
    .select("*")
    .eq("workspace_id", context.workspace.id)
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

  const context = await ensureWorkspaceContext(supabase as never, user);
  const loaded = await loadWidgetById(supabase as never, id);

  if (!loaded || loaded.widget.workspace_id !== context.workspace.id) {
    return NextResponse.json({ error: "Widget not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const payload = {
    name: parseString(body.name) ?? loaded.widget.name,
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
    show_branding: parseBoolean(body.showBranding, loaded.widget.show_branding),
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
    .select("*")
    .maybeSingle();

  if (error || !updatedWidget) {
    return NextResponse.json(
      { error: error?.message || "Failed to update widget." },
      { status: 500 },
    );
  }

  const summary = buildWidgetSummary(updatedWidget as never, loaded.widgetAgents, {
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

  const context = await ensureWorkspaceContext(supabase as never, user);
  const loaded = await loadWidgetById(supabase as never, id);

  if (!loaded || loaded.widget.workspace_id !== context.workspace.id) {
    return NextResponse.json({ error: "Widget not found." }, { status: 404 });
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
