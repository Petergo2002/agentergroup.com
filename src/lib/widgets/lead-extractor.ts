import type { WidgetAdminSupabase } from "./server-types";
import { insertWidgetLead } from "./leads";
import { extractContactFromMessages } from "./lead-contact";

export { extractContactFromMessages } from "./lead-contact";

interface AutoCaptureLeadInput {
  widgetId: string;
  widgetSessionId: string;
  widgetAgentId: string | null;
  agentId: string;
  messages: Array<{ role: string; content: string }>;
}

/**
 * Creates or enriches one lead for a widget conversation when the visitor
 * shares an email address or phone number.
 *
 * - Only runs extraction on user messages to avoid false positives.
 * - Reuses the existing session lead so contact details can arrive over
 *   multiple messages without creating duplicates.
 * - Uses "Website Visitor" as a fallback name when no name is detected.
 */
export async function autoCaptureLead(
  supabase: WidgetAdminSupabase,
  input: AutoCaptureLeadInput,
): Promise<void> {
  const extracted = extractContactFromMessages(input.messages);

  if (!extracted) return;

  const { data: existingLeads, error: existingLeadError } = await supabase
    .from("widget_leads")
    .select<{
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
      widget_agent_id: string | null;
      agent_id: string | null;
    }>("id, name, email, phone, widget_agent_id, agent_id")
    .eq("widget_session_id", input.widgetSessionId);

  if (existingLeadError) {
    throw new Error(existingLeadError.message);
  }

  const existingLead = existingLeads?.[0];

  if (existingLead) {
    const { error } = await supabase
      .from("widget_leads")
      .update({
        name:
          extracted.name ??
          existingLead.name ??
          "Website Visitor",
        email: extracted.email ?? existingLead.email,
        phone: extracted.phone ?? existingLead.phone,
        widget_agent_id:
          existingLead.widget_agent_id ?? input.widgetAgentId,
        agent_id: existingLead.agent_id ?? input.agentId,
      })
      .eq("id", existingLead.id);

    if (error) {
      throw new Error(error.message);
    }

    return;
  }

  await insertWidgetLead(supabase, {
    widget_id: input.widgetId,
    widget_session_id: input.widgetSessionId,
    widget_agent_id: input.widgetAgentId,
    agent_id: input.agentId,
    name: extracted.name ?? "Website Visitor",
    email: extracted.email,
    phone: extracted.phone,
    message: null,
  });
}
