import { createHash } from "node:crypto";
import { after, NextRequest, NextResponse } from "next/server";
import { processAutomationEvent } from "@/lib/automation/executor";
import { verifyComposioWebhook } from "@/lib/composio";
import { hasComposioEnv, hasComposioWebhookSecret } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AgentAutomationRecord } from "@/lib/types";

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
    return NextResponse.json({ error: "Composio webhook is not configured." }, { status: 500 });
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
  const triggerSlug = triggerPayload.triggerSlug;
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
  ].filter((value): value is string => Boolean(value));

  if (triggerIdCandidates.length === 0) {
    return NextResponse.json({ ok: true, status: "ignored" });
  }

  const supabase = createAdminClient();
  const { data: automation } = await supabase
    .from("agent_automations")
    .select("*")
    .in("composio_trigger_id", triggerIdCandidates)
    .maybeSingle();

  if (!automation || automation.status !== "active") {
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
