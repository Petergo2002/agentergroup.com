"use client";

import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CircleHelp,
  Compass,
  Database,
  LayoutGrid,
  MessageSquare,
  Network,
  Users,
} from "lucide-react";
import { MiloLogo } from "@/components/brand/MiloLogo";
import styles from "./landing.module.css";

interface MockConversation {
  id: string;
  visitor: string;
  company: string;
  snippet: string;
  time: string;
  channel: string;
}

const mockConversations: MockConversation[] = [
  {
    id: "1",
    visitor: "Henrik Larsson",
    company: "Nordic Logistics",
    snippet: "Interested in the Growth plan for our sales team. Can we connect our HubSpot CRM?",
    time: "2m ago",
    channel: "Website Chat",
  },
  {
    id: "2",
    visitor: "Sofia Lindqvist",
    company: "Designify Studio",
    snippet: "Can Milo hold a consultation for tomorrow at 10:00 AM? We are ready to start.",
    time: "14m ago",
    channel: "Website Chat",
  },
  {
    id: "3",
    visitor: "Marcus Berg",
    company: "TechFlow AB",
    snippet: "Does Milo support dual-language Swedish and English out of the box?",
    time: "28m ago",
    channel: "Website Chat",
  },
];

export function DashboardHeroPreview() {
  return (
    <div className={`${styles.dashboardScrollStage} relative mx-auto w-full max-w-6xl select-none pointer-events-none`}>
      {/* 3D Animated Scroll Card */}
      <div className={`${styles.dashboardScrollCard} relative overflow-hidden rounded-2xl md:rounded-[2rem] border border-black/10 bg-white/95 p-2 sm:p-3 shadow-[0_24px_70px_-24px_rgba(24,24,24,0.22)] backdrop-blur-xl`}>
        {/* macOS Browser / App Chrome */}
        <div className="flex h-11 items-center justify-between border-b border-black/7 bg-[#fbfaf8] px-3 sm:px-4.5 rounded-t-xl">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5" aria-hidden="true">
              <span className="h-3 w-3 rounded-full bg-[#ff5f56] shadow-xs inline-block" />
              <span className="h-3 w-3 rounded-full bg-[#ffbd2e] shadow-xs inline-block" />
              <span className="h-3 w-3 rounded-full bg-[#27c93f] shadow-xs inline-block" />
            </div>
            <div className="ml-3 hidden sm:flex items-center gap-2 text-[11px] font-medium text-black/50">
              <span className="font-semibold text-black/75">Avenro</span>
              <span>/</span>
              <span className="text-black/80 font-bold">Dashboard</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-black/50">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="font-semibold text-black/70">Connected</span>
            </div>
          </div>
        </div>

        {/* Real Replicated App Shell Window Body (Pure Display, No Scrollbars) */}
        <div className="flex overflow-hidden rounded-b-xl bg-[#f7f6f3] text-black">
          {/* Replicated Sidebar (Dashboard Active, Pure Display) */}
          <aside className="w-12 sm:w-52 md:w-56 shrink-0 flex flex-col border-r border-black/8 bg-[#fdfdfc]">
            {/* Workspace Switcher */}
            <div className="border-b border-black/6 p-2 sm:p-3.5">
              <div className="flex items-center justify-center sm:justify-start gap-2 rounded-xl border border-black/6 bg-white p-1.5 sm:p-2 shadow-xs">
                <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg bg-orange-50 border border-orange-200/60">
                  <MiloLogo size={18} className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
                </div>
                <div className="hidden sm:block min-w-0 flex-1 text-left">
                  <p className="truncate text-xs font-bold leading-tight text-black">Growth Studio</p>
                  <p className="flex items-center gap-1 text-[10px] font-semibold text-[var(--mkt-orange-text)]">
                    <span>Pro Plan</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation (Matches exact Avenro structure) */}
            <div className="flex-1 space-y-3 sm:space-y-4 p-1.5 sm:p-3">
              <div>
                <p className="hidden sm:block px-2.5 mb-1 text-[10px] font-bold uppercase tracking-wider text-black/40">
                  Overview
                </p>
                <div className="space-y-1">
                  {/* Dashboard is highlighted as Active */}
                  <div className="flex items-center justify-center sm:justify-start gap-2.5 rounded-xl px-1.5 sm:px-2.5 py-2 text-xs bg-[#181818] font-bold text-white shadow-xs">
                    <LayoutGrid className="h-4 w-4 shrink-0 text-white" />
                    <span className="hidden sm:inline">Dashboard</span>
                  </div>

                  <div className="flex items-center justify-center sm:justify-start gap-2.5 rounded-xl px-1.5 sm:px-2.5 py-2 text-xs text-black/70 font-medium">
                    <MiloLogo size={16} className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline">Milo</span>
                  </div>

                  <div className="flex items-center justify-center sm:justify-start gap-2.5 rounded-xl px-1.5 sm:px-2.5 py-2 text-xs text-black/70 font-medium">
                    <MessageSquare className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline">Website Chat</span>
                  </div>
                </div>
              </div>

              <div>
                <p className="hidden sm:block px-2.5 mb-1 text-[10px] font-bold uppercase tracking-wider text-black/40">
                  Grow
                </p>
                <div className="space-y-1">
                  <div className="flex items-center justify-center sm:justify-between rounded-xl px-1.5 sm:px-2.5 py-2 text-xs text-black/70 font-medium">
                    <div className="flex items-center gap-2.5">
                      <Users className="h-4 w-4 shrink-0" />
                      <span className="hidden sm:inline">Leads</span>
                    </div>
                    <span className="hidden sm:inline-flex rounded-full bg-[var(--mkt-orange)]/15 px-1.5 py-0.5 text-[9px] font-extrabold text-[var(--mkt-orange-text)]">
                      18
                    </span>
                  </div>

                  <div className="flex items-center justify-center sm:justify-start gap-2.5 rounded-xl px-1.5 sm:px-2.5 py-2 text-xs text-black/70 font-medium">
                    <BarChart3 className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline">Analytics</span>
                  </div>

                  <div className="flex items-center justify-center sm:justify-start gap-2.5 rounded-xl px-1.5 sm:px-2.5 py-2 text-xs text-black/70 font-medium">
                    <CircleHelp className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline">Improve Milo</span>
                  </div>

                  <div className="flex items-center justify-center sm:justify-start gap-2.5 rounded-xl px-1.5 sm:px-2.5 py-2 text-xs text-black/70 font-medium">
                    <Database className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline">Knowledge</span>
                  </div>

                  <div className="flex items-center justify-center sm:justify-start gap-2.5 rounded-xl px-1.5 sm:px-2.5 py-2 text-xs text-black/70 font-medium">
                    <Network className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline">Connections</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Quota Meter */}
            <div className="hidden sm:block border-t border-black/6 p-3 bg-black/[0.015]">
              <div className="rounded-xl border border-black/6 bg-white p-2.5 shadow-xs">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="text-black/70">Usage Quota</span>
                  <span className="text-[var(--mkt-orange-text)]">84%</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/8">
                  <div className="h-full rounded-full bg-gradient-to-r from-[var(--mkt-orange)] to-[#ff8c42] w-[84%]" />
                </div>
                <p className="mt-1.5 text-[10px] text-black/50 font-medium">840 / 1,000 messages</p>
              </div>
            </div>
          </aside>

          {/* Main Dashboard Canvas (Replicating real DashboardPageClient.tsx) */}
          <main className="flex-1 p-2.5 sm:p-5 lg:p-6 overflow-hidden">
            <div className="space-y-3 sm:space-y-5">
              {/* DashboardHeader (from DashboardHeader.tsx) */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-black/6 pb-2.5 sm:pb-4">
                <div>
                  <h1 className="text-base sm:text-xl md:text-2xl font-extrabold tracking-tight text-black">
                    Good morning, <span className="bg-gradient-to-r from-[var(--mkt-ink)] via-[var(--mkt-orange-text)] to-[var(--mkt-orange)] bg-clip-text text-transparent">Peter</span>.
                  </h1>
                  <p className="mt-0.5 text-[11px] sm:text-xs text-black/60 font-medium">
                    Overview of your AI employee and live customer interactions.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-2.5 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs font-bold text-black shadow-xs">
                    <span>View Analytics</span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-black/60" />
                  </div>
                </div>
              </div>

              {/* StatsGrid (from StatsGrid.tsx) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3.5">
                <div className="rounded-xl sm:rounded-2xl border border-black/8 bg-white p-2.5 sm:p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-lg sm:rounded-xl bg-orange-50 text-[var(--mkt-orange-text)]">
                      <MiloLogo size={20} className="h-3.5 w-3.5 sm:h-4.5 sm:w-4.5 shrink-0" />
                    </div>
                    <span className="rounded-full bg-[#f4f2ee] border border-black/6 px-1.5 py-0.5 sm:px-2 text-[8px] sm:text-[9px] font-semibold text-black/60">
                      Active
                    </span>
                  </div>
                  <div className="mt-2 sm:mt-3">
                    <p className="text-lg sm:text-2xl font-extrabold tracking-tight text-black leading-tight">Active</p>
                    <p className="text-[10px] sm:text-[11px] font-bold text-black/70">Milo Status</p>
                    <p className="mt-0.5 text-[9px] sm:text-[10px] text-black/45 truncate">Online & ready</p>
                  </div>
                </div>

                <div className="rounded-xl sm:rounded-2xl border border-black/8 bg-white p-2.5 sm:p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <Users className="h-3.5 w-3.5 sm:h-4.5 sm:w-4.5" />
                    </div>
                    <span className="rounded-full bg-[#f4f2ee] border border-black/6 px-1.5 py-0.5 sm:px-2 text-[8px] sm:text-[9px] font-semibold text-black/60">
                      This Week
                    </span>
                  </div>
                  <div className="mt-2 sm:mt-3">
                    <p className="text-lg sm:text-2xl font-extrabold tracking-tight text-black leading-tight">148</p>
                    <p className="text-[10px] sm:text-[11px] font-bold text-black/70">Captured Leads</p>
                    <p className="mt-0.5 text-[9px] sm:text-[10px] text-black/45 truncate">+18 this week</p>
                  </div>
                </div>

                <div className="rounded-xl sm:rounded-2xl border border-black/8 bg-white p-2.5 sm:p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                      <MessageSquare className="h-3.5 w-3.5 sm:h-4.5 sm:w-4.5" />
                    </div>
                    <span className="rounded-full bg-[#f4f2ee] border border-black/6 px-1.5 py-0.5 sm:px-2 text-[8px] sm:text-[9px] font-semibold text-black/60">
                      Live
                    </span>
                  </div>
                  <div className="mt-2 sm:mt-3">
                    <p className="text-lg sm:text-2xl font-extrabold tracking-tight text-black leading-tight">42</p>
                    <p className="text-[10px] sm:text-[11px] font-bold text-black/70">Live Widgets</p>
                    <p className="mt-0.5 text-[9px] sm:text-[10px] text-black/45 truncate">Conversations</p>
                  </div>
                </div>

                <div className="rounded-xl sm:rounded-2xl border border-black/8 bg-white p-2.5 sm:p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                      <Network className="h-3.5 w-3.5 sm:h-4.5 sm:w-4.5" />
                    </div>
                    <span className="rounded-full bg-[#f4f2ee] border border-black/6 px-1.5 py-0.5 sm:px-2 text-[8px] sm:text-[9px] font-semibold text-black/60">
                      Synced
                    </span>
                  </div>
                  <div className="mt-2 sm:mt-3">
                    <p className="text-lg sm:text-2xl font-extrabold tracking-tight text-black leading-tight">6</p>
                    <p className="text-[10px] sm:text-[11px] font-bold text-black/70">Connected</p>
                    <p className="mt-0.5 text-[9px] sm:text-[10px] text-black/45 truncate">Google Cal, CRM...</p>
                  </div>
                </div>
              </div>

              {/* Main Content Split: RecentActivity + Milo Status (from DashboardPageClient.tsx) */}
              <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-3.5 sm:gap-4">
                {/* Left: RecentActivity section */}
                <div className="rounded-2xl border border-black/8 bg-white p-3 sm:p-5 shadow-xs">
                  <div className="flex items-center justify-between border-b border-black/6 pb-2.5 sm:pb-3">
                    <div>
                      <p className="text-xs font-semibold text-[var(--mkt-orange-text)] flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2" aria-hidden="true">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--mkt-orange)] opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--mkt-orange)]" />
                        </span>
                        Live Activity
                      </p>
                      <h2 className="mt-0.5 text-xs sm:text-base font-bold text-black">
                        Recent Conversations
                      </h2>
                    </div>

                    <div className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-black/60">
                      <span>View All</span>
                      <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    </div>
                  </div>

                  {/* Conversation rows (matching RecentActivity.tsx format) */}
                  <div className="mt-2.5 sm:mt-3 divide-y divide-black/6">
                    {mockConversations.map((convo, idx) => (
                      <div key={convo.id} className={`py-2 sm:py-2.5 first:pt-0 last:pb-0 ${idx === 2 ? 'hidden sm:block' : ''}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-[var(--mkt-ink)] text-white text-[9px] sm:text-[10px] font-bold">
                              {convo.visitor.charAt(0)}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-black leading-none">{convo.visitor}</p>
                              <p className="text-[10px] text-black/50 font-medium mt-0.5">{convo.company}</p>
                            </div>
                          </div>
                          <span className="text-[9px] sm:text-[10px] text-black/40 font-medium">{convo.time}</span>
                        </div>

                        <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-[11px] leading-relaxed text-black/75 line-clamp-1">
                          &ldquo;{convo.snippet}&rdquo;
                        </p>

                        <div className="mt-1 flex items-center gap-1.5 text-[9px] text-black/45 font-semibold">
                          <MessageSquare className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-black/40" />
                          <span>{convo.channel}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Milo Attention + Overview Section (matching DashboardPageClient.tsx) */}
                <div className="space-y-3 sm:space-y-4">
                  {/* Milo status card */}
                  <div className="rounded-2xl border border-black/8 bg-white p-3.5 sm:p-4 shadow-xs">
                    <h2 className="text-xs sm:text-sm font-semibold text-black">
                      Milo is up to date
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-black/60">
                      All visitor questions are answered from your approved knowledge base.
                    </p>
                    <div className="mt-3 grid gap-1.5 sm:gap-2">
                      <div className="flex items-center gap-2 rounded-xl bg-[#f4f2ee] px-3 py-1.5 sm:py-2 text-xs font-semibold text-black">
                        <CircleHelp className="h-4 w-4 text-[var(--mkt-orange-text)]" />
                        <span>Improve Milo</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-xl bg-[#f4f2ee] px-3 py-1.5 sm:py-2 text-xs font-semibold text-black">
                        <MessageSquare className="h-4 w-4 text-[var(--mkt-orange-text)]" />
                        <span>Website Chat</span>
                      </div>
                    </div>
                  </div>

                  {/* Overview Card (matching real DashboardPageClient.tsx) */}
                  <div className="hidden sm:block rounded-2xl border border-black/8 bg-white p-4 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[var(--mkt-orange-text)]">
                        <Compass className="h-4.5 w-4.5 text-[var(--mkt-orange-text)]" strokeWidth={2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-xs sm:text-sm font-semibold text-black">
                          Quick Access
                        </h2>
                        <p className="text-[11px] text-black/60">
                          Milo overview and settings
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-2 rounded-xl border border-black/6 bg-[#f4f2ee] px-3 py-2 text-xs font-semibold text-black">
                        <MiloLogo size={16} className="h-4 w-4" />
                        <span>Milo</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-xl border border-black/6 bg-[#f4f2ee] px-3 py-2 text-xs font-semibold text-black">
                        <Database className="h-4 w-4 text-[var(--mkt-orange-text)]" />
                        <span>Knowledge</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
