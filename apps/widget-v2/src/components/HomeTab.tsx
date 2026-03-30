import { motion } from "framer-motion";
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

export function HomeTab({
  config,
  selectedAgent,
  isChooserMode,
  onSelectAgent,
  onSendMessage,
  onSwitchToMessages,
}: HomeTabProps) {
  const t = TRANSLATIONS[config.widget.language as keyof typeof TRANSLATIONS] || TRANSLATIONS.en;

  const handleQuickAction = (prompt: string) => {
    onSendMessage(prompt);
    onSwitchToMessages();
  };

  if (isChooserMode || !selectedAgent) {
    return (
      <motion.div
        key="chooser"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.25 }}
        className="absolute inset-0 flex flex-col overflow-hidden bg-[var(--widget-bg)]"
      >
        {/* Header title */}
        <div className="px-6 pt-8 pb-4 shrink-0 z-10">
          <h1 className="text-[1.35rem] font-bold tracking-tight text-widget-fg leading-tight">
            {config.home.title || t.openSpecialist}
          </h1>
          {config.home.subtitle ? (
            <p className="mt-1.5 text-[13px] text-widget-muted">{config.home.subtitle}</p>
          ) : null}
        </div>

        {/* Agent rows */}
        <div className="flex-1 overflow-y-auto widget-scroll px-5 pb-8 pt-2 space-y-3">
          {config.agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[200px] text-center px-6">
              <div className="w-12 h-12 rounded-full bg-[var(--widget-border)] mb-4 flex items-center justify-center opacity-50">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-widget-muted">
                  <path d="M17 6.1H3" />
                  <path d="M21 12.1H3" />
                  <path d="M15.1 18H3" />
                </svg>
              </div>
              <p className="text-[13px] text-widget-muted max-w-[200px]">
                {t.noSpecialists}
              </p>
            </div>
          ) : (
            config.agents.map((agent, idx) => {
              // Extract initials for the avatar fallback
              const initials = agent.label
                ? agent.label.substring(0, 2).toUpperCase()
                : "AI";

              return (
                <motion.button
                  key={agent.widgetAgentId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 + 0.1, duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                  onClick={() => onSelectAgent(agent.widgetAgentId)}
                  className="group relative flex w-full items-center gap-4 rounded-[1.25rem] bg-[var(--widget-bg)] p-4 text-left shadow-[0_2px_12px_rgba(0,0,0,0.06)] ring-1 ring-[var(--widget-border)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.1)] hover:ring-[var(--widget-primary)] transition-all duration-300 overflow-hidden"
                >
                  {/* Subtle active state background glow */}
                  <div className="absolute inset-0 bg-[var(--widget-primary)] opacity-0 group-hover:opacity-5 transition-opacity duration-300" />
                  
                  {/* Avatar */}
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--widget-primary)] text-white font-bold text-[13px] tracking-wider shadow-sm ring-4 ring-[var(--widget-bg)] z-10">
                    {initials}
                  </div>

                  {/* Text Content */}
                  <div className="flex-1 min-w-0 pr-4 z-10">
                    <p className="text-[15px] font-bold text-widget-fg truncate group-hover:text-[var(--widget-primary)] transition-colors">
                      {agent.label}
                    </p>
                    <p className="text-[13px] text-widget-muted mt-0.5 leading-snug line-clamp-2 opacity-80">
                      {agent.description || "In conversation..."}
                    </p>
                  </div>
                  
                  {/* Arrow Indicator */}
                  <div className="shrink-0 opacity-0 -translate-x-3 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-[var(--widget-primary)] z-10">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                       <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </div>
                </motion.button>
              );
            })
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
