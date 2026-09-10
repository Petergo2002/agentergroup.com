import { after, NextRequest, NextResponse } from "next/server";
import { sendLeadNotificationEmail } from "@/lib/email";
import { generateLeadConversationSummary } from "@/lib/leads/conversation-summary";
import {
  buildPublicWidgetRateLimitContext,
  buildRateLimitErrorPayload,
  enforceRateLimits,
  getPublicWidgetRateLimitRules,
} from "@/lib/rate-limit";
import { createClientSafeError } from "@/lib/server-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  validateBody,
  validateWidgetLeadBody,
} from "@/lib/validation/widget-schemas";
import {
  buildDraftWidgetRuntimeAgents,
  buildWidgetRuntimeCorsHeaders,
  buildStoredWidgetRuntimeAgents,
  insertWidgetLead,
  loadWidgetByPublicKey,
  loadWidgetSession,
  resolveWidgetRuntimeRequestOrigin,
  resolveWidgetPreviewContext,
  resolveWidgetRuntimeAccess,
  type RuntimeWidgetAgentSelection,
  type WidgetAdminSupabase,
  upsertWidgetSession,
} from "@/lib/widgets/server";

function buildErrorResponse(
  request: NextRequest,
  status: number,
  error: string,
  code?: string,
) {
  return NextResponse.json(
    code ? { error, code } : { error },
    { status, headers: buildWidgetRuntimeCorsHeaders(request) },
  );
}

function buildRateLimitedResponse(
  request: NextRequest,
  error: string,
  code: string,
  retryAfterSeconds: number,
) {
  return NextResponse.json(
    {
      error,
      code,
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        ...buildWidgetRuntimeCorsHeaders(request),
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}

function resolveSelectedWidgetAgent(args: {
  widgetAgents: RuntimeWidgetAgentSelection[];
  activeWidgetAgentId: string | null;
  activeAgentId: string | null;
  requestedWidgetAgentId: string | null;
}) {
  const {
    widgetAgents,
    activeWidgetAgentId,
    activeAgentId,
    requestedWidgetAgentId,
  } = args;

  if (widgetAgents.length === 0) {
    return {
      error: "This widget has no attached agents yet.",
      status: 400,
      code: "NO_WIDGET_AGENTS",
    } as const;
  }

  const selectedFromSession = activeWidgetAgentId
    ? widgetAgents.find((item) => item.widgetAgentId === activeWidgetAgentId) ?? null
    : null;

  const selectedFromAgentSession =
    !selectedFromSession && activeAgentId
      ? widgetAgents.find((item) => item.agent.id === activeAgentId) ?? null
      : null;

  if (activeWidgetAgentId && !selectedFromSession && !selectedFromAgentSession) {
    return {
      error: "This conversation is bound to an agent that is no longer attached. Start a new chat.",
      status: 409,
      code: "SESSION_AGENT_INVALID",
    } as const;
  }

  const selectedFromRequest = requestedWidgetAgentId
    ? widgetAgents.find((item) => item.widgetAgentId === requestedWidgetAgentId) ?? null
    : null;

  if (requestedWidgetAgentId && !selectedFromRequest) {
    return {
      error: "The selected widget agent is not attached to this widget.",
      status: 400,
      code: "INVALID_WIDGET_AGENT",
    } as const;
  }

  const lockedSelection = selectedFromSession ?? selectedFromAgentSession;

  if (lockedSelection) {
    if (
      selectedFromRequest &&
      selectedFromRequest.widgetAgentId !== lockedSelection.widgetAgentId
    ) {
      return {
        error: "Switching agent requires a new session.",
        status: 409,
        code: "AGENT_SWITCH_REQUIRES_NEW_SESSION",
      } as const;
    }

    return { selected: lockedSelection } as const;
  }

  if (widgetAgents.length === 1) {
    return { selected: widgetAgents[0] } as const;
  }

  if (selectedFromRequest) {
    return { selected: selectedFromRequest } as const;
  }

  return {
    error: "widgetAgentId is required when multiple agents are attached.",
    status: 400,
    code: "WIDGET_AGENT_REQUIRED",
  } as const;
}

export async function OPTIONS(request: NextRequest) {
  const runtimeOrigin = resolveWidgetRuntimeRequestOrigin(request);

  if (!runtimeOrigin.ok) {
    return buildErrorResponse(
      request,
      runtimeOrigin.status,
      runtimeOrigin.error,
      runtimeOrigin.code,
    );
  }

  return new NextResponse(null, {
    status: 204,
    headers: buildWidgetRuntimeCorsHeaders(request),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ widgetPublicKey: string }> },
) {
  const { widgetPublicKey } = await params;
  const supabase = createAdminClient() as unknown as WidgetAdminSupabase;
  const runtimeOrigin = resolveWidgetRuntimeRequestOrigin(request);

  try {
    if (!runtimeOrigin.ok) {
      return buildErrorResponse(
        request,
        runtimeOrigin.status,
        runtimeOrigin.error,
        runtimeOrigin.code,
      );
    }

    const loaded = await loadWidgetByPublicKey(supabase, widgetPublicKey);

    if (!loaded) {
      return buildErrorResponse(request, 404, "Widget not found.");
    }

    const preview = await resolveWidgetPreviewContext(
      supabase,
      loaded.widget,
      request,
    );

    const access = await resolveWidgetRuntimeAccess({
      request,
      widget: loaded.widget,
      preview,
    });

    if (!access.ok) {
      return buildErrorResponse(
        request,
        access.status,
        access.error,
        access.code,
      );
    }

    if (access.source !== "preview" && loaded.widget.status !== "deployed") {
      return buildErrorResponse(request, 404, "Widget is not deployed.");
    }

    // This public endpoint writes lead data, so validate required fields,
    // field sizes, and email format before any session or database work runs.
    const bodyValidation = await validateBody(request, validateWidgetLeadBody);

    if (!bodyValidation.valid) {
      return buildErrorResponse(request, 400, bodyValidation.error);
    }

    if (access.source !== "preview") {
      const rateLimitDecision = await enforceRateLimits(
        supabase,
        getPublicWidgetRateLimitRules(
          "leads",
          buildPublicWidgetRateLimitContext({
            request,
            widgetId: loaded.widget.id,
            sessionId: bodyValidation.value.sessionId,
          }),
        ),
      );

      if (!rateLimitDecision.allowed) {
        const payload = buildRateLimitErrorPayload(rateLimitDecision);
        return buildRateLimitedResponse(
          request,
          payload.error,
          payload.code,
          payload.retryAfterSeconds,
        );
      }
    }

    const {
      sessionId,
      widgetAgentId: requestedWidgetAgentId,
      name,
      email,
      phone,
      message,
    } = bodyValidation.value;

    const existingSession = await loadWidgetSession(
      supabase,
      loaded.widget.id,
      sessionId,
    );
    const runtimeWidgetAgents = preview.previewDraft
      ? await buildDraftWidgetRuntimeAgents(
          supabase,
          loaded.widget,
          preview.previewDraft.payload,
        )
      : buildStoredWidgetRuntimeAgents(loaded.widgetAgents);
    const selection = resolveSelectedWidgetAgent({
      widgetAgents: runtimeWidgetAgents,
      activeWidgetAgentId: existingSession?.active_widget_agent_id ?? null,
      activeAgentId: existingSession?.active_agent_id ?? null,
      requestedWidgetAgentId,
    });

    if (!("selected" in selection)) {
      return buildErrorResponse(
        request,
        selection.status,
        selection.error,
        selection.code,
      );
    }

    const selected = selection.selected;
    const widgetSession = await upsertWidgetSession(supabase, {
      widgetId: loaded.widget.id,
      sessionId,
      source: access.source,
      pageUrl: null,
      referrer: null,
      origin: access.origin,
      activeWidgetAgentId: selected!.persistedWidgetAgentId,
      activeAgentId: selected!.agent.id,
    });

    const leadMessage = message?.trim()
      ? (message.trim().startsWith("[Kontaktformulär]") ? message.trim() : `[Kontaktformulär] ${message.trim()}`)
      : "[Kontaktformulär] Förfrågan om återkoppling";

    const lead = await insertWidgetLead(supabase, {
      widget_id: loaded.widget.id,
      widget_session_id: widgetSession.id,
      widget_agent_id: selected!.persistedWidgetAgentId,
      agent_id: selected!.agent.id,
      name,
      email,
      phone,
      message: leadMessage,
    });

    after(async () => {
      const adminClient = createAdminClient();

      try {
        await generateLeadConversationSummary(adminClient, {
          leadId: lead.id,
        });
      } catch (error) {
        console.error("Background lead summary generation failed.", {
          leadId: lead.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      try {
        const { data: workspace } = await adminClient
          .from("workspaces")
          .select("name, owner_id")
          .eq("id", loaded.widget.workspace_id)
          .maybeSingle();

        if (workspace?.owner_id) {
          const { data: ownerProfile } = await adminClient
            .from("profiles")
            .select("email")
            .eq("id", workspace.owner_id)
            .maybeSingle();

          if (ownerProfile?.email) {
            const rawWidgetName = loaded.widget.name?.trim() || "";
            const widgetName =
              !rawWidgetName || /^(maja|widget|avenro\s*widget)$/i.test(rawWidgetName)
                ? "Milo"
                : rawWidgetName;

            await sendLeadNotificationEmail({
              to: ownerProfile.email,
              widgetName,
              lead: {
                name,
                email,
                phone,
                message,
              },
            });
          }
        }
      } catch (emailError) {
        console.error("Background lead notification email failed.", {
          leadId: lead.id,
          error: emailError instanceof Error ? emailError.message : String(emailError),
        });
      }
    });

    return NextResponse.json(
      { ok: true, leadId: lead.id, createdAt: lead.created_at },
      { headers: buildWidgetRuntimeCorsHeaders(request) },
    );
  } catch (error) {
    const safeError = createClientSafeError(
      "public widget leads",
      error,
      "Failed to submit lead.",
    );
    return buildErrorResponse(
      request,
      500,
      safeError.error,
      safeError.code,
    );
  }
}
