import { motion } from "framer-motion";
import type { WidgetAgentConfig, WidgetConfig } from "../types";
import { MiloMark } from "./MiloMark";

interface HomeTabProps {
  config: WidgetConfig;
  selectedAgent: WidgetAgentConfig | null;
  isChooserMode: boolean;
  onSelectAgent: (widgetAgentId: string) => void;
  onSendMessage: (text?: string) => void;
  onSwitchToMessages: () => void;
  onSwitchToContact?: () => void;
}

const TRANSLATIONS = {
  en: {
    noSpecialists: "No specialists are attached to this widget yet.",
    contactBadge: "Contact",
    chatBadge: "Chat",
    openSpecialist: "Open this specialist to continue.",
    contactPrompt: "Prefer a callback? Leave your details",
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
    contactPrompt: "Vill du hellre bli uppringd? Kontakta oss",
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
  onSwitchToContact,
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
        className="absolute inset-0 flex flex-col overflow-hidden bg-transparent"
      >
        {/* Header title */}
        <div className="px-6 pt-8 pb-6 shrink-0 z-10 w-full max-w-lg mx-auto text-center lg:max-w-3xl">
          <h1 className="text-[1.6rem] font-extrabold tracking-tight text-widget-fg leading-tight">
            {config.home.title || t.openSpecialist}
          </h1>
          {config.home.subtitle ? (
            <p className="mt-2 text-[13px] text-widget-muted leading-relaxed">{config.home.subtitle}</p>
          ) : null}
        </div>

        {/* Agent list — borderless clean rows */}
        <div
          className="flex-1 overflow-y-auto widget-scroll px-4 pb-8 flex flex-col w-full max-w-lg mx-auto lg:max-w-3xl"
        >
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
            config.agents.map((agent, idx) => (
              <motion.button
                key={agent.widgetAgentId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.06 + 0.08, duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                onClick={() => onSelectAgent(agent.widgetAgentId)}
                className="group w-full flex items-center justify-between gap-4 px-4 py-4 text-left transition-colors duration-200 hover:text-[var(--widget-secondary)]"
                style={{
                  borderBottom: idx < config.agents.length - 1
                    ? '1px solid var(--widget-border)'
                    : 'none'
                }}
              >
                {/* Left: name + description */}
                <div className="flex flex-col min-w-0">
                  <span className="text-[15px] font-semibold text-widget-fg group-hover:text-[var(--widget-secondary)] transition-colors duration-200 leading-snug">
                    {agent.label}
                  </span>
                  {config.agents.length > 1 && agent.description && (
                    <span className="mt-0.5 text-[12px] text-widget-muted leading-snug line-clamp-2">
                      {agent.description}
                    </span>
                  )}
                </div>

                {/* Right: chevron */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4 shrink-0 text-widget-muted group-hover:text-[var(--widget-secondary)] transition-colors duration-200"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </motion.button>
            ))
          )}
        </div>
      </motion.div>
    );
  }

  const quickActions = selectedAgent.showQuickActions !== false && Array.isArray(selectedAgent.quickActions)
    ? selectedAgent.quickActions
    : [];

  return (
    <motion.div
      key={`agent-${selectedAgent.widgetAgentId}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25 }}
      className="absolute inset-0 flex flex-col items-center justify-center overflow-y-auto px-5 py-3 widget-scroll"
    >
      <div className="flex w-full max-w-lg flex-col items-center text-center my-auto">
        <div className="mb-4 flex flex-col items-center w-full">
          <h1 className="text-2xl sm:text-[28px] font-bold leading-snug tracking-tight text-widget-fg max-w-sm">
            {selectedAgent.greeting || "Welcome."}
          </h1>
          <div
            className="mt-3 flex max-w-full items-center justify-center gap-1.5 px-4 text-center text-[10px] font-semibold uppercase tracking-[0.16em] sm:text-[11px] sm:tracking-[0.18em]"
            style={{ color: "var(--widget-milo-color)" }}
          >
            <MiloMark className="h-[17px] w-[17px]" />
            <span className="truncate">Milo</span>
          </div>

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
            className="relative mt-5 w-full max-w-sm shadow-lg shadow-black/5"
          >
            <input
              type="text"
              name="message"
              placeholder={selectedAgent.placeholder || "How can we help?"}
              className="widget-input-shell w-full rounded-2xl py-3 pl-4 pr-12 text-[15px] font-medium text-widget-fg shadow-inner placeholder:text-widget-fg/40"
            />
            <button
              type="submit"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-xl bg-transparent p-2 text-widget-muted transition-colors hover:text-[var(--widget-secondary)] active:scale-95 disabled:opacity-50"
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

          {onSwitchToContact ? (
            <button
              type="button"
              onClick={onSwitchToContact}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-widget-muted transition-colors hover:text-widget-fg"
            >
              <span>{t.contactPrompt}</span>
              <span aria-hidden="true">&rarr;</span>
            </button>
          ) : null}
        </div>

        {quickActions.length > 0 ? (
          <div className="mt-1 mb-2 flex w-full max-w-sm flex-col items-center">
            {quickActions.map((action, index) => (
              <button
                key={`${action.label}-${index}`}
                onClick={() => handleQuickAction(action.prompt)}
                className="group flex w-full items-center justify-between gap-3 px-1 py-2.5 text-left transition-colors duration-200"
                style={{
                  borderBottom:
                    index < quickActions.length - 1
                      ? "1px solid var(--widget-border)"
                      : "none",
                }}
              >
                <span className="text-[13px] font-medium text-widget-fg group-hover:text-[var(--widget-secondary)] transition-colors duration-200 leading-snug">
                  {action.label}
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4 shrink-0 text-widget-muted group-hover:text-[var(--widget-secondary)] transition-colors duration-200"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
