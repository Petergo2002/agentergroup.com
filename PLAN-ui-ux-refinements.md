# UI/UX Refinements (Shadcn-like)

## Overview
Apply subtle, premium aesthetic tweaks to UI components (buttons, search bars, modals, workspace switchers) to achieve a modern, crisp, and highly professional "shadcn/ui" look without changing the core layout or structural logic.

## Project Type
WEB

## Success Criteria
- [ ] Modals, buttons, and inputs have standardized modern radii (6px to 8px for standard elements, 12px for larger panels).
- [ ] Floating elements use layered drop shadows and crisp 1px borders with muted colors.
- [ ] Focus rings (`ring-2 ring-offset-2`) are consistently applied to all interactive elements for accessibility and polish.
- [ ] Interactive elements have tactile hover/active states (150ms transitions, `active:scale-[0.98]`).
- [ ] Typography uses high contrast for primary text and muted colors for secondary text/icons.
- [ ] Hover backgrounds use subtle alpha shifts.

## Tech Stack
- Next.js (App Router)
- React
- Tailwind CSS

## Task Breakdown

### Task 1: Update Modals (`src/components/ui/Modal.tsx`, etc.)
- **Agent:** `frontend-specialist`
- **Skills:** `frontend-design`
- **Priority:** P1
- **Dependencies:** None
- **INPUT:** Existing modal components with large border radii and heavy shadows.
- **OUTPUT:** Modals using `rounded-xl`, `border border-outline-variant/20`, softer shadows (`shadow-lg`), and crisp focus rings.
- **VERIFY:** Render a modal (e.g., Create Workspace) and verify the radius is tighter and shadow is subtle.

### Task 2: Refine Workspace Switcher (`src/components/layout/WorkspaceSwitcher.tsx`)
- **Agent:** `frontend-specialist`
- **Skills:** `frontend-design`
- **Priority:** P1
- **Dependencies:** None
- **INPUT:** Existing WorkspaceSwitcher dropdown and button.
- **OUTPUT:** Button and dropdown with standardized radii (`rounded-md`, `rounded-xl`), tactile active states, crisp borders, and subtle hover backgrounds.
- **VERIFY:** Click the workspace switcher, verify active scale down, and check the dropdown menu shadow and spacing.

### Task 3: Standardize Inputs & Search Bars
- **Agent:** `frontend-specialist`
- **Skills:** `frontend-design`
- **Priority:** P2
- **Dependencies:** None
- **INPUT:** Search bars in Agents/Knowledge/Widgets pages.
- **OUTPUT:** Inputs with `rounded-md`, `border border-outline-variant/30`, `focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2`.
- **VERIFY:** Focus an input and verify the sharp focus ring appears.

### Task 4: Standardize Buttons
- **Agent:** `frontend-specialist`
- **Skills:** `frontend-design`
- **Priority:** P2
- **Dependencies:** None
- **INPUT:** All primary/secondary buttons.
- **OUTPUT:** Buttons with `rounded-md`, `transition-all duration-150`, `active:scale-[0.98]`, and focus rings.
- **VERIFY:** Hover and click a button to observe the swift transition and scale effect.

## Phase X: Verification Checklist
- [ ] Run Linting & Type Checking
- [ ] Verify there are no purple/violet hex codes
- [ ] Socratic Gate questions answered
- [ ] Run UX Audit script `python .agent/skills/frontend-design/scripts/ux_audit.py .`
- [ ] Check console for warnings
- [ ] Manual test of the visual refinements
