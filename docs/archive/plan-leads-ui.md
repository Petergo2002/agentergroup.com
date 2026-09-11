# Leads UI Refresh Plan

> [!WARNING]
> **ARCHIVED — 11 September 2026. Shipped; unticked boxes are misleading.**
>
> The checkboxes below were never ticked, but the work landed: the
> glassmorphic detail panel, inbox-style rows and bento grouping are present
> in `src/components/leads/LeadsPageClient.tsx` and
> `src/components/leads/LeadAiSummaryCard.tsx`. Treat this as a design brief,
> not an open task list. Current design rules live in
> [UI Patterns](../guides/ui-patterns.md).
>
> Note: this plan names Framer Motion as a possible dependency. It is **not**
> a dependency of this project and must not be added on the strength of this
> document — the animations use Tailwind `animate-in` utilities.

## Overview
Codex successfully implemented the functional foundation of the Leads page. However, it currently looks like a standard data table. We need to elevate this to a "UI/UX Pro Max" experience that wows the user, applying premium aesthetics, dynamic interactions, and glassmorphism, while strictly adhering to the project's design system (and avoiding any purple/violet colors).

## Project Type
WEB

## Success Criteria
- The Leads page feels like a premium, dynamic inbox rather than a static data table.
- Hover states, micro-animations, and transitions make the interface feel alive.
- The slide-over detail panel uses stunning glassmorphism and modern typography.
- No purple/violet hex codes are introduced.
- Existing functionality (SWR, search, mobile responsiveness) remains intact.

## Tech Stack
- React / Next.js (App Router)
- Tailwind CSS v4
- Lucide React for iconography
- Framer Motion (if already in project) or Tailwind animate-in utilities for micro-animations.

## File Structure
- `src/components/leads/LeadsPageClient.tsx` (Target for UI overhaul)

## Task Breakdown

### Task 1: Elevate Page Header & Empty State
- **Agent**: `frontend-specialist`
- **Skill**: `frontend-design`
- **Priority**: P2
- **Dependencies**: None
- **INPUT**: Current `LeadsPageClient.tsx` header and `LeadsEmptyState`.
- **OUTPUT**: Redesigned header with a subtle, dynamic gradient mesh background, animated badge count, and refined typography. The empty state gets an engaging, vibrant illustration/icon treatment that encourages users rather than looking like an error.
- **VERIFY**: The header renders beautifully with gradients; the empty state looks inviting.

### Task 2: Redesign the Leads List (Inbox Vibe)
- **Agent**: `frontend-specialist`
- **Skill**: `frontend-design`
- **Priority**: P2
- **Dependencies**: Task 1
- **INPUT**: Current table-like row map in `LeadsPageClient.tsx`.
- **OUTPUT**: Transform the rows into "inbox-style" cards or highly styled rows with:
  - Deep, soft shadows on hover (`shadow-premium` to `shadow-2xl` transitions).
  - Micro-interactions (e.g., mail/phone icons revealing gracefully on row hover).
  - Avatar initials with dynamic, rich color generation (based on lead name, excluding purple).
- **VERIFY**: Rows highlight smoothly on hover and display actions seamlessly.

### Task 3: Premium Detail Panel (Glassmorphism)
- **Agent**: `frontend-specialist`
- **Skill**: `frontend-design`
- **Priority**: P2
- **Dependencies**: Task 2
- **INPUT**: Current `LeadDetailPanel` component.
- **OUTPUT**: A stunning slide-over panel utilizing:
  - Heavy backdrop-blur (`backdrop-blur-md` or `backdrop-blur-xl`) with a translucent surface (`bg-surface-container-lowest/80`).
  - Animated entry/exit.
  - Information grouped into beautifully bordered "bento box" style cards.
  - A sticky, prominent "Open Conversation" action button with a glowing hover effect.
- **VERIFY**: Clicking a lead opens a smooth, glassmorphic panel with properly aligned bento-style details.

## ✅ PHASE X Verification Checklist
- [ ] Lint: `npm run lint && npx tsc --noEmit`
- [ ] UX Audit: `python .agent/skills/frontend-design/scripts/ux_audit.py .`
- [ ] Build Check: `npm run build`
- [ ] Rule Compliance: No purple/violet hex codes used.
- [ ] Rule Compliance: Socratic Gate respected.
