"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
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
      classes: "bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20",
    };
  }
  if (agent.surface === "assistant") {
    return {
      label: t("agents.internalAssistant"),
      classes: "bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20",
    };
  }
  // widget (default)
  return {
    label: t("agents.websiteWidget"),
    classes: "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20",
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

  const primaryHref = `/agents/${agent.id}/${
    canEdit || agent.surface === "widget" || agent.surface === "automation"
      ? "builder"
      : "preview"
  }`;

  const toggleDisabled =
    Boolean(agent.archived_at) ||
    isBusy ||
    !canEdit ||
    agent.surface === "automation" ||
    (agent.surface === "widget" &&
      agent.status !== "active" &&
      !agent.published_version_id);

  return (
    <div className="group relative flex items-center gap-5 rounded-2xl bg-surface-container-low/55 px-5 py-4 ring-1 ring-outline-variant/10 shadow-sm transition-all hover:bg-surface-container hover:shadow-premium hover:ring-primary/20 animate-in fade-in slide-in-from-bottom-2 duration-400">

      {/* ── Avatar + status dot ─────────────────────────── */}
      <div className="relative shrink-0">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container text-primary font-bold text-lg select-none">
          {agent.name.charAt(0).toUpperCase()}
        </div>
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface-container-lowest ${getDotColor(agent)}`}
        />
      </div>

      {/* ── Name + type badge (under name) ──────────────── */}
      <div className="min-w-0 flex-1">
        <h3 className="text-[14px] font-bold text-on-surface truncate leading-tight">
          {agent.name}
        </h3>

        {/* Type badge — sits directly under the name, small dot + label */}
        <span
          className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${typeBadge.classes}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80 shrink-0" />
          {typeBadge.label}
        </span>
      </div>

      {/* ── Description ────────────────────────────────── */}
      <p className="hidden md:block self-center w-[260px] lg:w-[340px] shrink-0 text-[12px] leading-relaxed text-on-surface-variant/60 line-clamp-2">
        {agent.description || t("agents.noInstructions")}
      </p>

      {/* ── Status label ───────────────────────────────── */}
      <div className="hidden lg:flex self-center flex-col w-[72px] shrink-0">
        <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/30">
          {t("common.status")}
        </span>
        <span className="text-[11px] font-bold text-on-surface-variant/70 mt-0.5">
          {stateLabel}
        </span>
      </div>

      {/* ── Actions ────────────────────────────────────── */}
      <div className="flex items-center gap-2 shrink-0 ml-auto">
        {/* On/Off toggle */}
        <button
          onClick={() => onStatusToggle(agent)}
          disabled={toggleDisabled}
          aria-label={isActive ? t("common.off") : t("common.on")}
          className={`relative h-[26px] w-[52px] shrink-0 rounded-full transition-all duration-300 focus:outline-none disabled:opacity-40 ${
            isActive ? "bg-primary" : "bg-surface-container-highest"
          }`}
        >
          {/* ON / OFF labels inside track */}
          <div className="absolute inset-0 flex items-center justify-between px-2.5 select-none pointer-events-none">
            <span
              className={`text-[9px] font-black tracking-wider transition-opacity duration-300 ${
                isActive ? "text-white opacity-100" : "opacity-0"
              }`}
            >
              {t("common.on").toUpperCase()}
            </span>
            <span
              className={`text-[9px] font-black tracking-wider transition-opacity duration-300 ${
                !isActive ? "text-white opacity-100" : "opacity-0"
              }`}
            >
              {t("common.off").toUpperCase()}
            </span>
          </div>
          {/* Thumb */}
          <span
            className={`absolute top-1 left-1 h-[18px] w-[18px] rounded-full bg-surface-container-lowest shadow-[0_2px_4px_rgba(0,0,0,0.24)] transition-all duration-300 ease-in-out ${
              isActive ? "translate-x-[26px]" : "translate-x-0"
            }`}
          />
        </button>

        {/* Builder / open link — visible on hover */}
        <Link
          href={primaryHref}
          className="signature-gradient flex h-9 items-center justify-center rounded-xl px-3.5 text-[11px] font-bold opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0 duration-200"
        >
          {agent.surface === "automation"
            ? t("agents.builder")
            : canEdit || agent.surface === "widget"
              ? t("agents.builder")
              : t("common.open")}
        </Link>

        {/* Preview link — hidden for automation */}
        {agent.surface !== "automation" ? (
          <Link
            href={`/agents/${agent.id}/preview`}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-outline-variant/10 text-on-surface-variant hover:bg-surface-container transition-all opacity-0 group-hover:opacity-100 duration-200"
            title={t("agents.preview")}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        ) : null}

        {/* Archive / delete overflow menu */}
        <EntityActionsMenu
          onArchiveToggle={() => onArchiveToggle(agent)}
          archiveLabel={agent.archived_at ? t("common.restore") : t("common.archive")}
          archiveDisabled={isBusy || !canEdit}
          onDelete={() => onPermanentDelete(agent)}
          deleteDisabled={
            isBusy || !agent.archived_at || membershipRole !== "owner"
          }
          buttonClassName="flex h-9 w-9 items-center justify-center rounded-xl border border-outline-variant/10 text-on-surface-variant/40 hover:bg-surface-container hover:text-on-surface transition-all"
        />
      </div>
    </div>
  );
}
