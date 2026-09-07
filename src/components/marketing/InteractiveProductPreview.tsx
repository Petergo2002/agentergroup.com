"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  Bot,
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  Lock,
  RotateCw,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  UserRoundCheck,
  Zap,
} from "lucide-react";
import { MiloLogo } from "@/components/brand/MiloLogo";
import type { Messages } from "@/locales/en";
import styles from "./landing.module.css";

interface InteractiveProductPreviewProps {
  copy: Messages["landing"]["preview"];
}

interface Scenario {
  readonly id: string;
  readonly chip: string;
  readonly visitorMessage: string;
  readonly miloMessage: string;
  readonly status: string;
  readonly action?: string;
}

export function InteractiveProductPreview({ copy }: InteractiveProductPreviewProps) {
  const scenarios: readonly Scenario[] =
    copy.scenarios && copy.scenarios.length > 0
      ? copy.scenarios
      : [
          {
            id: "qualify",
            chip: "Qualify Lead",
            visitorMessage: copy.visitorMessage,
            miloMessage: copy.miloMessage,
            status: copy.lead,
            action: copy.nextStep,
          },
        ];

  const [activeScenarioId, setActiveScenarioId] = useState<string>(scenarios[0].id);
  const [isSimulatingTyping, setIsSimulatingTyping] = useState<boolean>(false);

  const currentScenario =
    scenarios.find((s) => s.id === activeScenarioId) || scenarios[0];

  const handleSelectScenario = (scenario: Scenario) => {
    if (scenario.id === activeScenarioId) return;
    setActiveScenarioId(scenario.id);
    setIsSimulatingTyping(true);
  };

  useEffect(() => {
    if (!isSimulatingTyping) return;
    const timer = setTimeout(() => {
      setIsSimulatingTyping(false);
    }, 320);
    return () => clearTimeout(timer);
  }, [isSimulatingTyping, activeScenarioId]);

  const getStatusCards = (scenario: Scenario) => {
    switch (scenario.id) {
      case "knowledge":
        return [
          { id: "card-knowledge", icon: BookOpenCheck, label: copy.knowledge },
          { id: "card-status", icon: ShieldCheck, label: scenario.status || "Verified source" },
          { id: "card-action", icon: Zap, label: scenario.action || "Answered in <1s" },
        ];
      case "booking": {
        const bookingAction =
          scenario.action && scenario.action !== "Ready to book" && scenario.action !== "Redo att boka"
            ? scenario.action
            : copy.nextStep && copy.nextStep !== "Ready to book" && copy.nextStep !== "Redo att boka"
              ? copy.nextStep
              : copy.lead === "Lead sparat"
                ? "Mötestider föreslagna"
                : "Calendar slots proposed";
        return [
          { id: "card-knowledge", icon: BookOpenCheck, label: copy.knowledge },
          { id: "card-status", icon: UserRoundCheck, label: copy.lead || "Lead captured" },
          { id: "card-action", icon: CalendarCheck2, label: bookingAction },
        ];
      }
      case "qualify":
      default:
        return [
          { id: "card-knowledge", icon: BookOpenCheck, label: copy.knowledge },
          { id: "card-status", icon: UserRoundCheck, label: copy.lead || "Lead captured" },
          { id: "card-action", icon: CalendarCheck2, label: scenario.action || "Synced to CRM" },
        ];
    }
  };

  const statusCards = getStatusCards(currentScenario);

  return (
    <div className="relative mx-auto w-full max-w-6xl">
      {/* Outer Glow & Window Container */}
      <div
        className={`${styles.previewGlow} relative overflow-hidden rounded-2xl md:rounded-[2rem] border border-[var(--mkt-border)] p-2 sm:p-3.5 shadow-[var(--mkt-shadow-lg)]`}
      >
        <div className="overflow-hidden rounded-xl md:rounded-[1.4rem] border border-black/10 bg-white shadow-xs">
          {/* Top Browser Bar (Chrome) */}
          <div className="flex h-11 items-center justify-between border-b border-black/8 bg-[#fbfaf8] px-3 sm:px-5">
            {/* Window controls and browser navigation */}
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5" aria-hidden="true">
                <span className="h-3 w-3 rounded-full bg-[#ff5f56]" />
                <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
                <span className="h-3 w-3 rounded-full bg-[#27c93f]" />
              </div>
              <div className="hidden sm:flex items-center gap-1 text-black/35">
                <ChevronLeft className="h-3.5 w-3.5" />
                <ChevronRight className="h-3.5 w-3.5" />
                <RotateCw className="ml-1 h-3 w-3" />
              </div>
            </div>

            {/* Centered URL address bar */}
            <div className="flex items-center gap-2 rounded-lg border border-black/8 bg-white px-3 sm:px-4 py-1 text-[11px] font-medium text-black/75 shadow-2xs">
              <Lock className="h-3 w-3 text-black/45" />
              <span className="hidden sm:inline text-black/40">https://</span>
              <span className="font-semibold text-black/80">nordicgrowth.se</span>
              <span className="mx-1 hidden h-3 w-px bg-black/15 sm:inline" />
              <span className="rounded bg-[var(--mkt-warm)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--mkt-orange-text)]">
                {copy.browserLabel}
              </span>
            </div>

            {/* Right: Interactive Badge */}
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--mkt-orange-text)] sm:text-xs">
              <Sparkles className="h-3.5 w-3.5 animate-pulse" />
              <span className="hidden sm:inline">Interactive Demo</span>
            </div>
          </div>

          {/* Browser Content Viewport (The Mock Client Website) */}
          <div className="relative bg-[#fdfcfb] overflow-hidden">
            <div className={`${styles.heroGrid} pointer-events-none absolute inset-0`} aria-hidden="true" />

            {/* Mock Website Top Navigation */}
            <div className="relative z-10 flex items-center justify-between border-b border-black/6 bg-white/80 px-4 py-2.5 sm:px-8 sm:py-3 backdrop-blur-sm">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-[var(--mkt-ink)] text-white text-[11px] font-black">
                    N
                  </div>
                  <span className="font-headline text-xs sm:text-sm font-extrabold tracking-tight text-[var(--mkt-ink)]">
                    Nordic Growth
                  </span>
                </div>
                <div className="hidden md:flex items-center gap-5 text-xs font-semibold text-black/60">
                  <span className="text-black font-bold">Services</span>
                  <span>Case Studies</span>
                  <span>About</span>
                  <span>Pricing</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden sm:block text-[11px] font-medium text-black/50">
                  <span>hello@nordicgrowth.se</span>
                </div>
                <div className="rounded-lg bg-[var(--mkt-ink)] px-3 py-1.5 text-[10px] sm:text-[11px] font-bold text-white shadow-xs">
                  Contact
                </div>
              </div>
            </div>

            {/* Mock Website Body: 2-Column Responsive Layout */}
            <div className="relative z-0 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-6 lg:gap-10 p-4 sm:p-8 lg:p-10 min-h-[34rem] sm:min-h-[38rem] items-center">
              {/* Left Column: Authentic Client Website Hero */}
              <div className="space-y-4 sm:space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white/90 px-3 py-1 text-[10px] sm:text-xs font-bold text-[var(--mkt-muted)] shadow-2xs">
                  <span className="h-2 w-2 rounded-full bg-[var(--mkt-orange)]" />
                  <span>B2B Growth & Advisory</span>
                </div>

                <div>
                  <h2 className="font-headline text-xl sm:text-3xl lg:text-[2.25rem] font-extrabold leading-[1.14] tracking-tight text-[var(--mkt-ink)]">
                    {copy.websiteTitle}
                  </h2>
                  <p className="mt-2.5 sm:mt-3.5 text-xs sm:text-sm lg:text-base leading-relaxed text-[var(--mkt-muted)] max-w-lg">
                    {copy.websiteDescription}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 rounded-xl bg-[var(--mkt-orange)] px-4 py-2.5 text-xs font-bold text-[var(--mkt-ink)] shadow-xs">
                    <span>Explore Services</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                  <div className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-xs font-semibold text-black/70 shadow-2xs">
                    Client Stories
                  </div>
                </div>

                {/* Social proof badge */}
                <div className="flex items-center gap-3 border-t border-black/6 pt-4">
                  <div className="flex -space-x-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-[9px] font-bold text-slate-700">
                      HL
                    </div>
                    <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-amber-100 text-[9px] font-bold text-amber-800">
                      SL
                    </div>
                    <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-orange-100 text-[9px] font-bold text-orange-800">
                      MB
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 text-[11px] font-bold text-amber-500">
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                      <span className="ml-1 text-black/80">4.9/5</span>
                    </div>
                    <p className="text-[10px] text-black/50 font-medium">Trusted by 250+ companies</p>
                  </div>
                </div>

                {/* Mini Feature Highlights */}
                <div className="hidden sm:grid grid-cols-2 gap-3 pt-1">
                  <div className="rounded-xl border border-black/6 bg-white/95 p-3 shadow-2xs">
                    <p className="text-xs font-bold text-black flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Strategic Insights
                    </p>
                    <p className="mt-1 text-[11px] text-black/60 leading-relaxed">
                      Tailored guidance to accelerate lead generation and conversion.
                    </p>
                  </div>
                  <div className="rounded-xl border border-black/6 bg-white/95 p-3 shadow-2xs">
                    <p className="text-xs font-bold text-black flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      Automated Workflows
                    </p>
                    <p className="mt-1 text-[11px] text-black/60 leading-relaxed">
                      Milo answers, qualifies, and schedules customer meetings 24/7.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column: Floating Interactive Chat with Milo Widget */}
              <div className="flex justify-center lg:justify-end">
                <div
                  className={`${styles.demoChat} w-full max-w-[23.5rem] sm:max-w-[25rem] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_24px_64px_-24px_rgba(24,24,24,0.35)]`}
                >
                  {/* Chat Header */}
                  <div className="flex items-center justify-between border-b border-black/7 bg-white px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className={`${styles.miloPulse} rounded-full`}>
                        <MiloLogo size={30} className="h-[30px] w-[30px]" />
                      </span>
                      <div>
                        <p className="text-xs font-bold text-[var(--mkt-ink)]">{copy.chatTitle}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-[9px] font-semibold text-[var(--mkt-success)]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--mkt-success)] animate-pulse" aria-hidden="true" />
                          {copy.online}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-md bg-[var(--mkt-warm)] px-2 py-0.5 text-[9px] font-bold text-[var(--mkt-orange-text)]">
                        AI Active
                      </span>
                      <Bot className="h-4 w-4 text-[var(--mkt-tertiary)]" aria-hidden="true" />
                    </div>
                  </div>

                  {/* Scenario quick selector chips */}
                  {scenarios.length > 1 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto border-b border-black/6 bg-[var(--mkt-soft)]/60 px-3 py-2 scrollbar-none">
                      {scenarios.map((scenario) => {
                        const isSelected = scenario.id === activeScenarioId;
                        return (
                          <button
                            key={scenario.id}
                            type="button"
                            onClick={() => handleSelectScenario(scenario)}
                            className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all ${
                              isSelected
                                ? "bg-[var(--mkt-ink)] text-white shadow-xs"
                                : "bg-white text-[var(--mkt-muted)] border border-black/8 hover:text-[var(--mkt-ink)] hover:border-black/20"
                            }`}
                          >
                            {scenario.chip}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Chat messages */}
                  <div className="space-y-3 bg-[#fdfcfb] px-4 py-4 min-h-[13rem]">
                    <div className={`${styles.demoVisitor} ml-auto max-w-[86%]`}>
                      <p className="mb-1 text-right text-[9px] font-semibold text-[var(--mkt-tertiary)]">
                        {copy.visitor}
                      </p>
                      <p className="rounded-2xl rounded-br-md bg-[var(--mkt-ink)] px-3.5 py-2.5 text-[11px] leading-4 text-white sm:text-xs sm:leading-5 shadow-xs transition-opacity duration-200">
                        {currentScenario.visitorMessage}
                      </p>
                    </div>

                    <div className={`${styles.demoMilo} flex max-w-[94%] items-start gap-2`}>
                      <MiloLogo size={22} className="mt-1 h-[22px] w-[22px] shrink-0" />
                      {isSimulatingTyping ? (
                        <div className="rounded-2xl rounded-bl-md border border-[var(--mkt-border)] bg-white px-4 py-3 shadow-xs">
                          <div className="flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--mkt-orange)] animate-bounce [animation-delay:-0.3s]" />
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--mkt-orange)] animate-bounce [animation-delay:-0.15s]" />
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--mkt-orange)] animate-bounce" />
                          </div>
                        </div>
                      ) : (
                        <p className="rounded-2xl rounded-bl-md border border-[var(--mkt-border)] bg-white px-3.5 py-2.5 text-[11px] leading-4 text-[var(--mkt-ink)] sm:text-xs sm:leading-5 shadow-xs animate-fadeIn">
                          {currentScenario.miloMessage}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Chat input footer */}
                  <div className="flex items-center gap-2 border-t border-black/7 bg-white p-3">
                    <div className="flex h-9 flex-1 items-center rounded-xl bg-[var(--mkt-soft)] px-3 text-[10px] text-[var(--mkt-tertiary)] font-medium">
                      {copy.inputPlaceholder}
                    </div>
                    <button
                      type="button"
                      aria-label="Send message"
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--mkt-orange)] text-[var(--mkt-ink)] shadow-xs transition-transform hover:scale-105 active:scale-95"
                    >
                      <Send className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Status Badges - Clean 3-column row spanning desktop */}
      <div className="mt-4 sm:mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3.5">
        {statusCards.map(({ id, icon: Icon, label }, index) => (
          <div
            key={id}
            style={{ "--motion-order": index } as React.CSSProperties}
            className={`${styles.floatingStatus} flex items-center gap-3 rounded-xl border border-[var(--mkt-border)] bg-white/95 px-4 py-3 shadow-[var(--mkt-shadow-sm)] backdrop-blur transition-all`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--mkt-success-soft)] text-[var(--mkt-success)]">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-xs sm:text-sm font-bold leading-tight text-[var(--mkt-ink)]">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
