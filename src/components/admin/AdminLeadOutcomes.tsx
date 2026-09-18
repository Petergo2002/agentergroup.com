import { Sparkles, TrendingUp, UserRoundCheck, Clock } from "lucide-react";
import {
  describeLastLead,
  formatConversionRate,
  type AdminLeadAnalytics,
} from "@/lib/admin/lead-analytics";
import { formatAdminNumber } from "@/lib/admin/format";
import type { PlatformLanguage } from "@/lib/i18n";

interface AdminLeadOutcomesProps {
  analytics: AdminLeadAnalytics;
  windowDays: number;
  language: PlatformLanguage;
}

/**
 * What the customer is actually getting out of the product.
 *
 * Deliberately outcome-first rather than volume-first: message counts say the
 * platform is busy, leads say it is working. Conversion rate is shown with its
 * denominator rather than against a benchmark — there is no defensible industry
 * number to grade a pilot customer against, and inventing one would be worse
 * than showing the raw ratio.
 */
export function AdminLeadOutcomes({
  analytics,
  windowDays,
  language,
}: AdminLeadOutcomesProps) {
  const { points } = analytics;
  const maxCount = Math.max(...points.map((point) => point.leadCount), 1);
  const isSwedish = language === "sv";

  const tiles = [
    {
      key: "total",
      label: isSwedish ? "Totala leads" : "Total leads",
      value: formatAdminNumber(analytics.totalLeads, language),
      caption: isSwedish ? "Sedan start" : "All time",
      Icon: UserRoundCheck,
    },
    {
      key: "window",
      label: isSwedish ? `Leads (${windowDays} d)` : `Leads (${windowDays}d)`,
      value: formatAdminNumber(analytics.leadsInWindow, language),
      caption: isSwedish ? "I perioden" : "In this window",
      Icon: Sparkles,
    },
    {
      key: "rate",
      label: isSwedish ? "Konvertering" : "Conversion",
      value: formatConversionRate(analytics.conversionRate),
      caption:
        analytics.conversations > 0
          ? `${formatAdminNumber(analytics.conversations, language)} ${
              isSwedish ? "konversationer" : "conversations"
            }`
          : isSwedish
            ? "Inga konversationer än"
            : "No conversations yet",
      Icon: TrendingUp,
    },
    {
      key: "last",
      label: isSwedish ? "Senaste lead" : "Last lead",
      value: describeLastLead(analytics.lastLeadAt),
      caption: isSwedish ? "Senast mottagen" : "Most recently received",
      Icon: Clock,
    },
  ];

  return (
    <section className="space-y-4 admin-fade-in">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(({ key, label, value, caption, Icon }) => (
          <article
            key={key}
            className="rounded-3xl border border-outline bg-surface px-5 py-4 shadow-tactile"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-on-surface-variant">
                {label}
              </p>
              <Icon
                aria-hidden
                className="h-4 w-4 shrink-0 text-on-surface-variant"
              />
            </div>
            <p className="mt-3 text-2xl font-semibold leading-none text-on-surface">
              {value}
            </p>
            <p className="mt-2 text-[11px] text-on-surface-variant">{caption}</p>
          </article>
        ))}
      </div>

      <div className="rounded-3xl border border-outline bg-surface p-6 shadow-tactile">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-on-surface-variant">
              {isSwedish ? "Resultat" : "Outcomes"}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-on-surface">
              {isSwedish ? "Leads per dag" : "Leads per day"}
            </h2>
          </div>
          <p className="text-xs text-on-surface-variant">
            {isSwedish
              ? `Senaste ${windowDays} dagarna`
              : `Last ${windowDays} days`}
          </p>
        </div>

        {analytics.leadsInWindow === 0 ? (
          <p className="rounded-2xl bg-surface-container-low px-4 py-6 text-center text-[13px] text-on-surface-variant">
            {isSwedish
              ? "Inga leads under perioden."
              : "No leads captured in this window."}
          </p>
        ) : (
          <div className="flex h-44 items-end gap-1.5">
            {points.map((point, index) => {
              // A day with leads always shows a visible stub, so "one lead" and
              // "no leads" never look identical.
              const height =
                point.leadCount > 0
                  ? `${Math.max((point.leadCount / maxCount) * 100, 8)}%`
                  : "0%";
              const showLabel =
                index === 0 || index === points.length - 1 || index % 5 === 0;

              return (
                <div
                  key={point.dateKey}
                  className="flex min-w-0 flex-1 flex-col items-center gap-2"
                >
                  {/* Bars sit on a baseline rather than inside a filled
                      track. Leads are sparse by nature, and a track behind
                      every day makes the empty days read as data — the grey
                      ends up louder than the green. */}
                  <div className="flex h-32 w-full items-end border-b border-outline">
                    <div
                      className="w-full rounded-t-md bg-emerald-500 transition-opacity hover:opacity-80"
                      style={{ height }}
                      title={`${point.label}: ${formatAdminNumber(
                        point.leadCount,
                        language,
                      )} ${
                        isSwedish
                          ? point.leadCount === 1
                            ? "lead"
                            : "leads"
                          : point.leadCount === 1
                            ? "lead"
                            : "leads"
                      }`}
                    />
                  </div>
                  <span className="text-[10px] tabular-nums text-on-surface-variant">
                    {showLabel ? point.label : ""}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
