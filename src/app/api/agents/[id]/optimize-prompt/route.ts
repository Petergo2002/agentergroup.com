import { NextRequest, NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { createClient } from "@/lib/supabase/server";
import { createOpenRouterChatCompletion } from "@/lib/openrouter";
import {
  consumeWorkspaceMessageUsage,
  MessageLimitExceededError,
} from "@/lib/message-usage";
import { createAdminClient } from "@/lib/supabase/admin";
import { WorkspaceAccessError, assertOwnedWorkspaceResource } from "@/lib/workspace-security";

export async function POST(
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
  const body = await request.json().catch(() => ({}));
  const currentInstructions =
    typeof body.instructions === "string" ? body.instructions.trim() : "";

  if (!currentInstructions) {
    return NextResponse.json(
      { error: "No instructions provided to optimize." },
      { status: 400 },
    );
  }

  const agentResult = await supabase
    .from("agents")
    .select("id, name, description, workspace_id")
    .eq("id", agentId)
    .maybeSingle();

  if (agentResult.error) {
    return NextResponse.json({ error: agentResult.error.message }, { status: 500 });
  }

  const agent = agentResult.data;

  if (!agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  try {
    assertOwnedWorkspaceResource(
      agent,
      context.workspace.id,
      "You do not have access to optimize this agent's prompt.",
    );
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }

  const targetWorkspace = context.workspaces.find(
    (entry) => entry.workspace.id === agent.workspace_id,
  );

  if (!targetWorkspace) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  }

  if (targetWorkspace.membership.role !== "owner" && targetWorkspace.membership.role !== "admin" && targetWorkspace.membership.role !== "member") {
    return NextResponse.json(
      { error: "You do not have permission to edit this agent." },
      { status: 403 },
    );
  }

  const systemMessage = {
    role: "system",
    content: `You are an expert AI Prompt Engineer and System Architect. Your task is to rewrite and optimize a draft system prompt into a highly effective, industry-standard operational instruction set for an AI agent.

Agent Name: ${agent.name}
Agent Description: ${agent.description || 'No description provided.'}

RULES:
1. Maintain all original intent, constraints, and instructions from the draft.
2. Structure the prompt using clear Markdown headings (e.g., # ROLE, # CAPABILITIES, # TONE, # RULES).
3. Use concise bullet points for rules and constraints.
4. Improve clarity, professionalism, and tone. Remove ambiguity.
5. If the draft lacks structure, impose a logical flow.
6. DO NOT invent new features, capabilities, or tools that the user didn't mention.
7. Return ONLY the rewritten prompt. Do not include introductory or concluding conversational text (e.g., "Here is your prompt:").`,
  };

  const userMessage = {
    role: "user",
    content: `Here are the draft instructions to optimize:\n\n${currentInstructions}`,
  };

  try {
    await consumeWorkspaceMessageUsage(createAdminClient(), agent.workspace_id);

    const response = await createOpenRouterChatCompletion({
      messages: [systemMessage, userMessage],
      stream: false,
    });

    const optimizedInstructions = response.choices?.[0]?.message?.content?.trim();

    if (!optimizedInstructions) {
      throw new Error("Received an empty response from the AI optimizer.");
    }

    return NextResponse.json({ optimizedInstructions });
  } catch (error) {
    if (error instanceof MessageLimitExceededError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    console.error("Prompt optimization failed:", error);
    const message = error instanceof Error ? error.message : "Failed to optimize prompt.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
