import type { WidgetLeadRecord } from "@/lib/types";
import type { WidgetAdminSupabase } from "./server-types";

export async function insertWidgetLead(
  supabase: WidgetAdminSupabase,
  input: Omit<WidgetLeadRecord, "id" | "created_at">,
) {
  const { data, error } = await supabase
    .from("widget_leads")
    .insert(input)
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create widget lead.");
  }

  return data as WidgetLeadRecord;
}