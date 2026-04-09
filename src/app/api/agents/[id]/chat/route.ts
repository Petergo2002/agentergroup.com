import { NextRequest, NextResponse } from "next/server";
import {
  INTERNAL_ASSISTANTS_DISABLED_CODE,
  INTERNAL_ASSISTANTS_DISABLED_MESSAGE,
  isInternalAssistantBlocked,
} from "@/lib/assistants/feature-flags";
import {
  CHAT_STREAM_RESPONSE_HEADERS,
  encodeChatStreamChunk,
} from "@/lib/chat-stream";
import { buildWorkspaceComposioUserId } from "@/lib/connections";
import {
  buildPersistedAssistantMetadata,
  buildPersistedRunOutput,
  buildPersistedToolMessages,
} from "@/lib/debug-trace-security";
import { extractEndChatPolicyFromDefinition } from "@/lib/end-chat";
import { extractGmailRecipientPolicyFromDefinition } from "@/lib/gmail";
import { extractGoogleCalendarSelectionFromDefinition } from "@/lib/google-calendar";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { createClient } from "@/lib/supabase/server";
import { runAgentChat } from "@/lib/runtime/agent-chat";
import {
  completeRunStep,
  createAuditLog,
  createRunStep,
} from "@/lib/runtime/observability";
import type { MessageRecord } from "@/lib/types";

interface PreviewThreadRecord {
  id: string;
  workspace_id: string;
  agent_id: string;
  created_by: string;
  source: "preview";
}

function mapHistory(messages: MessageRecord[]) {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
    tool_call_id: message.tool_call_id,
    metadata: message.metadata,
  })) as Array<{
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    tool_call_id?: string | null;
    metadata?: Record<string, unknown> | null;
  }>;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: agentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const input = String(body.message ?? "").trim();
  const providedThreadId = String(body.threadId ?? "").trim();

  if (!input) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const context = await ensureWorkspaceContext(supabase as never, user);

  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  if (isInternalAssistantBlocked(agent, context.workspace)) {
    return NextResponse.json(
      {
        error: INTERNAL_ASSISTANTS_DISABLED_MESSAGE,
        code: INTERNAL_ASSISTANTS_DISABLED_CODE,
      },
      { status: 403 },
    );
  }

  const { data: draft } = await supabase
    .from("agent_drafts")
    .select("definition")
    .eq("agent_id", agentId)
    .single();

  const endChatPolicy = extractEndChatPolicyFromDefinition(
    draft?.definition ?? null,
  );
  const gmailRecipientPolicy = extractGmailRecipientPolicyFromDefinition(
    draft?.definition ?? null,
  );
  const googleCalendarSelection = extractGoogleCalendarSelectionFromDefinition(
    draft?.definition ?? null,
  );
  const calendarTimezone = googleCalendarSelection.timezone;

  let threadId = providedThreadId;

  if (threadId) {
    const { data: existingThread, error: threadLookupError } = await supabase
      .from("chat_threads")
      .select("id, workspace_id, agent_id, created_by, source")
      .eq("id", threadId)
      .eq("workspace_id", agent.workspace_id)
      .eq("agent_id", agent.id)
      .eq("source", "preview")
      .eq("created_by", user.id)
      .maybeSingle();

    if (threadLookupError) {
      return NextResponse.json(
        { error: "Failed to load the preview thread." },
        { status: 500 },
      );
    }

    const previewThread = existingThread as PreviewThreadRecord | null;

    if (!previewThread) {
      return NextResponse.json(
        { error: "Preview thread not found for this agent." },
        { status: 404 },
      );
    }
  } else {
    const { data: thread, error: threadError } = await supabase
      .from("chat_threads")
      .insert({
        workspace_id: agent.workspace_id,
        agent_id: agent.id,
        source: "preview",
        created_by: user.id,
        title: input.slice(0, 48),
      })
      .select()
      .single();

    if (threadError || !thread) {
      return NextResponse.json({ error: "Failed to create thread." }, { status: 500 });
    }

    threadId = thread.id;
  }

  let runId: string | null = null;
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (payload: Parameters<typeof encodeChatStreamChunk>[0]) => {
        controller.enqueue(encoder.encode(encodeChatStreamChunk(payload)));
      };

      try {
        const { data: run, error: runError } = await supabase
          .from("runs")
          .insert({
            workspace_id: agent.workspace_id,
            agent_id: agent.id,
            thread_id: threadId,
            status: "running",
            model: agent.model,
            input: { message: input, source: "preview" },
            created_by: user.id,
          })
          .select()
          .single();

        if (runError || !run) {
          throw runError ?? new Error("Failed to create run.");
        }

        runId = run.id;
        send({
          type: "meta",
          threadId,
          runId: run.id,
        });

        await createAuditLog(supabase, {
          workspaceId: agent.workspace_id,
          agentId: agent.id,
          runId: run.id,
          actorId: user.id,
          action: "run.started",
          summary: "Started a conversational run.",
          metadata: {
            threadId,
            model: agent.model,
            source: "preview",
          },
        });

        const persistUserStep = await createRunStep(supabase, {
          runId: run.id,
          workspaceId: agent.workspace_id,
          agentId: agent.id,
          stepKey: "message.persist",
          stepType: "message",
          title: "Record user message",
          detail: "Persisting the incoming user message before runtime execution.",
        });

        const { error: userMessageError } = await supabase.from("messages").insert({
          thread_id: threadId,
          workspace_id: agent.workspace_id,
          role: "user",
          content: input,
          created_by: user.id,
        });

        if (userMessageError) {
          await completeRunStep(
            supabase,
            persistUserStep.id,
            "failed",
            userMessageError.message,
            { message: input },
          );
          throw new Error("Failed to record the message.");
        }

        await completeRunStep(
          supabase,
          persistUserStep.id,
          "succeeded",
          "User message recorded.",
          { messageLength: input.length },
        );

        const historyStep = await createRunStep(supabase, {
          runId: run.id,
          workspaceId: agent.workspace_id,
          agentId: agent.id,
          stepKey: "context.load",
          stepType: "context",
          title: "Load conversation context",
          detail: "Loading existing preview thread history.",
        });

        const { data: history, error: historyError } = await supabase
          .from("messages")
          .select("*")
          .eq("thread_id", threadId)
          .order("created_at", { ascending: true });

        if (historyError) {
          throw historyError;
        }

        await completeRunStep(
          supabase,
          historyStep.id,
          "succeeded",
          "Conversation history loaded.",
          { historyCount: history?.length ?? 0 },
        );

        const runtimeStep = await createRunStep(supabase, {
          runId: run.id,
          workspaceId: agent.workspace_id,
          agentId: agent.id,
          stepKey: "runtime.execute",
          stepType: "model",
          title: "Run agent runtime",
          detail: "Executing the shared agent runtime for preview chat.",
          payload: {
            model: agent.model,
          },
        });

        const result = await runAgentChat({
          supabase: supabase as never,
          agent,
          input,
          history: mapHistory((history ?? []) as MessageRecord[]),
          toolUserId: buildWorkspaceComposioUserId(agent.workspace_id),
          audience: "preview",
          knowledgeAccessToken: session?.access_token ?? null,
          calendarTimezone,
          googleCalendarSelection,
          endChatPolicy,
          gmailRecipientPolicy,
          onToken: (token) => {
            send({
              type: "delta",
              delta: token,
            });
          },
        });

        await completeRunStep(
          supabase,
          runtimeStep.id,
          "succeeded",
          "Shared runtime completed successfully.",
          {
            toolMessageCount: result.toolMessages.length,
            knowledgeMatchCount: result.knowledgeMatches.length,
          },
        );

        const persistedToolMessages = buildPersistedToolMessages(result.toolMessages);
        const persistedAssistantMetadata = buildPersistedAssistantMetadata(
          result.assistantMetadata,
        );
        const persistedRunOutput = buildPersistedRunOutput({
          finalCompletion: result.finalCompletion,
          toolMessages: result.toolMessages,
          knowledgeMatches: result.knowledgeMatches,
        });

        if (result.toolMessages.length > 0) {
          const { error: toolMessageError } = await supabase.from("messages").insert(
            persistedToolMessages.map((message) => ({
              thread_id: threadId,
              workspace_id: agent.workspace_id,
              role: "tool",
              content: String(message.content ?? ""),
              tool_name: message.name ?? null,
              tool_call_id: message.tool_call_id ?? null,
              metadata: message,
              created_by: user.id,
            })),
          );

          if (toolMessageError) {
            throw toolMessageError;
          }
        }

        const persistAssistantStep = await createRunStep(supabase, {
          runId: run.id,
          workspaceId: agent.workspace_id,
          agentId: agent.id,
          stepKey: "message.assistant",
          stepType: "message",
          title: "Persist assistant response",
          detail: "Saving the final assistant message back to the thread.",
        });

        const { error: assistantMessageError } = await supabase
          .from("messages")
          .insert({
            thread_id: threadId,
            workspace_id: agent.workspace_id,
            role: "assistant",
            content: result.assistantContent,
            metadata: persistedAssistantMetadata,
            created_by: user.id,
          });

        if (assistantMessageError) {
          throw assistantMessageError;
        }

        await completeRunStep(
          supabase,
          persistAssistantStep.id,
          "succeeded",
          "Assistant message persisted.",
          { contentLength: result.assistantContent.length },
        );

        await Promise.all([
          supabase
            .from("runs")
            .update({
              status: "succeeded",
              output: persistedRunOutput,
              completed_at: new Date().toISOString(),
            })
            .eq("id", run.id),
          supabase
            .from("chat_threads")
            .update({
              title: agent.name,
            })
            .eq("id", threadId),
          createAuditLog(supabase, {
            workspaceId: agent.workspace_id,
            agentId: agent.id,
            runId: run.id,
            actorId: user.id,
            action: "run.succeeded",
            summary: "Completed a conversational run successfully.",
            metadata: {
              source: "preview",
              connectedToolkits: result.connectedToolkits,
            },
          }),
        ]);

        send({
          type: "complete",
          threadId,
          runId: run.id,
          sessionCompleted: Boolean(result.endChat?.sessionCompleted),
          endReason: result.endChat?.reason ?? null,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to run agent.";

        if (runId) {
          try {
            await Promise.all([
              supabase
                .from("runs")
                .update({
                  status: "failed",
                  error_message: message,
                  completed_at: new Date().toISOString(),
                })
                .eq("id", runId),
              createAuditLog(supabase, {
                workspaceId: agent.workspace_id,
                agentId: agent.id,
                runId,
                actorId: user.id,
                action: "run.failed",
                summary: "A conversational run failed.",
                metadata: {
                  error: message,
                  source: "preview",
                },
              }),
            ]);
          } catch (persistError) {
            console.error("Failed to persist preview stream failure:", persistError);
          }
        }

        send({
          type: "error",
          error: message,
        });
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: CHAT_STREAM_RESPONSE_HEADERS,
  });
}
