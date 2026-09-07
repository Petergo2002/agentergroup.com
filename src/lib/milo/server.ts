import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const provisionResultSchema = z.object({
  agentId: z.string().uuid(),
  widgetId: z.string().uuid(),
  created: z.boolean(),
  adopted: z.boolean(),
  createdAgent: z.boolean().optional(),
  createdWidget: z.boolean().optional(),
  createdLink: z.boolean().optional(),
});

export type MiloProvisionResult = z.infer<typeof provisionResultSchema>;

export class MiloProvisionError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "MiloProvisionError";
  }
}

function normalizeProvisionError(message: string) {
  if (message.includes("MILO_PROVISION_UNAUTHORIZED")) return "milo_provision_unauthorized";
  if (message.includes("MILO_PROVISION_AMBIGUOUS")) return "milo_provision_ambiguous";
  if (message.includes("AGENT_LIMIT_REACHED")) return "agent_limit_reached";
  if (message.includes("WIDGET_LIMIT_REACHED")) return "widget_limit_reached";
  return "milo_provision_failed";
}

export async function provisionWorkspaceMilo(input: {
  workspaceId: string;
  actorId: string;
}): Promise<MiloProvisionResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("provision_workspace_milo_v1", {
    p_workspace_id: input.workspaceId,
    p_actor_id: input.actorId,
  });

  if (error) {
    throw new MiloProvisionError(normalizeProvisionError(error.message));
  }

  const parsed = provisionResultSchema.safeParse(data);
  if (!parsed.success) throw new MiloProvisionError("milo_provision_invalid_response");
  return parsed.data;
}
