import { extractCalSelectionFromDefinition } from "@/lib/cal";
import { buildAutomationRunResult } from "@/lib/automation/result";
import { normalizeAutomationTriggerPayload } from "@/lib/automation/payload";
import { buildWorkspaceComposioUserId } from "@/lib/connections";
import {
  buildPersistedAssistantMetadata,
  buildPersistedRunOutput,
} from "@/lib/debug-trace-security";
import { extractGmailRecipientPolicyFromDefinition } from "@/lib/gmail";
import { extractGoogleCalendarSelectionFromDefinition } from "@/lib/google-calendar";
import { consumeWorkspaceMessageUsage } from "@/lib/message-usage";
import { runAgentChat } from "@/lib/runtime/agent-chat";
import { createRunStep, completeRunStep } from "@/lib/runtime/observability";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractEnabledToolsFromDefinition } from "@/lib/tool-actions";
import type {
  AgentAutomationRecord,
  AgentRecord,
  AutomationEventRecord,
  BuilderDefinition,
} from "@/lib/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function buildAutomationInput(triggerSlug: string, payload: Record<string, unknown>) {
  return [
    `Incoming automation event: ${triggerSlug}`,
    "",
    "Payload:",
    JSON.stringify(payload, null, 2),
  ].join("\n");
}

function readEventPayload(event: AutomationEventRecord) {
  const payloadEnvelope = event.payload;
  const nestedPayload = payloadEnvelope.payload;

  return isRecord(nestedPayload) ? nestedPayload : payloadEnvelope;
}

async function markEventIgnored(
  supabase: ReturnType<typeof createAdminClient>,
  eventId: string,
) {
  const result = await supabase
    .from("automation_events")
    .update({ status: "ignored" })
    .eq("id", eventId);

  if (result.error) {
    throw result.error;
  }
}

export async function processAutomationEvent(eventId: string) {
  const supabase = createAdminClient();

  const claimResult = await supabase
    .from("automation_events")
    .update({ status: "processing" })
    .eq("id", eventId)
    .eq("status", "received")
    .select("*")
    .maybeSingle();

  if (claimResult.error) {
    throw claimResult.error;
  }

  if (!claimResult.data) {
    return { ok: true, status: "skipped" as const };
  }

  const event = claimResult.data as AutomationEventRecord;
  let automation: AgentAutomationRecord | null = null;
  let runId: string | null = null;
  let runtimeStepId: string | null = null;

  try {
    const automationLookupResult = await supabase
      .from("agent_automations")
      .select("*")
      .eq("id", event.automation_id)
      .maybeSingle();

    if (automationLookupResult.error) {
      throw automationLookupResult.error;
    }

    automation = automationLookupResult.data as AgentAutomationRecord | null;

    if (!automation || automation.status !== "active") {
      await markEventIgnored(supabase, event.id);
      return { ok: true, status: "ignored" as const };
    }

    const agentResult = await supabase
      .from("agents")
      .select("*")
      .eq("id", automation.agent_id)
      .eq("workspace_id", automation.workspace_id)
      .maybeSingle();

    if (agentResult.error) {
      throw agentResult.error;
    }

    const agent = agentResult.data as AgentRecord | null;

    if (
      !agent ||
      agent.archived_at ||
      agent.status !== "active" ||
      agent.surface !== "automation"
    ) {
      await markEventIgnored(supabase, event.id);
      return { ok: true, status: "ignored" as const };
    }

    const payload = normalizeAutomationTriggerPayload(
      event.trigger_slug,
      readEventPayload(event),
    );
    const draftResult = await supabase
      .from("agent_drafts")
      .select("definition")
      .eq("agent_id", agent.id)
      .maybeSingle();

    if (draftResult.error) {
      throw draftResult.error;
    }

    const definition = (draftResult.data?.definition ?? null) as BuilderDefinition | null;
    const gmailRecipientPolicy = extractGmailRecipientPolicyFromDefinition(definition);
    const googleCalendarSelection = extractGoogleCalendarSelectionFromDefinition(definition);
    const calSelection = extractCalSelectionFromDefinition(definition);
    const enabledToolsByToolkit = extractEnabledToolsFromDefinition(definition);
    const runInsert = await supabase
      .from("runs")
      .insert({
        workspace_id: agent.workspace_id,
        agent_id: agent.id,
        status: "running",
        model: agent.model,
        input: {
          source: "composio",
          triggerSlug: event.trigger_slug,
          eventId: event.id,
          externalEventId: event.external_event_id,
          payload,
        },
        output: {},
        created_by: null,
      })
      .select()
      .single();

    if (runInsert.error) {
      throw runInsert.error;
    }

    const createdRunId = runInsert.data.id;
    runId = createdRunId;

    const eventLinkUpdate = await supabase
      .from("automation_events")
      .update({ run_id: createdRunId })
      .eq("id", event.id);

    if (eventLinkUpdate.error) {
      throw eventLinkUpdate.error;
    }

    const contextStep = await createRunStep(supabase, {
      runId: createdRunId,
      workspaceId: agent.workspace_id,
      agentId: agent.id,
      stepKey: "automation.context",
      stepType: "context",
      title: "Read trigger context",
      detail: "Preparing a bounded Gmail event context for the automation.",
      payload: {
        triggerSlug: event.trigger_slug,
        externalEventId: event.external_event_id,
        contextFields: Object.keys(payload),
      },
    });

    await completeRunStep(
      supabase,
      contextStep.id,
      "succeeded",
      "Trigger context prepared.",
      {
        triggerSlug: event.trigger_slug,
        contextFields: Object.keys(payload),
      },
    );

    const runtimeStep = await createRunStep(supabase, {
      runId: createdRunId,
      workspaceId: agent.workspace_id,
      agentId: agent.id,
      stepKey: "automation.execute",
      stepType: "model",
      title: "Execute automation event",
      detail: "Running external trigger binding with configured agent tools.",
      payload: {
        triggerSlug: event.trigger_slug,
        externalEventId: event.external_event_id,
        enabledToolsByToolkit,
      },
    });
    runtimeStepId = runtimeStep.id;

    await consumeWorkspaceMessageUsage(supabase, agent.workspace_id);

    const automationInput = buildAutomationInput(event.trigger_slug, payload);
    const result = await runAgentChat({
      supabase: supabase as never,
      agent,
      input: automationInput,
      history: [{ role: "user", content: automationInput }],
      toolUserId: buildWorkspaceComposioUserId(agent.workspace_id),
      audience: "automation",
      calendarTimezone: googleCalendarSelection.timezone,
      googleCalendarSelection,
      calSelection,
      gmailRecipientPolicy,
      enabledToolsByToolkit,
    });
    const automationResult = buildAutomationRunResult({
      assistantContent: result.assistantContent,
      toolMessages: result.toolMessages,
      runtimeHadError: result.debugTrace?.hadError,
      runtimeErrorSummary: result.debugTrace?.errorSummary ?? null,
    });
    const persistedRuntimeOutput = buildPersistedRunOutput({
      finalCompletion: result.finalCompletion,
      toolMessages: result.toolMessages,
      knowledgeMatches: result.knowledgeMatches,
    });

    const decisionStep = await createRunStep(supabase, {
      runId: createdRunId,
      workspaceId: agent.workspace_id,
      agentId: agent.id,
      stepKey: "automation.decision",
      stepType: "decision",
      title: "Record automation decision",
      detail: automationResult.summary,
      payload: {
        decision: automationResult.decision,
        reason: automationResult.reason,
        missingInformation: automationResult.missingInformation,
        actionCount: automationResult.actions.length,
      },
    });

    await completeRunStep(
      supabase,
      decisionStep.id,
      automationResult.decision === "action_failed" ? "failed" : "succeeded",
      automationResult.summary,
      {
        decision: automationResult.decision,
        reason: automationResult.reason,
        missingInformation: automationResult.missingInformation,
        actionCount: automationResult.actions.length,
      },
    );

    await Promise.all(
      automationResult.actions.map(async (action, index) => {
        const actionStep = await createRunStep(supabase, {
          runId: createdRunId,
          workspaceId: agent.workspace_id,
          agentId: agent.id,
          stepKey: `automation.action.${index + 1}`,
          stepType: "action",
          title: action.label,
          detail: action.detail,
          payload: {
            toolName: action.toolName,
            threadId: action.threadId,
            messageId: action.messageId,
          },
        });

        await completeRunStep(
          supabase,
          actionStep.id,
          action.status,
          action.detail,
          {
            toolName: action.toolName,
            threadId: action.threadId,
            messageId: action.messageId,
          },
        );
      }),
    );

    await completeRunStep(
      supabase,
      runtimeStep.id,
      "succeeded",
      "Automation execution completed.",
      {
        contentLength: result.assistantContent.length,
        toolMessageCount: result.toolMessages.length,
        knowledgeMatchCount: result.knowledgeMatches.length,
        connectedToolkits: result.connectedToolkits,
      },
    );

    const runUpdate = await supabase
      .from("runs")
      .update({
        status: "succeeded",
        output: {
          automationResult,
          assistantContent: automationResult.summary,
          assistantMetadata: buildPersistedAssistantMetadata(result.assistantMetadata),
          finalCompletion: persistedRuntimeOutput.finalCompletion,
          toolMessages: persistedRuntimeOutput.toolMessages,
          knowledgeMatches: persistedRuntimeOutput.knowledgeMatches,
          connectedToolkits: result.connectedToolkits,
        },
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId);

    if (runUpdate.error) {
      throw runUpdate.error;
    }

    const [eventUpdate, automationUpdate] = await Promise.all([
      supabase
        .from("automation_events")
        .update({ status: "processed" })
        .eq("id", event.id),
      supabase
        .from("agent_automations")
        .update({ last_event_at: new Date().toISOString(), last_error: null })
        .eq("id", automation.id),
    ]);

    if (eventUpdate.error) {
      throw eventUpdate.error;
    }

    if (automationUpdate.error) {
      throw automationUpdate.error;
    }

    return { ok: true, status: "processed" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Automation run failed.";

    if (runtimeStepId) {
      await completeRunStep(
        supabase,
        runtimeStepId,
        "failed",
        message,
      ).catch(() => undefined);
    }

    const failureUpdates = await Promise.all([
      runId
        ? supabase
            .from("runs")
            .update({
              status: "failed",
              error_message: message,
              completed_at: new Date().toISOString(),
            })
            .eq("id", runId)
        : Promise.resolve({ error: null }),
      supabase
        .from("automation_events")
        .update({ status: "failed" })
        .eq("id", event.id),
      automation
        ? supabase
            .from("agent_automations")
            .update({ last_error: message })
            .eq("id", automation.id)
        : Promise.resolve({ error: null }),
    ]);

    const failurePersistenceErrors = failureUpdates
      .map((result) => result.error?.message)
      .filter((value): value is string => Boolean(value));

    if (failurePersistenceErrors.length > 0) {
      console.error("Automation failure state persistence failed", {
        eventId: event.id,
        automationId: automation?.id ?? event.automation_id,
        errors: failurePersistenceErrors,
      });
    }

    throw error;
  }
}
