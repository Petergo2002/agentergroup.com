# Project Plan: Knowledge Source Library Redesign

> [!IMPORTANT]
> **Plan Location:** This file was generated as part of the `/plan` workflow. A more detailed version is available in the `implementation_plan.md` artifact.

## Goal
Redesign the Knowledge Source Library screen to match the "Elevated Canvas" design system from Stitch.

## Phases

### Phase 1: Context Check & Design Token Prep
- Audit `globals.css` and `tailwind.config.ts`.
- Add "Elevated Canvas" tokens (Surface: #F9F9F8, Primary: #FF6B00, etc.).

### Phase 2: Shell Updates
- Update `Sidebar.tsx` and `Topbar.tsx` to match the new tonal layering and accent colors.

### Phase 3: Component Infrastructure
- Create `SourceBentoGrid.tsx` for adding knowledge.
- Create `SourceTable.tsx` for listing sources.

### Phase 4: Page Assembly
- Refactor `src/app/(app)/knowledge/page.tsx`.

### Phase 5: Verification
- Manual visual audit against Stitch screenshots.
- Linting and type checking.

---

## Agent Assignments
- `frontend-specialist`: Lead UI/UX implementation.
- `backend-specialist`: Advisor for Supabase data fetching if needed.
