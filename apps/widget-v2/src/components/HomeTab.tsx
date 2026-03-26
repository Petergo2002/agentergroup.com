import { motion } from "framer-motion";
import { useState } from "react";
import type { WidgetAgentConfig, WidgetConfig } from "../types";

interface HomeTabProps {
  config: WidgetConfig;
  selectedAgent: WidgetAgentConfig | null;
  isChooserMode: boolean;
  onSelectAgent: (widgetAgentId: string) => void;
  onSendMessage: (text?: string) => void;
  onSwitchToMessages: () => void;
}

const TRANSLATIONS = {
  en: {
    noSpecialists: "No specialists are attached to this widget yet.",
    contactBadge: "Contact",
    chatBadge: "Chat",
    openSpecialist: "Open this specialist to continue.",
    tabAll: "All",
    tabActive: "Active",
    tabDraft: "Draft",
    colAgent: "Agent",
    colModel: "Model",
    colPrompts: "Prompts",
    colUpdated: "Last Update",
    colStatus: "Status",
    showing: "Showing",
    of: "of",
    agents: "Agents",
  },
  sv: {
    noSpecialists: "Inga specialister är kopplade till denna widget ännu.",
    contactBadge: "Kontakt",
    chatBadge: "Chatt",
    openSpecialist: "Öppna denna specialist för att fortsätta.",
    tabAll: "Alla",
    tabActive: "Aktiva",
    tabDraft: "Utkast",
    colAgent: "Agent",
    colModel: "Modell",
    colPrompts: "Prompter",
    colUpdated: "Senast uppdaterad",
    colStatus: "Status",
    showing: "Visar",
    of: "av",
    agents: "Agenter",
  },
};



/** Returns a colour for the left-side status dot */
function statusDotColor(active: boolean): string {
  return active
    ? "bg-emerald-500"
    : "bg-amber-400";
}

const ITEMS_PER_PAGE = 4;

export function HomeTab({
  config,
  selectedAgent,
  isChooserMode,
  onSelectAgent,
  onSendMessage,
  onSwitchToMessages,
}: HomeTabProps) {
  const t = TRANSLATIONS[config.widget.language as keyof typeof TRANSLATIONS] || TRANSLATIONS.en;

  // Tab state: "all" | "active" | "draft"
  const [activeTab, setActiveTab] = useState<"all" | "active" | "draft">("all");
  const [currentPage, setCurrentPage] = useState(1);

  const handleQuickAction = (prompt: string) => {
    onSendMessage(prompt);
    onSwitchToMessages();
  };

  if (isChooserMode || !selectedAgent) {
    // Filter agents by tab
    const filteredAgents = config.agents.filter((agent) => {
      if (activeTab === "active") return agent.interactionMode === "chat";
      if (activeTab === "draft") return agent.interactionMode === "contact_form";
      return true;
    });

    const totalPages = Math.max(1, Math.ceil(filteredAgents.length / ITEMS_PER_PAGE));
    const safePage = Math.min(currentPage, totalPages);
    const pagedAgents = filteredAgents.slice(
      (safePage - 1) * ITEMS_PER_PAGE,
      safePage * ITEMS_PER_PAGE
    );

    const handleTabChange = (tab: "all" | "active" | "draft") => {
      setActiveTab(tab);
      setCurrentPage(1);
    };

    return (
      <motion.div
        key="chooser"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.25 }}
        className="absolute inset-0 flex flex-col overflow-hidden"
      >
        {/* Header title */}
        {config.home.title ? (
          <div className="px-5 pt-6 pb-3 shrink-0">
            <h1 className="text-xl font-bold tracking-tight text-widget-fg">
              {config.home.title}
            </h1>
            {config.home.subtitle ? (
              <p className="mt-1 text-xs text-widget-muted">{config.home.subtitle}</p>
            ) : null}
          </div>
        ) : null}

        {/* Tabs row */}
        <div className="px-5 pb-3 shrink-0 flex items-center gap-1 border-b border-[var(--widget-border)]">
          {(["all", "active", "draft"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`picker-tab ${activeTab === tab ? "picker-tab-active" : ""}`}
            >
              {tab === "all" ? t.tabAll : tab === "active" ? t.tabActive : t.tabDraft}
            </button>
          ))}
        </div>

        {/* Table header */}
        <div className="picker-table-header shrink-0 grid grid-cols-[auto_1fr_auto_auto_auto] items-center px-5 py-2.5 gap-3">
          <div className="w-2.5" />
          <span className="picker-col-label">{t.colAgent}</span>
          <span className="picker-col-label text-right w-16">{t.colPrompts}</span>
          <span className="picker-col-label text-right w-20 hidden sm:block">{t.colUpdated}</span>
          <span className="picker-col-label text-right w-12">{t.colStatus}</span>
        </div>

        {/* Agent rows */}
        <div className="flex-1 overflow-y-auto widget-scroll">
          {pagedAgents.length === 0 ? (
            <div className="flex items-center justify-center h-full px-5 text-sm text-widget-muted">
              {t.noSpecialists}
            </div>
          ) : (
            pagedAgents.map((agent, idx) => {
              const isActive = agent.interactionMode === "chat";
              const dotColor = statusDotColor(isActive);
              const promptCount = agent.quickActions?.length ?? 0;

              return (
                <motion.button
                  key={agent.widgetAgentId}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  onClick={() => onSelectAgent(agent.widgetAgentId)}
                  className="picker-row w-full grid grid-cols-[auto_1fr_auto_auto_auto] items-center px-5 py-3.5 gap-3 text-left"
                >
                  {/* Status dot */}
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor}`} />

                  {/* Agent name + description */}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-widget-fg truncate">
                      {agent.label}
                    </p>
                    <p className="text-xs text-widget-muted truncate mt-0.5">
                      {agent.description || t.openSpecialist}
                    </p>
                  </div>

                  {/* Prompts */}
                  <span className="text-xs text-widget-muted text-right w-16 shrink-0">
                    {promptCount} {t.colPrompts}
                  </span>

                  {/* Last Update - hidden on tiny screens */}
                  <span className="text-xs text-widget-muted text-right w-20 shrink-0 hidden sm:block">
                    —
                  </span>

                  {/* Toggle-style status */}
                  <span
                    className={`shrink-0 w-9 h-5 rounded-full relative transition-colors duration-200 ${
                      isActive ? "bg-[var(--widget-primary)]" : "bg-[var(--widget-border)]"
                    }`}
                    aria-label={isActive ? "Active" : "Inactive"}
                    style={{ display: "block" }}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                        isActive ? "translate-x-[18px]" : "translate-x-0.5"
                      }`}
                    />
                  </span>
                </motion.button>
              );
            })
          )}
        </div>

        {/* Footer: count + pagination */}
        <div className="shrink-0 px-5 py-3 border-t border-[var(--widget-border)] flex items-center justify-between gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-widget-muted">
            {t.showing} {Math.min((safePage - 1) * ITEMS_PER_PAGE + 1, filteredAgents.length)}–{Math.min(safePage * ITEMS_PER_PAGE, filteredAgents.length)} {t.of} {filteredAgents.length} {t.agents}
          </span>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              {/* Prev */}
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="picker-page-btn"
                aria-label="Previous page"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>

              {/* Page numbers */}
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`picker-page-btn ${page === safePage ? "picker-page-btn-active" : ""}`}
                >
                  {page}
                </button>
              ))}

              {/* Next */}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="picker-page-btn"
                aria-label="Next page"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  const quickActions = Array.isArray(selectedAgent.quickActions)
    ? selectedAgent.quickActions
    : [];

  return (
    <motion.div
      key={`agent-${selectedAgent.widgetAgentId}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25 }}
      className="absolute inset-0 flex flex-col items-center overflow-y-auto px-6 pb-24 pt-16 widget-scroll md:px-10 md:justify-center md:pt-8 lg:px-14 lg:pt-10"
    >
      <div className="flex w-full max-w-4xl flex-col items-center text-center">
        <div className="mb-8 flex flex-col items-center">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-widget-fg">
            {selectedAgent.greeting || "Welcome."}
          </h1>
          <p className="mt-4 max-w-full truncate px-4 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-widget-muted sm:text-[11px] sm:tracking-[0.18em]">
            {selectedAgent.label}
          </p>
          {selectedAgent.description ? (
            <p className="mt-4 max-w-lg text-sm leading-7 text-widget-muted">
              {selectedAgent.description}
            </p>
          ) : null}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const text = formData.get("message") as string;
              if (text?.trim()) {
                onSendMessage(text.trim());
                onSwitchToMessages();
                return;
              }

              onSwitchToMessages();
            }}
            className="relative mt-8 w-full max-w-sm shadow-lg shadow-black/5"
          >
            <input
              type="text"
              name="message"
              placeholder={selectedAgent.placeholder || "How can we help?"}
              className="widget-input-shell w-full rounded-2xl py-3.5 pl-5 pr-14 text-base font-medium text-widget-fg shadow-inner placeholder:text-widget-fg/40"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-widget-primary p-2.5 text-widget-primary-fg shadow-btn-glow transition-all hover:scale-105 hover:opacity-100 active:scale-95"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="ml-0.5 h-4 w-4"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </button>
          </form>
        </div>

        {quickActions.length > 0 ? (
          <div className="mb-16 flex w-full max-w-xl flex-col items-center gap-3">
            {quickActions.map((action, index) => (
              <button
                key={`${action.label}-${index}`}
                onClick={() => handleQuickAction(action.prompt)}
                className="widget-surface-button group relative flex w-full max-w-[34rem] items-center justify-center overflow-hidden rounded-full px-5 py-3 text-widget-fg"
              >
                <span className="text-center text-sm font-semibold leading-6">
                  {action.label}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
