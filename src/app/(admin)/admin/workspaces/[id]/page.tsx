import { notFound } from "next/navigation";
import { AdminAgentsTable } from "@/components/admin/AdminAgentsTable";
import {
  AdminTabs,
  type AdminWorkspaceTab,
} from "@/components/admin/AdminTabs";
import { AdminWidgetsTable } from "@/components/admin/AdminWidgetsTable";
import { AdminLeadOutcomes } from "@/components/admin/AdminLeadOutcomes";
import { AdminWorkspaceAnalytics } from "@/components/admin/AdminWorkspaceAnalytics";
import { AdminWorkspaceSummaryPanel } from "@/components/admin/AdminWorkspaceSummaryPanel";
import { AdminExtraCreditsGrant } from "@/components/admin/AdminExtraCreditsGrant";
import { AdminInternalAssistantsToggle } from "@/components/admin/AdminInternalAssistantsToggle";
import { AdminAutomationsToggle } from "@/components/admin/AdminAutomationsToggle";
import { AdminMessageUsageCard } from "@/components/admin/AdminMessageUsageCard";
import { AdminPlanSelector } from "@/components/admin/AdminPlanSelector";
import { requireAdminUser } from "@/lib/admin/auth";
import {
  getDailyMessageActivity,
  getWorkspaceLeadAnalytics,
  getWorkspaceDetail,
  getWorkspaceWidgets,
} from "@/lib/admin/queries";
import { getServerLanguage } from "@/lib/i18n-server";

interface AdminWorkspaceDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

/** Reporting window for both the lead outcomes and the activity chart. */
const ANALYTICS_WINDOW_DAYS = 30;

function resolveTab(tab: string | undefined): AdminWorkspaceTab {
  if (tab === "agents" || tab === "widgets" || tab === "analytics") {
    return tab;
  }

  return "customer";
}

export default async function AdminWorkspaceDetailPage({
  params,
  searchParams,
}: AdminWorkspaceDetailPageProps) {
  await requireAdminUser();
  const language = await getServerLanguage();

  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const currentTab = resolveTab(resolvedSearchParams.tab);
  const [workspaceDetail, activityPoints, leadAnalytics, widgets] =
    await Promise.all([
      getWorkspaceDetail(id),
      getDailyMessageActivity(id, ANALYTICS_WINDOW_DAYS),
      getWorkspaceLeadAnalytics(id, ANALYTICS_WINDOW_DAYS),
      getWorkspaceWidgets(id),
    ]);

  if (!workspaceDetail) {
    notFound();
  }

  const widgetLastActiveAt =
    widgets
      .map((widget) => widget.lastActiveAt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;
  const workspace = {
    ...workspaceDetail.workspace,
    lastActiveAt:
      [workspaceDetail.workspace.lastActiveAt, widgetLastActiveAt]
        .filter(Boolean)
        .sort()
        .at(-1) ?? workspaceDetail.workspace.lastActiveAt,
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
      <AdminWorkspaceSummaryPanel workspace={workspace} language={language} />

      <section className="min-w-0 space-y-6">
        <header className="admin-fade-in">
          <p className="text-[14px] font-medium uppercase tracking-[0.16em] text-on-surface-variant">
            {language === "sv" ? "Kunddetalj" : "Customer detail"}
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-on-surface">
            {workspace.name}
          </h2>
          <p className="mt-3 text-sm leading-6 text-on-surface-variant">
            {language === "sv"
              ? "Skrivskyddad aktivitet, byggdata och widgetanvändning för detta workspace."
              : "Read-only activity, build, and widget usage for this workspace."}
          </p>
        </header>

        <AdminTabs currentTab={currentTab} workspaceId={id} />

        {currentTab === "customer" ? (
          <div className="space-y-6 admin-fade-in">
            <div>
              <h3 className="text-xl font-semibold text-on-surface">
                {language === "sv" ? "Kundinformation" : "Customer Information"}
              </h3>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2">
              <AdminPlanSelector
                workspaceId={workspace.id}
                currentPlan={workspace.planTier}
                isActivated={workspace.onboardingCompleted}
                trialEndsAt={workspace.trialEndsAt}
                billingCycleEnd={workspace.billingCycleEnd}
                messagesUsed={workspace.messagesUsed}
                agentCount={workspace.agentCount}
              />
              <AdminMessageUsageCard
                messagesUsed={workspace.messagesUsed}
                messagesLimit={workspace.messagesLimit}
                planTier={workspace.planTier}
                billingCycleEnd={workspace.billingCycleEnd}
                trialEndsAt={workspace.trialEndsAt}
              />
              <AdminExtraCreditsGrant
                workspaceId={workspace.id}
                messagesLimit={workspace.messagesLimit}
                messagesUsed={workspace.messagesUsed}
              />
              <AdminInternalAssistantsToggle
                workspaceId={workspace.id}
                enabled={workspace.internalAssistantsEnabled}
              />
              <AdminAutomationsToggle
                workspaceId={workspace.id}
                enabled={workspace.automationsEnabled}
              />
            </div>
          </div>
        ) : null}

        {currentTab === "analytics" ? (
          <div className="space-y-6">
            {/* Outcomes before volume: message counts say the platform is busy,
                leads say it is working for the customer. */}
            <AdminLeadOutcomes
              analytics={leadAnalytics}
              windowDays={ANALYTICS_WINDOW_DAYS}
              language={language}
            />
            <AdminWorkspaceAnalytics workspace={workspace} points={activityPoints} language={language} />
          </div>
        ) : null}

        {currentTab === "agents" ? (
          <div className="space-y-4 admin-fade-in">
            <div>
              <p className="text-[14px] font-medium uppercase tracking-[0.16em] text-on-surface-variant">
                {language === "sv" ? "Agenter" : "Agents"}
              </p>
              <h3 className="mt-2 text-xl font-semibold text-on-surface">
                {language === "sv" ? "Workspace-agenter" : "Workspace agents"}
              </h3>
            </div>
            <AdminAgentsTable agents={workspaceDetail.agents} language={language} />
          </div>
        ) : null}

        {currentTab === "widgets" ? (
          <div className="space-y-4 admin-fade-in">
            <div>
              <p className="text-[14px] font-medium uppercase tracking-[0.16em] text-on-surface-variant">
                {language === "sv" ? "Widgets" : "Widgets"}
              </p>
              <h3 className="mt-2 text-xl font-semibold text-on-surface">
                {language === "sv" ? "Workspace-widgets" : "Workspace widgets"}
              </h3>
            </div>
            <AdminWidgetsTable widgets={widgets} language={language} />
          </div>
        ) : null}
      </section>
    </div>
  );
}
