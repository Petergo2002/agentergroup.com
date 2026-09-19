# Comprehensive Application UI & UX Refinement Plan

**Status: ACTIVE — Phase 1 complete, Phases 2–5 open.** Last reviewed 11 September 2026.

> **Goal:** Transform the Agentergroup Web Application into a world-class, modern SaaS experience (inspired by Vercel and Linear standards) through targeted, non-breaking visual polish, typography contrast, responsive touch targets, and tactile micro-interactions.

> [!NOTE]
> This board changes presentation only. Brand tokens, semantic CSS and the
> shared surface rules it must obey are defined in
> [UI Patterns](../guides/ui-patterns.md) — that guide is the source of truth,
> this board is the worklist.

---

## 🎯 Core UX Philosophy & Guidelines

1. **Eliminate Box Fatigue:** Replace nested heavy borders with clean, borderless surface hierarchy, subtle hover backgrounds (`bg-surface-container-low/70`), and soft dividers.
2. **Accessible Contrast (WCAG 4.5:1):** Ensure all secondary text, badges, metadata, and placeholder copy use high-contrast color tokens without translucency degradation (`text-on-surface-variant`).
3. **Tactile Micro-Interactions:** Add subtle scale states (`hover:scale-105`), focus-visible focus rings (`box-shadow: var(--shadow-focus)`), and smooth entrance transitions (`animate-in fade-in-50 zoom-in-95`).
4. **Zero Functionality Risk:** Purely visual, structural, and touch-interaction polish. No backend logic, database schemas, or API contracts are altered.

---

## 📋 Task Breakdown & Progress Board

### Phase 1: Dashboard & Portal Dropdown (COMPLETED ✅)
- [x] **Unboxed Header:** Removed heavy card border from `DashboardHeader.tsx` for airy top-of-canvas greeting.
- [x] **Clean KPI Tiles:** Converted heavy `StatsGrid.tsx` cards into modern borderless metric tiles.
- [x] **De-Cluttered Feeds:** Updated `RecentActivity.tsx` and `AgentStatusList.tsx` to clean borderless list rows.
- [x] **Create Agent Portal:** Refactored `CreateAgentDropdown.tsx` to use `createPortal` with fixed z-index and smart auto-flip position calculations.
- [x] **CTA De-duplication:** Replaced duplicate sidebar button with a sleek Quick Shortcuts card.

---

### Phase 2: Agents & Assistant Management (`/agents`)
- [ ] **Filter Tabs & Search Polish:** Refine search input focus ring and category filter tabs contrast (`/agents`).
- [ ] **Agent Card Surface Badges:** Enhance dark-mode contrast rings (`dark:ring-white/10`) and hover scale transitions on action buttons (`AgentCard.tsx`).
- [ ] **Empty States & Grid Spacing:** Ensure empty state illustrations and skeleton loaders use calm warm-surface backgrounds (`#FFF4EC` / `#f6f2ee`).

---

### Phase 3: Leads CRM & AI Summary Cards (`/leads`)
- [ ] **Lead AI Summary Glass Card:** Enhance `LeadAiSummaryCard.tsx` with a top light-accent glow line and crisp key-point bullets.
- [ ] **Leads Table Row Dividers:** Upgrade table row hover highlights (`hover:bg-surface-container-low/60`) and status chip contrast.
- [ ] **Mobile Card Fallbacks:** Ensure table data wraps cleanly on mobile viewports (<640px).

---

### Phase 4: Knowledge Base & Document Sources (`/knowledge`)
- [ ] **Upload Drag & Drop Target:** Add subtle hover ring accents and tactile icon feedback to document upload zones.
- [ ] **Source Status Pills & Progress:** Enhance sync progress bars and active source status indicators.

---

### Phase 5: Analytics & Conversation Explorer (`/analytics`)
- [ ] **Filter Panel Contrast:** Improve search filter inputs and date picker button readability.
- [ ] **Active Conversation Row Highlight:** Elevate selected conversation row in the list view with warm brand orange accent indicators (`#FF5C02`).
- [ ] **Chat Transcript Bubbles:** Sharpen visitor vs. agent chat bubble contrast for rapid scanning.

---

## 🛡 Verification & Quality Control

For every phase:
1. **TypeScript Typecheck:** `npx tsc --noEmit` (Must pass with 0 errors).
2. **ESLint Audit:** `npm run lint` (Must pass cleanly with 0 errors).
3. **Mobile & Theme Test:** Verify Light Mode and Dark Mode contrast across mobile (<640px) and desktop viewports.

---

## Cross-Cutting Polish Pass — 19 September 2026

Ten candidates surveyed across the app. Nine were real and are done; one was a
miscount on my part and is recorded so nobody re-opens it.

| # | Change | Where |
| --- | --- | --- |
| 1 | Relative timestamps tick instead of freezing | `RelativeTime`, `useTickingClock` |
| 2 | Reduced motion applied to everything, not named animations | `globals.css` |
| 3 | Counts go through `formatLocaleNumber` | `SourceTable` |
| 4 | Icon-only buttons carry real labels; styled `Tooltip` available | `Tooltip`, team settings |
| 5 | Charts and meters grow to their value on mount | `globals.css`, admin charts |
| 6 | Loading shimmers; pulse reserved for live | 12 skeleton files |
| 7 | Knowledge delete is optimistic, with rollback | `KnowledgePageClient` |
| 8 | Polled status is a live region | `SourceTable` |
| 9 | ~~Empty states~~ — **already covered**, see below | — |
| 10 | Preview chrome no longer fakes a real URL | `WidgetDevicePreview` |

### Notes worth keeping

**Reduced motion was the biggest real gap.** Four media blocks existed but each
named specific animations, leaving `animate-pulse` (~119 uses), `animate-spin`,
`animate-ping` and the enter animations untouched. The blanket rule collapses
animations to one frame rather than removing them, so anything awaiting an
`animationend` still fires. Spinners are exempt and merely slowed — a frozen
spinner reads as a crash.

**Timestamps never updated.** `formatRelativeDate` reads the clock at render
time, so "Just now" persisted until an unrelated repaint. `RelativeTime` ticks
once a minute, idles in a hidden tab, catches up on return, and emits a real
`<time>` element so the exact instant stays machine-readable.

**Pulse was overloaded**, meaning loading, live and attention at once. Skeletons
now shimmer, which frees pulse to mean one thing.

**Empty states were not a gap.** The original finding came from grepping the
literal string `EmptyState`, which missed the `app-empty-state` class and the
per-page variants; 12 files have them, and Leads and Knowledge already
distinguish searched, filtered, folder-scoped and genuinely-empty. No change
made.

**The preview chrome fake URL earned its place on this list** by fooling us
first: it built `https://<brand>.se` from the brand name and drew a realistic
address bar, which reads as the customer's live site being framed. It now says
"<brand> — preview".
