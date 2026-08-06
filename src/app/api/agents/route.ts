import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { buildAgentPayload, buildInitialDefinition } from "@/lib/agents/defaults";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const createAgentRequestSchema = z.object({
  requestId: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  surface: z.enum(["widget", "automation", "assistant"]),
  timezone: z.string().trim().min(1).max(100).default("UTC"),
});

const createAgentResultSchema = z.object({
  agentId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  surface: z.enum(["widget", "automation", "assistant"]),
});

function buildCreationError(error: { message?: string; code?: string | null }) {
  const message = error.message ?? "";

  if (message.includes("AGENT_LIMIT_REACHED")) {
    return {
      status: 403,
      body: {
        error: "You have reached your agent limit. Please upgrade your plan.",
        code: "agent_limit_reached",
      },
    };
  }

  if (message.includes("AGENT_KIND_DISABLED")) {
    return {
      status: 403,
      body: {
        error: "This agent type is not enabled for the active workspace.",
        code: "agent_kind_disabled",
      },
    };
  }

  if (
    message.includes("AGENT_CREATE_UNAUTHORIZED") ||
    message.includes("AGENT_PRODUCT_WORKSPACE_ACCESS_DENIED") ||
    error.code === "42501"
  ) {
    return {
      status: 403,
      body: {
        error: "You do not have permission to create this agent.",
        code: "agent_create_unauthorized",
      },
    };
  }

  if (message.includes("AGENT_CREATION_IDEMPOTENCY_CONFLICT")) {
    return {
      status: 409,
      body: {
        error: "This agent creation request conflicts with an earlier request.",
        code: "agent_creation_conflict",
      },
    };
  }

  if (message.includes("AGENT_CREATE_INVALID_REQUEST") || error.code === "22023") {
    return {
      status: 400,
      body: {
        error: "The agent creation request is invalid.",
        code: "invalid_agent_request",
      },
    };
  }

  return {
    status: 500,
    body: {
      error: "Failed to create agent.",
      code: "agent_creation_failed",
    },
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createAgentRequestSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid agent creation request.", code: "invalid_agent_request" },
      { status: 400 },
    );
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const { requestId, name, surface, timezone } = parsed.data;
  const agentPayload = buildAgentPayload("custom", name, surface, timezone);
  const initialDefinition = buildInitialDefinition("custom", surface, timezone);
  const identityKind = surface === "widget" ? "legacy_widget" : surface;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_agent_v1", {
    p_request_id: requestId,
    p_actor_id: user.id,
    p_workspace_id: context.workspace.id,
    p_identity_kind: identityKind,
    p_name: agentPayload.name,
    p_source: "blank",
    p_template_id: null,
    p_description: agentPayload.description,
    p_model: agentPayload.model,
    p_instructions: agentPayload.instructions,
    p_starter_prompts: agentPayload.starter_prompts,
    p_timezone: agentPayload.timezone,
    p_initial_definition: initialDefinition,
  });

  if (error) {
    const response = buildCreationError(error);
    return NextResponse.json(response.body, { status: response.status });
  }

  const result = createAgentResultSchema.safeParse(data);

  if (!result.success || result.data.workspaceId !== context.workspace.id) {
    return NextResponse.json(
      { error: "Failed to create agent.", code: "invalid_agent_response" },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: result.data.agentId }, { status: 201 });
}
