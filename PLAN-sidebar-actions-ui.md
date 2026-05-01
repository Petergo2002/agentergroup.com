# Overview

The goal is to simplify and enhance the UI and UX of the "Allowed Actions" selection interface in the agent builder (currently a modal). For integrations like Outlook with hundreds of actions, the current layout is visually cluttered and overwhelming. The new design will be cleaner, more premium, and easier to navigate.

## User Review Required / Socratic Gate (Please Answer)

> [!IMPORTANT]
> **Open Questions before we begin:**
> 1. **Layout Style:** Do you prefer keeping this as a **centered modal** (like it is now), or should we change it to a **right-aligned sliding sidebar** panel?
> 2. **Compactness:** Should we keep the descriptions for every action, or make the list more compact (e.g., showing descriptions only on hover or clicking an info icon)?
> 3. **Large Lists:** For integrations with 300+ tools (like Outlook), is a scrollable list fine, or would you prefer a grouped view (e.g., categorizing by "Email", "Calendar", etc. if possible)?

## Project Type
**WEB** (Next.js, React, Tailwind CSS)

## Success Criteria
- The action selection interface looks premium, modern, and uncluttered.
- Selecting and unselecting actions is intuitive.
- The interface handles large lists (e.g., 300+ tools) gracefully without looking broken or chaotic.
- Search functionality is prominent and feels fast.

## Tech Stack
- Next.js (App Router)
- React
- Tailwind CSS
- Lucide/Material Icons

## Task Breakdown

### Task 1: Refactor Action Selection Layout
- **Agent:** `frontend-specialist`
- **Skill:** `frontend-design`
- **INPUT:** `src/app/(app)/agents/[id]/builder/page.tsx`
- **OUTPUT:** Modified modal/sidebar component structure to replace the current three-card stats and bulky sections.
- **VERIFY:** Ensure the modal opens correctly when clicking "Edit Actions" on a tool node.

### Task 2: Improve Action List Items
- **Agent:** `frontend-specialist`
- **Skill:** `frontend-design`
- **INPUT:** Action list mapping in `src/app/(app)/agents/[id]/builder/page.tsx`.
- **OUTPUT:** Updated list items to use clickable cards or modern toggles instead of standard checkboxes. Add subtle hover states and glassmorphism touches.
- **VERIFY:** Check that clicking anywhere on the item toggles the selection and updates the state.

### Task 3: Streamline "Recommended" vs "All"
- **Agent:** `frontend-specialist`
- **Skill:** `frontend-design`
- **INPUT:** Action sections in `src/app/(app)/agents/[id]/builder/page.tsx`.
- **OUTPUT:** Consolidate the "Recommended" pills and "All Actions" list into a unified list with clear visual grouping or tabs (e.g., Tabs for "Recommended" and "All").
- **VERIFY:** Ensure recommended actions are easily identifiable and can be mass-selected if needed.

## Phase X: Final Verification
- [ ] Run `npm run lint` and `npx tsc --noEmit`
- [ ] Verify UI aesthetics (no purple/violet, use premium Tailwind classes)
- [ ] Ensure action selection state saves correctly when closing the modal
- [ ] Verify mobile/responsive behavior of the modal/sidebar
