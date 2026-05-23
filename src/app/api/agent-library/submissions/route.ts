import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { errorResponse, successResponse } from "@/lib/app/responses";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse("Unauthorized", 401);
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const { data, error } = await supabase
    .from("agent_library_templates")
    .select(
      "*, sources:agent_library_template_sources(id, source_name, original_source_type)",
    )
    .eq("source_workspace_id", context.workspace.id)
    .order("created_at", { ascending: false });

  if (error) {
    return errorResponse(error.message, 500);
  }

  return successResponse({
    templates: data ?? [],
  });
}
