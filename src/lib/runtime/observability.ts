import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApprovalStatus, RunStepStatus } from "@/lib/types";

type SupabaseLike = Pick<SupabaseClient, "from">;

interface StepInput {
  runId: string;
  workspaceId: string;
  agentId: string;
  stepKey: string;
  stepType: string;
  title: string;
  detail?: string | null;
  status?: RunStepStatus;
  payload?: Record<string, unknown>;
}

interface ApprovalInput {
  runId: string;
  workspaceId: string;
  agentId: string;
  stepId?: string | null;
  title: string;
  detail?: string | null;
  requestedBy?: string | null;
  status?: ApprovalStatus;
  metadata?: Record<string, unknown>;
}

interface AuditInput {
  workspaceId: string;
  action: string;
  summary: string;
  agentId?: string | null;
  runId?: string | null;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function createRunStep(supabase: SupabaseLike, input: StepInput) {
  const { data, error } = await supabase
    .from("run_steps")
    .insert({
      run_id: input.runId,
      workspace_id: input.workspaceId,
      agent_id: input.agentId,
      step_key: input.stepKey,
      step_type: input.stepType,
      title: input.title,
      detail: input.detail ?? null,
      status: input.status ?? "running",
      payload: input.payload ?? {},
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as { id: string };
}

export async function completeRunStep(
  supabase: SupabaseLike,
  stepId: string,
  status: RunStepStatus,
  detail?: string | null,
  payload?: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("run_steps")
    .update({
      status,
      detail: detail ?? null,
      payload: payload ?? {},
      completed_at: new Date().toISOString(),
    })
    .eq("id", stepId);

  if (error) {
    throw error;
  }
}

export async function createApprovalRequest(supabase: SupabaseLike, input: ApprovalInput) {
  const { error } = await supabase.from("run_approvals").insert({
    run_id: input.runId,
    workspace_id: input.workspaceId,
    agent_id: input.agentId,
    step_id: input.stepId ?? null,
    status: input.status ?? "pending",
    title: input.title,
    detail: input.detail ?? null,
    requested_by: input.requestedBy ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) {
    throw error;
  }
}

export async function createAuditLog(supabase: SupabaseLike, input: AuditInput) {
  const { error } = await supabase.from("audit_logs").insert({
    workspace_id: input.workspaceId,
    agent_id: input.agentId ?? null,
    run_id: input.runId ?? null,
    actor_id: input.actorId ?? null,
    action: input.action,
    summary: input.summary,
    metadata: input.metadata ?? {},
  });

  if (error) {
    throw error;
  }
}
