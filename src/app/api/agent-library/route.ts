import { successResponse } from "@/lib/app/responses";
import { createClient } from "@/lib/supabase/server";
import type {
  AgentLibraryTemplateRecord,
  AgentLibraryTemplateSourceRecord,
} from "@/lib/types";

type TemplateJoinRow = AgentLibraryTemplateRecord & {
  sources?: Pick<AgentLibraryTemplateSourceRecord, "id" | "source_name" | "original_source_type">[];
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return successResponse({ templates: [] });
  }

  const { data, error } = await supabase
    .from("agent_library_templates")
    .select(
      "*, sources:agent_library_template_sources(id, source_name, original_source_type)",
    )
    .eq("status", "approved")
    .order("approved_at", { ascending: false });

  if (error) {
    return successResponse({ templates: [], error: error.message }, 500);
  }

  return successResponse({
    templates: ((data ?? []) as unknown as TemplateJoinRow[]).map((template) => ({
      ...template,
      sources: template.sources ?? [],
    })),
  });
}
