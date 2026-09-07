"use client";

import {
  ArrowRight,
  BookOpenCheck,
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  Lock,
  Paperclip,
  RotateCcw,
  RotateCw,
  Send,
  Sparkles,
  Star,
  UserRoundCheck,
  X,
} from "lucide-react";
import { MiloLogo } from "@/components/brand/MiloLogo";
import type { Messages } from "@/locales/en";
import styles from "./landing.module.css";

interface InteractiveProductPreviewProps {
  copy: Messages["landing"]["preview"];
}

export function InteractiveProductPreview({ copy }: InteractiveProductPreviewProps) {
  const isSv = copy.lead === "Lead sparat" || copy.browserLabel?.includes("webbplats");

  const scenario =
    copy.scenarios && copy.scenarios.length > 0
      ? copy.scenarios[0]
      : {
          id: "qualify",
          chip: isSv ? "Kvalificera lead" : "Qualify Lead",
          visitorMessage: copy.visitorMessage,
          miloMessage: copy.miloMessage,
          status: copy.lead,
          action: copy.nextStep,
        };

  const statusCards = [
    {
      id: "card-knowledge",
      icon: BookOpenCheck,
      label: copy.knowledge || (isSv ? "Godkänd kunskap användes" : "Verified source used"),
    },
    {
      id: "card-status",
      icon: UserRoundCheck,
      label: scenario.status || copy.lead || (isSv ? "Lead sparat" : "Lead captured"),
    },
    {
      id: "card-action",
      icon: CalendarCheck2,
      label: scenario.action || copy.nextStep || (isSv ? "Mötestider föreslagna" : "Calendar slots proposed"),
    },
  ];

  return (
    <div className="relative mx-auto w-full max-w-6xl select-none pointer-events-none">
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

            {/* Right: Live Preview Badge */}
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--mkt-orange-text)] sm:text-xs">
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {isSv ? "Widget v2 Förhandsvisning" : "Widget v2 Preview"}
              </span>
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

              {/* Right Column: Exact Widget v2 Replica (State after receiving message) */}
              <div className="flex justify-center lg:justify-end">
                <div
                  className={`${styles.demoChat} w-full max-w-[20.5rem] sm:max-w-[21.75rem] overflow-hidden rounded-[1.75rem] border border-black/10 bg-white shadow-[0_24px_64px_-16px_rgba(0,0,0,0.22),0_4px_16px_rgba(0,0,0,0.06)] flex flex-col`}
                >
                  {/* Widget v2 Header */}
                  <div className="relative flex h-14 items-center justify-between border-b border-black/6 bg-white px-4">
                    {/* Left: Avatar & Identity */}
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-xs ring-1 ring-black/8">
                        <MiloLogo size={20} color="#ff5c00" className="h-5 w-5" />
                      </div>
                      <div className="leading-tight">
                        <p className="text-xs font-bold text-black">Milo</p>
                        <p className="text-[10px] text-black/50 font-medium">
                          {isSv ? "AI-medarbetare" : "AI Employee"}
                        </p>
                      </div>
                    </div>

                    {/* Right: Reset and Close action buttons */}
                    <div className="flex items-center gap-1 text-black/45">
                      <div className="rounded-lg p-1.5">
                        <RotateCcw className="h-3.5 w-3.5" />
                      </div>
                      <div className="rounded-lg p-1.5">
                        <X className="h-4 w-4" />
                      </div>
                    </div>
                  </div>

                  {/* Widget v2 Messages Canvas */}
                  <div className="flex-1 space-y-4 bg-white p-4 sm:p-5 min-h-[22rem] sm:min-h-[24rem] flex flex-col justify-between">
                    <div className="space-y-4">
                      {/* User message: Floating right in brand orange pill with rounded-2xl rounded-br-sm */}
                      <div className="flex justify-end">
                        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[#ff5c00] px-4 py-2.5 text-white shadow-xs">
                          <p className="text-[13px] sm:text-[13.5px] leading-relaxed font-medium">
                            {scenario.visitorMessage}
                          </p>
                        </div>
                      </div>

                      {/* Milo message (Exact post-reception look from Widget v2 ChatView): NO bubble container, clean structured typography */}
                      <div className="flex flex-col gap-2 pl-0.5">
                        <div className="space-y-2">
                          <p className="text-[13px] sm:text-[13.5px] leading-relaxed text-[#0b0b0b] font-normal">
                            {scenario.miloMessage}
                          </p>

                          {/* Milo conversation identity directly beneath text */}
                          <div className="flex items-center gap-1.5 pt-1 text-[11px] text-[#71717a]">
                            <MiloLogo size={15} color="#ff5c00" className="h-4 w-4" />
                            <span>
                              <span className="font-semibold text-[#0b0b0b]">Milo</span>{" "}
                              <span aria-hidden="true">•</span> {isSv ? "AI-Agent" : "AI Agent"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Widget v2 Input Shell & Disclaimers */}
                    <div className="mt-auto space-y-2 pt-3">
                      {/* .widget-input-shell */}
                      <div className="flex items-center gap-2 rounded-2xl border border-[#e4e4e7] bg-[#f9fafb] px-3.5 py-2.5 shadow-xs">
                        <Paperclip className="h-4 w-4 text-[#71717a] shrink-0" />
                        <span className="flex-1 text-xs text-[#71717a] font-normal truncate">
                          {copy.inputPlaceholder || (isSv ? "Skriv ett meddelande…" : "Enter your message...")}
                        </span>
                        <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#ff5c00] text-white shadow-2xs">
                          <Send className="h-3.5 w-3.5" />
                        </div>
                      </div>

                      {/* Disclaimer */}
                      <div className="text-center pt-0.5">
                        <p className="text-[10px] text-[#71717a] leading-tight">
                          {isSv
                            ? "Chattmeddelanden kan behandlas automatiskt."
                            : "Chat messages may be processed automatically."}
                        </p>
                      </div>
                    </div>
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
            <span className="text-xs sm:text-sm font-bold leading-tight text-[var(--mkt-ink)]">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
