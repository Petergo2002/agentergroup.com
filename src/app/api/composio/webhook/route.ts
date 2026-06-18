import { createHash } from "node:crypto";
import { after, NextRequest, NextResponse } from "next/server";
import { processAutomationEvent } from "@/lib/automation/executor";
import { verifyComposioWebhook } from "@/lib/composio";
import { hasComposioEnv, hasComposioWebhookSecret } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AgentAutomationRecord, ConnectionRecord } from "@/lib/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function readNestedString(value: unknown, path: string[]) {
  let current = value;

  for (const key of path) {
    if (!isRecord(current) || !Object.hasOwn(current, key)) {
      return null;
    }

    current = Reflect.get(current, key);
  }

  return pickString(current);
}

const COMPOSIO_TRIGGER_MESSAGE_EVENT = "composio.trigger.message";
const COMPOSIO_CONNECTION_EXPIRED_EVENT = "composio.connected_account.expired";
const COMPOSIO_TRIGGER_DISABLED_EVENT = "composio.trigger.disabled";

async function markExpiredConnectedAccount(
  supabase: ReturnType<typeof createAdminClient>,
  eventPayload: Record<string, unknown>,
) {
  const data = isRecord(eventPayload.data) ? eventPayload.data : {};
  const accountId = pickString(data.id, data.nanoid, data.connectedAccountId);
  const toolkitSlug =
    readNestedString(data, ["toolkit", "slug"]) ??
    pickString(data.toolkitSlug, data.appName);
  const status = pickString(data.status) ?? "EXPIRED";
  const statusReason =
    pickString(data.status_reason, data.statusReason) ??
    "Connected account expired.";
  const authConfigId =
    readNestedString(data, ["auth_config", "id"]) ??
    readNestedString(data, ["authConfig", "id"]);

  if (!accountId) {
    console.warn("[Composio] Ignoring expiry webhook without connected account id.");
    return { status: "ignored", reason: "missing_account_id" };
  }

  let query = supabase
    .from("connections")
    .select(
      "id, workspace_id, provider, toolkit_slug, display_name, status, external_id, account_label, toolkit_data, created_by, last_synced_at, created_at, updated_at",
    )
    .eq("provider", "composio")
    .eq("external_id", accountId);

  if (toolkitSlug) {
    query = query.eq("toolkit_slug", toolkitSlug);
  }

  const { data: connections, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const connectionRows = (connections ?? []) as ConnectionRecord[];

  if (connectionRows.length === 0) {
    console.warn("[Composio] Expiry webhook did not match a local connection.", {
      accountId,
      toolkitSlug,
    });
    return { status: "ignored", reason: "connection_not_found" };
  }

  const syncTimestamp = new Date().toISOString();
  const eventId = pickString(eventPayload.id);

  for (const connection of connectionRows) {
    const nextToolkitData = {
      ...(connection.toolkit_data ?? {}),
      ...data,
      authConfig: isRecord(data.auth_config)
        ? data.auth_config
        : isRecord(data.authConfig)
          ? data.authConfig
          : connection.toolkit_data?.authConfig,
      authConfigId:
        authConfigId ??
        pickString(connection.toolkit_data?.authConfigId) ??
        readNestedString(connection.toolkit_data, ["authConfig", "id"]),
      status,
      statusReason,
      status_reason: statusReason,
      lastExpiryEvent: {
        id: eventId,
        accountId,
        toolkitSlug: toolkitSlug ?? connection.toolkit_slug,
        status,
        statusReason,
        receivedAt: syncTimestamp,
      },
    };

    const { error: updateError } = await supabase
      .from("connections")
      .update({
        status: "disconnected",
        toolkit_data: nextToolkitData,
        last_synced_at: syncTimestamp,
      })
      .eq("id", connection.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    const { data: automations, error: automationsError } = await supabase
      .from("agent_automations")
      .select("id, agent_id")
      .eq("connection_id", connection.id)
      .in("status", ["active", "provisioning"]);

    if (automationsError) {
      throw new Error(automationsError.message);
    }

    const automationRows = (automations ?? []) as Array<{ id: string; agent_id: string }>;

    if (automationRows.length > 0) {
      const message = `Connected account expired: ${statusReason}`;
      const automationIds = automationRows.map((automation) => automation.id);
      const agentIds = automationRows.map((automation) => automation.agent_id);
      const [automationUpdate, agentUpdate] = await Promise.all([
        supabase
          .from("agent_automations")
          .update({ status: "error", last_error: message })
          .in("id", automationIds),
        supabase.from("agents").update({ status: "paused" }).in("id", agentIds),
      ]);

      if (automationUpdate.error) {
        throw new Error(automationUpdate.error.message);
      }

      if (agentUpdate.error) {
        throw new Error(agentUpdate.error.message);
      }
    }
  }

  return { status: "accepted", updated: connectionRows.length };
}

async function markDisabledTrigger(
  supabase: ReturnType<typeof createAdminClient>,
  eventPayload: Record<string, unknown>,
) {
  const data = isRecord(eventPayload.data) ? eventPayload.data : {};
  const triggerId = pickString(data.id, data.trigger_id, data.triggerId);
  const disabledReason =
    pickString(data.disabled_reason, data.disabledReason) ?? "unknown reason";

  if (!triggerId) {
    console.warn("[Composio] Ignoring disabled-trigger webhook without trigger id.");
    return { status: "ignored", reason: "missing_trigger_id" };
  }

  const { data: automation, error } = await supabase
    .from("agent_automations")
    .select("id, agent_id")
    .eq("composio_trigger_id", triggerId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!automation) {
    console.warn("[Composio] Disabled-trigger webhook did not match a local automation.", {
      triggerId,
      disabledReason,
    });
    return { status: "ignored", reason: "automation_not_found" };
  }

  const message = `Composio disabled the trigger: ${disabledReason}`;
  const [automationUpdate, agentUpdate] = await Promise.all([
    supabase
      .from("agent_automations")
      .update({ status: "error", last_error: message })
      .eq("id", automation.id),
    supabase.from("agents").update({ status: "paused" }).eq("id", automation.agent_id),
  ]);

  if (automationUpdate.error) {
    throw new Error(automationUpdate.error.message);
  }

  if (agentUpdate.error) {
    throw new Error(agentUpdate.error.message);
  }

  return { status: "accepted", updated: 1 };
}

function buildExternalEventId(triggerId: string, rawBody: string, payload: Record<string, unknown>) {
  const payloadEventId = pickString(
    payload.id,
    payload.messageId,
    payload.message_id,
    payload.historyId,
    payload.threadId,
    payload.thread_id,
  );

  if (payloadEventId) {
    return `${triggerId}:${payloadEventId}`;
  }

  return `${triggerId}:${createHash("sha256").update(rawBody).digest("hex")}`;
}

export async function POST(request: NextRequest) {
  if (!hasComposioEnv() || !hasComposioWebhookSecret()) {
    return NextResponse.json({ error: "Connection webhook is not configured." }, { status: 500 });
  }

  const rawBody = await request.text();
  let verified: Awaited<ReturnType<typeof verifyComposioWebhook>>;

  try {
    verified = await verifyComposioWebhook(rawBody, request.headers);
  } catch (error) {
    console.error("Composio webhook verification failed", error);
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const triggerPayload = verified.payload;
  const rawEventRecord = isRecord(verified.rawPayload)
    ? verified.rawPayload
    : null;
  const rawEventMetadataValue = rawEventRecord
    ? Reflect.get(rawEventRecord, "metadata")
    : null;
  const rawEventDataValue = rawEventRecord
    ? Reflect.get(rawEventRecord, "data")
    : null;
  const rawEventMetadata =
    isRecord(rawEventMetadataValue)
      ? rawEventMetadataValue
      : {};
  const rawEventData =
    isRecord(rawEventDataValue)
      ? rawEventDataValue
      : {};
  const eventType = rawEventRecord
    ? pickString(Reflect.get(rawEventRecord, "type"))
    : null;
  const rawEventId = rawEventRecord
    ? pickString(Reflect.get(rawEventRecord, "id"))
    : null;

  if (eventType === COMPOSIO_CONNECTION_EXPIRED_EVENT && rawEventRecord) {
    try {
      const result = await markExpiredConnectedAccount(
        createAdminClient(),
        rawEventRecord,
      );
      return NextResponse.json({ ok: true, ...result });
    } catch (error) {
      console.error("Composio expiry webhook processing failed", error);
      return NextResponse.json(
        { error: "Failed to process expiry webhook." },
        { status: 500 },
      );
    }
  }

  if (eventType === COMPOSIO_TRIGGER_DISABLED_EVENT && rawEventRecord) {
    try {
      const result = await markDisabledTrigger(createAdminClient(), rawEventRecord);
      return NextResponse.json({ ok: true, ...result });
    } catch (error) {
      console.error("Composio disabled-trigger webhook processing failed", error);
      return NextResponse.json(
        { error: "Failed to process disabled-trigger webhook." },
        { status: 500 },
      );
    }
  }

  if (eventType && eventType !== COMPOSIO_TRIGGER_MESSAGE_EVENT) {
    return NextResponse.json({ ok: true, status: "ignored" });
  }

  const triggerSlug =
    pickString(triggerPayload.triggerSlug, rawEventMetadata.trigger_slug, rawEventMetadata.triggerSlug) ??
    "UNKNOWN";
  const rawPayload = triggerPayload.payload ?? triggerPayload.originalPayload ?? {};
  const payload = isRecord(rawPayload) ? rawPayload : { value: rawPayload };
  const metadata: Record<string, unknown> = isRecord(triggerPayload.metadata)
    ? triggerPayload.metadata
    : {};
  const triggerIdCandidates = [
    metadata.id,
    metadata.uuid,
    triggerPayload.id,
    triggerPayload.uuid,
    rawEventMetadata.trigger_id,
    rawEventMetadata.triggerId,
    rawEventMetadata.id,
    rawEventMetadata.uuid,
    rawEventData.trigger_id,
    rawEventData.triggerId,
    rawEventData.trigger_nano_id,
    rawEventData.triggerNanoId,
  ].filter((value): value is string => Boolean(value));

  if (triggerIdCandidates.length === 0) {
    console.warn("[Composio] Ignoring trigger webhook without trigger id.", {
      eventType,
      triggerSlug,
      webhookVersion: verified.version,
      eventId: rawEventId,
    });
    return NextResponse.json({ ok: true, status: "ignored" });
  }

  const supabase = createAdminClient();
  const { data: automation, error: automationError } = await supabase
    .from("agent_automations")
    .select("*")
    .in("composio_trigger_id", triggerIdCandidates)
    .maybeSingle();

  if (automationError) {
    console.error("[Composio] Failed to look up trigger automation.", {
      message: automationError.message,
      triggerIdCandidates,
      triggerSlug,
    });
    return NextResponse.json({ error: automationError.message }, { status: 500 });
  }

  if (!automation || automation.status !== "active") {
    console.warn("[Composio] Ignoring trigger webhook without active automation.", {
      triggerIdCandidates,
      triggerSlug,
      automationStatus: automation?.status ?? null,
      webhookVersion: verified.version,
      eventId: rawEventId,
    });
    return NextResponse.json({ ok: true, status: "ignored" });
  }

  const automationRecord = automation as AgentAutomationRecord;

  const externalEventId = buildExternalEventId(
    automationRecord.composio_trigger_id ?? triggerIdCandidates[0],
    rawBody,
    payload,
  );

  const eventInsert = await supabase
    .from("automation_events")
    .insert({
      workspace_id: automationRecord.workspace_id,
      agent_id: automationRecord.agent_id,
      automation_id: automationRecord.id,
      external_event_id: externalEventId,
      trigger_slug: triggerSlug,
      payload: {
        payload,
        metadata,
        webhookVersion: verified.version,
      },
      status: "received",
    })
    .select()
    .maybeSingle();

  if (eventInsert.error) {
    if (eventInsert.error.code === "23505") {
      const existingEvent = await supabase
        .from("automation_events")
        .select("id, status")
        .eq("automation_id", automationRecord.id)
        .eq("external_event_id", externalEventId)
        .maybeSingle();

      if (existingEvent.data?.status === "received") {
        const existingEventId = existingEvent.data.id;

        after(async () => {
          await processAutomationEvent(existingEventId).catch((error) => {
            console.error("Automation duplicate event processing failed", {
              eventId: existingEventId,
              automationId: automationRecord.id,
              message: error instanceof Error ? error.message : "Unknown error",
            });
          });
        });
      }

      return NextResponse.json({ ok: true, status: "duplicate" });
    }

    return NextResponse.json({ error: eventInsert.error.message }, { status: 500 });
  }

  const event = eventInsert.data;

  after(async () => {
    await processAutomationEvent(event.id).catch((error) => {
      console.error("Automation event processing failed", {
        eventId: event.id,
        automationId: automationRecord.id,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    });
  });

  return NextResponse.json({ ok: true, status: "accepted" });
}
