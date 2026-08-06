"use client";

import {
  AlertCircle,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { useId, useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { useToast } from "@/components/ui/ToastProvider";
import { formatLocaleDateTime } from "@/lib/i18n";
import type {
  LeadConversationSummary,
  LeadConversationSummaryContent,
} from "@/lib/types";

interface LeadAiSummaryCardProps {
  leadId: string;
  summary: LeadConversationSummary | null;
  canRegenerate?: boolean;
  onSummaryChange?: (summary: LeadConversationSummary) => void;
}

function getCollectedDetails(
  content: LeadConversationSummaryContent,
  t: (key: string) => string,
) {
  return [
    [t("leads.nameLabel"), content.details.name],
    [t("leads.phoneLabel"), content.details.phone],
    [t("leads.emailLabel"), content.details.email],
    [t("leads.aiSummary.serviceProduct"), content.details.serviceOrProduct],
    [t("leads.aiSummary.location"), content.details.location],
    [t("leads.aiSummary.preferredTime"), content.details.preferredTime],
    [t("leads.aiSummary.budget"), content.details.budget],
    [t("leads.aiSummary.urgency"), content.details.urgency],
    [t("leads.aiSummary.specialRequirements"), content.details.specialRequirements],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
}

function SummaryActionButton({
  isRegenerating,
  hasSummary,
  onClick,
}: {
  isRegenerating: boolean;
  hasSummary: boolean;
  onClick: () => void;
}) {
  const { t } = useLanguage();

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isRegenerating}
      className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-outline-variant/15 bg-surface px-3 text-xs font-semibold text-on-surface transition-colors hover:border-outline-variant/30 hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-wait disabled:opacity-60"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${isRegenerating ? "animate-spin" : ""}`} />
      {isRegenerating
        ? t("leads.aiSummary.generating")
        : hasSummary
          ? t("leads.aiSummary.regenerate")
          : t("leads.aiSummary.generate")}
    </button>
  );
}

export function LeadAiSummaryCard({
  leadId,
  summary,
  canRegenerate = true,
  onSummaryChange,
}: LeadAiSummaryCardProps) {
  const { language, t } = useLanguage();
  const { showToast } = useToast();
  const titleId = useId();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const content = summary?.content ?? null;
  const details = content ? getCollectedDetails(content, t) : [];

  const regenerate = async () => {
    setIsRegenerating(true);

    try {
      const response = await fetch(`/api/leads/${encodeURIComponent(leadId)}/summary`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload) {
        throw new Error(payload?.error || t("leads.aiSummary.regenerateError"));
      }

      onSummaryChange?.(payload as LeadConversationSummary);
      showToast(t("leads.aiSummary.regenerateSuccess"), "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t("leads.aiSummary.regenerateError"),
        "error",
      );
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <section
      aria-labelledby={titleId}
      className="relative overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-sm sm:p-6 transition-all duration-200 hover:border-primary/20"
    >
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary via-orange-400 to-amber-300" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between pt-0.5">
        <div className="min-w-0">
          <p className="text-xs font-bold text-primary">
            {t("leads.aiSummary.kicker")}
          </p>
          <h3 id={titleId} className="mt-1 text-base font-semibold tracking-normal text-on-surface">
            {t("leads.aiSummary.title")}
          </h3>
          <p className="mt-1 max-w-xl text-sm leading-5 text-on-surface-variant/65">
            {t("leads.aiSummary.description")}
          </p>
        </div>
        {canRegenerate && summary?.status !== "generating" ? (
          <SummaryActionButton
            isRegenerating={isRegenerating}
            hasSummary={Boolean(summary)}
            onClick={() => void regenerate()}
          />
        ) : null}
      </div>

      {summary?.is_stale ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-warning/20 bg-warning/[0.07] px-3 py-2 text-xs font-medium text-on-surface-variant">
          <AlertCircle className="h-4 w-4 shrink-0 text-warning" />
          {t("leads.aiSummary.stale")}
        </div>
      ) : null}

      {summary?.status === "failed" && content ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-error/15 bg-error/[0.05] px-3 py-2 text-xs font-medium text-on-surface-variant">
          <AlertCircle className="h-4 w-4 shrink-0 text-error" />
          {t("leads.aiSummary.failedPrevious")}
        </div>
      ) : null}

      {!summary ? (
        <div className="mt-5 rounded-xl border border-dashed border-outline-variant/20 px-4 py-5 text-sm text-on-surface-variant/70">
          <p>{t("leads.aiSummary.notGenerated")}</p>
          {!canRegenerate ? (
            <p className="mt-2 text-xs">{t("leads.aiSummary.noConversation")}</p>
          ) : null}
        </div>
      ) : summary.status === "generating" || isRegenerating ? (
        <div className="mt-5 space-y-3 animate-pulse">
          <div className="h-4 w-2/3 rounded bg-primary/10" />
          <div className="h-16 rounded-xl bg-primary/[0.06]" />
          <p className="text-xs text-on-surface-variant/60">
            {t("leads.aiSummary.generatingDescription")}
          </p>
        </div>
      ) : summary.status === "failed" && !content ? (
        <div className="mt-5 flex gap-3 rounded-xl border border-error/15 bg-error/[0.05] p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
          <div>
            <p className="text-sm font-semibold text-on-surface">
              {t("leads.aiSummary.failedTitle")}
            </p>
            <p className="mt-1 text-xs leading-5 text-on-surface-variant/70">
              {t("leads.aiSummary.failedDescription")}
            </p>
          </div>
        </div>
      ) : content ? (
        <div className="mt-5 space-y-5">
          <div className="rounded-xl border border-outline-variant/12 bg-surface-container-lowest px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant/55">
              {t("leads.aiSummary.customerWanted")}
            </p>
            <p className="mt-2 text-sm leading-6 text-on-surface">
              {content.customerNeed || t("leads.aiSummary.notEnoughContext")}
            </p>
          </div>

          {details.length > 0 ? (
            <div className="rounded-xl border border-outline-variant/12 bg-surface-container-lowest px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant/55">
                {t("leads.aiSummary.collectedDetails")}
              </p>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                {details.map(([label, value]) => (
                  <div key={label} className="min-w-0 rounded-lg bg-surface px-3 py-2.5 ring-1 ring-outline-variant/10">
                    <dt className="text-xs font-medium text-on-surface-variant/60">{label}</dt>
                    <dd className="mt-1 break-words text-sm font-semibold text-on-surface">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-outline-variant/12 bg-surface-container-lowest p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant/60">
                  {t("leads.aiSummary.intent")}
                </p>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${
                    content.intentLevel === "hot"
                      ? "bg-orange-500/10 text-orange-600 ring-orange-500/25 dark:bg-orange-500/20 dark:text-orange-400"
                      : content.intentLevel === "warm"
                        ? "bg-amber-500/10 text-amber-600 ring-amber-500/25 dark:bg-amber-500/20 dark:text-amber-400"
                        : "bg-blue-500/10 text-blue-600 ring-blue-500/25 dark:bg-blue-500/20 dark:text-blue-400"
                  }`}
                >
                  {t(`leads.aiSummary.intentLevels.${content.intentLevel}`)}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-on-surface-variant/80">
                {content.intentReason}
              </p>
            </div>
            <div className="rounded-xl border border-outline-variant/12 bg-surface-container-lowest p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant/60">
                {t("leads.aiSummary.nextAction")}
              </p>
              <p className="mt-2.5 flex items-center gap-2 text-sm font-bold text-primary">
                <ArrowRight className="h-4 w-4" />
                {t(`leads.aiSummary.actions.${content.recommendedAction}`)}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-on-surface-variant/80">
                {content.recommendedActionReason}
              </p>
            </div>
          </div>

          {content.missingInformation.length > 0 ? (
            <div className="rounded-xl border border-outline-variant/12 bg-surface-container-lowest px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant/55">
                {t("leads.aiSummary.missingInformation")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {content.missingInformation.map((item) => (
                  <span
                    key={item}
                    className="rounded-lg border border-outline-variant/15 bg-surface px-2.5 py-1.5 text-xs font-medium text-on-surface-variant"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {summary.generated_at ? (
            <p className="border-t border-outline-variant/10 pt-3 text-xs text-on-surface-variant/45">
              {t("leads.aiSummary.generatedAt", {
                date: formatLocaleDateTime(summary.generated_at, language),
              })}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
