"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import {
  Mail,
  MessageSquareText,
  Phone,
  RefreshCw,
  Search,
  UserCheck,
  X,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { useAppContext } from "@/components/app/AppContext";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { formatLocaleDateTime } from "@/lib/i18n";
import { jsonFetcher } from "@/lib/json-fetcher";
import type { WidgetLeadListItem } from "@/lib/types";
import { formatRelativeDate } from "@/lib/utils";

interface LeadsPageClientProps {
  workspaceId: string;
  workspaceName: string;
}

interface LeadDetailPanelProps {
  lead: WidgetLeadListItem;
  onClose: () => void;
}

/**
 * Builds the authenticated API URL for the current lead search.
 */
function buildLeadsUrl(search: string) {
  const params = new URLSearchParams({ limit: "50" });

  if (search.trim()) {
    params.set("search", search.trim());
  }

  return `/api/leads?${params.toString()}`;
}

/**
 * Produces compact initials for the contact avatar shown in lead rows.
 */
function getLeadInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "L"
  );
}

/**
 * Renders a table-shaped loading state while SWR resolves the lead collection.
 */
function LeadsTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-outline-variant/15 bg-surface-container-lowest shadow-premium">
      <div className="hidden h-14 animate-pulse border-b border-outline-variant/10 bg-surface-container-low md:block" />
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="h-[92px] animate-pulse border-b border-outline-variant/10 bg-surface-container-lowest last:border-b-0 md:h-[76px]"
        />
      ))}
    </div>
  );
}

/**
 * Explains either the first-use state or a search with no matching contacts.
 */
function LeadsEmptyState({ hasSearch }: { hasSearch: boolean }) {
  const { t } = useLanguage();

  return (
    <section className="relative overflow-hidden rounded-[2.5rem] border border-outline-variant/15 bg-surface-container-lowest px-6 py-24 text-center shadow-premium sm:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/[0.08] via-transparent to-transparent" />
      <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-primary/20 duration-1000" />
        <div className="relative flex h-full w-full items-center justify-center rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-transparent text-primary shadow-lg shadow-primary/10 backdrop-blur-md">
          {hasSearch ? (
            <Search className="h-8 w-8" strokeWidth={1.8} />
          ) : (
            <UserCheck className="h-8 w-8" strokeWidth={1.8} />
          )}
        </div>
      </div>
      <h2 className="relative mt-8 font-headline text-2xl font-bold tracking-tight text-on-surface">
        {hasSearch ? t("leads.noSearchResultsTitle") : t("leads.noLeadsTitle")}
      </h2>
      <p className="relative mx-auto mt-3 max-w-lg text-sm leading-6 text-on-surface-variant/70">
        {hasSearch ? t("leads.noSearchResultsDescription") : t("leads.noLeadsDescription")}
      </p>
    </section>
  );
}

/**
 * Shows the complete lead record in a responsive, keyboard-dismissable slide-over.
 */
function LeadDetailPanel({ lead, onClose }: LeadDetailPanelProps) {
  const { language, t } = useLanguage();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        aria-label={t("leads.closeDetails")}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-500"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-detail-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col border-l border-white/10 bg-surface-container-lowest/80 shadow-2xl backdrop-blur-3xl animate-in slide-in-from-right duration-500 ease-out"
      >
        <div className="relative overflow-hidden border-b border-outline-variant/10 px-5 pb-6 pt-5 sm:px-8 sm:pt-8">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.12] via-transparent to-transparent" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 text-lg font-bold text-primary ring-1 ring-primary/20 shadow-inner">
                {getLeadInitials(lead.name)}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">
                  {t("leads.detailsTitle")}
                </p>
                <h2
                  id="lead-detail-title"
                  className="mt-1 truncate font-headline text-2xl font-bold tracking-tight text-on-surface"
                >
                  {lead.name}
                </h2>
              </div>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label={t("leads.closeDetails")}
              className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-on-surface/5 hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-8">
          <section className="space-y-3">
            {lead.email ? (
              <a
                href={`mailto:${lead.email}`}
                className="flex items-center gap-3 rounded-[1.25rem] border border-white/5 bg-surface-container-low/50 p-4 text-sm text-on-surface shadow-sm backdrop-blur-md transition-all hover:scale-[1.02] hover:bg-primary/[0.04] hover:shadow-md"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-on-surface/[0.04] text-primary">
                  <Mail className="h-4 w-4" />
                </div>
                <span className="truncate font-medium">{lead.email}</span>
              </a>
            ) : null}
            {lead.phone ? (
              <a
                href={`tel:${lead.phone}`}
                className="flex items-center gap-3 rounded-[1.25rem] border border-white/5 bg-surface-container-low/50 p-4 text-sm text-on-surface shadow-sm backdrop-blur-md transition-all hover:scale-[1.02] hover:bg-primary/[0.04] hover:shadow-md"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-on-surface/[0.04] text-primary">
                  <Phone className="h-4 w-4" />
                </div>
                <span className="font-medium">{lead.phone}</span>
              </a>
            ) : null}
          </section>

          <section className="rounded-[1.5rem] border border-white/5 bg-surface-container-low/50 p-5 shadow-inner backdrop-blur-md">
            <h3 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/60">
              <MessageSquareText className="h-3.5 w-3.5 text-primary" />
              {t("leads.messageLabel")}
            </h3>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-on-surface-variant">
              {lead.message || <span className="italic opacity-60">{t("leads.noMessage")}</span>}
            </p>
          </section>

          <section className="grid grid-cols-2 gap-4">
            <div className="rounded-[1.25rem] border border-white/5 bg-surface-container-low/50 p-5 shadow-sm backdrop-blur-md transition-colors hover:bg-surface-container-low">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant/50">
                {t("leads.widgetLabel")}
              </p>
              <p className="mt-2 truncate text-sm font-semibold text-on-surface">
                {lead.widget_name}
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-white/5 bg-surface-container-low/50 p-5 shadow-sm backdrop-blur-md transition-colors hover:bg-surface-container-low">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant/50">
                {t("leads.agentLabel")}
              </p>
              <p className="mt-2 truncate text-sm font-semibold text-on-surface">
                {lead.agent_name || t("leads.unknownAgent")}
              </p>
            </div>
          </section>

          <section className="flex items-center justify-between rounded-[1.25rem] border border-white/5 bg-surface-container-low/50 p-5 shadow-sm backdrop-blur-md">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/55">
              {t("leads.capturedLabel")}
            </h3>
            <p className="text-sm font-medium text-on-surface">
              {formatLocaleDateTime(lead.created_at, language)}
            </p>
          </section>
        </div>

        {lead.widget_session_id ? (
          <div className="border-t border-outline-variant/10 bg-surface-container-lowest/50 p-5 backdrop-blur-md sm:p-8">
            <Link
              href={`/analytics?session=${encodeURIComponent(lead.widget_session_id)}`}
              className="group flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-orange-500 px-5 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98]"
            >
              <MessageSquareText className="h-5 w-5 transition-transform group-hover:scale-110" />
              {t("leads.openConversation")}
            </Link>
          </div>
        ) : null}
      </aside>
    </div>,
    document.body,
  );
}

/**
 * Renders the workspace lead inbox with search, responsive rows, and lead details.
 */
export default function LeadsPageClient({
  workspaceId,
  workspaceName,
}: LeadsPageClientProps) {
  const { workspace } = useAppContext();
  const { language, t } = useLanguage();
  const [search, setSearch] = useState("");
  const [selectedLead, setSelectedLead] = useState<WidgetLeadListItem | null>(null);
  const deferredSearch = useDeferredValue(search);
  const leadsUrl = useMemo(() => buildLeadsUrl(deferredSearch), [deferredSearch]);
  const {
    data: leads,
    error,
    isLoading,
    isValidating,
    mutate,
  } = useSWR<WidgetLeadListItem[]>(leadsUrl, jsonFetcher, {
    keepPreviousData: true,
    refreshInterval: 60_000,
  });
  const hasSearch = Boolean(deferredSearch.trim());
  const displayedWorkspaceName =
    workspace.id === workspaceId ? workspace.name : workspaceName;

  /**
   * Opens a lead while preserving native link behavior for row-level mail and phone links.
   */
  const handleRowClick = (lead: WidgetLeadListItem) => {
    setSelectedLead(lead);
  };

  return (
    <div
      key={workspaceId}
      className="mx-auto w-full max-w-[1440px] space-y-8 px-4 py-8 animate-in fade-in duration-500 sm:px-6 lg:px-12 lg:py-12"
    >
      <header className="relative overflow-hidden rounded-[2.5rem] border border-outline-variant/10 bg-surface-container-lowest px-6 py-8 shadow-premium sm:px-8 lg:px-10">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-transparent to-primary/[0.04]" />
        <div className="pointer-events-none absolute right-0 top-0 h-[300px] w-[300px] -translate-y-1/2 translate-x-1/2 rounded-full bg-primary/10 blur-[80px]" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {displayedWorkspaceName}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="font-headline text-3xl font-bold tracking-tight text-on-surface sm:text-4xl">
                {t("leads.title")}
              </h1>
              <span className="rounded-full border border-primary/15 bg-primary/[0.08] px-3 py-1 text-xs font-bold text-primary">
                {t("leads.capturedCount", { count: leads?.length ?? 0 })}
              </span>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-on-surface-variant/70">
              {t("leads.pageDescription")}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-on-surface-variant/60">
            <span
              className={`h-2 w-2 rounded-full ${
                isValidating ? "animate-pulse bg-primary" : "bg-success"
              }`}
            />
            {isValidating ? t("leads.refreshing") : t("leads.liveInbox")}
          </div>
        </div>
      </header>

      <section className="flex items-center gap-3 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-2 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/40" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("leads.contactSearchPlaceholder")}
            aria-label={t("leads.contactSearchPlaceholder")}
            className="h-12 w-full rounded-xl border border-transparent bg-surface-container-low pl-11 pr-4 text-sm font-medium text-on-surface outline-none transition-all placeholder:text-on-surface-variant/40 focus:border-primary/20 focus:bg-background focus:ring-2 focus:ring-primary/15"
          />
        </div>
      </section>

      {isLoading && !leads ? (
        <LeadsTableSkeleton />
      ) : error ? (
        <section className="rounded-[2rem] border border-error/15 bg-error/[0.04] px-6 py-16 text-center">
          <h2 className="font-headline text-xl font-bold text-on-surface">
            {t("leads.loadErrorTitle")}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-on-surface-variant/70">
            {t("leads.loadErrorDescription")}
          </p>
          <button
            type="button"
            onClick={() => void mutate()}
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-on-surface px-5 text-sm font-semibold text-background transition-colors hover:bg-on-surface/90"
          >
            <RefreshCw className="h-4 w-4" />
            {t("leads.tryAgain")}
          </button>
        </section>
      ) : !leads?.length ? (
        <LeadsEmptyState hasSearch={hasSearch} />
      ) : (
        <section className="space-y-4">
          <div className="hidden gap-4 px-6 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant/55 md:grid md:grid-cols-[1.15fr_1.35fr_0.9fr_0.75fr] lg:grid-cols-[1.15fr_1.35fr_0.9fr_0.9fr_0.75fr] xl:grid-cols-[1.15fr_1.35fr_0.9fr_0.9fr_0.9fr_0.75fr]">
            <span>{t("leads.nameLabel")}</span>
            <span>{t("leads.emailLabel")}</span>
            <span className="hidden lg:block">{t("leads.phoneLabel")}</span>
            <span>{t("leads.widgetLabel")}</span>
            <span className="hidden xl:block">{t("leads.agentLabel")}</span>
            <span>{t("leads.capturedLabel")}</span>
          </div>

          <div className="space-y-3">
            {leads.map((lead) => (
              <div
                key={lead.id}
                className="group relative overflow-hidden rounded-[1.5rem] border border-outline-variant/10 bg-surface-container-lowest shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-xl hover:shadow-primary/5"
              >
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/[0.02] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <button
                  type="button"
                  aria-label={t("leads.openLeadDetails", { name: lead.name })}
                  onClick={() => handleRowClick(lead)}
                  className="absolute inset-0 z-0 cursor-pointer outline-none focus-visible:bg-primary/[0.05] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
                />

                <div className="pointer-events-none relative z-10 px-5 py-5 md:grid md:grid-cols-[1.15fr_1.35fr_0.9fr_0.75fr] md:items-center md:gap-4 md:px-6 md:py-4 lg:grid-cols-[1.15fr_1.35fr_0.9fr_0.9fr_0.75fr] xl:grid-cols-[1.15fr_1.35fr_0.9fr_0.9fr_0.9fr_0.75fr]">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-xs font-bold text-primary ring-1 ring-primary/20 shadow-inner transition-transform duration-300 group-hover:scale-110 group-hover:shadow-primary/20">
                      {getLeadInitials(lead.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-on-surface transition-colors group-hover:text-primary">{lead.name}</p>
                      <p className="mt-1 truncate text-xs text-on-surface-variant/60 md:hidden">
                        {lead.widget_name}
                      </p>
                    </div>
                  </div>

                  {lead.email ? (
                    <a
                      href={`mailto:${lead.email}`}
                      className="pointer-events-auto mt-4 flex min-w-0 items-center gap-2 text-sm text-on-surface-variant transition-colors hover:text-primary md:mt-0"
                    >
                      <Mail className="h-4 w-4 shrink-0 text-primary/40 transition-colors duration-300 group-hover:text-primary md:hidden lg:block lg:opacity-0 lg:-translate-x-2 lg:group-hover:translate-x-0 lg:group-hover:opacity-100" />
                      <span className="truncate">{lead.email}</span>
                    </a>
                  ) : (
                    <span className="mt-4 text-sm text-on-surface-variant/35 md:mt-0">—</span>
                  )}

                  <div className="hidden min-w-0 lg:block">
                    {lead.phone ? (
                      <a
                        href={`tel:${lead.phone}`}
                        className="pointer-events-auto flex items-center gap-2 truncate text-sm text-on-surface-variant transition-colors hover:text-primary"
                      >
                        <Phone className="h-4 w-4 shrink-0 text-primary/40 opacity-0 -translate-x-2 transition-all duration-300 group-hover:translate-x-0 group-hover:text-primary group-hover:opacity-100" />
                        {lead.phone}
                      </a>
                    ) : (
                      <span className="text-sm text-on-surface-variant/35">—</span>
                    )}
                  </div>

                  <span className="hidden truncate text-sm font-medium text-on-surface-variant/80 md:block">
                    {lead.widget_name}
                  </span>
                  <span className="hidden truncate text-sm text-on-surface-variant xl:block">
                    {lead.agent_name || t("leads.unknownAgent")}
                  </span>
                  <div className="mt-4 flex items-center justify-between md:mt-0 md:block">
                    {lead.phone ? (
                      <a
                        href={`tel:${lead.phone}`}
                        className="pointer-events-auto flex items-center gap-2 text-xs text-on-surface-variant lg:hidden"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        {lead.phone}
                      </a>
                    ) : (
                      <span className="lg:hidden" />
                    )}
                    <div className="flex items-center gap-2">
                      <span
                        title={formatLocaleDateTime(lead.created_at, language)}
                        className="rounded-lg bg-surface-container-low px-2.5 py-1 text-xs font-medium text-on-surface-variant/70 transition-colors group-hover:bg-primary/[0.06] group-hover:text-primary"
                      >
                        {formatRelativeDate(lead.created_at, language)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {selectedLead ? (
        <LeadDetailPanel lead={selectedLead} onClose={() => setSelectedLead(null)} />
      ) : null}
    </div>
  );
}
