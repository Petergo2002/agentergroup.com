"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  Copy,
  Mail,
  MessageSquareText,
  Phone,
  RefreshCw,
  Search,
  UserCheck,
  X,
} from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { useAppContext } from "@/components/app/AppContext";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { useToast } from "@/components/ui/ToastProvider";
import { LeadAiSummaryCard } from "@/components/leads/LeadAiSummaryCard";
import { formatLocaleDateTime } from "@/lib/i18n";
import { jsonFetcher, workspaceSWRKey } from "@/lib/json-fetcher";
import type { LeadConversationSummary, WidgetLeadListItem } from "@/lib/types";
import { formatRelativeDate } from "@/lib/utils";

interface LeadsPageClientProps {
  workspaceId: string;
  workspaceName: string;
}

interface LeadDetailPanelProps {
  lead: WidgetLeadListItem;
  onClose: () => void;
  onSummaryChange: (
    leadId: string,
    summary: LeadConversationSummary,
  ) => void;
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
    <div className="app-card overflow-hidden p-0">
      <div className="hidden h-14 skeleton border-b border-outline-variant/10 md:block" />
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="h-[92px] skeleton border-b border-outline-variant/10 opacity-70 last:border-b-0 md:h-[76px]"
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
    <section className="app-empty-state sm:px-10">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant ring-1 ring-outline-variant/15">
        {hasSearch ? (
          <Search className="h-5 w-5" strokeWidth={2} />
        ) : (
          <UserCheck className="h-5 w-5" strokeWidth={2} />
        )}
      </div>
      <h2 className="text-base font-semibold tracking-normal text-on-surface">
        {hasSearch ? t("leads.noSearchResultsTitle") : t("leads.noLeadsTitle")}
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-on-surface-variant/70">
        {hasSearch ? t("leads.noSearchResultsDescription") : t("leads.noLeadsDescription")}
      </p>
    </section>
  );
}

/**
 * Shows the complete lead record in a responsive, keyboard-dismissable slide-over.
 */
function LeadDetailPanel({ lead, onClose, onSummaryChange }: LeadDetailPanelProps) {
  const { language, t } = useLanguage();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClose = useCallback(() => {
    if (closeTimeoutRef.current !== null) return;
    setIsOpen(false);
    closeTimeoutRef.current = setTimeout(onClose, 300);
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    document.body.style.overflow = "hidden";

    // Trigger smooth slide-in
    const timer = requestAnimationFrame(() => setIsOpen(true));
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(timer);
      if (closeTimeoutRef.current !== null) {
        clearTimeout(closeTimeoutRef.current);
      }
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [handleClose]);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex justify-end overflow-hidden">
      {/* Backdrop */}
      <button
        type="button"
        aria-label={t("leads.closeDetails")}
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
      />

      {/* Slide-over panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-detail-title"
        className={`relative z-10 flex h-full w-full max-w-xl sm:max-w-2xl lg:max-w-3xl flex-col border-l border-outline-variant/15 bg-surface-container-lowest shadow-[0_0_60px_rgba(0,0,0,0.3)] transition-transform duration-300 ease-out transform ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Panel Header */}
        <div className="border-b border-outline-variant/10 bg-surface/80 backdrop-blur-md px-6 py-5 sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-base font-extrabold text-primary ring-1 ring-primary/20 shadow-xs">
                {getLeadInitials(lead.name)}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant/60">
                  {t("leads.detailsTitle")}
                </p>
                <h2
                  id="lead-detail-title"
                  className="mt-0.5 truncate text-xl font-bold tracking-tight text-on-surface"
                >
                  {lead.name}
                </h2>
              </div>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={handleClose}
              aria-label={t("leads.closeDetails")}
              className="group relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-outline-variant/15 bg-surface-container-low text-on-surface-variant transition-all duration-200 hover:border-primary/30 hover:bg-surface-container-high hover:text-on-surface hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <X className="h-4.5 w-4.5 transition-transform duration-200 group-hover:rotate-90" />
            </button>
          </div>
        </div>

        {/* Panel Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6 sm:px-8">
          <LeadAiSummaryCard
            leadId={lead.id}
            summary={lead.ai_summary}
            canRegenerate={Boolean(lead.widget_session_id)}
            onSummaryChange={(summary) => onSummaryChange(lead.id, summary)}
          />

          <section className="space-y-3">
            {lead.email ? (
              <a
                href={`mailto:${lead.email}`}
                className="group flex items-center gap-3.5 rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-4 text-sm text-on-surface shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-surface-container-low hover:shadow-sm"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-110">
                  <Mail className="h-4.5 w-4.5" />
                </div>
                <span className="truncate font-medium transition-colors group-hover:text-primary">{lead.email}</span>
              </a>
            ) : null}
            {lead.phone ? (
              <a
                href={`tel:${lead.phone}`}
                className="group flex items-center gap-3.5 rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-4 text-sm text-on-surface shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-surface-container-low hover:shadow-sm"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-110">
                  <Phone className="h-4.5 w-4.5" />
                </div>
                <span className="font-medium transition-colors group-hover:text-primary">{lead.phone}</span>
              </a>
            ) : null}
          </section>

          <section className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-xs">
            <h3 className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant">
              <MessageSquareText className="h-3.5 w-3.5 text-primary" />
              {t("leads.messageLabel")}
            </h3>
            <p className="mt-3.5 whitespace-pre-wrap text-sm leading-relaxed text-on-surface-variant">
              {lead.message || <span className="italic opacity-60">{t("leads.noMessage")}</span>}
            </p>
          </section>

          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-4 shadow-xs">
              <p className="text-xs font-medium text-on-surface-variant/65">
                {t("leads.sourceLabel")}
              </p>
              <div className="mt-1.5 flex items-center">
                {lead.source_channel === "contact_form" ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <Phone className="h-3 w-3" />
                    {t("leads.sourceContactForm")}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                    <MessageSquareText className="h-3 w-3" />
                    {t("leads.sourceChat")}
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-4 shadow-xs">
              <p className="text-xs font-medium text-on-surface-variant/65">
                {t("leads.widgetLabel")}
              </p>
              <p className="mt-1.5 truncate text-sm font-semibold text-on-surface">
                {lead.widget_name}
              </p>
            </div>
            <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-4 shadow-xs">
              <p className="text-xs font-medium text-on-surface-variant/65">
                {t("leads.agentLabel")}
              </p>
              <p className="mt-1.5 truncate text-sm font-semibold text-on-surface">
                {lead.agent_name || t("leads.unknownAgent")}
              </p>
            </div>
          </section>

          <section className="flex items-center justify-between rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-4 shadow-xs">
            <h3 className="text-xs font-medium text-on-surface-variant/65">
              {t("leads.capturedLabel")}
            </h3>
            <p className="text-sm font-semibold text-on-surface">
              {formatLocaleDateTime(lead.created_at, language)}
            </p>
          </section>
        </div>

        {/* Panel Footer */}
        {lead.widget_session_id ? (
          <div className="border-t border-outline-variant/10 bg-surface-container-lowest p-6 sm:p-8">
            <Link
              href={`/analytics?session=${encodeURIComponent(lead.widget_session_id)}`}
              className="app-primary-button group w-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
            >
              <MessageSquareText className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
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
  const { user, workspace } = useAppContext();
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
  } = useSWR<WidgetLeadListItem[]>(
    workspaceSWRKey(user.id, workspace.id, leadsUrl),
    jsonFetcher,
    {
      keepPreviousData: true,
      refreshInterval: 60_000,
    },
  );
  const hasSearch = Boolean(deferredSearch.trim());
  const displayedWorkspaceName =
    workspace.id === workspaceId ? workspace.name : workspaceName;

  const { showToast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const closeLeadDetails = useCallback(() => setSelectedLead(null), []);

  const handleCopy = (event: React.MouseEvent, text: string, fieldId: string) => {
    event.stopPropagation();
    event.preventDefault();
    void navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    showToast(`Copied ${text}`, "success");
    setTimeout(() => setCopiedField(null), 2000);
  };

  /**
   * Opens a lead while preserving native link behavior for row-level mail and phone links.
   */
  const handleRowClick = (lead: WidgetLeadListItem) => {
    setSelectedLead(lead);
  };

  const handleSummaryChange = (
    leadId: string,
    summary: LeadConversationSummary,
  ) => {
    setSelectedLead((current) =>
      current && current.id === leadId
        ? { ...current, ai_summary: summary }
        : current,
    );
    void mutate(
      (current) =>
        current?.map((lead) =>
          lead.id === leadId ? { ...lead, ai_summary: summary } : lead,
        ),
      { revalidate: false },
    );
  };

  return (
    <div
      key={workspaceId}
      className="app-page"
    >
      <header className="app-section-header">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 max-w-2xl">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold leading-tight tracking-normal text-on-surface sm:text-3xl">
                {t("leads.title")}
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.08] px-2.5 py-1 text-xs font-semibold text-primary">
                {t("leads.capturedCount", { count: leads?.length ?? 0 })}
              </span>
            </div>
            <p className="mt-2 max-w-xl text-sm leading-6 text-on-surface-variant/75">
              {t("leads.pageDescription")}
            </p>
            <p className="mt-2 truncate text-xs font-medium text-on-surface-variant/60">
              {displayedWorkspaceName}
            </p>
          </div>
          <div className="inline-flex h-10 items-center gap-2 rounded-xl border border-outline-variant/15 bg-surface-container-low px-3 text-sm font-medium text-on-surface-variant">
            <span
              className={`h-2 w-2 rounded-full ${
                isValidating ? "animate-pulse bg-primary" : "bg-success"
              }`}
            />
            {isValidating ? t("leads.refreshing") : t("leads.liveInbox")}
          </div>
        </div>
      </header>

      <section className="app-filter-panel flex items-center gap-3">
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
        <section className="rounded-2xl border border-error/15 bg-error/[0.04] px-6 py-16 text-center">
          <h2 className="text-base font-semibold tracking-normal text-on-surface">
            {t("leads.loadErrorTitle")}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-on-surface-variant/70">
            {t("leads.loadErrorDescription")}
          </p>
          <button
            type="button"
            onClick={() => void mutate()}
          className="app-primary-button mt-6"
          >
            <RefreshCw className="h-4 w-4" />
            {t("leads.tryAgain")}
          </button>
        </section>
      ) : !leads?.length ? (
        <LeadsEmptyState hasSearch={hasSearch} />
      ) : (
        <section className="space-y-4">
          <div className="hidden gap-4 px-4 py-2 text-xs font-semibold text-on-surface-variant/65 md:grid md:grid-cols-[1.15fr_1.35fr_0.9fr_0.75fr] lg:grid-cols-[1.15fr_1.35fr_0.9fr_0.9fr_0.75fr] xl:grid-cols-[1.15fr_1.35fr_0.9fr_0.9fr_0.9fr_0.75fr]">
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
                className="group relative overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-lowest shadow-sm transition-colors hover:border-primary/25 hover:bg-surface-container-low/45"
              >
                <button
                  type="button"
                  aria-label={t("leads.openLeadDetails", { name: lead.name })}
                  onClick={() => handleRowClick(lead)}
                  className="absolute inset-0 z-0 cursor-pointer outline-none focus-visible:bg-primary/[0.05] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
                />

                <div className="pointer-events-none relative z-10 px-5 py-5 md:grid md:grid-cols-[1.15fr_1.35fr_0.9fr_0.75fr] md:items-center md:gap-4 md:px-6 md:py-4 lg:grid-cols-[1.15fr_1.35fr_0.9fr_0.9fr_0.75fr] xl:grid-cols-[1.15fr_1.35fr_0.9fr_0.9fr_0.9fr_0.75fr]">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary ring-1 ring-primary/15">
                      {getLeadInitials(lead.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-on-surface transition-colors group-hover:text-primary">{lead.name}</p>
                        {lead.source_channel === "contact_form" ? (
                          <span className="inline-flex shrink-0 items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            {t("leads.sourceContactForm")}
                          </span>
                        ) : (
                          <span className="inline-flex shrink-0 items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            {t("leads.sourceChat")}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-xs text-on-surface-variant/60 md:hidden">
                        {lead.widget_name}
                      </p>
                    </div>
                  </div>

                  {lead.email ? (
                    <div className="pointer-events-auto mt-4 flex min-w-0 items-center gap-1.5 md:mt-0">
                      <a
                        href={`mailto:${lead.email}`}
                        className="flex min-w-0 items-center gap-2 text-sm text-on-surface-variant transition-colors hover:text-primary"
                      >
                        <Mail className="h-4 w-4 shrink-0 text-primary/55 md:hidden lg:block" />
                        <span className="truncate">{lead.email}</span>
                      </a>
                      <button
                        type="button"
                        onClick={(e) => handleCopy(e, lead.email!, `email-${lead.id}`)}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-on-surface-variant/50 transition-colors hover:bg-surface-container hover:text-on-surface"
                        title="Copy email"
                        aria-label="Copy email"
                      >
                        {copiedField === `email-${lead.id}` ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 animate-in zoom-in-75" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  ) : (
                    <span className="mt-4 text-sm text-on-surface-variant/35 md:mt-0">—</span>
                  )}

                  <div className="hidden min-w-0 lg:block">
                    {lead.phone ? (
                      <div className="pointer-events-auto flex items-center gap-1.5">
                        <a
                          href={`tel:${lead.phone}`}
                          className="flex items-center gap-2 truncate text-sm text-on-surface-variant transition-colors hover:text-primary"
                        >
                          <Phone className="h-4 w-4 shrink-0 text-primary/55" />
                          {lead.phone}
                        </a>
                        <button
                          type="button"
                          onClick={(e) => handleCopy(e, lead.phone!, `phone-${lead.id}`)}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-on-surface-variant/50 transition-colors hover:bg-surface-container hover:text-on-surface"
                          title="Copy phone"
                          aria-label="Copy phone"
                        >
                          {copiedField === `phone-${lead.id}` ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 animate-in zoom-in-75" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
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
        <LeadDetailPanel
          lead={selectedLead}
          onClose={closeLeadDetails}
          onSummaryChange={handleSummaryChange}
        />
      ) : null}
    </div>
  );
}
