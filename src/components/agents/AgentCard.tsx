"use client";

import Link from "next/link";
import { Activity, Bot, ExternalLink, MessageSquare, Workflow } from "lucide-react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { EntityActionsMenu } from "@/components/ui/EntityActionsMenu";
import type { AgentRecord } from "@/lib/types";

interface AgentCardProps {
  agent: AgentRecord;
  isActive: boolean;
  isBusy: boolean;
  canEdit: boolean;
  membershipRole: string;
  onStatusToggle: (agent: AgentRecord) => void;
  onArchiveToggle: (agent: AgentRecord) => void;
  onPermanentDelete: (agent: AgentRecord) => void;
}

/** Returns the human-readable status label for a given agent record. */
function useAgentStateLabel(agent: AgentRecord, t: (key: string) => string) {
  if (agent.archived_at) return t("statuses.agent.archived");
  if (agent.surface === "assistant" || agent.surface === "automation") {
    if (agent.status === "active") return t("statuses.agent.active");
    if (agent.status === "paused") return t("statuses.agent.paused");
    return t("statuses.agent.draft");
  }
  if (agent.status === "active" && agent.published_version_id) return t("statuses.agent.live");
  if (agent.status === "paused") return t("statuses.agent.off");
  return t("statuses.agent.draft");
}

/** Returns the status dot colour class for a given agent record. */
function getDotColor(agent: AgentRecord) {
  if (agent.archived_at) return "bg-on-surface-variant/45";
  if (agent.surface === "assistant" || agent.surface === "automation") {
    return agent.status === "active" ? "bg-success" : "bg-on-surface-variant/35";
  }
  if (agent.status === "active" && agent.published_version_id) return "bg-success";
  if (agent.status === "active") return "bg-primary";
  return "bg-on-surface-variant/35";
}

function getSurfaceAccent(agent: AgentRecord) {
  if (agent.surface === "automation") return "from-orange-500/90 to-amber-400/80";
  if (agent.surface === "assistant") return "from-sky-500/90 to-cyan-400/80";
  return "from-emerald-500/90 to-teal-400/80";
}

/**
 * Returns the label and colour tokens for the surface/type badge.
 * - automation  → orange
 * - widget      → emerald
 * - assistant   → blue
 */
function useTypeBadge(agent: AgentRecord, t: (key: string) => string) {
  if (agent.surface === "automation") {
    return {
      label: t("agents.automation"),
      classes: "bg-orange-50 text-orange-700 ring-1 ring-orange-200/80 dark:bg-orange-500/10 dark:text-orange-200 dark:ring-orange-500/20",
      icon: Workflow,
    };
  }
  if (agent.surface === "assistant") {
    return {
      label: t("agents.internalAssistant"),
      classes: "bg-sky-50 text-sky-700 ring-1 ring-sky-200/80 dark:bg-sky-500/10 dark:text-sky-200 dark:ring-sky-500/20",
      icon: Bot,
    };
  }
  // widget (default)
  return {
    label: t("agents.websiteWidget"),
    classes: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/20",
    icon: MessageSquare,
  };
}

export function AgentCard({
  agent,
  isActive,
  isBusy,
  canEdit,
  membershipRole,
  onStatusToggle,
  onArchiveToggle,
  onPermanentDelete,
}: AgentCardProps) {
  const { t } = useLanguage();

  const stateLabel = useAgentStateLabel(agent, t);
  const typeBadge = useTypeBadge(agent, t);
  const SurfaceIcon = typeBadge.icon;
  const showStatusToggle = agent.surface !== "automation";
  const showActivityAction = true;
  const showPreviewAction = agent.surface !== "automation";

  const primaryHref = `/agents/${agent.id}/${
    canEdit || agent.surface === "widget" || agent.surface === "automation"
      ? "builder"
      : "preview"
  }`;
  const activityHref = agent.surface === "automation"
    ? `/agents/${agent.id}/activity`
    : `/agents/${agent.id}/preview#activity`;

  const toggleDisabled =
    Boolean(agent.archived_at) ||
    isBusy ||
    !canEdit ||
    agent.surface === "automation" ||
    (agent.surface === "widget" &&
      agent.status !== "active" &&
      !agent.published_version_id);

  return (
    <article className="depth-row group relative grid grid-cols-1 gap-4 overflow-hidden rounded-2xl border border-outline-variant/12 bg-surface-container-lowest px-4 py-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-surface-container-low/60 hover:shadow-xs sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:px-5 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
      <div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${getSurfaceAccent(agent)} opacity-85`} />

      <div className="relative w-12 shrink-0 pl-1">
        <div className="flex h-11 w-11 select-none items-center justify-center rounded-xl border border-outline-variant/10 bg-surface-container text-lg font-extrabold text-primary transition-transform duration-300 group-hover:scale-105 group-hover:bg-primary/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          {agent.name.charAt(0).toUpperCase()}
        </div>
        <span
          className={`absolute -bottom-0.5 right-0 h-3.5 w-3.5 rounded-full border-2 border-surface-container-lowest ${getDotColor(agent)} ${isActive ? "animate-pulse" : ""}`}
        />
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[15px] font-bold leading-5 tracking-tight text-on-surface transition-colors group-hover:text-primary">
          {agent.name}
        </h3>
        <p className="mt-1 line-clamp-2 max-w-3xl text-sm leading-relaxed text-on-surface-variant/75">
          {agent.description || t("agents.noInstructions")}
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold ${typeBadge.classes}`}
          >
            <SurfaceIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            {typeBadge.label}
          </span>
          <span className="inline-flex h-6 items-center rounded-full bg-surface-container px-2.5 text-xs font-semibold text-on-surface-variant ring-1 ring-outline-variant/10">
            {stateLabel}
          </span>
        </div>
      </div>

      <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:col-start-2 sm:w-auto sm:justify-start lg:col-start-auto lg:flex-nowrap lg:justify-end">
        <span className="sr-only">
          {t("common.status")}: {stateLabel}
        </span>
        {showStatusToggle ? (
          <button
            type="button"
            onClick={() => onStatusToggle(agent)}
            disabled={toggleDisabled}
            aria-pressed={isActive}
            aria-label={isActive ? t("common.off") : t("common.on")}
            className={`relative h-7 w-12 shrink-0 rounded-full border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-45 ${
              isActive
                ? "border-primary bg-primary shadow-[0_10px_22px_-16px_rgba(var(--primary-rgb),0.8)]"
                : "border-outline-variant/10 bg-surface-container-high"
            }`}
          >
            <span
              className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-surface-container-lowest shadow-[0_1px_3px_rgba(15,23,42,0.22)] transition-transform duration-200 ${
                isActive ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        ) : null}

        <Link
          href={primaryHref}
          className="app-primary-button min-h-9 px-3.5 group-hover:shadow-xs transition-all active:scale-[0.98]"
        >
          {agent.surface === "automation"
            ? t("agents.builder")
            : canEdit || agent.surface === "widget"
              ? t("agents.builder")
              : t("common.open")}
        </Link>

        {showActivityAction ? (
          <Link
            href={activityHref}
            className="app-secondary-button min-h-9 px-3.5 group/act transition-all active:scale-[0.98]"
          >
            <Activity className="h-3.5 w-3.5 text-primary transition-transform duration-200 group-hover/act:scale-110" />
            {t("agents.viewActivity")}
          </Link>
        ) : null}

        {showPreviewAction ? (
          <Link
            href={`/agents/${agent.id}/preview`}
            className="depth-button flex h-9 w-9 items-center justify-center rounded-xl border border-outline-variant/10 bg-surface-container-lowest text-on-surface-variant transition-all hover:border-primary/20 hover:bg-surface-container-low hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            title={t("agents.preview")}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        ) : null}

        <EntityActionsMenu
          onArchiveToggle={() => onArchiveToggle(agent)}
          archiveLabel={agent.archived_at ? t("common.restore") : t("common.archive")}
          archiveDisabled={isBusy || !canEdit}
          onDelete={() => onPermanentDelete(agent)}
          deleteDisabled={
            isBusy || !agent.archived_at || membershipRole !== "owner"
          }
          buttonClassName="depth-button flex h-9 w-9 items-center justify-center rounded-xl border border-outline-variant/10 bg-surface-container-lowest text-on-surface-variant transition-all hover:border-primary/20 hover:bg-surface-container-low hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
      </div>
    </article>
  );
}
