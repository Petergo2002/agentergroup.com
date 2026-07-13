import { NextRequest, NextResponse } from "next/server";
import { canEditAgentRecord, getMembershipRoleForWorkspace } from "@/lib/agents/access";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import {
  AUTOMATION_GMAIL_TRIGGER_CONFIG,
  AUTOMATION_GMAIL_TRIGGER_SLUG,
} from "@/lib/agents/defaults";
import {
  AUTOMATIONS_DISABLED_CODE,
  AUTOMATIONS_DISABLED_MESSAGE,
  hasAutomationsEnabled,
} from "@/lib/assistants/feature-flags";
import { buildWorkspaceComposioUserId } from "@/lib/connections";
import {
  deleteComposioTrigger,
  getComposioTriggerHealth,
  syncConnectedAccountsToDatabase,
} from "@/lib/composio";
import { getAppUrl, hasComposioEnv, hasComposioWebhookSecret } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
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
const RUN_STEP_SELECT =
  "id, run_id, workspace_id, agent_id, step_key, step_type, title, detail, status, payload, started_at, completed_at, created_at";
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
  return surface === "automation";
}

async function loadWorkspaceAgent(
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

  return agent ?? null;
}

async function loadAutomationHostAgent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  agentId: string,
  workspaceId: string,
) {
  const agent = await loadWorkspaceAgent(supabase, agentId, workspaceId);
  return agent && isAutomationHostSurface(agent.surface) ? agent : null;
}

export async function GET(
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

  if (!hasAutomationsEnabled(context.workspace)) {
    return NextResponse.json(
      {
        error: AUTOMATIONS_DISABLED_MESSAGE,
        code: AUTOMATIONS_DISABLED_CODE,
      },
      { status: 403 },
    );
  }

  if (!context.subscription?.integrations_enabled) {
    return NextResponse.json(
      { error: "Automations require a workspace plan with integrations enabled." },
      { status: 403 },
    );
  }

  const agent = await loadAutomationHostAgent(supabase, agentId, context.workspace.id);

  if (!agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  await syncConnectedAccountsToDatabase(supabase as never, context.workspace.id, user.id);

  const [draftResult, automationResult, connectionsResult, runsResult, runStepsResult, eventsResult] = await Promise.all([
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
      .limit(20),
    supabase
      .from("run_steps")
      .select(RUN_STEP_SELECT)
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(50),
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
  if (runStepsResult.error) throw runStepsResult.error;
  if (eventsResult.error) throw eventsResult.error;

  const automationRecord = (automationResult.data ?? null) as AgentAutomationRecord | null;
  let providerTriggerHealth: unknown = null;
  let providerTriggerHealthError: string | null = null;

  if (hasComposioEnv() && automationRecord?.composio_trigger_id) {
    try {
      providerTriggerHealth = await getComposioTriggerHealth(
        automationRecord.composio_trigger_id,
      );
    } catch {
      providerTriggerHealthError = "Unable to verify the Composio trigger health.";
    }
  }

  return NextResponse.json({
    agent,
    definition: (draftResult.data?.definition ?? null) as BuilderDefinition | null,
    automation: automationRecord,
    connections: (connectionsResult.data ?? []) as ConnectionRecord[],
    runs: runsResult.data ?? [],
    steps: runStepsResult.data ?? [],
    events: eventsResult.data ?? [],
    providerTriggerHealth,
    providerTriggerHealthError,
    defaults: {
      triggerSlug: AUTOMATION_GMAIL_TRIGGER_SLUG,
      triggerConfig: { ...AUTOMATION_GMAIL_TRIGGER_CONFIG },
      composioUserId: buildWorkspaceComposioUserId(context.workspace.id),
    },
    environment: {
      hasComposio: hasComposioEnv(),
      hasWebhookSecret: hasComposioWebhookSecret(),
      configuredAppUrl: getAppUrl().replace(/\/$/, ""),
      appUrlMatchesRequestOrigin:
        getAppUrl().replace(/\/$/, "") === request.nextUrl.origin,
      expectedWebhookUrl: new URL(
        "/api/composio/webhook",
        request.nextUrl.origin,
      ).toString(),
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

  if (!hasAutomationsEnabled(context.workspace)) {
    return NextResponse.json(
      {
        error: AUTOMATIONS_DISABLED_MESSAGE,
        code: AUTOMATIONS_DISABLED_CODE,
      },
      { status: 403 },
    );
  }

  if (!context.subscription?.integrations_enabled) {
    return NextResponse.json(
      { error: "Automations require a workspace plan with integrations enabled." },
      { status: 403 },
    );
  }

  const agent = await loadAutomationHostAgent(supabase, agentId, context.workspace.id);

  if (!agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  const membershipRole = getMembershipRoleForWorkspace(
    context.workspaces,
    agent.workspace_id,
  );

  if (!canEditAgentRecord(agent, user.id, membershipRole)) {
    return NextResponse.json(
      { error: "You do not have permission to change this automation." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const name = readString(body.name) ?? agent.name;
  const description = typeof body.description === "string" ? body.description : agent.description;
  const model = readString(body.model) ?? agent.model;
  const instructions = typeof body.instructions === "string" ? body.instructions : agent.instructions;
  const timezone = readString(body.timezone) ?? agent.timezone ?? "UTC";
  const connectionId = readString(body.connectionId);
  const triggerSlug = readString(body.triggerSlug) ?? AUTOMATION_GMAIL_TRIGGER_SLUG;
  const requestedTriggerConfig = readJsonRecord(body.triggerConfig);
  const triggerConfig = {
    ...AUTOMATION_GMAIL_TRIGGER_CONFIG,
    ...requestedTriggerConfig,
    interval: Math.max(
      AUTOMATION_GMAIL_TRIGGER_CONFIG.interval,
      typeof requestedTriggerConfig.interval === "number"
        ? requestedTriggerConfig.interval
        : AUTOMATION_GMAIL_TRIGGER_CONFIG.interval,
    ),
  };
  const definition = isRecord(body.definition)
    ? (body.definition as unknown as BuilderDefinition)
    : null;

  if (triggerSlug !== AUTOMATION_GMAIL_TRIGGER_SLUG) {
    return NextResponse.json({ error: "Unsupported automation trigger." }, { status: 400 });
  }

  if (connectionId) {
    const { data: connection, error: connectionError } = await supabase
      .from("connections")
      .select("id, workspace_id, toolkit_slug, status")
      .eq("id", connectionId)
      .eq("workspace_id", context.workspace.id)
      .eq("toolkit_slug", "gmail")
      .maybeSingle();

    if (connectionError) {
      return NextResponse.json({ error: connectionError.message }, { status: 500 });
    }

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

  const currentAutomation = currentAutomationResult.data as AgentAutomationRecord | null;
  const providerBindingChanged = Boolean(
    currentAutomation &&
      (
        currentAutomation.connection_id !== connectionId ||
        currentAutomation.trigger_slug !== triggerSlug ||
        stableJsonString(currentAutomation.trigger_config) !== stableJsonString(triggerConfig)
      ),
  );
  const shouldReplaceProviderTrigger = Boolean(
    currentAutomation?.composio_trigger_id && providerBindingChanged,
  );
  const shouldPauseActiveAutomation = Boolean(
    currentAutomation?.status === "active" &&
      (providerBindingChanged || !currentAutomation.composio_trigger_id),
  );
  const nextAutomationStatus = shouldPauseActiveAutomation
    ? "paused"
    : currentAutomation?.status ?? "draft";

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
        ...(shouldPauseActiveAutomation ? { status: "paused" } : {}),
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

  const persistenceError =
    agentResult.error ?? draftResult.error ?? automationResult.error;

  if (persistenceError) {
    if (shouldReplaceProviderTrigger) {
      await Promise.all([
        supabase
          .from("agent_automations")
          .update({
            composio_trigger_id: null,
            status: "error",
            last_error: persistenceError.message,
          })
          .eq("id", currentAutomation?.id ?? ""),
        supabase.from("agents").update({ status: "paused" }).eq("id", agentId),
      ]);
    }

    return NextResponse.json({ error: persistenceError.message }, { status: 500 });
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
  // Cleanup must remain available after a builder save changes the agent back
  // to the widget surface. The automation RLS SELECT policy intentionally
  // hides stale bindings in that state, so authorize with the user client and
  // perform the provider/local cleanup with the server-only client below.
  const agent = await loadWorkspaceAgent(supabase, agentId, context.workspace.id);

  if (!agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  const membershipRole = getMembershipRoleForWorkspace(
    context.workspaces,
    agent.workspace_id,
  );

  if (!canEditAgentRecord(agent, user.id, membershipRole)) {
    return NextResponse.json(
      { error: "You do not have permission to change this automation." },
      { status: 403 },
    );
  }

  const admin = createAdminClient();
  const { data: automation, error: automationError } = await admin
    .from("agent_automations")
    .select(AUTOMATION_RECORD_SELECT)
    .eq("agent_id", agentId)
    .eq("workspace_id", context.workspace.id)
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

  const deleteResult = await admin
    .from("agent_automations")
    .delete()
    .eq("id", automationRecord.id)
    .eq("workspace_id", context.workspace.id);

  if (deleteResult.error) {
    return NextResponse.json({ error: deleteResult.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
