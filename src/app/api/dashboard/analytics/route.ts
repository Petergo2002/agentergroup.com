import { NextRequest, NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import {
  getAnalyticsDateRange,
  getDashboardAnalyticsOverview,
  listDashboardConversations,
} from "@/lib/dashboard/analytics";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  DashboardAnalyticsAppliedFilters,
  DashboardAnalyticsRange,
} from "@/lib/types";

function parseRange(value: string | null): DashboardAnalyticsRange {
  return value === "7d" || value === "90d" ? value : "30d";
}

function parseLimit(value: string | null) {
  const numeric = Number(value ?? "");
  return Number.isFinite(numeric) ? numeric : 25;
}

function parseSessionStatus(value: string | null): "all" | "active" | "completed" {
  return value === "active" || value === "completed" ? value : "all";
}

export const revalidate = 30;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const context = await ensureWorkspaceContext(supabase as never, user);
    const admin = createAdminClient();
    const searchParams = request.nextUrl.searchParams;
    const appliedFilters: DashboardAnalyticsAppliedFilters = {
      range: parseRange(searchParams.get("range")),
      widgetId: searchParams.get("widgetId")?.trim() || null,
      agentId: searchParams.get("agentId")?.trim() || null,
      search: searchParams.get("search")?.trim() || "",
      sessionStatus: parseSessionStatus(searchParams.get("sessionStatus")),
    };
    const limit = parseLimit(searchParams.get("limit"));
    const cursor = searchParams.get("cursor");
    const conversationResult = await listDashboardConversations(admin, {
      workspaceId: context.workspace.id,
      appliedFilters,
      cursor,
      limit,
    });
    const { startIso } = getAnalyticsDateRange(appliedFilters.range);
    const overview = await getDashboardAnalyticsOverview(admin, {
      workspaceId: context.workspace.id,
      startIso,
      conversationCount: conversationResult.overview.conversationCount,
      messageCount: conversationResult.overview.messageCount,
      leadCount: conversationResult.overview.leadCount,
      activeWidgetIds: conversationResult.overview.activeWidgetIds,
    });

    return NextResponse.json({
      overview,
      filters: {
        widgets: conversationResult.widgetOptions,
        agents: conversationResult.agentOptions,
        applied: appliedFilters,
      },
      conversations: conversationResult.conversations,
      pageInfo: conversationResult.pageInfo,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load dashboard analytics.",
      },
      { status: 500 },
    );
  }
}
