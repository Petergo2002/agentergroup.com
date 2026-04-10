import { NextRequest, NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { getAppUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  AgentRecord,
  WidgetContactFormSettingsRecord,
  WidgetDraftPreviewAgentInput,
  WidgetDraftPreviewInput,
  WidgetQuickAction,
} from "@/lib/types";
import {
  buildWidgetPreviewPayload,
  createWidgetPreviewDraft,
  loadWidgetAgentsByIds,
  loadWidgetById,
  loadWidgetPreviewDraft,
  signWidgetPreviewToken,
  updateWidgetPreviewDraft,
  type WidgetAdminSupabase,
} from "@/lib/widgets/server";

function normalizeQuickActions(input: unknown): WidgetQuickAction[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return null;
      }

      const record = item as Record<string, unknown>;
      const label = typeof record.label === "string" ? record.label.trim() : "";
      const prompt = typeof record.prompt === "string" ? record.prompt.trim() : "";
      const icon =
        typeof record.icon === "string" && record.icon.trim()
          ? record.icon.trim()
          : null;

      if (!label || !prompt) {
        return null;
      }

      return { label, prompt, icon };
    })
    .filter(Boolean) as WidgetQuickAction[];
}

function normalizeContactFormSettings(
  input: unknown,
): WidgetContactFormSettingsRecord {
  if (typeof input !== "object" || input === null) {
    return {};
  }

  const record = input as Record<string, unknown>;
  return {
    submitButtonText:
      typeof record.submitButtonText === "string" ? record.submitButtonText.trim() : undefined,
    successMessage:
      typeof record.successMessage === "string" ? record.successMessage.trim() : undefined,
    introText:
      typeof record.introText === "string" ? record.introText.trim() : undefined,
  };
}

function parseDraftPreviewInput(body: Record<string, unknown>) {
  const widget = typeof body.widget === "object" && body.widget !== null
    ? (body.widget as Record<string, unknown>)
    : {};
  const agentsInput = Array.isArray(body.agents) ? body.agents : [];

  const draft: WidgetDraftPreviewInput = {
    widget: {
      name: typeof widget.name === "string" ? widget.name.trim() : "",
      brandName: typeof widget.brandName === "string" ? widget.brandName.trim() : "",
      logoUrl: typeof widget.logoUrl === "string" ? widget.logoUrl.trim() : "",
      primaryColor:
        typeof widget.primaryColor === "string" ? widget.primaryColor.trim() : "#ff5c00",
      secondaryColor:
        typeof widget.secondaryColor === "string" && widget.secondaryColor.trim()
          ? widget.secondaryColor.trim()
          : typeof widget.backgroundColor === "string" && widget.backgroundColor.trim()
            ? widget.backgroundColor.trim()
            : typeof widget.primaryColor === "string" && widget.primaryColor.trim()
              ? widget.primaryColor.trim()
              : "#ff5c00",
      theme: widget.theme === "light" ? "light" : "dark",
      language: typeof widget.language === "string" ? widget.language.trim() : "en",
      homeTitle: typeof widget.homeTitle === "string" ? widget.homeTitle.trim() : null,
      homeSubtitle: typeof widget.homeSubtitle === "string" ? widget.homeSubtitle.trim() : null,
      showBranding: typeof widget.showBranding === "boolean" ? widget.showBranding : true,
      privacyPolicyUrl:
        typeof widget.privacyPolicyUrl === "string"
          ? widget.privacyPolicyUrl.trim()
          : "",
      allowedOrigins: Array.isArray(widget.allowedOrigins)
        ? widget.allowedOrigins
            .map((value) => (typeof value === "string" ? value.trim() : ""))
            .filter(Boolean)
        : [],
    },
    agents: agentsInput
      .map((item, index) => {
        if (typeof item !== "object" || item === null) {
          return null;
        }

        const record = item as Record<string, unknown>;
        const agentId = typeof record.agentId === "string" ? record.agentId.trim() : "";
        if (!agentId) {
          return null;
        }

        return {
          agentId,
          label: typeof record.label === "string" ? record.label.trim() : "",
          description:
            typeof record.description === "string" ? record.description.trim() : "",
          icon:
            typeof record.icon === "string" && record.icon.trim()
              ? record.icon.trim()
              : null,
          sortOrder:
            typeof record.sortOrder === "number" && Number.isFinite(record.sortOrder)
              ? record.sortOrder
              : index,
          interactionMode:
            record.interactionMode === "contact_form" ? "contact_form" : "chat",
          greeting:
            typeof record.greeting === "string" ? record.greeting.trim() : "",
          placeholder:
            typeof record.placeholder === "string" ? record.placeholder.trim() : "",
          showQuickActions:
            typeof record.showQuickActions === "boolean"
              ? record.showQuickActions
              : true,
          quickActions: normalizeQuickActions(record.quickActions),
          contactFormSettings: normalizeContactFormSettings(
            record.contactFormSettings,
          ),
        } satisfies WidgetDraftPreviewAgentInput;
      })
      .filter(Boolean) as WidgetDraftPreviewAgentInput[],
  };

  return draft;
}

export async function POST(
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

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const draft = parseDraftPreviewInput(body);
  const uniqueAgentIds = Array.from(new Set(draft.agents.map((agent) => agent.agentId)));
  const admin = createAdminClient() as unknown as WidgetAdminSupabase;
  const availableAgents = await loadWidgetAgentsByIds(
    admin,
    context.workspace.id,
    uniqueAgentIds,
  );

  const availableAgentMap = new Map(
    availableAgents.map((agent) => [agent.id, agent] satisfies [string, AgentRecord]),
  );

  if (availableAgentMap.size !== uniqueAgentIds.length) {
    return NextResponse.json(
      { error: "One or more selected agents are unavailable in this workspace." },
      { status: 400 },
    );
  }

  const requestedRevision =
    typeof body.previewRevision === "string" && body.previewRevision.trim()
      ? body.previewRevision.trim()
      : null;
  let revision = requestedRevision ?? crypto.randomUUID();
  const previewPayload = buildWidgetPreviewPayload({
    widgetPublicKey: loaded.widget.widget_public_key,
    widgetId: loaded.widget.id,
    workspaceId: context.workspace.id,
    userId: user.id,
    revision,
  });

  const expiresAt = new Date(previewPayload.expiresAt).toISOString();
  const existingDraft =
    requestedRevision
      ? await loadWidgetPreviewDraft(admin, loaded.widget.id, requestedRevision)
      : null;

  if (existingDraft && existingDraft.created_by === user.id) {
    await updateWidgetPreviewDraft(admin, {
      draftId: existingDraft.id,
      payload: draft,
      expiresAt,
    });
  } else {
    if (existingDraft && existingDraft.created_by !== user.id) {
      revision = crypto.randomUUID();
    }

    await createWidgetPreviewDraft(admin, {
      widgetId: loaded.widget.id,
      workspaceId: context.workspace.id,
      createdBy: user.id,
      revision,
      payload: draft,
      expiresAt,
    });
  }

  const previewToken = await signWidgetPreviewToken({
    ...previewPayload,
    revision,
  });
  const previewUrl = `${getAppUrl()}/widgets/${loaded.widget.id}/preview?revision=${encodeURIComponent(
    revision,
  )}&preview_token=${encodeURIComponent(previewToken)}`;

  return NextResponse.json({
    previewUrl,
    previewToken,
    previewRevision: revision,
  });
}
