import { motion } from "framer-motion";
import { MessageSquare } from "lucide-react";
import type { WidgetAgentConfig, WidgetConfig } from "../types";

interface HomeTabProps {
  config: WidgetConfig;
  selectedAgent: WidgetAgentConfig | null;
  isChooserMode: boolean;
  isContactFormMode: boolean;
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
  },
  sv: {
    noSpecialists: "Inga specialister är kopplade till denna widget ännu.",
    contactBadge: "Kontakt",
    chatBadge: "Chatt",
    openSpecialist: "Öppna denna specialist för att fortsätta.",
  },
};

export function HomeTab({
  config,
  selectedAgent,
  isChooserMode,
  isContactFormMode,
  onSelectAgent,
  onSendMessage,
  onSwitchToMessages,
}: HomeTabProps) {
  const t = TRANSLATIONS[config.widget.language as keyof typeof TRANSLATIONS] || TRANSLATIONS.en;

  const handleQuickAction = (prompt: string) => {
    if (isContactFormMode) {
      onSwitchToMessages();
      return;
    }

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
        className="absolute inset-0 overflow-y-auto px-6 pb-12 pt-10 widget-scroll"
      >
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center">
          <div className="mx-auto max-w-xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-widget-fg">
              {config.home.title}
            </h1>
            {config.home.subtitle ? (
              <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-widget-muted">
                {config.home.subtitle}
              </p>
            ) : null}
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {config.agents.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] p-6 text-center text-sm leading-6 text-widget-muted sm:col-span-2">
                {t.noSpecialists}
              </div>
            ) : (
              config.agents.map((agent) => {
                return (
                  <button
                    key={agent.widgetAgentId}
                    onClick={() => onSelectAgent(agent.widgetAgentId)}
                    className="group rounded-[28px] border border-white/10 bg-white/[0.04] p-5 text-left transition-all hover:border-white/20 hover:bg-white/[0.06]"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <h2 className="text-lg font-semibold text-widget-fg">
                        {agent.label}
                      </h2>
                      <span className="shrink-0 rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-widget-muted">
                        {agent.interactionMode === "contact_form" ? t.contactBadge : t.chatBadge}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-widget-muted">
                      {agent.description || t.openSpecialist}
                    </p>
                  </button>
                );
              })
            )}
          </div>
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
      className="absolute inset-0 flex flex-col items-center overflow-y-auto px-6 pb-24 pt-16 widget-scroll md:justify-center md:pt-8 lg:pt-10"
    >
      <div className="flex w-full max-w-2xl flex-col items-center text-center">
        <div className="mb-8 flex flex-col items-center">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-widget-muted">
            {selectedAgent.label}
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-widget-fg">
            {selectedAgent.greeting || "Welcome."}
          </h1>
          {selectedAgent.description ? (
            <p className="mt-4 max-w-lg text-sm leading-7 text-widget-muted">
              {selectedAgent.description}
            </p>
          ) : null}

          {isContactFormMode ? (
            <button
              onClick={onSwitchToMessages}
              className="relative mt-8 flex w-full max-w-sm items-center justify-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-widget-primary py-3.5 text-widget-primary-fg shadow-btn-glow transition-transform active:scale-95"
            >
              <MessageSquare className="h-5 w-5 opacity-90" />
              <span className="text-base font-bold tracking-wide">
                Contact us
              </span>
            </button>
          ) : (
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
                className="w-full rounded-2xl border border-white/10 bg-white/[0.05] py-3.5 pl-5 pr-14 text-base font-medium text-widget-fg shadow-inner placeholder:text-widget-fg/40 transition-all focus:border-widget-primary/50 focus:outline-none focus:ring-2 focus:ring-widget-primary/50"
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
          )}
        </div>

        {quickActions.length > 0 ? (
          <div className="mb-16 flex w-full max-w-xl flex-col items-center gap-3">
            {quickActions.map((action, index) => (
              <button
                key={`${action.label}-${index}`}
                onClick={() => handleQuickAction(action.prompt)}
                className="group relative flex w-full max-w-[34rem] items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-widget-fg transition-all hover:bg-white/[0.08]"
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
