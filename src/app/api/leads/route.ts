import { NextResponse, type NextRequest } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import {
  serializeLeadConversationSummary,
  type LeadConversationSummaryRow,
} from "@/lib/leads/conversation-summary";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { WidgetLeadListItem } from "@/lib/types";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface LeadQueryRow {
  id: string;
  widget_id: string;
  widget_session_id: string | null;
  widget_agent_id: string | null;
  agent_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  created_at: string;
  widgets: { name: string; workspace_id: string } | Array<{ name: string; workspace_id: string }>;
  agents: { name: string } | Array<{ name: string }> | null;
}

interface ConversationMessageCountRow {
  widget_session_id: string;
  message_count: number;
}

/**
 * Clamps the optional request limit to a predictable, bounded result size.
 */
function normalizeLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, MAX_LIMIT);
}

/**
 * Escapes user-entered wildcard and quoting characters for a PostgREST ilike filter.
 */
function escapePostgrestLikePattern(value: string) {
  return value.replace(/[\\%_"]/g, (character) => `\\${character}`);
}

/**
 * Normalizes Supabase relationship values that may be returned as an object or array.
 */
function firstRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

/**
 * Returns workspace-scoped widget leads with related widget and agent display names.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const widgetId = request.nextUrl.searchParams.get("widgetId")?.trim() || null;
  const search = request.nextUrl.searchParams.get("search")?.trim().slice(0, 120) || "";
  const limit = normalizeLimit(request.nextUrl.searchParams.get("limit"));

  if (widgetId && !UUID_PATTERN.test(widgetId)) {
    return NextResponse.json({ error: "Invalid widget filter." }, { status: 400 });
  }

  try {
    const context = await ensureWorkspaceContext(supabase as never, user);
    const admin = createAdminClient();
    let query = admin
      .from("widget_leads")
      .select(
        `
          id,
          widget_id,
          widget_session_id,
          widget_agent_id,
          agent_id,
          name,
          email,
          phone,
          message,
          created_at,
          widgets!inner(name, workspace_id),
          agents(name)
        `,
      )
      .eq("widgets.workspace_id", context.workspace.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (widgetId) {
      query = query.eq("widget_id", widgetId);
    }

    if (search) {
      const pattern = escapePostgrestLikePattern(search);
      query = query.or(
        `name.ilike."%${pattern}%",email.ilike."%${pattern}%",phone.ilike."%${pattern}%"`,
      );
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const leadRows = (data ?? []) as unknown as LeadQueryRow[];
    const leadIds = leadRows.map((row) => row.id);
    const sessionIds = leadRows.flatMap((row) =>
      row.widget_session_id ? [row.widget_session_id] : [],
    );
    const [summaryResult, messageCountResult] = await Promise.all([
      leadIds.length > 0
        ? admin
            .from("lead_conversation_summaries")
            .select(
              "lead_id, workspace_id, widget_session_id, status, summary, model, source_hash, source_message_count, source_last_message_at, generated_at, error_message, updated_at",
            )
            .eq("workspace_id", context.workspace.id)
            .in("lead_id", leadIds)
        : Promise.resolve({ data: [], error: null }),
      sessionIds.length > 0
        ? admin
            .from("dashboard_conversation_summaries")
            .select("widget_session_id, message_count")
            .eq("workspace_id", context.workspace.id)
            .in("widget_session_id", sessionIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (summaryResult.error) {
      throw summaryResult.error;
    }

    if (messageCountResult.error) {
      throw messageCountResult.error;
    }

    const summaryByLeadId = new Map(
      ((summaryResult.data ?? []) as LeadConversationSummaryRow[]).map((summary) => [
        summary.lead_id,
        summary,
      ]),
    );
    const messageCountBySessionId = new Map(
      ((messageCountResult.data ?? []) as ConversationMessageCountRow[]).map(
        (conversation) => [conversation.widget_session_id, conversation.message_count],
      ),
    );

    const leads = leadRows.map(
      (row): WidgetLeadListItem => {
        const widget = firstRelation(row.widgets);
        const agent = firstRelation(row.agents);
        const summary = summaryByLeadId.get(row.id) ?? null;
        const currentMessageCount = row.widget_session_id
          ? messageCountBySessionId.get(row.widget_session_id) ??
            summary?.source_message_count ??
            0
          : 0;

        const rawMessage = row.message?.trim() ?? null;
        const isContactForm =
          Boolean(rawMessage && (rawMessage.startsWith("[Kontaktformulär]") || rawMessage.startsWith("[Contact Form]"))) ||
          (rawMessage !== null && currentMessageCount === 0);

        const cleanMessage = rawMessage
          ? rawMessage.replace(/^\[(Kontaktformulär|Contact Form)\]\s*/, "").trim() || null
          : null;

        return {
          id: row.id,
          widget_id: row.widget_id,
          widget_session_id: row.widget_session_id,
          widget_agent_id: row.widget_agent_id,
          agent_id: row.agent_id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          message: cleanMessage,
          source_channel: isContactForm ? "contact_form" : "chat",
          created_at: row.created_at,
          widget_name: widget?.name ?? "Unknown widget",
          agent_name: agent?.name ?? null,
          ai_summary: summary
            ? serializeLeadConversationSummary(summary, currentMessageCount)
            : null,
        };
      },
    );

    return NextResponse.json(leads, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Failed to load workspace leads.", error);
    return NextResponse.json(
      { error: "Unable to load leads right now. Please try again." },
      { status: 500 },
    );
  }
}
