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

  const getAgentStateLabel = (agent: AgentRecord) => {
    if (agent.archived_at) return t("statuses.agent.archived");
    if (agent.surface === "assistant") {
      if (agent.status === "active") return t("statuses.agent.active");
      if (agent.status === "paused") return t("statuses.agent.paused");
      return t("statuses.agent.draft");
    }
    if (agent.status === "active" && agent.published_version_id) return t("statuses.agent.live");
    if (agent.status === "paused") return t("statuses.agent.off");
    return t("statuses.agent.draft");
  };

  const getDotColor = (agent: AgentRecord) => {
    if (agent.archived_at) return "bg-on-surface-variant/45";
    if (agent.surface === "assistant") {
      return agent.status === "active" ? "bg-success" : "bg-on-surface-variant/35";
    }
    if (agent.status === "active" && agent.published_version_id) return "bg-success";
    if (agent.status === "active") return "bg-primary";
    return "bg-on-surface-variant/35";
  };

  const modelLabel = agent.model?.toLowerCase().includes("gpt-4o") 
    ? "GPT-4o" 
    : agent.model?.toLowerCase().includes("claude") 
      ? "Claude 3.5" 
      : agent.model || "Standard";

  const toggleDisabled = Boolean(agent.archived_at) || isBusy || !canEdit || (agent.surface === 'widget' && agent.status !== 'active' && !agent.published_version_id);

  return (
    <div className="group relative flex flex-col justify-between rounded-[2rem] bg-surface-container-low/55 p-6 ring-1 ring-outline-variant/10 shadow-[0_8px_30px_rgba(0,0,0,0.18)] transition-all hover:bg-surface-container hover:shadow-xl hover:shadow-black/20 hover:ring-primary/20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-container text-primary font-bold text-xl">
              {agent.name.charAt(0)}
            </div>
            <span className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-surface-container-lowest ${getDotColor(agent)}`} />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-on-surface truncate max-w-[140px]">
              {agent.name}
            </h3>
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
              {modelLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
            <button
                onClick={() => onStatusToggle(agent)}
                disabled={toggleDisabled}
                className={`relative h-[26px] w-[52px] shrink-0 rounded-full transition-all duration-300 focus:outline-none disabled:opacity-40 ${
                isActive 
                  ? 'bg-primary' 
                  : 'bg-surface-container-highest'
                }`}
            >
                {/* Internal Text Labels */}
                <div className="absolute inset-0 flex items-center justify-between px-2.5 select-none pointer-events-none">
                    <span className={`text-[9px] font-black tracking-wider transition-opacity duration-300 ${isActive ? 'text-white opacity-100' : 'opacity-0'}`}>
                        {t('common.on').toUpperCase()}
                    </span>
                    <span className={`text-[9px] font-black tracking-wider transition-opacity duration-300 ${!isActive ? 'text-white opacity-100' : 'opacity-0'}`}>
                        {t('common.off').toUpperCase()}
                    </span>
                </div>

                {/* Handle */}
                <span
                    className={`absolute top-1 left-1 h-[18px] w-[18px] rounded-full bg-surface-container-lowest shadow-[0_2px_4px_rgba(0,0,0,0.24)] transition-all duration-300 ease-in-out ${
                        isActive ? 'translate-x-[26px]' : 'translate-x-0'
                    }`}
                />
            </button>
            <EntityActionsMenu
                onArchiveToggle={() => onArchiveToggle(agent)}
                archiveLabel={agent.archived_at ? t('common.restore') : t('common.archive')}
                archiveDisabled={isBusy || !canEdit}
                onDelete={() => onPermanentDelete(agent)}
                deleteDisabled={isBusy || !agent.archived_at || membershipRole !== 'owner'}
                buttonClassName="flex h-9 w-9 items-center justify-center rounded-xl border border-outline-variant/10 text-on-surface-variant/40 hover:bg-surface-container hover:text-on-surface transition-all"
                iconClassName="material-symbols-outlined text-[18px]"
            />
        </div>
      </div>

      <p className="text-[13px] leading-relaxed text-on-surface-variant/70 line-clamp-2 mb-8 min-h-[40px]">
        {agent.description || t("agents.noInstructions")}
      </p>

      <div className="flex items-center justify-between pt-6 border-t border-outline-variant/5">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/30">
            {t("common.status")}
          </span>
          <span className="text-[11px] font-bold text-on-surface-variant/70">
            {getAgentStateLabel(agent)}
          </span>
        </div>
        
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0 transition-transform">
          <Link
            href={`/agents/${agent.id}/${canEdit || agent.surface === 'widget' ? 'builder' : 'preview'}`}
            className="signature-gradient flex h-9 items-center justify-center rounded-xl px-4 text-[11px] font-bold transition-all hover:border-primary/25 hover:bg-primary/8"
          >
            {canEdit || agent.surface === 'widget' ? t('agents.builder') : t('common.open')}
          </Link>
          <Link
            href={`/agents/${agent.id}/preview`}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-outline-variant/10 text-on-surface-variant hover:bg-surface-container transition-all"
            title={t('agents.preview')}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
