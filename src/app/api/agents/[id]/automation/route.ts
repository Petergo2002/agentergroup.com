import { NextRequest, NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { AUTOMATION_GMAIL_TRIGGER_SLUG } from "@/lib/agents/defaults";
import { buildWorkspaceComposioUserId } from "@/lib/connections";
import {
  deleteComposioTrigger,
  getComposioTriggerType,
  syncConnectedAccountsToDatabase,
} from "@/lib/composio";
import { hasComposioEnv, hasComposioWebhookSecret } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { AgentAutomationRecord, BuilderDefinition, ConnectionRecord } from "@/lib/types";

const AUTOMATION_AGENT_SELECT =
  "id, workspace_id, created_by, surface, name, slug, description, status, model, instructions, starter_prompts, timezone, published_version_id, archived_at, archived_by, created_at, updated_at";
const AUTOMATION_RECORD_SELECT =
  "id, workspace_id, agent_id, connection_id, provider, toolkit_slug, trigger_slug, trigger_config, composio_trigger_id, status, last_event_at, last_error, created_at, updated_at";
const CONNECTION_SELECT =
  "id, workspace_id, provider, toolkit_slug, display_name, status, external_id, account_label, toolkit_data, created_by, last_synced_at, created_at, updated_at";
const RUN_SELECT =
  "id, workspace_id, agent_id, thread_id, status, model, input, output, error_message, started_at, completed_at, created_at";
const AUTOMATION_EVENT_SELECT =
  "id, workspace_id, agent_id, automation_id, run_id, external_event_id, trigger_slug, payload, status, created_at, updated_at";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readJsonRecord(value: unknown) {
  return isRecord(value) ? value : {};
}

function stableJsonString(value: Record<string, unknown>) {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(value).sort(([leftKey], [rightKey]) =>
        leftKey.localeCompare(rightKey),
      ),
    ),
  );
}

function isAutomationHostSurface(surface: string) {
  return surface === "widget" || surface === "automation";
}

async function loadAutomationHostAgent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  agentId: string,
  workspaceId: string,
) {
  const { data: agent, error } = await supabase
    .from("agents")
    .select(AUTOMATION_AGENT_SELECT)
    .eq("id", agentId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!agent || !isAutomationHostSurface(agent.surface)) {
    return null;
  }

  return agent;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: agentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const agent = await loadAutomationHostAgent(supabase, agentId, context.workspace.id);

  if (!agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  await syncConnectedAccountsToDatabase(supabase as never, context.workspace.id, user.id);

  const [draftResult, automationResult, connectionsResult, runsResult, eventsResult] = await Promise.all([
    supabase
      .from("agent_drafts")
      .select("id, agent_id, workspace_id, definition, version, updated_by, created_at, updated_at")
      .eq("agent_id", agentId)
      .maybeSingle(),
    supabase
      .from("agent_automations")
      .select(AUTOMATION_RECORD_SELECT)
      .eq("agent_id", agentId)
      .maybeSingle(),
    supabase
      .from("connections")
      .select(CONNECTION_SELECT)
      .eq("workspace_id", context.workspace.id)
      .eq("toolkit_slug", "gmail")
      .order("updated_at", { ascending: false }),
    supabase
      .from("runs")
      .select(RUN_SELECT)
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("automation_events")
      .select(AUTOMATION_EVENT_SELECT)
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (draftResult.error) throw draftResult.error;
  if (automationResult.error) throw automationResult.error;
  if (connectionsResult.error) throw connectionsResult.error;
  if (runsResult.error) throw runsResult.error;
  if (eventsResult.error) throw eventsResult.error;

  let triggerType: unknown = null;

  if (hasComposioEnv()) {
    triggerType = await getComposioTriggerType(AUTOMATION_GMAIL_TRIGGER_SLUG).catch(() => null);
  }

  return NextResponse.json({
    agent,
    definition: (draftResult.data?.definition ?? null) as BuilderDefinition | null,
    automation: (automationResult.data ?? null) as AgentAutomationRecord | null,
    connections: (connectionsResult.data ?? []) as ConnectionRecord[],
    runs: runsResult.data ?? [],
    events: eventsResult.data ?? [],
    triggerType,
    defaults: {
      triggerSlug: AUTOMATION_GMAIL_TRIGGER_SLUG,
      triggerConfig: {},
      composioUserId: buildWorkspaceComposioUserId(context.workspace.id),
    },
    environment: {
      hasComposio: hasComposioEnv(),
      hasWebhookSecret: hasComposioWebhookSecret(),
    },
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: agentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const agent = await loadAutomationHostAgent(supabase, agentId, context.workspace.id);

  if (!agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const name = readString(body.name) ?? agent.name;
  const description = typeof body.description === "string" ? body.description : agent.description;
  const model = readString(body.model) ?? agent.model;
  const instructions = typeof body.instructions === "string" ? body.instructions : agent.instructions;
  const timezone = readString(body.timezone) ?? agent.timezone ?? "UTC";
  const connectionId = readString(body.connectionId);
  const triggerSlug = readString(body.triggerSlug) ?? AUTOMATION_GMAIL_TRIGGER_SLUG;
  const triggerConfig = readJsonRecord(body.triggerConfig);
  const definition = isRecord(body.definition)
    ? (body.definition as unknown as BuilderDefinition)
    : null;

  if (triggerSlug !== AUTOMATION_GMAIL_TRIGGER_SLUG) {
    return NextResponse.json({ error: "Unsupported automation trigger." }, { status: 400 });
  }

  if (connectionId) {
    const { data: connection } = await supabase
      .from("connections")
      .select("id, workspace_id, toolkit_slug, status")
      .eq("id", connectionId)
      .eq("workspace_id", context.workspace.id)
      .eq("toolkit_slug", "gmail")
      .maybeSingle();

    if (!connection || connection.status !== "connected") {
      return NextResponse.json({ error: "Select a connected Gmail account." }, { status: 400 });
    }
  }

  const currentAutomationResult = await supabase
    .from("agent_automations")
    .select(AUTOMATION_RECORD_SELECT)
    .eq("agent_id", agentId)
    .maybeSingle();

  if (currentAutomationResult.error) {
    return NextResponse.json({ error: currentAutomationResult.error.message }, { status: 500 });
  }

  const nextAutomationStatus =
    currentAutomationResult.data?.status === "active"
      ? "paused"
      : currentAutomationResult.data?.status ?? "draft";
  const currentAutomation = currentAutomationResult.data as AgentAutomationRecord | null;
  const shouldReplaceProviderTrigger = Boolean(
    currentAutomation?.composio_trigger_id &&
      (
        currentAutomation.connection_id !== connectionId ||
        currentAutomation.trigger_slug !== triggerSlug ||
        stableJsonString(currentAutomation.trigger_config) !== stableJsonString(triggerConfig)
      ),
  );

  if (shouldReplaceProviderTrigger && currentAutomation?.composio_trigger_id) {
    const deleteError = await deleteComposioTrigger(currentAutomation.composio_trigger_id)
      .then(() => null)
      .catch((error) =>
        error instanceof Error
          ? `Failed to replace existing provider trigger: ${error.message}`
          : "Failed to replace existing provider trigger.",
      );

    if (deleteError) {
      return NextResponse.json({ error: deleteError }, { status: 500 });
    }
  }

  const [agentResult, draftResult, automationResult] = await Promise.all([
    supabase
      .from("agents")
      .update({
        name,
        description,
        model,
        instructions,
        timezone,
      })
      .eq("id", agentId),
    definition
      ? supabase.from("agent_drafts").upsert(
          {
            agent_id: agentId,
            workspace_id: context.workspace.id,
            updated_by: user.id,
            definition,
          },
          { onConflict: "agent_id" },
        )
      : Promise.resolve({ error: null }),
    supabase.from("agent_automations").upsert(
      {
        agent_id: agentId,
        workspace_id: context.workspace.id,
        connection_id: connectionId,
        provider: "composio",
        toolkit_slug: "gmail",
        trigger_slug: triggerSlug,
        trigger_config: triggerConfig,
        composio_trigger_id: shouldReplaceProviderTrigger ? null : currentAutomation?.composio_trigger_id ?? null,
        status: nextAutomationStatus,
      },
      { onConflict: "agent_id" },
    ),
  ]);

  if (agentResult.error) {
    return NextResponse.json({ error: agentResult.error.message }, { status: 500 });
  }

  if (draftResult.error) {
    return NextResponse.json({ error: draftResult.error.message }, { status: 500 });
  }

  if (automationResult.error) {
    return NextResponse.json({ error: automationResult.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: agentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const agent = await loadAutomationHostAgent(supabase, agentId, context.workspace.id);

  if (!agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  const { data: automation, error: automationError } = await supabase
    .from("agent_automations")
    .select(AUTOMATION_RECORD_SELECT)
    .eq("agent_id", agentId)
    .maybeSingle();

  if (automationError) {
    return NextResponse.json({ error: automationError.message }, { status: 500 });
  }

  if (!automation) {
    return NextResponse.json({ ok: true });
  }

  const automationRecord = automation as AgentAutomationRecord;

  if (automationRecord.composio_trigger_id) {
    try {
      await deleteComposioTrigger(automationRecord.composio_trigger_id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete provider trigger.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const deleteResult = await supabase
    .from("agent_automations")
    .delete()
    .eq("id", automationRecord.id);

  if (deleteResult.error) {
    return NextResponse.json({ error: deleteResult.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
