import { NextRequest, NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
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

  const { error } = await supabase
    .from("widgets")
    .update(payload)
    .eq("id", id)
    .eq("workspace_id", context.workspace.id);

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to update widget." },
      { status: 500 },
    );
  }

  const nextLoaded = await loadWidgetById(supabase as never, id);

  if (!nextLoaded) {
    return NextResponse.json({ error: "Widget not found." }, { status: 404 });
  }

  const summary = buildWidgetSummary(nextLoaded.widget, nextLoaded.widgetAgents, {
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
