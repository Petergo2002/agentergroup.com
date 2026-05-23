import { requireAdminUser } from "@/lib/admin/auth";
import { successResponse } from "@/lib/app/responses";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  await requireAdminUser();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("agent_library_templates")
    .select(
      "*, sources:agent_library_template_sources(*), submitter:profiles!agent_library_templates_submitted_by_fkey(email), source_workspace:workspaces(name)",
    )
    .order("created_at", { ascending: false });

  if (error) {
    return successResponse({ templates: [], error: error.message }, 500);
  }

  return successResponse({ templates: data ?? [] });
}
