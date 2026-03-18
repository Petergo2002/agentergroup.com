"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useModals } from "@/components/ui/ModalProvider";
import { useToast } from "@/components/ui/ToastProvider";
import { useAppContext } from "@/components/app/AppContext";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeDate } from "@/lib/utils";
import type { AgentRecord, DashboardAnalyticsResponse } from "@/lib/types";

interface DashboardOverviewState {
  isLoading: boolean;
  data: DashboardAnalyticsResponse | null;
}

interface WorkspaceSummaryState {
  isLoading: boolean;
  totalWidgets: number;
  liveWidgets: number;
  connectedApps: number;
  knowledgeSources: number;
}

const summaryCardClassName =
  "rounded-[1.6rem] border border-outline-variant/35 bg-surface-container-lowest p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]";

const quickLinkCardClassName =
  "rounded-[1.6rem] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-0.5 hover:border-outline-variant/50";

export default function DashboardPage() {
  const supabase = createClient();
  const { workspace } = useAppContext();
  const { openCreateAgent } = useModals();
  const { showToast } = useToast();
  const [state, setState] = useState<DashboardOverviewState>({
    isLoading: true,
    data: null,
  });
  const [workspaceSummary, setWorkspaceSummary] = useState<WorkspaceSummaryState>({
    isLoading: true,
    totalWidgets: 0,
    liveWidgets: 0,
    connectedApps: 0,
    knowledgeSources: 0,
  });
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [isAgentsLoading, setIsAgentsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const load = async () => {
      setState({ isLoading: true, data: null });

      try {
        const response = await fetch("/api/dashboard/analytics?range=30d&limit=4", {
          next: { revalidate: 30 },
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload) {
          throw new Error(payload?.error || "Failed to load dashboard overview.");
        }

        if (!isMounted) {
          return;
        }

        setState({
          isLoading: false,
          data: payload as DashboardAnalyticsResponse,
        });
      } catch (error) {
        if (controller.signal.aborted || !isMounted) {
          return;
        }

        showToast(
          error instanceof Error
            ? error.message
            : "Failed to load dashboard overview.",
          "error",
        );
        setState({
          isLoading: false,
          data: null,
        });
      }
    };

    void load();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [showToast]);

  useEffect(() => {
    let isMounted = true;

    const loadAgents = async () => {
      setIsAgentsLoading(true);

      try {
        const { data, error } = await supabase
          .from("agents")
          .select("*")
          .eq("workspace_id", workspace.id)
          .order("updated_at", { ascending: false });

        if (error) {
          throw error;
        }

        if (!isMounted) {
          return;
        }

        setAgents((data ?? []) as AgentRecord[]);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        showToast(
          error instanceof Error ? error.message : "Failed to load agents.",
          "error",
        );
      } finally {
        if (isMounted) {
          setIsAgentsLoading(false);
        }
      }
    };

    void loadAgents();

    return () => {
      isMounted = false;
    };
  }, [showToast, supabase, workspace.id]);

  useEffect(() => {
    let isMounted = true;

    const loadWorkspaceSummary = async () => {
      setWorkspaceSummary((current) => ({
        ...current,
        isLoading: true,
      }));

      try {
        const [
          widgetsResult,
          liveWidgetsResult,
          connectedAppsResult,
          knowledgeSourcesResult,
        ] = await Promise.all([
          supabase
            .from("widgets")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspace.id),
          supabase
            .from("widgets")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspace.id)
            .eq("status", "deployed"),
          supabase
            .from("connections")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspace.id)
            .eq("status", "connected"),
          supabase
            .from("knowledge_sources")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspace.id),
        ]);

        const errors = [
          widgetsResult.error,
          liveWidgetsResult.error,
          connectedAppsResult.error,
          knowledgeSourcesResult.error,
        ].filter(Boolean);

        if (errors.length > 0) {
          throw errors[0];
        }

        if (!isMounted) {
          return;
        }

        setWorkspaceSummary({
          isLoading: false,
          totalWidgets: widgetsResult.count ?? 0,
          liveWidgets: liveWidgetsResult.count ?? 0,
          connectedApps: connectedAppsResult.count ?? 0,
          knowledgeSources: knowledgeSourcesResult.count ?? 0,
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        showToast(
          error instanceof Error
            ? error.message
            : "Failed to load workspace summary.",
          "error",
        );
        setWorkspaceSummary({
          isLoading: false,
          totalWidgets: 0,
          liveWidgets: 0,
          connectedApps: 0,
          knowledgeSources: 0,
        });
      }
    };

    void loadWorkspaceSummary();

    return () => {
      isMounted = false;
    };
  }, [showToast, supabase, workspace.id]);

  const overview = state.data?.overview;
  const recentConversations = state.data?.conversations ?? [];
  const activeAgents = agents.filter(
    (agent) => !agent.archived_at && agent.status === "active",
  ).length;
  const draftAgents = agents.filter(
    (agent) => !agent.archived_at && agent.status === "draft",
  ).length;
  const summaryCards = [
    ["Active Agents", String(activeAgents)],
    ["Live Widgets", String(workspaceSummary.liveWidgets)],
    ["Connected Apps", String(workspaceSummary.connectedApps)],
    ["Knowledge Sources", String(workspaceSummary.knowledgeSources)],
  ] as const;

  const formatAgentState = (agent: AgentRecord) => {
    if (agent.archived_at) {
      return "Archived";
    }

    if (agent.status === "active" && agent.published_version_id) {
      return "Live";
    }

    if (agent.status === "active") {
      return "Active";
    }

    if (agent.status === "paused") {
      return "Paused";
    }

    return "Draft";
  };

  const getAgentStateClasses = (agent: AgentRecord) => {
    if (agent.archived_at) {
      return "border-outline-variant/10 bg-surface-container text-on-surface-variant";
    }

    if (agent.status === "active" && agent.published_version_id) {
      return "border-primary/20 bg-primary/10 text-primary";
    }

    if (agent.status === "active") {
      return "border-outline-variant/15 bg-surface-container-low text-on-surface";
    }

    if (agent.status === "paused") {
      return "border-outline-variant/10 bg-surface-container text-on-surface-variant";
    }

    return "border-outline-variant/10 bg-background text-on-surface-variant";
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
            Workspace overview
          </p>
          <h1 className="mt-3 text-[2.15rem] font-headline font-bold leading-tight tracking-tight text-on-surface sm:text-[2.45rem]">
            Dashboard
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-on-surface-variant">
            See what is live, what needs attention, and where to continue work across {workspace.name}.
          </p>
        </div>
        <button
          onClick={openCreateAgent}
          className="rounded-full bg-on-surface px-5 py-3 text-sm font-semibold text-background shadow-sm transition-opacity hover:opacity-90"
        >
          Create Agent
        </button>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {state.isLoading || isAgentsLoading || workspaceSummary.isLoading
          ? Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className={`${summaryCardClassName} h-[132px] animate-pulse bg-surface-container-low`}
              />
            ))
          : summaryCards.map(([label, value]) => (
              <div key={label} className={summaryCardClassName}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant/65">
                  {label}
                </p>
                <p className="mt-5 text-4xl font-headline font-bold text-on-surface">
                  {value}
                </p>
              </div>
            ))}
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-[1.75rem] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant/65">
                Latest customer activity
              </p>
              <h2 className="mt-3 text-xl font-headline font-bold text-on-surface">
                Recent conversations
              </h2>
            </div>
            <Link
              href="/analytics"
              className="rounded-full border border-outline-variant/20 px-4 py-2 text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
            >
              Open analytics
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {state.isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-20 animate-pulse rounded-[1.5rem] bg-surface-container-low"
                />
              ))
            ) : recentConversations.length === 0 ? (
              <div className="rounded-[1.6rem] border border-dashed border-outline-variant/15 bg-background px-5 py-8 text-sm leading-7 text-on-surface-variant">
                No public widget conversations yet.
              </div>
            ) : (
              recentConversations.map((conversation) => (
                <Link
                  key={conversation.widgetSessionId}
                  href="/analytics"
                  className="block rounded-[1.5rem] border border-outline-variant/10 bg-background px-4 py-4 transition-colors hover:bg-surface-container-low"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-on-surface">
                        {conversation.widgetName}
                      </p>
                      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant/60">
                        {conversation.agentLabel || conversation.agentName || "Unknown agent"}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs text-on-surface-variant/60">
                      {formatRelativeDate(conversation.lastActivityAt)}
                    </p>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-on-surface-variant">
                    {conversation.latestSnippet || "No customer-facing messages yet."}
                  </p>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant/65">
                Agents
              </p>
              <h2 className="mt-3 text-xl font-headline font-bold text-on-surface">
                Agent status
              </h2>
            </div>
            <Link
              href="/agents"
              className="rounded-full border border-outline-variant/20 px-4 py-2 text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
            >
              Open agents
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {isAgentsLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-16 animate-pulse rounded-[1.4rem] bg-surface-container-low"
                />
              ))
            ) : agents.length === 0 ? (
              <div className="rounded-[1.6rem] border border-dashed border-outline-variant/15 bg-background px-5 py-6 text-sm leading-7 text-on-surface-variant">
                No agents created yet.
              </div>
            ) : (
              agents.map((agent) => (
                <Link
                  key={agent.id}
                  href={`/agents/${agent.id}/builder`}
                  className="flex items-center justify-between gap-4 rounded-[1.4rem] border border-outline-variant/10 bg-background px-4 py-4 transition-colors hover:bg-surface-container-low"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-on-surface">
                      {agent.name}
                    </p>
                    <p className="mt-1 text-xs text-on-surface-variant/60">
                      Updated {formatRelativeDate(agent.updated_at)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${getAgentStateClasses(agent)}`}
                  >
                    {formatAgentState(agent)}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
