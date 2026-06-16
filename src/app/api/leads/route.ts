import { NextResponse, type NextRequest } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
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

    const leads = ((data ?? []) as unknown as LeadQueryRow[]).map(
      (row): WidgetLeadListItem => {
        const widget = firstRelation(row.widgets);
        const agent = firstRelation(row.agents);

        return {
          id: row.id,
          widget_id: row.widget_id,
          widget_session_id: row.widget_session_id,
          widget_agent_id: row.widget_agent_id,
          agent_id: row.agent_id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          message: row.message,
          created_at: row.created_at,
          widget_name: widget?.name ?? "Unknown widget",
          agent_name: agent?.name ?? null,
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
