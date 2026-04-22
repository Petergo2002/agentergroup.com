# Builder Page Restyling & Optimization

## Overview
The goal is to elevate the UX/UI of the Agent Builder interface (`src/app/(app)/agents/[id]/builder/page.tsx`). We need to ensure that the ReactFlow node canvas, side panels, node cards, and overall interaction perfectly match our premium SaaS "Precision UI" guidelines, while also performing smoothly.

## Project Type
WEB (`frontend-specialist`, `performance-optimizer`, `test-engineer`)

## Analysis & Success Criteria
Currently, the page is functioning and uses `@xyflow/react` but may lack the polished visual hierarchy, micro-interactions, dark mode elegance, and optimal spacing that defines the rest of the application.

**Success Criteria:**
1. Visual polish on React Flow nodes (Node badges, shadows, glassmorphism).
2. Smooth saving interactions and state management feedback.
3. No console errors or performance jitters when dragging nodes.

## Orchestration Plan (Phase 2 Parallel Execution)

### Task 1: UI Polish & ReactFlow Restyling
- **Agent:** `frontend-specialist`
- **Action:** Refine `AgentNode` UI inside `builder/page.tsx`. Upgrade spacing, tweak primary colors, ensure `dark:bg-surface-bright` logic is robust, and elevate borders using `ring-outline-variant/10`.
- **Verify:** Visual check of the builder canvas modes.

### Task 2: Performance Profiling
- **Agent:** `performance-optimizer`
- **Action:** Review memoization in the builder state (saving routines, canvas dragging) to prevent unnecessary re-renders of the large 3000+ line file.
- **Verify:** Run a quick lighthouse audit or manual performance review.

### Task 3: Interactive Testing & Verification
- **Agent:** `test-engineer`
- **Action:** Execute the final test verifications (linting, typescript builds, and `ux_audit.py`). Ensure the builder page is fully functional.
- **Verify:** `npm run dev` and python scripts pass.

## Phase X: System Verification Checklist
- [ ] Run Lint & Compile (`npx tsc --noEmit`)
- [ ] UX Audit (`python .agent/skills/frontend-design/scripts/ux_audit.py`)
- [ ] Manual browser check of ReactFlow nodes
